'use client'

import { useEffect, useCallback } from 'react'
import { useGameStore } from './use-game-store'
import type { SabotageType } from './game-state'

export function useGame(roomId: string | null, playerId: string | null, playerToken: string | null) {
  const store = useGameStore()

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
          store.reset()
          return
        }
        return
      }

      const data = await res.json()
      store.setConnected(true)
      store.updateGameState(data)
    } catch {
      store.setConnected(false)
    }
  }, [roomId, playerId, playerToken, store])

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
            store.reset()
            return
          }
          scheduleNext(1200)
          return
        }
        const data = await res.json()
        if (active && data) {
          store.setConnected(true)
          store.updateGameState(data)
          
          const phase = data.phase || 'waiting'
          const isActive = ['answering', 'steal-vote', 'counter-attack'].includes(phase)
          const isWaiting = phase === 'waiting' || phase === 'finished'
          const nextDelay = isActive ? 650 : isWaiting ? 2500 : 1200
          scheduleNext(nextDelay)
        } else {
          scheduleNext(1200)
        }
      } catch {
        if (active) store.setConnected(false)
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
  }, [roomId, playerId, playerToken, store])

  // Send answer
  const sendAnswer = useCallback(async (answerIndex: number) => {
    if (!roomId || !playerId || !playerToken) return
    store.selectAnswer(answerIndex)
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
  }, [roomId, playerId, playerToken, buildHeaders, refreshGameState, store])

  // Send sabotage
  const sendSabotage = useCallback(async (targetPlayerId: string, sabotageType: SabotageType) => {
    if (!roomId || !playerId || !playerToken) return
    try {
      await fetch(`/api/rooms/${roomId}/sabotage`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken, targetPlayerId, sabotageType }),
      })
      await refreshGameState()
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders, refreshGameState])

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
