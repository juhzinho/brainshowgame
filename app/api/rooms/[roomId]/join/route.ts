import { NextResponse } from 'next/server'
import { joinRoom, getRoom, normalizePlayerName } from '@/lib/room-manager'
import { joinRoomSchema } from '@/lib/api-schemas'
import { apiError } from '@/lib/api-response'
import { auditLog } from '@/lib/audit'
import { enforceRateLimit, enforceSameOrigin } from '@/lib/api-auth'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const sameOriginError = enforceSameOrigin(request)
  if (sameOriginError) return sameOriginError

  const rateLimit = enforceRateLimit(request, 'joinRoom', roomId)
  if ('error' in rateLimit) return rateLimit.error

  const body = await request.json().catch(() => null)
  const parsed = joinRoomSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Dados invalidos', 400, rateLimit.headers)
  }
  const { playerName } = parsed.data

  const normalizedName = normalizePlayerName(playerName)
  if (!normalizedName) {
    return apiError('Nome do jogador deve ter entre 2 e 15 caracteres', 400, rateLimit.headers)
  }

  // Check if room exists first for better error messages
  const room = await getRoom(roomId)
  if (!room) {
    return apiError('Sala nao encontrada. Verifique o codigo e tente novamente.', 404, rateLimit.headers)
  }
  if (room.state !== 'waiting') {
    return apiError('Esta sala ja esta em jogo. Aguarde a proxima partida.', 400, rateLimit.headers)
  }
  if (room.players.length >= room.maxPlayers) {
    return apiError('Sala cheia. Maximo de 20 jogadores.', 400, rateLimit.headers)
  }

  if (room.players.some((player) => player.name.toLowerCase() === normalizedName.toLowerCase())) {
    return apiError('Ja existe um jogador com esse nome na sala.', 400, rateLimit.headers)
  }

  const result = await joinRoom(roomId, normalizedName)
  if (!result) {
    return apiError('Erro ao entrar na sala. Tente novamente.', 400, rateLimit.headers)
  }

  auditLog({
    event: 'room_joined',
    roomId,
    playerId: result.player.id,
    request: rateLimit.context,
    details: { playerName: normalizedName },
  })

  return NextResponse.json({
    playerId: result.player.id,
    playerToken: result.playerToken,
    roomId: result.room.id,
    player: result.player,
  }, { headers: rateLimit.headers })
}
