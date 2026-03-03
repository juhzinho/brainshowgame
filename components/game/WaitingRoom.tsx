'use client'

import { useMemo, useCallback, useState } from 'react'
import { useGameStore } from '@/lib/use-game-store'
import { QUESTION_CATEGORIES } from '@/lib/game-state'
import { cn } from '@/lib/utils'
import Image from 'next/image'

interface WaitingRoomProps {
  onStart: () => void
  onReady: () => void
  onSetCategories: (categories: string[]) => void
  onKickPlayer: (targetPlayerId: string) => void
}

export function WaitingRoom({ onStart, onReady, onSetCategories, onKickPlayer }: WaitingRoomProps) {
  const { players, playerId, roomId, selectedCategories } = useGameStore()

  const myPlayer = useMemo(
    () => players.find((p) => p.id === playerId),
    [players, playerId]
  )

  const isHost = myPlayer?.isHost || false
  const allReady = players.length >= 1 && players.every((p) => p.isReady)
  const readyCount = players.filter((p) => p.isReady).length

  const toggleCategory = useCallback((categoryId: string) => {
    if (!isHost) return
    const current = selectedCategories || []
    const newCategories = current.includes(categoryId)
      ? current.filter((c) => c !== categoryId)
      : [...current, categoryId]
    onSetCategories(newCategories)
  }, [isHost, selectedCategories, onSetCategories])

  const selectAllCategories = useCallback(() => {
    if (!isHost) return
    onSetCategories(QUESTION_CATEGORIES.map((c) => c.id))
  }, [isHost, onSetCategories])

  const deselectAllCategories = useCallback(() => {
    if (!isHost) return
    onSetCategories([])
  }, [isHost, onSetCategories])

  const activeCats = selectedCategories || []

  const [linkCopied, setLinkCopied] = useState(false)
  const [kickTarget, setKickTarget] = useState<{ id: string; name: string } | null>(null)

  const inviteLink = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${roomId}`
    : `/join/${roomId}`

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }).catch(() => {
      // Fallback
    })
  }, [inviteLink])

  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-auto">
      <div className="bg-card/95 backdrop-blur-xl border-2 border-border rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-5">
          <h1 className="text-foreground font-sans font-bold text-2xl mb-1">Sala de Espera</h1>
          <div className="h-1 w-16 bg-primary rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-center gap-2">
            <span className="text-muted-foreground font-sans text-sm">Codigo:</span>
            <span className="bg-primary/20 border border-primary/40 text-primary-foreground font-mono font-bold text-lg px-3 py-1 rounded-lg select-all">
              {roomId}
            </span>
          </div>
          {/* Invite link */}
          <div className="mt-3 flex items-center gap-2 justify-center">
            <div className="flex-1 max-w-xs bg-secondary/30 border border-border rounded-lg px-3 py-2 text-xs font-mono text-muted-foreground truncate">
              {inviteLink}
            </div>
            <button
              onClick={handleCopyLink}
              className={cn(
                'px-4 py-2 rounded-lg text-xs font-sans font-bold transition-all whitespace-nowrap',
                linkCopied
                  ? 'bg-[#2ECC40]/20 border border-[#2ECC40]/40 text-[#2ECC40]'
                  : 'bg-primary hover:bg-primary/80 text-primary-foreground'
              )}
            >
              {linkCopied ? 'Copiado!' : 'Copiar Link'}
            </button>
          </div>
          <p className="text-muted-foreground text-xs font-sans mt-2">
            Compartilhe o link ou o codigo para outros jogadores entrarem
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Players */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground font-sans font-bold uppercase tracking-wide">
                Jogadores ({players.length}/20)
              </p>
              <p className="text-xs text-muted-foreground font-sans">
                {readyCount}/{players.length} prontos
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
              {players.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-sans transition-all',
                    p.isReady
                      ? 'bg-[#2ECC40]/10 border-[#2ECC40]/40'
                      : 'bg-secondary/30 border-border',
                    p.id === playerId && 'ring-1 ring-primary/50'
                  )}
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-foreground truncate flex-1">{p.name}</span>
                  {p.isHost && (
                    <span className="text-[#ffd700] text-xs shrink-0">Host</span>
                  )}
                  {p.isReady && (
                    <span className="text-[#2ECC40] text-xs shrink-0">Pronto</span>
                  )}
                  {isHost && !p.isHost && (
                    <button
                      onClick={() => setKickTarget({ id: p.id, name: p.name })}
                      className="ml-1 rounded-md border border-[#e94560]/40 bg-[#e94560]/10 px-2 py-1 text-[10px] font-bold text-[#e94560] transition-colors hover:bg-[#e94560]/20"
                    >
                      Expulsar
                    </button>
                  )}
                </div>
              ))}

              {/* Empty slots */}
              {Array.from({ length: Math.max(0, 2 - players.length) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border/40 text-sm font-sans"
                >
                  <div className="w-3 h-3 rounded-full bg-muted/30 shrink-0" />
                  <span className="text-muted-foreground/40">Aguardando...</span>
                </div>
              ))}
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground font-sans font-bold uppercase tracking-wide">
                Categorias {activeCats.length > 0 ? `(${activeCats.length}/10)` : '(Todas)'}
              </p>
              {isHost && (
                <div className="flex gap-2">
                  <button
                    onClick={selectAllCategories}
                    className="text-xs text-accent font-sans hover:underline"
                  >
                    Todas
                  </button>
                  <button
                    onClick={deselectAllCategories}
                    className="text-xs text-muted-foreground font-sans hover:underline"
                  >
                    Limpar
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {QUESTION_CATEGORIES.map((cat) => {
                const isActive = activeCats.length === 0 || activeCats.includes(cat.id)
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    disabled={!isHost}
                    className={cn(
                      'relative flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-sans transition-all overflow-hidden',
                      isHost ? 'cursor-pointer' : 'cursor-default',
                      isActive
                        ? 'bg-primary/15 border-primary/40 text-foreground'
                        : 'bg-muted/20 border-border/40 text-muted-foreground/50'
                    )}
                  >
                    <div className="relative w-5 h-5 rounded shrink-0 overflow-hidden">
                      <Image
                        src={cat.image}
                        alt={cat.name}
                        fill
                        className={cn('object-cover', !isActive && 'opacity-30 grayscale')}
                      />
                    </div>
                    <span className="truncate">{cat.name}</span>
                  </button>
                )
              })}
            </div>
            {!isHost && (
              <p className="text-xs text-muted-foreground/60 font-sans mt-2 text-center">
                Apenas o host pode alterar categorias
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-5">
          {!myPlayer?.isReady && (
            <button
              onClick={onReady}
              className="w-full bg-[#2ECC40] hover:bg-[#27ae36] text-[#0a0a1a] font-sans font-bold py-3 rounded-xl transition-all text-sm"
            >
              Estou Pronto!
            </button>
          )}
          {myPlayer?.isReady && !isHost && (
            <div className="text-center py-3">
              <p className="text-[#2ECC40] font-sans font-bold text-sm">Voce esta pronto!</p>
              <p className="text-muted-foreground text-xs font-sans mt-1">Aguardando o host iniciar...</p>
            </div>
          )}
          {isHost && (
            <button
              onClick={onStart}
              disabled={!allReady}
              className={cn(
                'w-full font-sans font-bold py-3 rounded-xl transition-all text-sm',
                allReady
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              {!allReady
                  ? `Aguardando todos ficarem prontos (${readyCount}/${players.length})`
                  : 'Iniciar Jogo!'}
            </button>
          )}
        </div>
      </div>

      {kickTarget && (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded-2xl bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#e94560]/30 bg-card/95 p-5 shadow-2xl backdrop-blur-xl">
            <h3 className="text-foreground font-sans text-lg font-bold">Confirmar expulsao</h3>
            <p className="mt-2 text-sm font-sans text-muted-foreground">
              Deseja expulsar <span className="font-bold text-foreground">{kickTarget.name}</span> da sala?
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setKickTarget(null)}
                className="flex-1 rounded-xl border border-border bg-secondary/40 px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-secondary/70"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onKickPlayer(kickTarget.id)
                  setKickTarget(null)
                }}
                className="flex-1 rounded-xl border border-[#e94560]/40 bg-[#e94560] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#e94560]/85"
              >
                Expulsar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
