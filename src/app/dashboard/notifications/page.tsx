'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Eye,
  Trophy,
  MessageCircle,
  BarChart,
  AlertTriangle,
  UserPlus,
  CheckCircle,
  Info,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { formatRelativeTime, type NotificationType } from '@/lib/notifications'

interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  data: Record<string, unknown>
  link: string | null
  read_at: string | null
  created_at: string
}

// Icones par type
const iconMap: Record<NotificationType, React.ReactNode> = {
  new_visitor: <Eye className="w-5 h-5" />,
  milestone_views: <Trophy className="w-5 h-5" />,
  lia_question: <MessageCircle className="w-5 h-5" />,
  weekly_digest: <BarChart className="w-5 h-5" />,
  quota_warning: <AlertTriangle className="w-5 h-5" />,
  team_invite: <UserPlus className="w-5 h-5" />,
  tour_published: <CheckCircle className="w-5 h-5" />,
  system: <Info className="w-5 h-5" />,
}

// Couleurs par type
const colorMap: Record<NotificationType, string> = {
  new_visitor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  milestone_views: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  lia_question: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  weekly_digest: 'bg-green-500/20 text-green-400 border-green-500/30',
  quota_warning: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  team_invite: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  tour_published: 'bg-green-500/20 text-green-400 border-green-500/30',
  system: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

// Labels par type
const typeLabels: Record<NotificationType, string> = {
  new_visitor: 'Visiteur',
  milestone_views: 'Milestone',
  lia_question: 'Question Lia',
  weekly_digest: 'Digest',
  quota_warning: 'Quota',
  team_invite: 'Equipe',
  tour_published: 'Publication',
  system: 'Systeme',
}

const ITEMS_PER_PAGE = 10

type FilterType = 'all' | 'unread' | NotificationType

export default function NotificationsPage() {
  const router = useRouter()
  const { user, session } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [page, setPage] = useState(1)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!session?.access_token) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(ITEMS_PER_PAGE),
        offset: String((page - 1) * ITEMS_PER_PAGE),
      })

      if (filter === 'unread') {
        params.append('unread_only', 'true')
      } else if (filter !== 'all') {
        params.append('type', filter)
      }

      const response = await fetch(`/api/notifications?${params}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
        setTotal(data.total || 0)
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (err) {
      console.error('[Notifications] Error fetching:', err)
    } finally {
      setLoading(false)
    }
  }, [session?.access_token, page, filter])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Reset page when filter changes
  useEffect(() => {
    setPage(1)
  }, [filter])

  // Marquer comme lu
  const markAsRead = async (notificationId: string) => {
    if (!session?.access_token) return

    setActionLoading(notificationId)
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'mark_read',
          notification_id: notificationId,
        }),
      })

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('[Notifications] Error marking as read:', err)
    } finally {
      setActionLoading(null)
    }
  }

  // Marquer toutes comme lues
  const markAllAsRead = async () => {
    if (!session?.access_token) return

    setActionLoading('all')
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'mark_all_read' }),
      })

      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      )
      setUnreadCount(0)
    } catch (err) {
      console.error('[Notifications] Error marking all as read:', err)
    } finally {
      setActionLoading(null)
    }
  }

  // Supprimer
  const deleteNotification = async (notificationId: string) => {
    if (!session?.access_token) return

    setActionLoading(notificationId)
    try {
      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ notification_id: notificationId }),
      })

      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      setTotal(prev => prev - 1)

      const deletedNotification = notifications.find(n => n.id === notificationId)
      if (deletedNotification && !deletedNotification.read_at) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (err) {
      console.error('[Notifications] Error deleting:', err)
    } finally {
      setActionLoading(null)
    }
  }

  // Clic sur notification
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read_at) {
      markAsRead(notification.id)
    }

    if (notification.link) {
      router.push(notification.link)
    }
  }

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Notifications</h1>
        <p className="text-gray-400">
          {unreadCount > 0
            ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
            : 'Toutes vos notifications sont lues'}
        </p>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Toutes
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === 'unread'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Non lues
          </button>
          <select
            value={filter === 'all' || filter === 'unread' ? '' : filter}
            onChange={e => setFilter((e.target.value || 'all') as FilterType)}
            className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Par type...</option>
            {Object.entries(typeLabels).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            disabled={actionLoading === 'all'}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {actionLoading === 'all' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCheck className="w-4 h-4" />
            )}
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Bell className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg">Aucune notification</p>
            <p className="text-sm mt-1">
              {filter !== 'all' ? 'Essayez un autre filtre' : 'Vous etes a jour!'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-700">
            {notifications.map(notification => (
              <li
                key={notification.id}
                className={`hover:bg-gray-700/50 transition-colors ${
                  !notification.read_at ? 'bg-gray-700/30' : ''
                }`}
              >
                <div className="flex items-start gap-4 p-4">
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border ${
                      colorMap[notification.type]
                    }`}
                  >
                    {iconMap[notification.type]}
                  </div>

                  {/* Content */}
                  <button
                    onClick={() => handleNotificationClick(notification)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className={`font-medium ${
                          notification.read_at ? 'text-gray-300' : 'text-white'
                        }`}
                      >
                        {notification.title}
                      </h3>
                      <span className="flex-shrink-0 text-xs text-gray-500">
                        {formatRelativeTime(notification.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{notification.message}</p>
                    {notification.link && (
                      <p className="text-xs text-blue-400 mt-2 hover:underline">
                        Voir les details
                      </p>
                    )}
                  </button>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex items-center gap-1">
                    {!notification.read_at && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        disabled={actionLoading === notification.id}
                        className="p-2 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                        title="Marquer comme lu"
                      >
                        {actionLoading === notification.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      disabled={actionLoading === notification.id}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                      title="Supprimer"
                    >
                      {actionLoading === notification.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
            <p className="text-sm text-gray-400">
              Page {page} sur {totalPages} ({total} resultats)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Link to Settings */}
      <div className="mt-6 text-center">
        <button
          onClick={() => router.push('/dashboard/settings/notifications')}
          className="text-sm text-gray-400 hover:text-blue-400 transition-colors"
        >
          Gerer les preferences de notification
        </button>
      </div>
    </div>
  )
}
