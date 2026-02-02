-- Migration: Dev Policies for tour_rooms
-- Date: 2026-01-20
-- Description: Policies permissives pour tour_rooms en développement

-- Permettre toutes les opérations anonymes sur tour_rooms
DROP POLICY IF EXISTS "Users can view rooms of accessible tours" ON tour_rooms;
DROP POLICY IF EXISTS "Users can manage rooms of their tours" ON tour_rooms;

CREATE POLICY "Anyone can view rooms (DEV)"
ON tour_rooms FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert rooms (DEV)"
ON tour_rooms FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update rooms (DEV)"
ON tour_rooms FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete rooms (DEV)"
ON tour_rooms FOR DELETE
USING (true);
