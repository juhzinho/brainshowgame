'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useGameStore } from '@/lib/use-game-store'
import type { SabotageType, Player, CounterAttackCard } from '@/lib/game-state'
import { ROUND_NAMES, SABOTAGE_NAMES, SABOTAGE_DESCRIPTIONS, CATEGORY_IMAGE_MAP } from '@/lib/game-state'
import { cn } from '@/lib/utils'
import { soundEngine } from '@/lib/sounds'
import Image from 'next/image'

interface GameHUDProps {
  onAnswer: (index: number) => void
  onSabotage: (targetId: string, type: SabotageType) => void
  onStealVote: (targetId: string) => void
  onCounterAttack: (cardIndex: number) => void
  onRestart?: () => void
}

export function GameHUD({ onAnswer, onSabotage, onStealVote, onCounterAttack, onRestart }: GameHUDProps) {
  const {
    phase,
    players,
    currentRound,
    totalRounds,
    roundType,
    question,
    correctIndex,
    timer,
    phaseEndsAt,
    serverOffsetMs,
    hostMessage,
    playerId,
    selectedAnswer,
    hasAnswered,
    eliminatedThisRound,
    showRoundAnnouncement,
    stealVotes,
    stealVictimId,
    stolenPoints,
    counterAttackCards,
    chosenCardIndex,
    answersMap,
  } = useGameStore()

  const prevPhaseRef = useRef(phase)
  const prevTimerRef = useRef(timer)
  const [timerTick, setTimerTick] = useState(() => Date.now())

  useEffect(() => {
    const isTimedPhase = phase === 'answering' || phase === 'steal-vote' || phase === 'counter-attack'
    if (!isTimedPhase || !phaseEndsAt) return

    const intervalId = setInterval(() => {
      setTimerTick(Date.now())
    }, 250)

    return () => clearInterval(intervalId)
  }, [phase, phaseEndsAt])

  const displayTimer = useMemo(() => {
    const isTimedPhase = phase === 'answering' || phase === 'steal-vote' || phase === 'counter-attack'
    if (!isTimedPhase || !phaseEndsAt) {
      return timer
    }

    const adjustedNow = timerTick + serverOffsetMs
    return Math.max(0, Math.ceil((phaseEndsAt - adjustedNow) / 1000))
  }, [phase, phaseEndsAt, serverOffsetMs, timer, timerTick])

  // Sound effects based on phase changes
  useEffect(() => {
    const prevPhase = prevPhaseRef.current
    prevPhaseRef.current = phase

    if (phase === 'round-announce' && prevPhase !== 'round-announce') {
      soundEngine.roundStart()
    }
    if (phase === 'question' && prevPhase !== 'question') {
      soundEngine.questionAppear()
    }
    if (phase === 'final-scores' && prevPhase !== 'final-scores') {
      soundEngine.victory()
    }
    if (phase === 'round-scores' && prevPhase !== 'round-scores') {
      soundEngine.scoresReveal()
    }
    if (phase === 'steal-vote' && prevPhase !== 'steal-vote') {
      soundEngine.stealAlert()
    }
    if (phase === 'counter-attack' && prevPhase !== 'counter-attack') {
      soundEngine.cardFlip()
    }
    if (phase === 'counter-result' && prevPhase !== 'counter-result') {
      soundEngine.cardReveal()
    }
    // Start bg music when game begins, stop when finished
    if (phase === 'round-announce' && prevPhase === 'waiting') {
      soundEngine.startBgMusic()
    }
    if (phase === 'finished' || phase === 'final-scores') {
      soundEngine.stopBgMusic()
    }
  }, [phase])

  // Timer sound effects
  useEffect(() => {
    if (phase === 'answering' && displayTimer > 0 && displayTimer <= 5 && displayTimer !== prevTimerRef.current) {
      if (displayTimer <= 3) {
        soundEngine.tickUrgent()
      } else {
        soundEngine.tick()
      }
    }
    prevTimerRef.current = displayTimer
  }, [displayTimer, phase])

  const myPlayer = useMemo(
    () => players.find((p) => p.id === playerId),
    [players, playerId]
  )

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => b.score - a.score),
    [players]
  )

  const [soundOn, setSoundOn] = useState(true)
  const [showScoreboard, setShowScoreboard] = useState(true)

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top Bar */}
      <TopBar
        currentRound={currentRound}
        totalRounds={totalRounds}
        roundType={roundType}
        timer={displayTimer}
        phase={phase}
        soundOn={soundOn}
        showScoreboard={showScoreboard}
        onToggleSound={() => {
          const isOn = soundEngine.toggle()
          setSoundOn(isOn)
        }}
        onToggleScoreboard={() => setShowScoreboard((current) => !current)}
      />

      {/* Host Message */}
      {hostMessage && (
        <div className="absolute top-24 left-1/2 z-10 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 sm:top-16 sm:w-auto">
          <div className="bg-[#0d1117]/90 backdrop-blur-xl border border-[#e94560]/30 rounded-xl px-4 py-2 sm:px-6 sm:py-3 text-center shadow-[0_0_30px_rgba(233,69,96,0.15)]">
            <p className="text-white/90 font-sans text-xs leading-relaxed sm:text-sm">{hostMessage}</p>
          </div>
        </div>
      )}

      {myPlayer?.joinedInProgress && myPlayer.isEliminated && (
        <div className="absolute top-40 left-1/2 z-10 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 sm:top-28 sm:w-auto">
          <div className="bg-[#0d1117]/92 backdrop-blur-xl border border-[#4da8da]/40 rounded-xl px-4 py-2 sm:px-6 sm:py-3 text-center shadow-[0_0_24px_rgba(77,168,218,0.2)]">
            <p className="text-[#7ed5ff] font-sans text-xs leading-relaxed sm:text-sm">
              Voce entrou com a partida em andamento. Vai jogar a partir da proxima rodada.
            </p>
          </div>
        </div>
      )}

      {/* Round Announcement Overlay */}
      {showRoundAnnouncement && roundType && (
        <RoundAnnouncement roundType={roundType} currentRound={currentRound} />
      )}

      {/* Question + Answers */}
      {/* Sabotage Panel */}
      {myPlayer && (phase === 'question' || phase === 'answering') && !hasAnswered && (
        <SabotagePanel
          myPlayer={myPlayer}
          players={players}
          playerId={playerId || ''}
          phase={phase}
          onSabotage={(tid, type) => {
            soundEngine.sabotage()
            onSabotage(tid, type)
          }}
        />
      )}

      {/* Question + Answers */}
      {question && (phase === 'question' || phase === 'answering' || phase === 'reveal') && (
        <QuestionPanel
          question={question}
          phase={phase}
          correctIndex={correctIndex}
          selectedAnswer={selectedAnswer}
          hasAnswered={hasAnswered}
          myPlayer={myPlayer || null}
          onAnswer={(idx) => {
            soundEngine.select()
            onAnswer(idx)
          }}
        />
      )}

      {/* Scoreboard Sidebar */}
      {showScoreboard && (
        <ScoreboardSidebar
          players={sortedPlayers}
          playerId={playerId}
          eliminatedThisRound={eliminatedThisRound}
        />
      )}

      {/* Player Answer Feedback - shows who got it right/wrong */}
      {phase === 'reveal' && answersMap && correctIndex !== null && (
        <PlayerAnswerFeedback
          players={players}
          answersMap={answersMap}
          correctIndex={correctIndex}
          playerId={playerId || ''}
        />
      )}

      {/* Final Scores Overlay */}
      {(phase === 'final-scores' || phase === 'round-scores') && (
        <ScoresOverlay
          players={sortedPlayers}
          phase={phase}
          currentRound={currentRound}
          onRestart={onRestart}
          isHost={myPlayer?.isHost ?? false}
        />
      )}

      {/* Steal Vote Overlay */}
      {phase === 'steal-vote' && (
        <StealVotePanel
          players={players}
          playerId={playerId || ''}
          timer={displayTimer}
          stealVotes={stealVotes}
          onVote={onStealVote}
        />
      )}

      {/* Steal Result / Counter Result Overlay */}
      {(phase === 'steal-result' || phase === 'counter-result') && (
        <StealResultOverlay
          hostMessage={hostMessage}
          stealVictimId={stealVictimId}
          stolenPoints={stolenPoints}
          players={players}
          phase={phase}
          counterAttackCards={counterAttackCards || []}
          chosenCardIndex={chosenCardIndex}
        />
      )}

      {/* Counter-Attack Cards Overlay */}
      {phase === 'counter-attack' && (
        <CounterAttackCardsPanel
          cards={counterAttackCards || []}
          playerId={playerId || ''}
          stealVictimId={stealVictimId}
          timer={displayTimer}
          chosenCardIndex={chosenCardIndex}
          onPickCard={onCounterAttack}
          players={players}
        />
      )}
    </div>
  )
}

// --- Sub-components ---

function TopBar({
  currentRound,
  totalRounds,
  roundType,
  timer,
  phase,
  soundOn,
  showScoreboard,
  onToggleSound,
  onToggleScoreboard,
}: {
  currentRound: number
  totalRounds: number
  roundType: string | null
  timer: number
  phase: string
  soundOn: boolean
  showScoreboard: boolean
  onToggleSound: () => void
  onToggleScoreboard: () => void
}) {
  const isTimerActive = phase === 'answering' && timer > 0
  const isTimerLow = timer <= 5 && timer > 0
  const isTimerCritical = timer <= 3 && timer > 0

  return (
    <div className="absolute top-0 left-0 right-0 z-20 grid grid-cols-2 gap-2 px-3 py-2 sm:flex sm:items-center sm:justify-between sm:px-4">
      <div className="flex items-stretch gap-2">
        <div className="bg-[#0d1117]/80 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 pointer-events-auto sm:px-4">
          <p className="text-[10px] text-white/50 font-sans uppercase tracking-wider">Rodada</p>
          <p className="text-white font-sans font-bold text-sm">
            {currentRound + 1}/{totalRounds}
          </p>
        </div>
        <button
          onClick={onToggleSound}
          className="bg-[#0d1117]/80 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 pointer-events-auto hover:bg-white/10 transition-colors"
          title={soundOn ? 'Desativar som' : 'Ativar som'}
        >
          <span className="text-white/70 text-[11px] font-sans sm:text-xs">{soundOn ? 'Som ON' : 'Som OFF'}</span>
        </button>
        <button
          onClick={onToggleScoreboard}
          className="bg-[#0d1117]/80 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 pointer-events-auto hover:bg-white/10 transition-colors"
          title={showScoreboard ? 'Ocultar placar' : 'Mostrar placar'}
        >
          <span className="text-white/70 text-[11px] font-sans sm:text-xs">
            {showScoreboard ? 'Placar ON' : 'Placar OFF'}
          </span>
        </button>
      </div>

      {roundType && (
        <div className="order-3 col-span-2 bg-[#0d1117]/80 backdrop-blur-md border border-[#e94560]/30 rounded-lg px-4 py-2 shadow-[0_0_15px_rgba(233,69,96,0.1)] sm:order-none sm:col-span-1">
          <p className="text-white font-sans font-bold text-sm text-center sm:text-sm">
            {ROUND_NAMES[roundType as keyof typeof ROUND_NAMES] || roundType}
          </p>
        </div>
      )}

      <div
        className={cn(
          'rounded-lg px-3 py-2 min-w-[70px] text-center transition-all duration-300 pointer-events-auto justify-self-end sm:px-4',
          isTimerActive
            ? isTimerCritical
              ? 'bg-[#e94560]/90 border-2 border-[#e94560] animate-pulse shadow-[0_0_20px_rgba(233,69,96,0.5)]'
              : isTimerLow
                ? 'bg-[#ff851b]/80 border border-[#ff851b]/60 shadow-[0_0_15px_rgba(255,133,27,0.3)]'
                : 'bg-[#0d1117]/80 backdrop-blur-md border border-white/10'
            : 'bg-[#0d1117]/80 backdrop-blur-md border border-white/10'
        )}
      >
        <p className="text-[10px] text-white/50 font-sans uppercase tracking-wider">Tempo</p>
        <p
          className={cn(
            'font-mono font-bold text-base sm:text-lg',
            isTimerCritical ? 'text-white' : isTimerLow ? 'text-[#0d1117]' : 'text-white'
          )}
        >
          {timer}s
        </p>
      </div>
    </div>
  )
}

function RoundAnnouncement({
  roundType,
  currentRound,
}: {
  roundType: string
  currentRound: number
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-30">
      <div className="bg-[#0d1117]/95 backdrop-blur-xl border-2 border-[#e94560] rounded-2xl px-12 py-10 text-center animate-in zoom-in-90 duration-500 shadow-[0_0_60px_rgba(233,69,96,0.3)]">
        <p className="text-white/50 text-sm font-sans mb-2 uppercase tracking-widest">{'Rodada ' + (currentRound + 1)}</p>
        <h2 className="text-white font-sans font-bold text-4xl mb-3">
          {ROUND_NAMES[roundType as keyof typeof ROUND_NAMES] || roundType}
        </h2>
        <div className="h-1 w-24 bg-gradient-to-r from-[#e94560] to-[#4da8da] rounded-full mx-auto" />
      </div>
    </div>
  )
}

function QuestionPanel({
  question,
  phase,
  correctIndex,
  selectedAnswer,
  hasAnswered,
  myPlayer,
  onAnswer,
}: {
  question: { text: string; category: string; options: string[]; difficulty: string }
  phase: string
  correctIndex: number | null
  selectedAnswer: number | null
  hasAnswered: boolean
  myPlayer: Player | null
  onAnswer: (index: number) => void
}) {
  const isInverted = myPlayer?.activeSabotageEffect?.type === 'invert'
  const isFrozen = myPlayer?.activeSabotageEffect?.type === 'freeze'
  const isBlind = myPlayer?.activeSabotageEffect?.type === 'blind'
  const isHalved = myPlayer?.activeSabotageEffect?.type === 'halve'
  const [blindTimer, setBlindTimer] = useState(0)

  // Blind effect - hide question for 4 seconds
  useEffect(() => {
    if (isBlind) {
      setBlindTimer(4)
      const interval = setInterval(() => {
        setBlindTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    } else {
      setBlindTimer(0)
    }
  }, [isBlind])

  // Sound on reveal
  useEffect(() => {
    if (phase === 'reveal' && selectedAnswer !== null && correctIndex !== null) {
      if (selectedAnswer === correctIndex) {
        soundEngine.correct()
        // Play streak sound if player has a streak
        if (myPlayer && myPlayer.streak >= 2) {
          setTimeout(() => soundEngine.streak(), 400)
        }
      } else {
        soundEngine.wrong()
      }
    }
  }, [phase, selectedAnswer, correctIndex, myPlayer])

  const displayOptions = useMemo(() => {
    if (!isInverted) return question.options.map((opt, i) => ({ text: opt, originalIndex: i }))
    const shuffled = question.options.map((opt, i) => ({ text: opt, originalIndex: i }))
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.text, isInverted])

  const optionLabels = ['A', 'B', 'C', 'D']
  const optionColors = [
    { bg: 'bg-[#e94560]/15', border: 'border-[#e94560]/40', hover: 'hover:bg-[#e94560]/30', glow: 'shadow-[0_0_15px_rgba(233,69,96,0.2)]' },
    { bg: 'bg-[#4da8da]/15', border: 'border-[#4da8da]/40', hover: 'hover:bg-[#4da8da]/30', glow: 'shadow-[0_0_15px_rgba(77,168,218,0.2)]' },
    { bg: 'bg-[#2ECC40]/15', border: 'border-[#2ECC40]/40', hover: 'hover:bg-[#2ECC40]/30', glow: 'shadow-[0_0_15px_rgba(46,204,64,0.2)]' },
    { bg: 'bg-[#ffd700]/15', border: 'border-[#ffd700]/40', hover: 'hover:bg-[#ffd700]/30', glow: 'shadow-[0_0_15px_rgba(255,215,0,0.2)]' },
  ]

  const showBlindOverlay = isBlind && blindTimer > 0

  return (
    <div className="absolute inset-x-0 bottom-0 top-36 z-20 flex flex-col justify-end overflow-y-auto p-3 sm:top-auto sm:p-4">
      {/* Sabotage warnings */}
      <div className="flex flex-wrap gap-2 justify-center mb-2">
        {isFrozen && (
          <span className="bg-[#4da8da]/20 border border-[#4da8da]/60 text-[#4da8da] text-xs font-sans font-bold px-3 py-1 rounded-full animate-pulse">
            CONGELADO!
          </span>
        )}
        {isInverted && (
          <span className="bg-[#ffd700]/20 border border-[#ffd700]/60 text-[#ffd700] text-xs font-sans font-bold px-3 py-1 rounded-full animate-pulse">
            ALTERNATIVAS EMBARALHADAS!
          </span>
        )}
        {showBlindOverlay && (
          <span className="bg-[#B10DC9]/20 border border-[#B10DC9]/60 text-[#B10DC9] text-xs font-sans font-bold px-3 py-1 rounded-full animate-pulse">
            CEGADO! ({blindTimer}s)
          </span>
        )}
        {isHalved && (
          <span className="bg-[#ff851b]/20 border border-[#ff851b]/60 text-[#ff851b] text-xs font-sans font-bold px-3 py-1 rounded-full animate-pulse">
            PONTOS PELA METADE!
          </span>
        )}
      </div>

      {/* Question */}
      <div className={cn(
        'bg-[#0d1117]/90 backdrop-blur-xl border rounded-xl overflow-hidden mb-3 max-w-2xl mx-auto w-full transition-all duration-300',
        showBlindOverlay ? 'border-[#B10DC9]/60 shadow-[0_0_30px_rgba(177,13,201,0.3)]' : 'border-white/10'
      )}>
        {/* Category image banner */}
        {CATEGORY_IMAGE_MAP[question.category] && (
          <div className="relative h-14 w-full overflow-hidden sm:h-20">
            <Image
              src={CATEGORY_IMAGE_MAP[question.category]}
              alt={question.category}
              fill
              className="object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0d1117]/95" />
          </div>
        )}
        <div className="px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-white/40 font-sans uppercase tracking-wider">{question.category}</span>
            <span className={cn(
              'text-[10px] font-sans font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
              question.difficulty === 'easy' ? 'bg-[#2ECC40]/20 text-[#2ECC40]' :
              question.difficulty === 'medium' ? 'bg-[#ffd700]/20 text-[#ffd700]' :
              'bg-[#e94560]/20 text-[#e94560]'
            )}>
              {question.difficulty === 'easy' ? 'Facil' : question.difficulty === 'medium' ? 'Medio' : 'Dificil'}
            </span>
          </div>
          <p className={cn(
            'font-sans font-bold text-sm leading-relaxed text-balance transition-all duration-300 sm:text-base',
            showBlindOverlay ? 'text-transparent select-none blur-lg' : 'text-white'
          )}>
            {question.text}
          </p>
          {showBlindOverlay && (
            <p className="text-[#B10DC9] font-sans font-bold text-center text-sm mt-1">Voce foi cegado!</p>
          )}
        </div>
      </div>

      {/* Answer Options */}
      <div className="grid grid-cols-2 gap-2 max-w-2xl mx-auto w-full pointer-events-auto">
        {displayOptions.map((opt, displayIndex) => {
          const origIdx = opt.originalIndex
          const isSelected = selectedAnswer === origIdx
          const isCorrect = phase === 'reveal' && correctIndex === origIdx
          const isWrong = phase === 'reveal' && isSelected && correctIndex !== origIdx
          const colors = optionColors[displayIndex]

          return (
            <button
              key={displayIndex}
              onClick={() => {
                if (!hasAnswered && phase === 'answering' && !isFrozen) {
                  onAnswer(origIdx)
                }
              }}
              disabled={hasAnswered || phase === 'reveal' || isFrozen}
              className={cn(
                'relative rounded-xl border-2 px-3 py-2.5 text-left transition-all duration-300 font-sans sm:px-4 sm:py-3',
                isCorrect
                  ? 'bg-[#2ECC40]/30 border-[#2ECC40] shadow-[0_0_25px_rgba(46,204,64,0.4)] scale-[1.02]'
                  : isWrong
                    ? 'bg-[#e94560]/30 border-[#e94560] shadow-[0_0_25px_rgba(233,69,96,0.4)] scale-[0.98]'
                    : isSelected
                      ? 'bg-white/15 border-white/60 ring-2 ring-white/30 scale-[1.02]'
                      : hasAnswered || isFrozen
                        ? 'bg-white/5 border-white/10 opacity-40 cursor-not-allowed'
                        : `${colors.bg} ${colors.border} ${colors.hover} ${colors.glow} cursor-pointer active:scale-95`,
                showBlindOverlay && !hasAnswered ? 'blur-sm' : ''
              )}
            >
              <div className="flex items-center gap-3">
                <span className={cn(
                  'text-[11px] font-bold font-sans shrink-0 w-6 h-6 rounded-full flex items-center justify-center',
                  isCorrect ? 'bg-[#2ECC40]/40 text-[#2ECC40]' :
                  isWrong ? 'bg-[#e94560]/40 text-[#e94560]' :
                  'bg-white/10 text-white/50'
                )}>
                  {optionLabels[displayIndex]}
                </span>
                <span className={cn(
                  'text-xs font-sans leading-relaxed sm:text-sm',
                  isCorrect ? 'text-[#2ECC40]' :
                  isWrong ? 'text-[#e94560]' :
                  'text-white/90'
                )}>
                  {opt.text}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {phase === 'answering' && hasAnswered && (
        <div className="mx-auto mt-3 max-w-2xl">
          <div className="rounded-xl border border-[#4da8da]/30 bg-[#0d1117]/85 px-4 py-2 text-center shadow-[0_0_20px_rgba(77,168,218,0.12)]">
            <p className="text-xs font-sans text-white/80 sm:text-sm">
              Resposta enviada. Os pontos entram quando todos responderem ou quando o tempo acabar.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function SabotagePanel({
  myPlayer,
  players,
  playerId,
  phase,
  onSabotage,
}: {
  myPlayer: Player
  players: Player[]
  playerId: string
  phase: string
  onSabotage: (targetId: string, type: SabotageType) => void
}) {
  const [selectedType, setSelectedType] = useState<SabotageType | null>(null)
  const [showTargets, setShowTargets] = useState(false)

  const availableSabotages = myPlayer.sabotages.filter((s) => !s.used)
  const otherPlayers = players.filter((p) => p.id !== playerId && !p.isEliminated)
  const sabotagesEnabled = phase === 'question' || phase === 'answering'

  if (availableSabotages.length === 0) return null

  const handleSabotageClick = (type: SabotageType) => {
    if (!sabotagesEnabled) return
    soundEngine.click()
    setSelectedType(type)
    setShowTargets(true)
  }

  const handleTargetClick = (targetId: string) => {
    if (selectedType) {
      onSabotage(targetId, selectedType)
      setShowTargets(false)
      setSelectedType(null)
    }
  }

  const sabotageColors: Record<SabotageType, string> = {
    freeze: '#4da8da',
    invert: '#ffd700',
    steal: '#e94560',
    blind: '#B10DC9',
    halve: '#ff851b',
  }

  const sabotageIcons: Record<SabotageType, string> = {
    freeze: '*',
    invert: '~',
    steal: '$',
    blind: '?',
    halve: '%',
  }

  return (
    <div className="absolute left-3 top-36 z-20 scale-90 pointer-events-auto sm:left-4 sm:top-28 sm:scale-100">
      <div className="bg-[#0d1117]/90 backdrop-blur-xl border border-white/10 rounded-xl p-3">
        <p className="text-[10px] text-white/40 font-sans mb-2 uppercase tracking-wider">Sabotagens</p>
        {phase === 'question' && (
          <p className="mb-2 max-w-[180px] text-[10px] font-sans text-white/40">
            Sabotagens liberadas antes da resposta.
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          {availableSabotages.map((s) => {
            const color = sabotageColors[s.type]
            return (
              <button
                key={s.type}
                onClick={() => handleSabotageClick(s.type)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-xs font-sans',
                  selectedType === s.type
                    ? `border-[${color}] bg-[${color}]/20`
                    : sabotagesEnabled
                      ? 'bg-white/5 border-white/10 hover:bg-white/10'
                      : 'bg-white/5 border-white/10 opacity-60'
                )}
                style={{
                  borderColor: selectedType === s.type ? color : undefined,
                  backgroundColor: selectedType === s.type ? `${color}20` : undefined,
                }}
                title={SABOTAGE_DESCRIPTIONS[s.type]}
                disabled={!sabotagesEnabled}
              >
                <span className="font-bold" style={{ color }}>{sabotageIcons[s.type]}</span>
                <span className="text-white/80">{SABOTAGE_NAMES[s.type]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Target selection popup */}
      {showTargets && (
        <div className="absolute left-full ml-2 top-0 bg-[#0d1117]/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 min-w-[160px] shadow-xl">
          <p className="text-[10px] text-white/40 font-sans mb-2 uppercase tracking-wider">Escolha o alvo:</p>
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {otherPlayers.length > 0 ? (
              otherPlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleTargetClick(p.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-xs font-sans text-white/80"
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="truncate flex-1 text-left">{p.name}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-xs font-sans text-white/40">
                Nenhum alvo disponivel agora.
              </p>
            )}
          </div>
          <button
            onClick={() => { setShowTargets(false); setSelectedType(null) }}
            className="mt-2 w-full text-xs text-white/30 font-sans hover:text-white/60 transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

// --- Steal Vote Panel ---
function StealVotePanel({
  players,
  playerId,
  timer,
  stealVotes,
  onVote,
}: {
  players: Player[]
  playerId: string
  timer: number
  stealVotes: Record<string, string>
  onVote: (targetId: string) => void
}) {
  const hasVoted = stealVotes[playerId] !== undefined
  const eligiblePlayers = players.filter(p => !p.isEliminated)
  const otherPlayers = eligiblePlayers.filter(p => p.id !== playerId)
  const votedTargetId = stealVotes[playerId]
  const votesCast = Object.keys(stealVotes).length

  // Count votes for display
  const voteCounts: Record<string, number> = {}
  Object.values(stealVotes).forEach(targetId => {
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1
  })

  const currentLeader = otherPlayers.reduce<{ player: Player | null; votes: number }>(
    (best, player) => {
      const votes = voteCounts[player.id] || 0
      if (votes > best.votes) {
        return { player, votes }
      }
      return best
    },
    { player: null, votes: 0 }
  )

  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-auto">
      <div className="bg-[#0d1117]/95 backdrop-blur-xl border-2 border-[#e94560] rounded-2xl p-8 max-w-md w-full mx-4 animate-in zoom-in-90 duration-500 shadow-[0_0_60px_rgba(233,69,96,0.3)]">
        <div className="text-center mb-5">
          <p className="text-[#e94560] text-xs font-sans uppercase tracking-widest mb-1">Hora do Roubo!</p>
          <h2 className="text-white font-sans font-bold text-2xl mb-2">Vote para Roubar Pontos</h2>
          <p className="text-white/50 font-sans text-xs">
            Os pontos roubados serao divididos entre quem votou
          </p>
          <div className="mt-2 inline-flex items-center gap-2 bg-[#e94560]/20 border border-[#e94560]/40 rounded-full px-4 py-1.5">
            <span className="text-[#e94560] font-mono font-bold text-lg">{timer}s</span>
          </div>
          <p className="mt-3 text-xs font-sans text-white/50">
            Votos: {votesCast}/{eligiblePlayers.length}
          </p>
          <p className="mt-1 text-xs font-sans text-white/40">
            {currentLeader.player && currentLeader.votes > 0
              ? `Mais votado: ${currentLeader.player.name} (${currentLeader.votes} voto${currentLeader.votes > 1 ? 's' : ''})`
              : 'Aguardando os primeiros votos...'}
          </p>
        </div>

        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {otherPlayers.length > 0 ? (
            otherPlayers.map(p => {
              const isMyVote = votedTargetId === p.id
              const voteCount = voteCounts[p.id] || 0
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    if (!hasVoted) {
                      soundEngine.select()
                      onVote(p.id)
                    }
                  }}
                  disabled={hasVoted}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all font-sans',
                    isMyVote
                      ? 'bg-[#e94560]/20 border-[#e94560] shadow-[0_0_20px_rgba(233,69,96,0.2)]'
                      : hasVoted
                        ? 'bg-white/3 border-white/5 opacity-40 cursor-not-allowed'
                        : 'bg-white/5 border-white/10 hover:bg-[#e94560]/10 hover:border-[#e94560]/40 cursor-pointer active:scale-95'
                  )}
                >
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: p.color, boxShadow: `0 0 8px ${p.color}60` }}
                  />
                  <span className="text-white flex-1 text-sm text-left">{p.name}</span>
                  <span className="text-white/40 font-mono text-xs">{p.score} pts</span>
                  <span className="bg-[#e94560]/30 text-[#e94560] text-xs font-bold px-2 py-0.5 rounded-full min-w-[54px] text-center">
                    {voteCount} voto{voteCount > 1 ? 's' : ''}
                  </span>
                  {isMyVote && (
                    <span className="text-[#e94560] text-xs font-bold">Seu voto</span>
                  )}
                </button>
              )
            })
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-sans text-white/40">
              Nenhum jogador disponivel para votar.
            </p>
          )}
        </div>

        {hasVoted && (
          <p className="text-center text-white/40 font-sans text-xs mt-3">
            Aguardando outros jogadores votarem... {votesCast}/{eligiblePlayers.length}
          </p>
        )}
      </div>
    </div>
  )
}

// --- Steal Result Overlay ---
function StealResultOverlay({
  hostMessage,
  stealVictimId,
  stolenPoints,
  players,
  phase,
  counterAttackCards,
  chosenCardIndex,
}: {
  hostMessage: string
  stealVictimId: string | null
  stolenPoints: number
  players: Player[]
  phase: string
  counterAttackCards: CounterAttackCard[]
  chosenCardIndex: number | null
}) {
  const victim = players.find(p => p.id === stealVictimId)

  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-auto">
      <div className="bg-[#0d1117]/95 backdrop-blur-xl border-2 border-[#e94560]/50 rounded-2xl p-8 max-w-md w-full mx-4 animate-in zoom-in-90 duration-500 shadow-[0_0_60px_rgba(233,69,96,0.2)]">
        <div className="text-center">
          {phase === 'steal-result' && victim && (
            <>
              <div
                className="w-16 h-16 rounded-full mx-auto mb-4 border-4 border-[#e94560]/60"
                style={{ backgroundColor: victim.color, boxShadow: `0 0 30px ${victim.color}60` }}
              />
              <p className="text-[#e94560] text-xs font-sans uppercase tracking-widest mb-1">Alvo Escolhido</p>
              <h2 className="text-white font-sans font-bold text-2xl mb-2">{victim.name}</h2>
              {stolenPoints > 0 && (
                <p className="text-[#e94560] font-mono font-bold text-3xl mb-2">-{stolenPoints} pts</p>
              )}
            </>
          )}
          {phase === 'counter-result' && chosenCardIndex !== null && counterAttackCards[chosenCardIndex] && (
            <>
              <div
                className="w-20 h-28 rounded-xl mx-auto mb-4 border-2 flex items-center justify-center"
                style={{
                  borderColor: counterAttackCards[chosenCardIndex].color,
                  backgroundColor: `${counterAttackCards[chosenCardIndex].color}30`,
                  boxShadow: `0 0 40px ${counterAttackCards[chosenCardIndex].color}40`,
                }}
              >
                <span className="text-3xl font-bold" style={{ color: counterAttackCards[chosenCardIndex].color }}>
                  {counterAttackCards[chosenCardIndex].type === 'zero' ? 'X' :
                   counterAttackCards[chosenCardIndex].type === 'half' ? '/' :
                   counterAttackCards[chosenCardIndex].type === 'shield' ? 'S' :
                   counterAttackCards[chosenCardIndex].type === 'reverse' ? 'R' :
                   counterAttackCards[chosenCardIndex].type === 'bomb' ? 'B' :
                   counterAttackCards[chosenCardIndex].type === 'double-steal' ? '2x' : '?'}
                </span>
              </div>
              <p className="text-xs font-sans uppercase tracking-widest mb-1" style={{ color: counterAttackCards[chosenCardIndex].color }}>
                {counterAttackCards[chosenCardIndex].name}
              </p>
              <p className="text-white/50 font-sans text-xs mb-3">
                {counterAttackCards[chosenCardIndex].description}
              </p>
            </>
          )}
          <p className="text-white/70 font-sans text-sm leading-relaxed">{hostMessage}</p>
        </div>
      </div>
    </div>
  )
}

// --- Counter-Attack Cards Panel ---
function CounterAttackCardsPanel({
  cards,
  playerId,
  stealVictimId,
  timer,
  chosenCardIndex,
  onPickCard,
  players,
}: {
  cards: CounterAttackCard[]
  playerId: string
  stealVictimId: string | null
  timer: number
  chosenCardIndex: number | null
  onPickCard: (cardIndex: number) => void
  players: Player[]
}) {
  const isVictim = playerId === stealVictimId
  const victim = players.find(p => p.id === stealVictimId)
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set())
  const [hasChosen, setHasChosen] = useState(false)
  const [localChosenIndex, setLocalChosenIndex] = useState<number | null>(null)

  const handleCardClick = (idx: number) => {
    if (!isVictim || hasChosen || chosenCardIndex !== null) return
    setHasChosen(true)
    setLocalChosenIndex(idx)
    // Flip the chosen card
    setFlippedCards(new Set([idx]))
    soundEngine.cardFlip()
    onPickCard(idx)
  }

  // When server reveals, flip all cards
  const allRevealed = chosenCardIndex !== null

  const cardIcons: Record<string, string> = {
    zero: 'X',
    half: '/',
    shield: 'S',
    reverse: 'R',
    bomb: 'B',
    nothing: '?',
    'double-steal': '2x',
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-auto">
      <div className="bg-[#0d1117]/95 backdrop-blur-xl border-2 border-[#ffd700] rounded-2xl p-6 max-w-lg w-full mx-4 animate-in zoom-in-90 duration-500 shadow-[0_0_60px_rgba(255,215,0,0.3)]">
        <div className="text-center mb-4">
          <p className="text-[#ffd700] text-xs font-sans uppercase tracking-widest mb-1">Contra-Ataque!</p>
          {isVictim ? (
            <>
              <h2 className="text-white font-sans font-bold text-xl mb-1">Escolha uma Carta!</h2>
              <p className="text-white/50 font-sans text-xs">
                5 cartas, 5 destinos. Escolha com sabedoria!
              </p>
            </>
          ) : (
            <>
              <h2 className="text-white font-sans font-bold text-xl mb-1">{victim?.name} esta escolhendo...</h2>
              <p className="text-white/50 font-sans text-xs">
                Aguardando a escolha do contra-ataque
              </p>
            </>
          )}
          <div className="mt-2 inline-flex items-center gap-2 bg-[#ffd700]/20 border border-[#ffd700]/40 rounded-full px-4 py-1.5">
            <span className="text-[#ffd700] font-mono font-bold text-lg">{timer}s</span>
          </div>
        </div>

        {/* Card grid */}
        <div className="flex gap-3 justify-center flex-wrap">
          {cards.map((card, idx) => {
            const isFlipped = flippedCards.has(idx) || allRevealed
            const isChosen = localChosenIndex === idx || (allRevealed && chosenCardIndex === idx)
            return (
              <button
                key={idx}
                onClick={() => handleCardClick(idx)}
                disabled={!isVictim || hasChosen || allRevealed}
                className={cn(
                  'relative w-20 h-28 rounded-xl border-2 transition-all duration-500 font-sans',
                  'perspective-1000',
                  isChosen
                    ? 'scale-110 shadow-[0_0_30px_rgba(255,215,0,0.5)]'
                    : '',
                  isFlipped
                    ? ''
                    : isVictim && !hasChosen
                      ? 'hover:scale-105 hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] cursor-pointer'
                      : 'cursor-default',
                )}
                style={{
                  borderColor: isFlipped ? card.color : '#ffd700',
                  backgroundColor: isFlipped ? `${card.color}20` : '#1a1a2e',
                }}
              >
                {isFlipped ? (
                  <div className="flex flex-col items-center justify-center h-full gap-1 animate-in fade-in duration-300 px-1">
                    <span className="text-2xl font-bold" style={{ color: card.color }}>
                      {cardIcons[card.type] || '?'}
                    </span>
                    <span className="text-[8px] text-white/70 font-sans leading-tight text-center">
                      {card.name}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-12 h-16 rounded-lg bg-[#ffd700]/10 border border-[#ffd700]/30 flex items-center justify-center">
                      <span className="text-[#ffd700]/60 text-2xl font-bold">?</span>
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {isVictim && hasChosen && !allRevealed && (
          <p className="text-center text-[#ffd700] font-sans text-xs mt-3 animate-pulse">
            Revelando carta...
          </p>
        )}
        {!isVictim && (
          <div className="flex items-center justify-center py-3 mt-2">
            <div className="w-5 h-5 border-2 border-[#ffd700] border-t-transparent rounded-full animate-spin" />
            <span className="text-white/50 font-sans text-xs ml-2">Aguardando decisao...</span>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Player Answer Feedback ---
function PlayerAnswerFeedback({
  players,
  answersMap,
  correctIndex,
  playerId,
}: {
  players: Player[]
  answersMap: Record<string, number>
  correctIndex: number
  playerId: string
}) {
  const activePlayers = players.filter(p => !p.isEliminated && p.connected)

  const results = activePlayers.map(p => {
    const answer = answersMap[p.id]
    const isCorrect = answer === correctIndex
    const didAnswer = answer !== undefined
    return { ...p, isCorrect, didAnswer, isMe: p.id === playerId }
  })

  // Sort: correct first, then wrong, then no answer
  results.sort((a, b) => {
    if (a.isCorrect && !b.isCorrect) return -1
    if (!a.isCorrect && b.isCorrect) return 1
    if (a.didAnswer && !b.didAnswer) return -1
    if (!a.didAnswer && b.didAnswer) return 1
    return 0
  })

  return (
    <div className="absolute top-32 left-1/2 z-15 w-[calc(100%-1.5rem)] -translate-x-1/2 pointer-events-none sm:top-16 sm:w-auto">
      <div className="flex flex-wrap gap-2 justify-center max-w-xl">
        {results.map((p) => (
          <div
            key={p.id}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-sans font-bold transition-all animate-in fade-in zoom-in-90 duration-300',
              p.isCorrect
                ? 'bg-[#2ECC40]/20 border-[#2ECC40]/50 text-[#2ECC40]'
                : p.didAnswer
                  ? 'bg-[#e94560]/20 border-[#e94560]/50 text-[#e94560]'
                  : 'bg-white/5 border-white/10 text-white/30',
              p.isMe ? 'ring-2 ring-white/30' : ''
            )}
          >
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: p.color }}
            />
            <span className="truncate max-w-[80px]">{p.name}</span>
            <span>
              {p.isCorrect ? '+' : p.didAnswer ? 'X' : '-'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScoreboardSidebar({
  players,
  playerId,
  eliminatedThisRound,
}: {
  players: Player[]
  playerId: string | null
  eliminatedThisRound: string[]
}) {
  const [expanded, setExpanded] = useState(false)
  const displayPlayers = expanded ? players : players.slice(0, 5)

  return (
    <div className="absolute right-3 top-24 z-10 max-w-[58vw] pointer-events-auto sm:right-4 sm:top-16 sm:max-w-none">
      <div className="bg-[#0d1117]/80 backdrop-blur-xl border border-white/10 rounded-xl p-2.5 min-w-0 sm:min-w-[160px] sm:p-3">
        <p className="text-[10px] text-white/40 font-sans mb-2 uppercase tracking-wider">Placar</p>
        <div className="flex flex-col gap-1">
          {displayPlayers.map((p, i) => (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-sans transition-all sm:text-xs',
                p.id === playerId ? 'bg-[#e94560]/15 border border-[#e94560]/20' : '',
                p.isEliminated ? 'opacity-30' : '',
                eliminatedThisRound.includes(p.id) ? 'bg-[#e94560]/10' : '',
                i === 0 ? 'text-[#ffd700]' : ''
              )}
            >
              <span className={cn(
                'w-4 shrink-0 text-center font-bold',
                i === 0 ? 'text-[#ffd700]' : i === 1 ? 'text-[#c0c0c0]' : i === 2 ? 'text-[#cd7f32]' : 'text-white/30'
              )}>
                {i + 1}
              </span>
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: p.color, boxShadow: `0 0 6px ${p.color}40` }}
              />
              <span className={cn('truncate flex-1', p.isEliminated ? 'line-through text-white/30' : 'text-white/80')}>
                {p.name}
              </span>
              {p.lastAnswerCorrect === true && (
                <span className="text-[#2ECC40] text-[10px] font-bold shrink-0">+</span>
              )}
              {p.lastAnswerCorrect === false && (
                <span className="text-[#e94560] text-[10px] font-bold shrink-0">X</span>
              )}
              {p.streak >= 2 && (
                <span className="text-[#ffd700] text-[9px] font-bold shrink-0">{p.streak}x</span>
              )}
              {!p.connected && (
                <span className="text-white/20 text-[9px] shrink-0">OFF</span>
              )}
              <span className="font-mono font-bold shrink-0 text-white">{p.score}</span>
            </div>
          ))}
        </div>
        {players.length > 5 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 w-full text-[10px] text-white/30 font-sans hover:text-white/60 transition-colors"
          >
            {expanded ? 'Menos' : `+${players.length - 5} jogadores`}
          </button>
        )}
      </div>
    </div>
  )
}

function ScoresOverlay({
  players,
  phase,
  currentRound,
  onRestart,
  isHost,
  }: {
  players: Player[]
  phase: string
  currentRound: number
  onRestart?: () => void
  isHost: boolean
  }) {
  return (
  <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-auto">
  <div className="bg-[#0d1117]/95 backdrop-blur-xl border-2 border-[#e94560]/50 rounded-2xl p-8 max-w-md w-full mx-4 animate-in slide-in-from-bottom-4 duration-500 shadow-[0_0_60px_rgba(233,69,96,0.2)]">
  <h2 className="text-white font-sans font-bold text-2xl text-center mb-1">
  {phase === 'final-scores' ? 'Resultado Final' : `Fim da Rodada ${currentRound + 1}`}
  </h2>
  <div className="h-1 w-20 bg-gradient-to-r from-[#e94560] to-[#4da8da] rounded-full mx-auto mb-5" />
  <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
  {players.map((p, i) => (
  <div
  key={p.id}
  className={cn(
  'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all font-sans',
  i === 0 ? 'bg-[#ffd700]/10 border-[#ffd700]/40 shadow-[0_0_20px_rgba(255,215,0,0.1)]' :
  i === 1 ? 'bg-[#c0c0c0]/10 border-[#c0c0c0]/20' :
  i === 2 ? 'bg-[#cd7f32]/10 border-[#cd7f32]/20' :
  'bg-white/5 border-white/5'
  )}
  >
  <span className={cn(
  'font-bold text-lg w-8 text-center',
  i === 0 ? 'text-[#ffd700]' : i === 1 ? 'text-[#c0c0c0]' : i === 2 ? 'text-[#cd7f32]' : 'text-white/30'
  )}>
  {i + 1}
  </span>
  <div
  className="w-5 h-5 rounded-full shrink-0"
  style={{ backgroundColor: p.color, boxShadow: `0 0 10px ${p.color}60` }}
  />
  <span className="text-white flex-1 text-sm font-medium">{p.name}</span>
  <span className="text-white font-mono font-bold text-sm">{p.score} pts</span>
  </div>
  ))}
  </div>
  {phase === 'final-scores' && onRestart && isHost && (
  <button
  onClick={onRestart}
  className="mt-5 w-full bg-[#e94560] hover:bg-[#e94560]/80 text-white font-sans font-bold py-3 rounded-xl transition-all text-sm shadow-[0_0_20px_rgba(233,69,96,0.3)]"
  >
  Recomecar Partida
  </button>
  )}
  </div>
  </div>
  )
  }
