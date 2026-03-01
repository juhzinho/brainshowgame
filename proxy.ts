import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

function buildContentSecurityPolicy(isDevelopment: boolean) {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    `connect-src 'self' https: wss:${isDevelopment ? ' ws: http:' : ''}`,
  ]

  return directives.join('; ')
}

export function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const isDevelopment = process.env.NODE_ENV !== 'production'

  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy(isDevelopment))
  response.headers.set('X-Request-Id', request.headers.get('x-request-id') || crypto.randomUUID())

  const forwardedProto = request.headers.get('x-forwarded-proto')
  if (forwardedProto === 'https') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
