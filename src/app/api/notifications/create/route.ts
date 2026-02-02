import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

/**
 * POST /api/notifications/create
 * Creer une notification (usage interne/serveur)
 *
 * Securise par service role key
 */
export async function POST(request: NextRequest) {
  try {
    // Verifier l'API key pour les appels internes
    const apiKey = request.headers.get('x-api-key')
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Autoriser soit via API key, soit via header interne
    const isInternal = request.headers.get('x-internal-call') === 'true'

    if (!isInternal && apiKey !== serviceKey) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, entityId, type, title, message, data, link } = body

    // Validation
    if (!userId || !entityId || !type || !title || !message) {
      return NextResponse.json(
        { error: 'Champs requis: userId, entityId, type, title, message' },
        { status: 400 }
      )
    }

    const validTypes = [
      'new_visitor',
      'milestone_views',
      'lia_question',
      'weekly_digest',
      'quota_warning',
      'team_invite',
      'tour_published',
      'system',
    ]

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Type invalide. Types valides: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const serviceClient = createServerClient()

    // Verifier les preferences utilisateur
    // Note: Cast as any car les types seront regeneres apres migration
    const { data: prefs } = await (serviceClient as any)
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Verifier si l'utilisateur veut ce type de notification (app)
    let shouldCreate = true
    if (prefs) {
      switch (type) {
        case 'new_visitor':
          shouldCreate = prefs.app_new_visitor !== false
          break
        case 'milestone_views':
          shouldCreate = prefs.app_milestone_views !== false
          break
        case 'lia_question':
          shouldCreate = prefs.app_lia_question !== false
          break
        case 'quota_warning':
          shouldCreate = prefs.app_quota_warning !== false
          break
        default:
          shouldCreate = true
      }
    }

    if (!shouldCreate) {
      return NextResponse.json({
        id: null,
        skipped: true,
        reason: 'User preferences disabled for this notification type',
      })
    }

    // Creer la notification
    // Note: Cast as any car les types seront regeneres apres migration
    const { data: notification, error } = await (serviceClient as any)
      .from('notifications')
      .insert({
        user_id: userId,
        entity_id: entityId,
        type,
        title,
        message,
        data: data || {},
        link: link || null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[API Notifications Create] Error:', error.message)
      return NextResponse.json({ error: 'Erreur creation notification' }, { status: 500 })
    }

    return NextResponse.json({ id: notification.id })
  } catch (err) {
    console.error('[API Notifications Create] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
