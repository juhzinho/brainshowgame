import type { RequestContext } from './request-context'

type AuditLevel = 'info' | 'warn' | 'error'

interface AuditPayload {
  event: string
  level?: AuditLevel
  roomId?: string
  playerId?: string
  details?: Record<string, unknown>
  request?: Partial<RequestContext>
}

export function auditLog(payload: AuditPayload): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level: payload.level || 'info',
    event: payload.event,
    roomId: payload.roomId,
    playerId: payload.playerId,
    request: payload.request,
    details: payload.details,
  }

  const serialized = JSON.stringify(entry)

  if (entry.level === 'error') {
    console.error(serialized)
    return
  }

  if (entry.level === 'warn') {
    console.warn(serialized)
    return
  }

  console.info(serialized)
}
