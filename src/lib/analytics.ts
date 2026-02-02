/**
 * Analytics Library for EDL LIDAR Public Tours
 *
 * Tracking anonyme RGPD compliant - pas de donnees personnelles
 * Gestion gracieuse des ad blockers
 */

import { getSupabase } from './supabase'
import type { Json } from '@/types/database'

// Types
export interface ViewMetadata {
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown'
  userAgent: string
  referrer: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
}

export interface TrackEventData {
  roomId?: string
  roomName?: string
  videoTime?: number
  messageContent?: string
  [key: string]: unknown
}

export type EventType =
  | 'room_enter'
  | 'room_exit'
  | 'lia_open'
  | 'lia_close'
  | 'lia_message'
  | 'share_click'
  | 'fullscreen'
  | 'play'
  | 'pause'
  | 'seek'
  | 'video_end'
  | 'heartbeat'

// Constants
const VISITOR_ID_KEY = 'edl_visitor_id'
const SESSION_ID_KEY = 'edl_session_id'
const VIEW_ID_KEY = 'edl_view_id'

// ============================================================================
// VISITOR ID GENERATION
// ============================================================================

/**
 * Generate a simple fingerprint-based visitor ID
 * Non-identifiable, just for analytics aggregation
 */
export function generateVisitorId(): string {
  // Check localStorage first
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(VISITOR_ID_KEY)
    if (stored) return stored

    // Generate new ID based on browser fingerprint
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
    ].join('|')

    // Simple hash function
    let hash = 0
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }

    // Add random component for uniqueness
    const visitorId = `v_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`

    try {
      localStorage.setItem(VISITOR_ID_KEY, visitorId)
    } catch {
      // localStorage blocked - continue without persistence
    }

    return visitorId
  }

  return `v_anon_${Date.now().toString(36)}`
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem(SESSION_ID_KEY)
    if (stored) return stored

    const sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

    try {
      sessionStorage.setItem(SESSION_ID_KEY, sessionId)
    } catch {
      // sessionStorage blocked
    }

    return sessionId
  }

  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// ============================================================================
// DEVICE DETECTION
// ============================================================================

/**
 * Detect device type from user agent
 */
export function detectDeviceType(): 'desktop' | 'mobile' | 'tablet' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown'

  const ua = navigator.userAgent.toLowerCase()

  // Check for tablets first (before mobile, as some tablets include "mobile")
  if (/ipad|tablet|playbook|silk/i.test(ua)) {
    return 'tablet'
  }

  // Check for mobile
  if (/android|webos|iphone|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua)) {
    return 'mobile'
  }

  // Default to desktop
  return 'desktop'
}

/**
 * Extract UTM parameters from URL
 */
export function extractUtmParams(): { source: string | null; medium: string | null; campaign: string | null } {
  if (typeof window === 'undefined') return { source: null, medium: null, campaign: null }

  const params = new URLSearchParams(window.location.search)
  return {
    source: params.get('utm_source'),
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
  }
}

/**
 * Detect if user is likely a bot
 */
export function isBot(): boolean {
  if (typeof window === 'undefined') return false

  const ua = navigator.userAgent.toLowerCase()
  const botPatterns = [
    'bot', 'crawler', 'spider', 'slurp', 'googlebot', 'bingbot',
    'yandex', 'baidu', 'duckduck', 'facebookexternalhit', 'linkedinbot',
    'twitterbot', 'whatsapp', 'telegram', 'headless', 'phantom', 'puppeteer'
  ]

  return botPatterns.some(pattern => ua.includes(pattern))
}

// ============================================================================
// TRACKING FUNCTIONS
// ============================================================================

/**
 * Track a page view and create a view session
 * Returns the view_id for subsequent event tracking
 */
export async function trackPageView(
  tourId: string,
  visitorId: string,
  metadata?: Partial<ViewMetadata>
): Promise<string | null> {
  try {
    const supabase = getSupabase()
    const sessionId = generateSessionId()
    const utm = extractUtmParams()

    const viewData = {
      tour_id: tourId,
      visitor_id: visitorId,
      session_id: sessionId,
      device_type: metadata?.deviceType || detectDeviceType(),
      user_agent: metadata?.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : null),
      referrer: metadata?.referrer || (typeof document !== 'undefined' ? document.referrer || null : null),
      utm_source: metadata?.utmSource || utm.source,
      utm_medium: metadata?.utmMedium || utm.medium,
      utm_campaign: metadata?.utmCampaign || utm.campaign,
      is_bot: isBot(),
    }

    const { data, error } = await supabase
      .from('tour_views')
      .insert(viewData)
      .select('id')
      .single()

    if (error) {
      console.warn('[Analytics] Failed to track page view:', error.message)
      return null
    }

    // Store view_id in session storage for subsequent events
    if (typeof sessionStorage !== 'undefined' && data?.id) {
      try {
        sessionStorage.setItem(VIEW_ID_KEY, data.id)
      } catch {
        // Blocked
      }
    }

    return data?.id || null
  } catch (err) {
    // Graceful failure - don't break the app
    console.warn('[Analytics] Error tracking page view:', err)
    return null
  }
}

/**
 * Track an event within a view session
 */
export async function trackEvent(
  viewId: string,
  eventType: EventType,
  data?: TrackEventData
): Promise<boolean> {
  try {
    const supabase = getSupabase()

    const { error } = await supabase
      .from('tour_events')
      .insert({
        view_id: viewId,
        event_type: eventType,
        event_data: (data || {}) as Json,
      })

    if (error) {
      console.warn('[Analytics] Failed to track event:', error.message)
      return false
    }

    return true
  } catch (err) {
    console.warn('[Analytics] Error tracking event:', err)
    return false
  }
}

/**
 * Batch track multiple events (for better performance)
 */
export async function trackEventsBatch(
  viewId: string,
  events: Array<{ type: EventType; data?: TrackEventData; timestamp?: Date }>
): Promise<boolean> {
  try {
    const supabase = getSupabase()

    const insertData = events.map(event => ({
      view_id: viewId,
      event_type: event.type,
      event_data: (event.data || {}) as Json,
      timestamp: event.timestamp?.toISOString() || new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('tour_events')
      .insert(insertData)

    if (error) {
      console.warn('[Analytics] Failed to batch track events:', error.message)
      return false
    }

    return true
  } catch (err) {
    console.warn('[Analytics] Error batch tracking events:', err)
    return false
  }
}

/**
 * End a view session - update duration and rooms visited
 */
export async function endSession(
  viewId: string,
  durationSeconds: number,
  roomsVisited: string[]
): Promise<boolean> {
  try {
    const supabase = getSupabase()

    const { error } = await supabase
      .from('tour_views')
      .update({
        ended_at: new Date().toISOString(),
        duration_seconds: Math.round(durationSeconds),
        rooms_visited: roomsVisited,
      })
      .eq('id', viewId)

    if (error) {
      console.warn('[Analytics] Failed to end session:', error.message)
      return false
    }

    return true
  } catch (err) {
    console.warn('[Analytics] Error ending session:', err)
    return false
  }
}

/**
 * Update session duration (heartbeat)
 */
export async function updateSessionDuration(
  viewId: string,
  durationSeconds: number,
  roomsVisited: string[]
): Promise<boolean> {
  try {
    const supabase = getSupabase()

    const { error } = await supabase
      .from('tour_views')
      .update({
        duration_seconds: Math.round(durationSeconds),
        rooms_visited: roomsVisited,
      })
      .eq('id', viewId)

    if (error) {
      console.warn('[Analytics] Failed to update duration:', error.message)
      return false
    }

    return true
  } catch (err) {
    console.warn('[Analytics] Error updating duration:', err)
    return false
  }
}

// ============================================================================
// API ROUTE HELPERS (for use via fetch instead of direct Supabase)
// ============================================================================

/**
 * Track via API route (for ad-blocker resilience)
 */
export async function trackViaApi(
  endpoint: '/api/analytics/session' | '/api/analytics/track',
  method: 'POST' | 'PUT',
  body: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown }> {
  try {
    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // Don't send credentials to avoid CORS issues
      credentials: 'omit',
    })

    if (!response.ok) {
      return { success: false }
    }

    const data = await response.json()
    return { success: true, data }
  } catch {
    return { success: false }
  }
}

/**
 * Get current view ID from session storage
 */
export function getCurrentViewId(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage.getItem(VIEW_ID_KEY)
}

/**
 * Clear session (for testing or forced reset)
 */
export function clearSession(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(SESSION_ID_KEY)
    sessionStorage.removeItem(VIEW_ID_KEY)
  }
}
