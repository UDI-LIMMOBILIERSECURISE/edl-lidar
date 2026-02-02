'use client'

import { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  trend?: number // Pourcentage de variation (+/-)
  trendLabel?: string
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red'
}

const colorClasses = {
  blue: 'bg-blue-500/20 text-blue-400',
  green: 'bg-green-500/20 text-green-400',
  purple: 'bg-purple-500/20 text-purple-400',
  orange: 'bg-orange-500/20 text-orange-400',
  red: 'bg-red-500/20 text-red-400'
}

export default function StatsCard({
  icon: Icon,
  label,
  value,
  trend,
  trendLabel,
  color = 'blue'
}: StatsCardProps) {
  const isPositive = trend !== undefined && trend >= 0

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-lg ${colorClasses[color]}`}>
          <Icon size={22} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${
            isPositive ? 'text-green-400' : 'text-red-400'
          }`}>
            <span>{isPositive ? '+' : ''}{trend}%</span>
            {trendLabel && (
              <span className="text-gray-500 text-xs">{trendLabel}</span>
            )}
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-gray-400 text-sm mt-1">{label}</p>
      </div>
    </div>
  )
}
