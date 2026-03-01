export interface RequestContext {
  ip: string
  origin: string
  host: string
  path: string
  method: string
  userAgent: string
  requestId: string
}

function getFirstForwardedValue(value: string | null): string {
  return value?.split(',')[0]?.trim() || ''
}

export function getClientIp(request: Request): string {
  return (
    getFirstForwardedValue(request.headers.get('x-forwarded-for')) ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

export function getRequestContext(request: Request): RequestContext {
  const url = new URL(request.url)

  return {
    ip: getClientIp(request),
    origin: request.headers.get('origin') || '',
    host: request.headers.get('host') || url.host,
    path: url.pathname,
    method: request.method,
    userAgent: request.headers.get('user-agent') || 'unknown',
    requestId: request.headers.get('x-request-id') || crypto.randomUUID(),
  }
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true

  return origin === new URL(request.url).origin
}
