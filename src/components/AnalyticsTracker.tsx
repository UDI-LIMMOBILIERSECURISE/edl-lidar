'use client'

import { useEffect, useRef, useCallback } from 'react'
import {
  generateVisitorId,
  trackPageView,
  trackEvent,
  updateSessionDuration,
  endSession,
  EventType,
  TrackEventData,
} from '@/lib/analytics'

interface AnalyticsTrackerProps {
  tourId: string
  onViewIdReady?: (viewId: string) => void
}

// Heartbeat interval in ms (30 seconds)
const HEARTBEAT_INTERVAL = 30000

// Minimum session duration to track (2 seconds) - filter accidental clicks
const MIN_SESSION_DURATION = 2

export default function AnalyticsTracker({ tourId, onViewIdReady }: AnalyticsTrackerProps) {
  const viewIdRef = useRef<string | null>(null)
  const startTimeRef = useRef<number>(Date.now())
  const roomsVisitedRef = useRef<Set<string>>(new Set())
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isEndedRef = useRef(false)

  // Initialize tracking on mount
  useEffect(() => {
    const initTracking = async () => {
      const visitorId = generateVisitorId()
      const viewId = await trackPageView(tourId, visitorId)

      if (viewId) {
        viewIdRef.current = viewId
        onViewIdReady?.(viewId)

        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(async () => {
          if (viewIdRef.current && !isEndedRef.current) {
            const duration = (Date.now() - startTimeRef.current) / 1000
            await updateSessionDuration(
              viewIdRef.current,
              duration,
              Array.from(roomsVisitedRef.current)
            )
            // Track heartbeat event
            await trackEvent(viewIdRef.current, 'heartbeat', {
              durationSeconds: duration,
            })
          }
        }, HEARTBEAT_INTERVAL)
      }
    }

    initTracking()

    // Cleanup on unmount
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }

      // End session
      if (viewIdRef.current && !isEndedRef.current) {
        isEndedRef.current = true
        const duration = (Date.now() - startTimeRef.current) / 1000

        // Only track if session was meaningful
        if (duration >= MIN_SESSION_DURATION) {
          // Use sendBeacon for reliability on page unload
          const endData = {
            viewId: viewIdRef.current,
            durationSeconds: Math.round(duration),
            roomsVisited: Array.from(roomsVisitedRef.current),
          }

          // Try sendBeacon first (more reliable on page close)
          if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
            navigator.sendBeacon(
              '/api/analytics/session',
              JSON.stringify({ ...endData, action: 'end' })
            )
          } else {
            // Fallback to regular request
            endSession(
              viewIdRef.current,
              Math.round(duration),
              Array.from(roomsVisitedRef.current)
            )
          }
        }
      }
    }
  }, [tourId, onViewIdReady])

  // Handle page visibility change (tab switch, minimize)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden && viewIdRef.current) {
        // Page hidden - update duration
        const duration = (Date.now() - startTimeRef.current) / 1000
        await updateSessionDuration(
          viewIdRef.current,
          duration,
          Array.from(roomsVisitedRef.current)
        )
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Handle beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (viewIdRef.current && !isEndedRef.current) {
        isEndedRef.current = true
        const duration = (Date.now() - startTimeRef.current) / 1000

        if (duration >= MIN_SESSION_DURATION && navigator.sendBeacon) {
          navigator.sendBeacon(
            '/api/analytics/session',
            JSON.stringify({
              viewId: viewIdRef.current,
              durationSeconds: Math.round(duration),
              roomsVisited: Array.from(roomsVisitedRef.current),
              action: 'end',
            })
          )
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // This component doesn't render anything
  return null
}

// ============================================================================
// CUSTOM HOOKS FOR TRACKING
// ============================================================================

/**
 * Hook to track room changes
 */
export function useRoomTracking(viewId: string | null) {
  const lastRoomRef = useRef<string | null>(null)
  const roomEnterTimeRef = useRef<number | null>(null)

  const trackRoomChange = useCallback(
    async (roomId: string | null, roomName: string | null) => {
      if (!viewId) return

      // Exit previous room
      if (lastRoomRef.current && roomEnterTimeRef.current) {
        const timeInRoom = (Date.now() - roomEnterTimeRef.current) / 1000
        await trackEvent(viewId, 'room_exit', {
          roomId: lastRoomRef.current,
          timeInRoomSeconds: timeInRoom,
        })
      }

      // Enter new room
      if (roomId && roomName) {
        lastRoomRef.current = roomId
        roomEnterTimeRef.current = Date.now()
        await trackEvent(viewId, 'room_enter', {
          roomId,
          roomName,
        })
      } else {
        lastRoomRef.current = null
        roomEnterTimeRef.current = null
      }
    },
    [viewId]
  )

  return { trackRoomChange }
}

/**
 * Hook to track Lia interactions
 */
export function useLiaTracking(viewId: string | null) {
  const trackLiaOpen = useCallback(async () => {
    if (!viewId) return
    await trackEvent(viewId, 'lia_open')
  }, [viewId])

  const trackLiaClose = useCallback(async () => {
    if (!viewId) return
    await trackEvent(viewId, 'lia_close')
  }, [viewId])

  const trackLiaMessage = useCallback(
    async (messagePreview?: string) => {
      if (!viewId) return
      await trackEvent(viewId, 'lia_message', {
        // Only store first 50 chars for analytics, not full message (privacy)
        messagePreview: messagePreview?.slice(0, 50),
      })
    },
    [viewId]
  )

  return { trackLiaOpen, trackLiaClose, trackLiaMessage }
}

/**
 * Hook to track video events
 */
export function useVideoTracking(viewId: string | null) {
  const trackPlay = useCallback(
    async (videoTime: number) => {
      if (!viewId) return
      await trackEvent(viewId, 'play', { videoTime })
    },
    [viewId]
  )

  const trackPause = useCallback(
    async (videoTime: number) => {
      if (!viewId) return
      await trackEvent(viewId, 'pause', { videoTime })
    },
    [viewId]
  )

  const trackSeek = useCallback(
    async (fromTime: number, toTime: number) => {
      if (!viewId) return
      await trackEvent(viewId, 'seek', { fromTime, toTime })
    },
    [viewId]
  )

  const trackVideoEnd = useCallback(async () => {
    if (!viewId) return
    await trackEvent(viewId, 'video_end')
  }, [viewId])

  return { trackPlay, trackPause, trackSeek, trackVideoEnd }
}

/**
 * Hook to track misc interactions
 */
export function useInteractionTracking(viewId: string | null) {
  const trackShare = useCallback(
    async (method?: string) => {
      if (!viewId) return
      await trackEvent(viewId, 'share_click', { method })
    },
    [viewId]
  )

  const trackFullscreen = useCallback(
    async (entered: boolean) => {
      if (!viewId) return
      await trackEvent(viewId, 'fullscreen', { entered })
    },
    [viewId]
  )

  const trackCustomEvent = useCallback(
    async (eventType: EventType, data?: TrackEventData) => {
      if (!viewId) return
      await trackEvent(viewId, eventType, data)
    },
    [viewId]
  )

  return { trackShare, trackFullscreen, trackCustomEvent }
}
