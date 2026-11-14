# TeraMind — Plan du projet

> Site institutionnel (en anglais) de **TeraMind**, entreprise fictive qui loue des GPU pour l'IA
> et recommande le GPU optimal selon le modèle à entraîner ou à servir.
> Projet web SUP'COM — équipe de 2 : **personne A = backend**, **personne B = frontend**.

Documents liés :
- [API.md](API.md) — contrat de l'API (source de vérité pour le backend **et** le frontend)
- [DESIGN.md](DESIGN.md) — référence visuelle du frontend

---

## 1. Stack

| Partie | Technologies | Lancement |
|---|---|---|
| `frontend/` | Angular (dernière version stable, composants standalone, TypeScript strict), Router, HttpClient, Tailwind CSS | `npm start` → http://localhost:4200 |
| `backend/` | Node.js, Express, TypeScript, Prisma, Zod, bcrypt, JWT | `npm run dev` → http://localhost:3000 |
| Base de données | PostgreSQL (via Prisma) | `docker compose up -d` |
| Cache | Redis — **uniquement** pour limiter les tentatives de login | `docker compose up -d` |

- Rôles : `USER` et `ADMIN`.
- Secrets dans `backend/.env` (jamais commité), modèle fourni dans `backend/.env.example`.
- `docker-compose.yml` à la racine (PostgreSQL + Redis), géré par la personne A.

---

## 2. Design

`DESIGN.md` est la référence visuelle, adaptée avec Tailwind :
- thème sombre : fonds `#000000` / `#0e0e0e` / `#1d1d1f`, texte `#f5f5f7`, texte secondaire `#86868b` ;
- police **Inter** (substitut de SF Pro), titres en 600 avec lettres resserrées ;
- bleu `#0071e3` **réservé** aux boutons d'action principaux (Rent, Get recommendation, Sign in…), liens en `#2997ff` ;
- cartes et tuiles arrondies à 28px, boutons en pilule, **pas d'ombres** (bordure fine `#333336` à la place) ;
- les couleurs, tailles et arrondis de DESIGN.md sont déclarés comme tokens dans la configuration Tailwind.

Le site utilise uniquement la marque fictive TeraMind : aucun nom ni logo de marque réelle dans l'interface
(les noms de GPU comme « NVIDIA H100 » sont des données du catalogue, pas du branding).

Responsive : mobile d'abord, navigation repliée en menu sur petit écran.

---

## 3. Pages et routes (frontend)

### Public
| Route | Page | Contenu |
|---|---|---|
| `/` | Home | Hero, points forts (performance, prix, recommandation), 3 GPU mis en avant, appel à l'action |
| `/about` | About | Mission, valeurs, équipe, chiffres clés |
| `/gpus` | GPU catalog | Liste des GPU + filtres (recherche, fabricant, VRAM min, prix max, disponibilité sur une période), tri |
| `/gpus/:id` | GPU detail | Caractéristiques, prix/heure, unités disponibles, bouton « Rent this GPU » |
| `/recommend` | GPU Recommendation | **Conseiller IA** (mode principal) : l'utilisateur colle le lien d'un dépôt GitHub public, l'IA l'analyse et recommande les configurations de GPU ; c'est une conversation, l'IA peut poser une question s'il manque une information. **Formulaire de secours** (pas de dépôt, ou IA indisponible) : type de modèle, nombre de paramètres, training/inference, budget/heure → GPU conseillé + 2 alternatives |
| `/contact` | Contact | Formulaire enregistré en base, message de confirmation |
| `/login` | Login | Email + mot de passe |
| `/register` | Register | Prénom, nom, email, mot de passe |
| `**` | Not found | Page 404 |

### Espace utilisateur (`authGuard`)
| Route | Page | Contenu |
|---|---|---|
| `/account/rentals` | My rentals | Liste des locations (statut, dates, prix), bouton « Cancel » si à venir |
| `/account/rentals/new?gpuId=` | New rental | GPU choisi, quantité, date/heure de début, durée en heures, prix estimé en direct |
| `/account/profile` | Profile | Modifier prénom/nom/email, changer le mot de passe |

### Espace admin (`adminGuard`)
| Route | Page | Contenu |
|---|---|---|
| `/admin` | Dashboard | Statistiques (utilisateurs, GPU, locations, revenus, messages non lus, top GPU, locations par mois) |
| `/admin/gpus` | GPU management | Tableau, créer / modifier / désactiver un GPU |
| `/admin/users` | User management | Tableau, changer le rôle, bloquer / débloquer |
| `/admin/rentals` | Rental management | Toutes les locations avec filtres, annulation |
| `/admin/messages` | Contact messages | Lire, marquer lu / non lu, supprimer |

La Navbar affiche « Login / Register » si déconnecté, « My rentals / Profile / Logout » si connecté,
et un lien « Admin » si le rôle est `ADMIN`.

---

## 4. Frontend — composants Angular (standalone)

### Arborescence prévue
```
frontend/src/app/
├── app.config.ts                 (providers : router, HttpClient + interceptor)
├── app.routes.ts                 (toutes les routes, lazy loading des pages)
├── core/
│   ├── models/                   (interfaces TypeScript = types de API.md : User, Gpu, Rental, ...)
│   ├── services/                 (appels HTTP, un service par ressource)
│   ├── guards/                   (authGuard, adminGuard, guestGuard)
│   └── interceptors/             (authInterceptor, errorInterceptor)
├── layout/
│   ├── navbar/
│   └── footer/
├── shared/components/            (composants réutilisables)
└── pages/
    ├── public/                   (home, about, gpu-catalog, gpu-detail, recommend, contact, login, register, not-found)
    ├── account/                  (my-rentals, new-rental, profile)
    └── admin/                    (dashboard, gpus, users, rentals, messages)
```
`frontend/src/environments/environment.ts` contient `apiUrl: 'http://localhost:3000/api'`.

### Pages
`HomePage`, `AboutPage`, `GpuCatalogPage`, `GpuDetailPage`, `RecommendPage`, `ContactPage`, `LoginPage`,
`RegisterPage`, `NotFoundPage`, `MyRentalsPage`, `NewRentalPage`, `ProfilePage`, `AdminDashboardPage`,
`AdminGpusPage`, `AdminUsersPage`, `AdminRentalsPage`, `AdminMessagesPage`.

### Composants partagés
| Composant | Rôle |
|---|---|
| `Navbar` | Navigation principale, adaptée à l'état de connexion et au rôle |
| `Footer` | Liens, copyright |
| `GpuCard` | Carte d'un GPU (nom, VRAM, prix/heure, disponibilité) |
| `GpuFilters` | Formulaire de filtres du catalogue, émet les filtres choisis |
| `StatCard` | Tuile de statistique du dashboard |
| `StatusBadge` | Statut d'une location (UPCOMING, ACTIVE, COMPLETED, CANCELLED) |
| `ConfirmDialog` | Fenêtre de confirmation (annuler une location, supprimer un message…) |
| `Alert` | Message de succès ou d'erreur |
| `Spinner` | Indicateur de chargement |

### Services, guards, interceptors
| Élément | Rôle |
|---|---|
| `AuthService` | register, login, logout, utilisateur courant (signal), token dans `localStorage` |
| `GpuService` | liste filtrée, détail |
| `RecommendationService` | envoi du formulaire de recommandation |
| `ContactService` | envoi d'un message de contact |
| `RentalService` | mes locations, créer, annuler |
| `UserService` | profil, changement de mot de passe |
| `AdminService` | stats, GPU, utilisateurs, locations, messages (routes `/admin/...`) |
| `authInterceptor` | ajoute `Authorization: Bearer <token>` à chaque requête |
| `errorInterceptor` | sur 401 : déconnexion et redirection vers `/login` |
| `authGuard` | bloque l'espace utilisateur si non connecté |
| `adminGuard` | bloque l'espace admin si le rôle n'est pas `ADMIN` |
| `guestGuard` | redirige `/login` et `/register` vers `/` si déjà connecté |

Formulaires : **Reactive Forms** avec validation côté client (en plus de la validation Zod du backend).
Messages d'erreur affichés en anglais, à partir de `error.message` renvoyé par l'API.

---

## 5. Backend — organisation

```
backend/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                   (GPU de démonstration + compte admin)
├── src/
│   ├── server.ts                 (démarrage du serveur)
│   ├── app.ts                    (Express, CORS pour localhost:4200, JSON, routes, gestion d'erreurs)
│   ├── config/                   (lecture et validation des variables d'environnement)
│   ├── lib/                      (client Prisma, client Redis)
│   ├── routes/                   (auth, gpus, recommendations, contact, users, rentals, admin)
│   ├── controllers/              (lecture de la requête → appel du service → réponse JSON)
│   ├── services/                 (logique métier : disponibilité, prix, recommandation, stats)
│   ├── schemas/                  (schémas Zod des body et query)
│   ├── middlewares/              (auth, requireRole, validate, rateLimitLogin, errorHandler)
│   └── utils/                    (AppError, formatage des réponses)
├── .env.example
├── package.json
└── tsconfig.json
```

Variables d'environnement (`backend/.env.example`) :
`PORT`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

---

## 6. Schéma de base de données (Prisma)

### Tables et relations
```
users 1 ──── N rentals N ──── 1 gpus
contact_messages (indépendante)
```
- Un **User** peut avoir plusieurs **Rental** ; une **Rental** appartient à un seul User.
- Un **Gpu** peut avoir plusieurs **Rental** ; une **Rental** porte sur un seul Gpu (avec une quantité).
- **ContactMessage** n'est liée à aucune table (le formulaire est public).
- La recommandation est **calculée à la volée**, elle n'est pas stockée.

### `backend/prisma/schema.prisma` (prévu)
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  USER                                                     // client
  ADMIN                                                    // administrateur
}

enum RentalStatus {
  CONFIRMED                                                // location valide
  CANCELLED                                                // location annulée
}

model User {
  id           Int      @id @default(autoincrement())
  email        String   @unique                          // identifiant de connexion
  passwordHash String                                    // mot de passe haché avec bcrypt
  firstName    String
  lastName     String
  role         Role     @default(USER)
  isBlocked    Boolean  @default(false)                  // bloqué = connexion refusée
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  rentals      Rental[]                                  // locations de l'utilisateur

  @@map("users")
}

model Gpu {
  id           Int      @id @default(autoincrement())
  name         String   @unique                          // ex. "NVIDIA H100 80GB"
  manufacturer String                                    // ex. "NVIDIA", "AMD"
  architecture String                                    // ex. "Hopper"
  vramGb       Int                                       // mémoire en Go
  fp16Tflops   Float                                     // puissance de calcul FP16
  pricePerHour Decimal  @db.Decimal(10, 2)               // prix d'une unité pendant 1 heure
  totalUnits   Int                                       // nombre d'unités possédées
  description  String
  isActive     Boolean  @default(true)                   // false = retiré du catalogue
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  rentals      Rental[]                                  // locations de ce GPU

  @@map("gpus")
}

model Rental {
  id            Int          @id @default(autoincrement())
  userId        Int
  gpuId         Int
  quantity      Int          @default(1)                 // nombre d'unités louées
  startDate     DateTime                                 // début de la location
  durationHours Int                                      // durée en heures
  endDate       DateTime                                 // startDate + durationHours (calculé par le backend)
  totalPrice    Decimal      @db.Decimal(12, 2)          // pricePerHour × quantity × durationHours
  status        RentalStatus @default(CONFIRMED)
  cancelledAt   DateTime?                                // date d'annulation
  createdAt     DateTime     @default(now())
  user          User         @relation(fields: [userId], references: [id], onDelete: Restrict)
  gpu           Gpu          @relation(fields: [gpuId], references: [id], onDelete: Restrict)

  @@index([gpuId, startDate, endDate])                   // accélère le calcul de disponibilité
  @@index([userId])
  @@map("rentals")
}

model ContactMessage {
  id        Int      @id @default(autoincrement())
  name      String
  email     String
  subject   String
  message   String
  isRead    Boolean  @default(false)                     // lu par un admin
  createdAt DateTime @default(now())

  @@map("contact_messages")
}
```

---

## 7. Règles métier

### Locations
- **Durée en heures** : entier de 1 à 720 (30 jours). Quantité : entier ≥ 1 et ≤ `totalUnits`.
- `startDate` doit être dans le futur. `endDate = startDate + durationHours`.
- **Prix calculé par le backend** : `totalPrice = pricePerHour × quantity × durationHours`. Le client ne l'envoie jamais.
- **Disponibilité** : pour une période [début, fin[, `availableUnits = totalUnits − somme des quantity`
  des locations `CONFIRMED` du même GPU qui chevauchent la période
  (chevauchement : `rental.startDate < fin` **et** `rental.endDate > début`).
  La location est refusée (409) si `quantity > availableUnits`.
- **Statut renvoyé par l'API** (calculé à partir de la base et de l'heure actuelle) :
  `CANCELLED` si annulée, sinon `UPCOMING` (pas commencée), `ACTIVE` (en cours) ou `COMPLETED` (terminée).
- **Annulation** : un utilisateur peut annuler **ses** locations `UPCOMING` ; un admin peut annuler les locations `UPCOMING` ou `ACTIVE`.
  Une location annulée libère ses unités.
- On ne peut louer qu'un GPU actif (`isActive = true`).

### Comptes
- Mot de passe : 8 caractères minimum, haché avec bcrypt (jamais renvoyé par l'API).
- JWT valable 24 h, contient `{ sub: userId, role }`.
- Utilisateur bloqué : login refusé (403) et requêtes avec un ancien token refusées (le middleware relit l'utilisateur en base).
- Rate limiting (Redis) : 5 échecs de login maximum par couple IP + email sur 15 minutes → 429.
- Un admin ne peut pas modifier son propre rôle ni se bloquer lui-même.
- Le seed crée un compte admin à partir de `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

### GPU
- « Supprimer » un GPU = le **désactiver** (`isActive = false`) : il disparaît du catalogue public mais l'historique des locations est conservé.

### Revenus (dashboard)
- Revenu = somme des `totalPrice` des locations non annulées.

---

## 8. Algorithme de recommandation

> **Deux modes sur la page `/recommend`.**
> Le mode principal est le **conseiller IA** : il lit un dépôt GitHub public et classe les configurations de GPU
> avec le simulateur du backend (`backend/src/agent/`, étapes B8 et B9). Ses routes sont dans
> `docs/API.md`, section 10 (`/agent/...`) ; le frontend s'y branche à l'étape F10 (guide : `ahmed.md`).
> L'algorithme ci-dessous est celui du **formulaire de secours** (`POST /recommendations`).

Entrées : `modelType` (LLM, VISION, DIFFUSION, AUDIO, OTHER), `parametersBillions`, `mode` (TRAINING, INFERENCE), `budgetPerHour`.

1. **VRAM nécessaire** (Go) :
   `requiredVramGb = parametersBillions × bytesPerParam × 1.2 × typeFactor`, arrondie à 0,1
   - `bytesPerParam` : 2 en INFERENCE (FP16), 16 en TRAINING (poids + gradients + états de l'optimiseur Adam) ;
   - `1.2` : marge pour les activations et le cache ;
   - `typeFactor` : LLM 1.0 · VISION 1.1 · DIFFUSION 1.3 · AUDIO 1.0 · OTHER 1.0.
2. **Configurations possibles** : pour chaque GPU actif, `gpuCount = ceil(requiredVramGb / vramGb)`
   (configurations de plus de 8 GPU écartées), `pricePerHour = gpu.pricePerHour × gpuCount`.
3. **Choix** : la configuration la moins chère dont le prix ≤ budget (à prix égal : moins de GPU, puis plus de TFLOPS).
   Si aucune ne respecte le budget : la moins chère quand même, avec `withinBudget: false`.
4. **Alternatives** : les 2 configurations suivantes, sur d'autres modèles de GPU.
5. **Explication** : une phrase en anglais générée par le backend (ex. « A 7B LLM in inference needs about 16.8 GB of VRAM… »).

La disponibilité n'est pas prise en compte dans la recommandation ; elle est vérifiée au moment de la location.

---

## 9. Étapes de développement

Une étape à la fois, testée puis validée avant de passer à la suivante.

### Backend — personne A
| Étape | Contenu | Terminée quand… |
|---|---|---|
| B1 ✅ | `docker-compose.yml` (PostgreSQL + Redis), projet Express + TypeScript, Prisma, première migration, seed (GPU + admin), `GET /api/health` | `npm run dev` démarre, la base contient les GPU du seed |
| B2 ✅ | Auth : register, login, me, bcrypt, JWT, middlewares `auth` et `requireRole`, rate limit Redis, format d'erreur commun | Login OK, 6ᵉ échec → 429, route admin refusée à un USER |
| B3 ✅ | GPU : liste avec filtres et disponibilité, détail | Les filtres de API.md renvoient les bons résultats |
| B4 | Recommandation | Les exemples de API.md donnent le résultat attendu |
| B5 | Contact | Le message est enregistré en base |
| B6 | Profil et locations utilisateur (créer, lister, annuler) | Une location qui dépasse le stock → 409 |
| B7 | Admin : stats, GPU, utilisateurs, locations, messages | Toutes les routes `/api/admin/*` répondent selon API.md |
| B8 ✅ | Outils du conseiller IA : caractéristiques des GPU, simulateur, analyse d'un dépôt GitHub, classement des configurations | Les tests du simulateur et de l'analyse passent |
| B9 ✅ | Conseiller IA : route de conversation, ajoutée à API.md | À partir d'un lien GitHub, l'IA renvoie un classement de configurations |

### Frontend — personne B
| Étape | Contenu | Terminée quand… |
|---|---|---|
| F1 ✅ | Projet Angular (standalone, strict), Tailwind avec tokens de DESIGN.md, routes, Navbar, Footer, page 404 | `npm start` affiche le layout responsive |
| F2 ✅ | Home et About | Pages complètes et responsives |
| F3 ✅ | Modèles TypeScript, `GpuService`, catalogue avec filtres, fiche GPU | Le catalogue s'affiche à partir de l'API |
| F4 ✅ | Recommandation | Le formulaire affiche le GPU conseillé et les alternatives |
| F5 ✅ | Contact | Message envoyé, confirmation affichée |
| F6 ✅ | Login, Register, `AuthService`, interceptors, guards | Connexion, déconnexion et routes protégées OK |
| F7 ✅ | Espace utilisateur : nouvelle location, mes locations, profil | Location créée puis annulée depuis l'interface |
| F8 ✅ | Espace admin : dashboard, GPU, utilisateurs, locations, messages | Toutes les actions admin fonctionnent |
| F9 ✅ | Motion & 3D (`docs/DESIGN-MOTION.md`) : planète Three.js synchronisée avec le réseau neuronal (`SceneSync`), défilement Lenis, cartes en verre | Planète grande sur Home et petite ailleurs, réseau relié au curseur conservé, versions légères (mobile, animations réduites, sans WebGL) |
| F10 ✅ | Conseiller IA sur `/recommend` (routes de API.md, section 10) : lien GitHub puis conversation, formulaire de F4 gardé en secours | L'utilisateur colle un lien et obtient un classement de configurations |

Tant qu'une route backend n'est pas prête, le frontend peut utiliser des données fictives
qui respectent **exactement** le format de API.md.

---

## 10. Organisation Git

- Une seule branche : `main`. Chacun commite et pousse directement sur `main`.
- Chacun ne modifie que son dossier : personne A → `backend/` et `docker-compose.yml`, personne B → `frontend/`.
- Avant de pousser : `git pull --rebase origin main` pour récupérer le travail de l'autre personne.
- Toute modification de `docs/API.md` est annoncée à l'autre personne **avant** d'être faite.
- Messages de commit courts : `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`.
