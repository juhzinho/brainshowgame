'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { saveStoredSession } from '@/lib/client-session'

export default function JoinPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params)
  const router = useRouter()
  const [playerName, setPlayerName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roomInfo, setRoomInfo] = useState<{ hostName: string; playerCount: number; maxPlayers: number } | null>(null)
  const [loadingRoom, setLoadingRoom] = useState(true)

  useEffect(() => {
    async function fetchRoomInfo() {
      try {
        const res = await fetch(`/api/rooms/${roomId}`)
        if (res.ok) {
          const data = await res.json()
          setRoomInfo({
            hostName: data.hostName || 'Desconhecido',
            playerCount: typeof data.playerCount === 'number' ? data.playerCount : 0,
            maxPlayers: typeof data.maxPlayers === 'number' ? data.maxPlayers : 20,
          })
        } else {
          setError('Sala nao encontrada')
        }
      } catch {
        setError('Erro ao buscar sala')
      } finally {
        setLoadingRoom(false)
      }
    }
    fetchRoomInfo()
  }, [roomId])

  const handleJoin = async () => {
    if (playerName.trim().length < 2) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: playerName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro ao entrar na sala')
        return
      }
      // Store connection info and redirect to main game
      saveStoredSession({
        roomId,
        playerId: data.playerId,
        playerName: playerName.trim(),
        playerToken: data.playerToken,
      })
      router.push(`/?room=${roomId}&player=${data.playerId}&name=${encodeURIComponent(playerName.trim())}`)
    } catch {
      setError('Erro de conexao. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src="/images/game-bg.jpg"
          alt="Game background"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-[#0a0a1a]/80" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(233,69,96,0.1)_0%,_transparent_70%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="relative w-48 h-48 mx-auto mb-2">
            <Image
              src="/images/brain-show-logo.png"
              alt="Brain Show Logo"
              fill
              className="object-contain drop-shadow-[0_0_30px_rgba(233,69,96,0.3)]"
              priority
            />
          </div>
          <p className="text-white/60 font-sans text-sm">Voce foi convidado para uma partida!</p>
        </div>

        <div className="bg-[#0d1117]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 animate-in slide-in-from-bottom-4 duration-300 shadow-[0_0_60px_rgba(233,69,96,0.1)]">
          {loadingRoom ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#e94560] border-t-transparent rounded-full animate-spin" />
              <span className="text-white/50 font-sans text-sm ml-3">Buscando sala...</span>
            </div>
          ) : error && !roomInfo ? (
            <div className="text-center py-8">
              <p className="text-[#e94560] font-sans text-sm mb-4">{error}</p>
              <button
                onClick={() => router.push('/')}
                className="bg-[#e94560] hover:bg-[#e94560]/80 text-white font-sans font-bold py-3 px-6 rounded-xl transition-all text-sm"
              >
                Voltar ao Menu
              </button>
            </div>
          ) : (
            <>
              {/* Room info */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-white/40 font-sans uppercase tracking-wider">Sala</span>
                  <span className="text-[#ffd700] font-mono font-bold text-lg tracking-widest">{roomId}</span>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white/50 font-sans text-xs">Criada por</span>
                  <span className="text-white font-sans text-sm font-medium">{roomInfo?.hostName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/50 font-sans text-xs">Jogadores</span>
                  <span className="text-white font-sans text-sm font-medium">{roomInfo?.playerCount}/{roomInfo?.maxPlayers}</span>
                </div>
              </div>

              {/* Name input */}
              <div className="mb-4">
                <label className="text-xs text-white/40 font-sans mb-1 block uppercase tracking-wider">Seu Nome</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  placeholder="Digite seu nome..."
                  maxLength={15}
                  autoFocus
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-sans text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#e94560]/50 focus:border-[#e94560]/50 transition-all"
                />
              </div>

              {error && <p className="text-[#e94560] text-xs font-sans mb-3">{error}</p>}

              <button
                onClick={handleJoin}
                disabled={isLoading || playerName.trim().length < 2}
                className={cn(
                  'w-full font-sans font-bold py-3 rounded-xl transition-all text-sm',
                  isLoading || playerName.trim().length < 2
                    ? 'bg-white/10 text-white/30 cursor-not-allowed'
                    : 'bg-[#e94560] hover:bg-[#e94560]/80 text-white shadow-lg shadow-[#e94560]/20 active:scale-95'
                )}
              >
                {isLoading ? 'Entrando...' : 'Entrar na Sala'}
              </button>
            </>
          )}
        </div>

        <div className="text-center mt-4">
          <button
            onClick={() => router.push('/')}
            className="text-white/30 hover:text-white/60 font-sans text-xs transition-colors"
          >
            Ir para o Menu Principal
          </button>
        </div>
      </div>
    </div>
  )
}
