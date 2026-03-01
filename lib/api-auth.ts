import { getRoom, isAuthorizedPlayer } from './room-manager'
import { apiError, withRateLimitHeaders } from './api-response'
import { auditLog } from './audit'
import { RATE_LIMIT_RULES, applyRateLimit, isRateLimitExceeded } from './rate-limit'
import { getRequestContext, isSameOriginRequest } from './request-context'

export function getPlayerTokenFromRequest(request: Request, fallback?: unknown): string {
  if (typeof fallback === 'string' && fallback.trim().length > 0) {
    return fallback.trim()
  }

  const headerToken = request.headers.get('x-player-token')
  if (headerToken && headerToken.trim().length > 0) {
    return headerToken.trim()
  }

  const searchToken = new URL(request.url).searchParams.get('playerToken')
  return searchToken?.trim() || ''
}

export async function requireAuthorizedPlayer(roomId: string, playerId: string, playerToken: string) {
  const room = await getRoom(roomId)
  if (!room) {
    return { ok: false as const, status: 404, error: 'Sala nao encontrada' }
  }

  if (!playerId || !playerToken || !(await isAuthorizedPlayer(roomId, playerId, playerToken))) {
    return { ok: false as const, status: 401, error: 'Jogador nao autorizado' }
  }

  return { ok: true as const, room }
}

export function enforceSameOrigin(request: Request) {
  if (isSameOriginRequest(request)) {
    return null
  }

  const context = getRequestContext(request)
  auditLog({
    level: 'warn',
    event: 'csrf_blocked',
    request: context,
  })

  return apiError('Origem da requisicao nao permitida', 403)
}

export function enforceRateLimit(request: Request, scope: keyof typeof RATE_LIMIT_RULES, suffix = '') {
  const context = getRequestContext(request)
  const key = `${scope}:${context.ip}:${suffix || context.path}`
  const result = applyRateLimit(key, RATE_LIMIT_RULES[scope])

  if (isRateLimitExceeded(result)) {
    const retryAfterSeconds = result.retryAfterSeconds

    auditLog({
      level: 'warn',
      event: 'rate_limit_exceeded',
      request: context,
      details: {
        scope,
        suffix,
        retryAfterSeconds,
      },
    })

    return {
      error: apiError(
        'Muitas requisicoes. Tente novamente em instantes.',
        429,
        withRateLimitHeaders({ 'Retry-After': String(retryAfterSeconds) }, result.remaining, result.resetAt)
      ),
      context,
    }
  }

  return {
    headers: withRateLimitHeaders(undefined, result.remaining, result.resetAt),
    context,
  }
}
