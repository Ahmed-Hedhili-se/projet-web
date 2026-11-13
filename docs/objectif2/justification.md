# TeraMind — Justification des choix technologiques

> Objectif 2 · Projet web SUP'COM · équipe de 2 (personne A : backend, personne B : frontend)

TeraMind est le site d'une entreprise fictive qui loue des GPU pour l'intelligence artificielle
et recommande le GPU adapté à un modèle. Il a besoin :

- de **pages publiques** (accueil, catalogue avec filtres, recommandation, contact) ;
- d'un **espace utilisateur** (louer un GPU, voir et annuler ses locations, profil) ;
- d'un **espace administrateur** (statistiques, gestion des GPU, des utilisateurs, des locations et des messages).

Nos choix suivent un principe simple : **utiliser peu d'outils, bien maîtrisés, chacun avec un rôle clair**.

---

## 1. Vue d'ensemble

| Couche | Technologie choisie | Rôle |
|---|---|---|
| Structure & style | HTML, CSS, TypeScript | Base du contenu, de la mise en forme et de la logique |
| Frontend framework | **Angular** + Tailwind CSS | Interface dynamique : pages, navigation, formulaires |
| Backend framework | **Node.js + Express** (TypeScript) | API REST : données et logique métier (prix, disponibilité, recommandation) |
| Base de données | **PostgreSQL** + Prisma | Stockage relationnel des utilisateurs, GPU, locations et messages |
| Sécurité | bcrypt, JWT, Zod, Redis | Mots de passe, connexion, validation des données, limitation des tentatives |
| Outils | Docker Compose, Git/GitHub, VS Code, Vitest, draw.io | Lancement de la base, travail en équipe, tests, schémas |

```
Navigateur ──► Angular (port 4200) ──HTTP/JSON──► Express (port 3000) ──Prisma──► PostgreSQL
                                                        └── Redis (limite des tentatives de connexion)
```

---

## 2. Frontend

### HTML, CSS, TypeScript
- **Rôle :** la base de toute page web. Nous écrivons en **TypeScript**, du JavaScript avec des types.
- **Pourquoi :** les types détectent beaucoup d'erreurs avant même de lancer le site (par exemple un champ mal nommé dans une réponse de l'API).

### Angular (dernière version stable, composants standalone, TypeScript strict)
- **Rôle :** construire l'interface : une page = un composant, avec la navigation entre les pages (Router), les appels à l'API (HttpClient) et les formulaires avec validation (Reactive Forms).
- **Pourquoi :**
  - c'est le framework **imposé** par le cours ;
  - tout est inclus : routage, formulaires, HTTP, tests. Il n'y a **pas de bibliothèques supplémentaires** à choisir et à assembler ;
  - la structure est **claire pour des débutants** : chaque page a son fichier `.ts` (logique) et son fichier `.html` (affichage), et les éléments réutilisables vont dans `shared/` ;
  - les **guards** protègent simplement l'espace utilisateur (il faut être connecté) et l'espace admin (il faut le rôle ADMIN).

### Tailwind CSS
- **Rôle :** mettre en forme les pages avec des classes courtes directement dans le HTML (`rounded-card`, `text-ash`…).
- **Pourquoi :**
  - les **couleurs, tailles et arrondis de la charte graphique** sont déclarés une seule fois comme « tokens » (`docs/DESIGN.md` → `frontend/src/styles.css`). Tout le site reste cohérent ;
  - le responsive est facile (`md:`, `lg:`), et il n'y a pas de gros fichiers CSS à maintenir.

---

## 3. Backend

### Node.js + Express (TypeScript)
- **Rôle :** l'API REST, c'est-à-dire les routes décrites dans `docs/API.md` (connexion, catalogue, recommandation, locations, administration). C'est le backend qui calcule le **prix**, la **disponibilité** des GPU sur une période et la **recommandation**.
- **Pourquoi :**
  - c'est **le même langage (TypeScript) que le frontend** : les deux membres de l'équipe se comprennent et peuvent se relire ;
  - Express est **minimaliste** : une route = une fonction. C'est facile à apprendre et suffisant pour notre API ;
  - l'écosystème est très large et la documentation abondante.

### Zod
- **Rôle :** vérifier les données reçues (email valide, durée entre 1 et 720 heures…) avant de les traiter.
- **Pourquoi :** on décrit les règles une seule fois, et les erreurs sont renvoyées dans un format unique (`VALIDATION_ERROR`) que le frontend sait afficher sous chaque champ.

### bcrypt + JWT
- **Rôle :** bcrypt **hache les mots de passe** (ils ne sont jamais stockés en clair). JWT est le **jeton de connexion** que le frontend envoie à chaque requête.
- **Pourquoi :** ce sont des solutions standard, simples et sûres. Le JWT contient l'identifiant et le rôle (USER ou ADMIN), ce qui permet de protéger les routes admin.

### Redis (usage unique)
- **Rôle :** **seulement** compter les échecs de connexion et bloquer après 5 essais ratés en 15 minutes.
- **Pourquoi :** Redis garde ce compteur en mémoire avec une durée d'expiration automatique. On ne l'utilise pour rien d'autre, afin de ne pas ajouter de complexité.

---

## 4. Base de données

### PostgreSQL
- **Rôle :** stocker durablement les **utilisateurs**, les **GPU**, les **locations** et les **messages de contact**.
- **Pourquoi :**
  - c'est la base **imposée** par le cours ;
  - nos données sont **relationnelles** : un utilisateur a plusieurs locations, et une location concerne un GPU. Une base SQL est donc le choix naturel ;
  - les **requêtes sur des périodes** (« ce GPU est-il déjà loué entre telle date et telle date ? ») et les **statistiques** du dashboard (revenus par mois, top des GPU) s'écrivent bien en SQL.

### Prisma
- **Rôle :** faire le lien entre le code TypeScript et PostgreSQL (ORM).
- **Pourquoi :**
  - le **schéma** des tables est lisible dans un seul fichier (`schema.prisma`, voir `docs/PLAN.md`) ;
  - les **migrations** créent et modifient les tables automatiquement ;
  - les requêtes sont **typées** : une faute dans un nom de champ est signalée immédiatement.

---

## 5. Outils

| Outil | Rôle | Pourquoi |
|---|---|---|
| **Docker Compose** | Lancer PostgreSQL et Redis avec une seule commande (`docker compose up -d`) | Les deux membres ont exactement le même environnement, sans rien installer à la main |
| **Git + GitHub** | Historique du code et partage dans l'équipe | Chacun travaille sur son dossier (`frontend/` ou `backend/`) et pousse sur `main` |
| **VS Code** | Éditeur de code | Gratuit, très bon support de TypeScript et d'Angular |
| **Vitest** | Tests unitaires du frontend | Fourni avec Angular, rapide ; vérifie les services, les pages et les règles métier |
| **draw.io, SVG** | Sitemap, wireframes et charte graphique (ce livrable) | Gratuits, fichiers modifiables et versionnés avec le code |

---

## 6. Pas de surenchère technologique

Le cours le rappelle : *« mieux vaut un design clair et bien structuré qu'un site complexe mal pensé »*.
Nous avons donc **volontairement écarté** :

| Écarté | Pourquoi |
|---|---|
| Microservices, Kubernetes | Un seul petit backend suffit largement pour ce projet |
| GraphQL | Une API REST simple, décrite dans `docs/API.md`, est plus facile à comprendre et à tester |
| NgRx (gestion d'état avancée) | Les **signals** d'Angular et quelques services suffisent |
| Bibliothèque de graphiques | Les graphiques du dashboard sont faits en **HTML/CSS/SVG**, plus légers et entièrement à notre style |
| Bibliothèque de composants (Material, Bootstrap) | Le design suit notre propre charte ; Tailwind suffit |
| Plusieurs bases de données | PostgreSQL pour les données ; Redis réservé à une seule tâche précise |
| Serveur de rendu (SSR) | Inutile pour un projet d'école ; le site fonctionne entièrement dans le navigateur |

Chaque outil gardé répond à **un besoin réel** du projet, et chaque besoin a **un seul outil**.

---

## 7. Organisation de l'équipe

- **`docs/API.md` est le contrat** entre le frontend et le backend : routes, données envoyées et réponses JSON exactes. Le backend l'implémente et le frontend l'appelle, sans surprise.
- En attendant le backend, le frontend utilise des **données fictives au format exact de l'API** (un interceptor Angular). Le jour où le backend est prêt, il suffit de changer **un seul réglage** (`useMockApi: false`).
- **`docs/PLAN.md`** décrit les pages, le schéma de la base et les étapes de développement de chacun.
