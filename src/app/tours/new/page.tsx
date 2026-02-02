'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import {
  Upload,
  Video,
  ArrowLeft,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Home,
  Building2,
  Store,
  HelpCircle
} from 'lucide-react'

type PropertyType = 'apartment' | 'house' | 'commercial' | 'other'
type TourType = 'sale' | 'rent' | 'edl'

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Appartement', icon: Building2 },
  { value: 'house', label: 'Maison', icon: Home },
  { value: 'commercial', label: 'Commercial', icon: Store },
  { value: 'other', label: 'Autre', icon: HelpCircle },
]

const TOUR_TYPES = [
  { value: 'sale', label: 'Vente' },
  { value: 'rent', label: 'Location' },
  { value: 'edl', label: 'État des lieux' },
]

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024 // 5 Go
const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']

export default function NewTourPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [address, setAddress] = useState('')
  const [propertyType, setPropertyType] = useState<PropertyType>('apartment')
  const [tourType, setTourType] = useState<TourType>('sale')

  // Upload state
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  // Drag & drop
  const [isDragging, setIsDragging] = useState(false)

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Format non supporté. Utilisez MP4, MOV, AVI ou WebM.'
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Fichier trop volumineux. Maximum ${MAX_FILE_SIZE / 1024 / 1024} Mo.`
    }
    return null
  }

  const handleFileSelect = (selectedFile: File) => {
    const validationError = validateFile(selectedFile)
    if (validationError) {
      setError(validationError)
      return
    }
    setFile(selectedFile)
    setError(null)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const removeFile = () => {
    setFile(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} Ko`
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file || !title || !address) {
      setError('Veuillez remplir tous les champs et sélectionner une vidéo.')
      return
    }

    setUploading(true)
    setUploadStatus('uploading')
    setUploadProgress(0)
    setError(null)

    try {
      const supabase = getSupabase()

      // 1. Obtenir presigned URL depuis notre API
      const presignedRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      })

      if (!presignedRes.ok) {
        throw new Error('Erreur obtention URL upload')
      }

      const { uploadUrl, publicUrl, key } = await presignedRes.json()

      // 2. Upload vers R2 avec progression réelle via XMLHttpRequest
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100)
            setUploadProgress(progress)
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Upload échoué: ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Erreur réseau')))
        xhr.addEventListener('abort', () => reject(new Error('Upload annulé')))

        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })

      setUploadProgress(100)
      setUploadStatus('processing')

      // 3. Créer l'entrée tour dans Supabase
      const { data: { user } } = await supabase.auth.getUser()

      const tourData: any = {
        title,
        address,
        property_type: propertyType,
        tour_type: tourType,
        video_url: publicUrl,
        status: 'ready'
      }

      if (user?.id) {
        tourData.user_id = user.id
      }

      const { data: tour, error: dbError } = await supabase
        .from('virtual_tours')
        .insert(tourData)
        .select()
        .single()

      if (dbError) {
        throw new Error(`Erreur création: ${dbError.message}`)
      }

      setUploadStatus('success')

      setTimeout(() => {
        router.push(`/tours/${tour.id}`)
      }, 2000)

    } catch (err) {
      console.error('Erreur upload:', err)
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
      setUploadStatus('error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Nouvelle visite virtuelle
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Uploadez votre vidéo pour créer une visite interactive
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Infos de base */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Informations du bien
            </h2>

            {/* Titre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Titre de la visite *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Appartement T3 lumineux - Bastille"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                required
                disabled={uploading}
              />
            </div>

            {/* Adresse */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Adresse *
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: 15 rue de la Roquette, 75011 Paris"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                required
                disabled={uploading}
              />
            </div>

            {/* Type de bien */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type de bien
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PROPERTY_TYPES.map((type) => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setPropertyType(type.value as PropertyType)}
                      disabled={uploading}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition ${
                        propertyType === type.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Icon size={24} className={propertyType === type.value ? 'text-blue-500' : 'text-gray-400'} />
                      <span className={`text-sm ${propertyType === type.value ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>
                        {type.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Type de visite */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type de visite
              </label>
              <div className="flex gap-2">
                {TOUR_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setTourType(type.value as TourType)}
                    disabled={uploading}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 transition ${
                      tourType === type.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Upload vidéo */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Vidéo du bien *
            </h2>

            {!file ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  <span className="text-blue-600 dark:text-blue-400 font-medium">Cliquez pour sélectionner</span>
                  {' '}ou glissez-déposez
                </p>
                <p className="text-sm text-gray-500">
                  MP4, MOV, AVI ou WebM • Max 5 Go
                </p>
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Video size={24} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {file.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  {!uploading && (
                    <button
                      type="button"
                      onClick={removeFile}
                      className="p-2 text-gray-400 hover:text-red-500 transition"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>

                {/* Progress bar */}
                {uploadStatus !== 'idle' && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">
                        {uploadStatus === 'uploading' && 'Upload en cours...'}
                        {uploadStatus === 'processing' && 'Traitement en cours...'}
                        {uploadStatus === 'success' && 'Terminé !'}
                        {uploadStatus === 'error' && 'Erreur'}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">
                        {uploadProgress}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          uploadStatus === 'error' ? 'bg-red-500' :
                          uploadStatus === 'success' ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Success message */}
          {uploadStatus === 'success' && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-green-700 dark:text-green-300 font-medium">
                  Visite créée avec succès !
                </p>
                <p className="text-green-600 dark:text-green-400 text-sm">
                  Redirection en cours...
                </p>
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={!file || !title || !address || uploading || uploadStatus === 'success'}
            className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                {uploadStatus === 'uploading' ? 'Upload en cours...' : 'Traitement...'}
              </>
            ) : uploadStatus === 'success' ? (
              <>
                <CheckCircle size={20} />
                Visite créée !
              </>
            ) : (
              <>
                <Upload size={20} />
                Créer la visite virtuelle
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  )
}
