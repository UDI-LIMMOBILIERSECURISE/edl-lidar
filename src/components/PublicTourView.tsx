'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import TourPlayer from './TourPlayer'
import LiaChat from './LiaChat'
import AnalyticsTracker, {
  useRoomTracking,
  useLiaTracking,
  useVideoTracking,
} from './AnalyticsTracker'

interface Room {
  id: string
  name: string
  type: string
  start_time: number
  end_time: number
  surfaces?: {
    floor_m2: number
    walls_m2: number
    ceiling_m2: number
  }
}

interface Annotation {
  id: string
  room_id: string
  timecode: number
  text: string
  type: string
}

interface PublicTourViewProps {
  tourId: string
  videoUrl: string
  rooms: Room[]
  annotations: Annotation[]
}

export default function PublicTourView({
  tourId,
  videoUrl,
  rooms,
  annotations
}: PublicTourViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [viewId, setViewId] = useState<string | null>(null)

  // Analytics tracking hooks
  const { trackRoomChange } = useRoomTracking(viewId)
  const { trackLiaOpen, trackLiaClose, trackLiaMessage } = useLiaTracking(viewId)
  const { trackPlay, trackPause, trackSeek, trackVideoEnd } = useVideoTracking(viewId)

  // Track room changes
  useEffect(() => {
    if (currentRoom) {
      trackRoomChange(currentRoom.id, currentRoom.name)
    } else {
      trackRoomChange(null, null)
    }
  }, [currentRoom, trackRoomChange])

  // Callback pour naviguer vers une piece depuis Lia
  const handleNavigateToRoom = useCallback((roomName: string) => {
    const room = rooms.find(r =>
      r.name.toLowerCase() === roomName.toLowerCase() ||
      r.name.toLowerCase().includes(roomName.toLowerCase())
    )

    if (room && videoRef.current) {
      videoRef.current.currentTime = room.start_time
      videoRef.current.play()
    }
  }, [rooms])

  // Callback pour recevoir la ref video du TourPlayer
  const handleVideoRef = useCallback((ref: HTMLVideoElement | null) => {
    videoRef.current = ref

    // Add video event listeners for analytics
    if (ref) {
      ref.addEventListener('play', () => {
        trackPlay(ref.currentTime)
      })

      ref.addEventListener('pause', () => {
        trackPause(ref.currentTime)
      })

      ref.addEventListener('ended', () => {
        trackVideoEnd()
      })

      // Track seeks (detect significant time jumps)
      let lastTime = 0
      ref.addEventListener('timeupdate', () => {
        const currentTime = ref.currentTime
        const timeDiff = Math.abs(currentTime - lastTime)
        // If time jumped more than 2 seconds, it's likely a seek
        if (timeDiff > 2 && lastTime > 0) {
          trackSeek(lastTime, currentTime)
        }
        lastTime = currentTime
      })
    }
  }, [trackPlay, trackPause, trackSeek, trackVideoEnd])

  // Callback quand view_id est pret
  const handleViewIdReady = useCallback((id: string) => {
    setViewId(id)
  }, [])

  // Callbacks pour les interactions Lia
  const handleLiaOpen = useCallback(() => {
    trackLiaOpen()
  }, [trackLiaOpen])

  const handleLiaClose = useCallback(() => {
    trackLiaClose()
  }, [trackLiaClose])

  const handleLiaMessage = useCallback((message: string) => {
    trackLiaMessage(message)
  }, [trackLiaMessage])

  return (
    <>
      {/* Analytics Tracker (invisible) */}
      <AnalyticsTracker
        tourId={tourId}
        onViewIdReady={handleViewIdReady}
      />

      {/* Player */}
      <div className="relative h-screen">
        <TourPlayer
          videoUrl={videoUrl}
          rooms={rooms}
          annotations={annotations}
          onRoomChange={setCurrentRoom}
          onVideoRef={handleVideoRef}
        />
      </div>

      {/* Chat Lia - panneau fixe en bas a droite */}
      <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-gray-900 rounded-xl shadow-2xl border border-gray-700 overflow-hidden z-50">
        <LiaChat
          tourId={tourId}
          rooms={rooms}
          currentRoom={currentRoom}
          onNavigateToRoom={handleNavigateToRoom}
          onOpen={handleLiaOpen}
          onClose={handleLiaClose}
          onMessage={handleLiaMessage}
        />
      </div>
    </>
  )
}
