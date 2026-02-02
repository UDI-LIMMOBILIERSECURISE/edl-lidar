import Stripe from 'stripe'

// Client Stripe cote serveur
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
})

// Price IDs - A configurer dans Stripe Dashboard
export const PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER || 'price_starter_monthly',
  pro: process.env.STRIPE_PRICE_PRO || 'price_pro_monthly',
} as const

// Plans avec leurs details
export const PLANS: Record<string, {
  name: string
  price: number | null
  priceId: string | null
  features: string[]
  limits: {
    toursPerMonth: number
    users: number
    agencies: number
  }
}> = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    features: [
      '3 visites par mois',
      '1 utilisateur',
      'Export PDF basique',
      'Support email',
    ],
    limits: {
      toursPerMonth: 3,
      users: 1,
      agencies: 1,
    },
  },
  starter: {
    name: 'Starter',
    price: 29,
    priceId: PRICE_IDS.starter,
    features: [
      '50 visites par mois',
      '5 utilisateurs',
      'Export PDF personnalise',
      'Support prioritaire',
      'Statistiques avancees',
    ],
    limits: {
      toursPerMonth: 50,
      users: 5,
      agencies: 3,
    },
  },
  pro: {
    name: 'Pro',
    price: 79,
    priceId: PRICE_IDS.pro,
    features: [
      'Visites illimitees',
      'Utilisateurs illimites',
      'Multi-agences',
      'API access',
      'Support dedie',
      'Formation incluse',
      'Marque blanche',
    ],
    limits: {
      toursPerMonth: -1, // illimite
      users: -1,
      agencies: -1,
    },
  },
  enterprise: {
    name: 'Enterprise',
    price: null, // sur devis
    priceId: null,
    features: [
      'Tout du plan Pro',
      'Infrastructure dediee',
      'SLA garanti 99.9%',
      'Integrations sur mesure',
      'Account manager dedie',
      'Formation personnalisee',
    ],
    limits: {
      toursPerMonth: -1,
      users: -1,
      agencies: -1,
    },
  },
}

export type PlanType = 'free' | 'starter' | 'pro' | 'enterprise'

/**
 * Creer une session Checkout Stripe pour upgrade
 */
export async function createCheckoutSession({
  priceId,
  customerId,
  entityId,
  successUrl,
  cancelUrl,
}: {
  priceId: string
  customerId?: string
  entityId: string
  successUrl: string
  cancelUrl: string
}): Promise<Stripe.Checkout.Session> {
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      entityId,
    },
    subscription_data: {
      metadata: {
        entityId,
      },
    },
  }

  // Si le client existe deja dans Stripe
  if (customerId) {
    sessionParams.customer = customerId
  } else {
    sessionParams.customer_creation = 'always'
  }

  return stripe.checkout.sessions.create(sessionParams)
}

/**
 * Creer une session Customer Portal pour gerer l'abonnement
 */
export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string
  returnUrl: string
}): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
}

/**
 * Recuperer les details d'un abonnement
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId)
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return null
  }
}

/**
 * Recuperer les factures d'un client
 */
export async function getInvoices(
  customerId: string,
  limit: number = 10
): Promise<Stripe.Invoice[]> {
  try {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit,
    })
    return invoices.data
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return []
  }
}

/**
 * Determiner le plan a partir du price ID
 */
export function getPlanFromPriceId(priceId: string | null): PlanType {
  if (!priceId) return 'free'

  if (priceId === PRICE_IDS.starter) return 'starter'
  if (priceId === PRICE_IDS.pro) return 'pro'

  return 'free'
}

/**
 * Verifier la signature d'un webhook Stripe
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  )
}
