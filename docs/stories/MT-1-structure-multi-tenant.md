# Story: MT-1 - Structure Multi-tenant

**Epic**: 6 - Multi-tenant & Auth
**Points**: 8 SP
**Priorite**: P0 (Fondation)

## En tant que

Architecte technique

## Je veux

Une structure de base de donnees multi-tenant avec les tables entities, agencies et user_profiles

## Afin de

Isoler les donnees de chaque client et permettre une gestion hierarchique des utilisateurs et agences

## Criteres d'acceptation

- [ ] AC1: Table `entities` creee avec colonnes (id, name, slug, plan, quotas, settings, created_at)
- [ ] AC2: Table `agencies` creee avec colonnes (id, entity_id, name, address, created_at)
- [ ] AC3: Table `user_profiles` creee avec colonnes (id, user_id, entity_id, agency_id, role, created_at)
- [ ] AC4: Contrainte FK entity_id sur agencies et user_profiles
- [ ] AC5: Contrainte FK agency_id sur user_profiles (nullable pour entity_admin)
- [ ] AC6: Index sur entity_id pour toutes les tables concernees
- [ ] AC7: Enum type `user_role` cree (entity_admin, agency_manager, agent)
- [ ] AC8: Table `tours` modifiee avec ajout entity_id et agency_id
- [ ] AC9: Migration reversible (up/down)

## Taches techniques

- [ ] Task 1: Creer migration SQL `20260202_multi_tenant_structure.sql`
- [ ] Task 2: Definir enum `user_role`
- [ ] Task 3: Creer table `entities` avec contraintes
- [ ] Task 4: Creer table `agencies` avec FK vers entities
- [ ] Task 5: Creer table `user_profiles` avec FK vers auth.users, entities, agencies
- [ ] Task 6: Modifier table `tours` pour ajouter entity_id, agency_id
- [ ] Task 7: Creer index de performance
- [ ] Task 8: Generer types TypeScript avec `supabase gen types`

## Notes techniques

### Schema SQL propose

```sql
-- Enum pour les roles
CREATE TYPE user_role AS ENUM ('entity_admin', 'agency_manager', 'agent');

-- Table principale des entites (tenants)
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  quotas JSONB DEFAULT '{"tours_per_month": 10, "storage_gb": 5, "users": 3}'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table des agences
CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Profils utilisateurs
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  role user_role NOT NULL DEFAULT 'agent',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Index de performance
CREATE INDEX idx_agencies_entity ON agencies(entity_id);
CREATE INDEX idx_user_profiles_entity ON user_profiles(entity_id);
CREATE INDEX idx_user_profiles_agency ON user_profiles(agency_id);
```

### Modification table tours

```sql
ALTER TABLE tours
  ADD COLUMN entity_id UUID REFERENCES entities(id),
  ADD COLUMN agency_id UUID REFERENCES agencies(id);

CREATE INDEX idx_tours_entity ON tours(entity_id);
CREATE INDEX idx_tours_agency ON tours(agency_id);
```

## Dependencies

- Aucune (story fondation)

## Definition of Done

- [ ] Code complete
- [ ] Migration testee en local
- [ ] Types TypeScript generes
- [ ] Code review fait
- [ ] Documentation schema mise a jour
