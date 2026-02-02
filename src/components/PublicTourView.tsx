'use client'

import { useRef, useState, useCallback } from 'react'
import TourPlayer from './TourPlayer'
import LiaChat from './LiaChat'

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

  // Callback pour naviguer vers une pièce depuis Lia
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

  // Callback pour recevoir la ref vidéo du TourPlayer
  const handleVideoRef = useCallback((ref: HTMLVideoElement | null) => {
    videoRef.current = ref
  }, [])

  return (
    <>
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

      {/* Chat Lia - panneau fixe en bas à droite */}
      <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-gray-900 rounded-xl shadow-2xl border border-gray-700 overflow-hidden z-50">
        <LiaChat
          tourId={tourId}
          rooms={rooms}
          currentRoom={currentRoom}
          onNavigateToRoom={handleNavigateToRoom}
        />
      </div>
    </>
  )
}
