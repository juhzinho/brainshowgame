import { NextResponse } from 'next/server'
import { isPersistentStorageEnabled } from '@/lib/storage'
import { isAblyConfigured } from '@/lib/ably'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    runtime: 'nodejs',
    storage: isPersistentStorageEnabled() ? 'redis' : 'memory',
    realtime: isAblyConfigured() ? 'ably' : 'polling',
  })
}
