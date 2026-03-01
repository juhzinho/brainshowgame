import { NextResponse } from 'next/server'
import { broadcastState, recordAnswer } from '@/lib/room-manager'
import { answerSchema } from '@/lib/api-schemas'
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

  const rateLimit = enforceRateLimit(request, 'gameplayAction', `${roomId}:answer`)
  if ('error' in rateLimit) return rateLimit.error

  const body = await request.json().catch(() => null)
  const parsed = answerSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Dados invalidos', 400, rateLimit.headers)
  }
  const { playerId, playerToken: bodyPlayerToken, answerIndex } = parsed.data

  await advanceRoom(roomId)
  const auth = await requireAuthorizedPlayer(roomId, playerId, getPlayerTokenFromRequest(request, bodyPlayerToken))
  if (!auth.ok) {
    return apiError(auth.error, auth.status, rateLimit.headers)
  }

  const recorded = await recordAnswer(roomId, playerId, answerIndex)
  if (!recorded) {
    return apiError('Nao foi possivel registrar a resposta', 400, rateLimit.headers)
  }

  await broadcastState(roomId)
  await advanceRoom(roomId)
  return NextResponse.json({ success: true }, { headers: rateLimit.headers })
}
