import { NextResponse } from 'next/server'
import { buildClientState, isRoomLockError } from '@/lib/room-manager'
import { answerSchema } from '@/lib/api-schemas'
import { apiBusy, apiError } from '@/lib/api-response'
import { getPlayerTokenFromRequest, requireAuthorizedPlayer, enforceRateLimit, enforceSameOrigin } from '@/lib/api-auth'
import { advanceRoom, submitAnswerAtomically } from '@/lib/game-engine'
import { publishRoomEvent } from '@/lib/ably'

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

  try {
    const auth = await requireAuthorizedPlayer(roomId, playerId, getPlayerTokenFromRequest(request, bodyPlayerToken))
    if (!auth.ok) {
      return apiError(auth.error, auth.status, rateLimit.headers)
    }

    const result = await submitAnswerAtomically(roomId, playerId, answerIndex)
    if (!result.success) {
      return apiError(result.reason || 'Nao foi possivel registrar a resposta', 400, rateLimit.headers)
    }

    const latestRoom = result.room ?? await advanceRoom(roomId)
    await publishRoomEvent(roomId, 'answer-submitted', latestRoom ? { state: buildClientState(latestRoom) } : undefined)
    return NextResponse.json(
      { success: true, state: latestRoom ? buildClientState(latestRoom) : null },
      { headers: rateLimit.headers }
    )
  } catch (error) {
    if (isRoomLockError(error)) {
      return apiBusy(undefined, rateLimit.headers)
    }
    throw error
  }
}
