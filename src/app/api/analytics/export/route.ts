import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

/**
 * GET /api/analytics/export
 * Export CSV des donnees analytics
 * Params: ?type=tours|views|lia&days=30
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

    // Recuperer le profil utilisateur
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('entity_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.entity_id) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Verifier le role
    if (!['entity_admin', 'agency_manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const exportType = searchParams.get('type') || 'tours'
    const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90)

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    let csvContent = ''
    let filename = ''

    // Recuperer les tours de l'entity
    const { data: entityTours } = await supabase
      .from('virtual_tours')
      .select('id')
      .eq('entity_id', profile.entity_id)

    const tourIds = entityTours?.map(t => t.id) || []

    switch (exportType) {
      case 'tours': {
        filename = `tours_export_${new Date().toISOString().split('T')[0]}.csv`
        csvContent = 'ID,Titre,Adresse,Statut,Public,Date creation,Vues totales\n'

        const { data: tours } = await supabase
          .from('virtual_tours')
          .select('id, title, address, status, is_public, created_at')
          .eq('entity_id', profile.entity_id)
          .order('created_at', { ascending: false })

        if (tours) {
          for (const tour of tours) {
            // Compter les vues pour ce tour
            const { count } = await supabase
              .from('tour_views')
              .select('*', { count: 'exact', head: true })
              .eq('tour_id', tour.id)
              .eq('is_bot', false)

            csvContent += `"${tour.id}","${escapeCsv(tour.title || '')}","${escapeCsv(tour.address || '')}","${tour.status}","${tour.is_public ? 'Oui' : 'Non'}","${tour.created_at}","${count || 0}"\n`
          }
        }
        break
      }

      case 'views': {
        filename = `views_export_${new Date().toISOString().split('T')[0]}.csv`
        csvContent = 'ID Session,Tour ID,Titre Tour,Date,Duree (sec),Appareil,Referrer,Visiteur unique\n'

        if (tourIds.length > 0) {
          const { data: views } = await supabase
            .from('tour_views')
            .select(`
              id,
              tour_id,
              visitor_id,
              started_at,
              duration_seconds,
              device_type,
              referrer
            `)
            .in('tour_id', tourIds)
            .gte('started_at', startDate.toISOString())
            .eq('is_bot', false)
            .order('started_at', { ascending: false })
            .limit(5000)

          // Map tour_id to title
          const { data: tourTitles } = await supabase
            .from('virtual_tours')
            .select('id, title')
            .eq('entity_id', profile.entity_id)

          const tourTitleMap: Record<string, string> = {}
          tourTitles?.forEach(t => {
            tourTitleMap[t.id] = t.title || 'Sans titre'
          })

          if (views) {
            for (const view of views) {
              csvContent += `"${view.id}","${view.tour_id}","${escapeCsv(tourTitleMap[view.tour_id] || '')}","${view.started_at}","${view.duration_seconds || 0}","${view.device_type || 'unknown'}","${escapeCsv(view.referrer || 'direct')}","${view.visitor_id?.substring(0, 8) || ''}"\n`
            }
          }
        }
        break
      }

      case 'lia': {
        filename = `lia_sessions_export_${new Date().toISOString().split('T')[0]}.csv`
        csvContent = 'Session ID,Tour ID,Titre Tour,Date debut,Nb messages,Visiteur\n'

        if (tourIds.length > 0) {
          const { data: sessions } = await supabase
            .from('lia_sessions')
            .select('id, tour_id, visitor_id, started_at')
            .in('tour_id', tourIds)
            .gte('started_at', startDate.toISOString())
            .order('started_at', { ascending: false })
            .limit(5000)

          // Map tour_id to title
          const { data: tourTitles } = await supabase
            .from('virtual_tours')
            .select('id, title')
            .eq('entity_id', profile.entity_id)

          const tourTitleMap: Record<string, string> = {}
          tourTitles?.forEach(t => {
            tourTitleMap[t.id] = t.title || 'Sans titre'
          })

          if (sessions) {
            for (const session of sessions) {
              // Compter les messages
              const { count } = await supabase
                .from('lia_messages')
                .select('*', { count: 'exact', head: true })
                .eq('session_id', session.id)

              csvContent += `"${session.id}","${session.tour_id}","${escapeCsv(tourTitleMap[session.tour_id] || '')}","${session.started_at}","${count || 0}","${session.visitor_id?.substring(0, 8) || ''}"\n`
            }
          }
        }
        break
      }

      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 })
    }

    // Retourner le CSV
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error) {
    console.error('[Analytics Export] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function escapeCsv(value: string): string {
  return value.replace(/"/g, '""')
}
