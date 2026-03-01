import * as Ably from 'ably'

let realtimeServer: Ably.Rest | null = null

export function isAblyConfigured(): boolean {
  return Boolean(process.env.ABLY_API_KEY)
}

export function getRoomChannelName(roomId: string): string {
  return `room:${roomId}`
}

export function getAblyServer(): Ably.Rest | null {
  if (!process.env.ABLY_API_KEY) {
    return null
  }

  if (!realtimeServer) {
    realtimeServer = new Ably.Rest(process.env.ABLY_API_KEY)
  }

  return realtimeServer
}

export async function publishRoomEvent(roomId: string, eventName = 'room-updated', data?: Record<string, unknown>) {
  const ably = getAblyServer()
  if (!ably) return

  await ably.channels.get(getRoomChannelName(roomId)).publish(eventName, {
    roomId,
    timestamp: Date.now(),
    ...data,
  })
}
