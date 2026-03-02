import { NextResponse } from 'next/server'
import { broadcastState, buildClientState, isRoomLockError, setPlayerReady } from '@/lib/room-manager'
import { playerAuthSchema } from '@/lib/api-schemas'
import { apiBusy, apiError } from '@/lib/api-response'
import { getPlayerTokenFromRequest, requireAuthorizedPlayer, enforceRateLimit, enforceSameOrigin } from '@/lib/api-auth'
import { advanceRoom } from '@/lib/game-engine'
import { publishRoomEvent } from '@/lib/ably'

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

  try {
    const auth = await requireAuthorizedPlayer(roomId, playerId, getPlayerTokenFromRequest(request, bodyPlayerToken))
    if (!auth.ok) {
      return apiError(auth.error, auth.status, rateLimit.headers)
    }

    const success = await setPlayerReady(roomId, playerId)
    if (!success) {
      return apiError('Nao foi possivel marcar como pronto', 400, rateLimit.headers)
    }

    await broadcastState(roomId)
    const room = await advanceRoom(roomId)
    await publishRoomEvent(roomId, 'player-ready', room ? { state: buildClientState(room) } : undefined)
    return NextResponse.json({ success: true }, { headers: rateLimit.headers })
  } catch (error) {
    if (isRoomLockError(error)) {
      return apiBusy(undefined, rateLimit.headers)
    }
    throw error
  }
}
