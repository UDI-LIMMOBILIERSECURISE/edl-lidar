import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createServerClient } from '@/lib/supabase'
import { getReadPresignedUrl } from '@/lib/r2'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Prompt pour l'analyse de vidéo immobilière
const ROOM_DETECTION_PROMPT = `
Tu es un expert en analyse de vidéos immobilières. Analyse cette vidéo d'une visite de bien immobilier.

## Ta mission
Identifie chaque pièce visible dans la vidéo et donne les timecodes précis (en secondes).

## Règles
1. Identifie le moment où la caméra ENTRE dans chaque pièce
2. Identifie le moment où la caméra QUITTE chaque pièce
3. Donne des noms de pièces en français
4. Si tu entends l'agent annoncer une pièce ("voici la cuisine"), utilise cette info
5. Sois précis sur les timecodes (à la seconde près)

## Types de pièces à détecter
- Entrée / Hall
- Salon / Séjour
- Cuisine
- Chambre (numérote si plusieurs: Chambre 1, Chambre 2...)
- Salle de bain
- WC / Toilettes
- Bureau
- Salle à manger
- Couloir
- Dressing
- Buanderie
- Balcon / Terrasse
- Cave / Garage
- Jardin

## Format de réponse (JSON strict)
{
  "rooms": [
    {
      "name": "Entrée",
      "type": "entrance",
      "start_time": 0,
      "end_time": 15,
      "description": "Hall d'entrée avec placard"
    },
    {
      "name": "Salon",
      "type": "living_room",
      "start_time": 15,
      "end_time": 45,
      "description": "Grand salon lumineux avec baie vitrée"
    }
  ],
  "total_duration": 120,
  "property_type": "apartment",
  "notes": "Appartement T3 bien agencé"
}

Types valides: entrance, living_room, kitchen, bedroom, bathroom, toilet, office, dining_room, hallway, storage, laundry, balcony, garage, garden, other

IMPORTANT: Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.
`

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tourId = params.id

  try {
    const supabase = createServerClient()

    // 1. Récupérer le tour
    const { data: tour, error: tourError } = await supabase
      .from('virtual_tours')
      .select('*')
      .eq('id', tourId)
      .single()

    if (tourError || !tour) {
      return NextResponse.json(
        { error: 'Tour non trouvé' },
        { status: 404 }
      )
    }

    if (!tour.video_url) {
      return NextResponse.json(
        { error: 'Pas de vidéo associée à ce tour' },
        { status: 400 }
      )
    }

    // 2. Mettre à jour le statut
    await supabase
      .from('virtual_tours')
      .update({ status: 'processing', ai_indexed: false })
      .eq('id', tourId)

    // 3. Télécharger la vidéo
    console.log('Téléchargement vidéo:', tour.video_url)

    // Si l'URL est une URL R2 privée, générer une presigned URL
    let videoUrl = tour.video_url
    if (tour.video_url.includes('.r2.cloudflarestorage.com')) {
      // Extraire la clé du fichier depuis l'URL R2
      // Format: https://{account}.r2.cloudflarestorage.com/{bucket}/{key}
      const urlParts = new URL(tour.video_url)
      const pathParts = urlParts.pathname.split('/')
      // Enlever le premier élément vide et le nom du bucket
      const key = pathParts.slice(2).join('/')
      console.log('Génération presigned URL pour:', key)
      videoUrl = await getReadPresignedUrl(key, 3600)
    }

    const videoResponse = await fetch(videoUrl)
    if (!videoResponse.ok) {
      console.error('Erreur fetch video:', videoResponse.status, videoResponse.statusText)
      throw new Error(`Impossible de télécharger la vidéo: ${videoResponse.status}`)
    }

    const videoBuffer = await videoResponse.arrayBuffer()
    const videoBase64 = Buffer.from(videoBuffer).toString('base64')

    // Déterminer le type MIME
    const contentType = videoResponse.headers.get('content-type') || 'video/mp4'

    console.log('Vidéo téléchargée, taille:', videoBuffer.byteLength, 'type:', contentType)

    // 4. Analyser avec Gemini
    console.log('Analyse Gemini en cours...')

    // Utiliser gemini-2.0-flash pour l'analyse vidéo (gemini-1.5-flash déprécié)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: contentType,
          data: videoBase64
        }
      },
      { text: ROOM_DETECTION_PROMPT }
    ])

    const responseText = result.response.text()
    console.log('Réponse Gemini:', responseText)

    // 5. Parser la réponse JSON
    let analysisResult
    try {
      // Nettoyer la réponse (enlever les backticks markdown si présents)
      let cleanJson = responseText.trim()
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\n?/, '').replace(/\n?```$/, '')
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\n?/, '').replace(/\n?```$/, '')
      }

      analysisResult = JSON.parse(cleanJson)
    } catch (parseError) {
      console.error('Erreur parsing JSON:', parseError)
      console.error('Réponse brute:', responseText)

      return NextResponse.json(
        { error: 'Erreur lors de l\'analyse IA', details: responseText },
        { status: 500 }
      )
    }

    // 6. Supprimer les anciennes pièces
    await supabase
      .from('tour_rooms')
      .delete()
      .eq('tour_id', tourId)

    // 7. Insérer les nouvelles pièces
    if (analysisResult.rooms && analysisResult.rooms.length > 0) {
      const roomsToInsert = analysisResult.rooms.map((room: any, index: number) => ({
        tour_id: tourId,
        name: room.name,
        room_type: room.type || 'other',
        start_time: room.start_time,
        end_time: room.end_time,
        display_order: index,
        detection_method: 'gemini',
        detection_confidence: 0.85
      }))

      const { error: insertError } = await supabase
        .from('tour_rooms')
        .insert(roomsToInsert)

      if (insertError) {
        console.error('Erreur insertion rooms:', insertError)
        throw insertError
      }
    }

    // 8. Mettre à jour le tour
    await supabase
      .from('virtual_tours')
      .update({
        status: 'ready',
        ai_indexed: true,
        ai_index_version: 'gemini-2.0-flash',
        video_duration_seconds: analysisResult.total_duration || null
      })
      .eq('id', tourId)

    // 9. Retourner le résultat
    return NextResponse.json({
      success: true,
      rooms: analysisResult.rooms,
      total_duration: analysisResult.total_duration,
      property_type: analysisResult.property_type,
      notes: analysisResult.notes
    })

  } catch (error) {
    console.error('Erreur indexation:', error)

    // Remettre le statut en erreur
    const supabase = createServerClient()
    await supabase
      .from('virtual_tours')
      .update({ status: 'error' })
      .eq('id', tourId)

    return NextResponse.json(
      { error: 'Erreur lors de l\'indexation', details: String(error) },
      { status: 500 }
    )
  }
}

// GET pour vérifier le statut d'indexation
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tourId = params.id

  try {
    const supabase = createServerClient()

    const { data: tour } = await supabase
      .from('virtual_tours')
      .select('status, ai_indexed, ai_index_version')
      .eq('id', tourId)
      .single()

    const { data: rooms } = await supabase
      .from('tour_rooms')
      .select('*')
      .eq('tour_id', tourId)
      .order('display_order')

    return NextResponse.json({
      status: tour?.status,
      ai_indexed: tour?.ai_indexed,
      ai_index_version: tour?.ai_index_version,
      rooms_count: rooms?.length || 0,
      rooms
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du statut' },
      { status: 500 }
    )
  }
}
