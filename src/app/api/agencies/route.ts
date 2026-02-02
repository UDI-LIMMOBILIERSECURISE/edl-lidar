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

// GET: Liste des agences de l'entite
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const supabase = createServerClient()

    // Recuperer le profil utilisateur pour obtenir entity_id
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profil non trouve' }, { status: 404 })
    }

    // Recuperer les agences de l'entite
    const { data: agencies, error: agenciesError } = await supabase
      .from('agencies')
      .select('*')
      .eq('entity_id', profile.entity_id)
      .order('name')

    if (agenciesError) {
      console.error('Erreur recuperation agences:', agenciesError)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    // Pour chaque agence, compter les utilisateurs et visites
    const agenciesWithStats = await Promise.all(
      (agencies || []).map(async (agency) => {
        // Compter les utilisateurs
        const { count: userCount } = await supabase
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('agency_id', agency.id)

        // Compter les visites (tours) - si la table existe
        let tourCount = 0
        try {
          const { count } = await supabase
            .from('virtual_tours')
            .select('*', { count: 'exact', head: true })
            .eq('agency_id', agency.id)
          tourCount = count || 0
        } catch {
          // Table virtual_tours n'a pas de colonne agency_id, ignorer
        }

        return {
          ...agency,
          user_count: userCount || 0,
          tour_count: tourCount,
        }
      })
    )

    return NextResponse.json({ agencies: agenciesWithStats, profile })
  } catch (error) {
    console.error('Erreur API agencies GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST: Creer une nouvelle agence (admin only)
export async function POST(request: NextRequest) {
  try {
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
        { error: 'Acces refuse. Seul un administrateur peut creer des agences.' },
        { status: 403 }
      )
    }

    // Recuperer les donnees du body
    const body = await request.json()
    const { name, address, phone } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    }

    // Creer l'agence
    const { data: agency, error: createError } = await supabase
      .from('agencies')
      .insert({
        entity_id: profile.entity_id,
        name: name.trim(),
        address: address?.trim() || null,
        phone: phone?.trim() || null,
      })
      .select()
      .single()

    if (createError) {
      console.error('Erreur creation agence:', createError)
      return NextResponse.json({ error: 'Erreur lors de la creation' }, { status: 500 })
    }

    return NextResponse.json({ agency }, { status: 201 })
  } catch (error) {
    console.error('Erreur API agencies POST:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
