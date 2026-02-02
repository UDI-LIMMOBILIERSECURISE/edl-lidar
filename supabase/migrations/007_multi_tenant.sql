-- Migration: Multi-Tenant Architecture
-- Date: 2026-02-02
-- Description: Architecture multi-tenant avec entities, agencies, user_profiles et RLS securise

-- ============================================================================
-- PARTIE 1: SUPPRESSION DES POLICIES DEV (004 et 006)
-- ============================================================================

-- Supprimer les policies DEV de virtual_tours (migration 004)
DROP POLICY IF EXISTS "Anyone can insert tours (DEV)" ON virtual_tours;
DROP POLICY IF EXISTS "Anyone can view tours (DEV)" ON virtual_tours;
DROP POLICY IF EXISTS "Anyone can update tours (DEV)" ON virtual_tours;
DROP POLICY IF EXISTS "Anyone can delete tours (DEV)" ON virtual_tours;

-- Supprimer les policies DEV de tour_rooms (migration 006)
DROP POLICY IF EXISTS "Anyone can view rooms (DEV)" ON tour_rooms;
DROP POLICY IF EXISTS "Anyone can insert rooms (DEV)" ON tour_rooms;
DROP POLICY IF EXISTS "Anyone can update rooms (DEV)" ON tour_rooms;
DROP POLICY IF EXISTS "Anyone can delete rooms (DEV)" ON tour_rooms;

-- ============================================================================
-- PARTIE 2: TYPES ENUM
-- ============================================================================

-- Type de plan (abonnement)
CREATE TYPE plan_type AS ENUM ('free', 'starter', 'pro', 'enterprise');

-- Role utilisateur
CREATE TYPE user_role AS ENUM ('entity_admin', 'agency_manager', 'agent');

-- ============================================================================
-- PARTIE 3: TABLE ENTITIES (Cabinets/Entreprises)
-- ============================================================================

CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identification
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,

    -- Plan et limites
    plan plan_type DEFAULT 'free' NOT NULL,
    max_users INTEGER DEFAULT 1,
    max_tours INTEGER DEFAULT 10,
    max_storage_gb INTEGER DEFAULT 5,

    -- Configuration
    settings JSONB DEFAULT '{}'::jsonb,
    logo_url TEXT,

    -- Stripe
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_entities_slug ON entities(slug);
CREATE INDEX IF NOT EXISTS idx_entities_stripe_customer ON entities(stripe_customer_id);

-- ============================================================================
-- PARTIE 4: TABLE AGENCIES (Agences/Antennes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Lien avec entity
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,

    -- Informations
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_agencies_entity ON agencies(entity_id);

-- ============================================================================
-- PARTIE 5: TABLE USER_PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
    -- id = auth.users.id (1:1)
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Lien avec entity
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,

    -- Role et agences
    role user_role DEFAULT 'agent' NOT NULL,
    agency_ids UUID[] DEFAULT '{}',

    -- Informations
    display_name TEXT,
    avatar_url TEXT,
    phone TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_profiles_entity ON user_profiles(entity_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- ============================================================================
-- PARTIE 6: MODIFICATION DE VIRTUAL_TOURS
-- ============================================================================

-- Ajouter les colonnes multi-tenant
ALTER TABLE virtual_tours
    ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL;

-- Index pour les nouvelles colonnes
CREATE INDEX IF NOT EXISTS idx_tours_entity ON virtual_tours(entity_id);
CREATE INDEX IF NOT EXISTS idx_tours_agency ON virtual_tours(agency_id);

-- ============================================================================
-- PARTIE 7: FONCTIONS HELPER
-- ============================================================================

-- Obtenir l'entity_id de l'utilisateur courant
CREATE OR REPLACE FUNCTION get_user_entity_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT entity_id
        FROM user_profiles
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Obtenir le role de l'utilisateur courant
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
BEGIN
    RETURN (
        SELECT role
        FROM user_profiles
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Verifier si l'utilisateur a acces a une agence
CREATE OR REPLACE FUNCTION user_has_agency_access(p_agency_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_role user_role;
    v_entity_id UUID;
    v_agency_ids UUID[];
    v_agency_entity_id UUID;
BEGIN
    -- Recuperer les infos de l'utilisateur
    SELECT role, entity_id, agency_ids
    INTO v_role, v_entity_id, v_agency_ids
    FROM user_profiles
    WHERE id = auth.uid();

    -- Si pas de profil, pas d'acces
    IF v_entity_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Recuperer l'entity de l'agence
    SELECT entity_id INTO v_agency_entity_id
    FROM agencies
    WHERE id = p_agency_id;

    -- L'agence doit appartenir a la meme entity
    IF v_agency_entity_id IS NULL OR v_agency_entity_id != v_entity_id THEN
        RETURN FALSE;
    END IF;

    -- entity_admin a acces a toutes les agences de son entity
    IF v_role = 'entity_admin' THEN
        RETURN TRUE;
    END IF;

    -- Sinon, verifier si l'agence est dans la liste
    RETURN p_agency_id = ANY(v_agency_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PARTIE 8: TRIGGER HANDLE_NEW_USER
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_entity_id UUID;
    v_slug TEXT;
BEGIN
    -- Generer un slug unique pour l'entity
    v_slug := 'entity-' || encode(gen_random_bytes(4), 'hex');

    -- Creer une nouvelle entity pour cet utilisateur
    INSERT INTO entities (name, slug, plan, max_users, max_tours, max_storage_gb)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'company_name', 'Mon Cabinet'),
        v_slug,
        'free',
        1,
        10,
        5
    )
    RETURNING id INTO v_entity_id;

    -- Creer le profil utilisateur comme entity_admin
    INSERT INTO user_profiles (id, entity_id, role, display_name)
    VALUES (
        NEW.id,
        v_entity_id,
        'entity_admin',
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer le trigger s'il existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Creer le trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- PARTIE 9: ACTIVER RLS SUR LES NOUVELLES TABLES
-- ============================================================================

ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PARTIE 10: POLICIES POUR ENTITIES
-- ============================================================================

-- SELECT: Un utilisateur peut voir son entity
CREATE POLICY "Users can view their own entity"
    ON entities FOR SELECT
    USING (id = get_user_entity_id());

-- UPDATE: Seul entity_admin peut modifier
CREATE POLICY "Entity admins can update their entity"
    ON entities FOR UPDATE
    USING (id = get_user_entity_id() AND get_user_role() = 'entity_admin');

-- INSERT: Gere par le trigger handle_new_user uniquement
-- Pas de policy INSERT directe pour eviter la creation manuelle

-- DELETE: Interdit (gestion admin Supabase uniquement)

-- ============================================================================
-- PARTIE 11: POLICIES POUR AGENCIES
-- ============================================================================

-- SELECT: Voir les agences de son entity
CREATE POLICY "Users can view their entity agencies"
    ON agencies FOR SELECT
    USING (entity_id = get_user_entity_id());

-- INSERT: entity_admin peut creer des agences
CREATE POLICY "Entity admins can create agencies"
    ON agencies FOR INSERT
    WITH CHECK (
        entity_id = get_user_entity_id()
        AND get_user_role() = 'entity_admin'
    );

-- UPDATE: entity_admin ou agency_manager de cette agence
CREATE POLICY "Admins can update agencies"
    ON agencies FOR UPDATE
    USING (
        entity_id = get_user_entity_id()
        AND (
            get_user_role() = 'entity_admin'
            OR (get_user_role() = 'agency_manager' AND user_has_agency_access(id))
        )
    );

-- DELETE: entity_admin uniquement
CREATE POLICY "Entity admins can delete agencies"
    ON agencies FOR DELETE
    USING (
        entity_id = get_user_entity_id()
        AND get_user_role() = 'entity_admin'
    );

-- ============================================================================
-- PARTIE 12: POLICIES POUR USER_PROFILES
-- ============================================================================

-- SELECT: Voir les profils de son entity
CREATE POLICY "Users can view their entity profiles"
    ON user_profiles FOR SELECT
    USING (entity_id = get_user_entity_id());

-- UPDATE: Soi-meme ou entity_admin
CREATE POLICY "Users can update own profile or admin updates all"
    ON user_profiles FOR UPDATE
    USING (
        id = auth.uid()
        OR (entity_id = get_user_entity_id() AND get_user_role() = 'entity_admin')
    );

-- INSERT: Gere par trigger ou entity_admin
CREATE POLICY "Entity admins can create profiles"
    ON user_profiles FOR INSERT
    WITH CHECK (
        entity_id = get_user_entity_id()
        AND get_user_role() = 'entity_admin'
    );

-- DELETE: entity_admin uniquement (pas soi-meme)
CREATE POLICY "Entity admins can delete profiles"
    ON user_profiles FOR DELETE
    USING (
        entity_id = get_user_entity_id()
        AND get_user_role() = 'entity_admin'
        AND id != auth.uid()
    );

-- ============================================================================
-- PARTIE 13: POLICIES POUR VIRTUAL_TOURS (REMPLACEMENT)
-- ============================================================================

-- SELECT: Voir ses tours ou tours publics
CREATE POLICY "Users can view entity tours or public tours"
    ON virtual_tours FOR SELECT
    USING (
        entity_id = get_user_entity_id()
        OR is_public = true
    );

-- INSERT: Creer un tour dans son entity
CREATE POLICY "Users can create tours in their entity"
    ON virtual_tours FOR INSERT
    WITH CHECK (
        entity_id = get_user_entity_id()
        AND (
            -- Si agency_id specifie, doit y avoir acces
            agency_id IS NULL
            OR user_has_agency_access(agency_id)
        )
    );

-- UPDATE: Modifier ses propres tours ou tours de son agence (si manager/admin)
CREATE POLICY "Users can update their tours"
    ON virtual_tours FOR UPDATE
    USING (
        entity_id = get_user_entity_id()
        AND (
            user_id = auth.uid()
            OR get_user_role() = 'entity_admin'
            OR (
                get_user_role() = 'agency_manager'
                AND agency_id IS NOT NULL
                AND user_has_agency_access(agency_id)
            )
        )
    );

-- DELETE: Supprimer ses propres tours ou admin
CREATE POLICY "Users can delete their tours"
    ON virtual_tours FOR DELETE
    USING (
        entity_id = get_user_entity_id()
        AND (
            user_id = auth.uid()
            OR get_user_role() = 'entity_admin'
        )
    );

-- ============================================================================
-- PARTIE 14: POLICIES POUR TOUR_ROOMS (HERITAGE DE VIRTUAL_TOURS)
-- ============================================================================

-- SELECT: Voir rooms des tours accessibles
CREATE POLICY "Users can view rooms of accessible tours"
    ON tour_rooms FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM virtual_tours vt
            WHERE vt.id = tour_rooms.tour_id
            AND (vt.entity_id = get_user_entity_id() OR vt.is_public = true)
        )
    );

-- INSERT: Creer rooms sur ses tours
CREATE POLICY "Users can create rooms on their tours"
    ON tour_rooms FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM virtual_tours vt
            WHERE vt.id = tour_rooms.tour_id
            AND vt.entity_id = get_user_entity_id()
            AND (
                vt.user_id = auth.uid()
                OR get_user_role() = 'entity_admin'
                OR (get_user_role() = 'agency_manager' AND user_has_agency_access(vt.agency_id))
            )
        )
    );

-- UPDATE: Modifier rooms sur ses tours
CREATE POLICY "Users can update rooms on their tours"
    ON tour_rooms FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM virtual_tours vt
            WHERE vt.id = tour_rooms.tour_id
            AND vt.entity_id = get_user_entity_id()
            AND (
                vt.user_id = auth.uid()
                OR get_user_role() = 'entity_admin'
                OR (get_user_role() = 'agency_manager' AND user_has_agency_access(vt.agency_id))
            )
        )
    );

-- DELETE: Supprimer rooms sur ses tours
CREATE POLICY "Users can delete rooms on their tours"
    ON tour_rooms FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM virtual_tours vt
            WHERE vt.id = tour_rooms.tour_id
            AND vt.entity_id = get_user_entity_id()
            AND (
                vt.user_id = auth.uid()
                OR get_user_role() = 'entity_admin'
            )
        )
    );

-- ============================================================================
-- PARTIE 15: MISE A JOUR DES POLICIES TOUR_ANNOTATIONS
-- ============================================================================

-- Supprimer anciennes policies
DROP POLICY IF EXISTS "Users can view annotations of accessible tours" ON tour_annotations;
DROP POLICY IF EXISTS "Users can manage annotations of their tours" ON tour_annotations;

-- SELECT: Voir annotations des tours accessibles
CREATE POLICY "Users can view annotations of accessible tours"
    ON tour_annotations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM virtual_tours vt
            WHERE vt.id = tour_annotations.tour_id
            AND (vt.entity_id = get_user_entity_id() OR vt.is_public = true)
        )
    );

-- ALL (insert, update, delete): Sur ses propres tours
CREATE POLICY "Users can manage annotations on their tours"
    ON tour_annotations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM virtual_tours vt
            WHERE vt.id = tour_annotations.tour_id
            AND vt.entity_id = get_user_entity_id()
            AND (
                vt.user_id = auth.uid()
                OR get_user_role() = 'entity_admin'
                OR (get_user_role() = 'agency_manager' AND user_has_agency_access(vt.agency_id))
            )
        )
    );

-- ============================================================================
-- PARTIE 16: TRIGGERS UPDATED_AT
-- ============================================================================

CREATE TRIGGER trigger_update_entities_updated_at
    BEFORE UPDATE ON entities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- PARTIE 17: COMMENTAIRES DE DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE entities IS 'Cabinets/entreprises - unite de facturation et isolation multi-tenant';
COMMENT ON TABLE agencies IS 'Agences/antennes appartenant a une entity';
COMMENT ON TABLE user_profiles IS 'Profils utilisateurs avec role et assignation agences';

COMMENT ON COLUMN entities.plan IS 'Type abonnement: free, starter, pro, enterprise';
COMMENT ON COLUMN entities.max_storage_gb IS 'Quota stockage en GB pour cette entity';
COMMENT ON COLUMN user_profiles.role IS 'Role: entity_admin (tout), agency_manager (ses agences), agent (ses tours)';
COMMENT ON COLUMN user_profiles.agency_ids IS 'Liste des agences auxquelles l utilisateur a acces';

COMMENT ON FUNCTION get_user_entity_id() IS 'Retourne l entity_id de l utilisateur courant';
COMMENT ON FUNCTION get_user_role() IS 'Retourne le role de l utilisateur courant';
COMMENT ON FUNCTION user_has_agency_access(UUID) IS 'Verifie si l utilisateur a acces a une agence donnee';
COMMENT ON FUNCTION handle_new_user() IS 'Trigger: cree entity + user_profile au signup';
