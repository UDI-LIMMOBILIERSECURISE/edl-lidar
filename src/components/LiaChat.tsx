'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Mic, MicOff, Loader2 } from 'lucide-react'

interface Room {
  id: string
  name: string
  type: string
  start_time: number
  end_time: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  roomName?: string
  timecode?: number
}

interface LiaChatProps {
  tourId: string
  rooms: Room[]
  currentRoom: Room | null
  onNavigateToRoom?: (roomName: string) => void
}

export default function LiaChat({ tourId, rooms = [], currentRoom, onNavigateToRoom }: LiaChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: rooms.length > 0
        ? `Bonjour ! Je suis Lia, votre guide. Cette visite comporte ${rooms.length} pièces. Demandez-moi de vous montrer une pièce ou posez-moi vos questions !`
        : `Bonjour ! Je suis Lia, votre guide pour cette visite. L'indexation des pièces n'a pas encore été effectuée, mais je peux répondre à vos questions.`
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Détecter les commandes de navigation
  const detectNavigationCommand = (text: string): string | null => {
    const lowerText = text.toLowerCase()

    // Patterns de navigation
    const patterns = [
      /montre[- ]?moi\s+(?:la |le |l')?(.+)/i,
      /va\s+(?:dans |à la |au |à l')?(.+)/i,
      /aller\s+(?:dans |à la |au |à l')?(.+)/i,
      /voir\s+(?:la |le |l')?(.+)/i,
      /affiche[- ]?moi\s+(?:la |le |l')?(.+)/i,
    ]

    for (const pattern of patterns) {
      const match = lowerText.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }

    // Vérifier si le message contient directement un nom de pièce
    for (const room of rooms) {
      if (lowerText.includes(room.name.toLowerCase())) {
        return room.name
      }
    }

    return null
  }

  const findRoom = (query: string): Room | null => {
    const lowerQuery = query.toLowerCase()

    // Correspondance exacte d'abord
    let room = rooms.find(r => r.name.toLowerCase() === lowerQuery)
    if (room) return room

    // Correspondance partielle
    room = rooms.find(r => r.name.toLowerCase().includes(lowerQuery))
    if (room) return room

    // Correspondance par type
    room = rooms.find(r => r.type?.toLowerCase().includes(lowerQuery))
    if (room) return room

    // Synonymes courants
    const synonyms: Record<string, string[]> = {
      'cuisine': ['kitchen', 'cook'],
      'salon': ['séjour', 'living', 'salle de séjour'],
      'chambre': ['bedroom', 'room'],
      'salle de bain': ['bathroom', 'sdb', 'bain'],
      'wc': ['toilettes', 'toilet', 'toilette'],
      'entrée': ['hall', 'couloir', 'entry'],
      'balcon': ['terrasse', 'balcony'],
      'bureau': ['office', 'travail'],
    }

    for (const [key, values] of Object.entries(synonyms)) {
      if (values.some(v => lowerQuery.includes(v)) || lowerQuery.includes(key)) {
        room = rooms.find(r =>
          r.name.toLowerCase().includes(key) ||
          values.some(v => r.name.toLowerCase().includes(v))
        )
        if (room) return room
      }
    }

    return null
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    }

    setMessages(prev => [...prev, userMessage])
    const messageText = input.trim()
    setInput('')
    setIsLoading(true)

    try {
      // Vérifier si c'est une commande de navigation
      const navigationQuery = detectNavigationCommand(messageText)

      if (navigationQuery) {
        const room = findRoom(navigationQuery)

        if (room) {
          // Navigation trouvée
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `Je vous emmène dans ${room.name} !`,
            roomName: room.name,
            timecode: room.start_time
          }
          setMessages(prev => [...prev, assistantMessage])
          onNavigateToRoom?.(room.name)
        } else {
          // Pièce non trouvée
          const roomList = rooms.map(r => r.name).join(', ')
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `Je ne trouve pas cette pièce. Les pièces disponibles sont : ${roomList || 'Aucune pièce indexée pour le moment.'}`
          }
          setMessages(prev => [...prev, assistantMessage])
        }
      } else {
        // Question générale → appel API Gemini
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tourId,
            message: messageText,
            rooms: rooms.map(r => ({ name: r.name, type: r.type })),
            currentRoom: currentRoom?.name,
            history: messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
          })
        })

        if (!response.ok) {
          throw new Error('Erreur API')
        }

        const data = await response.json()

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message || data.response || 'Je suis là pour vous aider à explorer cette visite !'
        }
        setMessages(prev => [...prev, assistantMessage])

        // Si l'IA suggère une navigation
        if (data.roomName) {
          onNavigateToRoom?.(data.roomName)
        }
      }
    } catch (error) {
      console.error('Erreur chat:', error)
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Désolée, je rencontre un problème. Essayez de me demander de vous montrer une pièce, par exemple "Montre-moi la cuisine".'
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const toggleVoice = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('La reconnaissance vocale n\'est pas supportée par votre navigateur.')
      return
    }

    if (isListening) {
      setIsListening(false)
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'fr-FR'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setInput(transcript)
      // Auto-send après reconnaissance vocale
      setTimeout(() => {
        sendMessage()
      }, 300)
    }

    recognition.start()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-4 py-2 rounded-2xl ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-gray-700 text-gray-100 rounded-bl-md'
              }`}
            >
              <p className="text-sm">{message.content}</p>
              {message.roomName && (
                <button
                  onClick={() => onNavigateToRoom?.(message.roomName!)}
                  className="mt-2 text-xs text-blue-300 hover:text-blue-200 underline"
                >
                  → Revoir {message.roomName}
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 text-gray-100 px-4 py-2 rounded-2xl rounded-bl-md">
              <Loader2 size={16} className="animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions rapides */}
      {rooms.length > 0 && messages.length < 3 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-500 mb-2">Suggestions :</p>
          <div className="flex flex-wrap gap-1">
            {rooms.slice(0, 3).map(room => (
              <button
                key={room.id}
                onClick={() => {
                  setInput(`Montre-moi ${room.name}`)
                  setTimeout(sendMessage, 100)
                }}
                className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded-full hover:bg-gray-600"
              >
                {room.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <button
            onClick={toggleVoice}
            className={`p-2 rounded-lg transition ${
              isListening
                ? 'bg-red-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title={isListening ? 'Arrêter' : 'Parler'}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez votre question..."
            className="flex-1 px-4 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
