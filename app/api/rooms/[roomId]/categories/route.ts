import { NextResponse } from 'next/server'
import { broadcastState, buildClientState, getRoom, sanitizeCategories, setRoomCategories } from '@/lib/room-manager'
import { categoriesSchema } from '@/lib/api-schemas'
import { apiError } from '@/lib/api-response'
import { auditLog } from '@/lib/audit'
import { getPlayerTokenFromRequest, requireAuthorizedPlayer, enforceRateLimit, enforceSameOrigin } from '@/lib/api-auth'
import { publishRoomEvent } from '@/lib/ably'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const sameOriginError = enforceSameOrigin(request)
  if (sameOriginError) return sameOriginError

  const rateLimit = enforceRateLimit(request, 'roomMutation', `${roomId}:categories`)
  if ('error' in rateLimit) return rateLimit.error

  const body = await request.json().catch(() => null)
  const parsed = categoriesSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Categorias invalidas', 400, rateLimit.headers)
  }
  const { playerId, playerToken: bodyPlayerToken, categories } = parsed.data

  const auth = await requireAuthorizedPlayer(roomId, playerId, getPlayerTokenFromRequest(request, bodyPlayerToken))
  if (!auth.ok) {
    return apiError(auth.error, auth.status, rateLimit.headers)
  }
  const room = await getRoom(roomId)

  if (!room || room.hostId !== playerId) {
    return apiError('Apenas o host pode alterar as categorias', 403, rateLimit.headers)
  }

  if (room.state !== 'waiting') {
    return apiError('Categorias so podem ser alteradas antes do jogo', 400, rateLimit.headers)
  }

  const sanitizedCategories = sanitizeCategories(categories)
  if (sanitizedCategories === null) {
    return apiError('Categorias invalidas', 400, rateLimit.headers)
  }

  await setRoomCategories(roomId, sanitizedCategories)
  await broadcastState(roomId)
  const updatedRoom = await getRoom(roomId)
  await publishRoomEvent(roomId, 'categories-updated', updatedRoom ? { state: buildClientState(updatedRoom) } : undefined)
  auditLog({
    event: 'room_categories_updated',
    roomId,
    playerId,
    request: rateLimit.context,
    details: { count: sanitizedCategories.length },
  })
  return NextResponse.json({ success: true, categories: sanitizedCategories }, { headers: rateLimit.headers })
}
