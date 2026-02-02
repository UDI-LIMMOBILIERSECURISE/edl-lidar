# Story: MT-6 - Dashboard Quotas

**Epic**: 6 - Multi-tenant & Auth
**Points**: 5 SP
**Priorite**: P2

## En tant que

Entity Admin

## Je veux

Voir ma consommation actuelle par rapport a mes quotas

## Afin de

Anticiper les besoins d'upgrade et controler les couts

## Criteres d'acceptation

- [ ] AC1: Section "Quotas" visible sur le dashboard admin
- [ ] AC2: Affichage quota utilisateurs: X/Y utilises
- [ ] AC3: Affichage quota tours mensuels: X/Y crees ce mois
- [ ] AC4: Affichage quota stockage: X GB / Y GB utilises
- [ ] AC5: Barre de progression visuelle pour chaque quota
- [ ] AC6: Alerte visuelle quand quota > 80%
- [ ] AC7: Alerte critique quand quota > 95%
- [ ] AC8: Lien "Upgrader" vers la page de changement de plan
- [ ] AC9: Historique de consommation sur 6 mois (graphique)
- [ ] AC10: Refresh automatique des donnees toutes les 5 minutes

## Taches techniques

- [ ] Task 1: Creer composant `QuotasDashboard.tsx`
- [ ] Task 2: Creer composant `QuotaProgressBar.tsx`
- [ ] Task 3: Creer composant `UsageChart.tsx` (historique)
- [ ] Task 4: Creer table `usage_logs` pour tracking historique
- [ ] Task 5: Creer fonction SQL pour calculer stockage
- [ ] Task 6: Creer Edge Function `get-usage-stats`
- [ ] Task 7: Implementer cron job pour logging quotidien
- [ ] Task 8: Tests unitaires composants

## Notes techniques

### Table usage_logs

```sql
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  users_count INT NOT NULL DEFAULT 0,
  tours_count INT NOT NULL DEFAULT 0,
  storage_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_id, date)
);

CREATE INDEX idx_usage_logs_entity_date ON usage_logs(entity_id, date);
```

### Fonction calcul stockage

```sql
CREATE OR REPLACE FUNCTION get_entity_storage_bytes(p_entity_id UUID)
RETURNS BIGINT AS $$
  SELECT COALESCE(SUM(
    (metadata->>'size')::BIGINT
  ), 0)
  FROM storage.objects
  WHERE bucket_id = 'tours'
    AND (metadata->>'entity_id')::UUID = p_entity_id;
$$ LANGUAGE SQL STABLE;
```

### Composant QuotasDashboard

```typescript
interface QuotasData {
  users: { used: number; limit: number };
  tours: { used: number; limit: number };
  storage: { used: number; limit: number; unit: 'GB' };
}

function QuotasDashboard() {
  const { entity } = useAuth();
  const [quotas, setQuotas] = useState<QuotasData | null>(null);
  const [history, setHistory] = useState<UsageHistory[]>([]);

  useEffect(() => {
    fetchQuotas();
    const interval = setInterval(fetchQuotas, 5 * 60 * 1000); // 5 min
    return () => clearInterval(interval);
  }, []);

  const fetchQuotas = async () => {
    const { data } = await supabase.functions.invoke('get-usage-stats');
    setQuotas(data.current);
    setHistory(data.history);
  };

  if (!quotas) return <Skeleton className="h-64" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          Consommation
          <Badge variant="outline">{entity?.plan}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <QuotaProgressBar
          label="Utilisateurs"
          used={quotas.users.used}
          limit={quotas.users.limit}
          icon={<Users className="h-4 w-4" />}
        />

        <QuotaProgressBar
          label="Tours ce mois"
          used={quotas.tours.used}
          limit={quotas.tours.limit}
          icon={<Camera className="h-4 w-4" />}
        />

        <QuotaProgressBar
          label="Stockage"
          used={quotas.storage.used}
          limit={quotas.storage.limit}
          unit="GB"
          icon={<HardDrive className="h-4 w-4" />}
        />

        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-4">Historique (6 mois)</h4>
          <UsageChart data={history} />
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/settings/billing">
            Upgrader mon plan
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
```

### Composant QuotaProgressBar

```typescript
interface QuotaProgressBarProps {
  label: string;
  used: number;
  limit: number;
  unit?: string;
  icon?: React.ReactNode;
}

function QuotaProgressBar({ label, used, limit, unit, icon }: QuotaProgressBarProps) {
  const percentage = Math.min((used / limit) * 100, 100);

  const getVariant = () => {
    if (percentage >= 95) return 'destructive';
    if (percentage >= 80) return 'warning';
    return 'default';
  };

  const variant = getVariant();

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
        <span className={cn(
          variant === 'destructive' && 'text-destructive font-medium',
          variant === 'warning' && 'text-yellow-600 font-medium'
        )}>
          {used} / {limit} {unit}
        </span>
      </div>
      <Progress
        value={percentage}
        className={cn(
          'h-2',
          variant === 'destructive' && '[&>div]:bg-destructive',
          variant === 'warning' && '[&>div]:bg-yellow-500'
        )}
      />
      {percentage >= 80 && (
        <p className={cn(
          'text-xs',
          variant === 'destructive' ? 'text-destructive' : 'text-yellow-600'
        )}>
          {percentage >= 95
            ? 'Quota presque atteint ! Upgradez votre plan.'
            : 'Attention: quota bientot atteint.'}
        </p>
      )}
    </div>
  );
}
```

### Edge Function get-usage-stats

```typescript
// supabase/functions/get-usage-stats/index.ts
serve(async (req) => {
  const supabase = createServiceClient();
  const { entity_id } = await getAuthContext(req);

  // Stats actuelles
  const [usersCount, toursCount, storageBytes] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entity_id),

    supabase
      .from('tours')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entity_id)
      .gte('created_at', startOfMonth(new Date()).toISOString()),

    supabase.rpc('get_entity_storage_bytes', { p_entity_id: entity_id })
  ]);

  // Quotas de l'entite
  const { data: entity } = await supabase
    .from('entities')
    .select('quotas')
    .eq('id', entity_id)
    .single();

  // Historique 6 mois
  const sixMonthsAgo = subMonths(new Date(), 6);
  const { data: history } = await supabase
    .from('usage_logs')
    .select('*')
    .eq('entity_id', entity_id)
    .gte('date', sixMonthsAgo.toISOString())
    .order('date', { ascending: true });

  return new Response(JSON.stringify({
    current: {
      users: { used: usersCount.count, limit: entity.quotas.users },
      tours: { used: toursCount.count, limit: entity.quotas.tours_per_month },
      storage: {
        used: Math.round(storageBytes / (1024 * 1024 * 1024) * 100) / 100,
        limit: entity.quotas.storage_gb,
        unit: 'GB'
      }
    },
    history
  }));
});
```

## Dependencies

- MT-1: Structure multi-tenant (quotas dans entities)
- MT-3: Authentification

## Definition of Done

- [ ] Code complete
- [ ] Dashboard affiche les 3 quotas
- [ ] Alertes visuelles fonctionnelles
- [ ] Historique affiche correctement
- [ ] Tests unitaires passants
- [ ] Code review fait
