import { NextResponse } from 'next/server'

export function apiError(message: string, status = 400, headers?: HeadersInit) {
  return NextResponse.json({ error: message }, { status, headers })
}

export function apiBusy(message = 'Sala ocupada. Tente novamente.', headers?: HeadersInit) {
  return apiError(message, 409, headers)
}

export function withRateLimitHeaders(headers: HeadersInit | undefined, remaining: number, resetAt: number) {
  const nextHeaders = new Headers(headers)
  nextHeaders.set('X-RateLimit-Remaining', String(remaining))
  nextHeaders.set('X-RateLimit-Reset', String(Math.floor(resetAt / 1000)))
  return nextHeaders
}
