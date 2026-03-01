import { NextResponse } from 'next/server'
import { getRoom } from '@/lib/room-manager'
import { restartGame } from '@/lib/game-engine'
import { playerAuthSchema } from '@/lib/api-schemas'
import { apiError } from '@/lib/api-response'
import { auditLog } from '@/lib/audit'
import { getPlayerTokenFromRequest, requireAuthorizedPlayer, enforceRateLimit, enforceSameOrigin } from '@/lib/api-auth'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const sameOriginError = enforceSameOrigin(request)
  if (sameOriginError) return sameOriginError

  const rateLimit = enforceRateLimit(request, 'roomMutation', `${roomId}:restart`)
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
  const room = await getRoom(roomId)

  if (!room || room.hostId !== playerId) {
    return apiError('Apenas o host pode reiniciar o jogo', 403, rateLimit.headers)
  }

  const restarted = await restartGame(roomId)
  if (!restarted) {
    return apiError('Nao foi possivel reiniciar o jogo', 400, rateLimit.headers)
  }

  auditLog({
    event: 'game_restarted',
    roomId,
    playerId,
    request: rateLimit.context,
  })

  return NextResponse.json({ success: true }, { headers: rateLimit.headers })
}
