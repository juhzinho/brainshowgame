import type { Room } from './game-state'

const ROOM_SET_KEY = 'brainshow:rooms'

type RedisResult<T> = {
  result: T
}

const globalForStorage = globalThis as unknown as {
  __brainshow_rooms_fallback?: Map<string, Room>
  __brainshow_locks_fallback?: Map<string, { token: string; expiresAt: number }>
  __brainshow_presence_fallback?: Map<string, Map<string, number>>
}

if (!globalForStorage.__brainshow_rooms_fallback) {
  globalForStorage.__brainshow_rooms_fallback = new Map<string, Room>()
}
if (!globalForStorage.__brainshow_locks_fallback) {
  globalForStorage.__brainshow_locks_fallback = new Map<string, { token: string; expiresAt: number }>()
}
if (!globalForStorage.__brainshow_presence_fallback) {
  globalForStorage.__brainshow_presence_fallback = new Map<string, Map<string, number>>()
}

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

  if (!url || !token) {
    return null
  }

  return { url, token }
}

async function runRedisCommand<T>(...args: Array<string | number>): Promise<T | null> {
  const config = getRedisConfig()
  if (!config) return null

  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Redis command failed with status ${response.status}`)
  }

  const payload = (await response.json()) as RedisResult<T>
  return payload.result ?? null
}

function getRoomKey(roomId: string) {
  return `brainshow:room:${roomId}`
}

function getLockKey(roomId: string) {
  return `brainshow:lock:${roomId}`
}

function getPresenceKey(roomId: string) {
  return `brainshow:presence:${roomId}`
}

export function isPersistentStorageEnabled(): boolean {
  return Boolean(getRedisConfig())
}

export async function getStoredRoom(roomId: string): Promise<Room | null> {
  const config = getRedisConfig()
  if (!config) {
    return globalForStorage.__brainshow_rooms_fallback!.get(roomId) || null
  }

  const raw = await runRedisCommand<string>('GET', getRoomKey(roomId))
  return raw ? (JSON.parse(raw) as Room) : null
}

export async function setStoredRoom(room: Room): Promise<void> {
  const config = getRedisConfig()
  if (!config) {
    globalForStorage.__brainshow_rooms_fallback!.set(room.id, room)
    return
  }

  await runRedisCommand('SET', getRoomKey(room.id), JSON.stringify(room))
  await runRedisCommand('SADD', ROOM_SET_KEY, room.id)
}

export async function deleteStoredRoom(roomId: string): Promise<void> {
  const config = getRedisConfig()
  if (!config) {
    globalForStorage.__brainshow_rooms_fallback!.delete(roomId)
    globalForStorage.__brainshow_presence_fallback!.delete(roomId)
    return
  }

  await runRedisCommand('DEL', getRoomKey(roomId))
  await runRedisCommand('DEL', getPresenceKey(roomId))
  await runRedisCommand('SREM', ROOM_SET_KEY, roomId)
}

export async function listStoredRooms(): Promise<Room[]> {
  const config = getRedisConfig()
  if (!config) {
    return Array.from(globalForStorage.__brainshow_rooms_fallback!.values())
  }

  const roomIds = (await runRedisCommand<string[]>('SMEMBERS', ROOM_SET_KEY)) || []
  const rooms = await Promise.all(roomIds.map((roomId) => getStoredRoom(roomId)))
  return rooms.filter((room): room is Room => Boolean(room))
}

export async function acquireRoomLock(roomId: string, ttlSeconds = 5): Promise<string | null> {
  const config = getRedisConfig()
  const token = crypto.randomUUID()

  if (!config) {
    const locks = globalForStorage.__brainshow_locks_fallback!
    const existing = locks.get(roomId)
    const now = Date.now()
    if (existing && existing.expiresAt > now) {
      return null
    }
    locks.set(roomId, { token, expiresAt: now + ttlSeconds * 1000 })
    return token
  }

  const result = await runRedisCommand<string>('SET', getLockKey(roomId), token, 'NX', 'EX', ttlSeconds)
  return result === 'OK' ? token : null
}

export async function releaseRoomLock(roomId: string, token: string): Promise<void> {
  const config = getRedisConfig()
  if (!config) {
    const locks = globalForStorage.__brainshow_locks_fallback!
    const existing = locks.get(roomId)
    if (existing?.token === token) {
      locks.delete(roomId)
    }
    return
  }

  const key = getLockKey(roomId)
  const current = await runRedisCommand<string>('GET', key)
  if (current === token) {
    await runRedisCommand('DEL', key)
  }
}

export async function setPlayerPresence(roomId: string, playerId: string, timestamp: number): Promise<void> {
  const config = getRedisConfig()
  if (!config) {
    const roomPresence = globalForStorage.__brainshow_presence_fallback!.get(roomId) || new Map<string, number>()
    roomPresence.set(playerId, timestamp)
    globalForStorage.__brainshow_presence_fallback!.set(roomId, roomPresence)
    return
  }

  await runRedisCommand('HSET', getPresenceKey(roomId), playerId, timestamp)
}

export async function getRoomPresence(roomId: string): Promise<Record<string, number>> {
  const config = getRedisConfig()
  if (!config) {
    const roomPresence = globalForStorage.__brainshow_presence_fallback!.get(roomId) || new Map<string, number>()
    return Object.fromEntries(roomPresence.entries())
  }

  const raw = (await runRedisCommand<Record<string, string | number>>('HGETALL', getPresenceKey(roomId))) || {}
  return Object.fromEntries(
    Object.entries(raw).map(([playerId, timestamp]) => [playerId, Number(timestamp) || 0])
  )
}
