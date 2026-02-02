import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

/**
 * GET /api/cron/weekly-digest
 *
 * Endpoint pour cron job - genere et envoie les digests hebdomadaires
 * A appeler via Vercel Cron ou service externe (chaque lundi matin)
 *
 * Headers requis:
 * - Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  try {
    // Verifier l'autorisation du cron job
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('[Weekly Digest] CRON_SECRET not configured')
      return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 jours

    // Recuperer tous les utilisateurs avec digest email active
    // Note: Cast as any car les types seront regeneres apres migration
    const { data: users, error: usersError } = await (supabase as any)
      .from('notification_preferences')
      .select('user_id, email_weekly_digest')
      .eq('email_weekly_digest', true)

    if (usersError) {
      console.error('[Weekly Digest] Error fetching users:', usersError.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users with digest enabled',
        processed: 0,
      })
    }

    const results: { userId: string; success: boolean; error?: string }[] = []

    // Traiter chaque utilisateur
    for (const userPref of users) {
      try {
        // Recuperer le profil utilisateur et son entity
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, entity_id')
          .eq('id', userPref.user_id)
          .single()

        if (profileError || !profile) {
          results.push({
            userId: userPref.user_id,
            success: false,
            error: 'Profile not found',
          })
          continue
        }

        // Generer les stats du digest
        const digestData = await generateDigestData(supabase as any, profile.entity_id, startDate)

        if (!digestData) {
          results.push({
            userId: userPref.user_id,
            success: false,
            error: 'Failed to generate digest data',
          })
          continue
        }

        // Creer une notification in-app avec le digest
        // Note: Cast as any car les types seront regeneres apres migration
        const { error: notifError } = await (supabase as any)
          .from('notifications')
          .insert({
            user_id: userPref.user_id,
            entity_id: profile.entity_id,
            type: 'weekly_digest',
            title: 'Votre digest hebdomadaire',
            message: formatDigestMessage(digestData),
            data: digestData,
            link: '/dashboard',
          })

        if (notifError) {
          results.push({
            userId: userPref.user_id,
            success: false,
            error: notifError.message,
          })
          continue
        }

        // TODO: Envoyer email via Resend ou autre service
        // await sendDigestEmail(profile.email, digestData)

        results.push({
          userId: userPref.user_id,
          success: true,
        })
      } catch (err) {
        console.error(`[Weekly Digest] Error processing user ${userPref.user_id}:`, err)
        results.push({
          userId: userPref.user_id,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} users`,
      processed: results.length,
      success_count: successCount,
      fail_count: failCount,
      details: results,
    })
  } catch (err) {
    console.error('[Weekly Digest] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Types pour le digest
interface DigestData {
  period_start: string
  period_end: string
  total_views: number
  unique_visitors: number
  lia_questions: number
  top_tours: Array<{
    tour_id: string
    title: string
    views: number
  }>
  comparison: {
    views_change: number
    visitors_change: number
  }
}

// Generer les donnees du digest
async function generateDigestData(
  supabase: any,
  entityId: string,
  startDate: Date
): Promise<DigestData | null> {
  try {
    const endDate = new Date()
    const prevStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Stats de cette semaine via requete SQL directe (plus fiable)
    const { data: currentStats, error: currentError } = await supabase
      .from('tour_views')
      .select('id, visitor_id, tour_id')
      .gte('started_at', startDate.toISOString())
      .lt('started_at', endDate.toISOString())
      .eq('is_bot', false)

    // Filtrer par entity via les tours
    const { data: entityTours } = await supabase
      .from('virtual_tours')
      .select('id')
      .eq('entity_id', entityId)

    const tourIds = new Set((entityTours || []).map((t: any) => t.id))
    const filteredCurrentStats = (currentStats || []).filter((v: any) => tourIds.has(v.tour_id))

    // Stats semaine precedente
    const { data: prevStats } = await supabase
      .from('tour_views')
      .select('id, visitor_id, tour_id')
      .gte('started_at', prevStartDate.toISOString())
      .lt('started_at', startDate.toISOString())
      .eq('is_bot', false)

    const filteredPrevStats = (prevStats || []).filter((v: any) => tourIds.has(v.tour_id))

    // Questions Lia cette semaine
    const { count: liaCount } = await supabase
      .from('tour_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'lia_message')
      .gte('timestamp', startDate.toISOString())

    // Top tours
    const { data: topTours } = await supabase
      .from('virtual_tours')
      .select('id, title')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(5)

    // Compter les vues par tour
    const viewsByTour: Record<string, number> = {}
    for (const view of filteredCurrentStats) {
      viewsByTour[view.tour_id] = (viewsByTour[view.tour_id] || 0) + 1
    }

    const topToursWithViews = (topTours || []).map((t: any) => ({
      tour_id: t.id,
      title: t.title,
      views: viewsByTour[t.id] || 0,
    })).sort((a: any, b: any) => b.views - a.views)

    const currentViews = filteredCurrentStats.length
    const currentVisitors = new Set(filteredCurrentStats.map((v: any) => v.visitor_id)).size
    const prevViews = filteredPrevStats.length
    const prevVisitors = new Set(filteredPrevStats.map((v: any) => v.visitor_id)).size

    // Calculer les changements en pourcentage
    const viewsChange = prevViews > 0 ? ((currentViews - prevViews) / prevViews) * 100 : 0
    const visitorsChange = prevVisitors > 0 ? ((currentVisitors - prevVisitors) / prevVisitors) * 100 : 0

    return {
      period_start: startDate.toISOString(),
      period_end: endDate.toISOString(),
      total_views: currentViews,
      unique_visitors: currentVisitors,
      lia_questions: liaCount || 0,
      top_tours: topToursWithViews,
      comparison: {
        views_change: Math.round(viewsChange),
        visitors_change: Math.round(visitorsChange),
      },
    }
  } catch (err) {
    console.error('[Weekly Digest] Error generating data:', err)
    return null
  }
}

// Formater le message du digest
function formatDigestMessage(data: DigestData): string {
  const parts: string[] = []

  parts.push(`Cette semaine: ${data.total_views} vues, ${data.unique_visitors} visiteurs uniques.`)

  if (data.comparison.views_change !== 0) {
    const trend = data.comparison.views_change > 0 ? '+' : ''
    parts.push(`Evolution: ${trend}${data.comparison.views_change}% par rapport a la semaine precedente.`)
  }

  if (data.lia_questions > 0) {
    parts.push(`${data.lia_questions} question${data.lia_questions > 1 ? 's' : ''} posee${data.lia_questions > 1 ? 's' : ''} a Lia.`)
  }

  return parts.join(' ')
}

// Configuration Vercel Cron (a ajouter dans vercel.json)
// {
//   "crons": [{
//     "path": "/api/cron/weekly-digest",
//     "schedule": "0 8 * * 1"
//   }]
// }
