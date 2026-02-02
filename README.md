# EDL LIDAR - Visites Virtuelles Immobilieres

> Plateforme SaaS de creation et partage de visites virtuelles pour l'immobilier avec assistant IA conversationnel (Lia).

## Features

### Epic 5 - Visite Virtuelle IA (Complete)

| Story | Description | Status |
|-------|-------------|--------|
| 5.1 | Infrastructure Web & API | Done |
| 5.2 | Upload video (jusqu'a 5GB) | Done |
| 5.2b | Integration Cloudflare R2 | Done |
| 5.3 | Indexation IA des pieces (Gemini) | Done |
| 5.4 | Player video avec timeline | Done |
| 5.5 | Chat Lia (assistant IA) | Done |
| 5.6 | Publication & Partage | Done |
| 5.7 | Export Metre PDF | Done |

### Epic 6 - Multi-tenant & Authentification (Complete)

| Story | Description | Status |
|-------|-------------|--------|
| MT-1 | Structure multi-tenant | Done |
| MT-2 | Inscription entite | Done |
| MT-3 | Authentification | Done |
| MT-4 | Gestion utilisateurs | Done |
| MT-5 | Gestion agences | Done |
| MT-6 | Dashboard quotas | Done |
| MT-7 | RLS Policies | Done |
| MT-8 | Upgrade plan (Stripe) | Done |

### Epic 7 - Analytics & Notifications (Complete)

| Story | Description | Status |
|-------|-------------|--------|
| 7.1 | Tracking visiteurs RGPD | Done |
| 7.2 | Dashboard analytics | Done |
| 7.3 | Export CSV/JSON | Done |
| 7.4 | Notifications in-app | Done |
| 7.5 | Preferences notifications | Done |
| 7.6 | Digest hebdomadaire | Done |

## Stack Technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | Supabase (PostgreSQL, Auth, RLS) |
| IA | Google Gemini 2.0 Flash |
| Stockage | Cloudflare R2 (egress gratuit) |
| Paiements | Stripe (abonnements) |
| Deploiement | Vercel |

## Quick Start

### 1. Cloner le repository

```bash
git clone https://github.com/votre-org/edl-lidar.git
cd edl-lidar/web-app
```

### 2. Installer les dependances

```bash
npm install
```

### 3. Configurer l'environnement

Copier `.env.example` vers `.env.local`:

```bash
cp .env.example .env.local
```

Remplir les variables:

```env
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
R2_PUBLIC_URL=https://cdn.example.com

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 4. Lancer le serveur de developpement

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## Architecture

```
src/
├── app/
│   ├── (auth)/                    # Login, Signup, Forgot password
│   ├── api/                       # API Routes
│   │   ├── agencies/              # CRUD agences
│   │   ├── analytics/             # Tracking & stats
│   │   ├── chat/                  # Chat Lia (Gemini)
│   │   ├── invitations/           # Invitations equipe
│   │   ├── notifications/         # Notifications
│   │   ├── stripe/                # Checkout, Portal, Webhook
│   │   ├── tours/[id]/            # Index, Publish, Export
│   │   ├── upload/                # Presigned URLs R2
│   │   └── usage/                 # Quotas
│   ├── dashboard/                 # Dashboard utilisateur
│   │   ├── agencies/
│   │   ├── analytics/
│   │   ├── billing/
│   │   ├── notifications/
│   │   ├── settings/
│   │   ├── team/
│   │   ├── tours/
│   │   └── usage/
│   ├── tours/                     # Gestion visites
│   │   ├── new/
│   │   └── [id]/
│   ├── v/[slug]/                  # Page publique visite
│   └── invite/[token]/            # Acceptation invitation
├── components/
│   ├── analytics/                 # Charts, Stats, Export
│   ├── AnalyticsTracker.tsx
│   ├── AuthProvider.tsx
│   ├── InviteModal.tsx
│   ├── LiaChat.tsx                # Assistant IA
│   ├── NotificationBell.tsx
│   ├── PricingCard.tsx
│   ├── PublicTourView.tsx
│   ├── QuotaCard.tsx
│   ├── TourPlayer.tsx             # Player video
│   └── UsageAlert.tsx
├── lib/
│   ├── analytics.ts               # Tracking RGPD
│   ├── gemini.ts                  # Client Gemini
│   ├── notifications.ts
│   ├── permissions.ts
│   ├── plans.ts                   # Definition plans
│   ├── r2.ts                      # Client R2
│   ├── stripe.ts                  # Client Stripe
│   └── supabase.ts                # Client Supabase
└── types/
    └── database.ts                # Types Supabase
```

## Flux Utilisateur Principal

```
1. INSCRIPTION
   Creer compte → Creer entite → Dashboard

2. UPLOAD VIDEO
   Upload fichier → Stockage R2 → Cree tour (status: processing)

3. INDEXATION IA
   Lancer indexation → Gemini analyse → Detecte pieces → Status: ready

4. EDITION (optionnel)
   Renommer pieces → Ajouter annotations

5. PUBLICATION
   Clic "Publier" → Genere slug → Page publique /v/[slug]

6. PARTAGE
   Copier lien → Embed iframe → QR code

7. VISITEURS
   Regardent video → Naviguent par pieces → Chattent avec Lia

8. ANALYTICS
   Tracking anonyme → Dashboard stats → Export CSV
```

## Chat Lia

L'assistant IA Lia permet aux visiteurs de:

- **Naviguer** - "Montre-moi la cuisine" → Seek automatique
- **Questionner** - "Quelle est la surface du salon ?"
- **Explorer** - "Combien de chambres y a-t-il ?"

Les reponses sont contextuelles au bien visite (adresse, pieces, surfaces).

## Plans Tarifaires

| Plan | Prix | Tours | Users | Features |
|------|------|-------|-------|----------|
| Free | 0 | 10 | 1 | Basique |
| Starter | 29/mois | 50 | 10 | Multi-users, Agences |
| Pro | 79/mois | 200 | 25 | API, White label |
| Enterprise | Sur devis | Illimite | Illimite | Support dedie |

## Documentation

- [Architecture](../docs/ARCHITECTURE.md) - Architecture technique complete
- [API Reference](../docs/API-REFERENCE.md) - Documentation API REST
- [Database Schema](../docs/DATABASE-SCHEMA.md) - Schema PostgreSQL
- [Deployment](../docs/DEPLOYMENT.md) - Guide de deploiement

## Scripts

```bash
# Developpement
npm run dev

# Build production
npm run build

# Lancer production
npm run start

# Linting
npm run lint

# Regenerer types Supabase
npm run db:generate
```

## Contribution

1. Fork le projet
2. Creer une branche (`git checkout -b feature/ma-feature`)
3. Commit (`git commit -m 'feat: Ajoute ma feature'`)
4. Push (`git push origin feature/ma-feature`)
5. Ouvrir une Pull Request

## License

MIT

---

**EDL LIDAR** - Visites virtuelles nouvelle generation pour l'immobilier.
