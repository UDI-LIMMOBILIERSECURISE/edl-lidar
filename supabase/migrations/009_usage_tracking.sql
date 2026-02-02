-- Migration: Usage Tracking for Quotas Dashboard
-- Date: 2026-02-02
-- Description: Table et fonctions pour le suivi d'usage et les quotas

-- ============================================================================
-- PARTIE 1: TABLE USAGE_MONTHLY
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_monthly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Lien avec entity
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,

    -- Mois (premier jour du mois)
    month DATE NOT NULL,

    -- Compteurs
    tours_created INTEGER DEFAULT 0,
    lia_views INTEGER DEFAULT 0,
    storage_bytes BIGINT DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Contrainte d'unicite: une seule ligne par entity/mois
    UNIQUE (entity_id, month)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_usage_monthly_entity ON usage_monthly(entity_id);
CREATE INDEX IF NOT EXISTS idx_usage_monthly_month ON usage_monthly(month);
CREATE INDEX IF NOT EXISTS idx_usage_monthly_entity_month ON usage_monthly(entity_id, month);

-- ============================================================================
-- PARTIE 2: ACTIVER RLS
-- ============================================================================

ALTER TABLE usage_monthly ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PARTIE 3: POLICIES POUR USAGE_MONTHLY
-- ============================================================================

-- SELECT: Un utilisateur peut voir l'usage de son entity
CREATE POLICY "Users can view their entity usage"
    ON usage_monthly FOR SELECT
    USING (entity_id = get_user_entity_id());

-- INSERT: Systeme uniquement (via service role ou triggers)
-- Pas de policy INSERT directe pour les utilisateurs

-- UPDATE: Systeme uniquement
-- Pas de policy UPDATE directe pour les utilisateurs

-- DELETE: Interdit pour les utilisateurs

-- ============================================================================
-- PARTIE 4: FONCTION CALCULER USAGE COURANT
-- ============================================================================

CREATE OR REPLACE FUNCTION get_entity_current_usage(p_entity_id UUID)
RETURNS TABLE (
    total_tours INTEGER,
    total_users INTEGER,
    storage_bytes BIGINT,
    lia_views_month INTEGER
) AS $$
DECLARE
    v_month_start DATE;
BEGIN
    v_month_start := date_trunc('month', CURRENT_DATE)::DATE;

    RETURN QUERY
    SELECT
        -- Nombre total de tours
        (SELECT COUNT(*)::INTEGER FROM virtual_tours WHERE entity_id = p_entity_id),

        -- Nombre total d'utilisateurs
        (SELECT COUNT(*)::INTEGER FROM user_profiles WHERE entity_id = p_entity_id),

        -- Storage: estimer via video_duration_seconds (approximation: 10MB par minute de video)
        COALESCE(
            (SELECT SUM(COALESCE(video_duration_seconds, 0) * 175000)::BIGINT
             FROM virtual_tours
             WHERE entity_id = p_entity_id),
            0::BIGINT
        ),

        -- Vues Lia du mois courant
        COALESCE(
            (SELECT COUNT(*)::INTEGER
             FROM lia_sessions ls
             JOIN virtual_tours vt ON vt.id = ls.tour_id
             WHERE vt.entity_id = p_entity_id
               AND ls.started_at >= v_month_start),
            0
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PARTIE 5: FONCTION HISTORIQUE USAGE
-- ============================================================================

CREATE OR REPLACE FUNCTION get_entity_usage_history(p_entity_id UUID, p_months INTEGER DEFAULT 12)
RETURNS TABLE (
    month DATE,
    tours_created INTEGER,
    lia_views INTEGER,
    storage_bytes BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        um.month,
        um.tours_created,
        um.lia_views,
        um.storage_bytes
    FROM usage_monthly um
    WHERE um.entity_id = p_entity_id
      AND um.month >= (date_trunc('month', CURRENT_DATE) - (p_months || ' months')::INTERVAL)::DATE
    ORDER BY um.month ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PARTIE 6: FONCTION MISE A JOUR USAGE MENSUEL
-- ============================================================================

CREATE OR REPLACE FUNCTION update_monthly_usage()
RETURNS VOID AS $$
DECLARE
    v_month_start DATE;
    v_entity RECORD;
BEGIN
    v_month_start := date_trunc('month', CURRENT_DATE)::DATE;

    -- Pour chaque entity
    FOR v_entity IN SELECT id FROM entities LOOP
        INSERT INTO usage_monthly (entity_id, month, tours_created, lia_views, storage_bytes)
        SELECT
            v_entity.id,
            v_month_start,
            -- Tours crees ce mois
            (SELECT COUNT(*) FROM virtual_tours
             WHERE entity_id = v_entity.id
               AND created_at >= v_month_start),
            -- Sessions Lia ce mois
            (SELECT COUNT(*) FROM lia_sessions ls
             JOIN virtual_tours vt ON vt.id = ls.tour_id
             WHERE vt.entity_id = v_entity.id
               AND ls.started_at >= v_month_start),
            -- Storage total
            COALESCE(
                (SELECT SUM(COALESCE(video_duration_seconds, 0) * 175000)
                 FROM virtual_tours
                 WHERE entity_id = v_entity.id),
                0
            )
        ON CONFLICT (entity_id, month) DO UPDATE SET
            tours_created = EXCLUDED.tours_created,
            lia_views = EXCLUDED.lia_views,
            storage_bytes = EXCLUDED.storage_bytes,
            updated_at = NOW();
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PARTIE 7: TRIGGER UPDATED_AT
-- ============================================================================

CREATE TRIGGER trigger_update_usage_monthly_updated_at
    BEFORE UPDATE ON usage_monthly
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- PARTIE 8: COMMENTAIRES DE DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE usage_monthly IS 'Historique mensuel d usage par entity pour le dashboard quotas';
COMMENT ON COLUMN usage_monthly.month IS 'Premier jour du mois concerne';
COMMENT ON COLUMN usage_monthly.tours_created IS 'Nombre de tours crees ce mois';
COMMENT ON COLUMN usage_monthly.lia_views IS 'Nombre de sessions Lia ce mois';
COMMENT ON COLUMN usage_monthly.storage_bytes IS 'Espace stockage total en bytes a la fin du mois';

COMMENT ON FUNCTION get_entity_current_usage(UUID) IS 'Retourne l usage courant d une entity (tours, users, storage, lia)';
COMMENT ON FUNCTION get_entity_usage_history(UUID, INTEGER) IS 'Retourne l historique d usage sur N mois';
COMMENT ON FUNCTION update_monthly_usage() IS 'Met a jour les compteurs mensuels pour toutes les entities';
