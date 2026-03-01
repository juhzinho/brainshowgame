import { NextResponse } from 'next/server'
import { getAblyServer } from '@/lib/ably'

async function handleAuthRequest() {
  const ably = getAblyServer()
  if (!ably) {
    return NextResponse.json({ error: 'Ably nao configurado' }, { status: 503 })
  }

  const tokenRequest = await ably.auth.createTokenRequest({
    clientId: `brainshow-${crypto.randomUUID()}`,
  })

  return NextResponse.json(tokenRequest)
}

export async function GET() {
  return handleAuthRequest()
}

export async function POST() {
  return handleAuthRequest()
}
