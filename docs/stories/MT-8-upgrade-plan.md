# Story: MT-8 - Upgrade Plan (Stripe)

**Epic**: 6 - Multi-tenant & Auth
**Points**: 5 SP
**Priorite**: P2

## En tant que

Entity Admin

## Je veux

Changer mon plan tarifaire et payer par carte bancaire

## Afin de

Debloquer plus de quotas pour mon equipe

## Criteres d'acceptation

- [ ] AC1: Page `/settings/billing` accessible aux entity_admin
- [ ] AC2: Affichage du plan actuel avec ses quotas
- [ ] AC3: Comparatif des plans disponibles (Free, Starter, Pro, Enterprise)
- [ ] AC4: Bouton "Upgrader" ouvre Stripe Checkout
- [ ] AC5: Webhook Stripe met a jour le plan dans la DB
- [ ] AC6: Quotas mis a jour immediatement apres paiement
- [ ] AC7: Email de confirmation envoye
- [ ] AC8: Historique des factures accessible
- [ ] AC9: Possibilite de downgrade (effectif fin de periode)
- [ ] AC10: Gestion des moyens de paiement (Customer Portal)

## Taches techniques

- [ ] Task 1: Creer page `src/app/settings/billing/page.tsx`
- [ ] Task 2: Creer composant `PlanComparison.tsx`
- [ ] Task 3: Configurer produits/prix dans Stripe Dashboard
- [ ] Task 4: Creer Edge Function `create-checkout-session`
- [ ] Task 5: Creer Edge Function `stripe-webhook`
- [ ] Task 6: Ajouter colonnes stripe_customer_id, stripe_subscription_id
- [ ] Task 7: Implementer Customer Portal pour gestion paiement
- [ ] Task 8: Configurer emails transactionnels Stripe
- [ ] Task 9: Tests E2E avec Stripe test mode

## Notes techniques

### Plans tarifaires

| Plan | Prix/mois | Utilisateurs | Tours/mois | Stockage |
|------|-----------|--------------|------------|----------|
| Free | 0 | 3 | 10 | 5 GB |
| Starter | 29 | 10 | 50 | 25 GB |
| Pro | 79 | 25 | 200 | 100 GB |
| Enterprise | Sur devis | Illimite | Illimite | Illimite |

### Migration Stripe columns

```sql
ALTER TABLE entities
  ADD COLUMN stripe_customer_id TEXT UNIQUE,
  ADD COLUMN stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN stripe_price_id TEXT,
  ADD COLUMN billing_cycle_end TIMESTAMPTZ;

CREATE INDEX idx_entities_stripe_customer ON entities(stripe_customer_id);
```

### Edge Function create-checkout-session

```typescript
// supabase/functions/create-checkout-session/index.ts
import Stripe from 'https://esm.sh/stripe@13.0.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
});

const PRICES = {
  starter: 'price_xxx_starter',
  pro: 'price_xxx_pro',
};

serve(async (req) => {
  const { plan } = await req.json();
  const { entity_id, user_email } = await getAuthContext(req);

  // Recuperer ou creer le customer Stripe
  const { data: entity } = await supabase
    .from('entities')
    .select('stripe_customer_id, name')
    .eq('id', entity_id)
    .single();

  let customerId = entity.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user_email,
      name: entity.name,
      metadata: { entity_id },
    });
    customerId = customer.id;

    await supabase
      .from('entities')
      .update({ stripe_customer_id: customerId })
      .eq('id', entity_id);
  }

  // Creer la session Checkout
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price: PRICES[plan],
      quantity: 1,
    }],
    success_url: `${Deno.env.get('SITE_URL')}/settings/billing?success=true`,
    cancel_url: `${Deno.env.get('SITE_URL')}/settings/billing?canceled=true`,
    metadata: { entity_id },
  });

  return new Response(JSON.stringify({ url: session.url }));
});
```

### Edge Function stripe-webhook

```typescript
// supabase/functions/stripe-webhook/index.ts
import Stripe from 'https://esm.sh/stripe@13.0.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const PLAN_QUOTAS = {
  'price_xxx_starter': {
    plan: 'starter',
    quotas: { users: 10, tours_per_month: 50, storage_gb: 25 }
  },
  'price_xxx_pro': {
    plan: 'pro',
    quotas: { users: 25, tours_per_month: 200, storage_gb: 100 }
  },
};

serve(async (req) => {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return new Response('Invalid signature', { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const entityId = session.metadata?.entity_id;
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      const priceId = subscription.items.data[0].price.id;
      const planConfig = PLAN_QUOTAS[priceId];

      await supabase
        .from('entities')
        .update({
          stripe_subscription_id: subscription.id,
          stripe_price_id: priceId,
          plan: planConfig.plan,
          quotas: planConfig.quotas,
          billing_cycle_end: new Date(subscription.current_period_end * 1000).toISOString(),
        })
        .eq('id', entityId);

      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const priceId = subscription.items.data[0].price.id;
      const planConfig = PLAN_QUOTAS[priceId];

      if (planConfig) {
        await supabase
          .from('entities')
          .update({
            stripe_price_id: priceId,
            plan: planConfig.plan,
            quotas: planConfig.quotas,
            billing_cycle_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;

      // Downgrade vers Free
      await supabase
        .from('entities')
        .update({
          stripe_subscription_id: null,
          stripe_price_id: null,
          plan: 'free',
          quotas: { users: 3, tours_per_month: 10, storage_gb: 5 },
          billing_cycle_end: null,
        })
        .eq('stripe_subscription_id', subscription.id);

      break;
    }
  }

  return new Response(JSON.stringify({ received: true }));
});
```

### Composant BillingPage

```typescript
function BillingPage() {
  const { entity } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async (plan: string) => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('create-checkout-session', {
      body: { plan },
    });
    window.location.href = data.url;
  };

  const handleManageBilling = async () => {
    const { data } = await supabase.functions.invoke('create-portal-session');
    window.location.href = data.url;
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Plan actuel: {entity?.plan}</CardTitle>
          <CardDescription>
            Periode de facturation: jusqu'au{' '}
            {entity?.billing_cycle_end
              ? format(new Date(entity.billing_cycle_end), 'dd MMMM yyyy', { locale: fr })
              : 'N/A'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Utilisateurs</p>
              <p className="text-2xl font-bold">{entity?.quotas.users}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tours/mois</p>
              <p className="text-2xl font-bold">{entity?.quotas.tours_per_month}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Stockage</p>
              <p className="text-2xl font-bold">{entity?.quotas.storage_gb} GB</p>
            </div>
          </div>
        </CardContent>
        {entity?.stripe_subscription_id && (
          <CardFooter>
            <Button variant="outline" onClick={handleManageBilling}>
              Gerer le paiement
            </Button>
          </CardFooter>
        )}
      </Card>

      <PlanComparison
        currentPlan={entity?.plan}
        onSelect={handleUpgrade}
        loading={loading}
      />

      {entity?.stripe_customer_id && (
        <Card>
          <CardHeader>
            <CardTitle>Historique des factures</CardTitle>
          </CardHeader>
          <CardContent>
            <InvoicesList customerId={entity.stripe_customer_id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### Composant PlanComparison

```typescript
const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    features: ['3 utilisateurs', '10 tours/mois', '5 GB stockage'],
    cta: 'Plan actuel',
    disabled: true,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    features: ['10 utilisateurs', '50 tours/mois', '25 GB stockage', 'Support email'],
    cta: 'Upgrader',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 79,
    features: ['25 utilisateurs', '200 tours/mois', '100 GB stockage', 'Support prioritaire', 'API acces'],
    cta: 'Upgrader',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    features: ['Utilisateurs illimites', 'Tours illimites', 'Stockage illimite', 'Support dedie', 'SLA garanti'],
    cta: 'Nous contacter',
    href: '/contact',
  },
];

function PlanComparison({ currentPlan, onSelect, loading }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {PLANS.map(plan => (
        <Card
          key={plan.id}
          className={cn(
            plan.popular && 'border-primary shadow-lg',
            currentPlan === plan.id && 'bg-muted'
          )}
        >
          {plan.popular && (
            <div className="bg-primary text-primary-foreground text-center py-1 text-sm font-medium">
              Populaire
            </div>
          )}
          <CardHeader>
            <CardTitle>{plan.name}</CardTitle>
            <CardDescription>
              {plan.price !== null ? (
                <span className="text-3xl font-bold">{plan.price}EUR</span>
              ) : (
                <span className="text-xl">Sur devis</span>
              )}
              {plan.price !== null && <span className="text-muted-foreground">/mois</span>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {plan.features.map(feature => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            {plan.href ? (
              <Button variant="outline" className="w-full" asChild>
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
            ) : (
              <Button
                className="w-full"
                variant={currentPlan === plan.id ? 'secondary' : 'default'}
                disabled={currentPlan === plan.id || plan.disabled || loading}
                onClick={() => onSelect(plan.id)}
              >
                {currentPlan === plan.id ? 'Plan actuel' : plan.cta}
              </Button>
            )}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
```

## Dependencies

- MT-1: Structure multi-tenant (table entities avec quotas)
- MT-3: Authentification
- MT-6: Dashboard quotas (affichage consommation)

## Definition of Done

- [ ] Code complete
- [ ] Integration Stripe fonctionnelle (test mode)
- [ ] Webhooks configures et testes
- [ ] Upgrade/downgrade operationnels
- [ ] Tests E2E avec Stripe CLI
- [ ] Code review fait
- [ ] Documentation Stripe mise a jour
