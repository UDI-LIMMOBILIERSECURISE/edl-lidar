'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { getSupabase } from '@/lib/supabase'
import { VirtualTour } from '@/types/database'
import {
  Plus,
  Video,
  Eye,
  MessageSquare,
  Calendar,
  MapPin,
  Clock,
  TrendingUp,
  ExternalLink,
  ChevronRight
} from 'lucide-react'

interface DashboardStats {
  totalTours: number
  totalLiaSessions: number
  totalViews: number
  recentTours: VirtualTour[]
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalTours: 0,
    totalLiaSessions: 0,
    totalViews: 0,
    recentTours: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return

      try {
        const supabase = getSupabase()

        // Fetch tours for the current user (RLS filtre automatiquement par user_id)
        const { data: tours, error: toursError } = await supabase
          .from('virtual_tours')
          .select('*')
          .order('created_at', { ascending: false })

        if (toursError) throw toursError

        // Fetch Lia sessions count for user's tours
        let totalLiaSessions = 0
        if (tours && tours.length > 0) {
          const tourIds = tours.map(t => t.id)
          const { count, error: sessionsError } = await supabase
            .from('lia_sessions')
            .select('*', { count: 'exact', head: true })
            .in('tour_id', tourIds)

          if (sessionsError) {
            console.error('Error fetching lia sessions:', sessionsError)
          } else {
            totalLiaSessions = count || 0
          }
        }

        setStats({
          totalTours: tours?.length || 0,
          totalLiaSessions,
          totalViews: totalLiaSessions, // Pour l'instant, on utilise sessions comme proxy pour les vues
          recentTours: tours?.slice(0, 5) || [],
        })
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
        setError('Erreur lors du chargement des donnees')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [user])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-green-900/50 text-green-400 rounded-full">
            Pret
          </span>
        )
      case 'processing':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-yellow-900/50 text-yellow-400 rounded-full">
            En cours
          </span>
        )
      case 'error':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-red-900/50 text-red-400 rounded-full">
            Erreur
          </span>
        )
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-400">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">
            Bienvenue, {user?.email?.split('@')[0] || 'utilisateur'}
          </p>
        </div>
        <Link
          href="/tours/new"
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Nouvelle visite</span>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total visites</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.totalTours}</p>
            </div>
            <div className="w-12 h-12 bg-blue-900/50 rounded-lg flex items-center justify-center">
              <Video className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-sm text-gray-400">
            <TrendingUp className="w-4 h-4 mr-1 text-green-400" />
            <span>Visites virtuelles creees</span>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Vues Lia</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.totalViews}</p>
            </div>
            <div className="w-12 h-12 bg-purple-900/50 rounded-lg flex items-center justify-center">
              <Eye className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-sm text-gray-400">
            <MessageSquare className="w-4 h-4 mr-1 text-purple-400" />
            <span>Sessions avec assistant IA</span>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Conversations Lia</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.totalLiaSessions}</p>
            </div>
            <div className="w-12 h-12 bg-green-900/50 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-sm text-gray-400">
            <Clock className="w-4 h-4 mr-1 text-green-400" />
            <span>Interactions avec visiteurs</span>
          </div>
        </div>
      </div>

      {/* Recent tours */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Visites recentes</h2>
          <Link
            href="/dashboard/tours"
            className="text-sm text-blue-400 hover:text-blue-300 flex items-center space-x-1"
          >
            <span>Voir tout</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {stats.recentTours.length === 0 ? (
          <div className="p-8 text-center">
            <Video className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-4">Aucune visite pour le moment</p>
            <Link
              href="/tours/new"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Creer votre premiere visite</span>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {stats.recentTours.map((tour) => (
              <div
                key={tour.id}
                className="p-4 hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-white font-medium truncate">
                        {tour.title}
                      </h3>
                      {getStatusBadge(tour.status)}
                    </div>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-400">
                      <span className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[200px]">{tour.address}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(tour.created_at)}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {tour.is_public && tour.public_slug && (
                      <Link
                        href={`/v/${tour.public_slug}`}
                        target="_blank"
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors"
                        title="Voir la visite publique"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    )}
                    <Link
                      href={`/tours/${tour.id}`}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors"
                      title="Gerer la visite"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/tours/new"
          className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 hover:from-blue-500 hover:to-blue-600 transition-all group"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Nouvelle visite</h3>
              <p className="text-blue-200 text-sm">Uploader une video 360</p>
            </div>
          </div>
        </Link>

        <a
          href="https://docs.edl-lidar.fr"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-gray-600 transition-colors group"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center group-hover:bg-gray-600 transition-colors">
              <ExternalLink className="w-6 h-6 text-gray-300" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Documentation</h3>
              <p className="text-gray-400 text-sm">Guides et tutoriels</p>
            </div>
          </div>
        </a>
      </div>
    </div>
  )
}
