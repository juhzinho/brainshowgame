const STORAGE_KEYS = {
  roomId: 'brainshow_roomId',
  playerId: 'brainshow_playerId',
  playerName: 'brainshow_playerName',
  playerToken: 'brainshow_playerToken',
} as const

export interface StoredSession {
  roomId: string
  playerId: string
  playerName: string
  playerToken: string
}

export function loadStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null

  const roomId = sessionStorage.getItem(STORAGE_KEYS.roomId)
  const playerId = sessionStorage.getItem(STORAGE_KEYS.playerId)
  const playerName = sessionStorage.getItem(STORAGE_KEYS.playerName)
  const playerToken = sessionStorage.getItem(STORAGE_KEYS.playerToken)

  if (!roomId || !playerId || !playerName || !playerToken) {
    return null
  }

  return { roomId, playerId, playerName, playerToken }
}

export function saveStoredSession(session: StoredSession): void {
  if (typeof window === 'undefined') return

  sessionStorage.setItem(STORAGE_KEYS.roomId, session.roomId)
  sessionStorage.setItem(STORAGE_KEYS.playerId, session.playerId)
  sessionStorage.setItem(STORAGE_KEYS.playerName, session.playerName)
  sessionStorage.setItem(STORAGE_KEYS.playerToken, session.playerToken)
}

export function clearStoredSession(): void {
  if (typeof window === 'undefined') return

  sessionStorage.removeItem(STORAGE_KEYS.roomId)
  sessionStorage.removeItem(STORAGE_KEYS.playerId)
  sessionStorage.removeItem(STORAGE_KEYS.playerName)
  sessionStorage.removeItem(STORAGE_KEYS.playerToken)
}
