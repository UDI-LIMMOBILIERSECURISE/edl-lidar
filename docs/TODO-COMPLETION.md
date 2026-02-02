# EDL LIDAR - TODO & Completion List

> **Derniere MAJ**: 2 fevrier 2026
> **Auteur**: BMad Orchestrator

---

## 1. CONFIGURATION REQUISE (Avant mise en prod)

### 1.1 Variables d'environnement (.env.local)

| Variable | Status | Description |
|----------|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | A configurer | URL projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | A configurer | Cle anonyme Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | A configurer | Cle service role |
| `GEMINI_API_KEY` | A configurer | Cle API Google Gemini |
| `R2_ACCOUNT_ID` | A configurer | ID compte Cloudflare |
| `R2_ACCESS_KEY_ID` | A configurer | Access key R2 |
| `R2_SECRET_ACCESS_KEY` | A configurer | Secret key R2 |
| `R2_BUCKET_NAME` | A configurer | Nom du bucket |
| `R2_PUBLIC_URL` | A configurer | URL publique R2 |
| `STRIPE_SECRET_KEY` | A configurer | Cle secrete Stripe |
| `STRIPE_WEBHOOK_SECRET` | A configurer | Secret webhook Stripe |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | A configurer | Cle publique Stripe |
| `STRIPE_PRICE_STARTER` | A creer | Price ID plan Starter |
| `STRIPE_PRICE_PRO` | A creer | Price ID plan Pro |

### 1.2 Stripe Dashboard

- [ ] Creer compte Stripe (ou utiliser existant)
- [ ] Creer produit "EDL LIDAR Starter" (29€/mois)
- [ ] Creer produit "EDL LIDAR Pro" (79€/mois)
- [ ] Configurer webhook: `https://[domain]/api/stripe/webhook`
- [ ] Events a ecouter: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- [ ] Recuperer les Price IDs et les mettre dans .env

### 1.3 Cloudflare R2

- [ ] Creer bucket R2 si pas fait
- [ ] Configurer CORS pour le domaine de prod
- [ ] Activer l'acces public si necessaire
- [ ] Creer API token avec permissions R2

### 1.4 Supabase

- [ ] Verifier que toutes les migrations sont appliquees (001-010)
- [ ] Configurer les templates d'email (invitation, reset password)
- [ ] Configurer le domaine d'envoi d'email (optionnel)
- [ ] Verifier les RLS policies en production

### 1.5 Google Gemini

- [ ] Creer projet Google Cloud
- [ ] Activer Gemini API
- [ ] Generer API key
- [ ] Configurer quotas si necessaire

---

## 2. TESTS A EFFECTUER

### 2.1 Flux d'authentification

- [ ] Inscription nouvel utilisateur → creation entity automatique
- [ ] Login / Logout
- [ ] Reset password
- [ ] Session persistante

### 2.2 Multi-tenant

- [ ] Verifier isolation des donnees entre entities
- [ ] Tester les 3 roles (entity_admin, agency_manager, agent)
- [ ] Verifier qu'un user ne voit pas les visites d'une autre entity

### 2.3 Invitations

- [ ] Invitation par email (entity_admin)
- [ ] Invitation par manager (seulement role agent)
- [ ] Acceptation invitation nouveau compte
- [ ] Acceptation invitation compte existant
- [ ] Expiration token (7 jours)

### 2.4 Agences

- [ ] CRUD agences (admin only)
- [ ] Assignation utilisateurs a une agence
- [ ] Blocage suppression si agence a des users

### 2.5 Visites virtuelles

- [ ] Upload video R2 (jusqu'a 5GB)
- [ ] Indexation Gemini (detection pieces)
- [ ] Player video avec navigation timeline
- [ ] Chat Lia fonctionnel
- [ ] Publication lien public
- [ ] Page publique /v/[slug]
- [ ] Export metre PDF

### 2.6 Analytics

- [ ] Tracking des vues sur pages publiques
- [ ] Tracking des interactions Lia
- [ ] Dashboard analytics par visite
- [ ] Verifier que les stats s'agregent correctement

### 2.7 Facturation

- [ ] Checkout Stripe vers plan Starter
- [ ] Checkout Stripe vers plan Pro
- [ ] Customer Portal (changer carte, annuler)
- [ ] Webhook: mise a jour du plan apres paiement
- [ ] Downgrade automatique si abonnement annule

---

## 3. STORIES RESTANTES (Epic 7)

| Story | Description | Status |
|-------|-------------|--------|
| AN-3 | Analytics globaux entity | TODO |
| AN-4 | Notifications et alertes | TODO |

### AN-3: Analytics globaux entity
- Dashboard `/dashboard/analytics` avec stats consolidees
- Top visites par vues
- Comparaison entre agences
- Export CSV des donnees
- Graphiques tendances

### AN-4: Notifications et alertes
- Notifications in-app (nouveau visiteur, seuil atteint)
- Email digest hebdomadaire
- Configuration preferences notifications
- Webhooks sortants (optionnel)

---

## 4. FONCTIONNALITES FUTURES (Backlog)

### Epic 8: App Mobile
- [ ] React Native app
- [ ] Capture video depuis l'app
- [ ] Scan QR pour ouvrir visite
- [ ] Push notifications

### Epic 9: Home Staging IA
- [ ] Integration API de staging (Midjourney/DALL-E)
- [ ] Upload photo piece vide
- [ ] Generation mobilier virtuel
- [ ] Galerie avant/apres

### Epic 10: Ameliorations Lia
- [ ] Text-to-Speech (ElevenLabs)
- [ ] Contexte enrichi (historique bien, quartier)
- [ ] FAQ auto-generee
- [ ] Mode vocal (Speech-to-Text)

### Epic 11: Integrations
- [ ] Export vers portails (SeLoger, LeBonCoin)
- [ ] Integration CRM immobilier
- [ ] Zapier/Make webhooks
- [ ] API publique documentee

### Epic 12: SSO Enterprise
- [ ] SAML/OIDC
- [ ] Auto-provisioning users
- [ ] Mapping roles depuis IdP

---

## 5. SECURITE & COMPLIANCE

### 5.1 A verifier

- [ ] Toutes les routes protegees par middleware
- [ ] RLS actif sur toutes les tables
- [ ] Pas de SUPABASE_SERVICE_ROLE_KEY expose cote client
- [ ] Rate limiting sur APIs publiques
- [ ] Validation des inputs (XSS, injection)

### 5.2 RGPD

- [ ] Page politique de confidentialite
- [ ] Banniere cookies (si analytics tiers)
- [ ] Export donnees utilisateur
- [ ] Suppression compte et donnees
- [ ] DPA avec sous-traitants (Supabase, Cloudflare, Stripe)

### 5.3 Audit

- [ ] Scan dependances (npm audit)
- [ ] Test penetration basique
- [ ] Revue code securite

---

## 6. DEPLOIEMENT

### 6.1 Checklist pre-prod

- [ ] Build sans erreurs (`npm run build`)
- [ ] Variables env configurees sur Vercel/hosting
- [ ] Domaine configure
- [ ] SSL/HTTPS actif
- [ ] Webhook Stripe pointe vers domaine prod
- [ ] CORS R2 configure pour domaine prod

### 6.2 Monitoring

- [ ] Logs d'erreurs (Sentry ou equivalent)
- [ ] Uptime monitoring
- [ ] Alertes si API down

---

## 7. DOCUMENTATION

### 7.1 A creer

- [ ] Guide utilisateur (PDF ou site)
- [ ] Documentation API (si API publique)
- [ ] FAQ support
- [ ] Videos tutoriels (optionnel)

### 7.2 Existante

- [x] README.md
- [x] CLAUDE.md
- [x] Stories Epic 6 dans /docs/stories/
- [x] Ce fichier TODO

---

## 8. RESUME PRIORITES

### Immediat (avant lancement)
1. Configurer toutes les variables .env
2. Creer produits Stripe
3. Tester le flux complet signup → visite → analytics
4. Deployer sur domaine de prod

### Court terme (semaine 1-2)
1. AN-3: Analytics globaux
2. AN-4: Notifications
3. Tests utilisateurs beta
4. Corrections bugs

### Moyen terme (mois 1-2)
1. App mobile basique
2. Ameliorations Lia (TTS)
3. Integrations portails

---

*Ce document sera mis a jour au fur et a mesure de l'avancement.*
