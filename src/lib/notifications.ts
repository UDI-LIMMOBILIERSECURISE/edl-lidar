/**
 * Notifications Library for EDL LIDAR
 *
 * Fonctions utilitaires pour la gestion des notifications
 * Note: Les casts "as any" sont temporaires jusqu'a la regeneration des types
 * apres l'execution de la migration 011_notifications.sql
 */

import { getSupabase } from './supabase'

// ============================================================================
// TYPES
// ============================================================================

export type NotificationType =
  | 'new_visitor'
  | 'milestone_views'
  | 'lia_question'
  | 'weekly_digest'
  | 'quota_warning'
  | 'team_invite'
  | 'tour_published'
  | 'system'

export interface Notification {
  id: string
  user_id: string
  entity_id: string
  type: NotificationType
  title: string
  message: string
  data: Record<string, unknown>
  link: string | null
  read_at: string | null
  created_at: string
}

export interface NotificationPreferences {
  id: string
  user_id: string
  app_new_visitor: boolean
  app_milestone_views: boolean
  app_lia_question: boolean
  app_quota_warning: boolean
  email_new_visitor: boolean
  email_weekly_digest: boolean
  email_milestone_views: boolean
  email_quota_warning: boolean
  threshold_views: number
  threshold_quota_percent: number
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  created_at: string
  updated_at: string
}

export interface GetNotificationsOptions {
  limit?: number
  offset?: number
  unreadOnly?: boolean
  type?: NotificationType
}

export interface NotificationsResult {
  notifications: Notification[]
  total: number
  unreadCount: number
}

// ============================================================================
// NOTIFICATION CRUD
// ============================================================================

/**
 * Recuperer les notifications d'un utilisateur
 */
export async function getUserNotifications(
  userId: string,
  options: GetNotificationsOptions = {}
): Promise<NotificationsResult> {
  const supabase = getSupabase() as any
  const { limit = 20, offset = 0, unreadOnly = false, type } = options

  try {
    // Query principale
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
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
      console.error('[Notifications] Error fetching:', error.message)
      return { notifications: [], total: 0, unreadCount: 0 }
    }

    // Compter les non lues
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)

    return {
      notifications: (data || []) as Notification[],
      total: count || 0,
      unreadCount: unreadCount || 0,
    }
  } catch (err) {
    console.error('[Notifications] Error:', err)
    return { notifications: [], total: 0, unreadCount: 0 }
  }
}

/**
 * Marquer une notification comme lue
 */
export async function markAsRead(notificationId: string): Promise<boolean> {
  const supabase = getSupabase() as any

  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .is('read_at', null)

    if (error) {
      console.error('[Notifications] Error marking as read:', error.message)
      return false
    }

    return true
  } catch (err) {
    console.error('[Notifications] Error:', err)
    return false
  }
}

/**
 * Marquer toutes les notifications comme lues
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const supabase = getSupabase() as any

  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null)
      .select('id')

    if (error) {
      console.error('[Notifications] Error marking all as read:', error.message)
      return 0
    }

    return data?.length || 0
  } catch (err) {
    console.error('[Notifications] Error:', err)
    return 0
  }
}

/**
 * Supprimer une notification
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  const supabase = getSupabase() as any

  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)

    if (error) {
      console.error('[Notifications] Error deleting:', error.message)
      return false
    }

    return true
  } catch (err) {
    console.error('[Notifications] Error:', err)
    return false
  }
}

/**
 * Compter les notifications non lues
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = getSupabase() as any

  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)

    if (error) {
      console.error('[Notifications] Error counting unread:', error.message)
      return 0
    }

    return count || 0
  } catch (err) {
    console.error('[Notifications] Error:', err)
    return 0
  }
}

// ============================================================================
// CREATION DE NOTIFICATION (pour usage serveur/API)
// ============================================================================

export interface CreateNotificationParams {
  userId: string
  entityId: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, unknown>
  link?: string
}

/**
 * Creer une notification (via API pour bypasser RLS)
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<string | null> {
  try {
    const response = await fetch('/api/notifications/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.id || null
  } catch (err) {
    console.error('[Notifications] Error creating:', err)
    return null
  }
}

// ============================================================================
// PREFERENCES
// ============================================================================

/**
 * Recuperer les preferences de notification
 */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences | null> {
  const supabase = getSupabase() as any

  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found
      console.error('[Notifications] Error fetching preferences:', error.message)
      return null
    }

    return data as NotificationPreferences | null
  } catch (err) {
    console.error('[Notifications] Error:', err)
    return null
  }
}

/**
 * Mettre a jour les preferences de notification
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<NotificationPreferences | null> {
  const supabase = getSupabase() as any

  try {
    // Upsert pour creer si n'existe pas
    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: userId,
          ...preferences,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error) {
      console.error('[Notifications] Error updating preferences:', error.message)
      return null
    }

    return data as NotificationPreferences
  } catch (err) {
    console.error('[Notifications] Error:', err)
    return null
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Obtenir l'icone pour un type de notification
 */
export function getNotificationIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    new_visitor: 'eye',
    milestone_views: 'trophy',
    lia_question: 'message-circle',
    weekly_digest: 'bar-chart',
    quota_warning: 'alert-triangle',
    team_invite: 'user-plus',
    tour_published: 'check-circle',
    system: 'info',
  }
  return icons[type] || 'bell'
}

/**
 * Obtenir la couleur pour un type de notification
 */
export function getNotificationColor(type: NotificationType): string {
  const colors: Record<NotificationType, string> = {
    new_visitor: 'blue',
    milestone_views: 'yellow',
    lia_question: 'purple',
    weekly_digest: 'green',
    quota_warning: 'orange',
    team_invite: 'cyan',
    tour_published: 'green',
    system: 'gray',
  }
  return colors[type] || 'gray'
}

/**
 * Formater la date relative
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'A l\'instant'
  if (diffMins < 60) return `Il y a ${diffMins} min`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays < 7) return `Il y a ${diffDays}j`

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
}
