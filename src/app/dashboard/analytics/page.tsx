'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { getSupabase } from '@/lib/supabase'
import StatsCard from '@/components/analytics/StatsCard'
import LineChart from '@/components/analytics/LineChart'
import PieChart from '@/components/analytics/PieChart'
import TopToursTable from '@/components/analytics/TopToursTable'
import AgencyComparison from '@/components/analytics/AgencyComparison'
import ExportButton from '@/components/analytics/ExportButton'
import {
  Video,
  Eye,
  Users,
  MessageSquare,
  Clock,
  BarChart3,
  RefreshCw
} from 'lucide-react'

interface EntityAnalytics {
  total_tours: number
  total_views: number
  total_unique_visitors: number
  avg_duration_seconds: number
  total_lia_sessions: number
  total_lia_messages: number
  views_by_day: Array<{ date: string; views: number }> | null
  top_tours: Array<{ tour_id: string; title: string; views: number }> | null
  device_breakdown: {
    desktop: number
    mobile: number
    tablet: number
    unknown: number
  }
  top_referrers: Array<{ referrer: string; count: number }>
  views_by_agency: Array<{
    name: string
    tours: number
    views: number
    liaSessions: number
  }>
  period: {
    days: number
    start_date: string
    end_date: string
  }
}

const PERIOD_OPTIONS = [
  { value: 7, label: '7 jours' },
  { value: 14, label: '14 jours' },
  { value: 30, label: '30 jours' },
  { value: 60, label: '60 jours' },
  { value: 90, label: '90 jours' }
]

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [analytics, setAnalytics] = useState<EntityAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState(30)

  const fetchAnalytics = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('Session expiree')
        return
      }

      const response = await fetch(`/api/analytics/entity?days=${selectedPeriod}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        if (response.status === 403) {
          setError('Acces non autorise')
        } else {
          setError('Erreur lors du chargement des analytics')
        }
        return
      }

      const data = await response.json()
      setAnalytics(data)
    } catch (err) {
      console.error('Analytics fetch error:', err)
      setError('Erreur de connexion')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [user, selectedPeriod])

  // Preparer les donnees pour le graphique de tendance
  const viewsChartData = analytics?.views_by_day?.map(d => ({
    label: new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    value: d.views
  })) || []

  // Preparer les donnees pour le pie chart des devices
  const deviceChartData = analytics ? [
    { label: 'Desktop', value: analytics.device_breakdown.desktop, color: '#3b82f6' },
    { label: 'Mobile', value: analytics.device_breakdown.mobile, color: '#10b981' },
    { label: 'Tablette', value: analytics.device_breakdown.tablet, color: '#f59e0b' },
    { label: 'Autre', value: analytics.device_breakdown.unknown, color: '#6b7280' }
  ].filter(d => d.value > 0) : []

  // Formater la duree moyenne
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m`
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Reessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-blue-500" />
            Analytics
          </h1>
          <p className="text-gray-400 mt-1">
            Vue d'ensemble des performances de vos visites
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Selecteur de periode */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PERIOD_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Bouton refresh */}
          <button
            onClick={fetchAnalytics}
            disabled={isLoading}
            className="p-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Bouton export */}
          <ExportButton days={selectedPeriod} />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <StatsCard
          icon={Video}
          label="Visites totales"
          value={isLoading ? '-' : analytics?.total_tours || 0}
          color="blue"
        />
        <StatsCard
          icon={Eye}
          label="Vues totales"
          value={isLoading ? '-' : analytics?.total_views || 0}
          color="green"
        />
        <StatsCard
          icon={Users}
          label="Visiteurs uniques"
          value={isLoading ? '-' : analytics?.total_unique_visitors || 0}
          color="purple"
        />
        <StatsCard
          icon={Clock}
          label="Duree moyenne"
          value={isLoading ? '-' : formatDuration(analytics?.avg_duration_seconds || 0)}
          color="orange"
        />
        <StatsCard
          icon={MessageSquare}
          label="Sessions Lia"
          value={isLoading ? '-' : analytics?.total_lia_sessions || 0}
          color="blue"
        />
        <StatsCard
          icon={MessageSquare}
          label="Messages Lia"
          value={isLoading ? '-' : analytics?.total_lia_messages || 0}
          color="green"
        />
      </div>

      {/* Graphique de tendance */}
      <LineChart
        data={viewsChartData}
        label={`Tendance des vues (${selectedPeriod} jours)`}
        color="#3b82f6"
        height={250}
      />

      {/* Grille principale */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top tours */}
        <div className="lg:col-span-2">
          <TopToursTable
            tours={(analytics?.top_tours || []).map(t => ({
              tour_id: t.tour_id,
              title: t.title,
              views: t.views
            }))}
            isLoading={isLoading}
          />
        </div>

        {/* Repartition par device */}
        <PieChart
          segments={deviceChartData}
          title="Repartition par appareil"
          size={160}
        />

        {/* Top referrers */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h3 className="text-white font-medium mb-4">Sources de trafic</h3>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : analytics?.top_referrers && analytics.top_referrers.length > 0 ? (
            <div className="space-y-3">
              {analytics.top_referrers.slice(0, 6).map((ref, i) => {
                const maxCount = analytics.top_referrers[0].count
                const percentage = (ref.count / maxCount) * 100

                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300 truncate max-w-[70%]">
                        {ref.referrer === 'direct' ? 'Acces direct' : ref.referrer}
                      </span>
                      <span className="text-gray-400 flex-shrink-0">
                        {ref.count}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Aucune donnee disponible
            </div>
          )}
        </div>
      </div>

      {/* Comparaison par agence */}
      {analytics?.views_by_agency && analytics.views_by_agency.length > 1 && (
        <AgencyComparison
          data={analytics.views_by_agency}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}
