# TeraMind

Corporate website of **TeraMind**, a fictional company that rents GPUs for AI workloads.
An AI advisor reads the GitHub repository of a model and recommends the best GPU configuration for it.

SUP'COM web project — team of 2: **Adem YOUSSFI** (frontend) and **Ahmed HEDHILI** (backend).

The frontend is complete and runs on its own with a simulated API. The real backend is in progress
(see [Project status](#project-status)).

## Quick start (frontend only)

No database and no backend are needed: the frontend ships with a simulated API.

Prerequisites: Node.js 22 LTS, npm, Git.

```bash
cd frontend
npm install
npm start          # http://localhost:4200
```

Demo accounts (simulated API):

| Role | Email | Password |
|---|---|---|
| User | `jane.doe@example.com` | `Password123` |
| Admin | `admin@teramind.example` | `Admin12345` |
| Blocked user | `blocked@example.com` | `Password123` |

The sign-in page lists these accounts: click one to fill in the form.

Everything you create (accounts, rentals, messages, GPUs) is stored in the browser's `localStorage`.
Clear the site data to go back to the demo data.

## Framework choice

**Frontend: Angular** (version 22, standalone components, strict TypeScript).

- It is the framework required by the course.
- Routing, forms, HTTP and tests are included: there are no extra libraries to choose and assemble.
- The structure is clear for beginners: one page = one component, with a `.ts` file (logic) and a `.html` file (view).
- **Guards** protect the user area (signed in) and the admin area (ADMIN role); **interceptors** add the JWT
  to every request and handle errors in one place.
- State is managed with Angular **signals** and a few services. No state library was needed.

| Part | Technologies |
|---|---|
| Frontend (`frontend/`) | Angular, Angular Router, HttpClient, Reactive Forms, Tailwind CSS 4, Three.js, Lenis, marked, Vitest |
| Backend (`backend/`) | Node.js, Express, TypeScript, Prisma, Zod, bcrypt, JWT, Vitest |
| Database | PostgreSQL |
| Cache | Redis (login rate limiting only) |
| Infrastructure | Docker Compose (PostgreSQL + Redis) |

Tailwind CSS holds the colors, font sizes and radii of the design charter as theme tokens
(`docs/DESIGN.md` → `frontend/src/styles.css`), so every page stays consistent.
The reasons behind each technology are detailed in [docs/objectif2/justification.md](docs/objectif2/justification.md) (in French).

## Features

All pages are responsive (phone, tablet, desktop).

### Public pages

| Page | Route | What it does |
|---|---|---|
| Home | `/` | Hero around the 3D planet, key figures, featured GPUs, how it works |
| About | `/about` | Mission, key figures, values, timeline, team |
| GPU catalog | `/gpus` | Search, filters (manufacturer, minimum VRAM, maximum price, availability on a period), sorting |
| GPU details | `/gpus/:id` | Specifications, price per hour, free units, "Rent this GPU" |
| GPU recommendation | `/recommend` | **AI advisor** (signed-in users): a conversation that starts from a GitHub repository link or a free description, and answers with up to three GPU configurations. **Quick form** as a fallback: model type, size, training or inference, budget per hour |
| Contact | `/contact` | Validated form; the message arrives in the admin inbox |
| Sign in / Create account | `/login`, `/register` | Validation, password strength meter, blocked-account message |
| Legal notice / Privacy policy | `/legal`, `/privacy` | Publisher, terms of service, credits; personal data collected, why, how long, and the user's rights. Linked from the footer, the sign-up form, the contact form and the AI advisor |

### User area (signed in)

| Page | Route | What it does |
|---|---|---|
| New rental | `/account/rentals/new` | Choose a GPU, a quantity, a start date and a duration; the estimated total and the units free on that period update as you type |
| My rentals | `/account/rentals` | Rentals by status (upcoming, active, completed, cancelled), cancel an upcoming rental |
| Profile | `/account/profile` | Edit name and email, change password |

### Admin area (ADMIN role)

| Page | Route | What it does |
|---|---|---|
| Dashboard | `/admin` | Revenue, rentals and users figures, monthly chart (also as a table), occupancy, top GPUs |
| GPUs | `/admin/gpus` | Add, edit, deactivate and reactivate GPUs, CSV export |
| Users | `/admin/users` | Search and filters, give or remove the admin role, block and unblock |
| Rentals | `/admin/rentals` | All rentals with filters, 14-day planning per GPU, cancel a rental, CSV export |
| Messages | `/admin/messages` | Contact inbox: read and unread, reply by email, delete |

### Across the site

- **Authentication**: JWT kept in the browser, routes protected by guards, automatic sign-out when the session expires.
- **Forms**: Reactive Forms with validation messages under each field and server errors mapped to fields.
- **Feedback**: loading skeletons, success and error alerts, confirmation dialogs before destructive actions.
- **Accessibility**: semantic HTML, keyboard focus, ARIA labels, contrast checked in the design charter,
  `prefers-reduced-motion` respected.
- **Tests**: 79 unit tests (Vitest) on services, pages and the simulated API.

### AI GPU advisor

The recommendation page is a conversation with an AI agent (`docs/API.md`, section 10):

- The user pastes the link of a public GitHub repository, describes the workload in plain text, or both.
- The agent reads the repository (model size, precision, LoRA / QLoRA, FlashAttention...) and shows what it understood,
  with the file that proves each fact. If something essential is missing, such as the dataset size, it asks.
- It simulates every configuration of the catalog (1, 2, 4 or 8 GPUs of each model) and answers with up to three
  configurations (best choice, cheapest, fastest), each with a time and cost estimate, warnings and a **Rent this** button.
- The answer arrives as a live stream: the steps of the agent, then the cards, then the text.
- Conversations are saved: the history lets the user reopen or delete them. There is a daily message limit.
- Prices, stock and estimates always come from the backend, never from the language model.

With the simulated API (the default), the advisor's answers are **simulated in the browser**: keywords are recognised
and the estimates use the same formulas as the backend simulator, but no language model is called and no repository
is really read. The real agent runs in the backend.

## Simulated API and real backend

`docs/API.md` is the contract between the two halves of the project.

- The frontend calls the API exactly as described in the contract. While the backend is being built, an Angular
  interceptor (`frontend/src/app/core/mocks/`) answers these calls with demo data in the same JSON format,
  including errors (401, 403, 404, 409, validation).
- The setting is `useMockApi` in `frontend/src/environments/environment.ts`. Setting it to `false` sends the
  calls to the real backend on `http://localhost:3000/api`.
- Today the real backend implements authentication, the GPU catalog and the AI advisor. The other pages still need
  the simulated API, so keep `useMockApi: true` for now.
- The AI advisor of the backend needs a language model: see the `GITHUB_TOKEN` and `LLM_*` settings in
  `backend/.env.example`. Without them the advisor is disabled and the quick form is shown instead.

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

- Three.js and Lenis are **lazy-loaded** after the first paint (not in the initial bundle). Every page is
  lazy-loaded too.
- **Adaptive quality**: the scene measures its frame rate and automatically drops the bloom effect, then the
  render resolution and the card blur, on slower computers. Phones and tablets get a lighter scene from the start.
- **Reduced motion** (`prefers-reduced-motion`): a single still frame, no smooth scrolling, no moving text.
- **No WebGL**: the planet is hidden and the neural network alone remains.
- Earth textures are stored locally in `frontend/public/textures/earth/` (credits in `CREDITS.md`).

## Project structure

```
.
├── backend/              Express + Prisma API (port 3000)
├── frontend/             Angular application (port 4200)
│   └── src/app/
│       ├── core/         models, services, guards, interceptors, simulated API (mocks)
│       ├── layout/       navbar, footer, animated background (planet + neural network)
│       ├── pages/        public/, account/, admin/ — one folder per page
│       └── shared/       reusable components, directives and utilities
├── docs/
│   ├── PLAN.md           Project plan: pages, components, database schema, steps
│   ├── API.md            API contract (routes, bodies, JSON responses, roles)
│   ├── DESIGN.md         Visual design reference (colors, fonts, components)
│   ├── DESIGN-MOTION.md  Motion, 3D scene and accent colors (extends DESIGN.md)
│   └── objectif2/        Sitemap, wireframes, design charter, technology choices
└── docker-compose.yml    PostgreSQL + Redis
```

## Project status

| Part | Done | Next |
|---|---|---|
| Backend | B1 setup (Docker, Prisma, seed, health) · B2 authentication (JWT, roles, Redis login rate limit) · security hardening · B3 GPU catalog (`GET /gpus`, `GET /gpus/:id`, availability) · B8 AI advisor tools (workload simulator, GitHub repo analysis, configuration ranking) · B9 AI advisor (conversations, live stream, daily quota) | B4–B7 (recommendation form, contact, rentals, admin) |
| Frontend | F1–F10: layout, every public page, user area, admin area, motion & 3D, AI advisor — all on the simulated API | F11 switch to the real API as the backend routes arrive |

## Getting started (full stack)

Prerequisites: Node.js 22 LTS, npm, Docker Desktop, Git.

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

# 3. Frontend (http://localhost:4200), in a second terminal
cd frontend
npm install
npm start
```

Other frontend commands, from `frontend/`:

```bash
npm test           # unit tests
npm run build      # production build in frontend/dist/
```

## Team workflow

- **Person A** owns `backend/` and `docker-compose.yml`.
- **Person B** owns `frontend/`.
- Everyone commits and pushes directly to `main`; run `git pull --rebase origin main` before pushing.
- Tasks are tracked on a GitHub Projects board: [TeraMind – Projet Web](https://github.com/users/ademyoussfi52-lang/projects/1)
  (steps B1–B9 for the backend, F1–F10 for the frontend, with their status and owner).
- `docs/API.md` is the contract between frontend and backend: any change is discussed first.
- Secrets live in `backend/.env`, which is never committed.

## Documentation

- [Project plan](docs/PLAN.md)
- [API contract](docs/API.md)
- [Design reference](docs/DESIGN.md)
- [Motion & 3D](docs/DESIGN-MOTION.md)
- [Objectif 2: sitemap, wireframes, charter, technology choices](docs/objectif2/)
