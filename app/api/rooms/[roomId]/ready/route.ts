import { NextResponse } from 'next/server'
import { setPlayerReady } from '@/lib/room-manager'
import { playerAuthSchema } from '@/lib/api-schemas'
import { apiError } from '@/lib/api-response'
import { getPlayerTokenFromRequest, requireAuthorizedPlayer, enforceRateLimit, enforceSameOrigin } from '@/lib/api-auth'
import { advanceRoom } from '@/lib/game-engine'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const sameOriginError = enforceSameOrigin(request)
  if (sameOriginError) return sameOriginError

  const rateLimit = enforceRateLimit(request, 'roomMutation', `${roomId}:ready`)
  if ('error' in rateLimit) return rateLimit.error

  const body = await request.json().catch(() => null)
  const parsed = playerAuthSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Dados invalidos', 400, rateLimit.headers)
  }
  const { playerId, playerToken: bodyPlayerToken } = parsed.data

  const auth = await requireAuthorizedPlayer(roomId, playerId, getPlayerTokenFromRequest(request, bodyPlayerToken))
  if (!auth.ok) {
    return apiError(auth.error, auth.status, rateLimit.headers)
  }

  const success = await setPlayerReady(roomId, playerId)
  if (!success) {
    return apiError('Nao foi possivel marcar como pronto', 400, rateLimit.headers)
  }

  await advanceRoom(roomId)
  return NextResponse.json({ success: true }, { headers: rateLimit.headers })
}
