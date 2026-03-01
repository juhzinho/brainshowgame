import { NextResponse } from 'next/server'
import { applySabotage, broadcastState, buildClientState, getRoom } from '@/lib/room-manager'
import type { SabotageType } from '@/lib/game-state'
import { sabotageSchema } from '@/lib/api-schemas'
import { apiError } from '@/lib/api-response'
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

  const rateLimit = enforceRateLimit(request, 'gameplayAction', `${roomId}:sabotage`)
  if ('error' in rateLimit) return rateLimit.error

  const body = await request.json().catch(() => null)
  const parsed = sabotageSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Dados invalidos', 400, rateLimit.headers)
  }
  const { playerId, playerToken: bodyPlayerToken, targetPlayerId, sabotageType } = parsed.data as {
    playerId: string
    playerToken?: string
    targetPlayerId: string
    sabotageType: SabotageType
  }

  await advanceRoom(roomId)
  const auth = await requireAuthorizedPlayer(roomId, playerId, getPlayerTokenFromRequest(request, bodyPlayerToken))
  if (!auth.ok) {
    return apiError(auth.error, auth.status, rateLimit.headers)
  }

  const applied = await applySabotage(roomId, playerId, targetPlayerId, sabotageType)
  if (!applied) {
    return apiError('Nao foi possivel aplicar sabotagem', 400, rateLimit.headers)
  }

  await broadcastState(roomId)
  const room = await advanceRoom(roomId)
  await publishRoomEvent(roomId, 'sabotage-used', room ? { state: buildClientState(room) } : undefined)
  const latestRoom = room ?? await getRoom(roomId)
  return NextResponse.json({ success: true, state: latestRoom ? buildClientState(latestRoom) : null }, { headers: rateLimit.headers })
}
