-- Migration: Systeme d'invitation utilisateurs (MT-4)
-- Date: 2026-02-02
-- Description: Table invitations avec tokens securises et RLS

-- ============================================================================
-- PARTIE 1: TABLE INVITATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Lien avec entity
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,

    -- Email invite
    email TEXT NOT NULL,

    -- Role assigne
    role user_role NOT NULL DEFAULT 'agent',

    -- Agences assignees (pour manager/agent)
    agency_ids UUID[] DEFAULT '{}',

    -- Utilisateur qui a invite
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Token unique pour acceptation
    token TEXT UNIQUE NOT NULL,

    -- Expiration (7 jours par defaut)
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

    -- Date d'acceptation (NULL si pas encore accepte)
    accepted_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Contrainte: pas de doublons email/entity actifs
    CONSTRAINT unique_pending_invitation UNIQUE (entity_id, email, accepted_at)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_invitations_entity ON invitations(entity_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at);

-- ============================================================================
-- PARTIE 2: FONCTION GENERATION TOKEN UNIQUE
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS TEXT AS $$
DECLARE
    v_token TEXT;
    v_exists BOOLEAN;
BEGIN
    LOOP
        -- Generer un token aleatoire de 32 caracteres hex
        v_token := encode(gen_random_bytes(16), 'hex');

        -- Verifier unicite
        SELECT EXISTS(SELECT 1 FROM invitations WHERE token = v_token) INTO v_exists;

        -- Si unique, retourner
        IF NOT v_exists THEN
            RETURN v_token;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PARTIE 3: FONCTION VERIFICATION PERMISSION INVITATION
-- ============================================================================

-- Verifier si l'utilisateur peut inviter avec ce role
CREATE OR REPLACE FUNCTION can_invite_with_role(p_target_role user_role)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_role user_role;
BEGIN
    -- Recuperer le role de l'utilisateur courant
    v_user_role := get_user_role();

    -- Seuls entity_admin et agency_manager peuvent inviter
    IF v_user_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- entity_admin peut inviter tous les roles
    IF v_user_role = 'entity_admin' THEN
        RETURN TRUE;
    END IF;

    -- agency_manager peut inviter seulement agent
    IF v_user_role = 'agency_manager' AND p_target_role = 'agent' THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PARTIE 4: TRIGGER GENERATION TOKEN AUTOMATIQUE
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_generate_invitation_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.token IS NULL OR NEW.token = '' THEN
        NEW.token := generate_invitation_token();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_invitation_insert_token ON invitations;

CREATE TRIGGER on_invitation_insert_token
    BEFORE INSERT ON invitations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_invitation_token();

-- ============================================================================
-- PARTIE 5: ACTIVER RLS
-- ============================================================================

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PARTIE 6: POLICIES RLS
-- ============================================================================

-- SELECT: Voir les invitations de son entity (admin/manager)
CREATE POLICY "Admins can view entity invitations"
    ON invitations FOR SELECT
    USING (
        entity_id = get_user_entity_id()
        AND get_user_role() IN ('entity_admin', 'agency_manager')
    );

-- INSERT: Creer invitation si autorise
CREATE POLICY "Authorized users can create invitations"
    ON invitations FOR INSERT
    WITH CHECK (
        entity_id = get_user_entity_id()
        AND invited_by = auth.uid()
        AND can_invite_with_role(role)
    );

-- UPDATE: Seul entity_admin peut modifier
CREATE POLICY "Entity admins can update invitations"
    ON invitations FOR UPDATE
    USING (
        entity_id = get_user_entity_id()
        AND get_user_role() = 'entity_admin'
    );

-- DELETE: entity_admin peut supprimer les invitations en attente
CREATE POLICY "Entity admins can delete pending invitations"
    ON invitations FOR DELETE
    USING (
        entity_id = get_user_entity_id()
        AND get_user_role() = 'entity_admin'
        AND accepted_at IS NULL
    );

-- ============================================================================
-- PARTIE 7: FONCTION ACCEPTATION INVITATION (SERVICE ROLE)
-- ============================================================================

-- Cette fonction est appelee par l'API avec service role
-- Elle valide et accepte une invitation
CREATE OR REPLACE FUNCTION accept_invitation(
    p_token TEXT,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_invitation RECORD;
    v_existing_profile RECORD;
BEGIN
    -- Recuperer l'invitation
    SELECT * INTO v_invitation
    FROM invitations
    WHERE token = p_token
      AND accepted_at IS NULL
      AND expires_at > NOW();

    -- Verifier que l'invitation existe et est valide
    IF v_invitation IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invitation invalide ou expiree'
        );
    END IF;

    -- Verifier si l'utilisateur a deja un profil dans cette entity
    SELECT * INTO v_existing_profile
    FROM user_profiles
    WHERE id = p_user_id AND entity_id = v_invitation.entity_id;

    IF v_existing_profile IS NOT NULL THEN
        -- Mettre a jour le role si deja dans l'entity
        UPDATE user_profiles
        SET role = v_invitation.role,
            agency_ids = v_invitation.agency_ids,
            updated_at = NOW()
        WHERE id = p_user_id AND entity_id = v_invitation.entity_id;
    ELSE
        -- Supprimer l'ancien profil s'il existe (change d'entity)
        DELETE FROM user_profiles WHERE id = p_user_id;

        -- Creer le nouveau profil
        INSERT INTO user_profiles (id, entity_id, role, agency_ids)
        VALUES (p_user_id, v_invitation.entity_id, v_invitation.role, v_invitation.agency_ids);
    END IF;

    -- Marquer l'invitation comme acceptee
    UPDATE invitations
    SET accepted_at = NOW()
    WHERE id = v_invitation.id;

    RETURN jsonb_build_object(
        'success', true,
        'entity_id', v_invitation.entity_id,
        'role', v_invitation.role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PARTIE 8: FONCTION GET INVITATION INFO (PUBLIC)
-- ============================================================================

-- Cette fonction permet de recuperer les infos publiques d'une invitation
-- sans authentification (pour la page d'acceptation)
CREATE OR REPLACE FUNCTION get_invitation_info(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
    v_invitation RECORD;
    v_entity RECORD;
BEGIN
    -- Recuperer l'invitation
    SELECT i.*, e.name as entity_name, e.logo_url as entity_logo
    INTO v_invitation
    FROM invitations i
    JOIN entities e ON e.id = i.entity_id
    WHERE i.token = p_token;

    -- Verifier que l'invitation existe
    IF v_invitation IS NULL THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'Invitation non trouvee'
        );
    END IF;

    -- Verifier si deja acceptee
    IF v_invitation.accepted_at IS NOT NULL THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'Invitation deja acceptee'
        );
    END IF;

    -- Verifier expiration
    IF v_invitation.expires_at < NOW() THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'Invitation expiree'
        );
    END IF;

    -- Retourner les infos
    RETURN jsonb_build_object(
        'valid', true,
        'email', v_invitation.email,
        'role', v_invitation.role,
        'entity_name', v_invitation.entity_name,
        'entity_logo', v_invitation.entity_logo,
        'expires_at', v_invitation.expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PARTIE 9: COMMENTAIRES DE DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE invitations IS 'Invitations utilisateurs avec token securise et expiration 7 jours';

COMMENT ON COLUMN invitations.token IS 'Token unique 32 caracteres hex pour lien d acceptation';
COMMENT ON COLUMN invitations.role IS 'Role assigne: entity_admin, agency_manager, agent';
COMMENT ON COLUMN invitations.agency_ids IS 'Agences assignees pour manager/agent';
COMMENT ON COLUMN invitations.accepted_at IS 'NULL si en attente, timestamp si acceptee';

COMMENT ON FUNCTION generate_invitation_token() IS 'Genere un token unique de 32 caracteres hex';
COMMENT ON FUNCTION can_invite_with_role(user_role) IS 'Verifie si l utilisateur peut inviter avec ce role';
COMMENT ON FUNCTION accept_invitation(TEXT, UUID) IS 'Accepte une invitation et cree le profil utilisateur';
COMMENT ON FUNCTION get_invitation_info(TEXT) IS 'Retourne les infos publiques d une invitation';
