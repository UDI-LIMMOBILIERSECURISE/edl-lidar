'use client'

import { useState } from 'react'
import { X, Mail, Shield, Building2, Send, Loader2, Copy, CheckCircle } from 'lucide-react'

interface Agency {
  id: string
  name: string
}

interface InviteModalProps {
  onClose: () => void
  onSuccess: () => void
  agencies: Agency[]
  userRole: string
}

const roleOptions = [
  {
    value: 'entity_admin',
    label: 'Administrateur',
    description: 'Acces complet: equipe, agences, parametres',
    adminOnly: true
  },
  {
    value: 'agency_manager',
    label: 'Manager d\'agence',
    description: 'Gestion des agences assignees et leurs agents',
    adminOnly: true
  },
  {
    value: 'agent',
    label: 'Agent',
    description: 'Creation et gestion de ses propres visites',
    adminOnly: false
  }
]

export default function InviteModal({ onClose, onSuccess, agencies, userRole }: InviteModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'entity_admin' | 'agency_manager' | 'agent'>('agent')
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const isAdmin = userRole === 'entity_admin'

  // Filtrer les roles selon les permissions
  const availableRoles = roleOptions.filter(r => isAdmin || !r.adminOnly)

  // Gerer la soumission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Format email invalide')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.toLowerCase(),
          role,
          agency_ids: role !== 'entity_admin' ? selectedAgencies : []
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Erreur lors de la creation de l\'invitation')
        setLoading(false)
        return
      }

      // Succes - afficher le lien
      setInviteUrl(data.invitation.invite_url)

    } catch (err) {
      console.error('Erreur invitation:', err)
      setError('Erreur lors de l\'envoi de l\'invitation')
    } finally {
      setLoading(false)
    }
  }

  // Copier le lien
  const handleCopy = async () => {
    if (inviteUrl) {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Toggle agence
  const toggleAgency = (agencyId: string) => {
    setSelectedAgencies(prev =>
      prev.includes(agencyId)
        ? prev.filter(id => id !== agencyId)
        : [...prev, agencyId]
    )
  }

  // Affichage succes
  if (inviteUrl) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
        <div className="bg-gray-800 rounded-xl w-full max-w-md shadow-xl border border-gray-700">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">Invitation envoyee</h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-white font-medium">
                Invitation envoyee a {email}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Un email a ete envoye avec le lien d'invitation
              </p>
            </div>

            {/* Lien d'invitation */}
            <div className="bg-gray-900 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-2">Lien d'invitation:</p>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={inviteUrl}
                  readOnly
                  className="flex-1 bg-transparent border-none text-gray-300 text-sm truncate outline-none"
                />
                <button
                  onClick={handleCopy}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {copied ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-4 text-center">
              Ce lien expire dans 7 jours
            </p>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-700">
            <button
              onClick={() => {
                onSuccess()
                onClose()
              }}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Terminer
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-gray-800 rounded-xl w-full max-w-md shadow-xl border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Inviter un membre</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Mail className="w-4 h-4 inline-block mr-2" />
                Adresse email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="collegue@example.com"
                required
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Shield className="w-4 h-4 inline-block mr-2" />
                Role
              </label>
              <div className="space-y-2">
                {availableRoles.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${
                      role === option.value
                        ? 'bg-blue-600/20 border-blue-500'
                        : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={option.value}
                      checked={role === option.value}
                      onChange={(e) => setRole(e.target.value as typeof role)}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <span className="text-white font-medium block">
                        {option.label}
                      </span>
                      <span className="text-gray-400 text-sm">
                        {option.description}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Agences (si pas admin et agences disponibles) */}
            {role !== 'entity_admin' && agencies.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Building2 className="w-4 h-4 inline-block mr-2" />
                  Agences assignees
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {agencies.map((agency) => (
                    <label
                      key={agency.id}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedAgencies.includes(agency.id)
                          ? 'bg-blue-600/20 border-blue-500'
                          : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAgencies.includes(agency.id)}
                        onChange={() => toggleAgency(agency.id)}
                        className="mr-3"
                      />
                      <span className="text-white">{agency.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {role === 'agency_manager'
                    ? 'Le manager pourra gerer les agents de ces agences'
                    : 'L\'agent pourra creer des visites pour ces agences'}
                </p>
              </div>
            )}

            {/* Erreur */}
            {error && (
              <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-700 flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !email}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Envoi...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Envoyer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
