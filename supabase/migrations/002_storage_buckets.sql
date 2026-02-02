-- Migration: Storage Buckets
-- Date: 2026-01-19
-- Description: Configuration des buckets de stockage pour les vidéos et images

-- Bucket pour les vidéos et assets des tours
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'tours',
    'tours',
    true,
    524288000, -- 500 Mo
    ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Politique RLS pour le bucket tours
-- Lecture publique
CREATE POLICY "Public read access on tours bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'tours');

-- Upload pour utilisateurs authentifiés
CREATE POLICY "Authenticated users can upload to tours bucket"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'tours'
    AND auth.role() = 'authenticated'
);

-- Mise à jour pour propriétaires
CREATE POLICY "Users can update their own objects in tours bucket"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'tours'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Suppression pour propriétaires
CREATE POLICY "Users can delete their own objects in tours bucket"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'tours'
    AND auth.uid()::text = (storage.foldername(name))[1]
);
