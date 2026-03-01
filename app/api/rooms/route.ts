import { NextResponse } from 'next/server'
import { buildClientState, createRoom, listRooms, cleanupOldRooms, normalizePlayerName } from '@/lib/room-manager'
import { createRoomSchema } from '@/lib/api-schemas'
import { apiError } from '@/lib/api-response'
import { auditLog } from '@/lib/audit'
import { enforceRateLimit, enforceSameOrigin } from '@/lib/api-auth'
import { publishRoomEvent } from '@/lib/ably'
import { sanitizeUsedQuestionIds } from '@/lib/questions'

export async function GET() {
  await cleanupOldRooms()
  const rooms = await listRooms()
  return NextResponse.json({ rooms })
}

export async function POST(request: Request) {
  const sameOriginError = enforceSameOrigin(request)
  if (sameOriginError) return sameOriginError

  const rateLimit = enforceRateLimit(request, 'createRoom')
  if ('error' in rateLimit) return rateLimit.error

  const body = await request.json().catch(() => null)
  const parsed = createRoomSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Dados invalidos', 400, rateLimit.headers)
  }

  const { playerName, usedQuestionIds } = parsed.data

  const normalizedName = normalizePlayerName(playerName)
  if (!normalizedName) {
    return apiError('Nome do jogador deve ter entre 2 e 15 caracteres', 400, rateLimit.headers)
  }

  const { room, playerId, playerToken } = await createRoom(normalizedName, sanitizeUsedQuestionIds(usedQuestionIds))
  await publishRoomEvent(room.id, 'room-created', { state: buildClientState(room) })
  auditLog({
    event: 'room_created',
    roomId: room.id,
    playerId,
    request: rateLimit.context,
    details: { playerName: normalizedName },
  })

  return NextResponse.json({ roomId: room.id, playerId, playerToken, room }, { headers: rateLimit.headers })
}
