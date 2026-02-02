'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, X, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { isNearQuota, getPlanLimits, type EntityUsage, type PlanType, getUsagePercent } from '@/lib/plans'

interface UsageAlertProps {
  usage?: EntityUsage
  plan?: PlanType
  limits?: {
    maxUsers: number
    maxTours: number
    maxStorageBytes: number
  }
}

export default function UsageAlert({ usage, plan, limits }: UsageAlertProps) {
  const [dismissed, setDismissed] = useState(false)
  const [alertData, setAlertData] = useState<{
    usage: EntityUsage
    limits: ReturnType<typeof getPlanLimits>
    plan: PlanType
  } | null>(null)

  // Si les props sont fournies, les utiliser directement
  // Sinon, fetcher depuis l'API
  useEffect(() => {
    if (usage && plan && limits) {
      setAlertData({
        usage,
        limits: {
          ...getPlanLimits(plan),
          maxUsers: limits.maxUsers,
          maxTours: limits.maxTours,
          maxStorageBytes: limits.maxStorageBytes,
        },
        plan,
      })
      return
    }

    const fetchUsage = async () => {
      try {
        const response = await fetch('/api/usage')
        if (!response.ok) return

        const data = await response.json()
        setAlertData({
          usage: data.usage,
          limits: {
            ...getPlanLimits(data.plan),
            maxUsers: data.limits.maxUsers,
            maxTours: data.limits.maxTours,
            maxStorageBytes: data.limits.maxStorageBytes,
          },
          plan: data.plan,
        })
      } catch {
        // Silently fail
      }
    }

    fetchUsage()
  }, [usage, plan, limits])

  if (dismissed || !alertData) return null

  const nearQuota = isNearQuota(alertData.usage, alertData.limits)

  if (!nearQuota.any) return null

  // Construire les messages d'alerte
  const alerts: string[] = []

  if (nearQuota.tours) {
    const percent = getUsagePercent(alertData.usage.totalTours, alertData.limits.maxTours)
    alerts.push(`Tours: ${percent}% utilise`)
  }

  if (nearQuota.users) {
    const percent = getUsagePercent(alertData.usage.totalUsers, alertData.limits.maxUsers)
    alerts.push(`Utilisateurs: ${percent}% utilise`)
  }

  if (nearQuota.storage) {
    const percent = getUsagePercent(alertData.usage.storageBytes, alertData.limits.maxStorageBytes)
    alerts.push(`Stockage: ${percent}% utilise`)
  }

  // Ne pas afficher pour enterprise
  if (alertData.plan === 'enterprise') return null

  return (
    <div className="bg-orange-900/30 border border-orange-700/50 rounded-lg px-4 py-3 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          <p className="text-sm text-orange-200 font-medium">
            Vous approchez de vos limites
          </p>
          <p className="text-sm text-orange-300/80 mt-1">
            {alerts.join(' | ')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/dashboard/usage"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-orange-200 hover:text-white bg-orange-800/50 hover:bg-orange-800 rounded-lg transition-colors"
          >
            Voir details
            <ArrowUpRight className="w-4 h-4" />
          </Link>

          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-orange-400 hover:text-orange-200 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
