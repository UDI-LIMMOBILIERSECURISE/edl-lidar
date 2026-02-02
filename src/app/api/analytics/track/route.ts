import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import type { Json } from '@/types/database'

// Valid event types
const VALID_EVENT_TYPES = [
  'room_enter',
  'room_exit',
  'lia_open',
  'lia_close',
  'lia_message',
  'share_click',
  'fullscreen',
  'play',
  'pause',
  'seek',
  'video_end',
  'heartbeat',
] as const

type EventType = (typeof VALID_EVENT_TYPES)[number]

// Rate limiting map
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const RATE_LIMIT_MAX = 120 // 120 events per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return false
  }

  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  return 'unknown'
}

function isValidEventType(type: string): type is EventType {
  return VALID_EVENT_TYPES.includes(type as EventType)
}

/**
 * POST /api/analytics/track
 * Track a single event or batch of events
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }

    const body = await request.json()

    // Support both single event and batch
    const events = Array.isArray(body) ? body : [body]

    if (events.length === 0) {
      return NextResponse.json({ error: 'No events provided' }, { status: 400 })
    }

    // Limit batch size
    if (events.length > 50) {
      return NextResponse.json(
        { error: 'Batch size exceeds maximum of 50 events' },
        { status: 400 }
      )
    }

    // Validate and sanitize events
    const sanitizedEvents: Array<{
      view_id: string
      event_type: EventType
      event_data: Json
      timestamp?: string
    }> = []

    for (const event of events) {
      const { viewId, eventType, data, timestamp } = event

      if (!viewId || typeof viewId !== 'string') {
        continue // Skip invalid events
      }

      if (!eventType || !isValidEventType(eventType)) {
        continue // Skip invalid event types
      }

      // Sanitize event data - remove any potentially sensitive info
      const sanitizedData: { [key: string]: string | number | boolean } = {}
      if (data && typeof data === 'object') {
        for (const [key, value] of Object.entries(data)) {
          // Skip sensitive-looking keys
          if (/password|token|key|secret|auth|cookie/i.test(key)) {
            continue
          }

          // Limit string values
          if (typeof value === 'string') {
            sanitizedData[key] = value.slice(0, 200)
          } else if (typeof value === 'number' || typeof value === 'boolean') {
            sanitizedData[key] = value
          }
          // Skip complex nested objects for safety
        }
      }

      sanitizedEvents.push({
        view_id: viewId,
        event_type: eventType,
        event_data: sanitizedData as Json,
        timestamp: timestamp ? new Date(timestamp).toISOString() : undefined,
      })
    }

    if (sanitizedEvents.length === 0) {
      return NextResponse.json({ error: 'No valid events to track' }, { status: 400 })
    }

    const supabase = createServerClient()

    const { error } = await supabase
      .from('tour_events')
      .insert(sanitizedEvents)

    if (error) {
      console.error('[Analytics API] Error tracking events:', error)
      return NextResponse.json({ error: 'Failed to track events' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      tracked: sanitizedEvents.length,
    })
  } catch (error) {
    console.error('[Analytics API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
