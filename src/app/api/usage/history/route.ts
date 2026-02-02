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

interface MonthlyData {
  month: string
  toursCreated: number
  liaViews: number
  storageBytes: number
}

// GET: Historique usage sur 12 mois
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    // Parametre optionnel: nombre de mois
    const searchParams = request.nextUrl.searchParams
    const monthsParam = searchParams.get('months')
    const months = monthsParam ? parseInt(monthsParam, 10) : 12

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

    // Generer les derniers N mois
    const monthlyData: MonthlyData[] = []
    const now = new Date()

    for (let i = months - 1; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
      const monthStr = monthDate.toISOString().slice(0, 7) // YYYY-MM

      // Compter les tours crees ce mois
      const { count: toursCreated } = await supabase
        .from('virtual_tours')
        .select('*', { count: 'exact', head: true })
        .eq('entity_id', profile.entity_id)
        .gte('created_at', monthDate.toISOString())
        .lte('created_at', monthEnd.toISOString())

      // Compter les sessions Lia ce mois
      const { count: liaViews } = await supabase
        .from('lia_sessions')
        .select('*, virtual_tours!inner(entity_id)', { count: 'exact', head: true })
        .eq('virtual_tours.entity_id', profile.entity_id)
        .gte('started_at', monthDate.toISOString())
        .lte('started_at', monthEnd.toISOString())

      // Calculer le storage cumule jusqu'a ce mois
      const { data: tours } = await supabase
        .from('virtual_tours')
        .select('video_duration_seconds')
        .eq('entity_id', profile.entity_id)
        .lte('created_at', monthEnd.toISOString())

      const storageBytes = (tours || []).reduce((acc, tour) => {
        return acc + (tour.video_duration_seconds || 0) * 175000
      }, 0)

      monthlyData.push({
        month: monthStr,
        toursCreated: toursCreated || 0,
        liaViews: liaViews || 0,
        storageBytes,
      })
    }

    return NextResponse.json({ history: monthlyData })
  } catch (error) {
    console.error('Erreur API usage history GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
