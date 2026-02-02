'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    try {
      const supabase = getSupabase()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (resetError) {
        setError(resetError.message)
        return
      }

      setSuccess(true)
    } catch (err) {
      setError('Une erreur inattendue est survenue')
      console.error('Reset password error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <>
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-900/50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Email envoye
          </h2>
          <p className="text-gray-400 mb-6">
            Si un compte existe avec l'adresse <strong className="text-white">{email}</strong>,
            vous recevrez un lien pour reinitialiser votre mot de passe.
          </p>
          <Link
            href="/login"
            className="inline-block py-2.5 px-6 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-md transition-colors"
          >
            Retour a la connexion
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <h2 className="text-2xl font-bold text-white mb-2 text-center">
        Mot de passe oublie
      </h2>
      <p className="text-gray-400 text-sm text-center mb-6">
        Entrez votre email pour recevoir un lien de reinitialisation.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-md text-red-200 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            placeholder="votre@email.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Envoi...
            </span>
          ) : (
            'Envoyer le lien'
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
        >
          Retour a la connexion
        </Link>
      </div>
    </>
  )
}
