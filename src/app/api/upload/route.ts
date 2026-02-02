import { NextRequest, NextResponse } from 'next/server'
import { getUploadPresignedUrl, generateVideoKey } from '@/lib/r2'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filename, contentType } = body

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: 'filename et contentType requis' },
        { status: 400 }
      )
    }

    // Valider le type de fichier
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo']
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        { error: 'Type de fichier non supporté' },
        { status: 400 }
      )
    }

    // Générer clé unique et URL présignée
    const key = generateVideoKey(filename)
    const { uploadUrl, publicUrl } = await getUploadPresignedUrl(key, contentType)

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      key,
    })
  } catch (error) {
    console.error('Erreur génération presigned URL:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
