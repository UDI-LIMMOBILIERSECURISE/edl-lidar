'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { isEntityAdmin, type UserProfile } from '@/lib/permissions'
import {
  Building2,
  Plus,
  Users,
  Video,
  MapPin,
  Phone,
  Edit,
  Trash2,
  AlertCircle,
  Search
} from 'lucide-react'

interface Agency {
  id: string
  entity_id: string
  name: string
  address: string | null
  phone: string | null
  created_at: string
  user_count: number
  tour_count: number
}

export default function AgenciesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAgencies = async () => {
      if (!user) return

      try {
        const response = await fetch('/api/agencies')
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Erreur lors du chargement')
        }

        setAgencies(data.agencies || [])
        setProfile(data.profile)

        // Rediriger si l'utilisateur n'est pas admin
        if (data.profile?.role !== 'entity_admin') {
          router.push('/dashboard')
        }
      } catch (err) {
        console.error('Erreur:', err)
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }

    fetchAgencies()
  }, [user, router])

  const handleDelete = async (agencyId: string) => {
    setDeleteError(null)

    try {
      const response = await fetch(`/api/agencies/${agencyId}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (!response.ok) {
        setDeleteError(data.error)
        return
      }

      setAgencies(agencies.filter(a => a.id !== agencyId))
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Erreur suppression:', err)
      setDeleteError('Erreur lors de la suppression')
    }
  }

  const filteredAgencies = agencies.filter(agency =>
    agency.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agency.address?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!isEntityAdmin(profile)) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-gray-400">Acces refuse. Cette page est reservee aux administrateurs.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Agences</h1>
          <p className="text-gray-400 mt-1">
            {agencies.length} agence{agencies.length > 1 ? 's' : ''} au total
          </p>
        </div>
        <Link
          href="/dashboard/agencies/new"
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Nouvelle agence</span>
        </Link>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {deleteError && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-400 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{deleteError}</span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher une agence..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Agencies grid */}
      {filteredAgencies.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
          <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          {searchQuery ? (
            <>
              <p className="text-gray-400 mb-2">Aucune agence trouvee</p>
              <p className="text-sm text-gray-500">Essayez avec un autre terme de recherche</p>
            </>
          ) : (
            <>
              <p className="text-gray-400 mb-4">Aucune agence pour le moment</p>
              <Link
                href="/dashboard/agencies/new"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Creer votre premiere agence</span>
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgencies.map((agency) => (
            <div
              key={agency.id}
              className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors"
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{agency.name}</h3>
                      {agency.address && (
                        <div className="flex items-center space-x-1 mt-0.5 text-sm text-gray-400">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{agency.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="p-4 grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">{agency.user_count}</p>
                    <p className="text-xs text-gray-500">Utilisateur{agency.user_count > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                    <Video className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">{agency.tour_count}</p>
                    <p className="text-xs text-gray-500">Visite{agency.tour_count > 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>

              {/* Phone if exists */}
              {agency.phone && (
                <div className="px-4 pb-2">
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <Phone className="w-4 h-4" />
                    <span>{agency.phone}</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="p-4 border-t border-gray-700 flex items-center justify-between">
                <Link
                  href={`/dashboard/agencies/${agency.id}`}
                  className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  <span>Gerer</span>
                </Link>

                {deleteConfirm === agency.id ? (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDelete(agency.id)}
                      className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                    >
                      Confirmer
                    </button>
                    <button
                      onClick={() => {
                        setDeleteConfirm(null)
                        setDeleteError(null)
                      }}
                      className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(agency.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
