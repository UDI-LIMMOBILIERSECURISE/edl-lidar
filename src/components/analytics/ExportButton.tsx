'use client'

import { useState, useRef, useEffect } from 'react'
import { Download, ChevronDown, FileSpreadsheet, Eye, MessageSquare } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'

interface ExportButtonProps {
  days?: number
}

type ExportType = 'tours' | 'views' | 'lia'

const exportOptions: { type: ExportType; label: string; icon: React.ReactNode; description: string }[] = [
  {
    type: 'tours',
    label: 'Visites',
    icon: <FileSpreadsheet className="w-4 h-4" />,
    description: 'Liste de toutes vos visites'
  },
  {
    type: 'views',
    label: 'Vues',
    icon: <Eye className="w-4 h-4" />,
    description: 'Sessions de visualisation'
  },
  {
    type: 'lia',
    label: 'Sessions Lia',
    icon: <MessageSquare className="w-4 h-4" />,
    description: 'Interactions avec Lia'
  }
]

export default function ExportButton({ days = 30 }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState<ExportType | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fermer le dropdown quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleExport = async (type: ExportType) => {
    setIsExporting(type)

    try {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        alert('Vous devez etre connecte pour exporter')
        return
      }

      const response = await fetch(`/api/analytics/export?type=${type}&days=${days}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Recuperer le nom du fichier depuis les headers
      const contentDisposition = response.headers.get('content-disposition')
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch?.[1] || `export_${type}_${new Date().toISOString().split('T')[0]}.csv`

      // Telecharger le fichier
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setIsOpen(false)
    } catch (error) {
      console.error('Export error:', error)
      alert('Erreur lors de l\'export')
    } finally {
      setIsExporting(null)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
      >
        <Download className="w-4 h-4" />
        <span>Exporter</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700">
            <p className="text-sm text-gray-400">Exporter en CSV</p>
          </div>

          <div className="py-2">
            {exportOptions.map((option) => (
              <button
                key={option.type}
                onClick={() => handleExport(option.type)}
                disabled={isExporting !== null}
                className="w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-700/50 transition-colors disabled:opacity-50"
              >
                <div className="flex-shrink-0 mt-0.5 text-gray-400">
                  {isExporting === option.type ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500" />
                  ) : (
                    option.icon
                  )}
                </div>
                <div className="text-left">
                  <p className="text-white font-medium text-sm">{option.label}</p>
                  <p className="text-gray-500 text-xs">{option.description}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="px-4 py-3 border-t border-gray-700 bg-gray-800/50">
            <p className="text-xs text-gray-500">
              Periode: {days} derniers jours
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
