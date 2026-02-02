'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { isEntityAdmin, type UserProfile } from '@/lib/permissions'
import {
  Building2,
  ArrowLeft,
  MapPin,
  Phone,
  AlertCircle,
  Loader2,
  Users,
  Video,
  Trash2,
  Save,
  User,
  Mail
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

interface AgencyUser {
  id: string
  user_id: string
  first_name: string | null
  last_name: string | null
  role: string
  email?: string
}

export default function AgencyDetailPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const agencyId = params.id as string

  const [agency, setAgency] = useState<Agency | null>(null)
  const [users, setUsers] = useState<AgencyUser[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
  })

  useEffect(() => {
    const fetchAgency = async () => {
      if (!user || !agencyId) return

      try {
        const response = await fetch(`/api/agencies/${agencyId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Erreur lors du chargement')
        }

        setAgency(data.agency)
        setUsers(data.users || [])
        setProfile(data.profile)
        setFormData({
          name: data.agency.name || '',
          address: data.agency.address || '',
          phone: data.agency.phone || '',
        })

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

    fetchAgency()
  }, [user, agencyId, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!formData.name.trim()) {
      setError('Le nom de l\'agence est requis')
      return
    }

    setSaving(true)

    try {
      const response = await fetch(`/api/agencies/${agencyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la mise a jour')
      }

      setAgency(data.agency)
      setSuccess('Agence mise a jour avec succes')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Erreur:', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
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

      router.push('/dashboard/agencies')
    } catch (err) {
      console.error('Erreur suppression:', err)
      setDeleteError('Erreur lors de la suppression')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'entity_admin':
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-purple-900/50 text-purple-400 rounded-full">
            Admin
          </span>
        )
      case 'agency_manager':
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-900/50 text-blue-400 rounded-full">
            Manager
          </span>
        )
      default:
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-gray-700 text-gray-400 rounded-full">
            Operateur
          </span>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!agency || !isEntityAdmin(profile)) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-gray-400">
          {!agency ? 'Agence non trouvee' : 'Acces refuse'}
        </p>
        <Link
          href="/dashboard/agencies"
          className="inline-flex items-center space-x-2 mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour aux agences</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/agencies"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{agency.name}</h1>
            <p className="text-gray-400 mt-1">Creee le {formatDate(agency.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{agency.user_count}</p>
              <p className="text-sm text-gray-500">Utilisateur{agency.user_count > 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
              <Video className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{agency.tour_count}</p>
              <p className="text-sm text-gray-500">Visite{agency.tour_count > 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-400 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-900/20 border border-green-500 rounded-lg p-4 text-green-400">
          {success}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white">Informations de l'agence</h2>

        {/* Nom */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
            Nom de l'agence <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Agence Paris Centre"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>

        {/* Adresse */}
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-300 mb-2">
            Adresse
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Ex: 12 Rue de la Paix, 75002 Paris"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Telephone */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">
            Telephone
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Ex: 01 23 45 67 89"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-700">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Enregistrer</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Users list */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Utilisateurs de l'agence</h2>
          <p className="text-sm text-gray-400 mt-1">
            {users.length} utilisateur{users.length > 1 ? 's' : ''} dans cette agence
          </p>
        </div>

        {users.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400">Aucun utilisateur dans cette agence</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {users.map((agencyUser) => (
              <div key={agencyUser.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      {agencyUser.first_name || agencyUser.last_name
                        ? `${agencyUser.first_name || ''} ${agencyUser.last_name || ''}`.trim()
                        : 'Utilisateur'}
                    </p>
                    {agencyUser.email && (
                      <div className="flex items-center space-x-1 text-sm text-gray-400">
                        <Mail className="w-3.5 h-3.5" />
                        <span>{agencyUser.email}</span>
                      </div>
                    )}
                  </div>
                </div>
                {getRoleBadge(agencyUser.role)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="bg-gray-800 rounded-xl border border-red-900/50 overflow-hidden">
        <div className="p-4 border-b border-red-900/50">
          <h2 className="text-lg font-semibold text-red-400">Zone de danger</h2>
        </div>
        <div className="p-4">
          {deleteError && (
            <div className="mb-4 bg-red-900/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          {deleteConfirm ? (
            <div className="flex items-center justify-between">
              <p className="text-gray-400">
                Etes-vous sur de vouloir supprimer cette agence ?
              </p>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                >
                  Confirmer la suppression
                </button>
                <button
                  onClick={() => {
                    setDeleteConfirm(false)
                    setDeleteError(null)
                  }}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Supprimer l'agence</p>
                <p className="text-sm text-gray-400">
                  Cette action est irreversible. L'agence ne peut etre supprimee que si elle ne contient aucun utilisateur.
                </p>
              </div>
              <button
                onClick={() => setDeleteConfirm(true)}
                className="flex items-center space-x-2 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Supprimer</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
