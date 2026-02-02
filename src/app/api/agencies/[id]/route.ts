import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { createServerClient as createSSRServerClient } from '@supabase/ssr'

// Helper pour obtenir l'utilisateur authentifie via cookies
async function getAuthUser() {
  const cookieStore = await cookies()

  const supabase = createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

// GET: Detail d'une agence
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agencyId } = await params
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const supabase = createServerClient()

    // Recuperer le profil utilisateur
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profil non trouve' }, { status: 404 })
    }

    // Recuperer l'agence
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', agencyId)
      .eq('entity_id', profile.entity_id)
      .single()

    if (agencyError || !agency) {
      return NextResponse.json({ error: 'Agence non trouvee' }, { status: 404 })
    }

    // Recuperer les utilisateurs de l'agence
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('agency_id', agencyId)
      .order('last_name')

    // Compter les visites
    let tourCount = 0
    try {
      const { count } = await supabase
        .from('virtual_tours')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
      tourCount = count || 0
    } catch {
      // Ignorer si pas de colonne agency_id
    }

    return NextResponse.json({
      agency: {
        ...agency,
        user_count: users?.length || 0,
        tour_count: tourCount,
      },
      users: users || [],
      profile,
    })
  } catch (error) {
    console.error('Erreur API agency GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT: Modifier une agence (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agencyId } = await params
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const supabase = createServerClient()

    // Verifier que l'utilisateur est entity_admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profil non trouve' }, { status: 404 })
    }

    if (profile.role !== 'entity_admin') {
      return NextResponse.json(
        { error: 'Acces refuse. Seul un administrateur peut modifier les agences.' },
        { status: 403 }
      )
    }

    // Verifier que l'agence appartient a l'entite
    const { data: existingAgency, error: agencyError } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', agencyId)
      .eq('entity_id', profile.entity_id)
      .single()

    if (agencyError || !existingAgency) {
      return NextResponse.json({ error: 'Agence non trouvee' }, { status: 404 })
    }

    // Recuperer les donnees du body
    const body = await request.json()
    const { name, address, phone } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    }

    // Mettre a jour l'agence
    const { data: agency, error: updateError } = await supabase
      .from('agencies')
      .update({
        name: name.trim(),
        address: address?.trim() || null,
        phone: phone?.trim() || null,
      })
      .eq('id', agencyId)
      .select()
      .single()

    if (updateError) {
      console.error('Erreur mise a jour agence:', updateError)
      return NextResponse.json({ error: 'Erreur lors de la mise a jour' }, { status: 500 })
    }

    return NextResponse.json({ agency })
  } catch (error) {
    console.error('Erreur API agency PUT:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE: Supprimer une agence (admin only, si pas d'utilisateurs)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agencyId } = await params
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const supabase = createServerClient()

    // Verifier que l'utilisateur est entity_admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profil non trouve' }, { status: 404 })
    }

    if (profile.role !== 'entity_admin') {
      return NextResponse.json(
        { error: 'Acces refuse. Seul un administrateur peut supprimer les agences.' },
        { status: 403 }
      )
    }

    // Verifier que l'agence appartient a l'entite
    const { data: existingAgency, error: agencyError } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', agencyId)
      .eq('entity_id', profile.entity_id)
      .single()

    if (agencyError || !existingAgency) {
      return NextResponse.json({ error: 'Agence non trouvee' }, { status: 404 })
    }

    // Verifier qu'il n'y a pas d'utilisateurs dans l'agence
    const { count: userCount, error: countError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agencyId)

    if (countError) {
      console.error('Erreur comptage utilisateurs:', countError)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    if (userCount && userCount > 0) {
      return NextResponse.json(
        {
          error: `Impossible de supprimer cette agence. Elle contient ${userCount} utilisateur(s).`,
          user_count: userCount,
        },
        { status: 400 }
      )
    }

    // Supprimer l'agence
    const { error: deleteError } = await supabase
      .from('agencies')
      .delete()
      .eq('id', agencyId)

    if (deleteError) {
      console.error('Erreur suppression agence:', deleteError)
      return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur API agency DELETE:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
