# EDL LIDAR - API Reference

> Documentation complete de l'API REST EDL LIDAR.

**Base URL:** `https://[votre-domaine]/api`
**Version:** 1.0
**Date:** 02 fevrier 2026

---

## Authentification

La plupart des endpoints necessitent une authentification via Bearer token.

```bash
Authorization: Bearer <supabase_access_token>
```

Les tokens sont obtenus via Supabase Auth apres connexion.

---

## Endpoints

### Upload

#### POST /api/upload
Genere une URL presignee pour upload direct vers Cloudflare R2.

**Authentification:** Optionnel (recommande)

**Request Body:**
```json
{
  "filename": "visite-appartement.mp4",
  "contentType": "video/mp4"
}
```

**Parametres:**
| Parametre | Type | Requis | Description |
|-----------|------|--------|-------------|
| filename | string | Oui | Nom du fichier |
| contentType | string | Oui | Type MIME du fichier |

**Content-Types supportes:**
- `video/mp4`
- `video/quicktime`
- `video/webm`
- `video/x-msvideo`

**Response 200:**
```json
{
  "uploadUrl": "https://xxx.r2.cloudflarestorage.com/bucket/...",
  "publicUrl": "https://cdn.example.com/videos/1706886400-abc123.mp4",
  "key": "videos/1706886400-abc123.mp4"
}
```

**Response 400:**
```json
{
  "error": "Type de fichier non supporte"
}
```

**Utilisation:**
```javascript
// 1. Obtenir URL presignee
const { uploadUrl, publicUrl, key } = await fetch('/api/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ filename: file.name, contentType: file.type })
}).then(r => r.json());

// 2. Upload direct vers R2
await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': file.type }
});

// 3. publicUrl est maintenant accessible
```

---

### Tours

#### POST /api/tours/[id]/index
Declenche l'indexation IA d'une visite (detection des pieces).

**Authentification:** Requise

**URL Params:**
| Parametre | Type | Description |
|-----------|------|-------------|
| id | uuid | ID de la visite |

**Request Body:** Aucun

**Response 200:**
```json
{
  "success": true,
  "rooms": [
    {
      "name": "Entree",
      "type": "entrance",
      "start_time": 0,
      "end_time": 15,
      "description": "Hall d'entree avec placard"
    },
    {
      "name": "Salon",
      "type": "living_room",
      "start_time": 15,
      "end_time": 45,
      "description": "Grand salon lumineux"
    }
  ],
  "total_duration": 120,
  "property_type": "apartment",
  "notes": "Appartement T3 bien agence"
}
```

**Response 404:**
```json
{
  "error": "Tour non trouve"
}
```

**Response 500:**
```json
{
  "error": "Erreur lors de l'indexation",
  "details": "..."
}
```

**Types de pieces detectees:**
- entrance
- living_room
- kitchen
- bedroom
- bathroom
- toilet
- office
- dining_room
- hallway
- storage
- laundry
- balcony
- garage
- garden
- other

---

#### GET /api/tours/[id]/index
Recupere le statut d'indexation d'une visite.

**Authentification:** Requise

**Response 200:**
```json
{
  "status": "ready",
  "ai_indexed": true,
  "ai_index_version": "gemini-2.0-flash",
  "rooms_count": 5,
  "rooms": [
    {
      "id": "uuid",
      "tour_id": "uuid",
      "name": "Salon",
      "room_type": "living_room",
      "start_time": 0,
      "end_time": 45,
      "display_order": 0,
      "detection_method": "gemini",
      "detection_confidence": 0.85
    }
  ]
}
```

---

#### POST /api/tours/[id]/publish
Publie une visite et genere un lien public.

**Authentification:** Requise

**Response 200:**
```json
{
  "success": true,
  "public_slug": "aBc123XyZ0",
  "already_published": false
}
```

La visite est accessible a `/v/[public_slug]`.

---

#### DELETE /api/tours/[id]/publish
Depublie une visite.

**Authentification:** Requise

**Response 200:**
```json
{
  "success": true
}
```

---

#### GET /api/tours/[id]/export
Exporte les metres d'une visite.

**Authentification:** Requise

**Response 200:**
```json
{
  "tour": {
    "id": "uuid",
    "title": "Appartement Paris 11",
    "address": "15 rue de la Roquette, 75011 Paris",
    "property_type": "apartment",
    "has_lidar": true,
    "total_surface_m2": 65.5
  },
  "rooms": [
    {
      "name": "Salon",
      "type": "living_room",
      "floor_m2": 25.3,
      "walls_m2": 48.2,
      "ceiling_m2": 25.3,
      "ceiling_height_m": 2.5,
      "volume_m3": 63.25
    }
  ],
  "totals": {
    "floor_m2": 65.5,
    "walls_m2": 142.8,
    "ceiling_m2": 65.5
  },
  "generated_at": "2026-02-02T12:00:00Z"
}
```

---

#### GET /api/tours/[id]/analytics
Recupere les analytics d'une visite.

**Authentification:** Requise

**Query Params:**
| Parametre | Type | Default | Description |
|-----------|------|---------|-------------|
| period | string | 30d | Periode (7d, 30d, 90d, all) |

**Response 200:**
```json
{
  "total_views": 156,
  "unique_visitors": 89,
  "avg_duration_seconds": 145,
  "top_rooms": [
    { "name": "Salon", "visits": 78 },
    { "name": "Cuisine", "visits": 65 }
  ],
  "device_breakdown": {
    "desktop": 45,
    "mobile": 38,
    "tablet": 6
  },
  "referrers": [
    { "source": "direct", "count": 34 },
    { "source": "seloger.com", "count": 22 }
  ],
  "views_by_day": [
    { "date": "2026-01-15", "views": 12 },
    { "date": "2026-01-16", "views": 8 }
  ]
}
```

---

### Chat Lia

#### POST /api/chat
Envoie un message a l'assistant IA Lia.

**Authentification:** Non requise (visiteurs publics)

**Request Body:**
```json
{
  "tourId": "uuid",
  "message": "Montre-moi la cuisine",
  "history": [
    { "role": "user", "content": "Bonjour" },
    { "role": "assistant", "content": "Bonjour ! Comment puis-je vous aider ?" }
  ],
  "tourIndex": { /* optionnel, construit automatiquement si absent */ },
  "rooms": [ /* optionnel, liste des pieces */ ],
  "currentRoom": "Salon"
}
```

**Parametres:**
| Parametre | Type | Requis | Description |
|-----------|------|--------|-------------|
| tourId | uuid | Oui | ID de la visite |
| message | string | Oui | Message utilisateur |
| history | array | Non | Historique conversation |
| tourIndex | object | Non | Index complet de la visite |
| rooms | array | Non | Liste simplifiee des pieces |
| currentRoom | string | Non | Piece actuellement affichee |

**Response 200:**
```json
{
  "message": "Bien sur ! Je vous emmene dans la cuisine. C'est une piece de 12m2 avec un plan de travail en granit.",
  "action": "seek",
  "timecode": 45.5,
  "data": {
    "room": "Cuisine"
  }
}
```

**Actions possibles:**
| Action | Description |
|--------|-------------|
| null | Reponse informative sans action |
| seek | Naviguer vers un timecode video |
| info | Afficher des informations supplementaires |
| staging | Proposer un home staging virtuel (V2) |

**Response 500:**
```json
{
  "message": "Desolee, je rencontre un probleme technique. Reessayez dans un instant.",
  "action": null
}
```

---

### Agencies

#### GET /api/agencies
Liste les agences de l'entite de l'utilisateur.

**Authentification:** Requise

**Response 200:**
```json
{
  "agencies": [
    {
      "id": "uuid",
      "entity_id": "uuid",
      "name": "Agence Paris 11",
      "address": "15 rue de la Roquette, 75011 Paris",
      "phone": "01 23 45 67 89",
      "created_at": "2026-01-01T00:00:00Z",
      "user_count": 5,
      "tour_count": 23
    }
  ],
  "profile": {
    "id": "uuid",
    "entity_id": "uuid",
    "role": "entity_admin",
    "agency_ids": []
  }
}
```

---

#### POST /api/agencies
Cree une nouvelle agence.

**Authentification:** Requise
**Role requis:** entity_admin

**Request Body:**
```json
{
  "name": "Agence Paris 12",
  "address": "10 rue de Lyon, 75012 Paris",
  "phone": "01 98 76 54 32"
}
```

**Response 201:**
```json
{
  "agency": {
    "id": "uuid",
    "entity_id": "uuid",
    "name": "Agence Paris 12",
    "address": "10 rue de Lyon, 75012 Paris",
    "phone": "01 98 76 54 32",
    "created_at": "2026-02-02T12:00:00Z"
  }
}
```

**Response 403:**
```json
{
  "error": "Acces refuse. Seul un administrateur peut creer des agences."
}
```

---

#### GET /api/agencies/[id]
Recupere les details d'une agence.

**Authentification:** Requise

---

#### PUT /api/agencies/[id]
Met a jour une agence.

**Authentification:** Requise
**Role requis:** entity_admin

---

#### DELETE /api/agencies/[id]
Supprime une agence.

**Authentification:** Requise
**Role requis:** entity_admin

---

### Invitations

#### POST /api/invitations
Cree une invitation pour un nouvel utilisateur.

**Authentification:** Requise
**Role requis:** entity_admin ou agency_manager

**Request Body:**
```json
{
  "email": "nouveau@agence.com",
  "role": "agent",
  "agency_ids": ["uuid1", "uuid2"]
}
```

**Response 201:**
```json
{
  "invitation": {
    "id": "uuid",
    "token": "abc123xyz",
    "email": "nouveau@agence.com",
    "role": "agent",
    "expires_at": "2026-02-09T12:00:00Z"
  },
  "invite_url": "https://example.com/invite/abc123xyz"
}
```

---

#### POST /api/invitations/[token]/accept
Accepte une invitation.

**Authentification:** Requise (nouvel utilisateur doit etre connecte)

**Response 200:**
```json
{
  "success": true,
  "entity_id": "uuid",
  "role": "agent"
}
```

**Response 400:**
```json
{
  "error": "Invitation expiree ou deja utilisee"
}
```

---

### Stripe (Paiements)

#### POST /api/stripe/checkout
Cree une session Stripe Checkout pour upgrade.

**Authentification:** Requise
**Role requis:** entity_admin

**Request Body:**
```json
{
  "priceId": "price_xxx",
  "plan": "pro"
}
```

**Response 200:**
```json
{
  "url": "https://checkout.stripe.com/pay/cs_xxx"
}
```

---

#### POST /api/stripe/portal
Cree une session Customer Portal Stripe.

**Authentification:** Requise
**Role requis:** entity_admin

**Response 200:**
```json
{
  "url": "https://billing.stripe.com/session/xxx"
}
```

---

#### POST /api/stripe/webhook
Webhook Stripe pour les evenements de paiement.

**Authentification:** Signature Stripe (stripe-signature header)

**Evenements geres:**
- `checkout.session.completed` - Upgrade reussi
- `customer.subscription.updated` - Modification abonnement
- `customer.subscription.deleted` - Annulation
- `invoice.payment_failed` - Echec paiement

---

### Usage

#### GET /api/usage
Recupere l'usage actuel de l'entite.

**Authentification:** Requise

**Response 200:**
```json
{
  "usage": {
    "totalTours": 45,
    "totalUsers": 8,
    "storageBytes": 5368709120,
    "liaViewsMonth": 234
  },
  "limits": {
    "maxTours": 200,
    "maxUsers": 25,
    "maxStorageGb": 100,
    "maxStorageBytes": 107374182400
  },
  "plan": "pro",
  "percentages": {
    "tours": 22,
    "users": 32,
    "storage": 5
  }
}
```

---

#### GET /api/usage/history
Recupere l'historique d'usage mensuel.

**Authentification:** Requise

**Query Params:**
| Parametre | Type | Default | Description |
|-----------|------|---------|-------------|
| months | number | 6 | Nombre de mois |

**Response 200:**
```json
{
  "history": [
    {
      "month": "2026-01",
      "tours_created": 12,
      "lia_views": 89,
      "storage_bytes": 5368709120
    },
    {
      "month": "2026-02",
      "tours_created": 8,
      "lia_views": 145,
      "storage_bytes": 6442450944
    }
  ]
}
```

---

### Analytics

#### POST /api/analytics/session
Cree une session de vue pour tracking.

**Authentification:** Non requise

**Request Body:**
```json
{
  "tourId": "uuid",
  "visitorId": "v_abc123_xyz",
  "deviceType": "desktop",
  "userAgent": "Mozilla/5.0...",
  "referrer": "https://seloger.com",
  "utmSource": "seloger",
  "utmMedium": "cpc",
  "utmCampaign": "paris-11"
}
```

**Response 200:**
```json
{
  "viewId": "uuid"
}
```

---

#### POST /api/analytics/track
Enregistre des evenements de tracking.

**Authentification:** Non requise
**Rate Limit:** 120 requetes/minute/IP

**Request Body (single):**
```json
{
  "viewId": "uuid",
  "eventType": "room_enter",
  "data": {
    "roomId": "uuid",
    "roomName": "Salon",
    "videoTime": 15.5
  }
}
```

**Request Body (batch):**
```json
[
  {
    "viewId": "uuid",
    "eventType": "play",
    "data": { "videoTime": 0 }
  },
  {
    "viewId": "uuid",
    "eventType": "room_enter",
    "data": { "roomName": "Entree" }
  }
]
```

**Types d'evenements:**
| Type | Description |
|------|-------------|
| room_enter | Entree dans une piece |
| room_exit | Sortie d'une piece |
| lia_open | Ouverture chat Lia |
| lia_close | Fermeture chat Lia |
| lia_message | Message envoye a Lia |
| share_click | Clic sur partage |
| fullscreen | Passage en plein ecran |
| play | Lecture video |
| pause | Pause video |
| seek | Navigation dans la video |
| video_end | Fin de la video |
| heartbeat | Heartbeat periodique |

**Response 200:**
```json
{
  "success": true,
  "tracked": 2
}
```

**Response 429:**
```json
{
  "error": "Too many requests"
}
```

---

#### GET /api/analytics/entity
Recupere les analytics au niveau entite.

**Authentification:** Requise

**Query Params:**
| Parametre | Type | Default | Description |
|-----------|------|---------|-------------|
| period | string | 30d | Periode |

---

#### GET /api/analytics/export
Exporte les analytics en CSV.

**Authentification:** Requise

**Query Params:**
| Parametre | Type | Default | Description |
|-----------|------|---------|-------------|
| format | string | csv | Format (csv, json) |
| period | string | 30d | Periode |

---

### Notifications

#### GET /api/notifications
Liste les notifications de l'utilisateur.

**Authentification:** Requise

**Query Params:**
| Parametre | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 20 | Nombre max |
| offset | number | 0 | Offset pagination |
| unread_only | boolean | false | Filtrer non lues |
| type | string | - | Filtrer par type |

**Response 200:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "entity_id": "uuid",
      "type": "new_visitor",
      "title": "Nouvelle visite !",
      "message": "Votre visite 'Appartement Paris 11' a ete vue par un visiteur.",
      "data": { "tourId": "uuid", "visitorCount": 1 },
      "link": "/tours/uuid/analytics",
      "read_at": null,
      "created_at": "2026-02-02T12:00:00Z"
    }
  ],
  "total": 15,
  "unreadCount": 3,
  "limit": 20,
  "offset": 0
}
```

**Types de notifications:**
| Type | Description |
|------|-------------|
| new_visitor | Nouveau visiteur sur une visite |
| milestone_views | Palier de vues atteint |
| lia_question | Question posee a Lia |
| weekly_digest | Resume hebdomadaire |
| quota_warning | Alerte quota proche |
| team_invite | Invitation equipe |
| tour_published | Visite publiee |
| system | Notification systeme |

---

#### POST /api/notifications
Actions sur les notifications.

**Authentification:** Requise

**Request Body (mark_read):**
```json
{
  "action": "mark_read",
  "notification_id": "uuid"
}
```

**Request Body (mark_all_read):**
```json
{
  "action": "mark_all_read"
}
```

**Response 200:**
```json
{
  "success": true,
  "count": 5
}
```

---

#### DELETE /api/notifications
Supprime une notification.

**Authentification:** Requise

**Request Body:**
```json
{
  "notification_id": "uuid"
}
```

---

#### GET /api/notifications/preferences
Recupere les preferences de notification.

**Authentification:** Requise

---

#### PUT /api/notifications/preferences
Met a jour les preferences de notification.

**Authentification:** Requise

**Request Body:**
```json
{
  "app_new_visitor": true,
  "app_milestone_views": true,
  "email_weekly_digest": true,
  "threshold_views": 100
}
```

---

### Cron Jobs

#### GET /api/cron/weekly-digest
Declenche l'envoi du digest hebdomadaire.

**Authentification:** Cron secret ou service account

**Header:**
```
Authorization: Bearer <CRON_SECRET>
```

---

## Codes d'Erreur

| Code | Description |
|------|-------------|
| 400 | Bad Request - Parametres invalides |
| 401 | Unauthorized - Non authentifie |
| 403 | Forbidden - Permissions insuffisantes |
| 404 | Not Found - Ressource non trouvee |
| 429 | Too Many Requests - Rate limit atteint |
| 500 | Internal Server Error - Erreur serveur |

## Format Erreur Standard

```json
{
  "error": "Description de l'erreur",
  "details": "Details techniques (optionnel)"
}
```

---

## Rate Limiting

| Endpoint | Limite |
|----------|--------|
| /api/analytics/track | 120 req/min/IP |
| /api/chat | 30 req/min/user |
| /api/* (general) | 1000 req/jour/user |

---

## CORS

Les endpoints publics (analytics, chat) supportent CORS:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

---

*Documentation generee le 02 fevrier 2026*
