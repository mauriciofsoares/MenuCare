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

### Segmentacao de clientes e modo operacional (ajuste de escopo)
- Perfil A - Cliente com Genial (prioridade inicial do produto):
  - importa relatorio de receitas (PDF) e cardapio mensal (PDF)
  - MenuCare cruza receitas, audita contrato/meta e gera sugestoes/versao ajustada
  - fluxo principal do MVP segue orientado para esse perfil
- Perfil B - Cliente sem Genial ou sem sistema de cardapio:
  - cadastra receitas manualmente e/ou importa receitas via PDF
  - monta/importa cardapio por formulario operacional no MenuCare
  - informa meta por servico diretamente na plataforma
- Regra de escopo para reduzir risco:
  - fase atual prioriza 100% o Perfil A (Genial)
  - capacidades do Perfil B entram como trilha incremental sem bloquear o roadmap principal

### Onboarding operacional do cliente (prioridade de execucao)
- Objetivo: classificar o cliente no primeiro acesso para ativar o modo correto de operacao sem customizacao manual posterior.
- Campos obrigatorios no onboarding da conta:
  - `source_profile`: `genial_integrated` | `external_non_genial` | `manual_only`
  - `contract_mode`: `with_contract` | `internal_kitchen`
  - `compliance_mode`: `contractual` | `internal_policy`
- Regra de consistencia no onboarding:
  - quando `contract_mode = internal_kitchen`, permitir `compliance_mode = internal_policy` como padrao
  - quando `contract_mode = with_contract`, padrao recomendado `compliance_mode = contractual`
- Efeito funcional por perfil:
  - `source_profile = genial_integrated`: habilitar upload de PDF de receitas e cardapio mensal como fluxo principal
  - `source_profile = external_non_genial`: habilitar importacao orientada + cadastro manual como fluxo principal
  - `source_profile = manual_only`: priorizar formularios manuais de receitas, custo e cardapio por servico
  - `compliance_mode = contractual`: manter auditoria por regras aprovadas de contrato
  - `compliance_mode = internal_policy`: substituir camada contratual por checklist/politica interna, mantendo meta financeira e rastreabilidade

### Criterios de aceite por perfil (MVP e incremental)

Perfil A - Cliente com Genial (MVP prioritario)
- Onboarding:
  - conta criada com `source_profile = genial_integrated`
  - modo de compliance definido conforme presenca de contrato (`contractual` ou `internal_policy`)
- Dados de entrada:
  - importacao de receitas via PDF concluida com persistencia na base estruturada
  - importacao de cardapio mensal via PDF concluida com itens diarios por servico
- Processamento:
  - cruzamento de receitas por dia executado com cobertura percentual e lista de receitas sem match
  - nomes truncados no relatorio reconhecidos quando houver correspondencia semantica/prefixo confiavel
  - receitas sem correspondencia retornam sugestao operacional de cadastro
- Saida operacional:
  - auditoria de cardapio aplicada conforme modo de compliance da conta
  - sugestoes de ajuste geradas com impacto financeiro consolidado
  - versao ajustada gerada para horizonte de 1, 2 e 3 meses, com contexto de datas comemorativas

Perfil B - Cliente sem Genial ou sem sistema (incremental controlado)
- Onboarding:
  - conta criada com `source_profile = external_non_genial` ou `manual_only`
  - quando nao houver contrato, operar com `contract_mode = internal_kitchen` e `compliance_mode = internal_policy`
- Dados de entrada:
  - cadastro manual de receitas (nome, ingredientes, custo, rendimento e classificacao minima)
  - importacao de receitas via PDF orientado do MenuCare (quando disponivel)
  - cadastro de cardapio por dia/servico no formulario da plataforma
  - cadastro de meta financeira por servico obrigatorio
- Processamento:
  - validacao financeira por servico sempre ativa
  - cruzamento de receitas do cardapio com base estruturada sempre ativo
  - auditoria contratual so e aplicada quando `compliance_mode = contractual`
- Saida operacional:
  - geracao de sugestoes de ajuste com rastreabilidade
  - geracao de cardapio ajustado para horizonte futuro, com datas comemorativas
  - trilha de decisao e auditoria operacional preservada mesmo sem contrato

Regra de aceite para release
- Release do ciclo atual e aprovado quando todos os criterios do Perfil A estiverem atendidos.
- Criterios do Perfil B entram por ondas incrementais, sem bloquear o go-live do Perfil A.

### Plano de ondas - Perfil B (sem Genial)

Onda 1 - Operacao manual essencial (prioridade alta)
- Objetivo:
  - permitir operar o ciclo basico sem dependencia de sistema externo
- Entregas:
  - onboarding com `source_profile = external_non_genial` ou `manual_only`
  - cadastro manual de receitas com custo e classificacao minima
  - cadastro de meta financeira por servico
  - cadastro manual de cardapio por dia/servico
  - validacao financeira ativa no momento da montagem/importacao
- Criterio de aceite da onda:
  - cliente consegue cadastrar receitas, montar cardapio e validar meta por servico no mesmo fluxo

Onda 2 - Escala operacional e qualidade de dados (prioridade media)
- Objetivo:
  - reduzir trabalho manual e aumentar cobertura da base estruturada
- Entregas:
  - importacao de receitas por PDF orientado do MenuCare
  - cruzamento automatico de receitas do cardapio com base estruturada
  - reconhecimento de variacoes e nomes truncados quando houver match confiavel
  - sugestao de cadastro para receitas sem correspondencia
- Criterio de aceite da onda:
  - ciclo identifica cobertura de receitas por dia e exibe sugestoes de cadastro para lacunas

Onda 3 - Governanca completa e planejamento futuro (prioridade media/alta)
- Objetivo:
  - equiparar governanca operacional ao fluxo principal respeitando modo interno
- Entregas:
  - geracao de sugestoes de ajuste com rastreabilidade por evidencia
  - geracao de versao ajustada para 1, 2 e 3 meses
  - aplicacao de datas comemorativas no gerador
  - trilha de decisao operacional com historico e auditoria
  - suporte opcional a compliance contratual quando cliente evoluir para `with_contract`
- Criterio de aceite da onda:
  - cliente sem Genial consegue fechar ciclo completo (montagem -> validacao -> ajuste -> planejamento futuro -> decisao auditada)

Sequenciamento recomendado
- Executar Onda 1 imediatamente apos consolidacao do Perfil A em producao.
- Iniciar Onda 2 com piloto de 1-2 clientes sem Genial para calibrar parser de receitas.
- Liberar Onda 3 apos estabilizacao dos indicadores de cobertura e qualidade da Onda 2.

### Politica de contrato para cozinha interna
- Quando houver contrato formal, manter fluxo completo de regras contratuais aprovadas + auditoria.
- Quando nao houver contrato (cozinha interna), operar em modo de politica interna:
  - validacoes financeiras e operacionais continuam obrigatorias
  - compliance contratual fica desabilitado ou substituido por checklist interno configuravel
  - rastreabilidade e trilha de decisao permanecem obrigatorias.

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
- Importacao de receitas por PDF para clientes sem Genial (layout orientado do MenuCare).
- Cadastro manual de receitas na plataforma (sem dependencia de sistema externo).
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
- R5 em andamento:
  - sugestoes de ajuste agora incorporam contexto historico operacional nao bloqueante quando ha combinacao semelhante para mesma unidade/servico
  - enriquecimento preserva o motor deterministico (historico so adiciona explicabilidade, sem bloquear aprovacao)
  - cobertura de integracao da API validando a presenca do contexto historico em `estimatedNutritionalImpact`
  - pareamento semantico de nomes entre cardapio importado e biblioteca estruturada para reduzir falso fallback textual em auditoria e sugestoes
  - sinonimos controlados por categoria (ex.: tilapia/salmao/atum => peixe) aplicados ao pareamento estruturado, com teste de integracao dedicado
  - alias contextuais por servico/refeicao (ex.: posta/file no almoco/jantar) aplicados no pareamento semantico para ampliar cobertura sem depender de texto literal
  - cobertura contextual ampliada para frutas citricas e vegetais por refeicao/servico (ex.: suco citrico no cafe da manha; mix de folhas no almoco)
  - cobertura semantica ampliada para especie de peixe (ex.: dourado), reduzindo falso negativo/fallback textual em auditoria estruturada
  - hardening de autenticacao com refresh token rotativo e cookie httpOnly (login emite refresh, endpoint dedicado de refresh faz rotacao e cookie antigo passa a ser rejeitado)
  - hardening de producao no backend de sessao de refresh: revogacao por dispositivo (mesmo user-agent), limite de sessoes ativas por usuario e limpeza automatica de sessoes expiradas
  - observabilidade de hardening de refresh no backend com logs estruturados para cleanup de expiradas, revogacao por dispositivo e enforcement de limite de sessoes
  - correlation id de autenticacao (`x-auth-flow-id`) propagado em login/refresh/logout para rastreabilidade ponta a ponta do fluxo de sessao
  - frontend web agora propaga `x-auth-flow-id` em chamadas autenticadas e captura o header de resposta para manter consistencia de rastreabilidade durante retry com refresh
  - cobertura E2E de autenticacao validando propagacao de `x-auth-flow-id` em login -> refresh -> retry -> logout
  - teste de integracao da API cobrindo alias comercial de peixe no pareamento semantico estruturado (`File de pescado ao forno` -> evidencia estruturada para regra de peixe)
  - teste de integracao da API cobrindo alias comercial de vegetais no pareamento semantico estruturado (`Salada de hortalicas` -> evidencia estruturada para regra de verdura)
  - importacao de cardapio agora aceita itens com custo por receita (`recipeItems`) e calcula automaticamente o custo total diario para comparar com a meta do servico
  - endpoint de parse de relatorio mensal (`/menus/imports/parse-report`) transforma texto bruto em payloads diarios estruturados com custo calculado, delta vs total reportado e status financeiro frente a meta
  - endpoint de upload de relatorio mensal (`/menus/imports/parse-report-file`) recebe PDF via multipart, extrai texto e reaproveita o mesmo contrato estruturado do parse textual
  - endpoint orquestrador mensal (`/menus/imports/monthly-cycle`) executa ciclo integrado por dia importado: importacao, auditoria contratual, sugestoes de ajuste e consolidacao financeira vs meta
  - resumo do ciclo mensal agora expõe consolidado operacional e financeiro do mes (`importsProcessed`, dias dentro/fora da meta, custo total, meta total, total de sugestoes e impacto financeiro consolidado)
  - resumo mensal consolidado passou a ser persistido em backend e consultavel por endpoint dedicado (`/menus/imports/monthly-summaries`), evitando reprocessamento integral para consultas posteriores
  - consolidado mensal agora separa impacto financeiro estimado de sugestoes contratuais versus sugestoes motivadas puramente por meta de custo
  - frontend passou a consumir o resumo mensal persistido com filtros operacionais por mes, unidade e servico
  - frontend passou a disparar o ciclo mensal completo por upload de PDF, consumindo o endpoint orquestrador e exibindo o resumo consolidado retornado
  - backend passou a persistir mensagens operacionais por dia no resumo mensal, e o frontend agora exibe esses avisos/informacoes no ultimo ciclo e no resumo persistido
  - mensagens operacionais por dia agora incluem recomendacao de acao e CTA direto no frontend para abrir a importacao correspondente
  - endpoint `/menus/imports/monthly-cycle` agora processa cada dia com status granular por item (`completed`, `completed_with_warnings`, `failed`), etapa de falha (`import`, `audit`, `suggestions`) e metadados de auto-remediacao (retry automatico para falhas 5xx)
  - ciclo mensal passou a suportar parametros de operacao (`continueOnItemError`, `maxAutoRetries`) para controlar tolerancia a erro e tentativa automatica de recuperacao por item
  - endpoint de remediacao seletiva implementado em `/menus/imports/monthly-summaries/reprocess-failed`, permitindo reprocessar apenas itens falhos de um resumo mensal ja persistido sem reexecutar o ciclo inteiro
  - endpoint de remediacao seletiva evoluido para tambem tentar recuperar falhas da etapa de importacao (com nova criacao de importacao para o dia), antes de reexecutar auditoria e sugestoes
  - ciclo mensal passou a cruzar receitas do relatorio com a base estruturada de receitas, persistindo cobertura de correspondencia por item e consolidado mensal para apoiar auditoria e geracao futura
  - cruzamento mensal evoluido para tolerar nomes truncados no relatorio e reconhecer receitas existentes por pareamento semantico/prefixo
  - quando nao houver correspondencia de receita no cruzamento, o ciclo passa a sugerir cadastro da receita para fortalecer o proximo ciclo e a geracao futura
  - onboarding operacional implementado na API com persistencia de perfil da conta (`source_profile`, `contract_mode`, `compliance_mode`) para habilitar comportamento por tipo de cliente
  - onboarding operacional integrado no frontend com leitura e atualizacao do perfil da conta (`GET/POST /onboarding/operational-profile`)
  - fluxo de ciclo mensal via PDF agora respeita perfil operacional da conta no frontend (habilitado para `source_profile = genial_integrated` e desabilitado para perfis manuais/externos)
  - auditoria contratual do cardapio agora respeita `compliance_mode` no frontend (desabilitada quando `internal_policy`)
  - cobertura E2E adicionada para gates por perfil operacional, validando bloqueio do ciclo mensal sem Genial e bloqueio da auditoria contratual em modo de politica interna
  - cadastro operacional manual por dia/servico implementado em `/menus/operational-cardapios` com listagem recente no frontend quando a conta nao esta integrada com Genial
  - frontend do ciclo mensal agora oferece acao direta "Reprocessar itens com falha" no ultimo ciclo executado, atualizando consolidado e mensagens operacionais apos a remediacao
  - cobertura de integracao do ciclo mensal ampliada com fixture PDF real da Genial, incluindo contrato por item diario, consistencia agregada e validacao de dias acima da meta com sugestoes financeiras

### Proximo incremento prioritario
- iniciar Onda 1 do Perfil B com formulario operacional de cardapio por dia/servico e meta por servico no frontend, reutilizando o mesmo motor de validacao financeira
- ampliar a cobertura da biblioteca para reduzir casos que ainda dependem de fallback textual
- enriquecer substituicoes equivalentes com contexto nutricional e historico operacional, mantendo bloqueios sempre deterministas
- evoluir remediacao seletiva para suportar fallback de payload por item quando dados minimos de reimportacao nao estiverem disponiveis no resumo persistido
- preparar a camada futura de IA apenas como apoio de extracao/normalizacao de receitas e evidencias, sem mover decisao de conformidade ou custo para heuristica nao auditavel
- ampliar feedback operacional do ciclo mensal com estados de erro mais granulares e remediacao automatizada para falhas recorrentes de processamento

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
- Diretriz operacional continua: todo ciclo mensal deve receber cardapio, executar auditoria contratual, sugerir ajustes e validar custo sempre contra a meta do servico.
- Prioridade desta fase: consolidar operacao ponta a ponta para clientes com Genial (Perfil A).

### Escopo incremental paralelo (Perfil B - sem Genial)
- Entrada manual/assistida de cardapio por dia e por servico no MenuCare.
- Reaproveitar a mesma base estruturada de receitas e o mesmo motor de validacao de meta.
- Manter geracao de versao ajustada e planejamento de 1, 2 e 3 meses com datas comemorativas.
- Tratar auditoria contratual como opcional quando nao existir contrato formal.

### Status atual da execucao
- Parse textual do relatorio mensal implementado.
- Upload de PDF mensal implementado com extracao de texto e reaproveitamento do parser estruturado.
- Ciclo mensal orquestrado implementado (`/menus/imports/monthly-cycle`) com importacao diaria, auditoria, sugestoes e consolidado financeiro.
- Resumo mensal consolidado persistido e consultavel sem reprocessamento integral (`/menus/imports/monthly-summaries`).
- Impactos financeiros consolidados separados por origem (`contractual` x `financial_goal`) no ciclo mensal e no resumo persistido.
- Frontend consumindo o resumo mensal persistido com filtros operacionais simples e exibicao do consolidado por mes/unidade/servico.
- Frontend executando upload do PDF mensal e disparo do ciclo completo via endpoint orquestrador, com exibicao do ultimo resumo processado.
- Mensagens operacionais por dia persistidas no backend e exibidas no frontend para o ultimo ciclo e para o resumo mensal consultado.
- Mensagens operacionais com CTA direto para abrir a importacao e seguir para auditoria/sugestoes do item processado.
- Cobertura de integracao validada com PDF real do repositório, incluindo dias acima da meta e coerencia do consolidado mensal.
- Cruzamento de receitas entre relatorio mensal e base estruturada habilitado no ciclo, com cobertura consolidada para reduzir divergencias entre importacao mensal e modulo de receitas.
- Pareamento de receitas no ciclo considera variacoes de nome (incluindo nome truncado) para reduzir falso negativo de correspondencia.
- Itens sem correspondencia no cruzamento geram sugestao operacional de cadastro de receita na base estruturada.
- Frontend agora integra onboarding operacional da conta com persistencia do perfil e aplicacao de gates por tipo de cliente no painel de cardapio.
- Testes E2E validam os gates operacionais do onboarding: bloqueio de ciclo mensal sem integracao Genial e bloqueio de auditoria contratual em modo de politica interna.

### Diretriz de evolucao com IA (apoio, nao decisao)
- Quando habilitada, IA deve apoiar extracao de texto e normalizacao de receitas em documentos de entrada.
- IA pode apoiar classificacao/qualificacao de receitas para ampliar cobertura semantica da base estruturada.
- Decisao de conformidade, bloqueio/aprovacao e validacao de meta de custo permanecem deterministicos e auditaveis.
- Fluxo oficial preservado: IA apoia preparacao de dados; motor de regras valida contrato e custo; usuario valida/decide.

### Criterio de pronto
- Relatorio importado gera itens auditaveis por unidade/servico/data com status financeiro.
- Relatorio mensal reutiliza as mesmas receitas da base estruturada sempre que houver correspondencia, mantendo rastreabilidade de receitas sem match para acao operacional.
- Receitas sem match no relatorio mensal sao listadas como sugestao de cadastro, preservando rastreabilidade para fechamento da lacuna da base.

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

Campos recomendados para segmentacao operacional (incremental):
- tenants.source_profile (`genial_integrated`, `external_non_genial`, `manual_only`)
- tenants.contract_mode (`with_contract`, `internal_kitchen`)
- tenants.compliance_mode (`contractual`, `internal_policy`)

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
- refletir no frontend e nos filtros operacionais os impactos financeiros consolidados por origem (contratual x meta de custo)
- preparar proximos incrementos de governanca para proposta e decisao operacional do cardapio
- ampliar feedback operacional do ciclo mensal com estados de erro/aviso mais acionaveis por item processado

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
  - Evidencias: importacao de cardapios com validacao financeira e rastreabilidade por unidade/servico, parse textual do relatorio, upload PDF, ciclo mensal orquestrado, resumo mensal persistido para consulta posterior e consolidado operacional/financeiro validado por testes com PDF real.

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
  - Ampliacao inicial da cobertura E2E com fluxo de autenticacao de interface, login bem-sucedido, erro 401, primeiro acesso (sucesso e falha), carga da area principal, logout (incluindo falha de API), persistencia/expiracao de sessao, persistencia de idioma global/empresa e fluxos de dominio de contratos/regras/nao conformidades/importacao de cardapio PDF (criacao + listagem + auditoria contratual com resultados conforme/nao conforme + geracao de sugestoes de ajuste com prioridade/impacto financeiro + geracao de versao ajustada com horizonte e impacto consolidado + cadastro/listagem de data comemorativa com prato nobre sugerido + importacao de avaliacao PDF com score/volume/comentarios + recalculo de inteligencia de combinacoes + previa/governanca de recomendacao com proposta e decisao do proximo cardapio, incluindo aprovacao/reprovacao, baseline sem historico, bloqueio obrigatorio e validacao de justificativa minima + convite administrativo com geracao/regeneracao/revogacao e filtro de historico all/active/used com atualizacao de auditoria + cenarios de erro nesses modulos com exibicao de mensagens, incluindo falhas em regeneracao/revogacao de convite + base estruturada de receitas com importacao estruturada e reclassificacao manual auditada + resiliencia de receitas com lock de concorrencia em submit, retry manual apos falha temporaria e timeout do aviso de reclassificacao + estabilidade em carga leve com sequencias de importacao + volume moderado com importacoes e reclassificacoes sequenciais + stress/soak controlado com ciclos prolongados + chaos/fault injection com falhas intermitentes e latencia extrema), incluindo exportacao CSV de historicos e trilha de compliance export audit com filtros avancados e escopos page/all, tudo com API mockada (`e2e/auth-flow.spec.ts`) sem dependencia de backend real.

- Pendente para fechamento completo do plano:
  - Suite de testes unitarios mais ampla.
  - Ampliar cobertura E2E (Playwright) para cenarios de recuperacao automatica e degradacao progressiva entre modulos (cross-panel).
  - Hardening final de seguranca (ex.: refresh token rotativo/cookies httpOnly em producao).
