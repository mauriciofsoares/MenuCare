# MenuCare - Plano de Implementacao SaaS (React + Login + PostgreSQL)

## 1. Diagnostico do cenario atual

### Estado atual do projeto
- Monorepo ativo com aplicacoes em producao de desenvolvimento:
  - apps/web (React + TypeScript + Vite)
  - apps/api (Node.js + TypeScript + Fastify + Zod)
- Banco PostgreSQL integrado via Prisma (com suporte de runtime fallback em parte do dominio).
- Fluxos principais ja implementados no MVP atual:
  - autenticacao e autorizacao basicas
  - contratos, regras e trilhas de auditoria
  - importacao e auditoria de cardapios
  - sugestoes de ajuste e versoes ajustadas
  - importacao de avaliacoes e inteligencia de combinacoes
  - geracao de proposta de proximo cardapio recomendado
- Ainda existem artefatos estaticos legados (index.html, portal.html, portal.css, portal.js, styles.css, script.js), nao sendo mais a base principal do produto.

### Impacto
- A base SaaS ja sustenta operacao funcional de MVP com governanca, rastreabilidade e conformidade.
- O foco atual migrou de bootstrap para consolidacao operacional, hardening de seguranca e qualidade fim a fim.

---

## 2. Objetivo da migracao

Transformar o prototipo atual em uma base SaaS pronta para evolucao com:
- Frontend React tipado.
- Backend com API segura.
- Banco PostgreSQL.
- Login com sessao e papeis.
- Fundacoes para contratos, regras, auditoria de cardapios, controle financeiro e conformidade.
- Base Estruturada de Receitas como ativo central reutilizavel em conformidade, financeiro e avaliacoes.

Importante:
- O MenuCare nao substitui a Genial.
- O MenuCare atua como camada de governanca, conformidade e otimizacao sobre o cardapio operacional da Genial.

### Principio de arquitetura
- A IA deve atuar apenas em interpretacao documental, classificacao semantica, geracao de sugestoes e recomendacoes futuras.
- Conformidade, metas financeiras, frequencia de receitas, auditoria e bloqueios devem ser tratados por regras estruturadas e deterministicas.
- A base estruturada de contratos + receitas + avaliacoes e o ativo central; a IA alimenta e explora essa base, mas nao substitui as validacoes.

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

## Fase 5.1 - Base Estruturada de Receitas (prioritaria) (6-10 dias)
### Escopo
- Importacao de fichas tecnicas de receitas da Genial (PDF).
- Leitura e armazenamento estruturado de:
  - nome
  - ingredientes
  - modo de preparo
  - per capita
  - rendimento
  - grupo alimentar
  - valor nutricional (quando disponivel)
- Classificacao automatica por categoria/subcategoria/grupo alimentar.
- Catalogo unico de receitas reutilizavel por todos os modulos.
- Modelo base de Biblioteca Nutricional por receita:
  - categoria macro (proteina, carboidrato, legume, verdura, fruta, sobremesa)
  - dieta compativel
  - alergenos

### Status atual
- R1 concluida:
  - persistencia da biblioteca de receitas
  - importacao estruturada
  - listagem operacional no backend e frontend
- R2 concluida:
  - classificador automatico inicial
  - reclassificacao manual auditada
  - feedback operacional na interface
- R3 concluida:
  - auditoria contratual usando classificacao estruturada como fonte primaria
  - fallback textual somente quando necessario
  - metricas de cobertura por tenant
  - explicabilidade de auditoria e sugestoes na interface
- R4 concluida no escopo atual:
  - sugestoes mais especificas por grupo alimentar com substituicoes equivalentes mais precisas
  - auditoria estruturada para frequencia semanal e recorrencia minima
  - badges e explicabilidade dedicados no frontend para frequencia e recorrencia estruturadas
  - contrato da API de sugestoes com `evidenceSubtype` explicito (`frequency`, `recurrence`, `classification` ou `null`)
  - componente dedicado de badges de evidencia no frontend para reduzir acoplamento do App principal
  - teste de integracao de componente para badges (render + classe CSS) cobrindo auditoria e sugestoes
  - setup global de testes no Vitest com jsdom + cleanup automatico entre casos, evitando dependencia de limpeza local por arquivo

### Proximo incremento prioritario
- ampliar a cobertura da biblioteca para reduzir casos que ainda dependem de fallback textual
- enriquecer substituicoes equivalentes com contexto nutricional e historico operacional, mantendo bloqueios sempre deterministas

### Criterio de pronto
- Receita importada passa a ter identidade estruturada unica no tenant.
- Cardapio importado referencia receitas conhecidas sem depender apenas de texto livre.
- Regras contratuais por grupo (ex.: fruta citrica, peixe) passam a operar sobre classificacao estruturada.

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

## Fase 9 - Operacionalizacao do aprendizado de combinacoes (3-5 dias)
### Escopo
- Transformar pre-visualizacao de recomendacao em proposta operacional de proximo cardapio.
- Gerar proposta com explicabilidade:
  - origem da recomendacao (historico ou baseline)
  - custo estimado versus meta financeira
  - evidencias de governanca obrigatoria
- Garantir regra de negocio central:
  - avaliacoes historicas recomendam, mas nunca bloqueiam geracao/aprovacao.

### Criterio de pronto
- Usuario consegue gerar proposta de proximo cardapio com governanca explicita.
- Somente criterios obrigatorios podem sinalizar bloqueio (contrato, custo, restricao obrigatoria, regra operacional critica).

---

## Fase 10 - Decisao operacional e fechamento do ciclo (4-7 dias)
### Escopo
- Aprovar/reprovar proposta de proximo cardapio com justificativa.
- Persistir versao aprovada como referencia operacional do ciclo seguinte.
- Registrar auditoria completa da decisao (quem, quando, o que, por que).
- Disponibilizar historico de decisoes para rastreabilidade e analise.
- Permitir gerar versao ajustada para o mes base do cardapio importado ou ate 3 meses futuros.
- Incluir aba de datas comemorativas para cadastro anual e uso pelo gerador na priorizacao de pratos nobres em datas especiais.

### Criterio de pronto
- Fluxo estrategico fica completo ponta a ponta:
  - Contrato -> Regras aprovadas -> Cardapio atual -> Auditoria -> Sugestoes -> Novo cardapio -> Avaliacoes -> Aprendizado -> Proximo cardapio melhor.
- Historico permanece camada de recomendacao nao bloqueante em toda a jornada.

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
11. Importacao de fichas tecnicas de receitas da Genial.
12. Catalogo de receitas com classificacao automatica e Biblioteca Nutricional.
13. Importacao de relatorio de cardapio da Genial com pre-custo.
14. Auditoria contratual/financeira do cardapio importado.
15. Motor de sugestoes de ajuste e geracao de versao ajustada.
16. Importacao de avaliacoes e inteligencia de combinacoes.
17. Geracao operacional da proposta de proximo cardapio com governanca explicita.
18. Aprovacao/reprovacao da proposta e persistencia da decisao com auditoria.
19. Hardening final de seguranca (refresh rotativo, cookies httpOnly, recuperacao de senha real).
20. E2E completo do ciclo estrategico.

---

## 9. Criterios de sucesso do MVP

- Usuario autentica e acessa portal de forma segura.
- Dados persistem no PostgreSQL por tenant.
- Dashboard mostra indicadores reais.
- Regras contratuais podem ser validadas com rastreabilidade.
- Cardapio importado da Genial pode ser auditado por conformidade e custo.
- Recomendacoes de ajuste consideram historico de aceitacao sem transformar avaliacao em criterio de bloqueio.
- Proposta de proximo cardapio explicita recomendacoes historicas como apoio, nunca como bloqueio.
- Decisao operacional do proximo cardapio fica registrada com auditoria e rastreabilidade.
- UI permanece com padrao SaaS premium aprovado.

---

## 10. Proxima acao sugerida (imediata)

Evoluir a Base Estruturada de Receitas apos a conclusao da Fase 5.1 no escopo prioritario:
- ampliar cobertura da biblioteca para reduzir os ultimos casos dependentes de fallback textual
- enriquecer equivalencias de substituicao por contexto nutricional e historico operacional
- manter contrato explicito entre backend e frontend para evidencias estruturadas de auditoria e sugestoes
- preparar proximos incrementos de governanca para proposta e decisao operacional do cardapio

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

- Fase 5.1 (Base Estruturada de Receitas): CONCLUIDA NO ESCOPO PRIORITARIO ATUAL.
  - Evidencias: importacao estruturada, catalogo reutilizavel, reclassificacao auditada, coverage por tenant, auditoria estruturada e sugestoes com explicabilidade no frontend e na API.
  - Observacao: a expansao da cobertura da biblioteca e o refinamento continuo de equivalencias seguem como evolucao, nao como bloqueio da fase.

- Fase 6 (integracao com relatorio da Genial): CONCLUIDA PARA O ESCOPO MVP ESTRUTURADO.
  - Evidencias: importacao de cardapios com validacao financeira e rastreabilidade por unidade/servico.

- Fase 7 (auditoria contratual + sugestoes): CONCLUIDA.
  - Evidencias: auditoria por regras aprovadas, geracao de sugestoes e versoes ajustadas com impactos.

- Fase 8 (avaliacoes e inteligencia): CONCLUIDA.
  - Evidencias: importacao de avaliacoes, rebuild de inteligencia e consulta de combinacoes historicas.

- Fase 9 (proposta operacional do proximo cardapio): CONCLUIDA.
  - Evidencias: endpoint dedicado, teste de integracao e acao de UI para gerar proposta com camada historica nao bloqueante.

- Fase 10 (decisao operacional final): PENDENTE.
  - Escopo pendente: evoluir governanca de publicacao final e politicas avancadas de aprovacao.

- Incremento de escopo (jun/2026): CONCLUIDO.
  - Evidencias:
    - Geracao de versao ajustada com horizonte configuravel (mes atual ate +3 meses).
    - Cadastro anual de datas comemorativas com aplicacao no gerador.
    - Priorizacao de pratos nobres em meses com datas comemorativas cadastradas.

Qualidade e testes (secao 3 e backlog item 10): EM EVOLUCAO.

Status da frente de governanca de entrega (jun/2026): CONCLUIDA NESTA FASE.

- Entregue neste ciclo:
  - Testes de integracao de API com Supertest para saude, login e protecao de rota.
  - Script de teste no workspace apps/api e ajuste de boot para testabilidade.
  - Hardening de login com rate limit por email (bloqueio temporario por excesso de tentativas).
  - Pipeline CI no GitHub Actions (`.github/workflows/ci.yml`) com validacoes de API e Web (prisma generate, testes e build) em push/pull request.
  - Padronizacao de scripts agregados na raiz (`npm test`, `npm run build`, `npm run ci:validate`) para alinhamento entre execucao local e esteira.
  - Template de Pull Request com checklist de qualidade e governanca (`.github/pull_request_template.md`).
  - Definicao de responsaveis por area com CODEOWNERS (`.github/CODEOWNERS`).
  - Guia de contribuicao do repositorio (`CONTRIBUTING.md`) com fluxo padrao de validacao e PR.
  - Templates de issue para bug e feature (`.github/ISSUE_TEMPLATE/`) para padronizacao de entrada de demandas.
  - Configuracao de issue forms (`.github/ISSUE_TEMPLATE/config.yml`) com bloqueio de issue em branco e links de orientacao.
  - Automacao de branch protection sem `gh` via script (`scripts/github/apply-branch-protection.ps1`) e comando raiz (`npm run branch-protection:apply`).
  - Branch protection da `main` ativada com status check obrigatorio da CI antes de merge.
  - Exigencia de revisao por CODEOWNERS ativada na regra de branch protection da `main`.
  - Checklist mensal de auditoria de governanca criado (`docs/governance-monthly-checklist.md`) para recorrencia operacional de controles.
  - Template de historico mensal de auditoria criado (`docs/governance-audits/_template.md`).
  - Primeira rodada registrada (`docs/governance-audits/2026-06.md`).
  - Rodada de julho registrada e validada em modo estrito (`docs/governance-audits/2026-07.md` + `npm run governance:audit:check:strict -- -Month 2026-07`).
  - Comando automatizado para gerar novas rodadas mensais (`npm run governance:audit:new` -> `scripts/governance/new-monthly-audit.ps1`).
  - Comando automatizado para validar rodadas mensais (`npm run governance:audit:check` -> `scripts/governance/check-monthly-audit.ps1`).
  - Workflow mensal de governanca no GitHub Actions (`.github/workflows/governance-audit.yml`) com validacao estrita da rodada.
  - Comando para disparo manual do workflow mensal sem `gh` (`npm run governance:audit:dispatch` -> `scripts/github/dispatch-governance-audit.ps1`).
  - Baseline E2E com Playwright na raiz (`playwright.config.ts` + `e2e/smoke.spec.ts`) e scripts operacionais (`test:e2e`, `test:e2e:list`, `test:e2e:install`).
  - Ampliacao inicial da cobertura E2E com fluxo de autenticacao de interface, login bem-sucedido, erro 401, primeiro acesso (sucesso e falha), carga da area principal, logout (incluindo falha de API), persistencia/expiracao de sessao, persistencia de idioma global/empresa e fluxos de dominio de contratos/regras/nao conformidades/importacao de cardapio PDF (criacao + listagem + auditoria contratual com resultados conforme/nao conforme + geracao de sugestoes de ajuste com prioridade/impacto financeiro + geracao de versao ajustada com horizonte e impacto consolidado + cadastro/listagem de data comemorativa com prato nobre sugerido + importacao de avaliacao PDF com score/volume/comentarios + recalculo de inteligencia de combinacoes + previa/governanca de recomendacao com proposta e decisao do proximo cardapio, incluindo aprovacao/reprovacao, baseline sem historico, bloqueio obrigatorio e validacao de justificativa minima + convite administrativo com geracao/regeneracao/revogacao e filtro de historico all/active/used com atualizacao de auditoria + cenarios de erro nesses modulos com exibicao de mensagens, incluindo falhas em regeneracao/revogacao de convite + base estruturada de receitas com importacao estruturada e reclassificacao manual auditada + resiliencia de receitas com lock de concorrencia em submit, retry manual apos falha temporaria e timeout do aviso de reclassificacao + estabilidade em carga leve com sequencias de importacao + volume moderado com importacoes e reclassificacoes sequenciais + stress/soak controlado com ciclos prolongados), incluindo exportacao CSV de historicos e trilha de compliance export audit com filtros avancados e escopos page/all, tudo com API mockada (`e2e/auth-flow.spec.ts`) sem dependencia de backend real.

- Pendente para fechamento completo do plano:
  - Suite de testes unitarios mais ampla.
  - Ampliar cobertura E2E (Playwright) para cenarios de chaos/fault injection (latencia extrema e falhas intermitentes em sequencia longa).
  - Hardening final de seguranca (ex.: refresh token rotativo/cookies httpOnly em producao).
