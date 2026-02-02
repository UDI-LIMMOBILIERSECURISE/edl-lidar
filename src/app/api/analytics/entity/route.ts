import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

interface AnalyticsResult {
  total_views: number
  unique_visitors: number
  avg_duration_seconds: number
  top_tours: Array<{ tour_id: string; title: string; views: number }> | null
  views_by_day: Array<{ date: string; views: number }> | null
}

/**
 * GET /api/analytics/entity
 * Retourne les analytics globales de l'entity
 * Params: ?days=30
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()

    // Verifier l'authentification
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Recuperer le profil utilisateur pour entity_id et role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('entity_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.entity_id) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Verifier le role (admin ou manager)
    if (!['entity_admin', 'agency_manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parametre days
    const { searchParams } = new URL(request.url)
    const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90)

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const endDate = new Date()

    // Utiliser la fonction SQL get_entity_analytics
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: baseAnalytics, error: analyticsError } = await (supabase as any)
      .rpc('get_entity_analytics', {
        p_entity_id: profile.entity_id,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      })

    if (analyticsError) {
      console.error('[Entity Analytics] Error:', analyticsError)
      // Continuer avec des valeurs par defaut si la fonction n'existe pas
    }

    const analytics: AnalyticsResult = baseAnalytics?.[0] || {
      total_views: 0,
      unique_visitors: 0,
      avg_duration_seconds: 0,
      top_tours: null,
      views_by_day: null
    }

    // Requete supplementaire pour le nombre total de tours
    const { count: totalTours } = await supabase
      .from('virtual_tours')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', profile.entity_id)

    // Recuperer les IDs des tours de l'entity
    const { data: entityToursData } = await supabase
      .from('virtual_tours')
      .select('id')
      .eq('entity_id', profile.entity_id)

    const tourIds = entityToursData?.map(t => t.id) || []

    // Sessions Lia
    let totalLiaSessions = 0
    let totalLiaMessages = 0

    if (tourIds.length > 0) {
      const { data: liaStats } = await supabase
        .from('lia_sessions')
        .select('id, tour_id')
        .in('tour_id', tourIds)
        .gte('started_at', startDate.toISOString())
        .lte('started_at', endDate.toISOString())

      totalLiaSessions = liaStats?.length || 0

      // Messages Lia (via sessions)
      const sessionIds = liaStats?.map(s => s.id) || []
      if (sessionIds.length > 0) {
        const { count } = await supabase
          .from('lia_messages')
          .select('*', { count: 'exact', head: true })
          .in('session_id', sessionIds)

        totalLiaMessages = count || 0
      }
    }

    // Device breakdown global
    const deviceBreakdown = {
      desktop: 0,
      mobile: 0,
      tablet: 0,
      unknown: 0
    }

    if (tourIds.length > 0) {
      const { data: deviceData } = await supabase
        .from('tour_views')
        .select('device_type')
        .in('tour_id', tourIds)
        .gte('started_at', startDate.toISOString())
        .lte('started_at', endDate.toISOString())
        .eq('is_bot', false)

      deviceData?.forEach(row => {
        const type = row.device_type as keyof typeof deviceBreakdown
        if (type && type in deviceBreakdown) {
          deviceBreakdown[type]++
        }
      })
    }

    // Top referrers global
    const referrerCounts: Record<string, number> = {}

    if (tourIds.length > 0) {
      const { data: referrerData } = await supabase
        .from('tour_views')
        .select('referrer')
        .in('tour_id', tourIds)
        .gte('started_at', startDate.toISOString())
        .lte('started_at', endDate.toISOString())
        .eq('is_bot', false)

      referrerData?.forEach(row => {
        const ref = row.referrer || 'direct'
        referrerCounts[ref] = (referrerCounts[ref] || 0) + 1
      })
    }

    const topReferrers = Object.entries(referrerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([referrer, count]) => ({ referrer, count }))

    // Stats par agence - via la table agencies liee a l'entity
    const viewsByAgency: Array<{ name: string; tours: number; views: number; liaSessions: number }> = []

    const { data: agencies } = await supabase
      .from('agencies')
      .select('id, name')
      .eq('entity_id', profile.entity_id)

    if (agencies && agencies.length > 0) {
      for (const agency of agencies) {
        // Compter les tours de cette agence (via user_profiles)
        const { data: agencyUsers } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('agency_id', agency.id)

        const agencyUserIds = agencyUsers?.map(u => u.id) || []

        let agencyTours = 0
        let agencyViews = 0

        if (agencyUserIds.length > 0) {
          const { count: tourCount } = await supabase
            .from('virtual_tours')
            .select('*', { count: 'exact', head: true })
            .in('user_id', agencyUserIds)

          agencyTours = tourCount || 0

          // Vues pour les tours de cette agence
          const { data: agencyTourIds } = await supabase
            .from('virtual_tours')
            .select('id')
            .in('user_id', agencyUserIds)

          if (agencyTourIds && agencyTourIds.length > 0) {
            const { count: viewCount } = await supabase
              .from('tour_views')
              .select('*', { count: 'exact', head: true })
              .in('tour_id', agencyTourIds.map(t => t.id))
              .gte('started_at', startDate.toISOString())
              .eq('is_bot', false)

            agencyViews = viewCount || 0
          }
        }

        viewsByAgency.push({
          name: agency.name,
          tours: agencyTours,
          views: agencyViews,
          liaSessions: 0 // Simplification pour eviter trop de requetes
        })
      }
    }

    return NextResponse.json({
      total_tours: totalTours || 0,
      total_views: analytics.total_views || 0,
      total_unique_visitors: analytics.unique_visitors || 0,
      avg_duration_seconds: Math.round(analytics.avg_duration_seconds || 0),
      total_lia_sessions: totalLiaSessions,
      total_lia_messages: totalLiaMessages,
      views_by_day: analytics.views_by_day || [],
      top_tours: (analytics.top_tours || []).slice(0, 5),
      device_breakdown: deviceBreakdown,
      top_referrers: topReferrers,
      views_by_agency: viewsByAgency,
      period: {
        days,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      }
    })
  } catch (error) {
    console.error('[Entity Analytics] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
