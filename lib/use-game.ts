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

  // Poll for game state instead of SSE (more reliable)
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
          scheduleNext(1000)
          return
        }
        const data = await res.json()
        if (active && data) {
          store.setConnected(true)
          store.updateGameState(data)
          
          // Adaptive polling: faster during active gameplay, slower during waiting
          const phase = data.phase || 'waiting'
          const isActive = ['answering', 'steal-vote', 'counter-attack'].includes(phase)
          const isWaiting = phase === 'waiting' || phase === 'finished'
          const nextDelay = isActive ? 400 : isWaiting ? 1500 : 700
          scheduleNext(nextDelay)
        } else {
          scheduleNext(700)
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
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders, store])

  // Send sabotage
  const sendSabotage = useCallback(async (targetPlayerId: string, sabotageType: SabotageType) => {
    if (!roomId || !playerId || !playerToken) return
    try {
      await fetch(`/api/rooms/${roomId}/sabotage`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken, targetPlayerId, sabotageType }),
      })
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders])

  // Start game
  const startGame = useCallback(async () => {
    if (!roomId || !playerId || !playerToken) return
    try {
      await fetch(`/api/rooms/${roomId}/start`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken }),
      })
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders])

  // Mark ready
  const markReady = useCallback(async () => {
    if (!roomId || !playerId || !playerToken) return
    try {
      await fetch(`/api/rooms/${roomId}/ready`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken }),
      })
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders])

  // Set categories
  const setCategories = useCallback(async (categories: string[]) => {
    if (!roomId || !playerId || !playerToken) return
    try {
      await fetch(`/api/rooms/${roomId}/categories`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken, categories }),
      })
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders])

  // Submit steal vote
  const submitStealVote = useCallback(async (targetId: string) => {
    if (!roomId || !playerId || !playerToken) return
    try {
      await fetch(`/api/rooms/${roomId}/steal-vote`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken, targetId }),
      })
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders])

  // Submit counter-attack (card index)
  const submitCounterAttack = useCallback(async (cardIndex: number) => {
    if (!roomId || !playerId || !playerToken) return
    try {
      await fetch(`/api/rooms/${roomId}/counter-attack`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken, cardIndex }),
      })
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders])

  // Restart game (keeps used question IDs to avoid repeats)
  const restartGame = useCallback(async () => {
    if (!roomId || !playerId || !playerToken) return
    try {
      await fetch(`/api/rooms/${roomId}/restart`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ playerId, playerToken }),
      })
    } catch {
      // ignore
    }
  }, [roomId, playerId, playerToken, buildHeaders])

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
