import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import PublicTourView from '@/components/PublicTourView'

interface PageProps {
  params: { slug: string }
}

// Générer les métadonnées dynamiquement
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = createServerClient()
  const { data: tour } = await supabase
    .from('virtual_tours')
    .select('*')
    .eq('public_slug', params.slug)
    .eq('is_public', true)
    .single()

  if (!tour) {
    return {
      title: 'Visite non trouvée - EDL LIDAR'
    }
  }

  return {
    title: `${tour.title} - Visite Virtuelle`,
    description: `Visitez ${tour.address} en visite virtuelle interactive`,
    openGraph: {
      title: `${tour.title} - Visite Virtuelle`,
      description: `Visitez ${tour.address} en visite virtuelle interactive avec l'assistant IA Lia`,
      type: 'website',
      images: tour.thumbnail_url ? [tour.thumbnail_url] : [],
    },
  }
}

export default async function PublicTourPage({ params }: PageProps) {
  const supabase = createServerClient()

  // Charger la visite
  const { data: tour, error } = await supabase
    .from('virtual_tours')
    .select('*')
    .eq('public_slug', params.slug)
    .eq('is_public', true)
    .single()

  if (error || !tour) {
    notFound()
  }

  // Charger les pièces
  const { data: rooms } = await supabase
    .from('tour_rooms')
    .select('*')
    .eq('tour_id', tour.id)
    .order('display_order')

  // Charger les annotations
  const { data: annotations } = await supabase
    .from('tour_annotations')
    .select('*')
    .eq('tour_id', tour.id)
    .order('timecode')

  // Construire l'index pour Lia
  const tourIndex = {
    version: '1.0',
    tour_id: tour.id,
    created_at: tour.created_at,
    has_lidar: tour.has_lidar,
    property: {
      address: tour.address,
      type: tour.property_type,
      total_surface_m2: tour.total_surface_m2
    },
    video: {
      duration_seconds: tour.video_duration_seconds || 0,
      resolution: '1920x1080',
      codec: 'h265'
    },
    rooms: (rooms || []).map(room => ({
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
    })),
    annotations: (annotations || []).map(annot => ({
      id: annot.id,
      room_id: annot.room_id || '',
      timecode: annot.timecode,
      text: annot.text,
      type: annot.annotation_type || 'observation',
      position_3d: annot.position_x ? [annot.position_x, annot.position_y, annot.position_z] as [number, number, number] : undefined,
      photo_url: annot.photo_url || undefined
    }))
  }

  return (
    <main className="min-h-screen bg-black">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white">
              {tour.title}
            </h1>
            <p className="text-sm text-gray-300">
              {tour.address}
            </p>
          </div>
          {tour.has_lidar && tour.total_surface_m2 && (
            <div className="bg-white/10 backdrop-blur px-3 py-1 rounded-lg">
              <span className="text-white text-sm">
                {tour.total_surface_m2} m²
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Player + Chat Lia (coordonnés via PublicTourView) */}
      <PublicTourView
        tourId={tour.id}
        videoUrl={tour.video_url || ''}
        rooms={tourIndex.rooms}
        annotations={tourIndex.annotations}
      />
    </main>
  )
}
