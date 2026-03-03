import { kickPlayer, buildClientState, isRoomLockError } from '@/lib/room-manager'
import { kickPlayerSchema } from '@/lib/api-schemas'
import { apiBusy, apiError } from '@/lib/api-response'
import { auditLog } from '@/lib/audit'
import { enforceRateLimit, enforceSameOrigin, requireAuthorizedPlayer } from '@/lib/api-auth'
import { publishRoomEvent } from '@/lib/ably'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const sameOriginError = enforceSameOrigin(request)
  if (sameOriginError) return sameOriginError

  const rateLimit = enforceRateLimit(request, 'roomMutation', roomId)
  if ('error' in rateLimit) return rateLimit.error

  const body = await request.json().catch(() => null)
  const parsed = kickPlayerSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Dados invalidos', 400, rateLimit.headers)
  }

  const { playerId, playerToken, targetPlayerId } = parsed.data
  const auth = await requireAuthorizedPlayer(roomId, playerId, playerToken || '')
  if (!auth.ok) {
    return apiError(auth.error, auth.status, rateLimit.headers)
  }

  if (auth.room.hostId !== playerId) {
    return apiError('Apenas o host pode expulsar jogadores', 403, rateLimit.headers)
  }

  try {
    const room = await kickPlayer(roomId, playerId, targetPlayerId)
    if (!room) {
      return apiError('Nao foi possivel expulsar este jogador', 400, rateLimit.headers)
    }

    const state = buildClientState(room)
    await publishRoomEvent(roomId, 'room-updated', { state })
    auditLog({
      event: 'player_kicked',
      roomId,
      playerId,
      request: rateLimit.context,
      details: { targetPlayerId },
    })

    return Response.json({ success: true, state }, { headers: rateLimit.headers })
  } catch (error) {
    if (isRoomLockError(error)) {
      return apiBusy(undefined, rateLimit.headers)
    }
    throw error
  }
}
