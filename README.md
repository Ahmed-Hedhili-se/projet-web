# NeuroGrid

Corporate website of **NeuroGrid**, a fictional company that rents GPUs for AI workloads
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

## Project structure

```
.
├── backend/            Express + Prisma API (port 3000)
├── frontend/           Angular application (port 4200)
├── docs/
│   ├── PLAN.md         Project plan: pages, components, database schema, steps
│   └── API.md          API contract (routes, bodies, JSON responses, roles)
├── DESIGN.md           Visual design reference
└── docker-compose.yml  PostgreSQL + Redis (coming in step B1)
```

## Getting started

> The application is not implemented yet. These commands will work once steps B1 and F1 are done.

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
npm run dev

# 3. Frontend (http://localhost:4200)
cd frontend
npm install
npm start
```

## Team workflow

- **Person A** owns `backend/` and `docker-compose.yml` and works on the `backend` branch.
- **Person B** owns `frontend/` and works on the `frontend` branch.
- Nobody works directly on `main`; changes are merged through pull requests.
- `docs/API.md` is the contract between frontend and backend: any change is discussed first.
- Secrets live in `backend/.env`, which is never committed.

## Documentation

- [Project plan](docs/PLAN.md)
- [API contract](docs/API.md)
- [Design reference](DESIGN.md)
