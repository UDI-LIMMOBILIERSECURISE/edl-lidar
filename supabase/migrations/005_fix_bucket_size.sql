-- Migration: Fix bucket size limit
-- Date: 2026-01-19
-- Description: Mise à jour de la limite de taille du bucket tours

-- Mettre à jour la limite du bucket existant
UPDATE storage.buckets
SET file_size_limit = 524288000 -- 500 Mo
WHERE id = 'tours';

-- Si le bucket n'existe pas, le créer
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT
    'tours',
    'tours',
    true,
    524288000,
    ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'tours');
