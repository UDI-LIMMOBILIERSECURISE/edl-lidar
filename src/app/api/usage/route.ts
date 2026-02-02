import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { getPlanLimits, type PlanType } from '@/lib/plans'

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

// GET: Usage courant + limites du plan
export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const supabase = createServerClient()

    // Recuperer le profil utilisateur pour obtenir entity_id
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('entity_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profil non trouve' }, { status: 404 })
    }

    // Recuperer l'entity avec son plan
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('id, name, plan, max_users, max_tours, max_storage_gb')
      .eq('id', profile.entity_id)
      .single()

    if (entityError || !entity) {
      return NextResponse.json({ error: 'Entite non trouvee' }, { status: 404 })
    }

    // Compter les tours
    const { count: totalTours } = await supabase
      .from('virtual_tours')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entity.id)

    // Compter les utilisateurs
    const { count: totalUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entity.id)

    // Calculer le stockage (estimation basee sur video_duration_seconds)
    // Approximation: 175KB par seconde de video (10MB/minute)
    const { data: tours } = await supabase
      .from('virtual_tours')
      .select('video_duration_seconds')
      .eq('entity_id', entity.id)

    const storageBytes = (tours || []).reduce((acc, tour) => {
      return acc + (tour.video_duration_seconds || 0) * 175000
    }, 0)

    // Compter les vues Lia du mois courant
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const { count: liaViewsMonth } = await supabase
      .from('lia_sessions')
      .select('*, virtual_tours!inner(entity_id)', { count: 'exact', head: true })
      .eq('virtual_tours.entity_id', entity.id)
      .gte('started_at', monthStart.toISOString())

    // Obtenir les limites du plan
    const limits = getPlanLimits(entity.plan as PlanType)

    // Utiliser les limites custom de l'entity si definies
    const effectiveLimits = {
      maxUsers: entity.max_users || limits.maxUsers,
      maxTours: entity.max_tours || limits.maxTours,
      maxStorageGb: entity.max_storage_gb || limits.maxStorageGb,
      maxStorageBytes: (entity.max_storage_gb || limits.maxStorageGb) * 1024 * 1024 * 1024,
    }

    return NextResponse.json({
      usage: {
        totalTours: totalTours || 0,
        totalUsers: totalUsers || 0,
        storageBytes,
        liaViewsMonth: liaViewsMonth || 0,
      },
      limits: effectiveLimits,
      plan: entity.plan,
      entityName: entity.name,
    })
  } catch (error) {
    console.error('Erreur API usage GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
