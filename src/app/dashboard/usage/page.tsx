'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Video,
  Users,
  HardDrive,
  MessageCircle,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  Crown,
  RefreshCw
} from 'lucide-react'
import QuotaCard from '@/components/QuotaCard'
import {
  getUsagePercent,
  getUsageColor,
  formatBytes,
  getPlanDisplayName,
  isOverQuota,
  isNearQuota,
  type PlanType
} from '@/lib/plans'

interface UsageData {
  usage: {
    totalTours: number
    totalUsers: number
    storageBytes: number
    liaViewsMonth: number
  }
  limits: {
    maxUsers: number
    maxTours: number
    maxStorageGb: number
    maxStorageBytes: number
  }
  plan: PlanType
  entityName: string
}

interface HistoryItem {
  month: string
  toursCreated: number
  liaViews: number
  storageBytes: number
}

export default function UsagePage() {
  const router = useRouter()
  const [data, setData] = useState<UsageData | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      const [usageRes, historyRes] = await Promise.all([
        fetch('/api/usage'),
        fetch('/api/usage/history?months=6')
      ])

      if (!usageRes.ok || !historyRes.ok) {
        throw new Error('Erreur lors du chargement')
      }

      const usageData = await usageRes.json()
      const historyData = await historyRes.json()

      setData(usageData)
      setHistory(historyData.history || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-12 h-12 text-red-500" />
        <p className="text-gray-400">{error || 'Impossible de charger les donnees'}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Reessayer
        </button>
      </div>
    )
  }

  const { usage, limits, plan } = data
  const overQuota = isOverQuota(usage, { ...limits, features: [], price: 0, maxStorageGb: limits.maxStorageGb })
  const nearQuota = isNearQuota(usage, { ...limits, features: [], price: 0, maxStorageGb: limits.maxStorageGb })

  // Calculer le max pour le graphique
  const maxLiaViews = Math.max(...history.map(h => h.liaViews), 1)
  const maxToursCreated = Math.max(...history.map(h => h.toursCreated), 1)

  // Formatter le nom du mois
  const formatMonth = (monthStr: string): string => {
    const [year, month] = monthStr.split('-')
    const months = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aout', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[parseInt(month) - 1]} ${year.slice(2)}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Usage et Quotas</h1>
          <p className="text-gray-400 mt-1">
            {data.entityName} - Plan {getPlanDisplayName(plan)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Actualiser"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {plan !== 'enterprise' && (
            <button
              onClick={() => router.push('/dashboard/settings?tab=billing')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all"
            >
              <Crown className="w-4 h-4" />
              Upgrader
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Alertes critiques */}
      {overQuota.any && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div>
              <h3 className="text-red-200 font-semibold">Quota atteint</h3>
              <p className="text-red-300/80 text-sm mt-1">
                Vous avez atteint votre limite.
                {overQuota.tours && ' Tours: limite atteinte.'}
                {overQuota.users && ' Utilisateurs: limite atteinte.'}
                {overQuota.storage && ' Stockage: limite atteinte.'}
                {' '}Passez a un plan superieur pour continuer.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Alertes warning */}
      {nearQuota.any && !overQuota.any && (
        <div className="bg-orange-900/30 border border-orange-700/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-400 flex-shrink-0" />
            <div>
              <h3 className="text-orange-200 font-semibold">Attention aux limites</h3>
              <p className="text-orange-300/80 text-sm mt-1">
                Vous approchez de vos limites.
                {nearQuota.tours && ` Tours: ${getUsagePercent(usage.totalTours, limits.maxTours)}%.`}
                {nearQuota.users && ` Utilisateurs: ${getUsagePercent(usage.totalUsers, limits.maxUsers)}%.`}
                {nearQuota.storage && ` Stockage: ${getUsagePercent(usage.storageBytes, limits.maxStorageBytes)}%.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quota Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <QuotaCard
          label="Visites virtuelles"
          current={usage.totalTours}
          max={limits.maxTours}
          unit="count"
          icon={<Video className="w-5 h-5" />}
        />

        <QuotaCard
          label="Utilisateurs"
          current={usage.totalUsers}
          max={limits.maxUsers}
          unit="count"
          icon={<Users className="w-5 h-5" />}
        />

        <QuotaCard
          label="Stockage"
          current={usage.storageBytes}
          max={limits.maxStorageBytes}
          unit="bytes"
          icon={<HardDrive className="w-5 h-5" />}
        />

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <MessageCircle className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-400">Sessions Lia (ce mois)</h3>
                <p className="text-xl font-bold text-white">{usage.liaViewsMonth}</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Nombre de conversations avec l'assistant IA
          </p>
        </div>
      </div>

      {/* Historique */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Historique (6 mois)</h2>
        </div>

        {history.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Pas encore de donnees historiques</p>
        ) : (
          <div className="space-y-6">
            {/* Graphique Tours */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Tours crees</h3>
              <div className="flex items-end gap-2 h-32">
                {history.map((item, index) => {
                  const height = (item.toursCreated / maxToursCreated) * 100
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-400">{item.toursCreated}</span>
                      <div className="w-full bg-gray-700 rounded-t-sm relative" style={{ height: '100px' }}>
                        <div
                          className="absolute bottom-0 w-full bg-blue-500 rounded-t-sm transition-all duration-500"
                          style={{ height: `${Math.max(4, height)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{formatMonth(item.month)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Graphique Sessions Lia */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Sessions Lia</h3>
              <div className="flex items-end gap-2 h-32">
                {history.map((item, index) => {
                  const height = (item.liaViews / maxLiaViews) * 100
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-400">{item.liaViews}</span>
                      <div className="w-full bg-gray-700 rounded-t-sm relative" style={{ height: '100px' }}>
                        <div
                          className="absolute bottom-0 w-full bg-purple-500 rounded-t-sm transition-all duration-500"
                          style={{ height: `${Math.max(4, height)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{formatMonth(item.month)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Graphique Stockage */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Stockage cumule</h3>
              <div className="flex items-end gap-2 h-32">
                {history.map((item, index) => {
                  const maxStorage = Math.max(...history.map(h => h.storageBytes), 1)
                  const height = (item.storageBytes / maxStorage) * 100
                  const storageColor = getUsageColor(getUsagePercent(item.storageBytes, limits.maxStorageBytes))
                  const colorClass = {
                    green: 'bg-green-500',
                    orange: 'bg-orange-500',
                    red: 'bg-red-500'
                  }[storageColor]

                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-400">{formatBytes(item.storageBytes, 1)}</span>
                      <div className="w-full bg-gray-700 rounded-t-sm relative" style={{ height: '100px' }}>
                        <div
                          className={`absolute bottom-0 w-full rounded-t-sm transition-all duration-500 ${colorClass}`}
                          style={{ height: `${Math.max(4, height)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{formatMonth(item.month)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Plan Info */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Votre plan: {getPlanDisplayName(plan)}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-700/50 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Limite tours</p>
            <p className="text-white text-lg font-semibold">
              {limits.maxTours === Infinity ? 'Illimite' : limits.maxTours}
            </p>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Limite utilisateurs</p>
            <p className="text-white text-lg font-semibold">
              {limits.maxUsers === Infinity ? 'Illimite' : limits.maxUsers}
            </p>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Limite stockage</p>
            <p className="text-white text-lg font-semibold">
              {limits.maxStorageGb === Infinity ? 'Illimite' : `${limits.maxStorageGb} GB`}
            </p>
          </div>
        </div>

        {plan !== 'enterprise' && (
          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-gray-400 text-sm mb-3">
              Besoin de plus de capacite ? Passez au plan superieur pour debloquer plus de fonctionnalites.
            </p>
            <button
              onClick={() => router.push('/dashboard/settings?tab=billing')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Comparer les plans
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
