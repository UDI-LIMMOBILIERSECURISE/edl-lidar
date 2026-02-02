import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { nanoid } from 'nanoid'

// Generer un slug court et unique
function generateSlug(): string {
  return nanoid(10)
}

// POST - Publier la visite
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tourId = params.id

  try {
    const supabase = createServerClient()

    // Verifier que le tour existe
    const { data: tour, error: tourError } = await supabase
      .from('virtual_tours')
      .select('id, is_public, public_slug')
      .eq('id', tourId)
      .single()

    if (tourError || !tour) {
      return NextResponse.json({ error: 'Tour non trouve' }, { status: 404 })
    }

    // Si deja publie, retourner le slug existant
    if (tour.is_public && tour.public_slug) {
      return NextResponse.json({
        success: true,
        public_slug: tour.public_slug,
        already_published: true
      })
    }

    // Generer un nouveau slug
    const slug = generateSlug()

    // Mettre a jour le tour
    const { error: updateError } = await supabase
      .from('virtual_tours')
      .update({
        is_public: true,
        public_slug: slug,
        published_at: new Date().toISOString()
      })
      .eq('id', tourId)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      public_slug: slug,
      already_published: false
    })

  } catch (error) {
    console.error('Erreur publication:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Depublier la visite
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tourId = params.id

  try {
    const supabase = createServerClient()

    const { error } = await supabase
      .from('virtual_tours')
      .update({
        is_public: false
      })
      .eq('id', tourId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Erreur depublication:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
