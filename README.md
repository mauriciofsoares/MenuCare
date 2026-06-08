# MenuCare

Monorepo inicial do MenuCare com:
- `apps/web`: frontend React + Vite
- `apps/api`: backend Fastify + Prisma
- PostgreSQL via Docker Compose

## Requisitos
- Node.js 20+
- Docker

## Setup rapido
1. Instale dependencias locais, se for desenvolver fora do Docker:
   - `npm install`
2. Suba a stack completa com Docker:
   - `npm run docker:up`
3. Se preferir rodar apenas o banco localmente:
   - `npm run db:up`
4. Configure variaveis da API para execucao local fora do Docker:
   - Copie `apps/api/.env.example` para `apps/api/.env`
5. Gere o client Prisma, quando estiver fora do Docker:
   - `npm run prisma:generate`
6. Rode migracao inicial, quando ja houver migration:
   - `npm run prisma:migrate`

## Desenvolvimento
- Web: `npm run dev:web`
- API: `npm run dev:api`
- Docker: `npm run docker:up`

## Healthcheck
- API: `http://localhost:3001/health`
- DB check: `http://localhost:3001/health/db`
- Web: `http://localhost:5173`
