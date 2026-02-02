'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ArrowLeft,
  Eye,
  Users,
  Clock,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  MessageCircle,
  TrendingUp,
  Loader2,
  RefreshCw,
  Calendar
} from 'lucide-react'

import StatsCard from '@/components/analytics/StatsCard'
import LineChart from '@/components/analytics/LineChart'
import PieChart from '@/components/analytics/PieChart'
import BarChart from '@/components/analytics/BarChart'

interface ViewsByDay {
  date: string
  views: number
  unique_visitors: number
}

interface RoomPopularity {
  room_id: string
  room_name: string
  percentage: number
  avg_time_seconds: number
}

interface ReferrerStat {
  referrer: string
  count: number
}

interface DeviceBreakdown {
  mobile: number
  desktop: number
  tablet: number
}

interface LiaStats {
  total_sessions: number
  total_messages: number
  avg_messages_per_session: number
  top_questions: Array<{ question: string; count: number }>
}

interface AnalyticsData {
  total_views: number
  unique_visitors: number
  avg_duration_seconds: number
  views_by_day: ViewsByDay[]
  rooms_popularity: RoomPopularity[]
  top_referrers: ReferrerStat[]
  device_breakdown: DeviceBreakdown
  lia_stats: LiaStats
}

interface Tour {
  id: string
  title: string
  address: string
}

export default function TourAnalyticsPage() {
  const params = useParams()
  const router = useRouter()
  const tourId = params.id as string

  const [tour, setTour] = useState<Tour | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState(30)

  useEffect(() => {
    loadData()
  }, [tourId, period])

  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Charger les infos du tour
      const tourRes = await fetch(`/api/tours/${tourId}/publish`)
      if (!tourRes.ok && tourRes.status !== 404) {
        // Fallback: juste utiliser l'ID
        setTour({ id: tourId, title: 'Visite', address: '' })
      }

      // Charger les analytics
      const analyticsRes = await fetch(`/api/tours/${tourId}/analytics?days=${period}`)
      if (!analyticsRes.ok) {
        const data = await analyticsRes.json()
        throw new Error(data.error || 'Erreur de chargement')
      }

      const analyticsData = await analyticsRes.json()
      setAnalytics(analyticsData)

    } catch (err) {
      console.error('Erreur chargement analytics:', err)
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }

  const formatDate = (dateStr: string): string => {
    try {
      return format(parseISO(dateStr), 'd MMM', { locale: fr })
    } catch {
      return dateStr
    }
  }

  // Skeleton loader
  const SkeletonCard = () => (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 bg-gray-700 rounded-lg" />
      </div>
      <div className="mt-4">
        <div className="h-8 w-20 bg-gray-700 rounded" />
        <div className="h-4 w-32 bg-gray-700 rounded mt-2" />
      </div>
    </div>
  )

  const SkeletonChart = ({ height = 200 }: { height?: number }) => (
    <div
      className="bg-gray-800 rounded-xl p-5 border border-gray-700 animate-pulse"
      style={{ height: height + 60 }}
    >
      <div className="h-5 w-40 bg-gray-700 rounded mb-4" />
      <div className="h-full bg-gray-700/50 rounded" />
    </div>
  )

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-4">
        <h1 className="text-2xl font-bold mb-4">Erreur</h1>
        <p className="text-gray-400 mb-6">{error}</p>
        <Link
          href={`/tours/${tourId}`}
          className="text-blue-400 hover:underline flex items-center gap-2"
        >
          <ArrowLeft size={18} />
          Retour a la visite
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/tours/${tourId}`}
              className="p-2 text-gray-400 hover:text-white transition rounded-lg hover:bg-gray-700"
            >
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-white font-semibold text-lg">Analytics</h1>
              {tour && (
                <p className="text-gray-400 text-sm">{tour.title}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Selecteur de periode */}
            <div className="flex items-center gap-2 bg-gray-700 rounded-lg p-1">
              {[7, 30, 90].map(days => (
                <button
                  key={days}
                  onClick={() => setPeriod(days)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    period === days
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {days}j
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-white transition rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : analytics ? (
            <>
              <StatsCard
                icon={Eye}
                label="Vues totales"
                value={analytics.total_views}
                color="blue"
              />
              <StatsCard
                icon={Users}
                label="Visiteurs uniques"
                value={analytics.unique_visitors}
                color="green"
              />
              <StatsCard
                icon={Clock}
                label="Duree moyenne"
                value={formatDuration(analytics.avg_duration_seconds)}
                color="purple"
              />
              <StatsCard
                icon={MessageCircle}
                label="Sessions Lia"
                value={analytics.lia_stats.total_sessions}
                color="orange"
              />
            </>
          ) : null}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Line Chart - Vues par jour */}
          <div className="lg:col-span-2">
            {loading ? (
              <SkeletonChart height={250} />
            ) : analytics ? (
              <LineChart
                data={analytics.views_by_day.map(d => ({
                  label: formatDate(d.date),
                  value: d.views
                }))}
                label={`Vues par jour (${period} derniers jours)`}
                color="#3b82f6"
                height={250}
              />
            ) : null}
          </div>

          {/* Pie Chart - Devices */}
          <div>
            {loading ? (
              <SkeletonChart height={250} />
            ) : analytics ? (
              <PieChart
                segments={[
                  { label: 'Desktop', value: analytics.device_breakdown.desktop, color: '#3b82f6' },
                  { label: 'Mobile', value: analytics.device_breakdown.mobile, color: '#10b981' },
                  { label: 'Tablet', value: analytics.device_breakdown.tablet, color: '#f59e0b' }
                ]}
                title="Appareils"
                size={160}
              />
            ) : null}
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Bar Chart - Pieces populaires */}
          {loading ? (
            <SkeletonChart height={200} />
          ) : analytics && analytics.rooms_popularity.length > 0 ? (
            <BarChart
              data={analytics.rooms_popularity.map(r => ({
                label: r.room_name,
                value: r.percentage
              }))}
              title="Pieces les plus visitees"
              maxValue={100}
              valueFormatter={(v) => `${v}%`}
              barColor="#8b5cf6"
            />
          ) : (
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <h3 className="text-white font-medium mb-4">Pieces les plus visitees</h3>
              <div className="flex items-center justify-center h-32 text-gray-500">
                Aucune donnee de navigation par piece
              </div>
            </div>
          )}

          {/* Top Referrers */}
          {loading ? (
            <SkeletonChart height={200} />
          ) : analytics ? (
            <BarChart
              data={analytics.top_referrers.map(r => ({
                label: r.referrer === 'Direct' ? 'Acces direct' : new URL(r.referrer).hostname || r.referrer,
                value: r.count
              }))}
              title="Sources de trafic"
              valueFormatter={(v) => `${v} visites`}
              barColor="#10b981"
            />
          ) : null}
        </div>

        {/* Lia Stats Section */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold">L</span>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">Statistiques Lia</h3>
              <p className="text-gray-400 text-sm">Assistant IA conversationnel</p>
            </div>
          </div>

          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-48 bg-gray-700 rounded" />
              <div className="h-4 w-64 bg-gray-700 rounded" />
            </div>
          ) : analytics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Stats Lia */}
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-400">Sessions totales</span>
                  <span className="text-white font-medium">{analytics.lia_stats.total_sessions}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-400">Messages echanges</span>
                  <span className="text-white font-medium">{analytics.lia_stats.total_messages}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-400">Messages par session</span>
                  <span className="text-white font-medium">{analytics.lia_stats.avg_messages_per_session}</span>
                </div>
              </div>

              {/* Top Questions */}
              <div>
                <h4 className="text-gray-300 font-medium mb-3">Questions frequentes</h4>
                {analytics.lia_stats.top_questions.length > 0 ? (
                  <ul className="space-y-2">
                    {analytics.lia_stats.top_questions.map((q, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-purple-400 font-medium flex-shrink-0">
                          {q.count}x
                        </span>
                        <span className="text-gray-300 text-sm">
                          "{q.question}"
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-sm">Aucune question enregistree</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
