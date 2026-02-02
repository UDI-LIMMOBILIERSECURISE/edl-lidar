'use client'

import { useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { getSupabase } from '@/lib/supabase'
import {
  User,
  Mail,
  Lock,
  Bell,
  Shield,
  Check,
  AlertCircle
} from 'lucide-react'

export default function SettingsPage() {
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas' })
      return
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 8 caracteres' })
      return
    }

    setLoading(true)

    try {
      const supabase = getSupabase()

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      setMessage({ type: 'success', text: 'Mot de passe mis a jour avec succes' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      console.error('Error updating password:', err)
      setMessage({ type: 'error', text: err.message || 'Erreur lors de la mise a jour' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Parametres</h1>
        <p className="text-gray-400 mt-1">Gerez votre compte et vos preferences</p>
      </div>

      {/* Profile section */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Profil</h2>
            <p className="text-sm text-gray-400">Informations de votre compte</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <div className="flex items-center space-x-2 px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg">
              <Mail className="w-5 h-5 text-gray-400" />
              <span className="text-white">{user?.email}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Contactez le support pour modifier votre email
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              ID Utilisateur
            </label>
            <div className="px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg">
              <span className="text-gray-400 text-sm font-mono">{user?.id}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Password section */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Securite</h2>
            <p className="text-sm text-gray-400">Modifier votre mot de passe</p>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg flex items-center space-x-2 ${
            message.type === 'success'
              ? 'bg-green-900/50 border border-green-500 text-green-400'
              : 'bg-red-900/50 border border-red-500 text-red-400'
          }`}>
            {message.type === 'success' ? (
              <Check className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Nouveau mot de passe
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Minimum 8 caracteres"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Confirmez votre mot de passe"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {loading ? 'Mise a jour...' : 'Mettre a jour le mot de passe'}
          </button>
        </form>
      </div>

      {/* Notifications section */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
            <p className="text-sm text-gray-400">Preferences de notification</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-white font-medium">Notifications par email</span>
              <p className="text-sm text-gray-400">Recevoir des notifications sur les nouvelles vues</p>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-white font-medium">Resume hebdomadaire</span>
              <p className="text-sm text-gray-400">Recevoir un resume de vos statistiques</p>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
            />
          </label>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-gray-800 rounded-xl border border-red-900/50 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Zone de danger</h2>
            <p className="text-sm text-gray-400">Actions irreversibles</p>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          La suppression de votre compte entrainera la perte de toutes vos visites et donnees.
          Cette action est irreversible.
        </p>

        <button
          className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/50 rounded-lg transition-colors"
        >
          Supprimer mon compte
        </button>
      </div>
    </div>
  )
}
