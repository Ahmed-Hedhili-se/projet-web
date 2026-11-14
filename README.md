# TeraMind

Corporate website of **TeraMind**, a fictional company that rents GPUs for AI workloads
and recommends the best GPU for a given model.

SUP'COM web project — team of 2.

## Features

- **Public pages:** Home, About, GPU catalog with filters, GPU recommendation, Contact, Login / Register
- **User area:** rent a GPU (start date, duration in hours), view and cancel rentals, profile
- **Admin area:** dashboard with statistics, management of GPUs, users (role, blocking), rentals and contact messages

## Tech stack

| Part | Technologies |
|---|---|
| Frontend (`frontend/`) | Angular (standalone components, strict TypeScript), Angular Router, HttpClient, Tailwind CSS |
| Backend (`backend/`) | Node.js, Express, TypeScript, Prisma, Zod, bcrypt, JWT |
| Database | PostgreSQL |
| Cache | Redis (login rate limiting only) |
| Infrastructure | Docker Compose (PostgreSQL + Redis) |

## Motion & 3D

The frontend has a fixed animated background shared by every page (see [docs/DESIGN-MOTION.md](docs/DESIGN-MOTION.md)):

- **3D planet** (Three.js): day/night side, city lights, oceans, clouds, atmosphere halo, stars and pulsing
  data-center markers. Big on Home, where it moves with the scroll; small in the bottom-right corner on other pages.
- **Neural network** (2D canvas): nodes linked to each other and to the cursor. It flows around the planet,
  plugs into the data centers and sends small "data packets" to them.
- **Aurora accent color**: shifts from blue to violet to cyan with the scroll and from page to page
  (CSS variables `--aurora` and `--aurora-text`).
- **Smooth scrolling** (Lenis), glass cards over the scene, word-by-word text reveals, animated figures.

The two canvases are kept in sync by `frontend/src/app/core/services/scene-sync.ts`.

Performance and accessibility:

- Three.js and Lenis are **lazy-loaded** after the first paint (not in the initial bundle).
- **Adaptive quality**: the scene measures its frame rate and automatically drops the bloom effect, then the
  render resolution and the card blur, on slower computers. Phones and tablets get a lighter scene from the start.
- **Reduced motion** (`prefers-reduced-motion`): a single still frame, no smooth scrolling, no moving text.
- **No WebGL**: the planet is hidden and the neural network alone remains.
- Earth textures are stored locally in `frontend/public/textures/earth/` (credits in `CREDITS.md`).

## Project structure

```
.
├── backend/            Express + Prisma API (port 3000)
├── frontend/           Angular application (port 4200)
├── docs/
│   ├── PLAN.md         Project plan: pages, components, database schema, steps
│   ├── API.md          API contract (routes, bodies, JSON responses, roles)
│   ├── DESIGN.md       Visual design reference (colors, fonts, components)
│   └── DESIGN-MOTION.md  Motion, 3D scene and accent colors (extends DESIGN.md)
└── docker-compose.yml  PostgreSQL + Redis
```

## Project status

| Part | Done | Next |
|---|---|---|
| Backend | B1 setup (Docker, Prisma, seed, health) · B2 authentication (JWT, roles, Redis login rate limit) · security hardening · B3 GPU catalog (`GET /gpus`, `GET /gpus/:id`, availability) · B8 AI advisor tools (workload simulator, GitHub repo analysis, configuration ranking) | B4–B7 (recommendation, contact, rentals, admin) · B9 AI advisor chat |
| Frontend | F1 layout · F2 Home and About · catalog, recommendation, contact and login pages (mock data) | Switch to the real API |

## Getting started

Prerequisites: Node.js (LTS), npm, Docker Desktop, Git.

```bash
# 1. Start PostgreSQL and Redis
docker compose up -d

# 2. Backend (http://localhost:3000)
cd backend
cp .env.example .env        # then fill in the values
npm install
npx prisma migrate dev
npx prisma db seed
npm test                    # backend tests (Docker must be running)
npm run dev

# 3. Frontend (http://localhost:4200)
cd frontend
npm install
npm start
```

## Team workflow

- **Person A** owns `backend/` and `docker-compose.yml`.
- **Person B** owns `frontend/`.
- Everyone commits and pushes directly to `main`; run `git pull --rebase origin main` before pushing.
- `docs/API.md` is the contract between frontend and backend: any change is discussed first.
- Secrets live in `backend/.env`, which is never committed.

## Documentation

- [Project plan](docs/PLAN.md)
- [API contract](docs/API.md)
- [Design reference](docs/DESIGN.md)
- [Motion & 3D](docs/DESIGN-MOTION.md)
