import { NextResponse } from 'next/server'
import { getRoom, deleteRoom, buildClientState, getPublicRoomState, markPlayerActive } from '@/lib/room-manager'
import { apiError } from '@/lib/api-response'
import { auditLog } from '@/lib/audit'
import { getPlayerTokenFromRequest, requireAuthorizedPlayer, enforceRateLimit, enforceSameOrigin } from '@/lib/api-auth'
import { advanceRoom } from '@/lib/game-engine'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const rateLimit = enforceRateLimit(request, 'publicRead', roomId)
  if ('error' in rateLimit) return rateLimit.error

  const url = new URL(request.url)
  const playerId = url.searchParams.get('playerId') || ''
  const playerToken = getPlayerTokenFromRequest(request)

  await advanceRoom(roomId)
  const room = await getRoom(roomId)
  if (!room) {
    return apiError('Sala nao encontrada', 404, rateLimit.headers)
  }

  if (!playerId) {
    return NextResponse.json(await getPublicRoomState(roomId), { headers: rateLimit.headers })
  }

  const auth = await requireAuthorizedPlayer(roomId, playerId, playerToken)
  if (!auth.ok) {
    auditLog({
      level: 'warn',
      event: 'room_state_unauthorized',
      roomId,
      playerId,
      request: rateLimit.context,
    })
    return apiError(auth.error, auth.status, rateLimit.headers)
  }

  // Mark player as active on every poll
  await markPlayerActive(roomId, playerId)
  const updatedRoom = await getRoom(roomId)

  return NextResponse.json(buildClientState(updatedRoom || room), { headers: rateLimit.headers })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const sameOriginError = enforceSameOrigin(request)
  if (sameOriginError) return sameOriginError

  const rateLimit = enforceRateLimit(request, 'roomMutation', roomId)
  if ('error' in rateLimit) return rateLimit.error

  const url = new URL(request.url)
  const playerId = url.searchParams.get('playerId') || ''
  const playerToken = getPlayerTokenFromRequest(request)
  const auth = await requireAuthorizedPlayer(roomId, playerId, playerToken)
  if (!auth.ok) {
    return apiError(auth.error, auth.status, rateLimit.headers)
  }
  if (auth.room.hostId !== playerId) {
    return apiError('Apenas o host pode encerrar a sala', 403, rateLimit.headers)
  }

  const deleted = await deleteRoom(roomId)
  if (!deleted) {
    return apiError('Sala nao encontrada', 404, rateLimit.headers)
  }
  auditLog({
    event: 'room_deleted',
    roomId,
    playerId,
    request: rateLimit.context,
  })
  return NextResponse.json({ success: true }, { headers: rateLimit.headers })
}
