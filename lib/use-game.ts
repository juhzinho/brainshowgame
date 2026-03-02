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
  const currentPhase = useGameStore((state) => state.phase)
  const currentTimer = useGameStore((state) => state.timer)

  const buildHeaders = useCallback(() => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (playerToken) {
      headers['x-player-token'] = playerToken
    }
    return headers
  }, [playerToken])

  const wait = useCallback((delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs)), [])

  const fetchWithBusyRetry = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const res = await fetch(input, init)
      if (res.status !== 409) {
        return res
      }

      if (attempt < 2) {
        await wait(120 + attempt * 180)
      }
    }

    return fetch(input, init)
  }, [wait])

  const refreshGameState = useCallback(async () => {
    if (!roomId || !playerId || !playerToken) return

    try {
      const res = await fetchWithBusyRetry(`/api/rooms/${roomId}?playerId=${playerId}`, {
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
  }, [fetchWithBusyRetry, roomId, playerId, playerToken, resetStore, setConnected, updateGameState])

  const sendHeartbeat = useCallback(async () => {
    if (!roomId || !playerId || !playerToken) return

    try {
      await fetchWithBusyRetry(`/api/rooms/${roomId}/heartbeat`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken }),
      })
    } catch {
      // ignore heartbeat failures; realtime and room refresh will recover
    }
  }, [buildHeaders, fetchWithBusyRetry, playerId, playerToken, roomId])

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

  // Keep a light room-state refresh for recovery.
  useEffect(() => {
    if (!roomId || !playerId || !playerToken) return

    let active = true
    const intervalId = setInterval(() => {
      if (!active) return
      void refreshGameState()
    }, 7000)

    void refreshGameState()

    return () => {
      active = false
      clearInterval(intervalId)
    }
  }, [playerId, playerToken, refreshGameState, roomId])

  // Presence heartbeat is separated from room-state reads to reduce lock contention.
  useEffect(() => {
    if (!roomId || !playerId || !playerToken) return

    const intervalId = setInterval(() => {
      void sendHeartbeat()
    }, 6000)

    void sendHeartbeat()

    return () => clearInterval(intervalId)
  }, [playerId, playerToken, roomId, sendHeartbeat])

  // During timer-based phases, do one precise refresh near the phase deadline instead of rapid polling.
  useEffect(() => {
    if (!roomId || !playerId || !playerToken) return

    const isTimedPhase = ['answering', 'steal-vote', 'counter-attack'].includes(currentPhase)
    if (!isTimedPhase || currentTimer <= 0) return

    const timeoutId = setTimeout(() => {
      void refreshGameState()
    }, Math.max(250, currentTimer * 1000 + 150))

    return () => clearTimeout(timeoutId)
  }, [currentPhase, currentTimer, playerId, playerToken, refreshGameState, roomId])

  // Send answer
  const sendAnswer = useCallback(async (answerIndex: number) => {
    if (!roomId || !playerId || !playerToken) return
    selectAnswer(answerIndex)
    try {
      const res = await fetchWithBusyRetry(`/api/rooms/${roomId}/answer`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken, answerIndex }),
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
    }
  }, [roomId, playerId, playerToken, buildHeaders, fetchWithBusyRetry, refreshGameState, selectAnswer, updateGameState])

  // Send sabotage
  const sendSabotage = useCallback(async (targetPlayerId: string, sabotageType: SabotageType) => {
    if (!roomId || !playerId || !playerToken) return
    applyOptimisticSabotage(targetPlayerId, sabotageType)
    try {
      const res = await fetchWithBusyRetry(`/api/rooms/${roomId}/sabotage`, {
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
  }, [roomId, playerId, playerToken, applyOptimisticSabotage, buildHeaders, fetchWithBusyRetry, refreshGameState, updateGameState])

  // Start game
  const startGame = useCallback(async () => {
    if (!roomId || !playerId || !playerToken) return
    try {
      await fetchWithBusyRetry(`/api/rooms/${roomId}/start`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken }),
      })
      await refreshGameState()
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders, fetchWithBusyRetry, refreshGameState])

  // Mark ready
  const markReady = useCallback(async () => {
    if (!roomId || !playerId || !playerToken) return
    try {
      await fetchWithBusyRetry(`/api/rooms/${roomId}/ready`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken }),
      })
      await refreshGameState()
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders, fetchWithBusyRetry, refreshGameState])

  // Set categories
  const setCategories = useCallback(async (categories: string[]) => {
    if (!roomId || !playerId || !playerToken) return
    try {
      await fetchWithBusyRetry(`/api/rooms/${roomId}/categories`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken, categories }),
      })
      await refreshGameState()
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders, fetchWithBusyRetry, refreshGameState])

  // Submit steal vote
  const submitStealVote = useCallback(async (targetId: string) => {
    if (!roomId || !playerId || !playerToken) return
    try {
      const res = await fetchWithBusyRetry(`/api/rooms/${roomId}/steal-vote`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken, targetId }),
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
    }
  }, [roomId, playerId, playerToken, buildHeaders, fetchWithBusyRetry, refreshGameState, updateGameState])

  // Submit counter-attack (card index)
  const submitCounterAttack = useCallback(async (cardIndex: number) => {
    if (!roomId || !playerId || !playerToken) return
    try {
      await fetchWithBusyRetry(`/api/rooms/${roomId}/counter-attack`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken, cardIndex }),
      })
      await refreshGameState()
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders, fetchWithBusyRetry, refreshGameState])

  // Restart game (keeps used question IDs to avoid repeats)
  const restartGame = useCallback(async () => {
    if (!roomId || !playerId || !playerToken) return
    try {
      await fetchWithBusyRetry(`/api/rooms/${roomId}/restart`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken }),
      })
      await refreshGameState()
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders, fetchWithBusyRetry, refreshGameState])

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
