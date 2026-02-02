'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { getSupabase } from '@/lib/supabase'
import { VirtualTour } from '@/types/database'
import {
  Plus,
  Video,
  Search,
  Calendar,
  MapPin,
  Eye,
  Trash2,
  ExternalLink,
  MoreVertical,
  Filter
} from 'lucide-react'

type FilterStatus = 'all' | 'ready' | 'processing' | 'error'

export default function ToursPage() {
  const { user } = useAuth()
  const [tours, setTours] = useState<VirtualTour[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    const fetchTours = async () => {
      if (!user) return

      try {
        const supabase = getSupabase()

        const { data, error: fetchError } = await supabase
          .from('virtual_tours')
          .select('*')
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError

        setTours(data || [])
      } catch (err) {
        console.error('Error fetching tours:', err)
        setError('Erreur lors du chargement des visites')
      } finally {
        setLoading(false)
      }
    }

    fetchTours()
  }, [user])

  const handleDelete = async (tourId: string) => {
    try {
      const supabase = getSupabase()

      const { error: deleteError } = await supabase
        .from('virtual_tours')
        .delete()
        .eq('id', tourId)

      if (deleteError) throw deleteError

      setTours(tours.filter(t => t.id !== tourId))
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Error deleting tour:', err)
      setError('Erreur lors de la suppression')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-green-900/50 text-green-400 rounded-full">
            Pret
          </span>
        )
      case 'processing':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-yellow-900/50 text-yellow-400 rounded-full">
            En cours
          </span>
        )
      case 'error':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-red-900/50 text-red-400 rounded-full">
            Erreur
          </span>
        )
      default:
        return null
    }
  }

  const getPropertyTypeLabel = (type: string) => {
    switch (type) {
      case 'apartment': return 'Appartement'
      case 'house': return 'Maison'
      case 'commercial': return 'Commercial'
      default: return 'Autre'
    }
  }

  // Filtrer les tours
  const filteredTours = tours.filter(tour => {
    const matchesSearch = tour.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tour.address.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || tour.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Mes visites</h1>
          <p className="text-gray-400 mt-1">
            {tours.length} visite{tours.length > 1 ? 's' : ''} au total
          </p>
        </div>
        <Link
          href="/tours/new"
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Nouvelle visite</span>
        </Link>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par titre ou adresse..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
            className="pl-10 pr-8 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tous les statuts</option>
            <option value="ready">Pret</option>
            <option value="processing">En cours</option>
            <option value="error">Erreur</option>
          </select>
        </div>
      </div>

      {/* Tours grid */}
      {filteredTours.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
          <Video className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          {searchQuery || statusFilter !== 'all' ? (
            <>
              <p className="text-gray-400 mb-2">Aucune visite trouvee</p>
              <p className="text-sm text-gray-500">Essayez de modifier vos filtres</p>
            </>
          ) : (
            <>
              <p className="text-gray-400 mb-4">Aucune visite pour le moment</p>
              <Link
                href="/tours/new"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Creer votre premiere visite</span>
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTours.map((tour) => (
            <div
              key={tour.id}
              className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-gray-700">
                {tour.thumbnail_url ? (
                  <img
                    src={tour.thumbnail_url}
                    alt={tour.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="w-12 h-12 text-gray-600" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  {getStatusBadge(tour.status)}
                </div>
                {tour.has_lidar && (
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded">
                    LiDAR
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="text-white font-medium truncate">{tour.title}</h3>
                <div className="flex items-center space-x-1 mt-1 text-sm text-gray-400">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{tour.address}</span>
                </div>
                <div className="flex items-center justify-between mt-2 text-sm text-gray-500">
                  <span>{getPropertyTypeLabel(tour.property_type)}</span>
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDate(tour.created_at)}</span>
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                  <div className="flex items-center space-x-2">
                    <Link
                      href={`/tours/${tour.id}`}
                      className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      Gerer
                    </Link>
                    {tour.is_public && tour.public_slug && (
                      <Link
                        href={`/v/${tour.public_slug}`}
                        target="_blank"
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                        title="Voir la visite publique"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    )}
                  </div>

                  {deleteConfirm === tour.id ? (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleDelete(tour.id)}
                        className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                      >
                        Confirmer
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(tour.id)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
