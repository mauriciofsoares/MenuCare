# MenuCare

[![CI](https://github.com/mauriciofsoares/MenuCare/actions/workflows/ci.yml/badge.svg)](https://github.com/mauriciofsoares/MenuCare/actions/workflows/ci.yml)

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

## Qualidade
- Testes (API + Web): `npm test`
- Testes da API com PostgreSQL local (PowerShell): `$env:DATABASE_URL='postgresql://menucare:menucare@localhost:5432/menucare?schema=public'; npm run test --workspace apps/api`
- Testes E2E (Playwright): `npm run test:e2e`
- Listar testes E2E: `npm run test:e2e:list`
- Instalar browser do Playwright: `npm run test:e2e:install`
   - Cobertura inicial: `e2e/smoke.spec.ts` e `e2e/auth-flow.spec.ts` (abas de acesso + primeiro acesso sucesso/erro + login sucesso/erro + pos-login + logout com sucesso/falha + persistencia/expiracao de sessao + idioma global/empresa + contratos/regras/nao conformidades/importacao PDF com criacao/listagem + auditoria contratual de cardapio importado com resultados conforme/nao conforme + sugestoes de ajuste com prioridade e impacto financeiro + geracao de versao ajustada com horizonte e impacto consolidado + datas comemorativas com cadastro/listagem e prato nobre sugerido + importacao de avaliacao PDF com score/quantidade/comentarios + recalculo de inteligencia de combinacoes + previa/governanca com proposta e decisao do proximo cardapio (aprovacao/reprovacao, baseline sem historico e bloqueio obrigatorio) + validacao de justificativa minima + convite administrativo com geracao/regeneracao/revogacao e filtro de historico all/active/used com auditoria + cenarios de erro para rebuild/proposta/decisao e regeneracao/revogacao de convite + validacoes/transicoes com auditoria + exportacao CSV de historicos e compliance export audit com filtros avancados e escopo page/all + base estruturada de receitas com importacao estruturada e reclassificacao manual auditada + resiliencia em receitas (concorrencia em submit, retry manual apos falha temporaria e timeout do aviso de sucesso) + estabilidade em carga leve com importacoes sequenciais de receitas + volume moderado com importacoes e reclassificacoes sequenciais + stress/soak controlado com ciclos prolongados de importacao e reclassificacao + chaos/fault injection com falhas intermitentes e latencia extrema em sequencia longa, tudo com API mockada)
- Build (API + Web): `npm run build`
- Validacao de CI local (Prisma + testes + build): `npm run ci:validate`
- Pull Request com checklist de qualidade: `.github/pull_request_template.md`
- Responsaveis por revisao por area: `.github/CODEOWNERS`
- Guia de contribuicao: `CONTRIBUTING.md`
- Templates de issue: `.github/ISSUE_TEMPLATE/`
- Configuracao de triagem no GitHub (sem issue em branco): `.github/ISSUE_TEMPLATE/config.yml`
- Checklist mensal de governanca: `docs/governance-monthly-checklist.md`
- Historico mensal de auditorias: `docs/governance-audits/`
- Criar arquivo mensal de auditoria automaticamente: `npm run governance:audit:new`
   - Com mes explicito: `npm run governance:audit:new -- -Month 2026-07`
- Verificar auditoria do mes atual: `npm run governance:audit:check`
   - Modo estrito (falha se houver placeholders): `npm run governance:audit:check:strict`
- Workflow mensal de auditoria (GitHub Actions): `.github/workflows/governance-audit.yml`
   - Disparo manual por API (sem gh): `npm run governance:audit:dispatch`
   - Disparo manual com mes explicito: `npm run governance:audit:dispatch -- -Month 2026-07`

## Protecao de Branch (GitHub)
Para reforcar governanca de entrega, configure protecao da branch `main` exigindo aprovacao e CI verde antes de merge.

Pre-requisito de plano:
- Em repositorio privado, branch protection pode exigir GitHub Pro (conta pessoal) ou plano de organizacao compativel.
- Sem esse recurso liberado, mantenha governanca operacional com CI, template de PR e CODEOWNERS.

Opcao automatizada (sem GitHub CLI):
1. Defina um token com permissao de administracao do repositorio:
   - PowerShell: `$env:GITHUB_TOKEN="<seu_token>"`
2. Execute:
   - `npm run branch-protection:apply`

Passos no GitHub:
1. Abra `Settings` do repositorio.
2. Entre em `Branches` -> `Add branch protection rule`.
3. Em `Branch name pattern`, use `main`.
4. Ative `Require a pull request before merging`.
5. Ative `Require status checks to pass before merging` e selecione o check de CI (`CI / validate`).
6. Salve a regra.

Opcional recomendado:
- Ativar `Require branches to be up to date before merging`.
- Ativar `Require conversation resolution before merging`.
- Ativar `Do not allow bypassing the above settings` (quando aplicavel ao time).

## Healthcheck
- API: `http://localhost:3001/health`
- DB check: `http://localhost:3001/health/db`
- Web: `http://localhost:5173`
