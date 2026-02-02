import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

interface ViewsByDay {
  date: string
  views: number
  unique_visitors: number
}

interface RoomPopularity {
  room_id: string
  room_name: string
  percentage: number
  avg_time_seconds: number
}

interface ReferrerStat {
  referrer: string
  count: number
}

interface DeviceBreakdown {
  mobile: number
  desktop: number
  tablet: number
}

interface LiaStats {
  total_sessions: number
  total_messages: number
  avg_messages_per_session: number
  top_questions: Array<{ question: string; count: number }>
}

interface AnalyticsResponse {
  total_views: number
  unique_visitors: number
  avg_duration_seconds: number
  views_by_day: ViewsByDay[]
  rooms_popularity: RoomPopularity[]
  top_referrers: ReferrerStat[]
  device_breakdown: DeviceBreakdown
  lia_stats: LiaStats
}

// GET - Recuperer les analytics pour une visite
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tourId = params.id
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30', 10)

  try {
    const supabase = createServerClient()

    // Verifier que le tour existe
    const { data: tour, error: tourError } = await supabase
      .from('virtual_tours')
      .select('id, title')
      .eq('id', tourId)
      .single()

    if (tourError || !tour) {
      return NextResponse.json({ error: 'Tour non trouve' }, { status: 404 })
    }

    // Calculer la date de debut
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString()

    // 1. Total des vues et visiteurs uniques
    const { data: viewsData } = await supabase
      .from('tour_views')
      .select('id, visitor_id, duration_seconds, device_type, referrer, started_at')
      .eq('tour_id', tourId)
      .gte('started_at', startDateStr)

    const views = viewsData || []
    const totalViews = views.length
    const uniqueVisitorIds = new Set(views.map(v => v.visitor_id).filter(Boolean))
    const uniqueVisitors = uniqueVisitorIds.size || totalViews

    // 2. Duree moyenne
    const durationsWithValue = views.filter(v => v.duration_seconds && v.duration_seconds > 0)
    const avgDuration = durationsWithValue.length > 0
      ? Math.round(durationsWithValue.reduce((sum, v) => sum + (v.duration_seconds || 0), 0) / durationsWithValue.length)
      : 0

    // 3. Vues par jour
    const viewsByDayMap = new Map<string, { views: number; visitors: Set<string> }>()

    // Initialiser tous les jours de la periode
    for (let i = 0; i < days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - (days - 1 - i))
      const dateKey = date.toISOString().split('T')[0]
      viewsByDayMap.set(dateKey, { views: 0, visitors: new Set() })
    }

    // Remplir avec les donnees reelles
    views.forEach(v => {
      const dateKey = new Date(v.started_at).toISOString().split('T')[0]
      const dayData = viewsByDayMap.get(dateKey) || { views: 0, visitors: new Set<string>() }
      dayData.views++
      if (v.visitor_id) {
        dayData.visitors.add(v.visitor_id)
      }
      viewsByDayMap.set(dateKey, dayData)
    })

    const viewsByDay: ViewsByDay[] = Array.from(viewsByDayMap.entries()).map(([date, data]) => ({
      date,
      views: data.views,
      unique_visitors: data.visitors.size || data.views
    }))

    // 4. Popularite des pieces - basee sur les events room_enter/room_exit
    const viewIds = views.map(v => v.id)

    // Recuperer les events de type room_enter pour calculer le temps passe
    const { data: eventsData } = viewIds.length > 0 ? await supabase
      .from('tour_events')
      .select('view_id, event_type, event_data, timestamp')
      .in('view_id', viewIds)
      .in('event_type', ['room_enter', 'room_exit'])
      .order('timestamp', { ascending: true }) : { data: [] }

    const { data: roomsData } = await supabase
      .from('tour_rooms')
      .select('id, name')
      .eq('tour_id', tourId)

    const roomsMap = new Map<string, string>((roomsData || []).map(r => [r.id, r.name]))
    const roomTimeMap = new Map<string, { total: number; count: number }>()

    // Calculer le temps passe dans chaque piece par session
    const sessionRoomEvents = new Map<string, Array<{ type: string; roomId: string; time: Date }>>()

    ;(eventsData || []).forEach(e => {
      const eventData = e.event_data as { room_id?: string } | null
      const roomId = eventData?.room_id
      if (!roomId) return

      const sessionEvents = sessionRoomEvents.get(e.view_id) || []
      sessionEvents.push({
        type: e.event_type,
        roomId,
        time: new Date(e.timestamp)
      })
      sessionRoomEvents.set(e.view_id, sessionEvents)
    })

    // Pour chaque session, calculer le temps passe par piece
    sessionRoomEvents.forEach(events => {
      let currentRoom: string | null = null
      let enterTime: Date | null = null

      events.forEach(event => {
        if (event.type === 'room_enter') {
          // Si on etait dans une autre piece, on la ferme
          if (currentRoom && enterTime) {
            const duration = (event.time.getTime() - enterTime.getTime()) / 1000
            if (duration > 0 && duration < 3600) { // Max 1h par piece
              const existing = roomTimeMap.get(currentRoom) || { total: 0, count: 0 }
              existing.total += duration
              existing.count++
              roomTimeMap.set(currentRoom, existing)
            }
          }
          currentRoom = event.roomId
          enterTime = event.time
        } else if (event.type === 'room_exit' && currentRoom === event.roomId && enterTime) {
          const duration = (event.time.getTime() - enterTime.getTime()) / 1000
          if (duration > 0 && duration < 3600) {
            const existing = roomTimeMap.get(currentRoom) || { total: 0, count: 0 }
            existing.total += duration
            existing.count++
            roomTimeMap.set(currentRoom, existing)
          }
          currentRoom = null
          enterTime = null
        }
      })
    })

    const totalRoomTime = Array.from(roomTimeMap.values()).reduce((sum, r) => sum + r.total, 0)

    const roomsPopularity: RoomPopularity[] = Array.from(roomTimeMap.entries())
      .map(([roomId, data]) => ({
        room_id: roomId,
        room_name: roomsMap.get(roomId) || 'Inconnu',
        percentage: totalRoomTime > 0 ? Math.round((data.total / totalRoomTime) * 100) : 0,
        avg_time_seconds: data.count > 0 ? Math.round(data.total / data.count) : 0
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 10)

    // 5. Top referrers
    const referrerMap = new Map<string, number>()
    views.forEach(v => {
      const ref = v.referrer || 'Direct'
      referrerMap.set(ref, (referrerMap.get(ref) || 0) + 1)
    })

    const topReferrers: ReferrerStat[] = Array.from(referrerMap.entries())
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // 6. Repartition par device
    const deviceBreakdown: DeviceBreakdown = {
      mobile: 0,
      desktop: 0,
      tablet: 0
    }
    views.forEach(v => {
      const deviceType = (v.device_type || 'desktop').toLowerCase()
      if (deviceType === 'mobile') {
        deviceBreakdown.mobile++
      } else if (deviceType === 'tablet') {
        deviceBreakdown.tablet++
      } else {
        deviceBreakdown.desktop++
      }
    })

    // 7. Stats Lia
    const { data: liaSessions } = await supabase
      .from('lia_sessions')
      .select('id, message_count')
      .eq('tour_id', tourId)
      .gte('started_at', startDateStr)

    const totalLiaSessions = (liaSessions || []).length
    const totalLiaMessages = (liaSessions || []).reduce((sum, s) => sum + (s.message_count || 0), 0)

    // Top questions Lia
    let topQuestions: Array<{ question: string; count: number }> = []
    if (liaSessions && liaSessions.length > 0) {
      const { data: liaMessages } = await supabase
        .from('lia_messages')
        .select('content, session_id')
        .eq('role', 'user')
        .in('session_id', liaSessions.map(s => s.id))

      const questionMap = new Map<string, number>()
      ;(liaMessages || []).forEach(m => {
        // Normaliser la question (minuscules, sans ponctuation finale)
        const normalized = m.content.toLowerCase().trim().replace(/[?!.]+$/, '')
        if (normalized.length > 5 && normalized.length < 100) {
          questionMap.set(normalized, (questionMap.get(normalized) || 0) + 1)
        }
      })

      topQuestions = Array.from(questionMap.entries())
        .map(([question, count]) => ({ question, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    }

    const liaStats: LiaStats = {
      total_sessions: totalLiaSessions,
      total_messages: totalLiaMessages,
      avg_messages_per_session: totalLiaSessions > 0 ? Math.round(totalLiaMessages / totalLiaSessions * 10) / 10 : 0,
      top_questions: topQuestions
    }

    const response: AnalyticsResponse = {
      total_views: totalViews,
      unique_visitors: uniqueVisitors,
      avg_duration_seconds: avgDuration,
      views_by_day: viewsByDay,
      rooms_popularity: roomsPopularity,
      top_referrers: topReferrers,
      device_breakdown: deviceBreakdown,
      lia_stats: liaStats
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Erreur analytics:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
