# Story: MT-4 - Gestion Utilisateurs

**Epic**: 6 - Multi-tenant & Auth
**Points**: 5 SP
**Priorite**: P1

## En tant que

Entity Admin

## Je veux

Inviter des utilisateurs par email et gerer leurs roles

## Afin de

Constituer mon equipe et controler leurs acces

## Criteres d'acceptation

- [ ] AC1: Page `/settings/users` accessible uniquement aux entity_admin
- [ ] AC2: Liste des utilisateurs de l'entite avec nom, email, role, agence
- [ ] AC3: Bouton "Inviter un utilisateur" ouvre modal
- [ ] AC4: Formulaire invitation: email, role, agence (optionnel)
- [ ] AC5: Envoi email d'invitation avec lien securise
- [ ] AC6: L'invite cree son compte et est rattache a l'entite
- [ ] AC7: Modification du role d'un utilisateur existant
- [ ] AC8: Suppression d'un utilisateur (soft delete ou revocation)
- [ ] AC9: Verification quota utilisateurs avant invitation
- [ ] AC10: Affichage compteur "X/Y utilisateurs"

## Taches techniques

- [ ] Task 1: Creer page `src/app/settings/users/page.tsx`
- [ ] Task 2: Creer composant `UsersList.tsx`
- [ ] Task 3: Creer composant `InviteUserModal.tsx`
- [ ] Task 4: Creer table `invitations` pour tracking
- [ ] Task 5: Creer Edge Function `invite-user`
- [ ] Task 6: Configurer template email Supabase
- [ ] Task 7: Creer page acceptation invitation `/invite/[token]`
- [ ] Task 8: Implementer modification/suppression utilisateur
- [ ] Task 9: Tests E2E flow invitation complet

## Notes techniques

### Table invitations

```sql
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'agent',
  token TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);
```

### Edge Function invite-user

```typescript
// supabase/functions/invite-user/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { email, role, agency_id } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Verifier que l'appelant est entity_admin
  const authHeader = req.headers.get('Authorization')!;
  const { data: { user } } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('entity_id, role')
    .eq('user_id', user?.id)
    .single();

  if (profile?.role !== 'entity_admin') {
    return new Response('Unauthorized', { status: 403 });
  }

  // Verifier quota
  const { data: entity } = await supabase
    .from('entities')
    .select('quotas')
    .eq('id', profile.entity_id)
    .single();

  const { count } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', profile.entity_id);

  if (count >= entity.quotas.users) {
    return new Response(
      JSON.stringify({ error: 'Quota utilisateurs atteint' }),
      { status: 400 }
    );
  }

  // Creer invitation
  const token = crypto.randomUUID();
  await supabase.from('invitations').insert({
    entity_id: profile.entity_id,
    agency_id,
    email,
    role,
    token,
    invited_by: user?.id
  });

  // Envoyer email via Supabase Auth
  await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${Deno.env.get('SITE_URL')}/invite/${token}`
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

### Composant UsersList

```typescript
interface User {
  id: string;
  user_id: string;
  role: 'entity_admin' | 'agency_manager' | 'agent';
  agency: { id: string; name: string } | null;
  user: { email: string; user_metadata: { name: string } };
}

function UsersList() {
  const { entity } = useAuth();
  const [users, setUsers] = useState<User[]>([]);

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2>Utilisateurs ({users.length}/{entity?.quotas.users})</h2>
        <Button onClick={() => setShowInviteModal(true)}>
          Inviter un utilisateur
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Agence</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map(user => (
            <TableRow key={user.id}>
              <TableCell>{user.user.user_metadata.name}</TableCell>
              <TableCell>{user.user.email}</TableCell>
              <TableCell>
                <RoleSelect
                  value={user.role}
                  onChange={(role) => updateRole(user.id, role)}
                  disabled={user.role === 'entity_admin'}
                />
              </TableCell>
              <TableCell>{user.agency?.name || '-'}</TableCell>
              <TableCell>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeUser(user.id)}
                  disabled={user.role === 'entity_admin'}
                >
                  Supprimer
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

## Dependencies

- MT-1: Structure multi-tenant
- MT-3: Authentification (AuthContext)

## Definition of Done

- [ ] Code complete
- [ ] Tests E2E invitation complete
- [ ] Verification quota implementee
- [ ] Code review fait
- [ ] Documentation utilisateur mise a jour
