import { NextResponse } from 'next/server'
import { isRoomLockError, markPlayerActive } from '@/lib/room-manager'
import { playerAuthSchema } from '@/lib/api-schemas'
import { apiBusy, apiError } from '@/lib/api-response'
import { getPlayerTokenFromRequest, requireAuthorizedPlayer, enforceRateLimit, enforceSameOrigin } from '@/lib/api-auth'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const sameOriginError = enforceSameOrigin(request)
  if (sameOriginError) return sameOriginError

  const rateLimit = enforceRateLimit(request, 'publicRead', `${roomId}:heartbeat`)
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

  try {
    await markPlayerActive(roomId, playerId)
    return NextResponse.json({ success: true }, { headers: rateLimit.headers })
  } catch (error) {
    if (isRoomLockError(error)) {
      return apiBusy(undefined, rateLimit.headers)
    }
    throw error
  }
}
