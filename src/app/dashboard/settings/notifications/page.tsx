'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import {
  Bell,
  Mail,
  Smartphone,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
} from 'lucide-react'

interface NotificationPreferences {
  app_new_visitor: boolean
  app_milestone_views: boolean
  app_lia_question: boolean
  app_quota_warning: boolean
  email_new_visitor: boolean
  email_weekly_digest: boolean
  email_milestone_views: boolean
  email_quota_warning: boolean
  threshold_views: number
  threshold_quota_percent: number
}

const defaultPreferences: NotificationPreferences = {
  app_new_visitor: true,
  app_milestone_views: true,
  app_lia_question: true,
  app_quota_warning: true,
  email_new_visitor: false,
  email_weekly_digest: true,
  email_milestone_views: false,
  email_quota_warning: true,
  threshold_views: 100,
  threshold_quota_percent: 80,
}

export default function NotificationSettingsPage() {
  const router = useRouter()
  const { user, session } = useAuth()
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [originalPreferences, setOriginalPreferences] = useState<NotificationPreferences>(defaultPreferences)

  // Fetch preferences
  useEffect(() => {
    async function fetchPreferences() {
      if (!session?.access_token) return

      try {
        const response = await fetch('/api/notifications/preferences', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          const prefs = data.preferences
          setPreferences(prefs)
          setOriginalPreferences(prefs)
        }
      } catch (err) {
        console.error('[NotificationSettings] Error fetching:', err)
        setError('Erreur lors du chargement des preferences')
      } finally {
        setLoading(false)
      }
    }

    fetchPreferences()
  }, [session?.access_token])

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(preferences) !== JSON.stringify(originalPreferences)
    setHasChanges(changed)
    setSuccess(false)
  }, [preferences, originalPreferences])

  // Update preference
  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }))
    setError(null)
  }

  // Save preferences
  const savePreferences = async () => {
    if (!session?.access_token) return

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(preferences),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erreur lors de la sauvegarde')
      }

      const data = await response.json()
      setPreferences(data.preferences)
      setOriginalPreferences(data.preferences)
      setSuccess(true)
      setHasChanges(false)

      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('[NotificationSettings] Error saving:', err)
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => router.push('/dashboard/settings')}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux parametres
      </button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Preferences de notification</h1>
        <p className="text-gray-400">
          Configurez comment et quand vous souhaitez etre notifie
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3 text-green-400">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p>Preferences sauvegardees avec succes</p>
        </div>
      )}

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* In-App Notifications */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-white">Notifications in-app</h2>
          </div>

          <div className="divide-y divide-gray-700">
            <ToggleItem
              label="Nouveau visiteur"
              description="Notification quand quelqu'un visite une de vos visites virtuelles"
              checked={preferences.app_new_visitor}
              onChange={v => updatePreference('app_new_visitor', v)}
            />
            <ToggleItem
              label="Milestone de vues"
              description="Notification quand une visite atteint un seuil de vues"
              checked={preferences.app_milestone_views}
              onChange={v => updatePreference('app_milestone_views', v)}
            />
            <ToggleItem
              label="Question Lia"
              description="Notification quand un visiteur pose une question a Lia"
              checked={preferences.app_lia_question}
              onChange={v => updatePreference('app_lia_question', v)}
            />
            <ToggleItem
              label="Alerte quota"
              description="Notification quand vous approchez de votre quota"
              checked={preferences.app_quota_warning}
              onChange={v => updatePreference('app_quota_warning', v)}
            />
          </div>
        </div>

        {/* Email Notifications */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-3">
            <Mail className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-white">Notifications email</h2>
          </div>

          <div className="divide-y divide-gray-700">
            <ToggleItem
              label="Nouveau visiteur"
              description="Email quand quelqu'un visite une de vos visites virtuelles"
              checked={preferences.email_new_visitor}
              onChange={v => updatePreference('email_new_visitor', v)}
            />
            <ToggleItem
              label="Digest hebdomadaire"
              description="Resume de l'activite de la semaine chaque lundi"
              checked={preferences.email_weekly_digest}
              onChange={v => updatePreference('email_weekly_digest', v)}
            />
            <ToggleItem
              label="Milestone de vues"
              description="Email quand une visite atteint un seuil de vues"
              checked={preferences.email_milestone_views}
              onChange={v => updatePreference('email_milestone_views', v)}
            />
            <ToggleItem
              label="Alerte quota"
              description="Email quand vous approchez de votre quota"
              checked={preferences.email_quota_warning}
              onChange={v => updatePreference('email_quota_warning', v)}
            />
          </div>
        </div>

        {/* Thresholds */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-3">
            <Bell className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-white">Seuils d'alerte</h2>
          </div>

          <div className="p-4 space-y-6">
            {/* Views Threshold */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Seuil de vues pour milestone
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Vous serez notifie tous les {preferences.threshold_views} vues (100, 200, 300...)
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="10"
                  value={preferences.threshold_views}
                  onChange={e => updatePreference('threshold_views', parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <input
                  type="number"
                  min="10"
                  max="500"
                  value={preferences.threshold_views}
                  onChange={e => {
                    const val = parseInt(e.target.value)
                    if (val >= 10 && val <= 500) {
                      updatePreference('threshold_views', val)
                    }
                  }}
                  className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Quota Threshold */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Seuil d'alerte quota (%)
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Vous serez notifie quand vous atteignez {preferences.threshold_quota_percent}% de votre quota
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={preferences.threshold_quota_percent}
                  onChange={e => updatePreference('threshold_quota_percent', parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-center">
                  {preferences.threshold_quota_percent}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-gray-500">
            {hasChanges ? 'Modifications non sauvegardees' : ''}
          </p>
          <button
            onClick={savePreferences}
            disabled={!hasChanges || saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  )
}

// Toggle Component
interface ToggleItemProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function ToggleItem({ label, description, checked, onChange }: ToggleItemProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 ${
          checked ? 'bg-blue-600' : 'bg-gray-600'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
