'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { getSupabase } from '@/lib/supabase'
import InviteModal from '@/components/InviteModal'
import {
  Users,
  UserPlus,
  Shield,
  Building2,
  Mail,
  Clock,
  MoreVertical,
  Trash2,
  Edit,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react'

interface UserProfile {
  id: string
  display_name: string | null
  role: 'entity_admin' | 'agency_manager' | 'agent'
  agency_ids: string[]
  created_at: string
  email?: string
}

interface Invitation {
  id: string
  email: string
  role: 'entity_admin' | 'agency_manager' | 'agent'
  agency_ids: string[]
  expires_at: string
  accepted_at: string | null
  created_at: string
  status: 'pending' | 'accepted' | 'expired'
}

interface Agency {
  id: string
  name: string
}

const roleLabels: Record<string, string> = {
  entity_admin: 'Admin',
  agency_manager: 'Manager',
  agent: 'Agent'
}

const roleColors: Record<string, string> = {
  entity_admin: 'bg-purple-600',
  agency_manager: 'bg-blue-600',
  agent: 'bg-green-600'
}

const statusLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: 'En attente',
    color: 'text-yellow-500',
    icon: <Clock className="w-4 h-4" />
  },
  accepted: {
    label: 'Acceptee',
    color: 'text-green-500',
    icon: <CheckCircle className="w-4 h-4" />
  },
  expired: {
    label: 'Expiree',
    color: 'text-red-500',
    icon: <XCircle className="w-4 h-4" />
  }
}

export default function TeamPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<{ role: string; entity_id: string } | null>(null)
  const [members, setMembers] = useState<UserProfile[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Charger les donnees
  const loadData = useCallback(async () => {
    if (!user) return

    try {
      const supabase = getSupabase()

      // Recuperer le profil utilisateur
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, entity_id')
        .eq('id', user.id)
        .single()

      if (!profile) {
        router.push('/dashboard')
        return
      }

      setUserProfile(profile)

      // Verifier les permissions
      if (profile.role !== 'entity_admin' && profile.role !== 'agency_manager') {
        router.push('/dashboard')
        return
      }

      // Charger les membres de l'entity
      const { data: membersData } = await supabase
        .from('user_profiles')
        .select('id, display_name, role, agency_ids, created_at')
        .eq('entity_id', profile.entity_id)
        .order('created_at', { ascending: true })

      // Recuperer les emails des membres via auth
      const membersWithEmail = await Promise.all(
        (membersData || []).map(async (member) => {
          // Note: En production, utiliser une fonction edge ou API route
          // pour recuperer les emails (pas accessible cote client)
          return {
            ...member,
            email: member.id === user.id ? user.email : undefined
          }
        })
      )

      setMembers(membersWithEmail as UserProfile[])

      // Charger les invitations
      const invResponse = await fetch('/api/invitations')
      if (invResponse.ok) {
        const invData = await invResponse.json()
        setInvitations(invData.invitations || [])
      }

      // Charger les agences
      const { data: agenciesData } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('entity_id', profile.entity_id)

      setAgencies(agenciesData || [])

    } catch (error) {
      console.error('Erreur chargement equipe:', error)
    } finally {
      setLoading(false)
    }
  }, [user, router])

  useEffect(() => {
    if (!authLoading && user) {
      loadData()
    } else if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, loadData, router])

  // Supprimer un membre
  const handleRemoveMember = async (memberId: string) => {
    if (memberId === user?.id) {
      alert('Vous ne pouvez pas vous retirer vous-meme')
      return
    }

    if (!confirm('Etes-vous sur de vouloir retirer cet utilisateur ?')) {
      return
    }

    setDeletingId(memberId)
    try {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', memberId)

      if (error) throw error

      setMembers(members.filter(m => m.id !== memberId))
    } catch (error) {
      console.error('Erreur suppression membre:', error)
      alert('Erreur lors de la suppression')
    } finally {
      setDeletingId(null)
      setActiveDropdown(null)
    }
  }

  // Annuler une invitation
  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('Annuler cette invitation ?')) {
      return
    }

    setDeletingId(invitationId)
    try {
      const response = await fetch(`/api/invitations?id=${invitationId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Erreur suppression')

      setInvitations(invitations.filter(i => i.id !== invitationId))
    } catch (error) {
      console.error('Erreur annulation invitation:', error)
      alert('Erreur lors de l\'annulation')
    } finally {
      setDeletingId(null)
      setActiveDropdown(null)
    }
  }

  // Renvoyer une invitation
  const handleResendInvitation = async (invitation: Invitation) => {
    // TODO: Implementer le renvoi d'email
    alert('Fonctionnalite a venir: renvoi d\'invitation')
  }

  // Callback apres creation d'invitation
  const handleInvitationCreated = () => {
    loadData()
    setShowInviteModal(false)
  }

  // Obtenir le nom des agences
  const getAgencyNames = (agencyIds: string[]) => {
    if (!agencyIds || agencyIds.length === 0) return '-'
    return agencyIds
      .map(id => agencies.find(a => a.id === id)?.name || 'Agence inconnue')
      .join(', ')
  }

  // Fermer dropdown au clic ailleurs
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null)
    if (activeDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [activeDropdown])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  const canInvite = userProfile?.role === 'entity_admin' || userProfile?.role === 'agency_manager'
  const isAdmin = userProfile?.role === 'entity_admin'

  const pendingInvitations = invitations.filter(i => i.status === 'pending')

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center space-x-3">
            <Users className="w-8 h-8 text-blue-500" />
            <span>Mon equipe</span>
          </h1>
          <p className="text-gray-400 mt-1">
            {members.length} membre{members.length > 1 ? 's' : ''} actif{members.length > 1 ? 's' : ''}
            {pendingInvitations.length > 0 && (
              <span className="ml-2 text-yellow-500">
                + {pendingInvitations.length} invitation{pendingInvitations.length > 1 ? 's' : ''} en attente
              </span>
            )}
          </p>
        </div>

        {canInvite && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            <span>Inviter</span>
          </button>
        )}
      </div>

      {/* Membres actifs */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Membres actifs</h2>
        </div>

        <div className="divide-y divide-gray-700">
          {members.map((member) => (
            <div
              key={member.id}
              className="px-6 py-4 flex items-center justify-between hover:bg-gray-750"
            >
              <div className="flex items-center space-x-4">
                {/* Avatar */}
                <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium">
                    {member.display_name?.charAt(0).toUpperCase() ||
                      member.email?.charAt(0).toUpperCase() ||
                      '?'}
                  </span>
                </div>

                {/* Info */}
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-medium">
                      {member.display_name || member.email || 'Utilisateur'}
                    </span>
                    {member.id === user?.id && (
                      <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded">
                        Vous
                      </span>
                    )}
                  </div>
                  {member.email && (
                    <p className="text-sm text-gray-400">{member.email}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {/* Role badge */}
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium text-white ${roleColors[member.role]}`}>
                  {roleLabels[member.role]}
                </span>

                {/* Agences */}
                {member.role !== 'entity_admin' && agencies.length > 0 && (
                  <div className="flex items-center space-x-1 text-sm text-gray-400">
                    <Building2 className="w-4 h-4" />
                    <span>{getAgencyNames(member.agency_ids)}</span>
                  </div>
                )}

                {/* Actions (seulement pour admin et pas soi-meme) */}
                {isAdmin && member.id !== user?.id && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveDropdown(activeDropdown === member.id ? null : member.id)
                      }}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    {activeDropdown === member.id && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-gray-700 rounded-lg shadow-xl border border-gray-600 py-1 z-10">
                        <button
                          onClick={() => {/* TODO: Edit role */}}
                          className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-600 flex items-center space-x-2"
                        >
                          <Edit className="w-4 h-4" />
                          <span>Modifier le role</span>
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={deletingId === member.id}
                          className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-600 flex items-center space-x-2"
                        >
                          {deletingId === member.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          <span>Retirer l'acces</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {members.length === 0 && (
            <div className="px-6 py-12 text-center text-gray-500">
              Aucun membre dans l'equipe
            </div>
          )}
        </div>
      </div>

      {/* Invitations en attente */}
      {pendingInvitations.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-semibold text-white">Invitations en attente</h2>
          </div>

          <div className="divide-y divide-gray-700">
            {pendingInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-750"
              >
                <div className="flex items-center space-x-4">
                  {/* Icon email */}
                  <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-gray-400" />
                  </div>

                  {/* Info */}
                  <div>
                    <p className="text-white">{invitation.email}</p>
                    <p className="text-sm text-gray-400">
                      Expire le{' '}
                      {new Date(invitation.expires_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short'
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  {/* Role badge */}
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium text-white ${roleColors[invitation.role]}`}>
                    {roleLabels[invitation.role]}
                  </span>

                  {/* Actions */}
                  {isAdmin && (
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveDropdown(activeDropdown === `inv-${invitation.id}` ? null : `inv-${invitation.id}`)
                        }}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {activeDropdown === `inv-${invitation.id}` && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-gray-700 rounded-lg shadow-xl border border-gray-600 py-1 z-10">
                          <button
                            onClick={() => handleResendInvitation(invitation)}
                            className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-600 flex items-center space-x-2"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>Renvoyer l'email</span>
                          </button>
                          <button
                            onClick={() => handleCancelInvitation(invitation.id)}
                            disabled={deletingId === invitation.id}
                            className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-600 flex items-center space-x-2"
                          >
                            {deletingId === invitation.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            <span>Annuler l'invitation</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Permissions info */}
      {!isAdmin && (
        <div className="mt-8 p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
          <div>
            <p className="text-yellow-400 font-medium">Permissions limitees</p>
            <p className="text-yellow-500/80 text-sm mt-1">
              En tant que manager, vous pouvez uniquement inviter des agents.
              Contactez un administrateur pour gerer les autres membres.
            </p>
          </div>
        </div>
      )}

      {/* Modal d'invitation */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInvitationCreated}
          agencies={agencies}
          userRole={userProfile?.role || 'agent'}
        />
      )}
    </div>
  )
}
