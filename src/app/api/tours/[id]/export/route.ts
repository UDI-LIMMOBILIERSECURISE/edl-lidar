import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tourId = params.id

  try {
    const supabase = createServerClient()

    // Charger le tour
    const { data: tour, error: tourError } = await supabase
      .from('virtual_tours')
      .select('*')
      .eq('id', tourId)
      .single()

    if (tourError || !tour) {
      return NextResponse.json({ error: 'Tour non trouvé' }, { status: 404 })
    }

    // Charger les pièces avec leurs surfaces
    const { data: rooms } = await supabase
      .from('tour_rooms')
      .select('*')
      .eq('tour_id', tourId)
      .order('display_order')

    // Calculer les totaux
    const totalFloor = rooms?.reduce((sum, r) => sum + (r.floor_surface_m2 || 0), 0) || 0
    const totalWalls = rooms?.reduce((sum, r) => sum + (r.wall_surface_m2 || 0), 0) || 0
    const totalCeiling = rooms?.reduce((sum, r) => sum + (r.ceiling_surface_m2 || 0), 0) || 0

    return NextResponse.json({
      tour: {
        id: tour.id,
        title: tour.title,
        address: tour.address,
        property_type: tour.property_type,
        has_lidar: tour.has_lidar,
        total_surface_m2: tour.total_surface_m2
      },
      rooms: rooms?.map(room => ({
        name: room.name,
        type: room.room_type,
        floor_m2: room.floor_surface_m2,
        walls_m2: room.wall_surface_m2,
        ceiling_m2: room.ceiling_surface_m2,
        ceiling_height_m: room.ceiling_height_m,
        volume_m3: room.volume_m3
      })) || [],
      totals: {
        floor_m2: Math.round(totalFloor * 100) / 100,
        walls_m2: Math.round(totalWalls * 100) / 100,
        ceiling_m2: Math.round(totalCeiling * 100) / 100
      },
      generated_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Erreur export:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
