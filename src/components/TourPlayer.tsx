'use client'

import { useRef, useState, useEffect } from 'react'
import { Play, Pause, Maximize, Volume2, VolumeX } from 'lucide-react'

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

interface TourPlayerProps {
  videoUrl: string
  rooms: Room[]
  annotations: Annotation[]
  onTimeUpdate?: (time: number) => void
  onRoomChange?: (room: Room | null) => void
  onVideoRef?: (ref: HTMLVideoElement | null) => void
}

export default function TourPlayer({
  videoUrl,
  rooms,
  annotations,
  onTimeUpdate,
  onRoomChange,
  onVideoRef
}: TourPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Exposer la ref vidéo au parent
  useEffect(() => {
    onVideoRef?.(videoRef.current)
  }, [onVideoRef])
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)

  // Mettre à jour le temps courant
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      const time = video.currentTime
      setCurrentTime(time)
      onTimeUpdate?.(time)

      // Détecter la pièce actuelle
      const room = rooms.find(r => time >= r.start_time && time < r.end_time)
      if (room?.id !== currentRoom?.id) {
        setCurrentRoom(room || null)
        onRoomChange?.(room || null)
      }
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [rooms, currentRoom, onTimeUpdate, onRoomChange])

  // Contrôles
  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      video.play()
    }
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const toggleFullscreen = () => {
    const video = videoRef.current
    if (!video) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      video.requestFullscreen()
    }
  }

  const seekTo = (time: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = time
  }

  const navigateToRoom = (room: Room) => {
    seekTo(room.start_time)
    if (!isPlaying) {
      videoRef.current?.play()
      setIsPlaying(true)
    }
  }

  // Formater le temps
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Calculer la position des marqueurs sur la timeline
  const getMarkerPosition = (time: number) => {
    return (time / duration) * 100
  }

  return (
    <div className="relative w-full h-full bg-black group">
      {/* Video */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain"
        playsInline
        onClick={togglePlay}
      />

      {/* Overlay - Info pièce actuelle */}
      {currentRoom && (
        <div className="absolute top-20 left-4 bg-black/50 backdrop-blur px-4 py-2 rounded-lg">
          <p className="text-white font-medium">{currentRoom.name}</p>
          {currentRoom.surfaces && (
            <p className="text-gray-300 text-sm">
              {currentRoom.surfaces.floor_m2} m²
            </p>
          )}
        </div>
      )}

      {/* Controls - visible on hover */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Timeline */}
        <div className="relative h-1 bg-white/30 rounded-full mb-4 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const pos = (e.clientX - rect.left) / rect.width
            seekTo(pos * duration)
          }}
        >
          {/* Progress */}
          <div
            className="absolute h-full bg-blue-500 rounded-full"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />

          {/* Room markers */}
          {rooms.map((room) => (
            <div
              key={room.id}
              className="timeline-marker"
              style={{ left: `${getMarkerPosition(room.start_time)}%` }}
              title={room.name}
              onClick={(e) => {
                e.stopPropagation()
                navigateToRoom(room)
              }}
            />
          ))}
        </div>

        {/* Buttons row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="text-white hover:text-blue-400 transition"
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>

            {/* Mute */}
            <button
              onClick={toggleMute}
              className="text-white hover:text-blue-400 transition"
            >
              {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>

            {/* Time */}
            <span className="text-white text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-blue-400 transition"
            >
              <Maximize size={24} />
            </button>
          </div>
        </div>

        {/* Room navigation */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => navigateToRoom(room)}
              className={`room-nav-btn whitespace-nowrap ${
                currentRoom?.id === room.id ? 'active' : ''
              }`}
            >
              {room.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Export pour utilisation externe (navigation depuis Lia)
export const seekToTime = (videoElement: HTMLVideoElement, time: number) => {
  videoElement.currentTime = time
}
