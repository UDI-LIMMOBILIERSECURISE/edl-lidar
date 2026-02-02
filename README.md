# EDL LIDAR - Visites Virtuelles Immobilieres

Application web de creation et partage de visites virtuelles pour l'immobilier avec assistant IA (Lia).

## Stack Technique

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **IA**: Google Gemini 2.0 Flash (analyse video, detection pieces)
- **Stockage Video**: Cloudflare R2 (S3-compatible, egress gratuit)

## Fonctionnalites (Epic 5)

| Story | Description | Status |
|-------|-------------|--------|
| 5.1 | Upload video | Done |
| 5.2 | Analyse IA Gemini (detection pieces) | Done |
| 5.2b | Integration Cloudflare R2 (uploads illimites) | Done |
| 5.3 | Player video avec timeline | Done |
| 5.4 | Interface d'annotation | Done |
| 5.5 | Chat Lia (assistant IA) | Done |
| 5.6 | Publication & Partage | Done |
| 5.7 | Export Metre | Done |

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── chat/           # API Chat Lia (Gemini)
│   │   ├── upload/         # Presigned URLs R2
│   │   └── tours/[id]/
│   │       ├── index/      # Indexation video (Gemini)
│   │       ├── publish/    # Publication/Depublication
│   │       └── export/     # Export metre
│   ├── tours/
│   │   ├── new/            # Creation visite
│   │   └── [id]/           # Detail visite + partage
│   └── v/[slug]/           # Page publique visite
├── components/
│   ├── TourPlayer.tsx      # Player video avec timeline
│   ├── LiaChat.tsx         # Chat assistant IA
│   └── PublicTourView.tsx  # Wrapper coordination player/chat
└── lib/
    ├── gemini.ts           # Client Gemini
    ├── r2.ts               # Client Cloudflare R2
    └── supabase.ts         # Client Supabase
```

## Configuration

Copier `.env.example` vers `.env.local` et configurer:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Gemini
GEMINI_API_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

## Installation

```bash
npm install
npm run dev
```

## Flux Utilisateur

1. **Upload** - Telecharger une video (jusqu'a 5GB via R2)
2. **Indexation** - Gemini analyse et detecte les pieces automatiquement
3. **Annotation** - Ajouter des annotations manuelles (optionnel)
4. **Publication** - Generer un lien public `/v/[slug]`
5. **Partage** - Copier le lien ou le code iframe embed
6. **Export** - Imprimer le metre des pieces en PDF

## Chat Lia

L'assistant IA Lia permet aux visiteurs de:
- Naviguer vers une piece ("Montre-moi la cuisine")
- Poser des questions sur le bien
- Obtenir des informations sur les surfaces

La navigation depuis le chat controle directement le player video.
