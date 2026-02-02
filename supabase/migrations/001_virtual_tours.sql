-- Migration: Virtual Tours Schema
-- Date: 2026-01-17
-- Description: Schéma initial pour les visites virtuelles interactives

-- Table principale des visites virtuelles
CREATE TABLE IF NOT EXISTS virtual_tours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edl_id UUID,  -- Lien avec EDL si existant (nullable)

    -- Métadonnées
    title TEXT NOT NULL,
    address TEXT NOT NULL,
    property_type TEXT NOT NULL CHECK (property_type IN ('apartment', 'house', 'commercial', 'other')),
    tour_type TEXT NOT NULL CHECK (tour_type IN ('sale', 'rent', 'edl')),

    -- Statut
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),

    -- Vidéo
    video_url TEXT,
    video_duration_seconds INTEGER,
    thumbnail_url TEXT,

    -- Données LiDAR (nullable si non-LiDAR)
    has_lidar BOOLEAN DEFAULT false,
    total_surface_m2 DECIMAL(10,2),
    floor_plan_url TEXT,
    point_cloud_url TEXT,

    -- Métadonnées IA
    ai_indexed BOOLEAN DEFAULT false,
    ai_index_version TEXT,

    -- Partage
    public_slug TEXT UNIQUE,
    is_public BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,

    -- Propriétaire
    user_id UUID REFERENCES auth.users(id) NOT NULL
);

-- Index des pièces
CREATE TABLE IF NOT EXISTS tour_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID REFERENCES virtual_tours(id) ON DELETE CASCADE,

    -- Identification
    name TEXT NOT NULL,
    room_type TEXT,
    floor_number INTEGER DEFAULT 0,

    -- Timecodes vidéo (en secondes)
    start_time DECIMAL(10,2) NOT NULL,
    end_time DECIMAL(10,2) NOT NULL,

    -- Surfaces LiDAR (nullable)
    floor_surface_m2 DECIMAL(10,2),
    wall_surface_m2 DECIMAL(10,2),
    ceiling_surface_m2 DECIMAL(10,2),
    ceiling_height_m DECIMAL(5,2),
    volume_m3 DECIMAL(10,2),

    -- Détection
    detection_method TEXT CHECK (detection_method IN ('roomplan', 'voice', 'gemini', 'manual')),
    detection_confidence DECIMAL(3,2),

    -- Ordre d'affichage
    display_order INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Annotations vocales
CREATE TABLE IF NOT EXISTS tour_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID REFERENCES virtual_tours(id) ON DELETE CASCADE,
    room_id UUID REFERENCES tour_rooms(id),

    -- Contenu
    text TEXT NOT NULL,
    annotation_type TEXT CHECK (annotation_type IN ('observation', 'defect', 'feature')),

    -- Position temporelle
    timecode DECIMAL(10,2) NOT NULL,

    -- Position spatiale (LiDAR)
    position_x DECIMAL(10,4),
    position_y DECIMAL(10,4),
    position_z DECIMAL(10,4),

    -- Photo extraite
    photo_url TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions de chat Lia
CREATE TABLE IF NOT EXISTS lia_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID REFERENCES virtual_tours(id) ON DELETE CASCADE,

    -- Visiteur (anonyme possible)
    visitor_id TEXT,

    -- Métriques
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    message_count INTEGER DEFAULT 0,

    -- Engagement
    rooms_visited TEXT[],
    total_watch_time_seconds INTEGER
);

-- Messages du chat
CREATE TABLE IF NOT EXISTS lia_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES lia_sessions(id) ON DELETE CASCADE,

    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,

    -- Action déclenchée
    action_type TEXT CHECK (action_type IN ('seek', 'info', 'staging')),
    action_data JSONB,

    -- Coût IA
    model_used TEXT,
    tokens_used INTEGER,
    cost_usd DECIMAL(10,6),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_tours_user ON virtual_tours(user_id);
CREATE INDEX IF NOT EXISTS idx_tours_slug ON virtual_tours(public_slug);
CREATE INDEX IF NOT EXISTS idx_tours_status ON virtual_tours(status);
CREATE INDEX IF NOT EXISTS idx_rooms_tour ON tour_rooms(tour_id);
CREATE INDEX IF NOT EXISTS idx_annotations_tour ON tour_annotations(tour_id);
CREATE INDEX IF NOT EXISTS idx_lia_sessions_tour ON lia_sessions(tour_id);
CREATE INDEX IF NOT EXISTS idx_lia_messages_session ON lia_messages(session_id);

-- Row Level Security (RLS)
ALTER TABLE virtual_tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lia_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lia_messages ENABLE ROW LEVEL SECURITY;

-- Policies pour virtual_tours
CREATE POLICY "Users can view their own tours"
    ON virtual_tours FOR SELECT
    USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert their own tours"
    ON virtual_tours FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tours"
    ON virtual_tours FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tours"
    ON virtual_tours FOR DELETE
    USING (auth.uid() = user_id);

-- Policies pour tour_rooms (hérité de virtual_tours)
CREATE POLICY "Users can view rooms of accessible tours"
    ON tour_rooms FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM virtual_tours
            WHERE virtual_tours.id = tour_rooms.tour_id
            AND (virtual_tours.user_id = auth.uid() OR virtual_tours.is_public = true)
        )
    );

CREATE POLICY "Users can manage rooms of their tours"
    ON tour_rooms FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM virtual_tours
            WHERE virtual_tours.id = tour_rooms.tour_id
            AND virtual_tours.user_id = auth.uid()
        )
    );

-- Policies pour tour_annotations (hérité de virtual_tours)
CREATE POLICY "Users can view annotations of accessible tours"
    ON tour_annotations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM virtual_tours
            WHERE virtual_tours.id = tour_annotations.tour_id
            AND (virtual_tours.user_id = auth.uid() OR virtual_tours.is_public = true)
        )
    );

CREATE POLICY "Users can manage annotations of their tours"
    ON tour_annotations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM virtual_tours
            WHERE virtual_tours.id = tour_annotations.tour_id
            AND virtual_tours.user_id = auth.uid()
        )
    );

-- Policies pour lia_sessions (lecture publique, écriture service)
CREATE POLICY "Anyone can create lia sessions"
    ON lia_sessions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Tour owners can view their sessions"
    ON lia_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM virtual_tours
            WHERE virtual_tours.id = lia_sessions.tour_id
            AND virtual_tours.user_id = auth.uid()
        )
    );

-- Policies pour lia_messages
CREATE POLICY "Anyone can create lia messages"
    ON lia_messages FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Tour owners can view their messages"
    ON lia_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM lia_sessions
            JOIN virtual_tours ON virtual_tours.id = lia_sessions.tour_id
            WHERE lia_sessions.id = lia_messages.session_id
            AND virtual_tours.user_id = auth.uid()
        )
    );

-- Fonction pour générer un slug unique
CREATE OR REPLACE FUNCTION generate_tour_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_public = true AND NEW.public_slug IS NULL THEN
        NEW.public_slug := encode(gen_random_bytes(6), 'base64');
        NEW.public_slug := replace(NEW.public_slug, '/', '_');
        NEW.public_slug := replace(NEW.public_slug, '+', '-');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_tour_slug
    BEFORE INSERT OR UPDATE ON virtual_tours
    FOR EACH ROW
    EXECUTE FUNCTION generate_tour_slug();

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_virtual_tours_updated_at
    BEFORE UPDATE ON virtual_tours
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Commentaires de documentation
COMMENT ON TABLE virtual_tours IS 'Visites virtuelles interactives générées depuis les captures EDL LIDAR';
COMMENT ON TABLE tour_rooms IS 'Index des pièces détectées dans une visite virtuelle';
COMMENT ON TABLE tour_annotations IS 'Annotations vocales de l agent pendant la capture';
COMMENT ON TABLE lia_sessions IS 'Sessions de chat avec l assistant IA Lia';
COMMENT ON TABLE lia_messages IS 'Messages échangés pendant une session Lia';
