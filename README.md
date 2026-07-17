# Fleet Management System

Production-oriented npm workspaces monorepo scaffold for a Fleet Management System. It contains a Next.js frontend, a NestJS API, PostgreSQL with Prisma ORM, shared development tooling, and Docker support. Business features are intentionally not implemented yet.

## Structure

```text
frontend/  Next.js App Router application
backend/   NestJS API and Prisma schema
docs/      Architecture and project documentation
```

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- Docker with Docker Compose (for the containerized workflow)

## Local development

1. Copy `backend/.env.example` to `backend/.env`.
2. Start PostgreSQL with `docker compose up postgres -d`.
3. Generate the Prisma client with `npm run db:generate`.
4. Apply the database migration with `npm run db:migrate`.
5. Start both applications with `npm run dev`.

The frontend is available at `http://localhost:3000` and the API at `http://localhost:3001`.

## Commands

- `npm run dev` — run frontend and backend in watch mode
- `npm run build` — build all workspaces
- `npm run lint` — lint all workspaces
- `npm run format` — format the repository
- `npm run db:generate` — generate the Prisma client
- `npm run db:migrate` — create/apply a development migration
- `npm run db:migrate:deploy` — apply committed migrations in production
- `docker compose up --build` — run the complete stack

See [docs/architecture.md](docs/architecture.md) for the initial architecture boundary.
