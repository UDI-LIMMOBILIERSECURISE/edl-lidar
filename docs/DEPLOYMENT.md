# EDL LIDAR - Guide de Deploiement

> Guide complet pour deployer EDL LIDAR en production.

**Version:** 1.0
**Date:** 02 fevrier 2026

---

## Prerequisites

### Comptes requis

| Service | Usage | Plan recommande |
|---------|-------|-----------------|
| [Vercel](https://vercel.com) | Hebergement Next.js | Pro ($20/mois) |
| [Supabase](https://supabase.com) | Base de donnees + Auth | Pro ($25/mois) |
| [Cloudflare](https://cloudflare.com) | CDN + R2 Storage | Pay-as-you-go |
| [Google Cloud](https://cloud.google.com) | API Gemini | Pay-as-you-go |
| [Stripe](https://stripe.com) | Paiements | Standard (2.9% + 0.30) |

### Outils locaux

```bash
# Node.js 18+
node --version  # v18.x ou superieur

# npm ou pnpm
npm --version   # v9.x ou superieur

# Git
git --version

# Supabase CLI (optionnel)
npm install -g supabase
supabase --version
```

---

## 1. Configuration Supabase

### 1.1 Creer un projet

1. Aller sur [supabase.com/dashboard](https://supabase.com/dashboard)
2. Cliquer "New Project"
3. Configurer:
   - **Name:** edl-lidar-prod
   - **Database Password:** Generer un mot de passe fort
   - **Region:** Europe West (eu-west-1) ou le plus proche
4. Attendre la creation (~2 min)

### 1.2 Recuperer les credentials

Dans **Settings > API**, noter:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (secret!)
```

### 1.3 Configurer l'authentification

Dans **Authentication > Providers**:

1. **Email** (actif par defaut):
   - Confirm email: Activer
   - Secure email change: Activer

2. **URL Configuration** (Authentication > URL Configuration):
   ```
   Site URL: https://votre-domaine.com
   Redirect URLs:
     - https://votre-domaine.com/auth/callback
     - http://localhost:3000/auth/callback (dev)
   ```

### 1.4 Creer les tables

Option A - Via SQL Editor:

```sql
-- Copier le contenu de chaque fichier migration dans SQL Editor
-- Ordre d'execution:
-- 1. supabase/migrations/001_initial_schema.sql
-- 2. supabase/migrations/002_multi_tenant.sql
-- 3. supabase/migrations/003_analytics.sql
-- etc.
```

Option B - Via Supabase CLI:

```bash
# Lier au projet
supabase link --project-ref xxxx

# Appliquer les migrations
supabase db push
```

### 1.5 Activer Row Level Security

Verifier que RLS est active sur toutes les tables sensibles:

```sql
-- Verifier l'etat RLS
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Activer si manquant
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
```

---

## 2. Configuration Cloudflare R2

### 2.1 Creer un bucket R2

1. Aller sur [dash.cloudflare.com](https://dash.cloudflare.com)
2. Selectionner votre compte
3. R2 Object Storage > Create bucket
4. **Bucket name:** edllidarvideos
5. **Location hint:** Europe

### 2.2 Creer des API tokens

1. R2 > Manage R2 API Tokens
2. Create API token:
   - **Token name:** edl-lidar-server
   - **Permissions:** Object Read & Write
   - **Bucket:** edllidarvideos
3. Noter les credentials:

```
R2_ACCOUNT_ID=xxxx (visible dans l'URL du dashboard)
R2_ACCESS_KEY_ID=xxxx
R2_SECRET_ACCESS_KEY=xxxx
R2_BUCKET_NAME=edllidarvideos
```

### 2.3 Configurer l'acces public (optionnel)

Pour des URLs publiques stables:

1. R2 > Settings > Public access
2. Activer ou configurer un custom domain

```
R2_PUBLIC_URL=https://pub-xxxx.r2.dev
# ou avec custom domain:
R2_PUBLIC_URL=https://cdn.votre-domaine.com
```

### 2.4 Configurer CORS

Dans R2 > Settings > CORS policy:

```json
[
  {
    "AllowedOrigins": [
      "https://votre-domaine.com",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 3. Configuration Google Gemini

### 3.1 Creer un projet Google Cloud

1. Aller sur [console.cloud.google.com](https://console.cloud.google.com)
2. Creer un nouveau projet: "edl-lidar-prod"
3. Activer l'API:
   - APIs & Services > Enable APIs
   - Chercher "Generative Language API"
   - Enable

### 3.2 Creer une API Key

1. APIs & Services > Credentials
2. Create Credentials > API Key
3. Restreindre la cle:
   - **Application restrictions:** HTTP referrers
   - **Website restrictions:** votre-domaine.com/*
   - **API restrictions:** Generative Language API

```
GEMINI_API_KEY=AIza...
```

### 3.3 Quotas

Verifier les quotas dans la console Google Cloud:
- Requetes par minute: 60 (free) / 1000+ (pay-as-you-go)
- Tokens par minute: selon plan

---

## 4. Configuration Stripe

### 4.1 Creer un compte Stripe

1. Aller sur [dashboard.stripe.com](https://dashboard.stripe.com)
2. Creer un compte ou se connecter
3. Activer le mode Live quand pret

### 4.2 Creer les produits et prix

Dans Products > Add product:

**Produit 1: Starter**
```
Name: EDL LIDAR Starter
Price: 29.00 EUR / month
Price ID: price_starter_monthly (noter l'ID)
```

**Produit 2: Pro**
```
Name: EDL LIDAR Pro
Price: 79.00 EUR / month
Price ID: price_pro_monthly (noter l'ID)
```

### 4.3 Recuperer les cles API

Dans Developers > API keys:

```
STRIPE_SECRET_KEY=sk_live_xxxx (ou sk_test_xxxx pour test)
STRIPE_PUBLISHABLE_KEY=pk_live_xxxx
STRIPE_PRICE_STARTER=price_xxxx
STRIPE_PRICE_PRO=price_xxxx
```

### 4.4 Configurer le webhook

1. Developers > Webhooks > Add endpoint
2. **Endpoint URL:** https://votre-domaine.com/api/stripe/webhook
3. **Events to send:**
   - checkout.session.completed
   - customer.subscription.updated
   - customer.subscription.deleted
   - invoice.payment_failed
4. Noter le **Signing secret:**

```
STRIPE_WEBHOOK_SECRET=whsec_xxxx
```

### 4.5 Configurer le Customer Portal

1. Settings > Billing > Customer portal
2. Activer les options souhaitees:
   - Update payment method
   - Cancel subscription
   - View invoices
3. Save

---

## 5. Deploiement Vercel

### 5.1 Connecter le repository

1. Aller sur [vercel.com](https://vercel.com)
2. Import Git Repository
3. Selectionner le repo "edl-lidar"
4. **Framework Preset:** Next.js
5. **Root Directory:** web-app

### 5.2 Configurer les variables d'environnement

Dans Settings > Environment Variables, ajouter:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Gemini
GEMINI_API_KEY=AIza...

# Cloudflare R2
R2_ACCOUNT_ID=xxxx
R2_ACCESS_KEY_ID=xxxx
R2_SECRET_ACCESS_KEY=xxxx
R2_BUCKET_NAME=edllidarvideos
R2_PUBLIC_URL=https://cdn.votre-domaine.com

# Stripe
STRIPE_SECRET_KEY=sk_live_xxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxx
STRIPE_PRICE_STARTER=price_xxxx
STRIPE_PRICE_PRO=price_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx

# App
NEXT_PUBLIC_APP_URL=https://votre-domaine.com
```

**Scope:** Production (et Preview si souhaite)

### 5.3 Deployer

1. Cliquer "Deploy"
2. Attendre la fin du build (~2-3 min)
3. Noter l'URL de production

### 5.4 Configurer le domaine custom

1. Settings > Domains
2. Add domain: votre-domaine.com
3. Configurer les DNS:
   - Type A: 76.76.21.21
   - ou CNAME: cname.vercel-dns.com

---

## 6. Post-Deploiement

### 6.1 Verifications essentielles

```bash
# 1. Page d'accueil charge
curl -I https://votre-domaine.com
# Attendu: HTTP/2 200

# 2. API repond
curl https://votre-domaine.com/api/health
# Attendu: {"status":"ok"}

# 3. Auth Supabase fonctionne
# Tester inscription/connexion manuellement
```

### 6.2 Tests fonctionnels

| Test | Action | Resultat attendu |
|------|--------|------------------|
| Inscription | Creer un compte | Email de confirmation recu |
| Connexion | Se connecter | Dashboard accessible |
| Upload video | Uploader une video test | Video stockee sur R2 |
| Indexation IA | Lancer l'indexation | Pieces detectees |
| Publication | Publier une visite | Lien public fonctionne |
| Chat Lia | Poser une question | Reponse coherente |
| Paiement | Test avec carte Stripe test | Upgrade fonctionne |

### 6.3 Monitoring

Configurer les alertes dans Vercel:
- Build failures
- Runtime errors
- Edge function errors

Configurer les alertes Stripe:
- Failed payments
- Subscription changes

### 6.4 Sauvegardes

Supabase gere les backups automatiquement (Pro plan):
- Point-in-time recovery: 7 jours
- Daily backups: 7 jours

Pour R2, configurer une lifecycle rule si necessaire.

---

## 7. Troubleshooting

### Erreurs courantes

#### "CORS error" sur upload R2
- Verifier la configuration CORS dans R2 Settings
- Verifier que l'origin est dans la liste autorisee

#### "Unauthorized" sur les API
- Verifier que SUPABASE_SERVICE_ROLE_KEY est defini
- Verifier que le token JWT n'est pas expire

#### Indexation IA echoue
- Verifier les quotas Gemini API
- Verifier que la video est accessible (URL R2 valide)
- Verifier les logs Vercel pour plus de details

#### Webhook Stripe non recu
- Verifier l'URL du webhook (HTTPS requis)
- Verifier le signing secret
- Tester avec Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

### Logs

```bash
# Vercel logs
vercel logs --follow

# Supabase logs (via dashboard)
# Database > Logs

# Stripe webhook logs
# Developers > Webhooks > Select endpoint > Logs
```

---

## 8. Mise a jour

### Deploiement continu

Chaque push sur `main` declenche un deploiement automatique.

### Migrations database

```bash
# Creer une nouvelle migration
supabase migration new ma_migration

# Appliquer en production
supabase db push
```

### Rollback

Via Vercel:
1. Deployments > Selectionner un deploiement precedent
2. "Promote to Production"

---

## 9. Checklist Pre-Production

- [ ] Variables d'environnement configurees (tous les services)
- [ ] Domaine custom configure avec SSL
- [ ] Supabase RLS active sur toutes les tables
- [ ] Stripe webhook configure et teste
- [ ] R2 CORS configure
- [ ] Backup database verifie
- [ ] Monitoring configure
- [ ] Tests E2E passes
- [ ] Mentions legales / CGU en place
- [ ] RGPD: politique confidentialite publiee

---

## 10. Estimation des Couts

### Cout mensuel estime (100 utilisateurs, 500 visites/mois)

| Service | Cout estime |
|---------|-------------|
| Vercel Pro | $20 |
| Supabase Pro | $25 |
| Cloudflare R2 (~50GB) | $5-10 |
| Google Gemini (pay-as-you-go) | $20-50 |
| Stripe (transactions) | Variable |
| **Total** | **~$70-105/mois** |

### Scaling

- Vercel: Scale automatique, facturation a l'usage
- Supabase: Upgrade vers Team ($599/mois) si >10GB DB
- R2: Pas de frais egress, stockage a $0.015/GB/mois
- Gemini: Quotas ajustables via console Google Cloud

---

*Guide de deploiement EDL LIDAR - 02 fevrier 2026*
