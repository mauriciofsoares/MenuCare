# DOMAIN TO-BE - MenuCare

Data: 2026-06-11
Objetivo: propor o novo modelo de dominio relacional a partir do AS-IS, com hierarquia Tenant -> Site -> Contract -> Service.
Escopo: somente definicao arquitetural (sem codigo e sem migrations).

---

## 1) Modelo de dominio alvo

Hierarquia estrutural:

```text
Tenant
  Site
    Contract
      Service
```

Principios do modelo:
1. Todo registro operacional pertence a um Tenant.
2. Toda operacao acontece dentro de um Site.
3. Toda regra e conformidade contratual pertence a um Contract.
4. Toda execucao diaria de cardapio/compliance acontece em um Service.
5. Campos textuais de escopo deixam de ser chave de seguranca e passam a ser apenas atributos de exibicao/contexto.

---

## 2) Entidades estruturais

## 2.1 Tenant

Finalidade:
- Representar a fronteira maxima de isolamento de dados e autorizacao.
- Agrupar todos os Sites, Contracts e Services da organizacao cliente.

Atributos obrigatorios:
1. id
2. legal_name
3. display_name
4. status (active, suspended, archived)
5. created_at
6. updated_at

Relacionamentos:
1. Tenant 1:N Site
2. Tenant 1:N User
3. Tenant 1:N artefatos transversais (audit, policy, configuracoes)

Ownership:
- Ownership primario: Tenant.
- Nenhum recurso pode cruzar Tenant.

Ciclo de vida:
1. Provisionado
2. Ativo
3. Suspenso
4. Encerrado/Arquivado

---

## 2.2 Site

Finalidade:
- Representar a unidade institucional/fisica de operacao dentro do Tenant.
- Consolidar contexto local de operacao (calendario, regras locais permitidas, cobertura de contratos).

Atributos obrigatorios:
1. id
2. tenant_id
3. code (chave funcional unica por tenant)
4. name
5. status (active, inactive)
6. timezone
7. created_at
8. updated_at

Relacionamentos:
1. Site N:1 Tenant
2. Site 1:N Contract
3. Site 1:N Service (direto ou por heranca via Contract, conforme governanca)

Ownership:
- Ownership primario: Tenant.
- Ownership operacional: Site.

Ciclo de vida:
1. Cadastrado
2. Ativo
3. Inativo
4. Encerrado

---

## 2.3 Contract

Finalidade:
- Representar o instrumento contratual que define regras, controles e obrigacoes operacionais.
- Ser a origem de governanca para compliance e recomendacoes vinculadas.

Atributos obrigatorios:
1. id
2. tenant_id
3. site_id
4. contract_number
5. title
6. source_type
7. status (draft, active, inactive, archived)
8. effective_start_date
9. effective_end_date (ou regra de vigencia aberta)
10. created_at
11. updated_at

Relacionamentos:
1. Contract N:1 Tenant
2. Contract N:1 Site
3. Contract 1:N ContractRule
4. Contract 1:N ComplianceControl
5. Contract 1:N Service

Ownership:
- Ownership primario: Site dentro do Tenant.
- Ownership funcional: Contract.

Ciclo de vida:
1. Rascunho
2. Em validacao
3. Ativo
4. Inativo
5. Arquivado

---

## 2.4 Service

Finalidade:
- Representar o escopo operacional executavel do dia a dia (cardapio, avaliacao, execucao de controle, finding, decisao).
- Ser a menor unidade de autorizacao operacional.

Atributos obrigatorios:
1. id
2. tenant_id
3. site_id
4. contract_id
5. code (chave funcional unica no contrato)
6. name
7. service_type
8. status (active, inactive)
9. start_date
10. end_date (quando aplicavel)
11. created_at
12. updated_at

Relacionamentos:
1. Service N:1 Tenant
2. Service N:1 Site
3. Service N:1 Contract
4. Service 1:N MenuImport
5. Service 1:N EvaluationImport
6. Service 1:N CombinationIntelligence
7. Service 1:N ComplianceControlExecution
8. Service 1:N ComplianceFinding
9. Service 1:N NonConformity e ActionPlan

Ownership:
- Ownership primario: Contract dentro de Site/Tenant.
- Ownership operacional: Service.

Ciclo de vida:
1. Planejado
2. Ativo
3. Suspenso
4. Encerrado

---

## 3) Regras de relacionamento e integridade

1. site.tenant_id deve ser igual ao tenant_id do contexto autenticado.
2. contract.site_id deve apontar para Site do mesmo tenant.
3. service.contract_id deve apontar para Contract do mesmo site/tenant.
4. service.site_id deve ser consistente com contract.site_id.
5. Toda entidade operacional (menus, evaluations, recommendations, compliance operacional) deve referenciar service_id.
6. Entidades contratuais (rules, controls macro) devem referenciar contract_id.
7. Filtros de seguranca devem priorizar IDs relacionais, nao nomes textuais.

---

## 4) Ownership alvo por bloco de dominio

1. Tenant-owned:
- Users, policies globais, configuracoes globais, auditoria transversal.

2. Site-owned:
- Calendario institucional, contexto local de operacao, visao agregada local.

3. Contract-owned:
- ContractRule, ComplianceControl, eventos de validacao e governanca contratual.

4. Service-owned:
- MenuImport, OperationalCardapio, MonthlyCycleSummary, EvaluationImport,
  CombinationIntelligence, RecommendationPreview, NextMenuDecision,
  ComplianceControlExecution, ComplianceFinding, NonConformity, ActionPlan.

---

## 5) Migracao conceitual dos campos atuais para entidades relacionais

Objetivo:
- Eliminar ownership implicito por texto e adotar ownership explicito por relacionamento.

## 5.1 company_name -> Tenant e Site

AS-IS:
- company_name e usado como chave de escopo de seguranca e filtro de consulta.

TO-BE:
1. company_name deixa de ser chave de seguranca.
2. tenant_id vira chave obrigatoria de isolamento.
3. Quando houver variacao institucional interna, company_name e mapeado para Site (name/display_name), mantendo tenant_id como raiz.
4. company_name permanece somente como atributo descritivo legado (historico/exibicao) ate descontinuacao controlada.

Regra de mapeamento:
- Para cada company_name ativo no tenant, definir um site canonico.
- Consultas passam a filtrar por tenant_id + site_id (quando aplicavel), nao por company_name.

## 5.2 unit_name -> Site

AS-IS:
- unit_name representa unidade operacional em varias tabelas de menus e avaliacoes.

TO-BE:
1. unit_name passa a ser representacao textual de Site.name (ou alias de exibicao).
2. site_id torna-se referencia obrigatoria para dados antes vinculados por unit_name.
3. unit_name legado pode ser mantido como snapshot textual para trilha historica.

Regra de mapeamento:
- Normalizar unit_name por tenant.
- Consolidar sinonimos/variantes em um unico Site por regra de negocio.

## 5.3 service_name -> Service

AS-IS:
- service_name e texto livre usado para joins logicos e agregacoes operacionais.

TO-BE:
1. service_name passa a ser atributo de exibicao de Service.name.
2. service_id torna-se chave de relacionamento para todo dado operacional.
3. joins por texto (service_name) sao substituidos por joins por service_id.

Regra de mapeamento:
- Para cada combinacao tenant + unit_name + service_name, criar/associar um Service canonico.
- Vincular esse Service a um Contract ativo no Site correspondente.

---

## 6) Diretriz de transicao funcional (sem quebra)

1. Durante transicao, campos textuais antigos coexistem como atributos de compatibilidade.
2. Novo ownership e autorizado por IDs relacionais (tenant_id/site_id/contract_id/service_id).
3. company_name, unit_name e service_name deixam de decidir seguranca; passam a documentar contexto de negocio.
4. Integridade final exige que todo registro operacional tenha chain valida:

```text
tenant_id -> site_id -> contract_id -> service_id
```

---

## 7) Resultado esperado do TO-BE

1. Isolamento multi-tenant deterministico por chave relacional.
2. Eliminacao de ownership implicito baseado em campos textuais.
3. Rastreabilidade completa da operacao: Tenant -> Site -> Contract -> Service.
4. Reducao de ambiguidade em joins e filtros de seguranca.
5. Base consistente para evolucao de RBAC e auditoria por escopo real.
