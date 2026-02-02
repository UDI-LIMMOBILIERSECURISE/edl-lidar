'use client'

import Link from 'next/link'
import { Eye, Users, Clock, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react'

interface TopTour {
  tour_id: string
  title: string
  views: number
  unique_visitors?: number
  avg_duration?: number
  trend?: number
}

interface TopToursTableProps {
  tours: TopTour[]
  isLoading?: boolean
}

export default function TopToursTable({ tours, isLoading }: TopToursTableProps) {
  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700">
          <h3 className="text-white font-medium">Top visites</h3>
        </div>
        <div className="p-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )
  }

  if (!tours || tours.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700">
          <h3 className="text-white font-medium">Top visites</h3>
        </div>
        <div className="p-8 text-center text-gray-500">
          Aucune donnee disponible
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-700">
        <h3 className="text-white font-medium">Top 5 visites</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
              <th className="px-5 py-3 font-medium">Visite</th>
              <th className="px-5 py-3 font-medium text-center">
                <div className="flex items-center justify-center gap-1">
                  <Eye className="w-4 h-4" />
                  <span>Vues</span>
                </div>
              </th>
              <th className="px-5 py-3 font-medium text-center hidden sm:table-cell">
                <div className="flex items-center justify-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>Visiteurs</span>
                </div>
              </th>
              <th className="px-5 py-3 font-medium text-center hidden md:table-cell">
                <div className="flex items-center justify-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>Duree moy.</span>
                </div>
              </th>
              <th className="px-5 py-3 font-medium text-center hidden lg:table-cell">Tendance</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {tours.map((tour, index) => (
              <tr key={tour.tour_id} className="hover:bg-gray-700/50 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600/20 text-blue-400 rounded-lg flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate max-w-[200px]">
                        {tour.title || 'Sans titre'}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-center">
                  <span className="text-white font-semibold">{tour.views}</span>
                </td>
                <td className="px-5 py-4 text-center hidden sm:table-cell">
                  <span className="text-gray-300">{tour.unique_visitors || '-'}</span>
                </td>
                <td className="px-5 py-4 text-center hidden md:table-cell">
                  <span className="text-gray-300">
                    {tour.avg_duration ? formatDuration(tour.avg_duration) : '-'}
                  </span>
                </td>
                <td className="px-5 py-4 text-center hidden lg:table-cell">
                  {tour.trend !== undefined ? (
                    <div className={`inline-flex items-center gap-1 text-sm ${
                      tour.trend >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {tour.trend >= 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span>{tour.trend > 0 ? '+' : ''}{tour.trend}%</span>
                    </div>
                  ) : (
                    <MiniSparkline value={tour.views} />
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  <Link
                    href={`/dashboard/tours/${tour.tour_id}/analytics`}
                    className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <span className="hidden sm:inline">Details</span>
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

function MiniSparkline({ value }: { value: number }) {
  // Genere une mini sparkline basee sur la valeur
  const bars = [0.3, 0.5, 0.4, 0.7, 0.6, 0.8, 1].map((ratio, i) => (
    <div
      key={i}
      className="w-1 bg-blue-500 rounded-sm"
      style={{ height: `${ratio * 16}px`, opacity: 0.5 + (i * 0.07) }}
    />
  ))

  return (
    <div className="inline-flex items-end gap-0.5 h-4">
      {bars}
    </div>
  )
}
