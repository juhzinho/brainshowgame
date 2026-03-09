import type { Room, Player, GamePhase, SabotageEffect, SabotageType } from './game-state'
import { PLAYER_COLORS, QUESTION_CATEGORIES, ROUND_CONFIGS } from './game-state'
import {
  acquireRoomLock,
  deleteStoredRoom,
  getQuestionHistory,
  getRoomPresence,
  getStoredRoom,
  listStoredRooms,
  releaseRoomLock,
  setPlayerPresence,
  setQuestionHistory,
  setStoredRoom,
} from './storage'

type SSEConnection = {
  playerId: string
  send: (text: string) => void
  close: () => void
}

const globalForConnections = globalThis as unknown as {
  __brainshow_connections?: Map<string, SSEConnection[]>
}

if (!globalForConnections.__brainshow_connections) {
  globalForConnections.__brainshow_connections = new Map<string, SSEConnection[]>()
}

const connections = globalForConnections.__brainshow_connections
const VALID_CATEGORIES = new Set(QUESTION_CATEGORIES.map((category) => category.id))
const VALID_SABOTAGES = new Set<SabotageType>(['freeze', 'invert', 'steal', 'blind', 'halve'])
const PLAYER_NAME_MIN_LENGTH = 2
const PLAYER_NAME_MAX_LENGTH = 15
const ROOM_ID_LENGTH = 5
const INACTIVE_THRESHOLD = 18000

function createPlayerSabotages() {
  return [
    { type: 'freeze' as const, used: false },
    { type: 'invert' as const, used: false },
    { type: 'steal' as const, used: false },
    { type: 'blind' as const, used: false },
    { type: 'halve' as const, used: false },
  ]
}

function clearExpiredSabotageEffect(player: Player, now = Date.now()): boolean {
  if (player.activeSabotageEffect && player.activeSabotageEffect.expiresAt <= now) {
    player.activeSabotageEffect = null
    return true
  }

  return false
}

function applyPresenceToRoom(room: Room, presenceByPlayerId: Record<string, number>): Room {
  const now = Date.now()

  room.players.forEach((player) => {
    const presenceTimestamp = presenceByPlayerId[player.id]
    if (presenceTimestamp === undefined) {
      const fallbackLastActiveAt = player.lastActiveAt || 0
      player.lastActiveAt = fallbackLastActiveAt
      player.connected = player.connected && now - fallbackLastActiveAt <= INACTIVE_THRESHOLD
      return
    }

    player.lastActiveAt = presenceTimestamp
    player.connected = now - presenceTimestamp <= INACTIVE_THRESHOLD
  })

  return room
}

function generatePlayerToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
}

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

async function generateUniqueRoomId(): Promise<string> {
  let roomId = generateRoomId()
  while (await getStoredRoom(roomId)) {
    roomId = generateRoomId()
  }
  return roomId
}

export async function withRoomLock<T>(roomId: string, handler: () => Promise<T>, retries = 15): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const token = await acquireRoomLock(roomId)
    if (token) {
      try {
        return await handler()
      } finally {
        await releaseRoomLock(roomId, token)
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  throw new Error(`Could not acquire room lock for ${roomId}`)
}

export function isRoomLockError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('Could not acquire room lock for ')
}

export function normalizePlayerName(playerName: string): string | null {
  if (typeof playerName !== 'string') return null

  const normalized = playerName.replace(/\s+/g, ' ').trim()
  if (
    normalized.length < PLAYER_NAME_MIN_LENGTH ||
    normalized.length > PLAYER_NAME_MAX_LENGTH
  ) {
    return null
  }

  return normalized
}

export function sanitizeCategories(categories: unknown): string[] | null {
  if (!Array.isArray(categories)) return null

  const sanitized = categories
    .filter((category): category is string => typeof category === 'string')
    .map((category) => category.trim())
    .filter((category) => VALID_CATEGORIES.has(category))

  return Array.from(new Set(sanitized))
}

export async function isAuthorizedPlayer(roomId: string, playerId: string, playerToken: string): Promise<boolean> {
  if (!roomId || !playerId || !playerToken) return false
  const room = await getStoredRoom(roomId)
  return room?.playerTokens[playerId] === playerToken
}

export async function getPublicRoomState(roomId: string) {
  const room = await getStoredRoom(roomId)
  if (!room) return null

  const host = room.players.find((player) => player.isHost)
  return {
    roomId: room.id,
    hostName: host?.name || 'Desconhecido',
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    state: room.state,
  }
}

export async function createRoom(
  hostName: string,
  historyOwnerId: string | null,
  usedQuestionIds: string[] = []
): Promise<{ room: Room; playerId: string; playerToken: string }> {
  const roomId = await generateUniqueRoomId()
  const playerId = crypto.randomUUID()
  const playerToken = generatePlayerToken()
  const now = Date.now()

  const hostPlayer: Player = {
    id: playerId,
    name: hostName,
    color: PLAYER_COLORS[0],
    score: 0,
    sabotages: createPlayerSabotages(),
    isReady: true,
    isHost: true,
    isEliminated: false,
    activeSabotageEffect: null,
    streak: 0,
    lastAnswerCorrect: null,
    betAmount: 0,
    connected: true,
    lastActiveAt: now,
    joinedInProgress: false,
  }

  const room: Room = {
    id: roomId,
    hostId: playerId,
    historyOwnerId,
    players: [hostPlayer],
    maxPlayers: 20,
    state: 'waiting',
    currentRound: 0,
    totalRounds: ROUND_CONFIGS.length,
    rounds: [...ROUND_CONFIGS],
    currentQuestion: null,
    currentQuestionIndex: 0,
    timer: 0,
    answers: {},
    answerTimestamps: {},
    hostMessage: 'Bem-vindos ao Brain Show! Aguardando jogadores...',
    hostAnimation: 'idle',
    eliminatedThisRound: [],
    selectedCategories: [],
    usedQuestionIds: [...usedQuestionIds],
    stealVotes: {},
    stealVictimId: null,
    stolenPoints: 0,
    counterAttackTargetId: null,
    counterAttackCards: [],
    chosenCardIndex: null,
    roundQuestions: [],
    phaseStartedAt: null,
    phaseEndsAt: null,
    phaseDetail: null,
    playerTokens: { [playerId]: playerToken },
    createdAt: now,
  }

  await setStoredRoom(room)
  await setPlayerPresence(roomId, playerId, now)
  if (historyOwnerId) {
    await setQuestionHistory(historyOwnerId, usedQuestionIds)
  }
  return { room, playerId, playerToken }
}

export async function joinRoom(roomId: string, playerName: string): Promise<{ player: Player; room: Room; playerToken: string } | null> {
  return withRoomLock(roomId, async () => {
    const room = await getStoredRoom(roomId)
    if (!room) return null
    if (room.players.length >= room.maxPlayers) return null
    if (room.players.some((player) => player.name.toLowerCase() === playerName.toLowerCase())) return null

    const playerId = crypto.randomUUID()
    const playerToken = generatePlayerToken()
    const colorIndex = room.players.length % PLAYER_COLORS.length
    const now = Date.now()
    const isLiveGame = room.state !== 'waiting' && room.state !== 'finished'

    const player: Player = {
      id: playerId,
      name: playerName,
      color: PLAYER_COLORS[colorIndex],
      score: 0,
      sabotages: createPlayerSabotages(),
      isReady: isLiveGame,
      isHost: false,
      isEliminated: isLiveGame,
      activeSabotageEffect: null,
      streak: 0,
      lastAnswerCorrect: null,
      betAmount: 0,
      connected: true,
      lastActiveAt: now,
      joinedInProgress: isLiveGame,
    }

    room.players.push(player)
    room.playerTokens[playerId] = playerToken
    room.hostMessage = isLiveGame
      ? `${playerName} entrou! Vai participar a partir da proxima rodada.`
      : `${playerName} entrou na sala!`
    room.hostAnimation = 'point'

    await setStoredRoom(room)
    await setPlayerPresence(roomId, playerId, now)
    return { player, room, playerToken }
  })
}

export async function getRoom(roomId: string): Promise<Room | null> {
  const room = await getStoredRoom(roomId)
  if (!room) return null

  const presenceByPlayerId = await getRoomPresence(roomId)
  return applyPresenceToRoom(room, presenceByPlayerId)
}

export async function saveRoom(room: Room): Promise<void> {
  await setStoredRoom(room)
  if (room.historyOwnerId) {
    await setQuestionHistory(room.historyOwnerId, room.usedQuestionIds)
  }
}

export async function listRooms(): Promise<{ id: string; playerCount: number; maxPlayers: number; state: GamePhase; hostName: string }[]> {
  const rooms = await listStoredRooms()
  return rooms.map((room) => {
    const host = room.players.find((player) => player.isHost)
    return {
      id: room.id,
      playerCount: room.players.length,
      maxPlayers: room.maxPlayers,
      state: room.state,
      hostName: host?.name || 'Desconhecido',
    }
  })
}

export async function deleteRoom(roomId: string): Promise<boolean> {
  const room = await getStoredRoom(roomId)
  if (!room) return false

  const conns = connections.get(roomId)
  if (conns) {
    conns.forEach((connection) => {
      try {
        connection.close()
      } catch {}
    })
  }
  connections.delete(roomId)
  await deleteStoredRoom(roomId)
  return true
}

export async function setPlayerReady(roomId: string, playerId: string): Promise<boolean> {
  return withRoomLock(roomId, async () => {
    const room = await getStoredRoom(roomId)
    if (!room || room.state !== 'waiting') return false
    const player = room.players.find((entry) => entry.id === playerId)
    if (!player) return false
    player.isReady = true
    await setStoredRoom(room)
    return true
  })
}

export async function kickPlayer(roomId: string, hostId: string, targetPlayerId: string): Promise<Room | null> {
  return withRoomLock(roomId, async () => {
    const room = await getStoredRoom(roomId)
    if (!room || room.state !== 'waiting') return null
    if (room.hostId !== hostId || hostId === targetPlayerId) return null

    const host = room.players.find((player) => player.id === hostId && player.isHost)
    const target = room.players.find((player) => player.id === targetPlayerId && !player.isHost)
    if (!host || !target) return null

    room.players = room.players.filter((player) => player.id !== targetPlayerId)
    delete room.playerTokens[targetPlayerId]
    delete room.answers[targetPlayerId]
    delete room.answerTimestamps[targetPlayerId]
    delete room.stealVotes[targetPlayerId]

    Object.keys(room.stealVotes).forEach((voterId) => {
      if (room.stealVotes[voterId] === targetPlayerId) {
        delete room.stealVotes[voterId]
      }
    })

    if (room.stealVictimId === targetPlayerId) {
      room.stealVictimId = null
      room.stolenPoints = 0
    }

    if (room.counterAttackTargetId === targetPlayerId) {
      room.counterAttackTargetId = null
      room.counterAttackCards = []
      room.chosenCardIndex = null
    }

    room.eliminatedThisRound = room.eliminatedThisRound.filter((playerId) => playerId !== targetPlayerId)
    room.hostMessage = `${target.name} foi expulso da sala por ${host.name}.`
    room.hostAnimation = 'point'

    await setStoredRoom(room)
    return room
  })
}

export async function recordAnswer(roomId: string, playerId: string, answerIndex: number): Promise<boolean> {
  return withRoomLock(roomId, async () => {
    const room = await getStoredRoom(roomId)
    if (!room || room.state !== 'answering') return false
    if (room.answers[playerId] !== undefined) return false
    if (!Number.isInteger(answerIndex)) return false

    const player = room.players.find((entry) => entry.id === playerId)
    if (!player || player.isEliminated || !room.currentQuestion) return false
    clearExpiredSabotageEffect(player)
    if (answerIndex < 0 || answerIndex >= room.currentQuestion.options.length) return false
    if (player.activeSabotageEffect?.type === 'freeze') return false

    room.answers[playerId] = answerIndex
    room.answerTimestamps[playerId] = Date.now()
    await setStoredRoom(room)
    return true
  })
}

export async function applySabotage(roomId: string, fromPlayerId: string, toPlayerId: string, sabotageType: SabotageType): Promise<boolean> {
  return withRoomLock(roomId, async () => {
    const room = await getRoom(roomId)
    if (!room || (room.state !== 'question' && room.state !== 'answering')) return false
    if (!VALID_SABOTAGES.has(sabotageType) || fromPlayerId === toPlayerId) return false

    const fromPlayer = room.players.find((entry) => entry.id === fromPlayerId)
    const toPlayer = room.players.find((entry) => entry.id === toPlayerId)
    if (!fromPlayer || !toPlayer) return false
    clearExpiredSabotageEffect(fromPlayer)
    clearExpiredSabotageEffect(toPlayer)
    if (fromPlayer.isEliminated || toPlayer.isEliminated) return false
    if (room.answers[fromPlayerId] !== undefined || toPlayer.activeSabotageEffect) return false

    const sabotage = fromPlayer.sabotages.find((entry) => entry.type === sabotageType && !entry.used)
    if (!sabotage) return false

    sabotage.used = true
    const effect: SabotageEffect = {
      type: sabotageType,
      fromPlayerId,
      toPlayerId,
      expiresAt:
        Date.now() +
        (sabotageType === 'freeze'
          ? 3000
          : sabotageType === 'invert'
            ? 5000
            : sabotageType === 'blind'
              ? 4000
              : 999999),
    }

    toPlayer.activeSabotageEffect = effect
    room.hostMessage = `${fromPlayer.name} usou ${sabotageType === 'freeze' ? 'Congelar' : sabotageType === 'invert' ? 'Inverter' : 'Roubar'} em ${toPlayer.name}!`
    room.hostAnimation = 'point'
    await setStoredRoom(room)
    return true
  })
}

export function addConnection(roomId: string, playerId: string, send: (text: string) => void, close: () => void): void {
  const conns = connections.get(roomId) || []
  conns.push({ playerId, send, close })
  connections.set(roomId, conns)
}

export function removeConnection(roomId: string, playerId: string): void {
  const conns = connections.get(roomId) || []
  connections.set(roomId, conns.filter((connection) => connection.playerId !== playerId))
}

export async function broadcastState(roomId: string, room?: Room | null): Promise<void> {
  const nextRoom = room ?? (await getRoom(roomId))
  if (!nextRoom) return

  const conns = connections.get(roomId) || []
  const data = JSON.stringify({
    type: 'state-update',
    data: buildClientState(nextRoom),
    timestamp: Date.now(),
  })

  const alive: SSEConnection[] = []
  conns.forEach((connection) => {
    try {
      connection.send(`data: ${data}\n\n`)
      alive.push(connection)
    } catch {}
  })
  connections.set(roomId, alive)
}

export function buildClientState(room: Room) {
  const roundConfig = room.rounds[room.currentRound]
  const now = Date.now()
  const timer =
    room.state === 'answering' && room.phaseEndsAt
      ? Math.max(0, Math.ceil((room.phaseEndsAt - now) / 1000))
      : room.state === 'steal-vote' || room.state === 'counter-attack'
        ? Math.max(0, Math.ceil(((room.phaseEndsAt || now) - now) / 1000))
        : 0

  return {
    roomId: room.id,
    phase: room.state,
    players: room.players.map((player) => ({
      ...player,
      sabotages: player.sabotages,
    })),
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    roundType: roundConfig?.type || null,
    question: room.currentQuestion
      ? {
          id: room.currentQuestion.id,
          text: room.currentQuestion.text,
          category: room.currentQuestion.category,
          options: room.currentQuestion.options,
          difficulty: room.currentQuestion.difficulty,
        }
      : null,
    correctIndex: room.state === 'reveal' && room.currentQuestion ? room.currentQuestion.correctIndex : null,
    answersMap: room.state === 'reveal' ? { ...room.answers } : null,
    timer,
    phaseEndsAt: room.phaseEndsAt,
    serverNow: now,
    hostMessage: room.hostMessage,
    hostAnimation: room.hostAnimation,
    eliminatedThisRound: room.eliminatedThisRound,
    selectedCategories: room.selectedCategories || [],
    stealVotes: room.stealVotes || {},
    stealVictimId: room.stealVictimId || null,
    stolenPoints: room.stolenPoints || 0,
    counterAttackTargetId: room.counterAttackTargetId || null,
    counterAttackCards: room.counterAttackCards || [],
    chosenCardIndex: room.chosenCardIndex ?? null,
  }
}

export function resetSabotagesForRound(room: Room): void {
  room.players.forEach((player) => {
    player.sabotages = createPlayerSabotages()
    player.activeSabotageEffect = null
  })
}

export async function setRoomCategories(roomId: string, categories: string[]): Promise<boolean> {
  return withRoomLock(roomId, async () => {
    const room = await getStoredRoom(roomId)
    if (!room) return false
    room.selectedCategories = categories
    await setStoredRoom(room)
    return true
  })
}

export async function markPlayerActive(roomId: string, playerId: string): Promise<void> {
  const room = await getStoredRoom(roomId)
  if (!room || !room.players.some((player) => player.id === playerId)) return

  await setPlayerPresence(roomId, playerId, Date.now())
}

export async function cleanupOldRooms(): Promise<void> {
  const rooms = await listStoredRooms()
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
  await Promise.all(
    rooms
      .filter((room) => room.createdAt < twoHoursAgo)
      .map((room) => deleteStoredRoom(room.id))
  )
}

export async function getPersistedQuestionHistory(historyOwnerId: string | null): Promise<string[]> {
  if (!historyOwnerId) return []
  return getQuestionHistory(historyOwnerId)
}
