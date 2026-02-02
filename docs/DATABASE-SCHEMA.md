# EDL LIDAR - Schema Base de Donnees

> Documentation complete du schema PostgreSQL (Supabase).

**Version:** 1.0
**Date:** 02 fevrier 2026

---

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SCHEMA RELATIONNEL                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐          ┌──────────────┐          ┌──────────────┐     │
│   │   entities   │◄────────│ user_profiles │         │  invitations  │     │
│   │   (tenants)  │         │   (users)     │────────►│   (pending)   │     │
│   └──────┬───────┘         └───────────────┘         └───────────────┘     │
│          │                                                                  │
│          │ 1:N                                                              │
│          ▼                                                                  │
│   ┌──────────────┐                                                          │
│   │   agencies   │                                                          │
│   │   (sites)    │                                                          │
│   └──────────────┘                                                          │
│                                                                             │
│   ┌──────────────┐          ┌──────────────┐          ┌──────────────┐     │
│   │virtual_tours │◄────────│  tour_rooms   │         │tour_annotations│    │
│   │   (visits)   │         │   (pieces)    │◄───────│  (notes)       │     │
│   └──────┬───────┘         └───────────────┘         └───────────────┘     │
│          │                                                                  │
│          │ 1:N                                                              │
│          ▼                                                                  │
│   ┌──────────────┐          ┌──────────────┐                               │
│   │  tour_views  │◄────────│ tour_events   │                               │
│   │ (analytics)  │         │  (tracking)   │                               │
│   └──────────────┘         └───────────────┘                               │
│                                                                             │
│   ┌──────────────┐          ┌──────────────┐                               │
│   │ lia_sessions │◄────────│ lia_messages  │                               │
│   │  (chat)      │         │   (msgs)      │                               │
│   └──────────────┘         └───────────────┘                               │
│                                                                             │
│   ┌──────────────┐          ┌──────────────┐          ┌──────────────┐     │
│   │usage_monthly │         │ notifications │         │notif_prefs    │     │
│   │  (quotas)    │         │  (alerts)     │         │ (settings)    │     │
│   └──────────────┘         └───────────────┘         └───────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tables Detaillees

### 1. entities

Table principale des tenants (organisations).

```sql
CREATE TABLE public.entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  max_users INTEGER NOT NULL DEFAULT 1,
  max_tours INTEGER NOT NULL DEFAULT 10,
  max_storage_gb INTEGER NOT NULL DEFAULT 5,
  settings JSONB DEFAULT '{}',
  logo_url TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_entities_slug ON entities(slug);
CREATE INDEX idx_entities_stripe_customer ON entities(stripe_customer_id);
```

**Colonnes:**
| Colonne | Type | Nullable | Description |
|---------|------|----------|-------------|
| id | uuid | Non | Cle primaire |
| name | text | Non | Nom de l'organisation |
| slug | text | Non | Identifiant unique URL-safe |
| plan | text | Non | Plan tarifaire actif |
| max_users | integer | Non | Limite utilisateurs |
| max_tours | integer | Non | Limite visites |
| max_storage_gb | integer | Non | Limite stockage |
| settings | jsonb | Oui | Configuration custom |
| logo_url | text | Oui | URL du logo |
| stripe_customer_id | text | Oui | ID client Stripe |
| stripe_subscription_id | text | Oui | ID abonnement Stripe |
| created_at | timestamptz | Non | Date creation |
| updated_at | timestamptz | Non | Derniere modification |

---

### 2. user_profiles

Profils utilisateurs lies a auth.users.

```sql
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'agent'
    CHECK (role IN ('entity_admin', 'agency_manager', 'agent')),
  agency_ids UUID[] DEFAULT '{}',
  display_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_user_profiles_entity ON user_profiles(entity_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
```

**Colonnes:**
| Colonne | Type | Nullable | Description |
|---------|------|----------|-------------|
| id | uuid | Non | FK vers auth.users |
| entity_id | uuid | Non | FK vers entities |
| role | text | Non | Role dans l'organisation |
| agency_ids | uuid[] | Oui | Agences assignees |
| display_name | text | Oui | Nom affiche |
| avatar_url | text | Oui | URL avatar |
| phone | text | Oui | Telephone |
| created_at | timestamptz | Non | Date creation |
| updated_at | timestamptz | Non | Derniere modification |

---

### 3. agencies

Agences/sites au sein d'une entite.

```sql
CREATE TABLE public.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_agencies_entity ON agencies(entity_id);
```

---

### 4. invitations

Invitations d'equipe en attente.

```sql
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent'
    CHECK (role IN ('entity_admin', 'agency_manager', 'agent')),
  agency_ids UUID[] DEFAULT '{}',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_entity ON invitations(entity_id);
```

---

### 5. virtual_tours

Visites virtuelles.

```sql
CREATE TABLE public.virtual_tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  edl_id UUID,
  title TEXT NOT NULL,
  address TEXT NOT NULL,
  property_type TEXT NOT NULL DEFAULT 'apartment'
    CHECK (property_type IN ('apartment', 'house', 'commercial', 'other')),
  tour_type TEXT NOT NULL DEFAULT 'sale'
    CHECK (tour_type IN ('sale', 'rent', 'edl')),
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'ready', 'error')),
  video_url TEXT,
  video_duration_seconds INTEGER,
  thumbnail_url TEXT,
  has_lidar BOOLEAN DEFAULT FALSE,
  total_surface_m2 NUMERIC(10,2),
  floor_plan_url TEXT,
  point_cloud_url TEXT,
  ai_indexed BOOLEAN DEFAULT FALSE,
  ai_index_version TEXT,
  public_slug TEXT UNIQUE,
  is_public BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_virtual_tours_user ON virtual_tours(user_id);
CREATE INDEX idx_virtual_tours_status ON virtual_tours(status);
CREATE INDEX idx_virtual_tours_public_slug ON virtual_tours(public_slug) WHERE is_public = TRUE;
CREATE INDEX idx_virtual_tours_created ON virtual_tours(created_at DESC);
```

---

### 6. tour_rooms

Pieces detectees dans une visite.

```sql
CREATE TABLE public.tour_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES virtual_tours(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  room_type TEXT,
  floor_number INTEGER DEFAULT 0,
  start_time NUMERIC(10,2) NOT NULL,
  end_time NUMERIC(10,2) NOT NULL,
  floor_surface_m2 NUMERIC(10,2),
  wall_surface_m2 NUMERIC(10,2),
  ceiling_surface_m2 NUMERIC(10,2),
  ceiling_height_m NUMERIC(5,2),
  volume_m3 NUMERIC(10,2),
  detection_method TEXT
    CHECK (detection_method IN ('roomplan', 'voice', 'gemini', 'manual')),
  detection_confidence NUMERIC(3,2),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_tour_rooms_tour ON tour_rooms(tour_id);
CREATE INDEX idx_tour_rooms_order ON tour_rooms(tour_id, display_order);
```

**Types de pieces (room_type):**
- entrance
- living_room
- kitchen
- bedroom
- bathroom
- toilet
- office
- dining_room
- hallway
- storage
- laundry
- balcony
- garage
- garden
- other

---

### 7. tour_annotations

Annotations sur une visite.

```sql
CREATE TABLE public.tour_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES virtual_tours(id) ON DELETE CASCADE,
  room_id UUID REFERENCES tour_rooms(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  annotation_type TEXT
    CHECK (annotation_type IN ('observation', 'defect', 'feature')),
  timecode NUMERIC(10,2) NOT NULL,
  position_x NUMERIC(10,4),
  position_y NUMERIC(10,4),
  position_z NUMERIC(10,4),
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_tour_annotations_tour ON tour_annotations(tour_id);
CREATE INDEX idx_tour_annotations_room ON tour_annotations(room_id);
CREATE INDEX idx_tour_annotations_timecode ON tour_annotations(tour_id, timecode);
```

---

### 8. tour_views

Sessions de visionnage (analytics).

```sql
CREATE TABLE public.tour_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES virtual_tours(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  rooms_visited TEXT[] DEFAULT '{}',
  device_type TEXT DEFAULT 'unknown'
    CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  user_agent TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  country TEXT,
  city TEXT,
  is_bot BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_tour_views_tour ON tour_views(tour_id);
CREATE INDEX idx_tour_views_visitor ON tour_views(visitor_id);
CREATE INDEX idx_tour_views_created ON tour_views(created_at DESC);
CREATE INDEX idx_tour_views_tour_date ON tour_views(tour_id, created_at DESC);
```

---

### 9. tour_events

Evenements granulaires (tracking).

```sql
CREATE TABLE public.tour_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id UUID NOT NULL REFERENCES tour_views(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'room_enter', 'room_exit',
      'lia_open', 'lia_close', 'lia_message',
      'share_click', 'fullscreen',
      'play', 'pause', 'seek', 'video_end',
      'heartbeat'
    )),
  event_data JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_tour_events_view ON tour_events(view_id);
CREATE INDEX idx_tour_events_type ON tour_events(event_type);
CREATE INDEX idx_tour_events_timestamp ON tour_events(timestamp DESC);
```

---

### 10. lia_sessions

Sessions de chat avec Lia.

```sql
CREATE TABLE public.lia_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES virtual_tours(id) ON DELETE CASCADE,
  visitor_id TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  rooms_visited TEXT[],
  total_watch_time_seconds INTEGER
);

-- Index
CREATE INDEX idx_lia_sessions_tour ON lia_sessions(tour_id);
CREATE INDEX idx_lia_sessions_started ON lia_sessions(started_at DESC);
```

---

### 11. lia_messages

Messages individuels du chat Lia.

```sql
CREATE TABLE public.lia_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES lia_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  action_type TEXT CHECK (action_type IN ('seek', 'info', 'staging')),
  action_data JSONB,
  model_used TEXT,
  tokens_used INTEGER,
  cost_usd NUMERIC(10,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_lia_messages_session ON lia_messages(session_id);
CREATE INDEX idx_lia_messages_created ON lia_messages(created_at);
```

---

### 12. usage_monthly

Usage mensuel par entite.

```sql
CREATE TABLE public.usage_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- Format: YYYY-MM
  tours_created INTEGER DEFAULT 0,
  lia_views INTEGER DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_id, month)
);

-- Index
CREATE INDEX idx_usage_monthly_entity ON usage_monthly(entity_id);
CREATE INDEX idx_usage_monthly_month ON usage_monthly(month DESC);
```

---

### 13. notifications

Notifications utilisateur.

```sql
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN (
      'new_visitor', 'milestone_views', 'lia_question',
      'weekly_digest', 'quota_warning', 'team_invite',
      'tour_published', 'system'
    )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
```

---

### 14. notification_preferences

Preferences de notification.

```sql
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- In-app notifications
  app_new_visitor BOOLEAN DEFAULT TRUE,
  app_milestone_views BOOLEAN DEFAULT TRUE,
  app_lia_question BOOLEAN DEFAULT TRUE,
  app_quota_warning BOOLEAN DEFAULT TRUE,
  -- Email notifications
  email_new_visitor BOOLEAN DEFAULT FALSE,
  email_weekly_digest BOOLEAN DEFAULT TRUE,
  email_milestone_views BOOLEAN DEFAULT FALSE,
  email_quota_warning BOOLEAN DEFAULT TRUE,
  -- Thresholds
  threshold_views INTEGER DEFAULT 100,
  threshold_quota_percent INTEGER DEFAULT 80,
  -- Quiet hours (format: HH:MM)
  quiet_hours_start TEXT,
  quiet_hours_end TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Row Level Security (RLS)

### Policies entities

```sql
-- Lecture: membres de l'entite seulement
CREATE POLICY "entities_select" ON entities FOR SELECT
USING (
  id IN (
    SELECT entity_id FROM user_profiles WHERE id = auth.uid()
  )
);

-- Update: entity_admin seulement
CREATE POLICY "entities_update" ON entities FOR UPDATE
USING (
  id IN (
    SELECT entity_id FROM user_profiles
    WHERE id = auth.uid() AND role = 'entity_admin'
  )
);
```

### Policies user_profiles

```sql
-- Lecture: son profil ou membres meme entite (pour admin)
CREATE POLICY "profiles_select" ON user_profiles FOR SELECT
USING (
  id = auth.uid()
  OR entity_id IN (
    SELECT entity_id FROM user_profiles
    WHERE id = auth.uid() AND role = 'entity_admin'
  )
);

-- Update: son propre profil
CREATE POLICY "profiles_update" ON user_profiles FOR UPDATE
USING (id = auth.uid());
```

### Policies virtual_tours

```sql
-- Lecture: proprietaire ou meme entite
CREATE POLICY "tours_select" ON virtual_tours FOR SELECT
USING (
  user_id = auth.uid()
  OR user_id IN (
    SELECT up2.id FROM user_profiles up1
    JOIN user_profiles up2 ON up1.entity_id = up2.entity_id
    WHERE up1.id = auth.uid()
  )
  OR (is_public = TRUE) -- Visites publiques
);

-- Insert: utilisateur authentifie
CREATE POLICY "tours_insert" ON virtual_tours FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Update/Delete: proprietaire
CREATE POLICY "tours_update" ON virtual_tours FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "tours_delete" ON virtual_tours FOR DELETE
USING (user_id = auth.uid());
```

### Policies tour_views (publiques pour tracking)

```sql
-- Insert: tout le monde (tracking anonyme)
CREATE POLICY "views_insert" ON tour_views FOR INSERT
WITH CHECK (TRUE);

-- Select: proprietaire de la visite
CREATE POLICY "views_select" ON tour_views FOR SELECT
USING (
  tour_id IN (
    SELECT id FROM virtual_tours WHERE user_id = auth.uid()
  )
);
```

---

## Fonctions SQL

### Fonction: Incrementer le compteur de messages Lia

```sql
CREATE OR REPLACE FUNCTION increment_lia_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE lia_sessions
  SET message_count = message_count + 1
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_lia_message_count
AFTER INSERT ON lia_messages
FOR EACH ROW EXECUTE FUNCTION increment_lia_message_count();
```

### Fonction: Mise a jour automatique updated_at

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer sur les tables concernees
CREATE TRIGGER trigger_entities_updated
BEFORE UPDATE ON entities
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_user_profiles_updated
BEFORE UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_virtual_tours_updated
BEFORE UPDATE ON virtual_tours
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_usage_monthly_updated
BEFORE UPDATE ON usage_monthly
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Fonction: Obtenir l'usage d'une entite

```sql
CREATE OR REPLACE FUNCTION get_entity_usage(p_entity_id UUID)
RETURNS TABLE (
  total_tours BIGINT,
  total_users BIGINT,
  storage_bytes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM virtual_tours vt
     JOIN user_profiles up ON vt.user_id = up.id
     WHERE up.entity_id = p_entity_id)::BIGINT AS total_tours,
    (SELECT COUNT(*) FROM user_profiles
     WHERE entity_id = p_entity_id)::BIGINT AS total_users,
    COALESCE((SELECT SUM(storage_bytes) FROM usage_monthly
     WHERE entity_id = p_entity_id
     AND month = TO_CHAR(NOW(), 'YYYY-MM')), 0)::BIGINT AS storage_bytes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Migrations

Les migrations sont stockees dans `supabase/migrations/` et executees dans l'ordre:

```
001_initial_schema.sql      -- Tables de base (tours, rooms, annotations)
002_multi_tenant.sql        -- Entities, profiles, agencies, invitations
003_analytics.sql           -- tour_views, tour_events
004_lia_chat.sql            -- lia_sessions, lia_messages
005_usage_quotas.sql        -- usage_monthly
006_stripe_integration.sql  -- Colonnes Stripe sur entities
007_rls_policies.sql        -- Toutes les policies RLS
008_indexes.sql             -- Index de performance
009_functions.sql           -- Fonctions et triggers
010_notifications.sql       -- notifications, notification_preferences
011_seed_data.sql           -- Donnees initiales (optionnel)
```

---

## Backup et Restauration

### Backup manuel

```bash
# Via Supabase CLI
supabase db dump -f backup_$(date +%Y%m%d).sql

# Via pg_dump
pg_dump postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres > backup.sql
```

### Restauration

```bash
# Via psql
psql postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres < backup.sql
```

---

*Schema database EDL LIDAR - 02 fevrier 2026*
