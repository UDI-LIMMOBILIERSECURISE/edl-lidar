'use client'

import { getUsagePercent, getUsageColor, formatBytes, formatLimit } from '@/lib/plans'

interface QuotaCardProps {
  label: string
  current: number
  max: number
  unit?: 'count' | 'bytes' | 'gb'
  icon?: React.ReactNode
}

export default function QuotaCard({ label, current, max, unit = 'count', icon }: QuotaCardProps) {
  const percent = getUsagePercent(current, max)
  const color = getUsageColor(percent)

  // Formatage selon l'unite
  const formatValue = (value: number): string => {
    if (unit === 'bytes') {
      return formatBytes(value)
    }
    if (unit === 'gb') {
      if (value === Infinity) return 'Illimite'
      return `${value} GB`
    }
    return formatLimit(value)
  }

  // Couleurs selon le niveau
  const colorClasses = {
    green: {
      bar: 'bg-green-500',
      text: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    orange: {
      bar: 'bg-orange-500',
      text: 'text-orange-400',
      bg: 'bg-orange-500/10',
    },
    red: {
      bar: 'bg-red-500',
      text: 'text-red-400',
      bg: 'bg-red-500/10',
    },
  }

  const colors = colorClasses[color]

  // Affichage pour max infini
  const displayMax = max === Infinity ? 'Illimite' : formatValue(max)
  const displayCurrent = formatValue(current)

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div className={`p-2 rounded-lg ${colors.bg}`}>
              <div className={colors.text}>{icon}</div>
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-gray-400">{label}</h3>
            <p className="text-xl font-bold text-white">
              {displayCurrent}
              <span className="text-gray-500 text-sm font-normal"> / {displayMax}</span>
            </p>
          </div>
        </div>
        <div className={`text-2xl font-bold ${colors.text}`}>
          {max === Infinity ? '--' : `${percent}%`}
        </div>
      </div>

      {/* Progress bar */}
      {max !== Infinity && (
        <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      )}

      {max === Infinity && (
        <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 w-full opacity-30" />
        </div>
      )}
    </div>
  )
}
