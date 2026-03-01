'use client'

import { useEffect, useCallback } from 'react'
import * as Ably from 'ably'
import { useGameStore } from './use-game-store'
import type { ClientGameState, SabotageType } from './game-state'

export function useGame(roomId: string | null, playerId: string | null, playerToken: string | null) {
  const resetStore = useGameStore((state) => state.reset)
  const setConnected = useGameStore((state) => state.setConnected)
  const updateGameState = useGameStore((state) => state.updateGameState)
  const selectAnswer = useGameStore((state) => state.selectAnswer)
  const applyOptimisticSabotage = useGameStore((state) => state.applyOptimisticSabotage)

  const buildHeaders = useCallback(() => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (playerToken) {
      headers['x-player-token'] = playerToken
    }
    return headers
  }, [playerToken])

  const refreshGameState = useCallback(async () => {
    if (!roomId || !playerId || !playerToken) return

    try {
      const res = await fetch(`/api/rooms/${roomId}?playerId=${playerId}`, {
        headers: playerToken ? { 'x-player-token': playerToken } : undefined,
        cache: 'no-store',
      })

      if (!res.ok) {
        if (res.status === 401 || res.status === 404) {
          resetStore()
          return
        }
        return
      }

      const data = await res.json()
      setConnected(true)
      updateGameState(data)
    } catch {
      setConnected(false)
    }
  }, [roomId, playerId, playerToken, resetStore, setConnected, updateGameState])

  useEffect(() => {
    if (!roomId) return

    let client: Ably.Realtime | null = null
    let channel: Ably.RealtimeChannel | null = null

    async function connectRealtime() {
      try {
        client = new Ably.Realtime({
          authUrl: '/api/ably/auth',
        })

        channel = client.channels.get(`room:${roomId}`)
        const handleRealtimeMessage = (message: { data?: { state?: Partial<ClientGameState> } }) => {
          const nextState = message.data?.state
          if (nextState) {
            setConnected(true)
            updateGameState(nextState)
            return
          }

          void refreshGameState()
        }

        channel.subscribe('room-created', handleRealtimeMessage)
        channel.subscribe('room-joined', handleRealtimeMessage)
        channel.subscribe('answer-submitted', handleRealtimeMessage)
        channel.subscribe('player-ready', handleRealtimeMessage)
        channel.subscribe('categories-updated', handleRealtimeMessage)
        channel.subscribe('sabotage-used', handleRealtimeMessage)
        channel.subscribe('room-updated', handleRealtimeMessage)
        channel.subscribe('game-started', handleRealtimeMessage)
        channel.subscribe('game-restarted', handleRealtimeMessage)
        channel.subscribe('steal-vote-submitted', handleRealtimeMessage)
        channel.subscribe('counter-attack-submitted', handleRealtimeMessage)
      } catch {
        // fallback to polling only
      }
    }

    void connectRealtime()

    return () => {
      if (channel) {
        void channel.unsubscribe()
      }
      if (client) {
        client.close()
      }
    }
  }, [roomId, refreshGameState, setConnected, updateGameState])

  // Poll as a fallback and to advance timer-driven phases in serverless runtime.
  useEffect(() => {
    if (!roomId || !playerId || !playerToken) return

    let active = true
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    async function poll() {
      if (!active || !roomId) return
      try {
        const res = await fetch(`/api/rooms/${roomId}?playerId=${playerId}`, {
          headers: playerToken ? { 'x-player-token': playerToken } : undefined,
          cache: 'no-store',
        })
        if (!res.ok) {
          if (res.status === 401 || res.status === 404) {
            resetStore()
            return
          }
          scheduleNext(1200)
          return
        }
        const data = await res.json()
        if (active && data) {
          setConnected(true)
          updateGameState(data)
          
          const phase = data.phase || 'waiting'
          const isActive = ['answering', 'steal-vote', 'counter-attack'].includes(phase)
          const isWaiting = phase === 'waiting' || phase === 'finished'
          const nextDelay = isActive ? 900 : isWaiting ? 3000 : 1500
          scheduleNext(nextDelay)
        } else {
          scheduleNext(1500)
        }
      } catch {
        if (active) setConnected(false)
        scheduleNext(2000)
      }
    }

    function scheduleNext(delay: number) {
      if (!active) return
      timeoutId = setTimeout(poll, delay)
    }

    // Initial fetch immediately
    poll()

    return () => {
      active = false
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }
  }, [roomId, playerId, playerToken, resetStore, setConnected, updateGameState])

  // Send answer
  const sendAnswer = useCallback(async (answerIndex: number) => {
    if (!roomId || !playerId || !playerToken) return
    selectAnswer(answerIndex)
    try {
      await fetch(`/api/rooms/${roomId}/answer`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken, answerIndex }),
      })
      await refreshGameState()
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders, refreshGameState, selectAnswer])

  // Send sabotage
  const sendSabotage = useCallback(async (targetPlayerId: string, sabotageType: SabotageType) => {
    if (!roomId || !playerId || !playerToken) return
    applyOptimisticSabotage(targetPlayerId, sabotageType)
    try {
      const res = await fetch(`/api/rooms/${roomId}/sabotage`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken, targetPlayerId, sabotageType }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.state) {
          updateGameState(data.state)
          return
        }
      }
      await refreshGameState()
    } catch {
      // ignore
      await refreshGameState()
    }
  }, [roomId, playerId, playerToken, applyOptimisticSabotage, buildHeaders, refreshGameState, updateGameState])

  // Start game
  const startGame = useCallback(async () => {
    if (!roomId || !playerId || !playerToken) return
    try {
      await fetch(`/api/rooms/${roomId}/start`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken }),
      })
      await refreshGameState()
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders, refreshGameState])

  // Mark ready
  const markReady = useCallback(async () => {
    if (!roomId || !playerId || !playerToken) return
    try {
      await fetch(`/api/rooms/${roomId}/ready`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken }),
      })
      await refreshGameState()
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders, refreshGameState])

  // Set categories
  const setCategories = useCallback(async (categories: string[]) => {
    if (!roomId || !playerId || !playerToken) return
    try {
      await fetch(`/api/rooms/${roomId}/categories`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken, categories }),
      })
      await refreshGameState()
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders, refreshGameState])

  // Submit steal vote
  const submitStealVote = useCallback(async (targetId: string) => {
    if (!roomId || !playerId || !playerToken) return
    try {
      await fetch(`/api/rooms/${roomId}/steal-vote`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken, targetId }),
      })
      await refreshGameState()
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders, refreshGameState])

  // Submit counter-attack (card index)
  const submitCounterAttack = useCallback(async (cardIndex: number) => {
    if (!roomId || !playerId || !playerToken) return
    try {
      await fetch(`/api/rooms/${roomId}/counter-attack`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken, cardIndex }),
      })
      await refreshGameState()
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders, refreshGameState])

  // Restart game (keeps used question IDs to avoid repeats)
  const restartGame = useCallback(async () => {
    if (!roomId || !playerId || !playerToken) return
    try {
      await fetch(`/api/rooms/${roomId}/restart`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken }),
      })
      await refreshGameState()
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders, refreshGameState])

  return {
    sendAnswer,
    sendSabotage,
    startGame,
    restartGame,
    markReady,
    setCategories,
    submitStealVote,
    submitCounterAttack,
  }
}
