'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import TourPlayer from '@/components/TourPlayer'
import LiaChat from '@/components/LiaChat'
import {
  ArrowLeft,
  Share2,
  Download,
  Settings,
  MessageCircle,
  X,
  MapPin,
  Home,
  Loader2,
  Sparkles,
  RefreshCw,
  CheckCircle,
  Copy,
  ExternalLink,
  Globe,
  Lock,
  QrCode
} from 'lucide-react'

interface Tour {
  id: string
  title: string
  address: string
  property_type: string
  tour_type: string
  video_url: string | null
  thumbnail_url: string | null
  status: string
  has_lidar: boolean
  total_surface_m2: number | null
  is_public: boolean
  public_slug: string | null
  created_at: string
}

interface Room {
  id: string
  name: string
  room_type: string | null
  start_time: number
  end_time: number
  floor_surface_m2: number | null
  wall_surface_m2: number | null
  ceiling_surface_m2: number | null
}

interface Annotation {
  id: string
  room_id: string | null
  timecode: number
  text: string
  annotation_type: string | null
}

export default function TourDetailPage() {
  const params = useParams()
  const router = useRouter()
  const tourId = params.id as string

  const [tour, setTour] = useState<Tour | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [indexing, setIndexing] = useState(false)
  const [indexingStatus, setIndexingStatus] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadTour()
  }, [tourId])

  const loadTour = async () => {
    try {
      const supabase = getSupabase()

      // Charger le tour
      const { data: tourData, error: tourError } = await supabase
        .from('virtual_tours')
        .select('*')
        .eq('id', tourId)
        .single()

      if (tourError) throw tourError
      setTour(tourData)

      // Charger les pièces
      const { data: roomsData } = await supabase
        .from('tour_rooms')
        .select('*')
        .eq('tour_id', tourId)
        .order('display_order')

      setRooms(roomsData || [])

      // Charger les annotations
      const { data: annotationsData } = await supabase
        .from('tour_annotations')
        .select('*')
        .eq('tour_id', tourId)
        .order('timecode')

      setAnnotations(annotationsData || [])

    } catch (err) {
      console.error('Erreur chargement tour:', err)
      setError('Visite non trouvée')
    } finally {
      setLoading(false)
    }
  }

  const handleShare = async () => {
    if (tour?.is_public && tour?.public_slug) {
      const url = `${window.location.origin}/v/${tour.public_slug}`
      await navigator.clipboard.writeText(url)
      alert('Lien copié !')
    } else {
      alert('Publiez d\'abord la visite pour obtenir un lien de partage')
    }
  }

  const handlePublish = async () => {
    if (!tour || publishing) return
    setPublishing(true)

    try {
      const response = await fetch(`/api/tours/${tourId}/publish`, {
        method: 'POST'
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error)

      // Mettre à jour le tour local
      setTour(prev => prev ? {
        ...prev,
        is_public: true,
        public_slug: data.public_slug
      } : null)

      setShowShareModal(true)
    } catch (err) {
      console.error('Erreur publication:', err)
      alert('Erreur lors de la publication')
    } finally {
      setPublishing(false)
    }
  }

  const handleUnpublish = async () => {
    if (!tour || publishing) return
    if (!confirm('Depublier cette visite ? Le lien public ne fonctionnera plus.')) return

    setPublishing(true)
    try {
      await fetch(`/api/tours/${tourId}/publish`, { method: 'DELETE' })
      setTour(prev => prev ? { ...prev, is_public: false } : null)
    } catch (err) {
      console.error('Erreur depublication:', err)
    } finally {
      setPublishing(false)
    }
  }

  const copyLink = async () => {
    if (!tour?.public_slug) return
    const url = `${window.location.origin}/v/${tour.public_slug}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getEmbedCode = () => {
    if (!tour?.public_slug) return ''
    const url = `${window.location.origin}/v/${tour.public_slug}`
    return `<iframe src="${url}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`
  }

  const getPublicUrl = () => {
    if (!tour?.public_slug) return ''
    return `${window.location.origin}/v/${tour.public_slug}`
  }

  const handleIndex = async () => {
    if (!tour || indexing) return

    setIndexing(true)
    setIndexingStatus('Analyse IA en cours...')

    try {
      const response = await fetch(`/api/tours/${tourId}/index`, {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur d\'indexation')
      }

      setIndexingStatus(`${data.rooms?.length || 0} pièces détectées !`)

      // Recharger les données
      await loadTour()

      setTimeout(() => {
        setIndexingStatus(null)
      }, 3000)

    } catch (err) {
      console.error('Erreur indexation:', err)
      setIndexingStatus('Erreur lors de l\'indexation')
      setTimeout(() => {
        setIndexingStatus(null)
      }, 3000)
    } finally {
      setIndexing(false)
    }
  }

  const formatRoomsForPlayer = () => {
    return rooms.map(room => ({
      id: room.id,
      name: room.name,
      type: room.room_type || 'other',
      start_time: room.start_time,
      end_time: room.end_time,
      surfaces: room.floor_surface_m2 ? {
        floor_m2: room.floor_surface_m2,
        walls_m2: room.wall_surface_m2 || 0,
        ceiling_m2: room.ceiling_surface_m2 || 0
      } : undefined
    }))
  }

  const formatAnnotationsForPlayer = () => {
    return annotations.map(ann => ({
      id: ann.id,
      room_id: ann.room_id || '',
      timecode: ann.timecode,
      text: ann.text,
      type: ann.annotation_type || 'observation'
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 size={48} className="text-blue-500 animate-spin" />
      </div>
    )
  }

  if (error || !tour) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
        <h1 className="text-2xl font-bold mb-4">Visite non trouvée</h1>
        <Link href="/" className="text-blue-400 hover:underline">
          Retour à l'accueil
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 text-gray-400 hover:text-white transition"
            >
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-white font-semibold">{tour.title}</h1>
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <MapPin size={14} />
                {tour.address}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Index AI button */}
            <button
              onClick={handleIndex}
              disabled={indexing}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${
                rooms.length > 0
                  ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              } ${indexing ? 'opacity-50 cursor-wait' : ''}`}
              title={rooms.length > 0 ? 'Ré-indexer avec l\'IA' : 'Indexer les pièces avec l\'IA'}
            >
              {indexing ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : rooms.length > 0 ? (
                <CheckCircle size={18} />
              ) : (
                <Sparkles size={18} />
              )}
              <span className="text-sm hidden sm:inline">
                {indexing
                  ? 'Analyse...'
                  : rooms.length > 0
                    ? `${rooms.length} pièces`
                    : 'Indexer IA'
                }
              </span>
            </button>

            {/* Chat toggle */}
            <button
              onClick={() => setShowChat(!showChat)}
              className={`p-2 rounded-lg transition ${
                showChat
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
              title="Discuter avec Lia"
            >
              <MessageCircle size={20} />
            </button>

            {/* Publish/Share button */}
            {tour.is_public ? (
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <Globe size={18} />
                <span className="text-sm hidden sm:inline">Publie</span>
              </button>
            ) : (
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {publishing ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
                <span className="text-sm hidden sm:inline">{publishing ? 'Publication...' : 'Publier'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Indexing status notification */}
      {indexingStatus && (
        <div className={`px-4 py-2 text-center text-sm ${
          indexingStatus.includes('Erreur')
            ? 'bg-red-600 text-white'
            : indexingStatus.includes('détectées')
              ? 'bg-green-600 text-white'
              : 'bg-purple-600 text-white'
        }`}>
          {indexing && <RefreshCw size={14} className="inline animate-spin mr-2" />}
          {indexingStatus}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Video player */}
        <div className={`flex-1 relative ${showChat ? 'mr-80' : ''}`}>
          {tour.video_url ? (
            <TourPlayer
              videoUrl={tour.video_url}
              rooms={formatRoomsForPlayer()}
              annotations={formatAnnotationsForPlayer()}
              onTimeUpdate={setCurrentTime}
              onRoomChange={(room) => setCurrentRoom(room as Room | null)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p>Vidéo non disponible</p>
            </div>
          )}

          {/* Info panel - si pas de pièces indexées */}
          {rooms.length === 0 && (
            <div className="absolute bottom-20 left-4 right-4 bg-yellow-500/90 text-yellow-900 px-4 py-3 rounded-lg">
              <p className="font-medium">Pièces non indexées</p>
              <p className="text-sm">
                L'indexation IA n'a pas encore été effectuée.
                La navigation par pièces sera disponible après l'analyse.
              </p>
            </div>
          )}
        </div>

        {/* Chat sidebar */}
        {showChat && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">L</span>
                </div>
                <div>
                  <p className="text-white font-medium">Lia</p>
                  <p className="text-gray-400 text-xs">Assistant IA</p>
                </div>
              </div>
              <button
                onClick={() => setShowChat(false)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              <LiaChat
                tourId={tour.id}
                rooms={formatRoomsForPlayer()}
                currentRoom={currentRoom ? {
                  id: currentRoom.id,
                  name: currentRoom.name,
                  type: currentRoom.room_type || 'other',
                  start_time: currentRoom.start_time,
                  end_time: currentRoom.end_time
                } : null}
                onNavigateToRoom={(roomName) => {
                  const room = rooms.find(r =>
                    r.name.toLowerCase().includes(roomName.toLowerCase())
                  )
                  if (room) {
                    // Trigger navigation via TourPlayer
                    const video = document.querySelector('video')
                    if (video) {
                      video.currentTime = room.start_time
                      video.play()
                    }
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && tour?.public_slug && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Partager la visite</h2>
              <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            {/* Public URL */}
            <div className="mb-4">
              <label className="text-gray-400 text-sm block mb-2">Lien public</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={getPublicUrl()}
                  readOnly
                  className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
                />
                <button
                  onClick={copyLink}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Copy size={16} />
                  {copied ? 'Copie !' : 'Copier'}
                </button>
              </div>
            </div>

            {/* Open in new tab */}
            <a
              href={getPublicUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-4"
            >
              <ExternalLink size={16} />
              Ouvrir dans un nouvel onglet
            </a>

            {/* Embed code */}
            <div className="mb-4">
              <label className="text-gray-400 text-sm block mb-2">Code d'integration (iframe)</label>
              <textarea
                value={getEmbedCode()}
                readOnly
                rows={3}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-xs font-mono"
              />
            </div>

            {/* Unpublish button */}
            <button
              onClick={handleUnpublish}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              Depublier cette visite
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
