'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, Printer, FileText, Loader2 } from 'lucide-react'

interface ExportData {
  tour: {
    id: string
    title: string
    address: string
    property_type: string
    has_lidar: boolean
  }
  rooms: Array<{
    name: string
    type: string
    floor_m2: number | null
    walls_m2: number | null
    ceiling_m2: number | null
    ceiling_height_m: number | null
  }>
  totals: {
    floor_m2: number
    walls_m2: number
    ceiling_m2: number
  }
  generated_at: string
}

export default function ExportPage() {
  const params = useParams()
  const tourId = params.id as string
  const [data, setData] = useState<ExportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchExportData()
  }, [tourId])

  const fetchExportData = async () => {
    try {
      const response = await fetch(`/api/tours/${tourId}/export`)
      if (!response.ok) throw new Error('Erreur chargement')
      const exportData = await response.json()
      setData(exportData)
    } catch (err) {
      setError('Impossible de charger les donnees')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 size={48} className="text-blue-500 animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <p className="text-red-500 mb-4">{error}</p>
        <Link href={`/tours/${tourId}`} className="text-blue-500 hover:underline">
          Retour a la visite
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header - hidden on print */}
      <header className="bg-white shadow print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/tours/${tourId}`} className="text-gray-500 hover:text-gray-700">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-xl font-bold">Export Metre</h1>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Printer size={18} />
            Imprimer / PDF
          </button>
        </div>
      </header>

      {/* Content - printable */}
      <main className="max-w-4xl mx-auto p-8 bg-white my-8 shadow print:shadow-none print:my-0">
        {/* Document header */}
        <div className="border-b-2 border-gray-200 pb-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Releve de Surfaces</h1>
              <p className="text-gray-500 mt-1">{data.tour.title}</p>
              <p className="text-gray-500">{data.tour.address}</p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>Genere le {new Date(data.generated_at).toLocaleDateString('fr-FR')}</p>
              {data.tour.has_lidar && (
                <span className="inline-block mt-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                  Mesures LiDAR
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Rooms table */}
        <table className="w-full mb-8">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-3 font-semibold">Piece</th>
              <th className="text-right py-3 font-semibold">Sol (m2)</th>
              <th className="text-right py-3 font-semibold">Murs (m2)</th>
              <th className="text-right py-3 font-semibold">Plafond (m2)</th>
              <th className="text-right py-3 font-semibold">Hauteur (m)</th>
            </tr>
          </thead>
          <tbody>
            {data.rooms.map((room, index) => (
              <tr key={index} className="border-b border-gray-200">
                <td className="py-3">{room.name}</td>
                <td className="text-right py-3">{room.floor_m2?.toFixed(2) || '-'}</td>
                <td className="text-right py-3">{room.walls_m2?.toFixed(2) || '-'}</td>
                <td className="text-right py-3">{room.ceiling_m2?.toFixed(2) || '-'}</td>
                <td className="text-right py-3">{room.ceiling_height_m?.toFixed(2) || '-'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-bold">
              <td className="py-3">TOTAL</td>
              <td className="text-right py-3">{data.totals.floor_m2.toFixed(2)}</td>
              <td className="text-right py-3">{data.totals.walls_m2.toFixed(2)}</td>
              <td className="text-right py-3">{data.totals.ceiling_m2.toFixed(2)}</td>
              <td className="text-right py-3">-</td>
            </tr>
          </tfoot>
        </table>

        {/* Note */}
        {!data.tour.has_lidar && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            <strong>Note:</strong> Cette visite n'a pas ete realisee avec un appareil LiDAR.
            Les surfaces ne sont pas disponibles. Pour des mesures precises, utilisez un iPhone Pro ou iPad Pro.
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-200 text-sm text-gray-500 text-center">
          <p>Document genere par EDL LIDAR</p>
          <p>www.edl-lidar.com</p>
        </div>
      </main>
    </div>
  )
}
