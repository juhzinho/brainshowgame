import {
  broadcastState,
  buildClientState,
  getRoom,
  isRoomLockError,
  resetSabotagesForRound,
  saveRoom,
  withRoomLock,
} from './room-manager'
import { publishRoomEvent } from './ably'
import { getQuestionsForRound } from './question-bank'
import type { Room } from './game-state'
import { ALL_COUNTER_ATTACKS, ROUND_DESCRIPTIONS, ROUND_NAMES } from './game-state'

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

function setPhase(room: Room, phase: Room['state'], detail: string | null, durationMs: number | null, hostMessage?: string, hostAnimation?: Room['hostAnimation']) {
  const now = Date.now()
  room.state = phase
  room.phaseDetail = detail
  room.phaseStartedAt = now
  room.phaseEndsAt = durationMs ? now + durationMs : null
  room.timer = 0
  if (hostMessage !== undefined) room.hostMessage = hostMessage
  if (hostAnimation !== undefined) room.hostAnimation = hostAnimation
}

function clearQuestionState(room: Room) {
  room.currentQuestion = null
  room.answers = {}
  room.answerTimestamps = {}
}

function setupRound(room: Room) {
  const roundConfig = room.rounds[room.currentRound]
  if (!roundConfig) {
    endGame(room)
    return
  }

  room.currentQuestionIndex = 0
  room.eliminatedThisRound = []
  room.stealVotes = {}
  room.stealVictimId = null
  room.stolenPoints = 0
  room.counterAttackTargetId = null
  room.counterAttackCards = []
  room.chosenCardIndex = null
  clearQuestionState(room)
  resetSabotagesForRound(room)

  room.players.forEach((player) => {
    player.isEliminated = false
  })

  room.roundQuestions = getQuestionsForRound(
    roundConfig.type,
    roundConfig.questionCount,
    undefined,
    room.selectedCategories.length > 0 ? room.selectedCategories : undefined,
    room.usedQuestionIds
  )

  room.roundQuestions.forEach((question) => {
    room.usedQuestionIds.push(question.id)
  })

  setPhase(
    room,
    'round-announce',
    'round-title',
    3000,
    `Rodada ${room.currentRound + 1}: ${ROUND_NAMES[roundConfig.type]}!`,
    'talk'
  )
}

function showRoundDescription(room: Room) {
  const roundConfig = room.rounds[room.currentRound]
  if (!roundConfig) {
    endGame(room)
    return
  }

  setPhase(room, 'round-announce', 'round-description', 2500, ROUND_DESCRIPTIONS[roundConfig.type], 'point')
}

function showQuestion(room: Room) {
  const question = room.roundQuestions[room.currentQuestionIndex]
  const roundConfig = room.rounds[room.currentRound]
  if (!question || !roundConfig) {
    showRoundScores(room)
    return
  }

  room.currentQuestion = question
  room.answers = {}
  room.answerTimestamps = {}
  setPhase(
    room,
    'question',
    'question-read',
    1500,
    `Pergunta ${room.currentQuestionIndex + 1} de ${room.roundQuestions.length} - ${question.category}`,
    'talk'
  )
}

function startAnswering(room: Room) {
  const roundConfig = room.rounds[room.currentRound]
  if (!roundConfig) return
  setPhase(room, 'answering', null, roundConfig.timePerQuestion * 1000)
}

function scoreCurrentQuestion(room: Room) {
  const question = room.currentQuestion
  const roundConfig = room.rounds[room.currentRound]
  if (!question || !roundConfig) return

  const startTime = room.phaseStartedAt || Date.now()
  const timeTotal = roundConfig.timePerQuestion * 1000
  const correctIndex = question.correctIndex

  room.players.forEach((player) => {
    if (player.activeSabotageEffect && Date.now() > player.activeSabotageEffect.expiresAt) {
      player.activeSabotageEffect = null
    }
    if (player.isEliminated) return

    const answer = room.answers[player.id]
    const isCorrect = answer === correctIndex

    if (isCorrect) {
      let points = roundConfig.pointsPerCorrect

      if (roundConfig.bonusForSpeed) {
        const answerTime = room.answerTimestamps[player.id]
        if (answerTime) {
          const elapsed = answerTime - startTime
          const speedRatio = Math.max(0, 1 - elapsed / timeTotal)
          points += Math.floor(points * 0.5 * speedRatio)
        }
      }

      if (player.lastAnswerCorrect) {
        player.streak += 1
        points += player.streak * 10
      } else {
        player.streak = 1
      }

      const activeEffect = player.activeSabotageEffect
      if (activeEffect?.type === 'steal') {
        const stealer = room.players.find((entry) => entry.id === activeEffect.fromPlayerId)
        if (stealer) {
          const stolenPoints = 50
          player.score = Math.max(0, player.score - stolenPoints)
          stealer.score += stolenPoints
        }
      }

      if (activeEffect?.type === 'halve') {
        points = Math.floor(points / 2)
      }

      if (roundConfig.type === 'final') {
        points *= 2
      }

      player.score += points
      player.lastAnswerCorrect = true
    } else {
      player.lastAnswerCorrect = false
      player.streak = 0

      if (roundConfig.type === 'final') {
        player.score = Math.max(0, player.score - 100)
      }

      if (roundConfig.type === 'elimination') {
        player.isEliminated = true
        room.eliminatedThisRound.push(player.id)
      }
    }

    player.activeSabotageEffect = null
  })

  if (roundConfig.type === 'elimination') {
    const survivors = room.players.filter((player) => !player.isEliminated)
    if (survivors.length <= 1 && survivors[0]) {
      survivors[0].score += 200
      room.hostMessage = `${survivors[0].name} sobreviveu! +200 pontos de bonus!`
      room.hostAnimation = 'celebrate'
    }
  } else {
    const correctCount = room.players.filter((player) => !player.isEliminated && room.answers[player.id] === correctIndex).length
    const totalActive = room.players.filter((player) => !player.isEliminated).length
    room.hostMessage = `${correctCount} de ${totalActive} acertaram! Resposta: ${question.options[correctIndex]}`
    room.hostAnimation = correctCount > totalActive / 2 ? 'celebrate' : 'sad'
  }

  setPhase(room, 'reveal', 'reveal', 3000, room.hostMessage, room.hostAnimation)
}

function showRoundScores(room: Room) {
  clearQuestionState(room)
  const sorted = [...room.players].sort((left, right) => right.score - left.score)
  const leader = sorted[0]
  setPhase(
    room,
    'round-scores',
    null,
    4000,
    leader ? `${leader.name} esta na lideranca com ${leader.score} pontos!` : 'Fim da rodada!',
    'celebrate'
  )
}

function maybeStartStealVote(room: Room): boolean {
  if (room.currentRound % 3 === 0 && room.players.length >= 2) {
    room.stealVotes = {}
    room.stealVictimId = null
    room.stolenPoints = 0
    room.counterAttackTargetId = null
    room.counterAttackCards = []
    room.chosenCardIndex = null
    setPhase(room, 'steal-vote', null, 15000, 'Hora do Roubo! Vote em quem quer roubar os pontos!', 'point')
    return true
  }

  return false
}

function advanceAfterRoundScores(room: Room) {
  room.currentRound += 1
  if (room.currentRound >= room.totalRounds) {
    endGame(room)
    return
  }

  if (!maybeStartStealVote(room)) {
    setupRound(room)
  }
}

function resolveStealVote(room: Room) {
  const voteCounts: Record<string, number> = {}
  Object.values(room.stealVotes).forEach((targetId) => {
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1
  })

  let maxVotes = 0
  let victimId: string | null = null
  Object.entries(voteCounts).forEach(([id, count]) => {
    if (count > maxVotes) {
      maxVotes = count
      victimId = id
    }
  })

  if (!victimId || maxVotes === 0) {
    room.stealVictimId = null
    room.stolenPoints = 0
    setPhase(room, 'steal-result', 'no-votes', 3000, 'Ninguem votou! Nenhum ponto roubado!', 'sad')
    return
  }

  const victim = room.players.find((player) => player.id === victimId)
  if (!victim) {
    setPhase(room, 'steal-result', 'invalid-victim', 3000, 'Roubo cancelado.', 'sad')
    return
  }

  const stolenPoints = Math.floor(victim.score * 0.3)
  const voters = Object.entries(room.stealVotes)
    .filter(([voterId, targetId]) => targetId === victimId && voterId !== victimId)
    .map(([voterId]) => voterId)

  room.stealVictimId = victimId
  room.stolenPoints = stolenPoints

  if (voters.length > 0 && stolenPoints > 0) {
    const pointsEach = Math.floor(stolenPoints / voters.length)
    victim.score = Math.max(0, victim.score - stolenPoints)
    voters.forEach((voterId) => {
      const voter = room.players.find((player) => player.id === voterId)
      if (voter) voter.score += pointsEach
    })
  }

  setPhase(room, 'steal-result', 'resolved', 3000, `${victim.name} foi escolhido! ${stolenPoints} pontos serao roubados!`, 'celebrate')
}

function startCounterAttack(room: Room) {
  if (!room.stealVictimId || room.players.length < 2) {
    setupRound(room)
    return
  }

  room.counterAttackCards = shuffle(ALL_COUNTER_ATTACKS).slice(0, 5)
  room.chosenCardIndex = null

  const victim = room.players.find((player) => player.id === room.stealVictimId)
  setPhase(
    room,
    'counter-attack',
    null,
    12000,
    `${victim?.name || 'Jogador'} tem um contra-ataque! Escolha uma carta!`,
    'point'
  )
}

function resolveCounterAttack(room: Room) {
  if (room.chosenCardIndex === null) {
    room.chosenCardIndex = Math.floor(Math.random() * Math.max(1, room.counterAttackCards.length))
  }

  const victimId = room.stealVictimId
  const victim = room.players.find((player) => player.id === victimId)
  const chosenCard = room.counterAttackCards[room.chosenCardIndex]
  const voters = Object.entries(room.stealVotes)
    .filter(([voterId, targetId]) => targetId === victimId && voterId !== victimId)
    .map(([voterId]) => voterId)

  if (!chosenCard || !victim) {
    setPhase(room, 'counter-result', null, 5000, 'Contra-ataque perdido!', 'sad')
    return
  }

  switch (chosenCard.type) {
    case 'zero': {
      const topVoter = voters
        .map((id) => room.players.find((player) => player.id === id))
        .filter((player): player is NonNullable<typeof player> => Boolean(player))
        .sort((left, right) => right.score - left.score)[0]
      if (topVoter) {
        const zeroed = topVoter.score
        topVoter.score = 0
        room.counterAttackTargetId = topVoter.id
        room.hostMessage = `ZERAR! ${victim.name} zerou os pontos de ${topVoter.name}! (-${zeroed} pts)`
      } else {
        room.hostMessage = `${victim.name} tentou zerar, mas nao havia alvo!`
      }
      room.hostAnimation = 'celebrate'
      break
    }
    case 'half':
      room.players.forEach((player) => {
        if (player.id !== victimId && !player.isEliminated) {
          player.score = Math.floor(player.score / 2)
        }
      })
      room.hostMessage = `METADE GERAL! ${victim.name} cortou os pontos de todos pela metade!`
      room.hostAnimation = 'celebrate'
      break
    case 'shield':
      victim.score += room.stolenPoints
      voters.forEach((voterId) => {
        const voter = room.players.find((player) => player.id === voterId)
        if (voter && room.stolenPoints > 0) {
          const pointsEach = Math.floor(room.stolenPoints / Math.max(1, voters.length))
          voter.score = Math.max(0, voter.score - pointsEach)
        }
      })
      room.hostMessage = `ESCUDO! ${victim.name} recuperou todos os ${room.stolenPoints} pontos!`
      room.hostAnimation = 'celebrate'
      break
    case 'reverse':
      voters.forEach((voterId) => {
        const voter = room.players.find((player) => player.id === voterId)
        if (voter) {
          const loss = Math.floor(voter.score * 0.5)
          voter.score = Math.max(0, voter.score - loss)
        }
      })
      room.hostMessage = `REVERSO! Quem votou em ${victim.name} perdeu 50% dos pontos!`
      room.hostAnimation = 'celebrate'
      break
    case 'bomb': {
      const leader = [...room.players]
        .filter((player) => player.id !== victimId && !player.isEliminated)
        .sort((left, right) => right.score - left.score)[0]
      if (leader) {
        const loss = Math.floor(leader.score * 0.4)
        leader.score = Math.max(0, leader.score - loss)
        room.counterAttackTargetId = leader.id
        room.hostMessage = `BOMBA! ${leader.name} (lider) perdeu ${loss} pontos!`
      } else {
        room.hostMessage = 'BOMBA! Mas nao havia lider...'
      }
      room.hostAnimation = 'celebrate'
      break
    }
    case 'double-steal': {
      const topVoter = voters
        .map((id) => room.players.find((player) => player.id === id))
        .filter((player): player is NonNullable<typeof player> => Boolean(player))
        .sort((left, right) => right.score - left.score)[0]
      if (topVoter) {
        const steal = Math.floor(topVoter.score * 0.4)
        topVoter.score = Math.max(0, topVoter.score - steal)
        victim.score += steal
        room.counterAttackTargetId = topVoter.id
        room.hostMessage = `ROUBO DUPLO! ${victim.name} roubou ${steal} pts de ${topVoter.name}!`
      } else {
        room.hostMessage = 'ROUBO DUPLO! Mas nao havia alvo!'
      }
      room.hostAnimation = 'celebrate'
      break
    }
    case 'nothing':
    default:
      room.hostMessage = `NADA! ${victim.name} tirou a carta vazia. Azar!`
      room.hostAnimation = 'sad'
      break
  }

  setPhase(room, 'counter-result', null, 5000, room.hostMessage, room.hostAnimation)
}

function endGame(room: Room) {
  clearQuestionState(room)
  const sorted = [...room.players].sort((left, right) => right.score - left.score)
  const winner = sorted[0]
  setPhase(
    room,
    'final-scores',
    null,
    15000,
    winner ? `Parabens ${winner.name}! Voce venceu com ${winner.score} pontos!` : 'Fim de jogo!',
    'celebrate'
  )
}

function finishGame(room: Room) {
  setPhase(room, 'finished', null, null, room.hostMessage, room.hostAnimation)
}

function canFinishAnsweringEarly(room: Room): boolean {
  const activePlayers = room.players.filter((player) => !player.isEliminated && player.connected)
  return activePlayers.length > 0 && activePlayers.every((player) => room.answers[player.id] !== undefined)
}

function canFinishStealVoteEarly(room: Room): boolean {
  const activePlayers = room.players.filter((player) => player.connected && !player.isEliminated)
  return activePlayers.length > 0 && activePlayers.every((player) => room.stealVotes[player.id] !== undefined)
}

function clearExpiredSabotages(room: Room) {
  const now = Date.now()
  room.players.forEach((player) => {
    if (player.activeSabotageEffect && player.activeSabotageEffect.expiresAt <= now) {
      player.activeSabotageEffect = null
    }
  })
}

function advanceRoomState(room: Room): boolean {
  clearExpiredSabotages(room)
  const now = Date.now()

  if (room.state === 'waiting' || room.state === 'finished') {
    return false
  }

  if (room.state === 'answering' && (canFinishAnsweringEarly(room) || (room.phaseEndsAt !== null && now >= room.phaseEndsAt))) {
    scoreCurrentQuestion(room)
    return true
  }

  if (room.state === 'steal-vote' && (canFinishStealVoteEarly(room) || (room.phaseEndsAt !== null && now >= room.phaseEndsAt))) {
    resolveStealVote(room)
    return true
  }

  if (room.state === 'counter-attack' && room.chosenCardIndex !== null) {
    resolveCounterAttack(room)
    return true
  }

  if (room.phaseEndsAt === null || now < room.phaseEndsAt) {
    return false
  }

  switch (room.state) {
    case 'round-announce':
      if (room.phaseDetail === 'pregame') {
        setupRound(room)
      } else if (room.phaseDetail === 'round-title') {
        showRoundDescription(room)
      } else {
        showQuestion(room)
      }
      return true
    case 'question':
      startAnswering(room)
      return true
    case 'reveal':
      room.currentQuestionIndex += 1
      if (room.currentQuestionIndex < room.roundQuestions.length) {
        showQuestion(room)
      } else {
        showRoundScores(room)
      }
      return true
    case 'round-scores':
      advanceAfterRoundScores(room)
      return true
    case 'steal-result':
      startCounterAttack(room)
      return true
    case 'counter-attack':
      resolveCounterAttack(room)
      return true
    case 'counter-result':
      setupRound(room)
      return true
    case 'final-scores':
      finishGame(room)
      return true
    default:
      return false
  }
}

export async function advanceRoom(roomId: string): Promise<Room | null> {
  let changed = false
  let room: Room | null = null

  try {
    room = await withRoomLock(roomId, async () => {
      const current = await getRoom(roomId)
      if (!current) return null

      while (advanceRoomState(current)) {
        changed = true
      }

      if (changed) {
        await saveRoom(current)
      }

      return current
    })
  } catch (error) {
    if (!isRoomLockError(error)) {
      throw error
    }

    return getRoom(roomId)
  }

  if (room && changed) {
    await broadcastState(roomId, room)
    await publishRoomEvent(roomId, 'room-updated', { state: buildClientState(room) })
  }

  return room
}

export async function startGame(roomId: string): Promise<boolean> {
  const started = await withRoomLock(roomId, async () => {
    const room = await getRoom(roomId)
    if (!room || room.state !== 'waiting' || room.players.length < 1) return false
    if (!room.players.every((player) => player.isReady)) return false

    room.players.forEach((player) => {
      player.score = 0
      player.streak = 0
      player.isEliminated = false
      player.lastAnswerCorrect = null
      player.betAmount = 0
      player.connected = true
      player.activeSabotageEffect = null
    })

    room.currentRound = 0
    room.usedQuestionIds = []
    room.roundQuestions = []
    room.currentQuestionIndex = 0
    room.stealVotes = {}
    room.stealVictimId = null
    room.stolenPoints = 0
    room.counterAttackTargetId = null
    room.counterAttackCards = []
    room.chosenCardIndex = null
    setPhase(room, 'round-announce', 'pregame', 2000, 'O jogo vai comecar! Preparem-se!', 'celebrate')
    await saveRoom(room)
    return true
  })

  if (started) {
    const room = await getRoom(roomId)
    await broadcastState(roomId)
    await publishRoomEvent(roomId, 'game-started', room ? { state: buildClientState(room) } : undefined)
  }

  return started
}

export async function restartGame(roomId: string): Promise<boolean> {
  const restarted = await withRoomLock(roomId, async () => {
    const room = await getRoom(roomId)
    if (!room || (room.state !== 'final-scores' && room.state !== 'finished')) return false

    const previouslyUsedIds = [...room.usedQuestionIds]
    room.players.forEach((player) => {
      player.score = 0
      player.streak = 0
      player.isEliminated = false
      player.lastAnswerCorrect = null
      player.betAmount = 0
      player.connected = true
      player.activeSabotageEffect = null
    })

    room.currentRound = 0
    room.usedQuestionIds = previouslyUsedIds
    room.roundQuestions = []
    room.currentQuestionIndex = 0
    room.stealVotes = {}
    room.stealVictimId = null
    room.stolenPoints = 0
    room.counterAttackTargetId = null
    room.counterAttackCards = []
    room.chosenCardIndex = null
    setPhase(room, 'round-announce', 'pregame', 2000, 'Nova partida! Preparem-se!', 'celebrate')
    await saveRoom(room)
    return true
  })

  if (restarted) {
    const room = await getRoom(roomId)
    await broadcastState(roomId)
    await publishRoomEvent(roomId, 'game-restarted', room ? { state: buildClientState(room) } : undefined)
  }

  return restarted
}

export async function submitStealVote(roomId: string, voterId: string, targetId: string): Promise<boolean> {
  const success = await withRoomLock(roomId, async () => {
    const room = await getRoom(roomId)
    if (!room || room.state !== 'steal-vote' || voterId === targetId) return false
    const voter = room.players.find((player) => player.id === voterId)
    const target = room.players.find((player) => player.id === targetId)
    if (!voter || !target || voter.isEliminated || !voter.connected || target.isEliminated || !target.connected) return false
    room.stealVotes[voterId] = targetId
    await saveRoom(room)
    return true
  })

  if (success) {
    const room = await advanceRoom(roomId)
    await publishRoomEvent(roomId, 'steal-vote-submitted', room ? { state: buildClientState(room) } : undefined)
  }

  return success
}

export async function submitCounterAttack(roomId: string, victimId: string, cardIndex: number): Promise<boolean> {
  const success = await withRoomLock(roomId, async () => {
    const room = await getRoom(roomId)
    if (!room || room.state !== 'counter-attack' || room.stealVictimId !== victimId) return false
    if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= room.counterAttackCards.length) return false
    if (room.chosenCardIndex !== null) return false
    room.chosenCardIndex = cardIndex
    await saveRoom(room)
    return true
  })

  if (success) {
    const room = await advanceRoom(roomId)
    await publishRoomEvent(roomId, 'counter-attack-submitted', room ? { state: buildClientState(room) } : undefined)
  }

  return success
}

export async function stopGame(roomId: string): Promise<void> {
  await withRoomLock(roomId, async () => {
    const room = await getRoom(roomId)
    if (!room) return
    setPhase(room, 'finished', null, null)
    await saveRoom(room)
  })
  const room = await getRoom(roomId)
  await broadcastState(roomId)
  await publishRoomEvent(roomId, 'game-stopped', room ? { state: buildClientState(room) } : undefined)
}
