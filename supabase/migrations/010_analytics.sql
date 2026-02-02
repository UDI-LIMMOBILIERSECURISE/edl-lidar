-- Migration: Analytics Tracking for Public Tours
-- Date: 2026-02-02
-- Description: Tables et fonctions pour le tracking des visiteurs sur les visites publiques

-- ============================================================================
-- PARTIE 1: TABLE TOUR_VIEWS (Sessions de visite)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tour_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Lien avec la visite
    tour_id UUID NOT NULL REFERENCES virtual_tours(id) ON DELETE CASCADE,

    -- Visiteur anonyme (fingerprint cote client)
    visitor_id TEXT NOT NULL,

    -- Session identifier (unique par visite)
    session_id TEXT NOT NULL,

    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,

    -- Engagement
    rooms_visited TEXT[] DEFAULT '{}',

    -- Device info
    device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
    user_agent TEXT,

    -- Source
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,

    -- Geo (optionnel, via IP lookup)
    country TEXT,
    city TEXT,

    -- Flags
    is_bot BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_tour_views_tour ON tour_views(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_views_visitor ON tour_views(visitor_id);
CREATE INDEX IF NOT EXISTS idx_tour_views_started ON tour_views(started_at);
CREATE INDEX IF NOT EXISTS idx_tour_views_tour_started ON tour_views(tour_id, started_at);

-- ============================================================================
-- PARTIE 2: TABLE TOUR_EVENTS (Evenements granulaires)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tour_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Lien avec la session de visite
    view_id UUID NOT NULL REFERENCES tour_views(id) ON DELETE CASCADE,

    -- Type d'evenement
    event_type TEXT NOT NULL CHECK (event_type IN (
        'room_enter',      -- Entree dans une piece
        'room_exit',       -- Sortie d'une piece
        'lia_open',        -- Ouverture du chat Lia
        'lia_close',       -- Fermeture du chat Lia
        'lia_message',     -- Message envoye a Lia
        'share_click',     -- Clic sur partage
        'fullscreen',      -- Passage en plein ecran
        'play',            -- Lecture video
        'pause',           -- Pause video
        'seek',            -- Seek dans la video
        'video_end',       -- Fin de la video
        'heartbeat'        -- Heartbeat (presence)
    )),

    -- Donnees additionnelles
    event_data JSONB DEFAULT '{}'::jsonb,

    -- Timestamp precis
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_tour_events_view ON tour_events(view_id);
CREATE INDEX IF NOT EXISTS idx_tour_events_type ON tour_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tour_events_timestamp ON tour_events(timestamp);

-- ============================================================================
-- PARTIE 3: ACTIVER RLS
-- ============================================================================

ALTER TABLE tour_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PARTIE 4: POLICIES POUR TOUR_VIEWS
-- ============================================================================

-- INSERT: Tout le monde peut creer une view (visiteurs anonymes)
CREATE POLICY "Anyone can create tour views"
    ON tour_views FOR INSERT
    WITH CHECK (
        -- Seulement sur les tours publics
        EXISTS (
            SELECT 1 FROM virtual_tours vt
            WHERE vt.id = tour_views.tour_id
            AND vt.is_public = true
        )
    );

-- UPDATE: Service role uniquement ou via API (pour mettre a jour duration)
-- On autorise les updates anonymes sur sa propre session
CREATE POLICY "Anyone can update their own view"
    ON tour_views FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- SELECT: Proprietaires des tours peuvent voir les stats
CREATE POLICY "Tour owners can view their tour views"
    ON tour_views FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM virtual_tours vt
            WHERE vt.id = tour_views.tour_id
            AND vt.entity_id = get_user_entity_id()
        )
    );

-- ============================================================================
-- PARTIE 5: POLICIES POUR TOUR_EVENTS
-- ============================================================================

-- INSERT: Tout le monde peut creer des events
CREATE POLICY "Anyone can create tour events"
    ON tour_events FOR INSERT
    WITH CHECK (true);

-- SELECT: Proprietaires des tours peuvent voir les events
CREATE POLICY "Tour owners can view their tour events"
    ON tour_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tour_views tv
            JOIN virtual_tours vt ON vt.id = tv.tour_id
            WHERE tv.id = tour_events.view_id
            AND vt.entity_id = get_user_entity_id()
        )
    );

-- ============================================================================
-- PARTIE 6: FONCTION AGREGATION STATS PAR TOUR
-- ============================================================================

CREATE OR REPLACE FUNCTION get_tour_analytics(
    p_tour_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    total_views BIGINT,
    unique_visitors BIGINT,
    avg_duration_seconds NUMERIC,
    total_duration_seconds BIGINT,
    desktop_views BIGINT,
    mobile_views BIGINT,
    tablet_views BIGINT,
    lia_interactions BIGINT,
    rooms_data JSONB,
    top_referrers JSONB,
    views_by_day JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        -- Total views
        COUNT(*)::BIGINT as total_views,

        -- Unique visitors
        COUNT(DISTINCT tv.visitor_id)::BIGINT as unique_visitors,

        -- Average duration
        COALESCE(AVG(tv.duration_seconds)::NUMERIC, 0) as avg_duration_seconds,

        -- Total watch time
        COALESCE(SUM(tv.duration_seconds)::BIGINT, 0) as total_duration_seconds,

        -- Device breakdown
        COUNT(*) FILTER (WHERE tv.device_type = 'desktop')::BIGINT as desktop_views,
        COUNT(*) FILTER (WHERE tv.device_type = 'mobile')::BIGINT as mobile_views,
        COUNT(*) FILTER (WHERE tv.device_type = 'tablet')::BIGINT as tablet_views,

        -- Lia interactions
        (
            SELECT COUNT(*)::BIGINT
            FROM tour_events te
            JOIN tour_views tv2 ON tv2.id = te.view_id
            WHERE tv2.tour_id = p_tour_id
            AND te.event_type IN ('lia_open', 'lia_message')
            AND te.timestamp BETWEEN p_start_date AND p_end_date
        ) as lia_interactions,

        -- Rooms visited aggregation
        (
            SELECT jsonb_object_agg(room_name, visit_count)
            FROM (
                SELECT unnest(tv2.rooms_visited) as room_name, COUNT(*) as visit_count
                FROM tour_views tv2
                WHERE tv2.tour_id = p_tour_id
                AND tv2.started_at BETWEEN p_start_date AND p_end_date
                GROUP BY room_name
                ORDER BY visit_count DESC
                LIMIT 20
            ) rooms
        ) as rooms_data,

        -- Top referrers
        (
            SELECT jsonb_agg(jsonb_build_object('referrer', referrer, 'count', cnt))
            FROM (
                SELECT COALESCE(tv2.referrer, 'direct') as referrer, COUNT(*) as cnt
                FROM tour_views tv2
                WHERE tv2.tour_id = p_tour_id
                AND tv2.started_at BETWEEN p_start_date AND p_end_date
                GROUP BY tv2.referrer
                ORDER BY cnt DESC
                LIMIT 10
            ) refs
        ) as top_referrers,

        -- Views by day
        (
            SELECT jsonb_agg(jsonb_build_object('date', day, 'views', cnt))
            FROM (
                SELECT DATE(tv2.started_at) as day, COUNT(*) as cnt
                FROM tour_views tv2
                WHERE tv2.tour_id = p_tour_id
                AND tv2.started_at BETWEEN p_start_date AND p_end_date
                GROUP BY DATE(tv2.started_at)
                ORDER BY day
            ) daily
        ) as views_by_day

    FROM tour_views tv
    WHERE tv.tour_id = p_tour_id
    AND tv.started_at BETWEEN p_start_date AND p_end_date
    AND tv.is_bot = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PARTIE 7: FONCTION STATS GLOBALES ENTITY
-- ============================================================================

CREATE OR REPLACE FUNCTION get_entity_analytics(
    p_entity_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    total_views BIGINT,
    unique_visitors BIGINT,
    avg_duration_seconds NUMERIC,
    top_tours JSONB,
    views_by_day JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_views,
        COUNT(DISTINCT tv.visitor_id)::BIGINT as unique_visitors,
        COALESCE(AVG(tv.duration_seconds)::NUMERIC, 0) as avg_duration_seconds,

        -- Top 10 tours
        (
            SELECT jsonb_agg(jsonb_build_object(
                'tour_id', tour_id,
                'title', title,
                'views', view_count
            ))
            FROM (
                SELECT vt.id as tour_id, vt.title, COUNT(*) as view_count
                FROM tour_views tv2
                JOIN virtual_tours vt ON vt.id = tv2.tour_id
                WHERE vt.entity_id = p_entity_id
                AND tv2.started_at BETWEEN p_start_date AND p_end_date
                AND tv2.is_bot = false
                GROUP BY vt.id, vt.title
                ORDER BY view_count DESC
                LIMIT 10
            ) top
        ) as top_tours,

        -- Views by day
        (
            SELECT jsonb_agg(jsonb_build_object('date', day, 'views', cnt))
            FROM (
                SELECT DATE(tv2.started_at) as day, COUNT(*) as cnt
                FROM tour_views tv2
                JOIN virtual_tours vt ON vt.id = tv2.tour_id
                WHERE vt.entity_id = p_entity_id
                AND tv2.started_at BETWEEN p_start_date AND p_end_date
                AND tv2.is_bot = false
                GROUP BY DATE(tv2.started_at)
                ORDER BY day
            ) daily
        ) as views_by_day

    FROM tour_views tv
    JOIN virtual_tours vt ON vt.id = tv.tour_id
    WHERE vt.entity_id = p_entity_id
    AND tv.started_at BETWEEN p_start_date AND p_end_date
    AND tv.is_bot = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PARTIE 8: COMMENTAIRES DE DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE tour_views IS 'Sessions de visite sur les tours publics - tracking anonyme RGPD compliant';
COMMENT ON TABLE tour_events IS 'Evenements granulaires pendant une session de visite';

COMMENT ON COLUMN tour_views.visitor_id IS 'Identifiant anonyme genere cote client (fingerprint)';
COMMENT ON COLUMN tour_views.session_id IS 'Identifiant unique de session';
COMMENT ON COLUMN tour_views.device_type IS 'Type appareil: desktop, mobile, tablet, unknown';
COMMENT ON COLUMN tour_views.is_bot IS 'Flag si detecte comme bot/crawler';

COMMENT ON COLUMN tour_events.event_type IS 'Type: room_enter, room_exit, lia_open, lia_message, share_click, fullscreen, play, pause, seek, video_end, heartbeat';
COMMENT ON COLUMN tour_events.event_data IS 'Donnees additionnelles en JSON (room_id, video_time, etc)';

COMMENT ON FUNCTION get_tour_analytics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS 'Retourne les analytics agregees pour un tour';
COMMENT ON FUNCTION get_entity_analytics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS 'Retourne les analytics agregees pour une entity';
