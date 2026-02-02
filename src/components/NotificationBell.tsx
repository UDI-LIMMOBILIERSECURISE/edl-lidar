'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { getSupabase } from '@/lib/supabase'
import {
  Bell,
  Check,
  CheckCheck,
  Eye,
  Trophy,
  MessageCircle,
  BarChart,
  AlertTriangle,
  UserPlus,
  CheckCircle,
  Info,
  X,
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

// Intervalle de polling en ms (30 secondes)
const POLLING_INTERVAL = 30000

// Icones par type
const iconMap: Record<NotificationType, React.ReactNode> = {
  new_visitor: <Eye className="w-4 h-4" />,
  milestone_views: <Trophy className="w-4 h-4" />,
  lia_question: <MessageCircle className="w-4 h-4" />,
  weekly_digest: <BarChart className="w-4 h-4" />,
  quota_warning: <AlertTriangle className="w-4 h-4" />,
  team_invite: <UserPlus className="w-4 h-4" />,
  tour_published: <CheckCircle className="w-4 h-4" />,
  system: <Info className="w-4 h-4" />,
}

// Couleurs par type
const colorMap: Record<NotificationType, string> = {
  new_visitor: 'bg-blue-500/20 text-blue-400',
  milestone_views: 'bg-yellow-500/20 text-yellow-400',
  lia_question: 'bg-purple-500/20 text-purple-400',
  weekly_digest: 'bg-green-500/20 text-green-400',
  quota_warning: 'bg-orange-500/20 text-orange-400',
  team_invite: 'bg-cyan-500/20 text-cyan-400',
  tour_published: 'bg-green-500/20 text-green-400',
  system: 'bg-gray-500/20 text-gray-400',
}

export default function NotificationBell() {
  const router = useRouter()
  const { user, session } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fermer le dropdown au clic exterieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!session?.access_token) return

    try {
      const response = await fetch('/api/notifications?limit=5&unread_only=false', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (err) {
      console.error('[NotificationBell] Error fetching:', err)
    }
  }, [session?.access_token])

  // Initial fetch et polling
  useEffect(() => {
    if (!user || !session) return

    fetchNotifications()

    // Polling toutes les 30 secondes
    const interval = setInterval(fetchNotifications, POLLING_INTERVAL)

    return () => clearInterval(interval)
  }, [user, session, fetchNotifications])

  // Marquer comme lu
  const markAsRead = async (notificationId: string) => {
    if (!session?.access_token) return

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

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('[NotificationBell] Error marking as read:', err)
    }
  }

  // Marquer toutes comme lues
  const markAllAsRead = async () => {
    if (!session?.access_token) return

    setLoading(true)
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'mark_all_read' }),
      })

      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      )
      setUnreadCount(0)
    } catch (err) {
      console.error('[NotificationBell] Error marking all as read:', err)
    } finally {
      setLoading(false)
    }
  }

  // Clic sur notification
  const handleNotificationClick = (notification: Notification) => {
    // Marquer comme lu si pas deja lu
    if (!notification.read_at) {
      markAsRead(notification.id)
    }

    // Rediriger si lien
    if (notification.link) {
      router.push(notification.link)
      setIsOpen(false)
    }
  }

  if (!user) return null

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <h3 className="font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={loading}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
              >
                <CheckCheck className="w-4 h-4 inline mr-1" />
                Tout lire
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Aucune notification</p>
              </div>
            ) : (
              <ul>
                {notifications.map(notification => (
                  <li key={notification.id}>
                    <button
                      onClick={() => handleNotificationClick(notification)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-700/50 transition-colors border-b border-gray-700/50 last:border-0 ${
                        !notification.read_at ? 'bg-gray-700/30' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div
                          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                            colorMap[notification.type]
                          }`}
                        >
                          {iconMap[notification.type]}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium ${
                              notification.read_at ? 'text-gray-300' : 'text-white'
                            }`}
                          >
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatRelativeTime(notification.created_at)}
                          </p>
                        </div>

                        {/* Unread indicator */}
                        {!notification.read_at && (
                          <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2" />
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-700 px-4 py-2">
            <button
              onClick={() => {
                router.push('/dashboard/notifications')
                setIsOpen(false)
              }}
              className="w-full text-center text-sm text-blue-400 hover:text-blue-300 py-1 transition-colors"
            >
              Voir toutes les notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
