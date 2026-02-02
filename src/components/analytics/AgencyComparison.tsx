'use client'

import { Building2 } from 'lucide-react'

interface AgencyData {
  name: string
  tours: number
  views: number
  liaSessions: number
}

interface AgencyComparisonProps {
  data: AgencyData[]
  isLoading?: boolean
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function AgencyComparison({ data, isLoading }: AgencyComparisonProps) {
  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-gray-400" />
          Comparaison par agence
        </h3>
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-gray-400" />
          Comparaison par agence
        </h3>
        <div className="text-center py-8 text-gray-500">
          Aucune agence configuree
        </div>
      </div>
    )
  }

  // Trouver les max pour normaliser les barres
  const maxViews = Math.max(...data.map(d => d.views), 1)
  const maxTours = Math.max(...data.map(d => d.tours), 1)
  const maxLia = Math.max(...data.map(d => d.liaSessions), 1)

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-white font-medium mb-4 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-gray-400" />
        Comparaison par agence
      </h3>

      <div className="space-y-6">
        {data.map((agency, index) => (
          <div key={agency.name} className="space-y-3">
            {/* Header agence */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-white font-medium truncate max-w-[150px]">
                  {agency.name}
                </span>
              </div>
              <span className="text-gray-400 text-sm">
                {agency.tours} visite{agency.tours > 1 ? 's' : ''}
              </span>
            </div>

            {/* Barres de metriques */}
            <div className="space-y-2 pl-5">
              {/* Vues */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Vues</span>
                  <span className="text-gray-300">{agency.views}</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(agency.views / maxViews) * 100}%`,
                      backgroundColor: COLORS[index % COLORS.length]
                    }}
                  />
                </div>
              </div>

              {/* Visites creees */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Visites creees</span>
                  <span className="text-gray-300">{agency.tours}</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(agency.tours / maxTours) * 100}%`,
                      backgroundColor: COLORS[index % COLORS.length],
                      opacity: 0.7
                    }}
                  />
                </div>
              </div>

              {/* Sessions Lia */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Sessions Lia</span>
                  <span className="text-gray-300">{agency.liaSessions}</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(agency.liaSessions / maxLia) * 100}%`,
                      backgroundColor: COLORS[index % COLORS.length],
                      opacity: 0.5
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Legende */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="flex flex-wrap gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-3 h-1.5 bg-blue-500 rounded-full" />
            <span>Vues</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-1.5 bg-blue-500/70 rounded-full" />
            <span>Visites</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-1.5 bg-blue-500/50 rounded-full" />
            <span>Sessions Lia</span>
          </div>
        </div>
      </div>
    </div>
  )
}
