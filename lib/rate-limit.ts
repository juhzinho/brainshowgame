type RateLimitRule = {
  limit: number
  windowMs: number
}

type RateLimitResult =
  | {
      ok: true
      remaining: number
      resetAt: number
    }
  | {
      ok: false
      remaining: number
      resetAt: number
      retryAfterSeconds: number
    }

export function isRateLimitExceeded(
  result: RateLimitResult
): result is Extract<RateLimitResult, { ok: false }> {
  return result.ok === false
}

type RateLimitBucket = {
  count: number
  resetAt: number
}

const globalForRateLimit = globalThis as unknown as {
  __brainshow_rate_limit_buckets?: Map<string, RateLimitBucket>
}

if (!globalForRateLimit.__brainshow_rate_limit_buckets) {
  globalForRateLimit.__brainshow_rate_limit_buckets = new Map<string, RateLimitBucket>()
}

const buckets = globalForRateLimit.__brainshow_rate_limit_buckets

export const RATE_LIMIT_RULES = {
  publicRead: { limit: 120, windowMs: 60_000 },
  roomMutation: { limit: 40, windowMs: 60_000 },
  gameplayAction: { limit: 80, windowMs: 60_000 },
  joinRoom: { limit: 20, windowMs: 60_000 },
  createRoom: { limit: 10, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>

function cleanupExpiredBuckets(now: number) {
  if (buckets.size < 5000) return

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }
}

export function applyRateLimit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now()
  cleanupExpiredBuckets(now)

  const existing = buckets.get(key)
  const current =
    !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + rule.windowMs }
      : existing

  current.count += 1
  buckets.set(key, current)

  const remaining = Math.max(0, rule.limit - current.count)

  if (current.count > rule.limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    }
  }

  return {
    ok: true,
    remaining,
    resetAt: current.resetAt,
  }
}
