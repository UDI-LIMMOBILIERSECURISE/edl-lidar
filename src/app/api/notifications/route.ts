import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

// Client authentifie pour les routes API
function getAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(supabaseUrl, supabaseAnonKey)
}

/**
 * GET /api/notifications
 * Liste les notifications de l'utilisateur connecte
 *
 * Query params:
 * - limit: number (default 20)
 * - offset: number (default 0)
 * - unread_only: boolean (default false)
 * - type: string (optional filter by type)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getAuthClient()

    // Recuperer le token d'auth depuis les headers
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    // Verifier le token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    // Parser les query params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const unreadOnly = searchParams.get('unread_only') === 'true'
    const type = searchParams.get('type')

    // Service client pour les requetes
    // Note: Cast as any car les types seront regeneres apres migration
    const serviceClient = createServerClient() as any

    // Query principale
    let query = serviceClient
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (unreadOnly) {
      query = query.is('read_at', null)
    }

    if (type) {
      query = query.eq('type', type)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[API Notifications] Error:', error.message)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    // Compter les non lues
    const { count: unreadCount } = await serviceClient
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null)

    return NextResponse.json({
      notifications: data || [],
      total: count || 0,
      unreadCount: unreadCount || 0,
      limit,
      offset,
    })
  } catch (err) {
    console.error('[API Notifications] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/notifications
 * Marquer comme lue / Marquer toutes comme lues
 *
 * Body:
 * - action: 'mark_read' | 'mark_all_read'
 * - notification_id: string (required for mark_read)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getAuthClient()

    // Recuperer le token d'auth
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
    const { action, notification_id } = body

    // Note: Cast as any car les types seront regeneres apres migration
    const serviceClient = createServerClient() as any

    if (action === 'mark_read') {
      if (!notification_id) {
        return NextResponse.json({ error: 'notification_id requis' }, { status: 400 })
      }

      const { error } = await serviceClient
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notification_id)
        .eq('user_id', user.id)
        .is('read_at', null)

      if (error) {
        console.error('[API Notifications] Error marking read:', error.message)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    if (action === 'mark_all_read') {
      const { data, error } = await serviceClient
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null)
        .select('id')

      if (error) {
        console.error('[API Notifications] Error marking all read:', error.message)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
      }

      return NextResponse.json({ success: true, count: data?.length || 0 })
    }

    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
  } catch (err) {
    console.error('[API Notifications] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/notifications
 * Supprimer une notification
 *
 * Body:
 * - notification_id: string
 */
export async function DELETE(request: NextRequest) {
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
    const { notification_id } = body

    if (!notification_id) {
      return NextResponse.json({ error: 'notification_id requis' }, { status: 400 })
    }

    // Note: Cast as any car les types seront regeneres apres migration
    const serviceClient = createServerClient() as any

    const { error } = await serviceClient
      .from('notifications')
      .delete()
      .eq('id', notification_id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[API Notifications] Error deleting:', error.message)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API Notifications] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
