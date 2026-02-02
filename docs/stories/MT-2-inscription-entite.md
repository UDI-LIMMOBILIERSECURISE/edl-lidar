# Story: MT-2 - Inscription Entite

**Epic**: 6 - Multi-tenant & Auth
**Points**: 5 SP
**Priorite**: P0

## En tant que

Nouveau client (diagnostiqueur, agence immobiliere)

## Je veux

M'inscrire sur la plateforme et creer automatiquement mon entite

## Afin de

Commencer a utiliser EDL LIDAR avec mon equipe

## Criteres d'acceptation

- [ ] AC1: Page `/signup` accessible sans authentification
- [ ] AC2: Formulaire avec champs: email, password, nom entite, nom utilisateur
- [ ] AC3: Validation email format + password min 8 caracteres
- [ ] AC4: Creation automatique de l'entite avec plan "free" par defaut
- [ ] AC5: Creation automatique d'une agence "Siege" par defaut
- [ ] AC6: Creation du user_profile avec role "entity_admin"
- [ ] AC7: Envoi email de confirmation Supabase
- [ ] AC8: Redirection vers dashboard apres confirmation email
- [ ] AC9: Message d'erreur clair si email deja utilise
- [ ] AC10: Slug entite genere automatiquement depuis le nom (unique)

## Taches techniques

- [ ] Task 1: Creer page `src/app/auth/signup/page.tsx`
- [ ] Task 2: Creer composant `SignupForm.tsx` avec validation Zod
- [ ] Task 3: Creer fonction Edge `signup-with-entity` ou utiliser trigger
- [ ] Task 4: Creer trigger SQL `on_auth_user_created` pour creation auto
- [ ] Task 5: Implementer generation slug unique
- [ ] Task 6: Ajouter gestion erreurs et feedback utilisateur
- [ ] Task 7: Tests unitaires formulaire
- [ ] Task 8: Test E2E flow complet inscription

## Notes techniques

### Option 1: Trigger SQL (recommande)

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_entity_id UUID;
  new_agency_id UUID;
  entity_name TEXT;
  entity_slug TEXT;
BEGIN
  -- Recuperer le nom d'entite depuis les metadata
  entity_name := COALESCE(NEW.raw_user_meta_data->>'entity_name', 'Mon Entite');
  entity_slug := generate_unique_slug(entity_name);

  -- Creer l'entite
  INSERT INTO entities (name, slug, plan)
  VALUES (entity_name, entity_slug, 'free')
  RETURNING id INTO new_entity_id;

  -- Creer l'agence par defaut
  INSERT INTO agencies (entity_id, name)
  VALUES (new_entity_id, 'Siege')
  RETURNING id INTO new_agency_id;

  -- Creer le profil utilisateur
  INSERT INTO user_profiles (user_id, entity_id, agency_id, role)
  VALUES (NEW.id, new_entity_id, new_agency_id, 'entity_admin');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Fonction generation slug

```sql
CREATE OR REPLACE FUNCTION generate_unique_slug(name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  base_slug := lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug;

  WHILE EXISTS (SELECT 1 FROM entities WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;
```

### Schema formulaire Zod

```typescript
const signupSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caracteres'),
  entityName: z.string().min(2, 'Minimum 2 caracteres'),
  userName: z.string().min(2, 'Minimum 2 caracteres'),
});
```

## Dependencies

- MT-1: Structure multi-tenant (tables entities, agencies, user_profiles)

## Definition of Done

- [ ] Code complete
- [ ] Tests unitaires passants
- [ ] Test E2E inscription complete
- [ ] Code review fait
- [ ] Documentation utilisateur mise a jour
