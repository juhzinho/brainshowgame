'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

interface MainMenuProps {
  onCreateRoom: (name: string) => void
  onJoinRoom: (name: string, roomId: string) => void
  isLoading: boolean
  error: string | null
}

export function MainMenu({ onCreateRoom, onJoinRoom, isLoading, error }: MainMenuProps) {
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu')

  const handleCreate = () => {
    if (playerName.trim().length < 2) return
    onCreateRoom(playerName.trim())
  }

  const handleJoin = () => {
    if (playerName.trim().length < 2 || roomCode.trim().length < 4) return
    onJoinRoom(playerName.trim(), roomCode.trim().toUpperCase())
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated background with game image */}
      <div className="absolute inset-0 bg-[#0a0a1a]">
        <Image
          src="/images/game-bg.jpg"
          alt="Game show background"
          fill
          className="object-cover opacity-40"
          priority
        />
        <div className="absolute inset-0 bg-[#0a0a1a]/70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(233,69,96,0.08)_0%,_transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(77,168,218,0.06)_0%,_transparent_60%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo Image */}
        <div className="text-center mb-6">
          <div className="relative w-64 h-64 mx-auto mb-2">
            <Image
              src="/images/brain-show-logo.png"
              alt="Brain Show Logo"
              fill
              className="object-contain drop-shadow-[0_0_30px_rgba(233,69,96,0.3)]"
              priority
            />
          </div>
          <p className="text-muted-foreground font-sans text-sm">
            O jogo de quiz 3D mais divertido para ate 20 jogadores!
          </p>
        </div>

        {/* Main Menu */}
        {mode === 'menu' && (
          <div className="flex flex-col gap-3 animate-in fade-in duration-300">
            <button
              onClick={() => setMode('create')}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-sans font-bold py-4 rounded-xl transition-all text-base shadow-lg shadow-primary/20"
            >
              Criar Sala
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground font-sans font-bold py-4 rounded-xl transition-all border border-border text-base"
            >
              Entrar em Sala
            </button>
          </div>
        )}

        {/* Create Room Form */}
        {mode === 'create' && (
          <div className="bg-card/90 backdrop-blur-md border border-border rounded-2xl p-6 animate-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-foreground font-sans font-bold text-lg mb-4">Criar Nova Sala</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-muted-foreground font-sans mb-1 block">Seu Nome</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Digite seu nome..."
                  maxLength={15}
                  className="w-full bg-input border border-border rounded-xl px-4 py-3 text-foreground font-sans text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {error && <p className="text-destructive text-xs font-sans">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('menu')}
                  className="flex-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-sans font-bold py-3 rounded-xl transition-all border border-border text-sm"
                >
                  Voltar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isLoading || playerName.trim().length < 2}
                  className={cn(
                    'flex-1 font-sans font-bold py-3 rounded-xl transition-all text-sm',
                    isLoading || playerName.trim().length < 2
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20'
                  )}
                >
                  {isLoading ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Join Room Form */}
        {mode === 'join' && (
          <div className="bg-card/90 backdrop-blur-md border border-border rounded-2xl p-6 animate-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-foreground font-sans font-bold text-lg mb-4">Entrar em Sala</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-muted-foreground font-sans mb-1 block">Seu Nome</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Digite seu nome..."
                  maxLength={15}
                  className="w-full bg-input border border-border rounded-xl px-4 py-3 text-foreground font-sans text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-sans mb-1 block">Codigo da Sala</label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Ex: ABC12"
                  maxLength={6}
                  className="w-full bg-input border border-border rounded-xl px-4 py-3 text-foreground font-sans font-mono text-lg tracking-widest text-center placeholder:text-muted-foreground/50 placeholder:text-sm placeholder:tracking-normal placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {error && <p className="text-destructive text-xs font-sans">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('menu')}
                  className="flex-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-sans font-bold py-3 rounded-xl transition-all border border-border text-sm"
                >
                  Voltar
                </button>
                <button
                  onClick={handleJoin}
                  disabled={isLoading || playerName.trim().length < 2 || roomCode.trim().length < 4}
                  className={cn(
                    'flex-1 font-sans font-bold py-3 rounded-xl transition-all text-sm',
                    isLoading || playerName.trim().length < 2 || roomCode.trim().length < 4
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20'
                  )}
                >
                  {isLoading ? 'Entrando...' : 'Entrar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center mt-6">
          <p className="text-muted-foreground/50 text-xs font-sans">
            10 rodadas - 10 categorias - 1000+ perguntas - 5 sabotagens!
          </p>
        </div>
      </div>
    </div>
  )
}
