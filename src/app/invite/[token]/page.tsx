'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { Building2, Mail, Shield, Eye, EyeOff, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface InvitationInfo {
  valid: boolean
  error?: string
  email?: string
  role?: string
  entity_name?: string
  entity_logo?: string
  expires_at?: string
}

const roleLabels: Record<string, string> = {
  entity_admin: 'Administrateur',
  agency_manager: 'Manager d\'agence',
  agent: 'Agent'
}

const roleDescriptions: Record<string, string> = {
  entity_admin: 'Acces complet: gestion equipe, agences, factures',
  agency_manager: 'Gestion de vos agences et agents',
  agent: 'Creation et gestion de vos visites virtuelles'
}

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Form states
  const [mode, setMode] = useState<'new' | 'login'>('new')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)

  // Charger les infos de l'invitation
  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        // Verifier si deja connecte
        const supabase = getSupabase()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setIsLoggedIn(true)
          setCurrentUserEmail(user.email || null)
        }

        // Recuperer les infos de l'invitation
        const response = await fetch(`/api/invitations/${token}/accept`)
        const data = await response.json()

        if (!response.ok || !data.valid) {
          setError(data.error || 'Invitation invalide')
          setInvitationInfo(null)
        } else {
          setInvitationInfo(data)

          // Si connecte avec le bon email, on peut accepter directement
          if (user && user.email?.toLowerCase() === data.email?.toLowerCase()) {
            setMode('login')
          }
        }
      } catch (err) {
        console.error('Erreur chargement invitation:', err)
        setError('Erreur lors du chargement de l\'invitation')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchInvitation()
    }
  }, [token])

  // Connexion avec email/password existant
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const supabase = getSupabase()
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: invitationInfo?.email || '',
        password
      })

      if (loginError) {
        setError('Email ou mot de passe incorrect')
        setSubmitting(false)
        return
      }

      // Une fois connecte, accepter l'invitation
      await acceptInvitation()
    } catch (err) {
      console.error('Erreur connexion:', err)
      setError('Erreur lors de la connexion')
      setSubmitting(false)
    }
  }

  // Creer un compte et accepter
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    // Validations
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caracteres')
      setSubmitting(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      setSubmitting(false)
      return
    }

    try {
      await acceptInvitation(password)
    } catch (err) {
      console.error('Erreur inscription:', err)
      setError('Erreur lors de la creation du compte')
      setSubmitting(false)
    }
  }

  // Accepter l'invitation (avec ou sans password)
  const acceptInvitation = async (newPassword?: string) => {
    try {
      const response = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPassword ? { password: newPassword } : {})
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.requires_login) {
          setMode('login')
          setError('Un compte existe deja. Veuillez vous connecter.')
        } else if (data.email_mismatch) {
          setError(`Vous etes connecte avec un autre email. L'invitation est pour ${data.expected_email}`)
        } else {
          setError(data.error || 'Erreur lors de l\'acceptation')
        }
        setSubmitting(false)
        return
      }

      // Succes
      setSuccess(true)

      // Si nouveau compte, connecter automatiquement
      if (data.is_new_user && newPassword) {
        const supabase = getSupabase()
        await supabase.auth.signInWithPassword({
          email: invitationInfo?.email || '',
          password: newPassword
        })
      }

      // Rediriger vers le dashboard apres 2 secondes
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)

    } catch (err) {
      console.error('Erreur acceptation:', err)
      setError('Erreur lors de l\'acceptation de l\'invitation')
      setSubmitting(false)
    }
  }

  // Accepter directement si deja connecte avec le bon email
  const handleAcceptLoggedIn = async () => {
    setSubmitting(true)
    setError(null)
    await acceptInvitation()
  }

  // Affichage loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Chargement de l'invitation...</p>
        </div>
      </div>
    )
  }

  // Affichage erreur (invitation invalide)
  if (error && !invitationInfo) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Invitation invalide</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Retour a la connexion
          </button>
        </div>
      </div>
    )
  }

  // Affichage succes
  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Bienvenue !</h1>
          <p className="text-gray-400 mb-2">
            Vous avez rejoint <span className="text-white font-medium">{invitationInfo?.entity_name}</span>
          </p>
          <p className="text-gray-400 mb-6">
            Role: <span className="text-blue-400">{roleLabels[invitationInfo?.role || 'agent']}</span>
          </p>
          <div className="flex items-center justify-center space-x-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Redirection vers le dashboard...</span>
          </div>
        </div>
      </div>
    )
  }

  // Formulaire principal
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Invitation a rejoindre</h1>
          <p className="text-xl text-blue-400 font-semibold">{invitationInfo?.entity_name}</p>
        </div>

        {/* Card */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          {/* Info invitation */}
          <div className="mb-6 p-4 bg-gray-900 rounded-lg space-y-3">
            <div className="flex items-center space-x-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <span className="text-gray-300">{invitationInfo?.email}</span>
            </div>
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <span className="text-white font-medium block">
                  {roleLabels[invitationInfo?.role || 'agent']}
                </span>
                <span className="text-gray-500 text-sm">
                  {roleDescriptions[invitationInfo?.role || 'agent']}
                </span>
              </div>
            </div>
          </div>

          {/* Si deja connecte avec le bon email */}
          {isLoggedIn && currentUserEmail?.toLowerCase() === invitationInfo?.email?.toLowerCase() ? (
            <div>
              <div className="flex items-center space-x-2 mb-4 p-3 bg-blue-900/30 rounded-lg border border-blue-800">
                <AlertCircle className="w-5 h-5 text-blue-400" />
                <span className="text-blue-300 text-sm">
                  Vous etes connecte en tant que {currentUserEmail}
                </span>
              </div>
              <button
                onClick={handleAcceptLoggedIn}
                disabled={submitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Acceptation en cours...</span>
                  </>
                ) : (
                  <span>Accepter l'invitation</span>
                )}
              </button>
            </div>
          ) : (
            <>
              {/* Tabs nouveau compte / connexion */}
              <div className="flex space-x-2 mb-6">
                <button
                  onClick={() => setMode('new')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    mode === 'new'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  Nouveau compte
                </button>
                <button
                  onClick={() => setMode('login')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    mode === 'login'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  J'ai deja un compte
                </button>
              </div>

              {/* Erreur */}
              {error && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Formulaire nouveau compte */}
              {mode === 'new' ? (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 8 caracteres"
                        required
                        minLength={8}
                        className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Confirmer le mot de passe
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Retapez votre mot de passe"
                      required
                      className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Creation en cours...</span>
                      </>
                    ) : (
                      <span>Creer mon compte et rejoindre</span>
                    )}
                  </button>
                </form>
              ) : (
                /* Formulaire connexion */
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Votre mot de passe"
                        required
                        className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Connexion en cours...</span>
                      </>
                    ) : (
                      <span>Se connecter et rejoindre</span>
                    )}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Cette invitation expire le{' '}
          {invitationInfo?.expires_at
            ? new Date(invitationInfo.expires_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })
            : 'bientot'}
        </p>
      </div>
    </div>
  )
}
