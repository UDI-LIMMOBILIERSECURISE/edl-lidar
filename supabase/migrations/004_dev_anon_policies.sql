-- Migration: Dev Anonymous Policies
-- Date: 2026-01-19
-- Description: Policies permissives pour le développement (à sécuriser en prod)

-- Permettre l'insertion anonyme dans virtual_tours
DROP POLICY IF EXISTS "Users can insert their own tours" ON virtual_tours;
CREATE POLICY "Anyone can insert tours (DEV)"
ON virtual_tours FOR INSERT
WITH CHECK (true);

-- Permettre la lecture anonyme de tous les tours
DROP POLICY IF EXISTS "Users can view their own tours" ON virtual_tours;
CREATE POLICY "Anyone can view tours (DEV)"
ON virtual_tours FOR SELECT
USING (true);

-- Permettre la mise à jour anonyme
DROP POLICY IF EXISTS "Users can update their own tours" ON virtual_tours;
CREATE POLICY "Anyone can update tours (DEV)"
ON virtual_tours FOR UPDATE
USING (true);

-- Permettre la suppression anonyme
DROP POLICY IF EXISTS "Users can delete their own tours" ON virtual_tours;
CREATE POLICY "Anyone can delete tours (DEV)"
ON virtual_tours FOR DELETE
USING (true);

-- Rendre user_id nullable pour le dev
ALTER TABLE virtual_tours ALTER COLUMN user_id DROP NOT NULL;
