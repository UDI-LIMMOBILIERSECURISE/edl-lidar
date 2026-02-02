-- Migration: Notifications System (AN-4)
-- Date: 2026-02-02
-- Description: Tables et fonctions pour le systeme de notifications et alertes

-- ============================================================================
-- PARTIE 1: ENUM TYPE NOTIFICATION
-- ============================================================================

CREATE TYPE notification_type AS ENUM (
    'new_visitor',       -- Nouveau visiteur sur une visite
    'milestone_views',   -- Seuil de vues atteint (100, 500, 1000...)
    'lia_question',      -- Question posee a Lia
    'weekly_digest',     -- Resume hebdomadaire
    'quota_warning',     -- Alerte quota proche du max
    'team_invite',       -- Invitation equipe acceptee
    'tour_published',    -- Visite publiee
    'system'             -- Notification systeme
);

-- ============================================================================
-- PARTIE 2: TABLE NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Destinataire
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Multi-tenant
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,

    -- Contenu
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,

    -- Donnees additionnelles (tour_id, visitor_count, etc)
    data JSONB DEFAULT '{}'::jsonb,

    -- Lien optionnel (pour redirection au clic)
    link TEXT,

    -- Etat
    read_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Index pour tri
    CONSTRAINT notifications_title_length CHECK (char_length(title) <= 200),
    CONSTRAINT notifications_message_length CHECK (char_length(message) <= 1000)
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- ============================================================================
-- PARTIE 3: TABLE NOTIFICATION_PREFERENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Utilisateur (1:1)
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Notifications in-app
    app_new_visitor BOOLEAN DEFAULT TRUE,
    app_milestone_views BOOLEAN DEFAULT TRUE,
    app_lia_question BOOLEAN DEFAULT TRUE,
    app_quota_warning BOOLEAN DEFAULT TRUE,

    -- Notifications email
    email_new_visitor BOOLEAN DEFAULT FALSE,
    email_weekly_digest BOOLEAN DEFAULT TRUE,
    email_milestone_views BOOLEAN DEFAULT FALSE,
    email_quota_warning BOOLEAN DEFAULT TRUE,

    -- Seuils
    threshold_views INTEGER DEFAULT 100,  -- Alerte tous les N vues
    threshold_quota_percent INTEGER DEFAULT 80,  -- Alerte a N% du quota

    -- Quiet hours (optionnel)
    quiet_hours_start TIME,
    quiet_hours_end TIME,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Contraintes
    CONSTRAINT threshold_views_positive CHECK (threshold_views > 0),
    CONSTRAINT threshold_quota_range CHECK (threshold_quota_percent BETWEEN 50 AND 95)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);

-- ============================================================================
-- PARTIE 4: RLS POLICIES
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- NOTIFICATIONS: SELECT - Utilisateur voit ses propres notifications
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (user_id = auth.uid());

-- NOTIFICATIONS: UPDATE - Utilisateur peut marquer comme lu
CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- NOTIFICATIONS: DELETE - Utilisateur peut supprimer ses notifications
CREATE POLICY "Users can delete own notifications"
    ON notifications FOR DELETE
    USING (user_id = auth.uid());

-- NOTIFICATIONS: INSERT - Service role only (via fonction)
CREATE POLICY "Service role can insert notifications"
    ON notifications FOR INSERT
    WITH CHECK (
        -- Soit service role, soit fonction avec SECURITY DEFINER
        auth.uid() IS NULL OR auth.uid() = user_id
    );

-- PREFERENCES: SELECT
CREATE POLICY "Users can view own preferences"
    ON notification_preferences FOR SELECT
    USING (user_id = auth.uid());

-- PREFERENCES: INSERT
CREATE POLICY "Users can create own preferences"
    ON notification_preferences FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- PREFERENCES: UPDATE
CREATE POLICY "Users can update own preferences"
    ON notification_preferences FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- PARTIE 5: FONCTION CREER NOTIFICATION
-- ============================================================================

CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_entity_id UUID,
    p_type notification_type,
    p_title TEXT,
    p_message TEXT,
    p_data JSONB DEFAULT '{}'::jsonb,
    p_link TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
    v_prefs notification_preferences%ROWTYPE;
    v_should_create BOOLEAN := TRUE;
BEGIN
    -- Verifier les preferences utilisateur
    SELECT * INTO v_prefs
    FROM notification_preferences
    WHERE user_id = p_user_id;

    -- Si pas de preferences, creer avec valeurs par defaut
    IF v_prefs IS NULL THEN
        INSERT INTO notification_preferences (user_id)
        VALUES (p_user_id)
        RETURNING * INTO v_prefs;
    END IF;

    -- Verifier si l'utilisateur veut ce type de notification (app)
    CASE p_type
        WHEN 'new_visitor' THEN v_should_create := v_prefs.app_new_visitor;
        WHEN 'milestone_views' THEN v_should_create := v_prefs.app_milestone_views;
        WHEN 'lia_question' THEN v_should_create := v_prefs.app_lia_question;
        WHEN 'quota_warning' THEN v_should_create := v_prefs.app_quota_warning;
        ELSE v_should_create := TRUE;  -- Toujours creer pour system, weekly_digest, etc
    END CASE;

    IF NOT v_should_create THEN
        RETURN NULL;
    END IF;

    -- Creer la notification
    INSERT INTO notifications (user_id, entity_id, type, title, message, data, link)
    VALUES (p_user_id, p_entity_id, p_type, p_title, p_message, p_data, p_link)
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PARTIE 6: FONCTION MARQUER COMME LU
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notifications
    SET read_at = NOW()
    WHERE id = p_notification_id
    AND user_id = auth.uid()
    AND read_at IS NULL;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PARTIE 7: FONCTION MARQUER TOUTES COMME LUES
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE notifications
    SET read_at = NOW()
    WHERE user_id = auth.uid()
    AND read_at IS NULL;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PARTIE 8: FONCTION COMPTER NON LUES
-- ============================================================================

CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM notifications
        WHERE user_id = auth.uid()
        AND read_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PARTIE 9: TRIGGER POUR NOTIFICATION MILESTONE VIEWS
-- ============================================================================

CREATE OR REPLACE FUNCTION check_milestone_views()
RETURNS TRIGGER AS $$
DECLARE
    v_tour RECORD;
    v_user RECORD;
    v_total_views BIGINT;
    v_threshold INTEGER;
    v_last_milestone BIGINT;
BEGIN
    -- Recuperer infos du tour
    SELECT vt.*, e.id as entity_id
    INTO v_tour
    FROM virtual_tours vt
    JOIN entities e ON e.id = vt.entity_id
    WHERE vt.id = NEW.tour_id;

    IF v_tour IS NULL THEN
        RETURN NEW;
    END IF;

    -- Compter total vues pour ce tour
    SELECT COUNT(*) INTO v_total_views
    FROM tour_views
    WHERE tour_id = NEW.tour_id
    AND is_bot = false;

    -- Recuperer tous les users de l'entity avec leurs preferences
    FOR v_user IN
        SELECT up.id as user_id,
               COALESCE(np.threshold_views, 100) as threshold,
               COALESCE(np.app_milestone_views, true) as wants_notif
        FROM user_profiles up
        LEFT JOIN notification_preferences np ON np.user_id = up.id
        WHERE up.entity_id = v_tour.entity_id
    LOOP
        IF NOT v_user.wants_notif THEN
            CONTINUE;
        END IF;

        -- Verifier si on a atteint un nouveau milestone
        v_threshold := v_user.threshold;
        v_last_milestone := (v_total_views - 1) / v_threshold * v_threshold;

        IF v_total_views >= v_threshold AND (v_total_views % v_threshold) = 0 THEN
            -- Creer notification milestone
            PERFORM create_notification(
                v_user.user_id,
                v_tour.entity_id,
                'milestone_views',
                v_total_views || ' vues atteintes!',
                'Votre visite "' || v_tour.title || '" a atteint ' || v_total_views || ' vues.',
                jsonb_build_object(
                    'tour_id', NEW.tour_id,
                    'tour_title', v_tour.title,
                    'view_count', v_total_views
                ),
                '/dashboard/tours/' || NEW.tour_id
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur tour_views
DROP TRIGGER IF EXISTS trigger_check_milestone_views ON tour_views;
CREATE TRIGGER trigger_check_milestone_views
    AFTER INSERT ON tour_views
    FOR EACH ROW
    EXECUTE FUNCTION check_milestone_views();

-- ============================================================================
-- PARTIE 10: TRIGGER POUR NOTIFICATION LIA QUESTION
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_lia_question()
RETURNS TRIGGER AS $$
DECLARE
    v_tour RECORD;
    v_user RECORD;
BEGIN
    -- Seulement pour les evenements lia_message
    IF NEW.event_type != 'lia_message' THEN
        RETURN NEW;
    END IF;

    -- Recuperer infos du tour via la view
    SELECT vt.*, tv.tour_id, e.id as entity_id
    INTO v_tour
    FROM tour_views tv
    JOIN virtual_tours vt ON vt.id = tv.tour_id
    JOIN entities e ON e.id = vt.entity_id
    WHERE tv.id = NEW.view_id;

    IF v_tour IS NULL THEN
        RETURN NEW;
    END IF;

    -- Notifier tous les users de l'entity
    FOR v_user IN
        SELECT up.id as user_id,
               COALESCE(np.app_lia_question, true) as wants_notif
        FROM user_profiles up
        LEFT JOIN notification_preferences np ON np.user_id = up.id
        WHERE up.entity_id = v_tour.entity_id
    LOOP
        IF NOT v_user.wants_notif THEN
            CONTINUE;
        END IF;

        -- Creer notification
        PERFORM create_notification(
            v_user.user_id,
            v_tour.entity_id,
            'lia_question',
            'Nouvelle question Lia',
            'Un visiteur a pose une question sur "' || v_tour.title || '"',
            jsonb_build_object(
                'tour_id', v_tour.tour_id,
                'tour_title', v_tour.title,
                'message', NEW.event_data->>'messageContent'
            ),
            '/dashboard/tours/' || v_tour.tour_id || '/analytics'
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur tour_events
DROP TRIGGER IF EXISTS trigger_notify_lia_question ON tour_events;
CREATE TRIGGER trigger_notify_lia_question
    AFTER INSERT ON tour_events
    FOR EACH ROW
    WHEN (NEW.event_type = 'lia_message')
    EXECUTE FUNCTION notify_lia_question();

-- ============================================================================
-- PARTIE 11: FONCTION DIGEST HEBDOMADAIRE
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_weekly_digest(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_profile RECORD;
    v_digest JSONB;
    v_start_date TIMESTAMPTZ := NOW() - INTERVAL '7 days';
BEGIN
    -- Recuperer le profil
    SELECT * INTO v_user_profile
    FROM user_profiles
    WHERE id = p_user_id;

    IF v_user_profile IS NULL THEN
        RETURN NULL;
    END IF;

    -- Generer le digest
    SELECT jsonb_build_object(
        'period_start', v_start_date,
        'period_end', NOW(),
        'total_views', COALESCE(SUM(stats.view_count), 0),
        'unique_visitors', COALESCE(SUM(stats.unique_count), 0),
        'lia_questions', COALESCE(SUM(stats.lia_count), 0),
        'top_tours', (
            SELECT jsonb_agg(jsonb_build_object(
                'tour_id', t.id,
                'title', t.title,
                'views', t.views
            ))
            FROM (
                SELECT vt.id, vt.title, COUNT(tv.id) as views
                FROM virtual_tours vt
                LEFT JOIN tour_views tv ON tv.tour_id = vt.id
                    AND tv.started_at >= v_start_date
                    AND tv.is_bot = false
                WHERE vt.entity_id = v_user_profile.entity_id
                GROUP BY vt.id, vt.title
                ORDER BY views DESC
                LIMIT 5
            ) t
        )
    ) INTO v_digest
    FROM (
        SELECT
            COUNT(tv.id) as view_count,
            COUNT(DISTINCT tv.visitor_id) as unique_count,
            COUNT(te.id) FILTER (WHERE te.event_type = 'lia_message') as lia_count
        FROM virtual_tours vt
        LEFT JOIN tour_views tv ON tv.tour_id = vt.id
            AND tv.started_at >= v_start_date
            AND tv.is_bot = false
        LEFT JOIN tour_events te ON te.view_id = tv.id
        WHERE vt.entity_id = v_user_profile.entity_id
    ) stats;

    RETURN v_digest;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PARTIE 12: COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE notifications IS 'Notifications utilisateurs - tous types';
COMMENT ON TABLE notification_preferences IS 'Preferences de notification par utilisateur';

COMMENT ON COLUMN notifications.type IS 'Type: new_visitor, milestone_views, lia_question, weekly_digest, quota_warning, team_invite, tour_published, system';
COMMENT ON COLUMN notifications.data IS 'Donnees additionnelles JSON (tour_id, counts, etc)';
COMMENT ON COLUMN notifications.link IS 'Lien de redirection au clic';

COMMENT ON COLUMN notification_preferences.threshold_views IS 'Notifier tous les N vues (defaut: 100)';
COMMENT ON COLUMN notification_preferences.threshold_quota_percent IS 'Notifier a N% du quota (defaut: 80%)';

COMMENT ON FUNCTION create_notification IS 'Cree une notification en respectant les preferences utilisateur';
COMMENT ON FUNCTION mark_notification_read IS 'Marque une notification comme lue';
COMMENT ON FUNCTION mark_all_notifications_read IS 'Marque toutes les notifications comme lues';
COMMENT ON FUNCTION get_unread_notification_count IS 'Retourne le nombre de notifications non lues';
COMMENT ON FUNCTION generate_weekly_digest IS 'Genere les donnees du digest hebdomadaire pour un utilisateur';
