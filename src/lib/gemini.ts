import { GoogleGenerativeAI } from '@google/generative-ai'
import { TourIndex, LiaResponse } from '@/types/database'

// Initialisation Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Modèle pour l'analyse vidéo et le chat (gemini-1.5-flash déprécié)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

// Prompt système pour Lia
const getLiaSystemPrompt = (tourIndex: TourIndex) => `
# Lia - Assistant Visite Virtuelle Immobilière

Tu es Lia, une assistante IA spécialisée dans les visites virtuelles immobilières.
Tu dois répondre en français, de manière concise et professionnelle.

## Contexte du bien
- Adresse : ${tourIndex.property.address}
- Type : ${tourIndex.property.type}
- Surface totale : ${tourIndex.property.total_surface_m2 ? `${tourIndex.property.total_surface_m2} m²` : 'Non disponible'}
- Nombre de pièces : ${tourIndex.rooms.length}

## Index des pièces (timecodes vidéo)
${tourIndex.rooms.map(room =>
  `- ${room.name} : ${formatTime(room.start_time)} - ${formatTime(room.end_time)}${room.surfaces ? ` | Surface : ${room.surfaces.floor_m2} m²` : ''}`
).join('\n')}

## Annotations de l'agent
${tourIndex.annotations.map(annot =>
  `- [${formatTime(annot.timecode)}] ${annot.text}`
).join('\n')}

## Instructions
1. Réponds toujours en français, de manière concise et professionnelle
2. Si l'utilisateur demande une pièce, fournis le timecode pour navigation
3. Si l'utilisateur demande des surfaces, utilise les données LiDAR si disponibles
4. Si une info n'est pas disponible, dis-le clairement
5. Ne jamais inventer de données

## Format de réponse JSON
Tu dois TOUJOURS répondre en JSON valide avec ce format :
{
  "message": "Ta réponse textuelle ici",
  "action": "seek" | "info" | "staging" | null,
  "timecode": number (en secondes, si action=seek),
  "data": {} (données additionnelles si nécessaire)
}
`

// Formater le temps en MM:SS
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Chat avec Lia
export async function chatWithLia(
  tourIndex: TourIndex,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<LiaResponse> {
  try {
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: getLiaSystemPrompt(tourIndex) }]
        },
        {
          role: 'model',
          parts: [{ text: JSON.stringify({
            message: "Bonjour ! Je suis Lia, votre guide pour cette visite virtuelle. Comment puis-je vous aider ?",
            action: null
          })}]
        },
        ...conversationHistory.map(msg => ({
          role: msg.role === 'user' ? 'user' as const : 'model' as const,
          parts: [{ text: msg.content }]
        }))
      ]
    })

    const result = await chat.sendMessage(userMessage)
    const response = result.response.text()

    // Parser la réponse JSON
    try {
      const parsed = JSON.parse(response)
      return {
        message: parsed.message || response,
        action: parsed.action || null,
        timecode: parsed.timecode,
        data: parsed.data
      }
    } catch {
      // Si pas de JSON valide, retourner comme message simple
      return {
        message: response,
        action: null
      }
    }
  } catch (error) {
    console.error('Erreur Gemini:', error)
    return {
      message: "Désolée, je rencontre un problème technique. Pouvez-vous reformuler votre question ?",
      action: null
    }
  }
}

// Analyser une vidéo pour détecter les pièces
export async function analyzeVideoForRooms(
  videoUrl: string
): Promise<Array<{ name: string; type: string; start_time: number; end_time: number }>> {
  try {
    // Note: Gemini 1.5 Pro peut analyser des vidéos directement
    // Pour le MVP, on utilise l'analyse d'URL
    const prompt = `
    Analyse cette vidéo d'une visite immobilière.
    Identifie chaque pièce et fournis les timecodes de début et fin.

    Réponds en JSON avec ce format :
    {
      "rooms": [
        {"name": "Entrée", "type": "entrance", "start_time": 0, "end_time": 45},
        {"name": "Salon", "type": "living_room", "start_time": 45, "end_time": 180}
      ]
    }

    Types de pièces possibles : entrance, living_room, kitchen, bedroom, bathroom, toilet, office, dining_room, hallway, storage, garage, balcony, garden, other
    `

    const result = await model.generateContent([
      { text: prompt },
      // Note: Pour l'analyse vidéo réelle, il faudra utiliser l'API Files de Gemini
      // et uploader la vidéo d'abord
    ])

    const response = result.response.text()
    const parsed = JSON.parse(response)

    return parsed.rooms || []
  } catch (error) {
    console.error('Erreur analyse vidéo:', error)
    return []
  }
}
