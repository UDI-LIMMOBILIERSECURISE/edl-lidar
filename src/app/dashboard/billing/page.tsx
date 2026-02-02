'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { getSupabase } from '@/lib/supabase'
import { PLANS, PlanType } from '@/lib/stripe'
import PricingCard from '@/components/PricingCard'
import {
  CreditCard,
  CheckCircle,
  XCircle,
  ExternalLink,
  Receipt,
  AlertTriangle,
} from 'lucide-react'

interface EntityData {
  id: string
  name: string
  plan: PlanType
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
}

export default function BillingPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const [entity, setEntity] = useState<EntityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Verifier les parametres d'URL pour success/cancel
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setSuccessMessage('Votre abonnement a ete mis a jour avec succes!')
      // Nettoyer l'URL
      window.history.replaceState({}, '', '/dashboard/billing')
    } else if (searchParams.get('canceled') === 'true') {
      setError('Le paiement a ete annule.')
      window.history.replaceState({}, '', '/dashboard/billing')
    }
  }, [searchParams])

  // Charger les donnees de l'entity
  useEffect(() => {
    const fetchEntity = async () => {
      if (!user) return

      try {
        const supabase = getSupabase()

        // Recuperer le profil pour avoir l'entity_id
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('entity_id')
          .eq('id', user.id)
          .single()

        if (!profile?.entity_id) {
          setError('Profil utilisateur non trouve')
          return
        }

        // Recuperer l'entity
        const { data: entityData, error: entityError } = await supabase
          .from('entities')
          .select('id, name, plan, stripe_customer_id, stripe_subscription_id')
          .eq('id', profile.entity_id)
          .single()

        if (entityError) throw entityError

        setEntity(entityData as EntityData)
      } catch (err) {
        console.error('Error fetching entity:', err)
        setError('Erreur lors du chargement des donnees')
      } finally {
        setLoading(false)
      }
    }

    fetchEntity()
  }, [user])

  // Gerer la selection d'un plan
  const handleSelectPlan = async (plan: PlanType) => {
    if (!entity || plan === entity.plan) return

    // Pour enterprise, rediriger vers contact
    if (plan === 'enterprise') {
      window.location.href = 'mailto:contact@edl-lidar.com?subject=Demande%20plan%20Enterprise'
      return
    }

    // Pour free, rediriger vers le portal si abonnement existe
    if (plan === 'free') {
      if (entity.stripe_customer_id) {
        handleOpenPortal()
      }
      return
    }

    const planConfig = PLANS[plan]
    if (!planConfig.priceId) return

    setCheckoutLoading(plan)
    setError(null)

    try {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setError('Session expiree. Veuillez vous reconnecter.')
        return
      }

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          priceId: planConfig.priceId,
          plan,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la creation de la session')
      }

      // Rediriger vers Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('Checkout error:', err)
      setError(err instanceof Error ? err.message : 'Erreur lors du paiement')
    } finally {
      setCheckoutLoading(null)
    }
  }

  // Ouvrir le Customer Portal Stripe
  const handleOpenPortal = async () => {
    if (!entity?.stripe_customer_id) return

    setPortalLoading(true)
    setError(null)

    try {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setError('Session expiree. Veuillez vous reconnecter.')
        return
      }

      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'ouverture du portail')
      }

      // Rediriger vers le Customer Portal
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('Portal error:', err)
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'ouverture du portail')
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  const currentPlan = entity?.plan || 'free'
  const currentPlanConfig = PLANS[currentPlan]

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Facturation</h1>
        <p className="text-gray-400">
          Gerez votre abonnement et consultez vos factures
        </p>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/50 rounded-lg flex items-center">
          <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
          <span className="text-green-400">{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="ml-auto text-green-400 hover:text-green-300"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center">
          <AlertTriangle className="w-5 h-5 text-red-500 mr-3" />
          <span className="text-red-400">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Plan actuel */}
      <div className="mb-8 p-6 bg-gray-800 rounded-xl border border-gray-700">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Plan actuel</h2>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-blue-400">
                {currentPlanConfig.name}
              </span>
              {currentPlanConfig.price !== null && (
                <span className="text-gray-400">
                  {currentPlanConfig.price === 0 ? 'Gratuit' : `${currentPlanConfig.price} EUR/mois`}
                </span>
              )}
            </div>
          </div>

          {entity?.stripe_customer_id && (
            <button
              onClick={handleOpenPortal}
              disabled={portalLoading}
              className="flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {portalLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Chargement...
                </span>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Gerer mon abonnement
                  <ExternalLink className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Limites du plan */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Visites/mois</span>
              <p className="text-white font-medium">
                {currentPlanConfig.limits.toursPerMonth === -1
                  ? 'Illimite'
                  : currentPlanConfig.limits.toursPerMonth}
              </p>
            </div>
            <div>
              <span className="text-gray-400">Utilisateurs</span>
              <p className="text-white font-medium">
                {currentPlanConfig.limits.users === -1
                  ? 'Illimite'
                  : currentPlanConfig.limits.users}
              </p>
            </div>
            <div>
              <span className="text-gray-400">Agences</span>
              <p className="text-white font-medium">
                {currentPlanConfig.limits.agencies === -1
                  ? 'Illimite'
                  : currentPlanConfig.limits.agencies}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grille de pricing */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Changer de plan</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(Object.keys(PLANS) as PlanType[]).map((planKey) => {
            const plan = PLANS[planKey]
            return (
              <PricingCard
                key={planKey}
                name={plan.name}
                price={plan.price}
                features={plan.features}
                current={currentPlan === planKey}
                popular={planKey === 'pro'}
                loading={checkoutLoading === planKey}
                disabled={checkoutLoading !== null}
                onSelect={() => handleSelectPlan(planKey)}
              />
            )
          })}
        </div>
      </div>

      {/* Section factures (placeholder) */}
      {entity?.stripe_customer_id && (
        <div className="p-6 bg-gray-800 rounded-xl border border-gray-700">
          <div className="flex items-center mb-4">
            <Receipt className="w-5 h-5 text-gray-400 mr-2" />
            <h2 className="text-lg font-semibold text-white">Historique des factures</h2>
          </div>
          <p className="text-gray-400 text-sm">
            Accedez a l'historique complet de vos factures via le portail de gestion.
          </p>
          <button
            onClick={handleOpenPortal}
            disabled={portalLoading}
            className="mt-4 text-blue-400 hover:text-blue-300 text-sm flex items-center"
          >
            Voir les factures
            <ExternalLink className="w-4 h-4 ml-1" />
          </button>
        </div>
      )}

      {/* Note de configuration */}
      <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <div className="flex items-start">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mr-3 mt-0.5" />
          <div>
            <h3 className="text-yellow-400 font-medium">Configuration requise</h3>
            <p className="text-yellow-400/80 text-sm mt-1">
              Pour activer les paiements, configurez vos cles Stripe dans les variables d'environnement
              et creez les produits/prix dans votre Stripe Dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
