'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useGameStore } from '@/lib/use-game-store'
import { useGame } from '@/lib/use-game'
import { loadStoredQuestionHistory, loadStoredSession } from '@/lib/client-session'
import { MainMenu } from '@/components/game/MainMenu'
import { WaitingRoom } from '@/components/game/WaitingRoom'
import { GameHUD } from '@/components/game/GameHUD'

// Dynamic import for 3D scene (avoid SSR issues with Three.js)
const GameScene3D = dynamic(
  () => import('@/components/game/GameScene3D').then((mod) => ({ default: mod.GameScene3D })),
  { ssr: false }
)

function HomeContent() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()

  const {
    roomId,
    playerId,
    playerToken,
    phase,
    players,
    hostAnimation,
    setConnection,
  } = useGameStore()

  // Auto-connect from invite link parameters
  useEffect(() => {
    const room = searchParams.get('room')
    const player = searchParams.get('player')
    const name = searchParams.get('name')
    const restoredSession = loadStoredSession()

    if (room && player && name && restoredSession?.roomId === room && restoredSession.playerId === player && !roomId) {
      setConnection(room, player, decodeURIComponent(name), restoredSession.playerToken)
      return
    }

    if (!roomId && restoredSession) {
      setConnection(
        restoredSession.roomId,
        restoredSession.playerId,
        restoredSession.playerName,
        restoredSession.playerToken
      )
    }
  }, [searchParams, roomId, setConnection])

  const { sendAnswer, sendSabotage, startGame, restartGame, markReady, setCategories, submitStealVote, submitCounterAttack } = useGame(roomId, playerId, playerToken)

  // Wrap counterAttack to match the card-based API
  const handleCounterAttack = (cardIndex: number) => {
    submitCounterAttack(cardIndex)
  }

  const handleCreateRoom = useCallback(
    async (name: string) => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerName: name,
            usedQuestionIds: loadStoredQuestionHistory(),
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Erro ao criar sala')
          return
        }
        setConnection(data.roomId, data.playerId, name, data.playerToken)
      } catch {
        setError('Erro de conexao. Tente novamente.')
      } finally {
        setIsLoading(false)
      }
    },
    [setConnection]
  )

  const handleJoinRoom = useCallback(
    async (name: string, code: string) => {
      setIsLoading(true)
      setError(null)
      const normalizedCode = code.trim().toUpperCase()
      try {
        const res = await fetch(`/api/rooms/${normalizedCode}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerName: name }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Sala nao encontrada')
          return
        }
        setConnection(normalizedCode, data.playerId, name, data.playerToken)
      } catch {
        setError('Erro de conexao. Tente novamente.')
      } finally {
        setIsLoading(false)
      }
    },
    [setConnection]
  )

  // Not in a room yet - show menu
  if (!roomId || !playerId || !playerToken) {
    return (
      <MainMenu
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        isLoading={isLoading}
        error={error}
      />
    )
  }

  // In a room - show the game
  return (
    <main className="relative w-full h-[100dvh] overflow-hidden bg-[#0a0a1a]">
      {/* Background image behind 3D scene */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/game-bg.jpg"
          alt="Game background"
          fill
          className="object-cover opacity-30"
          priority
        />
        <div className="absolute inset-0 bg-[#0a0a1a]/50" />
      </div>

      {/* 3D Scene - always rendered as background */}
      <Suspense
        fallback={
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a1a]">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-muted-foreground font-sans text-sm">Carregando cenario 3D...</p>
            </div>
          </div>
        }
      >
        <GameScene3D
          players={players}
          hostAnimation={hostAnimation}
          currentPlayerId={playerId}
        />
      </Suspense>

      {/* Waiting Room Overlay */}
      {phase === 'waiting' && (
        <WaitingRoom onStart={startGame} onReady={markReady} onSetCategories={setCategories} />
      )}

      {/* Game HUD (questions, sabotage, scores) */}
      {phase !== 'waiting' && phase !== 'finished' && (
        <GameHUD
          onAnswer={sendAnswer}
          onSabotage={sendSabotage}
          onStealVote={submitStealVote}
          onCounterAttack={handleCounterAttack}
          onRestart={restartGame}
        />
      )}

      {/* Finished overlay */}
      {phase === 'finished' && (() => {
        const isHost = players.find(p => p.id === playerId)?.isHost ?? false
        return (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-auto">
          <div className="bg-card/95 backdrop-blur-xl border-2 border-primary rounded-2xl p-8 text-center max-w-sm mx-4 animate-in zoom-in-90 duration-500">
            <h2 className="text-foreground font-sans font-bold text-2xl mb-2">Fim do Jogo!</h2>
            <div className="h-1 w-16 bg-primary rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground font-sans text-sm mb-6">
              Obrigado por jogar Brain Show!
            </p>
            <div className="flex flex-col gap-3">
              {isHost && (
              <button
                onClick={restartGame}
                className="w-full bg-[#e94560] hover:bg-[#e94560]/90 text-white font-sans font-bold py-3 rounded-xl transition-all text-sm"
              >
                Recomecar Partida
              </button>
              )}
              <button
                onClick={() => {
                  useGameStore.getState().reset()
                }}
                className="w-full bg-white/10 hover:bg-white/20 text-white/70 font-sans font-bold py-3 rounded-xl transition-all text-sm border border-white/10"
              >
                Voltar ao Menu
              </button>
            </div>
          </div>
        </div>
        )
      })()}

      {/* Connection indicator with invite link */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="flex items-center gap-2 bg-card/60 backdrop-blur-sm rounded-full px-3 py-1.5">
          <div className="w-2 h-2 rounded-full bg-[#2ECC40] animate-pulse" />
          <span className="text-muted-foreground text-xs font-sans">Sala: {roomId}</span>
        </div>
      </div>
    </main>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a1a]" />}>
      <HomeContent />
    </Suspense>
  )
}
