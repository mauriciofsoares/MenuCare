# MenuCare

Monorepo inicial do MenuCare com:
- `apps/web`: frontend React + Vite
- `apps/api`: backend Fastify + Prisma
- PostgreSQL via Docker Compose

## Requisitos
- Node.js 20+
- Docker

## Setup rapido
1. Instale dependencias:
   - `npm install`
2. Suba o banco:
   - `npm run db:up`
3. Configure variaveis da API:
   - Copie `apps/api/.env.example` para `apps/api/.env`
4. Gere o client Prisma:
   - `npm run prisma:generate`
5. Rode migracao inicial (quando ja houver migration):
   - `npm run prisma:migrate`

## Desenvolvimento
- Web: `npm run dev:web`
- API: `npm run dev:api`

## Healthcheck
- API: `http://localhost:3001/health`
- DB check: `http://localhost:3001/health/db`
