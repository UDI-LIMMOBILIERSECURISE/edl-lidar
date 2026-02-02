import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Rate limiting map (in-memory, resets on server restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const RATE_LIMIT_MAX = 60 // 60 requests per minute per IP

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
  // Check common headers for real IP (behind proxies/load balancers)
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

/**
 * POST /api/analytics/session
 * Create a new view session or end an existing one
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)

    // Rate limiting
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { action, tourId, visitorId, viewId, durationSeconds, roomsVisited, ...metadata } = body

    const supabase = createServerClient()

    // Handle session end (via sendBeacon)
    if (action === 'end' && viewId) {
      const { error } = await supabase
        .from('tour_views')
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: Math.round(durationSeconds || 0),
          rooms_visited: roomsVisited || [],
        })
        .eq('id', viewId)

      if (error) {
        console.error('[Analytics API] Error ending session:', error)
        return NextResponse.json({ error: 'Failed to end session' }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    // Create new session
    if (!tourId || !visitorId) {
      return NextResponse.json(
        { error: 'Missing required fields: tourId, visitorId' },
        { status: 400 }
      )
    }

    // Verify tour exists and is public
    const { data: tour, error: tourError } = await supabase
      .from('virtual_tours')
      .select('id, is_public')
      .eq('id', tourId)
      .single()

    if (tourError || !tour) {
      return NextResponse.json({ error: 'Tour not found' }, { status: 404 })
    }

    if (!tour.is_public) {
      return NextResponse.json({ error: 'Tour is not public' }, { status: 403 })
    }

    // Generate session ID
    const sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

    // Detect if bot from user agent
    const userAgent = request.headers.get('user-agent') || ''
    const botPatterns = ['bot', 'crawler', 'spider', 'slurp', 'googlebot', 'bingbot', 'headless']
    const isBot = botPatterns.some(pattern => userAgent.toLowerCase().includes(pattern))

    // Insert view
    const { data: viewData, error: insertError } = await supabase
      .from('tour_views')
      .insert({
        tour_id: tourId,
        visitor_id: visitorId,
        session_id: sessionId,
        device_type: metadata.deviceType || 'unknown',
        user_agent: userAgent.slice(0, 500), // Limit length
        referrer: metadata.referrer?.slice(0, 500) || null,
        utm_source: metadata.utmSource?.slice(0, 100) || null,
        utm_medium: metadata.utmMedium?.slice(0, 100) || null,
        utm_campaign: metadata.utmCampaign?.slice(0, 100) || null,
        is_bot: isBot,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[Analytics API] Error creating session:', insertError)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      viewId: viewData.id,
      sessionId,
    })
  } catch (error) {
    console.error('[Analytics API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/analytics/session
 * Update session duration (heartbeat)
 */
export async function PUT(request: NextRequest) {
  try {
    const ip = getClientIp(request)

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { viewId, durationSeconds, roomsVisited } = body

    if (!viewId) {
      return NextResponse.json({ error: 'Missing viewId' }, { status: 400 })
    }

    const supabase = createServerClient()

    const { error } = await supabase
      .from('tour_views')
      .update({
        duration_seconds: Math.round(durationSeconds || 0),
        rooms_visited: roomsVisited || [],
      })
      .eq('id', viewId)

    if (error) {
      console.error('[Analytics API] Error updating session:', error)
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
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
      'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
