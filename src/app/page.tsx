'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { VirtualTour } from '@/types/database'
import { Plus, Play, Eye, Calendar, MapPin } from 'lucide-react'

export default function HomePage() {
  const [tours, setTours] = useState<VirtualTour[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTours()
  }, [])

  const loadTours = async () => {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('virtual_tours')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erreur chargement tours:', error)
    } else {
      setTours(data || [])
    }
    setLoading(false)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      processing: 'bg-yellow-100 text-yellow-800',
      ready: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800'
    }
    const labels = {
      processing: 'En cours',
      ready: 'Prête',
      error: 'Erreur'
    }
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                EDL LIDAR
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Visites Virtuelles Interactives
              </p>
            </div>
            <Link
              href="/tours/new"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus size={20} />
              Nouvelle visite
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner" />
          </div>
        ) : tours.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Play size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Aucune visite virtuelle
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Créez votre première visite virtuelle interactive
            </p>
            <Link
              href="/tours/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus size={20} />
              Créer une visite
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tours.map((tour) => (
              <div
                key={tour.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden hover:shadow-lg transition"
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-gray-200 dark:bg-gray-700 relative">
                  {tour.thumbnail_url ? (
                    <img
                      src={tour.thumbnail_url}
                      alt={tour.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Play size={48} className="text-gray-400" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    {getStatusBadge(tour.status)}
                  </div>
                  {tour.has_lidar && (
                    <div className="absolute top-2 left-2 bg-purple-600 text-white px-2 py-1 text-xs rounded">
                      LiDAR
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {tour.title}
                  </h3>
                  <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-2">
                    <MapPin size={14} />
                    {tour.address}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <Calendar size={14} />
                    {formatDate(tour.created_at)}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {tour.status === 'ready' && (
                      <>
                        <Link
                          href={`/tours/${tour.id}`}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
                        >
                          <Play size={16} />
                          Voir
                        </Link>
                        {tour.is_public && tour.public_slug && (
                          <Link
                            href={`/v/${tour.public_slug}`}
                            className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                          >
                            <Eye size={16} />
                          </Link>
                        )}
                      </>
                    )}
                    {tour.status === 'processing' && (
                      <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-yellow-100 text-yellow-800 text-sm rounded-lg">
                        <div className="spinner" />
                        Traitement en cours...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
