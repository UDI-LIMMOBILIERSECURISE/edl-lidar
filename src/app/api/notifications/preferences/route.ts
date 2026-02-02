import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

function getAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(supabaseUrl, supabaseAnonKey)
}

/**
 * GET /api/notifications/preferences
 * Recuperer les preferences de notification de l'utilisateur
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getAuthClient()

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    // Note: Cast as any car les types seront regeneres apres migration
    const serviceClient = createServerClient() as any

    const { data, error } = await serviceClient
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('[API Notifications Preferences] Error:', error.message)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    // Si pas de preferences, retourner les valeurs par defaut
    if (!data) {
      return NextResponse.json({
        preferences: {
          user_id: user.id,
          app_new_visitor: true,
          app_milestone_views: true,
          app_lia_question: true,
          app_quota_warning: true,
          email_new_visitor: false,
          email_weekly_digest: true,
          email_milestone_views: false,
          email_quota_warning: true,
          threshold_views: 100,
          threshold_quota_percent: 80,
          quiet_hours_start: null,
          quiet_hours_end: null,
        },
        isDefault: true,
      })
    }

    return NextResponse.json({
      preferences: data,
      isDefault: false,
    })
  } catch (err) {
    console.error('[API Notifications Preferences] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PUT /api/notifications/preferences
 * Mettre a jour les preferences de notification
 *
 * Body: Partial<NotificationPreferences>
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = getAuthClient()

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await request.json()

    // Valider les champs autorises
    const allowedFields = [
      'app_new_visitor',
      'app_milestone_views',
      'app_lia_question',
      'app_quota_warning',
      'email_new_visitor',
      'email_weekly_digest',
      'email_milestone_views',
      'email_quota_warning',
      'threshold_views',
      'threshold_quota_percent',
      'quiet_hours_start',
      'quiet_hours_end',
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    // Valider threshold_views
    if (updates.threshold_views !== undefined) {
      const threshold = Number(updates.threshold_views)
      if (isNaN(threshold) || threshold < 1 || threshold > 10000) {
        return NextResponse.json(
          { error: 'threshold_views doit etre entre 1 et 10000' },
          { status: 400 }
        )
      }
      updates.threshold_views = threshold
    }

    // Valider threshold_quota_percent
    if (updates.threshold_quota_percent !== undefined) {
      const percent = Number(updates.threshold_quota_percent)
      if (isNaN(percent) || percent < 50 || percent > 95) {
        return NextResponse.json(
          { error: 'threshold_quota_percent doit etre entre 50 et 95' },
          { status: 400 }
        )
      }
      updates.threshold_quota_percent = percent
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucun champ valide a mettre a jour' }, { status: 400 })
    }

    // Note: Cast as any car les types seront regeneres apres migration
    const serviceClient = createServerClient() as any

    // Upsert pour creer si n'existe pas
    const { data, error } = await serviceClient
      .from('notification_preferences')
      .upsert(
        {
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error) {
      console.error('[API Notifications Preferences] Error updating:', error.message)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    return NextResponse.json({ preferences: data })
  } catch (err) {
    console.error('[API Notifications Preferences] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
