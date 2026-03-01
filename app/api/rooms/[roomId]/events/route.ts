import { getRoom, addConnection, removeConnection, broadcastState } from '@/lib/room-manager'
import { getPlayerTokenFromRequest, requireAuthorizedPlayer } from '@/lib/api-auth'
import { advanceRoom } from '@/lib/game-engine'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const url = new URL(request.url)
  const playerId = url.searchParams.get('playerId')
  const playerToken = getPlayerTokenFromRequest(request)

  if (!playerId) {
    return new Response('playerId obrigatorio', { status: 400 })
  }

  await advanceRoom(roomId)
  const auth = await requireAuthorizedPlayer(roomId, playerId, playerToken)
  if (!auth.ok) {
    return new Response(auth.error, { status: auth.status })
  }
  await getRoom(roomId)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Helper to send SSE data
      const send = (text: string) => {
        controller.enqueue(encoder.encode(text))
      }

      const close = () => {
        try { controller.close() } catch {}
      }

      // Send initial state
      send(`data: ${JSON.stringify({
        type: 'connected',
        data: { roomId, playerId },
        timestamp: Date.now(),
      })}\n\n`)

      // Register connection
      addConnection(roomId, playerId, send, close)

      // Send current state immediately
      setTimeout(() => {
        void broadcastState(roomId)
      }, 100)

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          send(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`)
        } catch {
          clearInterval(heartbeat)
        }
      }, 15000)

      // Cleanup on abort
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        removeConnection(roomId, playerId)
        close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
