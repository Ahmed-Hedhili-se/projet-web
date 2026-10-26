# NeuroGrid — Contrat d'API

> **Source de vérité** : le backend implémente exactement ce document, le frontend l'appelle exactement.
> Toute modification est annoncée à l'autre membre de l'équipe **avant** d'être faite.

## Sommaire
1. [Conventions](#1-conventions)
2. [Objets communs](#2-objets-communs)
3. [Auth](#3-auth)
4. [GPU (public)](#4-gpu-public)
5. [Recommandation](#5-recommandation)
6. [Contact](#6-contact)
7. [Profil utilisateur](#7-profil-utilisateur)
8. [Locations utilisateur](#8-locations-utilisateur)
9. [Admin](#9-admin)
10. [Récapitulatif des routes](#10-récapitulatif-des-routes)

---

## 1. Conventions

| Sujet | Règle |
|---|---|
| URL de base | `http://localhost:3000/api` |
| Format | JSON (`Content-Type: application/json`) en entrée et en sortie |
| Authentification | header `Authorization: Bearer <token>` (JWT valable 24 h) |
| Rôles | **Public** (sans token) · **USER** (tout utilisateur connecté, y compris un admin) · **ADMIN** |
| Dates | chaînes ISO 8601 en UTC, ex. `"2026-11-02T09:00:00.000Z"` |
| Prix | nombres en dollars US avec 2 décimales max, ex. `3.2` |
| Identifiants | entiers (`1`, `2`, …) |
| Listes | pas de pagination ; chaque liste renvoie aussi `total` |

### Format d'erreur (identique pour toutes les routes)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data.",
    "details": [
      { "field": "email", "message": "Invalid email address." }
    ]
  }
}
```
`details` n'est présent que pour `VALIDATION_ERROR`. Les `message` sont en anglais et peuvent être affichés tels quels.

### Codes d'erreur
| HTTP | `code` | Quand |
|---|---|---|
| 400 | `VALIDATION_ERROR` | body ou query invalide (validation Zod) |
| 400 | `WRONG_PASSWORD` | mot de passe actuel incorrect (changement de mot de passe) |
| 400 | `CANNOT_MODIFY_SELF` | un admin essaie de changer son propre rôle ou de se bloquer |
| 401 | `UNAUTHORIZED` | token absent, invalide ou expiré |
| 401 | `INVALID_CREDENTIALS` | email ou mot de passe incorrect au login |
| 403 | `ACCOUNT_BLOCKED` | compte bloqué par un admin |
| 403 | `FORBIDDEN` | rôle insuffisant (ex. USER sur une route ADMIN) |
| 404 | `NOT_FOUND` | route inconnue |
| 404 | `GPU_NOT_FOUND` / `RENTAL_NOT_FOUND` / `USER_NOT_FOUND` / `MESSAGE_NOT_FOUND` | ressource inexistante (ou qui n'appartient pas à l'utilisateur) |
| 409 | `EMAIL_TAKEN` | email déjà utilisé |
| 409 | `GPU_NAME_TAKEN` | nom de GPU déjà utilisé |
| 409 | `NOT_ENOUGH_UNITS` | pas assez d'unités libres sur la période |
| 409 | `GPU_INACTIVE` | location d'un GPU désactivé |
| 409 | `RENTAL_NOT_CANCELLABLE` | location qui ne peut plus être annulée |
| 429 | `TOO_MANY_ATTEMPTS` | trop d'échecs de login (5 par IP + email sur 15 min) |
| 500 | `INTERNAL_ERROR` | erreur serveur inattendue |

---

## 2. Objets communs

Ces objets sont réutilisés dans les réponses ci-dessous.

### `User`
`passwordHash` n'est **jamais** renvoyé.
```json
{
  "id": 3,
  "email": "jane.doe@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "role": "USER",
  "isBlocked": false,
  "createdAt": "2026-10-20T14:32:10.000Z"
}
```
`role` : `"USER"` | `"ADMIN"`.

### `Gpu`
```json
{
  "id": 1,
  "name": "NVIDIA H100 80GB",
  "manufacturer": "NVIDIA",
  "architecture": "Hopper",
  "vramGb": 80,
  "fp16Tflops": 989.5,
  "pricePerHour": 3.2,
  "totalUnits": 8,
  "availableUnits": 6,
  "description": "Flagship data-center GPU for large-scale training and fast inference.",
  "isActive": true,
  "createdAt": "2026-10-01T08:00:00.000Z",
  "updatedAt": "2026-10-01T08:00:00.000Z"
}
```
`availableUnits` = unités libres sur la période demandée (voir `GET /gpus`), sinon sur l'heure qui commence maintenant.

### `GpuSummary` (GPU résumé, inclus dans d'autres objets)
```json
{
  "id": 1,
  "name": "NVIDIA H100 80GB",
  "manufacturer": "NVIDIA",
  "vramGb": 80,
  "pricePerHour": 3.2
}
```

### `Rental`
```json
{
  "id": 15,
  "quantity": 2,
  "startDate": "2026-11-02T09:00:00.000Z",
  "durationHours": 48,
  "endDate": "2026-11-04T09:00:00.000Z",
  "totalPrice": 307.2,
  "status": "UPCOMING",
  "cancelledAt": null,
  "createdAt": "2026-10-26T10:15:00.000Z",
  "gpu": {
    "id": 1,
    "name": "NVIDIA H100 80GB",
    "manufacturer": "NVIDIA",
    "vramGb": 80,
    "pricePerHour": 3.2
  }
}
```
`status` (calculé par le backend) : `"UPCOMING"` (pas commencée) | `"ACTIVE"` (en cours) | `"COMPLETED"` (terminée) | `"CANCELLED"` (annulée).
`totalPrice = pricePerHour × quantity × durationHours`.

### `AdminRental` (= `Rental` + l'utilisateur)
```json
{
  "id": 15,
  "quantity": 2,
  "startDate": "2026-11-02T09:00:00.000Z",
  "durationHours": 48,
  "endDate": "2026-11-04T09:00:00.000Z",
  "totalPrice": 307.2,
  "status": "UPCOMING",
  "cancelledAt": null,
  "createdAt": "2026-10-26T10:15:00.000Z",
  "gpu": {
    "id": 1,
    "name": "NVIDIA H100 80GB",
    "manufacturer": "NVIDIA",
    "vramGb": 80,
    "pricePerHour": 3.2
  },
  "user": {
    "id": 3,
    "email": "jane.doe@example.com",
    "firstName": "Jane",
    "lastName": "Doe"
  }
}
```

### `ContactMessage`
```json
{
  "id": 12,
  "name": "John Smith",
  "email": "john.smith@example.com",
  "subject": "Volume pricing",
  "message": "Hello, do you offer discounts for 30-day rentals of 8 GPUs?",
  "isRead": false,
  "createdAt": "2026-10-25T16:40:00.000Z"
}
```

---

## 3. Auth

### `POST /auth/register` — Public
Crée un compte `USER` et le connecte.

Body :
```json
{
  "email": "jane.doe@example.com",
  "password": "MySecret123",
  "firstName": "Jane",
  "lastName": "Doe"
}
```
Validation : `email` valide ; `password` 8 à 72 caractères ; `firstName` et `lastName` 1 à 50 caractères.

Réponse `201` :
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 3,
    "email": "jane.doe@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "USER",
    "isBlocked": false,
    "createdAt": "2026-10-26T10:00:00.000Z"
  }
}
```
Erreurs : `400 VALIDATION_ERROR`, `409 EMAIL_TAKEN`.

### `POST /auth/login` — Public
Body :
```json
{
  "email": "jane.doe@example.com",
  "password": "MySecret123"
}
```
Réponse `200` : même format que `register` (`{ "token", "user" }`).

Erreurs : `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`, `403 ACCOUNT_BLOCKED`, `429 TOO_MANY_ATTEMPTS`.

### `GET /auth/me` — USER
Renvoie l'utilisateur correspondant au token (utilisé au démarrage du frontend).

Réponse `200` :
```json
{
  "user": {
    "id": 3,
    "email": "jane.doe@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "USER",
    "isBlocked": false,
    "createdAt": "2026-10-26T10:00:00.000Z"
  }
}
```
Erreurs : `401 UNAUTHORIZED`, `403 ACCOUNT_BLOCKED`.

> Il n'y a pas de route de logout : le frontend supprime simplement le token.

---

## 4. GPU (public)

### `GET /gpus` — Public
Liste des GPU **actifs**, avec filtres.

Paramètres de query (tous optionnels) :
| Paramètre | Type | Effet |
|---|---|---|
| `search` | texte | nom ou architecture contient ce texte (insensible à la casse) |
| `manufacturer` | texte | fabricant exact, ex. `NVIDIA` |
| `minVram` | entier | `vramGb ≥ minVram` |
| `maxPrice` | nombre | `pricePerHour ≤ maxPrice` |
| `startDate` | date ISO | début de la période pour calculer `availableUnits` |
| `durationHours` | entier 1–720 | durée de la période (à utiliser avec `startDate`) |
| `available` | `true` | seulement les GPU avec `availableUnits ≥ 1` |
| `sort` | `price_asc` (défaut) · `price_desc` · `vram_desc` · `name_asc` | ordre de la liste |

Exemple : `GET /gpus?manufacturer=NVIDIA&minVram=40&maxPrice=3&available=true&startDate=2026-11-02T09:00:00.000Z&durationHours=48`

Réponse `200` :
```json
{
  "gpus": [
    {
      "id": 2,
      "name": "NVIDIA A100 80GB",
      "manufacturer": "NVIDIA",
      "architecture": "Ampere",
      "vramGb": 80,
      "fp16Tflops": 312,
      "pricePerHour": 1.89,
      "totalUnits": 12,
      "availableUnits": 9,
      "description": "Proven workhorse for training and fine-tuning large models.",
      "isActive": true,
      "createdAt": "2026-10-01T08:00:00.000Z",
      "updatedAt": "2026-10-01T08:00:00.000Z"
    }
  ],
  "total": 1,
  "manufacturers": ["AMD", "NVIDIA"]
}
```
`manufacturers` = tous les fabricants des GPU actifs (sans filtre), pour remplir la liste déroulante du filtre.

Erreurs : `400 VALIDATION_ERROR`.

### `GET /gpus/:id` — Public
Paramètres de query optionnels : `startDate`, `durationHours` (même effet que ci-dessus sur `availableUnits`).

Réponse `200` :
```json
{
  "gpu": {
    "id": 1,
    "name": "NVIDIA H100 80GB",
    "manufacturer": "NVIDIA",
    "architecture": "Hopper",
    "vramGb": 80,
    "fp16Tflops": 989.5,
    "pricePerHour": 3.2,
    "totalUnits": 8,
    "availableUnits": 6,
    "description": "Flagship data-center GPU for large-scale training and fast inference.",
    "isActive": true,
    "createdAt": "2026-10-01T08:00:00.000Z",
    "updatedAt": "2026-10-01T08:00:00.000Z"
  }
}
```
Erreurs : `400 VALIDATION_ERROR`, `404 GPU_NOT_FOUND` (inexistant ou désactivé).

---

## 5. Recommandation

### `POST /recommendations` — Public
Body :
```json
{
  "modelType": "LLM",
  "parametersBillions": 7,
  "mode": "INFERENCE",
  "budgetPerHour": 2
}
```
Validation : `modelType` ∈ `LLM` · `VISION` · `DIFFUSION` · `AUDIO` · `OTHER` ; `parametersBillions` nombre de 0.01 à 2000 ;
`mode` ∈ `TRAINING` · `INFERENCE` ; `budgetPerHour` nombre > 0.

Réponse `200` :
```json
{
  "input": {
    "modelType": "LLM",
    "parametersBillions": 7,
    "mode": "INFERENCE",
    "budgetPerHour": 2
  },
  "requiredVramGb": 16.8,
  "recommendation": {
    "gpu": {
      "id": 5,
      "name": "NVIDIA RTX 4090",
      "manufacturer": "NVIDIA",
      "vramGb": 24,
      "pricePerHour": 0.69
    },
    "gpuCount": 1,
    "totalVramGb": 24,
    "totalPricePerHour": 0.69,
    "withinBudget": true
  },
  "alternatives": [
    {
      "gpu": {
        "id": 3,
        "name": "NVIDIA A100 40GB",
        "manufacturer": "NVIDIA",
        "vramGb": 40,
        "pricePerHour": 1.29
      },
      "gpuCount": 1,
      "totalVramGb": 40,
      "totalPricePerHour": 1.29,
      "withinBudget": true
    },
    {
      "gpu": {
        "id": 2,
        "name": "NVIDIA A100 80GB",
        "manufacturer": "NVIDIA",
        "vramGb": 80,
        "pricePerHour": 1.89
      },
      "gpuCount": 1,
      "totalVramGb": 80,
      "totalPricePerHour": 1.89,
      "withinBudget": true
    }
  ],
  "explanation": "A 7B LLM in inference needs about 16.8 GB of VRAM. 1 × NVIDIA RTX 4090 (24 GB) covers it for $0.69/hour, within your $2.00/hour budget."
}
```
- `gpu` est un `GpuSummary`.
- `alternatives` contient 0 à 2 éléments.
- Si aucune configuration ne respecte le budget : `recommendation` est la moins chère, avec `"withinBudget": false`.
- Si aucun GPU actif ne convient (même avec 8 GPU) : `"recommendation": null`, `"alternatives": []` et `explanation` l'indique.
- Calcul : voir PLAN.md, section 8.

Erreurs : `400 VALIDATION_ERROR`.

---

## 6. Contact

### `POST /contact` — Public
Body :
```json
{
  "name": "John Smith",
  "email": "john.smith@example.com",
  "subject": "Volume pricing",
  "message": "Hello, do you offer discounts for 30-day rentals of 8 GPUs?"
}
```
Validation : `name` 1–100 caractères ; `email` valide ; `subject` 1–150 caractères ; `message` 10–2000 caractères.

Réponse `201` :
```json
{
  "success": true,
  "id": 12
}
```
Erreurs : `400 VALIDATION_ERROR`.

---

## 7. Profil utilisateur

### `GET /users/me` — USER
Réponse `200` : `{ "user": User }` (même format que `GET /auth/me`).

Erreurs : `401 UNAUTHORIZED`, `403 ACCOUNT_BLOCKED`.

### `PUT /users/me` — USER
Body :
```json
{
  "email": "jane.doe@example.com",
  "firstName": "Jane",
  "lastName": "Doe-Martin"
}
```
Validation : mêmes règles que `register` (sans le mot de passe), les 3 champs sont obligatoires.

Réponse `200` :
```json
{
  "user": {
    "id": 3,
    "email": "jane.doe@example.com",
    "firstName": "Jane",
    "lastName": "Doe-Martin",
    "role": "USER",
    "isBlocked": false,
    "createdAt": "2026-10-26T10:00:00.000Z"
  }
}
```
Erreurs : `400 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 ACCOUNT_BLOCKED`, `409 EMAIL_TAKEN`.

### `PUT /users/me/password` — USER
Body :
```json
{
  "currentPassword": "MySecret123",
  "newPassword": "MyNewSecret456"
}
```
Validation : `newPassword` 8 à 72 caractères.

Réponse `200` :
```json
{
  "success": true
}
```
Erreurs : `400 VALIDATION_ERROR`, `400 WRONG_PASSWORD`, `401 UNAUTHORIZED`, `403 ACCOUNT_BLOCKED`.

---

## 8. Locations utilisateur

### `GET /rentals/me` — USER
Locations de l'utilisateur connecté, de la plus récente à la plus ancienne (`startDate` décroissante).

Query optionnelle : `status` = `UPCOMING` | `ACTIVE` | `COMPLETED` | `CANCELLED`.

Réponse `200` :
```json
{
  "rentals": [
    {
      "id": 15,
      "quantity": 2,
      "startDate": "2026-11-02T09:00:00.000Z",
      "durationHours": 48,
      "endDate": "2026-11-04T09:00:00.000Z",
      "totalPrice": 307.2,
      "status": "UPCOMING",
      "cancelledAt": null,
      "createdAt": "2026-10-26T10:15:00.000Z",
      "gpu": {
        "id": 1,
        "name": "NVIDIA H100 80GB",
        "manufacturer": "NVIDIA",
        "vramGb": 80,
        "pricePerHour": 3.2
      }
    }
  ],
  "total": 1
}
```
Erreurs : `400 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 ACCOUNT_BLOCKED`.

### `POST /rentals` — USER
Body :
```json
{
  "gpuId": 1,
  "quantity": 2,
  "startDate": "2026-11-02T09:00:00.000Z",
  "durationHours": 48
}
```
Validation : `gpuId` entier ; `quantity` entier ≥ 1 ; `startDate` date ISO dans le futur ; `durationHours` entier de 1 à 720.
Le backend calcule `endDate` et `totalPrice` (jamais envoyés par le client).

Réponse `201` :
```json
{
  "rental": {
    "id": 15,
    "quantity": 2,
    "startDate": "2026-11-02T09:00:00.000Z",
    "durationHours": 48,
    "endDate": "2026-11-04T09:00:00.000Z",
    "totalPrice": 307.2,
    "status": "UPCOMING",
    "cancelledAt": null,
    "createdAt": "2026-10-26T10:15:00.000Z",
    "gpu": {
      "id": 1,
      "name": "NVIDIA H100 80GB",
      "manufacturer": "NVIDIA",
      "vramGb": 80,
      "pricePerHour": 3.2
    }
  }
}
```
Erreurs : `400 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 ACCOUNT_BLOCKED`, `404 GPU_NOT_FOUND`, `409 GPU_INACTIVE`, `409 NOT_ENOUGH_UNITS`.

### `PATCH /rentals/:id/cancel` — USER
Annule une location de l'utilisateur connecté. Possible seulement si son statut est `UPCOMING`. Pas de body.

Réponse `200` :
```json
{
  "rental": {
    "id": 15,
    "quantity": 2,
    "startDate": "2026-11-02T09:00:00.000Z",
    "durationHours": 48,
    "endDate": "2026-11-04T09:00:00.000Z",
    "totalPrice": 307.2,
    "status": "CANCELLED",
    "cancelledAt": "2026-10-27T08:00:00.000Z",
    "createdAt": "2026-10-26T10:15:00.000Z",
    "gpu": {
      "id": 1,
      "name": "NVIDIA H100 80GB",
      "manufacturer": "NVIDIA",
      "vramGb": 80,
      "pricePerHour": 3.2
    }
  }
}
```
Erreurs : `401 UNAUTHORIZED`, `403 ACCOUNT_BLOCKED`, `404 RENTAL_NOT_FOUND` (inexistante ou appartenant à quelqu'un d'autre), `409 RENTAL_NOT_CANCELLABLE`.

---

## 9. Admin

Toutes les routes `/admin/*` exigent le rôle **ADMIN**.
Erreurs communes à toutes ces routes : `401 UNAUTHORIZED`, `403 ACCOUNT_BLOCKED`, `403 FORBIDDEN`.

### `GET /admin/stats` — ADMIN
Réponse `200` :
```json
{
  "users": {
    "total": 42,
    "admins": 2,
    "blocked": 1
  },
  "gpus": {
    "total": 7,
    "active": 6,
    "totalUnits": 60
  },
  "rentals": {
    "total": 128,
    "upcoming": 14,
    "active": 9,
    "completed": 95,
    "cancelled": 10
  },
  "revenue": {
    "total": 48250.4,
    "last30Days": 9120.75
  },
  "messages": {
    "total": 23,
    "unread": 4
  },
  "topGpus": [
    {
      "gpuId": 1,
      "name": "NVIDIA H100 80GB",
      "rentalCount": 37,
      "revenue": 21540
    }
  ],
  "rentalsPerMonth": [
    { "month": "2026-05", "count": 12, "revenue": 4100.5 },
    { "month": "2026-06", "count": 18, "revenue": 6230 },
    { "month": "2026-07", "count": 20, "revenue": 7012.25 },
    { "month": "2026-08", "count": 22, "revenue": 8104 },
    { "month": "2026-09", "count": 27, "revenue": 10950.9 },
    { "month": "2026-10", "count": 29, "revenue": 11852.75 }
  ]
}
```
- `revenue` et `topGpus` ne comptent que les locations non annulées.
- `topGpus` : 5 GPU maximum, triés par `rentalCount` décroissant.
- `rentalsPerMonth` : les 6 derniers mois (mois en cours inclus), selon le mois de `startDate`, locations non annulées.

### `GET /admin/gpus` — ADMIN
Tous les GPU, **actifs et désactivés**, triés par `name`.

Réponse `200` :
```json
{
  "gpus": [
    {
      "id": 1,
      "name": "NVIDIA H100 80GB",
      "manufacturer": "NVIDIA",
      "architecture": "Hopper",
      "vramGb": 80,
      "fp16Tflops": 989.5,
      "pricePerHour": 3.2,
      "totalUnits": 8,
      "availableUnits": 6,
      "description": "Flagship data-center GPU for large-scale training and fast inference.",
      "isActive": true,
      "createdAt": "2026-10-01T08:00:00.000Z",
      "updatedAt": "2026-10-01T08:00:00.000Z",
      "rentalCount": 37
    }
  ],
  "total": 1
}
```
`rentalCount` = nombre total de locations de ce GPU (annulées comprises).

### `POST /admin/gpus` — ADMIN
Body :
```json
{
  "name": "NVIDIA L40S 48GB",
  "manufacturer": "NVIDIA",
  "architecture": "Ada Lovelace",
  "vramGb": 48,
  "fp16Tflops": 362,
  "pricePerHour": 1.1,
  "totalUnits": 10,
  "description": "Versatile GPU for inference, fine-tuning and generative AI.",
  "isActive": true
}
```
Validation : `name` 1–100 caractères (unique) ; `manufacturer` et `architecture` 1–50 ; `vramGb` entier 1–1024 ;
`fp16Tflops` nombre > 0 ; `pricePerHour` nombre > 0 ; `totalUnits` entier 0–1000 ; `description` 1–1000 ; `isActive` booléen (optionnel, défaut `true`).

Réponse `201` : `{ "gpu": Gpu }`
```json
{
  "gpu": {
    "id": 8,
    "name": "NVIDIA L40S 48GB",
    "manufacturer": "NVIDIA",
    "architecture": "Ada Lovelace",
    "vramGb": 48,
    "fp16Tflops": 362,
    "pricePerHour": 1.1,
    "totalUnits": 10,
    "availableUnits": 10,
    "description": "Versatile GPU for inference, fine-tuning and generative AI.",
    "isActive": true,
    "createdAt": "2026-10-26T11:00:00.000Z",
    "updatedAt": "2026-10-26T11:00:00.000Z"
  }
}
```
Erreurs : `400 VALIDATION_ERROR`, `409 GPU_NAME_TAKEN`.

### `PUT /admin/gpus/:id` — ADMIN
Remplace toutes les informations du GPU. Body : **mêmes champs et validation** que `POST /admin/gpus` (`isActive` obligatoire ici).
Permet aussi de réactiver un GPU (`"isActive": true`).

Réponse `200` : `{ "gpu": Gpu }` (même format que ci-dessus, avec les nouvelles valeurs).

Erreurs : `400 VALIDATION_ERROR`, `404 GPU_NOT_FOUND`, `409 GPU_NAME_TAKEN`.

### `DELETE /admin/gpus/:id` — ADMIN
**Désactive** le GPU (`isActive = false`) : il disparaît du catalogue public, les locations existantes sont conservées.

Réponse `200` : `{ "gpu": Gpu }` avec `"isActive": false`.

Erreurs : `404 GPU_NOT_FOUND`.

### `GET /admin/users` — ADMIN
Query optionnelle : `search` (email, prénom ou nom), `role` (`USER` | `ADMIN`), `blocked` (`true` | `false`).
Triés par `createdAt` décroissant.

Réponse `200` :
```json
{
  "users": [
    {
      "id": 3,
      "email": "jane.doe@example.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "role": "USER",
      "isBlocked": false,
      "createdAt": "2026-10-20T14:32:10.000Z",
      "rentalCount": 4
    }
  ],
  "total": 1
}
```
Erreurs : `400 VALIDATION_ERROR`.

### `PATCH /admin/users/:id` — ADMIN
Change le rôle et/ou bloque / débloque. Au moins un des deux champs est obligatoire.

Body :
```json
{
  "role": "ADMIN",
  "isBlocked": false
}
```
Réponse `200` : `{ "user": User }`
```json
{
  "user": {
    "id": 3,
    "email": "jane.doe@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "ADMIN",
    "isBlocked": false,
    "createdAt": "2026-10-20T14:32:10.000Z"
  }
}
```
Erreurs : `400 VALIDATION_ERROR`, `400 CANNOT_MODIFY_SELF`, `404 USER_NOT_FOUND`.

### `GET /admin/rentals` — ADMIN
Query optionnelle : `status` (`UPCOMING` | `ACTIVE` | `COMPLETED` | `CANCELLED`), `userId`, `gpuId`.
Triées par `startDate` décroissante.

Réponse `200` :
```json
{
  "rentals": [
    {
      "id": 15,
      "quantity": 2,
      "startDate": "2026-11-02T09:00:00.000Z",
      "durationHours": 48,
      "endDate": "2026-11-04T09:00:00.000Z",
      "totalPrice": 307.2,
      "status": "UPCOMING",
      "cancelledAt": null,
      "createdAt": "2026-10-26T10:15:00.000Z",
      "gpu": {
        "id": 1,
        "name": "NVIDIA H100 80GB",
        "manufacturer": "NVIDIA",
        "vramGb": 80,
        "pricePerHour": 3.2
      },
      "user": {
        "id": 3,
        "email": "jane.doe@example.com",
        "firstName": "Jane",
        "lastName": "Doe"
      }
    }
  ],
  "total": 1
}
```
Erreurs : `400 VALIDATION_ERROR`.

### `PATCH /admin/rentals/:id/cancel` — ADMIN
Annule n'importe quelle location dont le statut est `UPCOMING` ou `ACTIVE`. Pas de body.

Réponse `200` : `{ "rental": AdminRental }` avec `"status": "CANCELLED"` et `cancelledAt` rempli.

Erreurs : `404 RENTAL_NOT_FOUND`, `409 RENTAL_NOT_CANCELLABLE`.

### `GET /admin/messages` — ADMIN
Query optionnelle : `isRead` (`true` | `false`). Triés par `createdAt` décroissant.

Réponse `200` :
```json
{
  "messages": [
    {
      "id": 12,
      "name": "John Smith",
      "email": "john.smith@example.com",
      "subject": "Volume pricing",
      "message": "Hello, do you offer discounts for 30-day rentals of 8 GPUs?",
      "isRead": false,
      "createdAt": "2026-10-25T16:40:00.000Z"
    }
  ],
  "total": 1,
  "unread": 1
}
```
`unread` = nombre total de messages non lus (indépendant du filtre).

Erreurs : `400 VALIDATION_ERROR`.

### `PATCH /admin/messages/:id` — ADMIN
Body :
```json
{
  "isRead": true
}
```
Réponse `200` : `{ "message": ContactMessage }`
```json
{
  "message": {
    "id": 12,
    "name": "John Smith",
    "email": "john.smith@example.com",
    "subject": "Volume pricing",
    "message": "Hello, do you offer discounts for 30-day rentals of 8 GPUs?",
    "isRead": true,
    "createdAt": "2026-10-25T16:40:00.000Z"
  }
}
```
Erreurs : `400 VALIDATION_ERROR`, `404 MESSAGE_NOT_FOUND`.

### `DELETE /admin/messages/:id` — ADMIN
Supprime définitivement le message.

Réponse `204` : pas de contenu.

Erreurs : `404 MESSAGE_NOT_FOUND`.

---

## 10. Récapitulatif des routes

| Méthode | URL | Rôle | Réponse |
|---|---|---|---|
| GET | `/health` | Public | `200 { "status": "ok" }` |
| POST | `/auth/register` | Public | `201 { token, user }` |
| POST | `/auth/login` | Public | `200 { token, user }` |
| GET | `/auth/me` | USER | `200 { user }` |
| GET | `/gpus` | Public | `200 { gpus, total, manufacturers }` |
| GET | `/gpus/:id` | Public | `200 { gpu }` |
| POST | `/recommendations` | Public | `200 { input, requiredVramGb, recommendation, alternatives, explanation }` |
| POST | `/contact` | Public | `201 { success, id }` |
| GET | `/users/me` | USER | `200 { user }` |
| PUT | `/users/me` | USER | `200 { user }` |
| PUT | `/users/me/password` | USER | `200 { success }` |
| GET | `/rentals/me` | USER | `200 { rentals, total }` |
| POST | `/rentals` | USER | `201 { rental }` |
| PATCH | `/rentals/:id/cancel` | USER | `200 { rental }` |
| GET | `/admin/stats` | ADMIN | `200 { users, gpus, rentals, revenue, messages, topGpus, rentalsPerMonth }` |
| GET | `/admin/gpus` | ADMIN | `200 { gpus, total }` |
| POST | `/admin/gpus` | ADMIN | `201 { gpu }` |
| PUT | `/admin/gpus/:id` | ADMIN | `200 { gpu }` |
| DELETE | `/admin/gpus/:id` | ADMIN | `200 { gpu }` |
| GET | `/admin/users` | ADMIN | `200 { users, total }` |
| PATCH | `/admin/users/:id` | ADMIN | `200 { user }` |
| GET | `/admin/rentals` | ADMIN | `200 { rentals, total }` |
| PATCH | `/admin/rentals/:id/cancel` | ADMIN | `200 { rental }` |
| GET | `/admin/messages` | ADMIN | `200 { messages, total, unread }` |
| PATCH | `/admin/messages/:id` | ADMIN | `200 { message }` |
| DELETE | `/admin/messages/:id` | ADMIN | `204` |
