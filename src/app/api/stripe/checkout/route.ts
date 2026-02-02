import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createCheckoutSession, PLANS, PlanType } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const { priceId, plan } = await request.json()

    if (!priceId || !plan) {
      return NextResponse.json(
        { error: 'priceId et plan sont requis' },
        { status: 400 }
      )
    }

    // Verifier que le plan existe et a un priceId
    const planConfig = PLANS[plan as PlanType]
    if (!planConfig || !planConfig.priceId) {
      return NextResponse.json(
        { error: 'Plan invalide' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Recuperer l'utilisateur connecte via le header Authorization
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Non authentifie' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifie' },
        { status: 401 }
      )
    }

    // Recuperer le profil utilisateur et son entity
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('entity_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.entity_id) {
      return NextResponse.json(
        { error: 'Profil utilisateur non trouve' },
        { status: 404 }
      )
    }

    // Seul l'admin peut changer le plan
    if (profile.role !== 'entity_admin') {
      return NextResponse.json(
        { error: 'Seul l\'administrateur peut modifier l\'abonnement' },
        { status: 403 }
      )
    }

    // Recuperer l'entity avec les infos Stripe existantes
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('id, stripe_customer_id')
      .eq('id', profile.entity_id)
      .single()

    if (entityError || !entity) {
      return NextResponse.json(
        { error: 'Entity non trouvee' },
        { status: 404 }
      )
    }

    // Construire les URLs de retour
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const successUrl = `${origin}/dashboard/billing?success=true`
    const cancelUrl = `${origin}/dashboard/billing?canceled=true`

    // Creer la session Checkout
    const session = await createCheckoutSession({
      priceId,
      customerId: entity.stripe_customer_id || undefined,
      entityId: entity.id,
      successUrl,
      cancelUrl,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout session error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la creation de la session de paiement' },
      { status: 500 }
    )
  }
}
