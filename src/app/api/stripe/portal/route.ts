import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createPortalSession } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
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

    // Seul l'admin peut acceder au portal
    if (profile.role !== 'entity_admin') {
      return NextResponse.json(
        { error: 'Seul l\'administrateur peut gerer l\'abonnement' },
        { status: 403 }
      )
    }

    // Recuperer l'entity avec le stripe_customer_id
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('stripe_customer_id')
      .eq('id', profile.entity_id)
      .single()

    if (entityError || !entity) {
      return NextResponse.json(
        { error: 'Entity non trouvee' },
        { status: 404 }
      )
    }

    if (!entity.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Aucun abonnement actif. Veuillez d\'abord souscrire a un plan.' },
        { status: 400 }
      )
    }

    // Construire l'URL de retour
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const returnUrl = `${origin}/dashboard/billing`

    // Creer la session Portal
    const session = await createPortalSession({
      customerId: entity.stripe_customer_id,
      returnUrl,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Portal session error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la creation de la session de gestion' },
      { status: 500 }
    )
  }
}
