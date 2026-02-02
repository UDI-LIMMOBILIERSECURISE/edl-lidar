# Story: MT-5 - Gestion Agences

**Epic**: 6 - Multi-tenant & Auth
**Points**: 5 SP
**Priorite**: P1

## En tant que

Entity Admin

## Je veux

Creer et gerer les agences de mon entite

## Afin de

Organiser mes equipes par site geographique

## Criteres d'acceptation

- [ ] AC1: Page `/settings/agencies` accessible uniquement aux entity_admin
- [ ] AC2: Liste des agences avec nom, adresse, nombre d'utilisateurs
- [ ] AC3: Bouton "Creer une agence" ouvre formulaire
- [ ] AC4: Formulaire creation: nom (requis), adresse (optionnel)
- [ ] AC5: Edition d'une agence existante
- [ ] AC6: Suppression d'une agence (uniquement si aucun utilisateur rattache)
- [ ] AC7: Affichage du nombre de tours par agence
- [ ] AC8: Impossible de supprimer l'agence "Siege" par defaut
- [ ] AC9: Reassignation des utilisateurs possible avant suppression

## Taches techniques

- [ ] Task 1: Creer page `src/app/settings/agencies/page.tsx`
- [ ] Task 2: Creer composant `AgenciesList.tsx`
- [ ] Task 3: Creer composant `AgencyForm.tsx` (create/edit)
- [ ] Task 4: Implementer API CRUD agences
- [ ] Task 5: Ajouter compteur utilisateurs et tours par agence
- [ ] Task 6: Implementer contrainte suppression (check utilisateurs)
- [ ] Task 7: Modal reassignation utilisateurs avant suppression
- [ ] Task 8: Tests unitaires et E2E

## Notes techniques

### Composant AgenciesList

```typescript
interface Agency {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
  users_count: number;
  tours_count: number;
  is_default: boolean;
}

function AgenciesList() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchAgencies = async () => {
    const { data } = await supabase
      .from('agencies')
      .select(`
        *,
        users_count:user_profiles(count),
        tours_count:tours(count)
      `)
      .eq('entity_id', entity.id);

    setAgencies(data || []);
  };

  const deleteAgency = async (agency: Agency) => {
    if (agency.is_default) {
      toast.error('Impossible de supprimer l\'agence par defaut');
      return;
    }

    if (agency.users_count > 0) {
      // Ouvrir modal de reassignation
      setReassignModal({ agency, open: true });
      return;
    }

    await supabase.from('agencies').delete().eq('id', agency.id);
    fetchAgencies();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Agences</h2>
        <Button onClick={() => setShowCreateForm(true)}>
          Creer une agence
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agencies.map(agency => (
          <Card key={agency.id}>
            <CardHeader>
              <CardTitle className="flex justify-between">
                {agency.name}
                {agency.is_default && (
                  <Badge variant="secondary">Par defaut</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{agency.address || 'Aucune adresse'}</p>
              <div className="mt-4 flex gap-4 text-sm">
                <span>{agency.users_count} utilisateurs</span>
                <span>{agency.tours_count} tours</span>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingAgency(agency)}
              >
                Modifier
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteAgency(agency)}
                disabled={agency.is_default}
              >
                Supprimer
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <AgencyFormDialog
        open={showCreateForm || !!editingAgency}
        agency={editingAgency}
        onClose={() => {
          setShowCreateForm(false);
          setEditingAgency(null);
        }}
        onSave={() => {
          fetchAgencies();
          setShowCreateForm(false);
          setEditingAgency(null);
        }}
      />
    </div>
  );
}
```

### Composant AgencyForm

```typescript
const agencySchema = z.object({
  name: z.string().min(2, 'Minimum 2 caracteres'),
  address: z.string().optional(),
});

function AgencyFormDialog({ open, agency, onClose, onSave }) {
  const { entity } = useAuth();
  const form = useForm({
    resolver: zodResolver(agencySchema),
    defaultValues: {
      name: agency?.name || '',
      address: agency?.address || '',
    },
  });

  const onSubmit = async (values) => {
    if (agency) {
      await supabase
        .from('agencies')
        .update(values)
        .eq('id', agency.id);
    } else {
      await supabase
        .from('agencies')
        .insert({ ...values, entity_id: entity.id });
    }
    onSave();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {agency ? 'Modifier l\'agence' : 'Creer une agence'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Agence Paris" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="123 rue..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit">
                {agency ? 'Enregistrer' : 'Creer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

### Modal reassignation

```typescript
function ReassignUsersModal({ agency, open, onClose }) {
  const [targetAgencyId, setTargetAgencyId] = useState<string>('');
  const [agencies, setAgencies] = useState<Agency[]>([]);

  const handleReassign = async () => {
    // Reassigner tous les utilisateurs
    await supabase
      .from('user_profiles')
      .update({ agency_id: targetAgencyId })
      .eq('agency_id', agency.id);

    // Supprimer l'agence
    await supabase.from('agencies').delete().eq('id', agency.id);

    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassigner les utilisateurs</DialogTitle>
          <DialogDescription>
            L'agence "{agency.name}" contient {agency.users_count} utilisateurs.
            Selectionnez une agence de destination avant suppression.
          </DialogDescription>
        </DialogHeader>
        <Select value={targetAgencyId} onValueChange={setTargetAgencyId}>
          <SelectTrigger>
            <SelectValue placeholder="Choisir une agence" />
          </SelectTrigger>
          <SelectContent>
            {agencies
              .filter(a => a.id !== agency.id)
              .map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            variant="destructive"
            onClick={handleReassign}
            disabled={!targetAgencyId}
          >
            Reassigner et supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## Dependencies

- MT-1: Structure multi-tenant (table agencies)
- MT-3: Authentification (AuthContext)

## Definition of Done

- [ ] Code complete
- [ ] CRUD agences fonctionnel
- [ ] Contraintes suppression implementees
- [ ] Tests E2E passants
- [ ] Code review fait
