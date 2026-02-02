# EDL LIDAR - Architecture Technique

> Documentation architecture complete de la plateforme de visites virtuelles immobilieres avec assistant IA.

**Version:** 1.0
**Date:** 02 fevrier 2026

---

## Stack Technique

| Couche | Technologie | Version | Usage |
|--------|-------------|---------|-------|
| **Frontend** | Next.js | 14.x | App Router, SSR/SSG |
| **UI** | React | 18.x | Composants |
| **Styling** | Tailwind CSS | 3.4.x | Utility-first CSS |
| **Language** | TypeScript | 5.3.x | Typage statique |
| **Backend** | Supabase | - | BaaS (Auth, DB, Storage) |
| **Database** | PostgreSQL | 15 | Base relationnelle |
| **Stockage Video** | Cloudflare R2 | - | S3-compatible, egress gratuit |
| **IA** | Google Gemini 2.0 Flash | - | Analyse video + Chat |
| **Paiements** | Stripe | - | Abonnements SaaS |
| **Deploiement** | Vercel | - | Edge deployment |

---

## Structure des Dossiers

```
web-app/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Routes authentification
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   └── forgot-password/
│   │   ├── api/                      # API Routes
│   │   │   ├── analytics/            # Analytics endpoints
│   │   │   │   ├── entity/
│   │   │   │   ├── export/
│   │   │   │   ├── session/
│   │   │   │   └── track/
│   │   │   ├── agencies/             # Gestion agences
│   │   │   │   └── [id]/
│   │   │   ├── chat/                 # API Chat Lia (Gemini)
│   │   │   ├── cron/                 # Jobs planifies
│   │   │   │   └── weekly-digest/
│   │   │   ├── invitations/          # Invitations equipe
│   │   │   │   └── [token]/accept/
│   │   │   ├── notifications/        # Notifications
│   │   │   │   ├── create/
│   │   │   │   └── preferences/
│   │   │   ├── stripe/               # Paiements
│   │   │   │   ├── checkout/
│   │   │   │   ├── portal/
│   │   │   │   └── webhook/
│   │   │   ├── tours/[id]/           # Operations sur les tours
│   │   │   │   ├── analytics/
│   │   │   │   ├── export/
│   │   │   │   ├── index/
│   │   │   │   └── publish/
│   │   │   ├── upload/               # Presigned URLs R2
│   │   │   └── usage/                # Quotas et usage
│   │   │       └── history/
│   │   ├── dashboard/                # Dashboard utilisateur
│   │   │   ├── agencies/
│   │   │   │   ├── new/
│   │   │   │   └── [id]/
│   │   │   ├── analytics/
│   │   │   ├── billing/
│   │   │   ├── notifications/
│   │   │   ├── settings/
│   │   │   │   └── notifications/
│   │   │   ├── team/
│   │   │   ├── tours/
│   │   │   └── usage/
│   │   ├── invite/[token]/           # Page acceptation invitation
│   │   ├── tours/                    # Gestion des visites
│   │   │   ├── new/
│   │   │   └── [id]/
│   │   │       ├── analytics/
│   │   │       └── export/
│   │   ├── v/[slug]/                 # Page publique visite
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/                   # Composants React
│   │   ├── analytics/                # Composants analytics
│   │   │   ├── AgencyComparison.tsx
│   │   │   ├── BarChart.tsx
│   │   │   ├── ExportButton.tsx
│   │   │   ├── LineChart.tsx
│   │   │   ├── PieChart.tsx
│   │   │   ├── StatsCard.tsx
│   │   │   └── TopToursTable.tsx
│   │   ├── AnalyticsTracker.tsx
│   │   ├── AuthProvider.tsx
│   │   ├── InviteModal.tsx
│   │   ├── LiaChat.tsx               # Chat assistant IA
│   │   ├── NotificationBell.tsx
│   │   ├── PricingCard.tsx
│   │   ├── PublicTourView.tsx
│   │   ├── QuotaCard.tsx
│   │   ├── TourPlayer.tsx            # Player video
│   │   └── UsageAlert.tsx
│   ├── lib/                          # Bibliotheques utilitaires
│   │   ├── analytics.ts              # Tracking RGPD compliant
│   │   ├── gemini.ts                 # Client Google Gemini
│   │   ├── notifications.ts          # Gestion notifications
│   │   ├── permissions.ts            # Controle acces
│   │   ├── plans.ts                  # Definition plans tarifaires
│   │   ├── r2.ts                     # Client Cloudflare R2
│   │   ├── stripe.ts                 # Client Stripe
│   │   ├── supabase.ts               # Client Supabase browser
│   │   └── supabase-server.ts        # Client Supabase server
│   ├── middleware.ts                 # Middleware Next.js
│   └── types/
│       └── database.ts               # Types Supabase generes
├── public/
├── .env.local                        # Variables d'environnement
├── next.config.js
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## Flux de Donnees

### 1. Flux Upload Video

```
┌─────────────────────────────────────────────────────────────────┐
│  UTILISATEUR                                                     │
│  Selectionne video (jusqu'a 5GB)                                │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  API /api/upload                                                 │
│  - Valide type fichier (mp4, mov, webm, avi)                    │
│  - Genere cle unique (videos/{timestamp}-{random}.ext)          │
│  - Cree presigned URL pour upload direct R2                     │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  CLOUDFLARE R2                                                   │
│  - Upload direct (PUT presigned URL)                            │
│  - Stockage illimite, egress gratuit                            │
│  - CDN global (300+ datacenters)                                │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  SUPABASE                                                        │
│  - Cree entree virtual_tours                                    │
│  - Stocke video_url (reference R2)                              │
│  - Status: 'processing'                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Flux Indexation IA (Gemini)

```
┌─────────────────────────────────────────────────────────────────┐
│  DECLENCHEUR                                                     │
│  POST /api/tours/[id]/index                                     │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  TELECHARGEMENT VIDEO                                            │
│  - Genere presigned URL R2 si necessaire                        │
│  - Telecharge video en memoire                                  │
│  - Convertit en base64                                          │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  GOOGLE GEMINI 2.0 Flash                                         │
│  - Analyse video complete                                       │
│  - Detecte les pieces (entree, salon, cuisine, etc.)           │
│  - Retourne JSON avec timecodes debut/fin par piece            │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  SUPABASE                                                        │
│  - Supprime anciennes tour_rooms                                │
│  - Insere nouvelles pieces detectees                            │
│  - Met a jour virtual_tours: status='ready', ai_indexed=true   │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Flux Chat Lia

```
┌─────────────────────────────────────────────────────────────────┐
│  VISITEUR                                                        │
│  Envoie message: "Montre-moi la cuisine"                        │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  API /api/chat                                                   │
│  - Recupere tourIndex (pieces, annotations)                     │
│  - Construit prompt systeme avec contexte du bien               │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  GOOGLE GEMINI 2.0 Flash                                         │
│  - Analyse la requete                                           │
│  - Identifie l'intention (navigation, info, etc.)              │
│  - Genere reponse JSON structuree                               │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  REPONSE                                                         │
│  {                                                               │
│    "message": "Voici la cuisine...",                            │
│    "action": "seek",                                            │
│    "timecode": 45                                               │
│  }                                                               │
│  → TourPlayer navigue automatiquement vers le timecode          │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Flux Paiement Stripe

```
┌─────────────────────────────────────────────────────────────────┐
│  UTILISATEUR (entity_admin)                                      │
│  Clique "Upgrade vers Pro"                                      │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  API /api/stripe/checkout                                        │
│  - Verifie authentification                                     │
│  - Verifie role entity_admin                                    │
│  - Cree Stripe Checkout Session                                 │
│  - Retourne URL de paiement                                     │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  STRIPE CHECKOUT                                                 │
│  - Affiche formulaire paiement                                  │
│  - Collecte carte bancaire                                      │
│  - Traite paiement                                              │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  WEBHOOK /api/stripe/webhook                                     │
│  - checkout.session.completed → Met a jour plan entite          │
│  - customer.subscription.updated → Sync plan                    │
│  - customer.subscription.deleted → Downgrade vers free          │
│  - invoice.payment_failed → Log + notification                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Schema Base de Donnees

### Tables Principales

#### `virtual_tours`
Stocke les visites virtuelles.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Cle primaire |
| edl_id | uuid | Reference EDL (optionnel) |
| title | text | Titre de la visite |
| address | text | Adresse du bien |
| property_type | enum | apartment, house, commercial, other |
| tour_type | enum | sale, rent, edl |
| status | enum | processing, ready, error |
| video_url | text | URL video sur R2 |
| video_duration_seconds | integer | Duree video |
| thumbnail_url | text | URL miniature |
| has_lidar | boolean | Donnees LiDAR disponibles |
| total_surface_m2 | numeric | Surface totale |
| ai_indexed | boolean | Indexation IA effectuee |
| ai_index_version | text | Version modele IA utilise |
| public_slug | text | Slug pour URL publique |
| is_public | boolean | Visite publiee |
| published_at | timestamp | Date publication |
| user_id | uuid | Proprietaire |
| created_at | timestamp | Date creation |
| updated_at | timestamp | Date modification |

#### `tour_rooms`
Pieces detectees dans une visite.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Cle primaire |
| tour_id | uuid | Reference virtual_tours |
| name | text | Nom de la piece |
| room_type | text | Type (entrance, kitchen, etc.) |
| floor_number | integer | Etage |
| start_time | numeric | Timecode debut (secondes) |
| end_time | numeric | Timecode fin (secondes) |
| floor_surface_m2 | numeric | Surface sol |
| wall_surface_m2 | numeric | Surface murs |
| ceiling_surface_m2 | numeric | Surface plafond |
| ceiling_height_m | numeric | Hauteur sous plafond |
| volume_m3 | numeric | Volume |
| detection_method | enum | roomplan, voice, gemini, manual |
| detection_confidence | numeric | Confiance detection (0-1) |
| display_order | integer | Ordre affichage |
| created_at | timestamp | Date creation |

#### `tour_annotations`
Annotations sur une visite.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Cle primaire |
| tour_id | uuid | Reference virtual_tours |
| room_id | uuid | Reference tour_rooms (optionnel) |
| text | text | Contenu annotation |
| annotation_type | enum | observation, defect, feature |
| timecode | numeric | Position video (secondes) |
| position_x/y/z | numeric | Position 3D (optionnel) |
| photo_url | text | Photo jointe |
| created_at | timestamp | Date creation |

### Tables Multi-tenant

#### `entities`
Entites (organisations/entreprises).

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Cle primaire |
| name | text | Nom de l'entite |
| slug | text | Identifiant unique URL |
| plan | enum | free, starter, pro, enterprise |
| max_users | integer | Limite utilisateurs |
| max_tours | integer | Limite visites |
| max_storage_gb | integer | Limite stockage |
| settings | jsonb | Configuration |
| logo_url | text | Logo |
| stripe_customer_id | text | ID client Stripe |
| stripe_subscription_id | text | ID abonnement Stripe |
| created_at | timestamp | Date creation |
| updated_at | timestamp | Date modification |

#### `agencies`
Agences au sein d'une entite.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Cle primaire |
| entity_id | uuid | Reference entities |
| name | text | Nom de l'agence |
| address | text | Adresse |
| phone | text | Telephone |
| created_at | timestamp | Date creation |

#### `user_profiles`
Profils utilisateurs.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Cle primaire (= auth.users.id) |
| entity_id | uuid | Reference entities |
| role | enum | entity_admin, agency_manager, agent |
| agency_ids | uuid[] | Agences assignees |
| display_name | text | Nom affiche |
| avatar_url | text | Avatar |
| phone | text | Telephone |
| created_at | timestamp | Date creation |
| updated_at | timestamp | Date modification |

#### `invitations`
Invitations d'equipe.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Cle primaire |
| entity_id | uuid | Reference entities |
| email | text | Email invite |
| role | enum | entity_admin, agency_manager, agent |
| agency_ids | uuid[] | Agences pre-assignees |
| invited_by | uuid | Utilisateur invitant |
| token | text | Token unique invitation |
| expires_at | timestamp | Expiration |
| accepted_at | timestamp | Date acceptation |
| created_at | timestamp | Date creation |

### Tables Analytics

#### `tour_views`
Sessions de visionnage.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Cle primaire |
| tour_id | uuid | Reference virtual_tours |
| visitor_id | text | ID visiteur anonyme |
| session_id | text | ID session |
| started_at | timestamp | Debut session |
| ended_at | timestamp | Fin session |
| duration_seconds | integer | Duree totale |
| rooms_visited | text[] | Pieces visitees |
| device_type | enum | desktop, mobile, tablet, unknown |
| user_agent | text | User agent |
| referrer | text | Source du trafic |
| utm_source/medium/campaign | text | Parametres UTM |
| country | text | Pays |
| city | text | Ville |
| is_bot | boolean | Detection bot |
| created_at | timestamp | Date creation |

#### `tour_events`
Evenements granulaires.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Cle primaire |
| view_id | uuid | Reference tour_views |
| event_type | enum | room_enter, lia_open, play, etc. |
| event_data | jsonb | Donnees evenement |
| timestamp | timestamp | Date evenement |

### Tables Chat Lia

#### `lia_sessions`
Sessions de conversation avec Lia.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Cle primaire |
| tour_id | uuid | Reference virtual_tours |
| visitor_id | text | ID visiteur |
| started_at | timestamp | Debut |
| ended_at | timestamp | Fin |
| message_count | integer | Nombre de messages |
| rooms_visited | text[] | Pieces visitees via chat |
| total_watch_time_seconds | integer | Temps total |

#### `lia_messages`
Messages individuels.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Cle primaire |
| session_id | uuid | Reference lia_sessions |
| role | enum | user, assistant |
| content | text | Contenu message |
| action_type | enum | seek, info, staging |
| action_data | jsonb | Donnees action |
| model_used | text | Modele IA utilise |
| tokens_used | integer | Tokens consommes |
| cost_usd | numeric | Cout |
| created_at | timestamp | Date creation |

### Tables Usage & Quotas

#### `usage_monthly`
Usage mensuel par entite.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Cle primaire |
| entity_id | uuid | Reference entities |
| month | text | Mois (YYYY-MM) |
| tours_created | integer | Visites creees |
| lia_views | integer | Vues Lia |
| storage_bytes | bigint | Stockage utilise |
| created_at | timestamp | Date creation |
| updated_at | timestamp | Date modification |

---

## Types Enum

| Enum | Valeurs |
|------|---------|
| property_type | apartment, house, commercial, other |
| tour_type | sale, rent, edl |
| tour_status | processing, ready, error |
| user_role | entity_admin, agency_manager, agent |
| plan_type | free, starter, pro, enterprise |
| detection_method | roomplan, voice, gemini, manual |
| annotation_type | observation, defect, feature |
| lia_action | seek, info, staging |
| device_type | desktop, mobile, tablet, unknown |
| event_type | room_enter, room_exit, lia_open, lia_close, lia_message, share_click, fullscreen, play, pause, seek, video_end, heartbeat |

---

## Composants Principaux

### TourPlayer.tsx
Player video avec timeline et navigation par pieces.

**Fonctionnalites:**
- Lecture video HTML5 (Video.js)
- Support HLS streaming
- Timeline avec marqueurs de pieces
- Navigation par clic sur piece
- Mode plein ecran
- Qualite adaptative

### LiaChat.tsx
Interface de chat avec l'assistant IA Lia.

**Fonctionnalites:**
- Input texte avec envoi
- Historique conversation
- Actions automatiques (seek vers timecode)
- Indicateur de chargement
- Reponses en francais

### PublicTourView.tsx
Wrapper coordinant player et chat pour les visiteurs publics.

**Fonctionnalites:**
- Coordination player/chat
- Tracking analytics
- Gestion session visiteur

### AnalyticsTracker.tsx
Composant de tracking RGPD compliant.

**Fonctionnalites:**
- Generation visitor ID anonyme
- Tracking evenements (play, pause, room_enter, etc.)
- Heartbeat periodique
- Graceful degradation si bloqueur pub

---

## Securite

### Row Level Security (RLS)
Toutes les tables sensibles sont protegees par RLS Supabase:

- **entities**: Acces limite aux membres de l'entite
- **user_profiles**: Acces limite a son propre profil ou membres meme entite (admin)
- **agencies**: Acces limite a l'entite parente
- **virtual_tours**: Acces limite au proprietaire ou membres meme entite
- **invitations**: Acces limite a l'entite

### Roles et Permissions

| Action | entity_admin | agency_manager | agent |
|--------|--------------|----------------|-------|
| Gerer utilisateurs | X | Agence seulement | - |
| Creer agences | X | - | - |
| Gerer facturation | X | - | - |
| Creer tours | X | X | X |
| Voir tous tours entite | X | Agence seulement | Siens |
| Publier tours | X | X | X |

### Authentification
- Supabase Auth (email/password)
- JWT tokens
- Session cookies securises

---

## Performance

### Optimisations
- **Video**: Stockage R2 avec CDN global Cloudflare
- **Images**: Next.js Image optimization
- **API**: Edge Functions pour latence reduite
- **Base de donnees**: Index sur entity_id, tour_id, user_id
- **Frontend**: Code splitting automatique Next.js

### Metriques cibles
- Time to First Byte (TTFB): < 200ms
- Largest Contentful Paint (LCP): < 2.5s
- Video load time: < 3s

---

## Monitoring

### Logs
- Vercel Logs pour les API routes
- Supabase Logs pour les requetes DB
- Console.warn pour erreurs analytics (graceful)

### Alertes
- Stripe webhooks failures
- Erreurs Gemini API
- Quotas proches (>80%)

---

*Documentation generee le 02 fevrier 2026*
