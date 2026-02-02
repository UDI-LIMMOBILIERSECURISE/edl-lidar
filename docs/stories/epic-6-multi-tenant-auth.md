# Epic 6: Multi-tenant & Authentification

## Objectif Business

Mettre en place une architecture multi-tenant securisee permettant a plusieurs entites (agences immobilieres, diagnostiqueurs) d'utiliser la plateforme EDL LIDAR de maniere isolee, avec gestion des utilisateurs, roles et quotas par plan tarifaire.

## Personas

| Persona | Description | Permissions |
|---------|-------------|-------------|
| **entity_admin** | Administrateur de l'entite (agence/entreprise) | Gestion complete: utilisateurs, agences, facturation, parametres |
| **agency_manager** | Responsable d'une agence | Gestion des agents de son agence, acces aux tours de son agence |
| **agent** | Utilisateur standard | Creation/consultation des tours assignes a son agence |

## Stories

| ID | Titre | SP | Priorite | Dependencies |
|----|-------|----|---------:|--------------|
| MT-1 | Structure multi-tenant | 8 | P0 | - |
| MT-2 | Inscription entite | 5 | P0 | MT-1 |
| MT-3 | Authentification | 3 | P0 | MT-1 |
| MT-4 | Gestion utilisateurs | 5 | P1 | MT-1, MT-3 |
| MT-5 | Gestion agences | 5 | P1 | MT-1, MT-3 |
| MT-6 | Dashboard quotas | 5 | P2 | MT-1, MT-3 |
| MT-7 | RLS Policies completes | 8 | P0 | MT-1 |
| MT-8 | Upgrade plan (Stripe) | 5 | P2 | MT-1, MT-6 |

**Total: 44 Story Points**

## Architecture Multi-tenant

```
Entity (tenant principal)
  |
  +-- Agencies[] (agences/sites)
  |     |
  |     +-- Tours[] (visites virtuelles)
  |
  +-- UserProfiles[] (utilisateurs)
        |
        +-- role: entity_admin | agency_manager | agent
        +-- agency_id: rattachement agence (optionnel pour admin)
```

## Definition of Done (Epic)

- [ ] Toutes les stories MT-1 a MT-8 completees
- [ ] Tests E2E multi-tenant passants
- [ ] Audit securite RLS valide
- [ ] Documentation API mise a jour
- [ ] Migration production deployee
- [ ] Monitoring quotas operationnel

## Risques identifies

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Fuite de donnees inter-tenant | Critique | RLS strict + audit securite |
| Performance RLS | Moyen | Index sur entity_id/agency_id |
| Complexite roles | Moyen | Matrice permissions claire |

## Criteres de succes

1. Isolation complete des donnees entre entites
2. Temps de login < 2s
3. Zero fuite de donnees dans les tests de penetration
4. UX fluide pour la gestion des utilisateurs

---
*Epic Owner: Product Owner*
*Tech Lead: Architecte*
*Sprint cible: S1-S2*
