import { NextResponse } from 'next/server'
import { advanceRoom, submitCounterAttack } from '@/lib/game-engine'
import { counterAttackSchema } from '@/lib/api-schemas'
import { apiBusy, apiError } from '@/lib/api-response'
import { getPlayerTokenFromRequest, requireAuthorizedPlayer, enforceRateLimit, enforceSameOrigin } from '@/lib/api-auth'
import { broadcastState, isRoomLockError } from '@/lib/room-manager'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const sameOriginError = enforceSameOrigin(request)
  if (sameOriginError) return sameOriginError

  const rateLimit = enforceRateLimit(request, 'gameplayAction', `${roomId}:counter-attack`)
  if ('error' in rateLimit) return rateLimit.error

  const body = await request.json().catch(() => null)
  const parsed = counterAttackSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Dados invalidos', 400, rateLimit.headers)
  }
  const { playerId, playerToken: bodyPlayerToken, cardIndex } = parsed.data

  try {
    await advanceRoom(roomId)
    const auth = await requireAuthorizedPlayer(roomId, playerId, getPlayerTokenFromRequest(request, bodyPlayerToken))
    if (!auth.ok) {
      return apiError(auth.error, auth.status, rateLimit.headers)
    }

    const success = await submitCounterAttack(roomId, playerId, cardIndex)
    if (!success) {
      return apiError('Counter-attack failed', 400, rateLimit.headers)
    }

    await broadcastState(roomId)
    return NextResponse.json({ ok: true }, { headers: rateLimit.headers })
  } catch (error) {
    if (isRoomLockError(error)) {
      return apiBusy(undefined, rateLimit.headers)
    }
    throw error
  }
}
