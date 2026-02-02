// Client Cloudflare R2 (S3-compatible)
// Utilisé côté serveur uniquement (API routes)

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Configuration R2
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'edllidarvideos'

// Endpoint R2
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

// Client S3 configuré pour R2
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // R2 utilise path-style, pas virtual-hosted
})

// Génère une URL présignée pour upload (PUT)
export async function getUploadPresignedUrl(key: string, contentType: string, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  })

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn })

  // URL publique pour lecture
  // Option 1: Si bucket public activé → https://pub-{account}.r2.dev/{bucket}/{key}
  // Option 2: Si custom domain → configurer R2_PUBLIC_URL
  // Option 3: Presigned URL pour lecture (fallback)
  const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL
  const publicUrl = R2_PUBLIC_URL
    ? `${R2_PUBLIC_URL}/${key}`
    : `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`

  return { uploadUrl, publicUrl, key }
}

// Génère une URL présignée pour lecture (GET) - si bucket privé
export async function getReadPresignedUrl(key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  })

  return getSignedUrl(r2Client, command, { expiresIn })
}

// Génère un nom de fichier unique
export function generateVideoKey(filename: string): string {
  const ext = filename.split('.').pop() || 'mp4'
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `videos/${timestamp}-${random}.${ext}`
}
