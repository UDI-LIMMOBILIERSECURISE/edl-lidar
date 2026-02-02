# EDL LIDAR - Instructions Claude Code

## Projet
- **Nom**: EDL LIDAR - Visites Virtuelles Immobilieres
- **Stack**: Next.js 14, Supabase, Gemini 2.0, Cloudflare R2
- **Repo**: https://github.com/UDI-LIMMOBILIERSECURISE/edl-lidar

## Epic 5 - COMPLETE
| Story | Description | Status |
|-------|-------------|--------|
| 5.1 | Upload video | Done |
| 5.2 | Analyse IA Gemini | Done |
| 5.2b | Cloudflare R2 | Done |
| 5.3 | Player video | Done |
| 5.4 | Annotations | Done |
| 5.5 | Chat Lia | Done |
| 5.6 | Publication/Partage | Done |
| 5.7 | Export Metre | Done |

## Architecture
```
src/
├── app/
│   ├── api/chat/          # Chat Lia (Gemini)
│   ├── api/upload/        # Presigned URLs R2
│   ├── api/tours/[id]/    # Index, Publish, Export
│   ├── tours/new/         # Creation visite
│   ├── tours/[id]/        # Detail + partage
│   └── v/[slug]/          # Page publique
├── components/
│   ├── TourPlayer.tsx
│   ├── LiaChat.tsx
│   └── PublicTourView.tsx
└── lib/
    ├── gemini.ts
    ├── r2.ts
    └── supabase.ts
```

## Commandes Dev
```bash
npm run dev      # Demarrer en local
npm run build    # Build production
```

## Prochaines etapes potentielles (Epic 6+)
- [ ] Authentification utilisateurs
- [ ] Dashboard admin
- [ ] Analytics visites
- [ ] Mode VR/360
- [ ] Integration calendrier visites
