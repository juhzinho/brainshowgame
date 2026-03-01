const STORAGE_KEYS = {
  roomId: 'brainshow_roomId',
  playerId: 'brainshow_playerId',
  playerName: 'brainshow_playerName',
  playerToken: 'brainshow_playerToken',
  usedQuestionIds: 'brainshow_usedQuestionIds',
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

export function loadStoredQuestionHistory(): string[] {
  if (typeof window === 'undefined') return []

  const raw = localStorage.getItem(STORAGE_KEYS.usedQuestionIds)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is string => typeof entry === 'string')
  } catch {
    return []
  }
}

export function saveStoredQuestionHistory(questionIds: string[]): void {
  if (typeof window === 'undefined') return

  const sanitized = Array.from(
    new Set(questionIds.filter((entry): entry is string => typeof entry === 'string'))
  ).slice(-500)

  localStorage.setItem(STORAGE_KEYS.usedQuestionIds, JSON.stringify(sanitized))
}

export function appendStoredQuestionHistory(questionId: string): void {
  if (typeof window === 'undefined' || !questionId) return

  const nextHistory = [...loadStoredQuestionHistory(), questionId]
  saveStoredQuestionHistory(nextHistory)
}
