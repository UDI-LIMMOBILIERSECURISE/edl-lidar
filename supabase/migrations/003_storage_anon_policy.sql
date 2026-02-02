-- Migration: Storage Anon Policy (DEV)
-- Date: 2026-01-19
-- Description: Permet l'upload anonyme pour le développement

-- Drop les anciennes policies si elles existent
DROP POLICY IF EXISTS "Authenticated users can upload to tours bucket" ON storage.objects;

-- Nouvelle policy: tout le monde peut upload (DEV ONLY)
-- En prod, remplacer par une policy auth.uid() = user_id
CREATE POLICY "Anyone can upload to tours bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tours');

-- Permettre la mise à jour pour tous (DEV ONLY)
DROP POLICY IF EXISTS "Users can update their own objects in tours bucket" ON storage.objects;
CREATE POLICY "Anyone can update tours bucket"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tours');

-- Permettre la suppression pour tous (DEV ONLY)
DROP POLICY IF EXISTS "Users can delete their own objects in tours bucket" ON storage.objects;
CREATE POLICY "Anyone can delete from tours bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'tours');
