# Story: MT-7 - RLS Policies Completes

**Epic**: 6 - Multi-tenant & Auth
**Points**: 8 SP
**Priorite**: P0 (Securite critique)

## En tant que

Architecte securite

## Je veux

Des policies RLS completes sur toutes les tables multi-tenant

## Afin de

Garantir l'isolation totale des donnees entre entites

## Criteres d'acceptation

- [ ] AC1: RLS active sur TOUTES les tables avec entity_id
- [ ] AC2: Policy SELECT: utilisateur voit uniquement les donnees de son entite
- [ ] AC3: Policy INSERT: entity_id force a l'entite de l'utilisateur
- [ ] AC4: Policy UPDATE: uniquement sur les donnees de son entite
- [ ] AC5: Policy DELETE: uniquement sur les donnees de son entite
- [ ] AC6: Policies specifiques par role (entity_admin vs agent)
- [ ] AC7: Tests de penetration: aucune fuite de donnees inter-tenant
- [ ] AC8: Function helper `get_user_entity_id()` performante
- [ ] AC9: Index sur entity_id pour toutes les tables concernees
- [ ] AC10: Documentation des policies dans le schema

## Taches techniques

- [ ] Task 1: Creer function `get_user_entity_id()`
- [ ] Task 2: Creer function `get_user_agency_id()`
- [ ] Task 3: Creer function `get_user_role()`
- [ ] Task 4: Policies table `entities`
- [ ] Task 5: Policies table `agencies`
- [ ] Task 6: Policies table `user_profiles`
- [ ] Task 7: Policies table `tours`
- [ ] Task 8: Policies table `invitations`
- [ ] Task 9: Policies table `usage_logs`
- [ ] Task 10: Tests securite automatises
- [ ] Task 11: Audit avec `supabase db lint`

## Notes techniques

### Functions helper (SECURITY DEFINER)

```sql
-- Recuperer l'entity_id de l'utilisateur connecte
CREATE OR REPLACE FUNCTION get_user_entity_id()
RETURNS UUID AS $$
  SELECT entity_id
  FROM user_profiles
  WHERE user_id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Recuperer l'agency_id de l'utilisateur connecte
CREATE OR REPLACE FUNCTION get_user_agency_id()
RETURNS UUID AS $$
  SELECT agency_id
  FROM user_profiles
  WHERE user_id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Recuperer le role de l'utilisateur connecte
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role
  FROM user_profiles
  WHERE user_id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Verifier si l'utilisateur est admin de son entite
CREATE OR REPLACE FUNCTION is_entity_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
      AND role = 'entity_admin'
  )
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

### Policies table entities

```sql
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

-- SELECT: voir uniquement son entite
CREATE POLICY "entities_select_own"
  ON entities FOR SELECT
  USING (id = get_user_entity_id());

-- UPDATE: uniquement entity_admin
CREATE POLICY "entities_update_admin"
  ON entities FOR UPDATE
  USING (id = get_user_entity_id() AND is_entity_admin())
  WITH CHECK (id = get_user_entity_id());

-- INSERT/DELETE: interdit (gere par trigger signup)
```

### Policies table agencies

```sql
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

-- SELECT: voir les agences de son entite
CREATE POLICY "agencies_select_own_entity"
  ON agencies FOR SELECT
  USING (entity_id = get_user_entity_id());

-- INSERT: uniquement entity_admin
CREATE POLICY "agencies_insert_admin"
  ON agencies FOR INSERT
  WITH CHECK (
    entity_id = get_user_entity_id()
    AND is_entity_admin()
  );

-- UPDATE: uniquement entity_admin
CREATE POLICY "agencies_update_admin"
  ON agencies FOR UPDATE
  USING (entity_id = get_user_entity_id() AND is_entity_admin())
  WITH CHECK (entity_id = get_user_entity_id());

-- DELETE: uniquement entity_admin + pas l'agence par defaut
CREATE POLICY "agencies_delete_admin"
  ON agencies FOR DELETE
  USING (
    entity_id = get_user_entity_id()
    AND is_entity_admin()
    AND NOT is_default
  );
```

### Policies table user_profiles

```sql
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: voir les profils de son entite
CREATE POLICY "profiles_select_own_entity"
  ON user_profiles FOR SELECT
  USING (entity_id = get_user_entity_id());

-- UPDATE: admin peut modifier tous les profils, autres uniquement le leur
CREATE POLICY "profiles_update"
  ON user_profiles FOR UPDATE
  USING (
    entity_id = get_user_entity_id()
    AND (is_entity_admin() OR user_id = auth.uid())
  )
  WITH CHECK (entity_id = get_user_entity_id());

-- DELETE: uniquement entity_admin (sauf son propre profil)
CREATE POLICY "profiles_delete_admin"
  ON user_profiles FOR DELETE
  USING (
    entity_id = get_user_entity_id()
    AND is_entity_admin()
    AND user_id != auth.uid()
  );
```

### Policies table tours

```sql
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;

-- SELECT: selon le role
CREATE POLICY "tours_select"
  ON tours FOR SELECT
  USING (
    entity_id = get_user_entity_id()
    AND (
      -- Admin voit tout
      is_entity_admin()
      -- Manager voit son agence
      OR (get_user_role() = 'agency_manager' AND agency_id = get_user_agency_id())
      -- Agent voit son agence
      OR (get_user_role() = 'agent' AND agency_id = get_user_agency_id())
    )
  );

-- INSERT: force entity_id et agency_id
CREATE POLICY "tours_insert"
  ON tours FOR INSERT
  WITH CHECK (
    entity_id = get_user_entity_id()
    AND agency_id = get_user_agency_id()
  );

-- UPDATE: selon le role
CREATE POLICY "tours_update"
  ON tours FOR UPDATE
  USING (
    entity_id = get_user_entity_id()
    AND (
      is_entity_admin()
      OR agency_id = get_user_agency_id()
    )
  )
  WITH CHECK (entity_id = get_user_entity_id());

-- DELETE: admin ou manager de l'agence
CREATE POLICY "tours_delete"
  ON tours FOR DELETE
  USING (
    entity_id = get_user_entity_id()
    AND (
      is_entity_admin()
      OR (get_user_role() = 'agency_manager' AND agency_id = get_user_agency_id())
    )
  );
```

### Policies table invitations

```sql
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- SELECT: admin voit les invitations de son entite
CREATE POLICY "invitations_select_admin"
  ON invitations FOR SELECT
  USING (entity_id = get_user_entity_id() AND is_entity_admin());

-- INSERT: uniquement entity_admin
CREATE POLICY "invitations_insert_admin"
  ON invitations FOR INSERT
  WITH CHECK (entity_id = get_user_entity_id() AND is_entity_admin());

-- DELETE: uniquement entity_admin
CREATE POLICY "invitations_delete_admin"
  ON invitations FOR DELETE
  USING (entity_id = get_user_entity_id() AND is_entity_admin());
```

### Tests de securite

```typescript
// tests/security/rls.test.ts
describe('RLS Multi-tenant Security', () => {
  let entityA: Entity;
  let entityB: Entity;
  let userA: User;
  let userB: User;

  beforeAll(async () => {
    // Setup: creer 2 entites avec utilisateurs
    entityA = await createTestEntity('Entity A');
    entityB = await createTestEntity('Entity B');
    userA = await createTestUser(entityA.id);
    userB = await createTestUser(entityB.id);
  });

  describe('Tours isolation', () => {
    it('User A cannot see tours from Entity B', async () => {
      // Creer un tour pour Entity B
      const tourB = await createTour(entityB.id, userB.id);

      // Se connecter en tant que User A
      const supabaseA = await loginAs(userA);

      // Tenter de lire le tour de B
      const { data, error } = await supabaseA
        .from('tours')
        .select('*')
        .eq('id', tourB.id);

      expect(data).toHaveLength(0);
    });

    it('User A cannot insert tour for Entity B', async () => {
      const supabaseA = await loginAs(userA);

      const { error } = await supabaseA
        .from('tours')
        .insert({
          name: 'Hack Tour',
          entity_id: entityB.id, // Tentative d'injection
          agency_id: entityB.agencies[0].id
        });

      expect(error).toBeTruthy();
    });

    it('User A cannot update tour from Entity B', async () => {
      const tourB = await createTour(entityB.id, userB.id);
      const supabaseA = await loginAs(userA);

      const { error } = await supabaseA
        .from('tours')
        .update({ name: 'Hacked' })
        .eq('id', tourB.id);

      // L'update ne doit affecter aucune ligne
      expect(error).toBeNull(); // Pas d'erreur mais...

      // Verifier que le tour n'a pas ete modifie
      const { data } = await loginAs(userB).from('tours').select('name').eq('id', tourB.id).single();
      expect(data.name).not.toBe('Hacked');
    });
  });

  describe('Agencies isolation', () => {
    it('Admin A cannot create agency in Entity B', async () => {
      const adminA = await getEntityAdmin(entityA.id);
      const supabaseA = await loginAs(adminA);

      const { error } = await supabaseA
        .from('agencies')
        .insert({
          name: 'Rogue Agency',
          entity_id: entityB.id
        });

      expect(error).toBeTruthy();
    });
  });

  describe('User profiles isolation', () => {
    it('Cannot read profiles from other entity', async () => {
      const supabaseA = await loginAs(userA);

      const { data } = await supabaseA
        .from('user_profiles')
        .select('*')
        .eq('entity_id', entityB.id);

      expect(data).toHaveLength(0);
    });
  });
});
```

### Audit checklist

```sql
-- Script d'audit a executer regulierement
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('entities', 'agencies', 'user_profiles', 'tours', 'invitations', 'usage_logs')
  LOOP
    -- Verifier que RLS est active
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables
      WHERE tablename = tbl.tablename
        AND rowsecurity = true
    ) THEN
      RAISE WARNING 'RLS not enabled on table: %', tbl.tablename;
    END IF;

    -- Verifier qu'il y a au moins une policy
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = tbl.tablename
    ) THEN
      RAISE WARNING 'No policies on table: %', tbl.tablename;
    END IF;
  END LOOP;
END $$;
```

## Dependencies

- MT-1: Structure multi-tenant (toutes les tables)

## Definition of Done

- [ ] Code complete (toutes les policies)
- [ ] RLS active sur toutes les tables
- [ ] Tests de penetration passants (0 fuite)
- [ ] Audit `supabase db lint` clean
- [ ] Performance validee (< 10ms overhead)
- [ ] Code review securite fait
- [ ] Documentation policies mise a jour
