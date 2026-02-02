import { NextRequest, NextResponse } from 'next/server'
import { chatWithLia } from '@/lib/gemini'
import { createServerClient } from '@/lib/supabase'
import { TourIndex } from '@/types/database'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tourId, tourIndex, rooms, currentRoom, message, history } = body as {
      tourId: string
      tourIndex?: TourIndex
      rooms?: Array<{ name: string; type: string }>
      currentRoom?: string
      message: string
      history: Array<{ role: 'user' | 'assistant'; content: string }>
    }

    // Valider les données
    if (!tourId || !message) {
      return NextResponse.json(
        { error: 'Données manquantes' },
        { status: 400 }
      )
    }

    // Construire tourIndex si non fourni
    const effectiveTourIndex: TourIndex = tourIndex || {
      version: '1.0',
      tour_id: tourId,
      created_at: new Date().toISOString(),
      has_lidar: false,
      property: { address: '', type: 'apartment' },
      video: { duration_seconds: 0, resolution: '1920x1080', codec: 'h265' },
      rooms: (rooms || []).map((r, i) => ({
        id: String(i),
        name: r.name,
        type: r.type,
        start_time: 0,
        end_time: 0
      })),
      annotations: []
    }

    // Appeler Gemini via notre lib
    const response = await chatWithLia(effectiveTourIndex, message, history || [])

    // Enregistrer le message dans la base (analytics)
    try {
      const supabase = createServerClient()

      // Créer ou récupérer la session
      // Note: En production, utiliser un cookie/fingerprint pour identifier le visiteur
      const visitorId = request.headers.get('x-visitor-id') || 'anonymous'

      let sessionId: string

      // Chercher une session existante recente (< 30 min)
      const { data: existingSessions } = await supabase
        .from('lia_sessions')
        .select('id')
        .eq('tour_id', tourId)
        .eq('visitor_id', visitorId)
        .gte('started_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
        .order('started_at', { ascending: false })
        .limit(1) as { data: { id: string }[] | null }

      if (existingSessions && existingSessions.length > 0) {
        sessionId = existingSessions[0].id
      } else {
        // Creer une nouvelle session
        const { data: newSession } = await supabase
          .from('lia_sessions')
          .insert({
            tour_id: tourId,
            visitor_id: visitorId
          })
          .select('id')
          .single() as { data: { id: string } | null }

        sessionId = newSession?.id || ''
      }

      if (sessionId) {
        // Enregistrer les messages
        await supabase.from('lia_messages').insert([
          {
            session_id: sessionId,
            role: 'user',
            content: message
          },
          {
            session_id: sessionId,
            role: 'assistant',
            content: response.message,
            action_type: response.action,
            action_data: response.timecode ? { timecode: response.timecode } : null,
            model_used: 'gemini-1.5-pro'
          }
        ])

        // Mettre à jour le compteur de messages
        await supabase
          .from('lia_sessions')
          .update({ message_count: history.length + 2 })
          .eq('id', sessionId)
      }
    } catch (dbError) {
      // Ne pas bloquer la réponse si l'enregistrement échoue
      console.error('Erreur enregistrement message:', dbError)
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Erreur API chat:', error)
    return NextResponse.json(
      {
        message: 'Désolée, je rencontre un problème technique. Réessayez dans un instant.',
        action: null
      },
      { status: 500 }
    )
  }
}
