# MenuCare - Plano de Implementacao SaaS (React + Login + PostgreSQL)

## 1. Diagnostico do cenario atual

### Estado atual do projeto
- Frontend estatico em arquivos locais:
  - index.html (pagina de vendas)
  - portal.html, portal.css, portal.js (portal/dashboards)
  - styles.css, script.js
- Nao ha backend, banco de dados, autenticacao ou API.
- Nao ha controle de sessao, perfis de usuario, trilha de auditoria ou multitenancy.

### Impacto
- Bom para prototipo visual.
- Nao sustentavel para produto SaaS com login, dados persistentes e operacao multi-cliente.

---

## 2. Objetivo da migracao

Transformar o prototipo atual em uma base SaaS pronta para evolucao com:
- Frontend React tipado.
- Backend com API segura.
- Banco PostgreSQL.
- Login com sessao e papeis.
- Fundacoes para contratos, regras, auditoria de cardapios, controle financeiro e conformidade.

Importante:
- O MenuCare nao substitui a Genial.
- O MenuCare atua como camada de governanca, conformidade e otimizacao sobre o cardapio operacional da Genial.

---

## 3. Arquitetura alvo recomendada

## Frontend
- React + TypeScript + Vite
- React Router
- React Query (cache de API)
- Design system interno (tokens CSS + componentes)

## Backend
- Node.js + TypeScript
- Fastify (ou Express, se preferir simplicidade)
- Prisma ORM
- Zod para validacao de entrada

## Banco de dados
- PostgreSQL

## Autenticacao
- Sessao com JWT (access token curto + refresh token rotativo)
- Cookies httpOnly + sameSite
- Hash de senha com Argon2

## Infra e qualidade
- Docker Compose (api + postgres)
- ESLint + Prettier
- Testes:
  - Unitarios (Vitest/Jest)
  - Integracao API (Supertest)
  - E2E (Playwright)

---

## 4. Roadmap de implementacao por fases

## Fase 0 - Setup de monorepo e base tecnica (2-3 dias)
### Entregas
- Estrutura:
  - apps/web
  - apps/api
  - packages/ui (opcional, se quiser componentizar cedo)
- Config TypeScript, lint, format, scripts padrao.
- Docker Compose com PostgreSQL.

### Criterio de pronto
- Projeto sobe com `docker compose up` e `npm run dev`.

---

## Fase 1 - Autenticacao e acesso (3-5 dias)
### Escopo
- Tela de login.
- Tela de cadastro inicial (admin da conta).
- Fluxo de recuperar senha (stub inicial).
- Guardas de rota no frontend.
- Endpoint de login/logout/me.

### Entidades iniciais
- tenants
- users
- user_roles
- sessions_refresh_tokens

### Criterio de pronto
- Usuario loga, permanece autenticado e faz logout.
- Rotas protegidas exigem sessao valida.

---

## Fase 2 - Migracao do portal estatico para React (4-6 dias)
### Escopo
- Recriar layout atual no React mantendo identidade visual aprovada.
- Componentes principais:
  - Sidebar
  - Header
  - KPIs
  - Tabela de contratos
  - Donut de categorias
  - Drawer de suporte
- Tema dark/light funcional por estado global.
- Responsividade revisada (sem scroll horizontal indevido).

### Criterio de pronto
- Paridade visual com portal atual.
- Navegacao interna React sem reload.

---

## Fase 3 - Base de dados de dominio (5-8 dias)
### Escopo (MVP de negocio)
- Contratos:
  - cadastro
  - listagem
  - detalhes
  - status
- Regras contratuais:
  - identificada
  - em validacao
  - aprovada
  - rejeitada
  - arquivada
- Auditoria:
  - quem alterou
  - quando alterou
  - o que alterou

### Entidades (primeira versao)
- contracts
- contract_versions
- extracted_rules
- rule_validations
- audit_logs

### Criterio de pronto
- CRUD basico com persistencia real no PostgreSQL.

---

## Fase 4 - Dashboard com dados reais (3-5 dias)
### Escopo
- Substituir mocks por consultas reais.
- KPIs com agregacoes por tenant.
- Lista de contratos recentes.
- Regras pendentes de validacao.

### Criterio de pronto
- Dashboard renderiza dados reais do banco.

---

## Fase 5 - Suporte e operacao inicial (2-4 dias)
### Escopo
- Modulo suporte com canais de contato em configuracao.
- Opcional MVP: abertura de chamado simples.
- Tabela de chamados do cliente.

### Criterio de pronto
- Usuario encontra contato e registra solicitacao (se escopo chamado ativo).

---

## Fase 6 - Integracao operacional com relatorio da Genial (4-7 dias)
### Escopo
- Importacao de PDF de cardapio com pre-custo gerado pela Genial.
- Extracao de unidade, servico, data, receitas, meta e custo.
- Validacao financeira por refeicao (meta x custo).

### Criterio de pronto
- Relatorio importado gera itens auditaveis por unidade/servico/data com status financeiro.

---

## Fase 7 - Auditoria contratual + sugestoes de ajuste (5-8 dias)
### Escopo
- Comparar cardapio importado x regras aprovadas.
- Gerar nao conformidades contratuais e financeiras.
- Produzir sugestoes de ajuste rastreaveis por regra e impacto.

### Criterio de pronto
- Nutricionista visualiza divergencias e consegue gerar versao ajustada com justificativa.

---

## Fase 8 - Avaliacoes e inteligencia de combinacoes (5-8 dias)
### Escopo
- Importacao de PDF de avaliacoes das refeicoes.
- Cruzamento avaliacao x combinacao servida.
- Historico de desempenho por combinacao (nota media, volume, tendencia).
- Motor de recomendacao com prioridade inferior para avaliacoes historicas (nao bloqueante).

### Criterio de pronto
- Recomendacoes futuras consideram contrato, custo, nutricao e aceitacao historica sem bloquear decisao do nutricionista por nota baixa ou ausencia de historico.

---

## 5. Modelo de dados inicial (MVP)

## Autenticacao e conta
- tenants(id, name, cnpj, plan, created_at)
- users(id, tenant_id, name, email, password_hash, status, created_at)
- roles(id, key)
- user_roles(user_id, role_id)
- refresh_tokens(id, user_id, token_hash, expires_at, revoked_at)

## Dominio
- contracts(id, tenant_id, title, source_type, status, created_by, created_at)
- contract_files(id, contract_id, file_name, file_url, mime_type, uploaded_at)
- extracted_rules(id, contract_id, title, description, category, status, confidence, created_at)
- rule_validations(id, rule_id, action, comment, performed_by, performed_at)
- audit_logs(id, tenant_id, entity, entity_id, action, payload_json, actor_id, created_at)

Indices obrigatorios:
- tenant_id em tabelas de dominio.
- email unico por tenant em users.
- status + created_at para consultas de dashboard.

---

## 6. Seguranca e conformidade (desde o inicio)

- Multitenancy logico: todo acesso filtrado por tenant_id.
- Senhas com Argon2.
- Refresh token rotativo e revogavel.
- Rate limit em login.
- Logs de auditoria para acoes criticas.
- Sanitizacao e validacao de inputs (Zod).
- Politica de CORS e cookies segura por ambiente.

---

## 7. Plano de migracao do frontend atual

## Estrategia
1. Congelar alteracoes grandes no HTML estatico.
2. Criar novo app React em paralelo.
3. Migrar layout por blocos (sidebar, header, cards, tabela).
4. Conectar com API gradualmente (primeiro auth, depois dashboard, depois dominio).
5. Descontinuar portal.html quando houver paridade funcional.

## Risco principal
- Perder fidelidade visual durante migracao.

## Mitigacao
- Checklist de paridade por tela.
- Revisao visual a cada componente migrado.

---

## 8. Backlog inicial (ordem recomendada)

1. Bootstrap de repositorio React + API + Postgres.
2. Prisma schema inicial + migrations.
3. Auth backend (login/logout/me/refresh).
4. Tela Login React + guardas de rota.
5. Layout base do portal em React.
6. Dashboard com dados mockados via hooks.
7. Endpoints de contratos/regras.
8. Dashboard com dados reais.
9. Auditoria de validacao de regras.
10. Hardening de seguranca + testes E2E.
11. Importacao de relatorio de cardapio da Genial com pre-custo.
12. Auditoria contratual/financeira do cardapio importado.
13. Motor de sugestoes de ajuste e geracao de versao ajustada.
14. Importacao de avaliacoes e inteligencia de combinacoes.

---

## 9. Criterios de sucesso do MVP

- Usuario autentica e acessa portal de forma segura.
- Dados persistem no PostgreSQL por tenant.
- Dashboard mostra indicadores reais.
- Regras contratuais podem ser validadas com rastreabilidade.
- Cardapio importado da Genial pode ser auditado por conformidade e custo.
- Recomendacoes de ajuste consideram historico de aceitacao sem transformar avaliacao em criterio de bloqueio.
- UI permanece com padrao SaaS premium aprovado.

---

## 10. Proxima acao sugerida (imediata)

Criar a Fase 0 agora com os comandos e estrutura inicial:
- Monorepo com apps/web e apps/api
- Docker Compose com Postgres
- Prisma configurado
- Login minimo ponta a ponta (Fase 1 reduzida)

Se aprovado, o proximo passo e executar esse bootstrap no repositorio atual.

---

## 11. Status de conformidade com este plano (jun/2026)

Resumo objetivo por fase:

- Fase 0 (setup de monorepo e base tecnica): CONCLUIDA.
  - Evidencias: estrutura apps/web + apps/api ativa, Docker Compose e scripts operacionais no workspace.

- Fase 1 (autenticacao e acesso): MAJORITARIAMENTE CONCLUIDA.
  - Evidencias: endpoints auth/login, auth/me, auth/logout e fluxo de primeiro acesso por convite.
  - Observacao: plano original cita refresh token rotativo/cookies httpOnly; essa parte ainda pode evoluir.

- Fase 2 (migracao portal para React): CONCLUIDA PARA O ESCOPO MVP ATUAL.
  - Evidencias: portal em React+TypeScript com operacao autenticada e modulos ativos.

- Fase 3 (base de dados de dominio + auditoria): CONCLUIDA COM EXTENSOES.
  - Evidencias: contratos, regras, nao conformidades, plano de acao e trilhas de auditoria/exportacao com PostgreSQL.

- Fase 4 (dashboard com dados reais): CONCLUIDA.
  - Evidencias: endpoint de resumo e renderizacao de indicadores/recentes com dados persistidos.

- Fase 5 (suporte e operacao inicial): PARCIAL.
  - Evidencias: operacao e governanca evoluidas; modulo de chamados dedicado ainda pendente.

Qualidade e testes (secao 3 e backlog item 10): EM EVOLUCAO.

- Entregue neste ciclo:
  - Testes de integracao de API com Supertest para saude, login e protecao de rota.
  - Script de teste no workspace apps/api e ajuste de boot para testabilidade.
  - Hardening de login com rate limit por email (bloqueio temporario por excesso de tentativas).

- Pendente para fechamento completo do plano:
  - Suite de testes unitarios mais ampla.
  - E2E (Playwright).
  - Hardening final de seguranca (ex.: refresh token rotativo/cookies httpOnly em producao).
