import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { constructWebhookEvent, getPlanFromPriceId, stripe } from '@/lib/stripe'
import Stripe from 'stripe'

// Desactiver le body parsing par defaut pour les webhooks
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      console.error('Webhook: Missing stripe-signature header')
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      )
    }

    // Verifier la signature du webhook
    let event: Stripe.Event
    try {
      event = constructWebhookEvent(body, signature)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Traiter les differents types d'evenements
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(supabase, session)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(supabase, subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(supabase, subscription)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(supabase, invoice)
        break
      }

      default:
        console.log(`Webhook: Unhandled event type ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

/**
 * Gerer la completion d'une session Checkout
 */
async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createServerClient>,
  session: Stripe.Checkout.Session
) {
  const entityId = session.metadata?.entityId
  if (!entityId) {
    console.error('Checkout completed: Missing entityId in metadata')
    return
  }

  const subscriptionId = session.subscription as string
  const customerId = session.customer as string

  // Recuperer les details de la subscription pour obtenir le plan
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const priceId = subscription.items.data[0]?.price.id
  const plan = getPlanFromPriceId(priceId)

  // Mettre a jour l'entity avec les infos Stripe
  const { error } = await supabase
    .from('entities')
    .update({
      plan,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entityId)

  if (error) {
    console.error('Error updating entity after checkout:', error)
    throw error
  }

  console.log(`Checkout completed: Entity ${entityId} upgraded to ${plan}`)
}

/**
 * Gerer la mise a jour d'un abonnement (changement de plan, etc.)
 */
async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createServerClient>,
  subscription: Stripe.Subscription
) {
  const entityId = subscription.metadata?.entityId
  if (!entityId) {
    // Essayer de trouver l'entity par stripe_subscription_id
    const { data: entity } = await supabase
      .from('entities')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .single()

    if (!entity) {
      console.error('Subscription updated: Cannot find entity')
      return
    }

    await updateEntityPlan(supabase, entity.id, subscription)
    return
  }

  await updateEntityPlan(supabase, entityId, subscription)
}

/**
 * Gerer la suppression d'un abonnement (downgrade vers free)
 */
async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createServerClient>,
  subscription: Stripe.Subscription
) {
  const entityId = subscription.metadata?.entityId

  // Trouver l'entity par subscription_id si pas dans metadata
  let targetEntityId = entityId
  if (!targetEntityId) {
    const { data: entity } = await supabase
      .from('entities')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .single()

    if (!entity) {
      console.error('Subscription deleted: Cannot find entity')
      return
    }
    targetEntityId = entity.id
  }

  // Downgrade vers free
  const { error } = await supabase
    .from('entities')
    .update({
      plan: 'free',
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetEntityId)

  if (error) {
    console.error('Error downgrading entity:', error)
    throw error
  }

  console.log(`Subscription deleted: Entity ${targetEntityId} downgraded to free`)
}

/**
 * Gerer un echec de paiement
 */
async function handlePaymentFailed(
  supabase: ReturnType<typeof createServerClient>,
  invoice: Stripe.Invoice
) {
  const customerId = invoice.customer as string

  // Trouver l'entity par customer_id
  const { data: entity } = await supabase
    .from('entities')
    .select('id, name')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!entity) {
    console.error('Payment failed: Cannot find entity for customer', customerId)
    return
  }

  // TODO: Envoyer un email de notification a l'admin
  console.log(`Payment failed for entity ${entity.id} (${entity.name})`)
}

/**
 * Mettre a jour le plan d'une entity
 */
async function updateEntityPlan(
  supabase: ReturnType<typeof createServerClient>,
  entityId: string,
  subscription: Stripe.Subscription
) {
  const priceId = subscription.items.data[0]?.price.id
  const plan = getPlanFromPriceId(priceId)
  const status = subscription.status

  // Si l'abonnement n'est plus actif, on garde le plan mais on note le statut
  if (status === 'canceled' || status === 'unpaid') {
    console.log(`Subscription ${subscription.id} status: ${status}`)
  }

  const { error } = await supabase
    .from('entities')
    .update({
      plan,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entityId)

  if (error) {
    console.error('Error updating entity plan:', error)
    throw error
  }

  console.log(`Subscription updated: Entity ${entityId} now has plan ${plan}`)
}
