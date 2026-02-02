# EDL LIDAR - TODO & Completion Status

> Suivi de l'avancement du projet EDL LIDAR.

**Date mise a jour:** 02 fevrier 2026

---

## Epics Completes

### Epic 5 - Visite Virtuelle IA

| ID | Story | SP | Status | Notes |
|----|-------|---:|--------|-------|
| 5.1 | Infrastructure Web & API | 8 | Done | Next.js 14, Supabase, structure projet |
| 5.2 | Upload video | 5 | Done | Support jusqu'a 5GB |
| 5.2b | Integration Cloudflare R2 | 5 | Done | Egress gratuit, presigned URLs |
| 5.3 | Indexation IA (Gemini) | 8 | Done | Detection automatique des pieces |
| 5.4 | Player video avec timeline | 5 | Done | Video.js, marqueurs pieces |
| 5.5 | Chat Lia (assistant IA) | 8 | Done | Gemini 2.0 Flash, navigation auto |
| 5.6 | Publication & Partage | 3 | Done | Slug unique, iframe embed |
| 5.7 | Export Metre PDF | 5 | Done | Surfaces sol/murs/plafond |

**Total Epic 5:** 47 SP - **100% Complete**

---

### Epic 6 - Multi-tenant & Authentification

| ID | Story | SP | Status | Notes |
|----|-------|---:|--------|-------|
| MT-1 | Structure multi-tenant | 8 | Done | Tables entities, agencies, user_profiles |
| MT-2 | Inscription entite | 5 | Done | Flow signup + creation entite |
| MT-3 | Authentification | 3 | Done | Supabase Auth, cookies SSR |
| MT-4 | Gestion utilisateurs | 5 | Done | CRUD users, invitations |
| MT-5 | Gestion agences | 5 | Done | CRUD agencies, assignation users |
| MT-6 | Dashboard quotas | 5 | Done | Usage vs limites, alertes |
| MT-7 | RLS Policies | 8 | Done | Isolation complete tenant |
| MT-8 | Upgrade plan (Stripe) | 5 | Done | Checkout, Portal, Webhooks |

**Total Epic 6:** 44 SP - **100% Complete**

---

### Epic 7 - Analytics & Notifications

| ID | Story | SP | Status | Notes |
|----|-------|---:|--------|-------|
| 7.1 | Tracking visiteurs RGPD | 5 | Done | Anonyme, graceful degradation |
| 7.2 | Dashboard analytics | 8 | Done | Stats, charts, filtres |
| 7.3 | Export CSV/JSON | 3 | Done | Download analytics |
| 7.4 | Notifications in-app | 5 | Done | Bell icon, liste, mark read |
| 7.5 | Preferences notifications | 3 | Done | Choix canaux, thresholds |
| 7.6 | Digest hebdomadaire | 3 | Done | Cron job, email (prepare) |

**Total Epic 7:** 27 SP - **100% Complete**

---

## Epics Planifies (Non commences)

### Epic 8 - Detection Materiaux IA

| ID | Story | SP | Status | Notes |
|----|-------|---:|--------|-------|
| 6.1 | Detection materiaux IA | 8 | Planned | Gemini Vision, sols/murs/plafonds |
| 6.2 | Export metres multi-format | 5 | Planned | JSON, XML, Excel, PDF |
| 6.3 | Export DXF/IFC (CAO/BIM) | 8 | Planned | AutoCAD, Revit compatible |
| 6.4 | API integrations metiers | 13 | Planned | REST, OAuth, SDK |
| 6.5 | Rapport PDF diagnostiqueur | 5 | Planned | Format norme metier |

**Total Epic 8:** 39 SP - **0% Complete**

---

## Backlog Technique

| Priorite | Item | Status | Notes |
|----------|------|--------|-------|
| P1 | Tests E2E Playwright | Pending | Scenarios critiques |
| P1 | CI/CD pipeline | Pending | GitHub Actions |
| P2 | Monitoring Sentry | Pending | Error tracking |
| P2 | Rate limiting Redis | Pending | Protection API |
| P2 | Cache CDN | Pending | Optimisation perfs |
| P3 | Mode offline PWA | Pending | Service workers |
| P3 | App mobile React Native | Pending | Capture LiDAR |

---

## Documentation

| Document | Status | Path |
|----------|--------|------|
| README.md | Done | `/web-app/README.md` |
| ARCHITECTURE.md | Done | `/docs/ARCHITECTURE.md` |
| API-REFERENCE.md | Done | `/docs/API-REFERENCE.md` |
| DATABASE-SCHEMA.md | Done | `/docs/DATABASE-SCHEMA.md` |
| DEPLOYMENT.md | Done | `/docs/DEPLOYMENT.md` |
| TODO-COMPLETION.md | Done | `/docs/TODO-COMPLETION.md` |
| Epic 5 specs | Done | `/docs/epic-5-visite-virtuelle-ia.md` |
| Epic 6 specs | Done | `/docs/epic-6-diagnostiqueur-export.md` |
| Multi-tenant specs | Done | `/docs/stories/epic-6-multi-tenant-auth.md` |

---

## Metriques Projet

| Metrique | Valeur |
|----------|--------|
| **Total Story Points (completes)** | 118 SP |
| **Total Story Points (planifies)** | 39 SP |
| **Fichiers source** | ~60 fichiers |
| **Tables database** | 14 tables |
| **API endpoints** | ~25 endpoints |
| **Composants React** | ~20 composants |

---

## Changelog Recent

### 2026-02-02
- Documentation technique complete (ARCHITECTURE, API, DEPLOYMENT, DATABASE)
- Mise a jour README avec tous les epics

### 2026-01-XX
- Epic 7 complete (Analytics & Notifications)
- Epic 6 complete (Multi-tenant & Auth)
- Epic 5 complete (Visite Virtuelle IA)

---

## Prochaines Etapes

1. **Deploiement production** - Suivre guide DEPLOYMENT.md
2. **Tests E2E** - Couvrir scenarios critiques
3. **Epic 8** - Detection materiaux IA (cible: Mars 2026)

---

*Derniere mise a jour: 02 fevrier 2026*
