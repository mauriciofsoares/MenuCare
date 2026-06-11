# MenuCare - Domain Gap Analysis (Sprint B)

## Escopo da analise
Comparacao entre:
- Dominio alvo: docs/domain-model.md
- Modelo Prisma atual: apps/api/prisma/schema.prisma
- Implementacao atual: apps/api/src/server.ts

Legenda usada na matriz:
- Existe no Dominio: entidade definida no domain model
- Existe no Prisma: entidade representada no schema.prisma
- Existe no Codigo: entidade representada na API (rotas, queries, DDL runtime, estruturas de dominio)
- Gap: resumo da diferenca principal
- Prioridade: Critica, Alta, Media, Baixa

## Matriz de gaps por entidade

| Entidade | Existe no Dominio | Existe no Prisma | Existe no Codigo | Gap | Prioridade |
|---|---|---|---|---|---|
| Tenant | Sim | Sim | Sim | No codigo operacional, escopo principal usa company_name; tenant_id nao e padrao transversal | Critica |
| User | Sim | Sim | Sim | Modelo funcional de usuario/auth no codigo nao esta consolidado no Prisma alem de User base | Alta |
| FirstAccessInvite | Sim | Nao | Sim | Ausente no Prisma; existe como first_access_invites em DDL runtime | Alta |
| RefreshSession | Sim | Nao | Sim | Ausente no Prisma; existe como auth_refresh_sessions em DDL runtime | Critica |
| InviteAuditEvent | Sim | Nao | Sim | Ausente no Prisma; existe como invite_audit_events em DDL runtime | Alta |
| LocalePreference | Sim | Nao | Sim | Ausente no Prisma; existe como company_locale_preferences em DDL runtime | Media |
| OperationalProfile | Sim | Nao | Sim | Ausente no Prisma; existe como company_operational_profiles em DDL runtime | Alta |
| Contract | Sim | Nao | Sim | Ausente no Prisma; existe como contracts em DDL runtime | Critica |
| ContractRule | Sim | Nao | Sim | Ausente no Prisma; existe como extracted_rules em DDL runtime | Critica |
| RuleValidationEvent | Sim | Nao | Sim | Ausente no Prisma; existe como rule_validation_events em DDL runtime | Alta |
| MenuImport | Sim | Nao | Sim | Ausente no Prisma; existe como menu_pdf_imports em DDL runtime | Critica |
| OperationalCardapio | Sim | Nao | Sim | Ausente no Prisma; existe como menu_operational_cardapios em DDL runtime | Alta |
| MonthlyCycleSummary | Sim | Nao | Sim | Ausente no Prisma; existe como menu_monthly_cycle_summaries em DDL runtime | Alta |
| CommemorativeDate | Sim | Nao | Sim | Ausente no Prisma; existe como menu_commemorative_dates em DDL runtime | Media |
| MenuAdjustedVersion | Sim | Nao | Sim | Ausente no Prisma; existe como menu_adjusted_versions em DDL runtime | Alta |
| MenuRuleAudit | Sim | Nao | Sim | Ausente no Prisma; existe como menu_import_rule_audits em DDL runtime | Alta |
| Suggestion | Sim | Nao | Sim | Ausente no Prisma; existe como menu_import_adjustment_suggestions em DDL runtime | Alta |
| Recipe | Sim | Nao | Sim | Ausente no Prisma; existe como recipe_library_items em DDL runtime | Critica |
| RecipeIngredient | Sim | Nao | Sim | Ausente no Prisma; existe como recipe_ingredients em DDL runtime | Media |
| RecipeItemIngredient | Sim | Nao | Sim | Ausente no Prisma; existe como recipe_item_ingredients em DDL runtime | Alta |
| RecipeImportEvent | Sim | Nao | Sim | Ausente no Prisma; existe como recipe_import_events em DDL runtime | Media |
| RecipeClassificationEvent | Sim | Nao | Sim | Ausente no Prisma; existe como recipe_classification_events em DDL runtime | Media |
| EvaluationImport | Sim | Nao | Sim | Ausente no Prisma; existe como menu_evaluation_imports em DDL runtime | Alta |
| CombinationIntelligence | Sim | Nao | Sim | Ausente no Prisma; existe como menu_combination_intelligence em DDL runtime | Alta |
| NonConformity | Sim | Nao | Sim | Ausente no Prisma; existe como non_conformities em DDL runtime | Critica |
| ActionPlan | Sim | Nao | Sim | Ausente no Prisma; existe como non_conformity_action_plans em DDL runtime | Critica |
| NonConformityEvent | Sim | Nao | Sim | Ausente no Prisma; existe como non_conformity_events em DDL runtime | Alta |
| ActionPlanEvent | Sim | Nao | Sim | Ausente no Prisma; existe como non_conformity_action_events em DDL runtime | Alta |
| ComplianceExportEvent | Sim | Nao | Sim | Ausente no Prisma; existe como compliance_export_events em DDL runtime | Alta |
| RecommendationPreview | Sim | Nao | Sim | Visao derivada implementada no codigo, sem modelagem Prisma formal | Media |
| NextMenuDecision | Sim | Nao | Sim | Ausente no Prisma; existe como menu_next_menu_decisions em DDL runtime | Alta |
| RecommendationPolicy | Sim | Nao | Sim | Contrato de governanca esta em codigo (constante/endpoint), nao modelado no Prisma | Media |
| AIPreparationEvent | Sim | Nao | Sim | Ausente no Prisma; existe como ai_preparation_events em DDL runtime | Alta |
| Audit (conceito central) | Sim | Nao | Sim (parcial) | Auditoria esta pulverizada em multiplas tabelas de evento, sem modelo canonicamente unificado no Prisma | Alta |
| Recommendation (conceito central) | Sim | Nao | Sim (parcial) | Recomendacao distribuida entre sugestoes, preview e decisao; sem modelo consolidado no Prisma | Alta |
| Menu (conceito central) | Sim | Nao | Sim (parcial) | Dominio de Menu esta fragmentado em menu_pdf_imports e menu_operational_cardapios | Alta |
| Evaluation (conceito central) | Sim | Nao | Sim (parcial) | Dominio de Evaluation esta fragmentado entre imports e inteligencia agregada | Media |

---

## Riscos Criticos

### 1) Entidades do dominio completamente ausentes do Prisma
Ausentes no Prisma (com presenca no codigo):
- FirstAccessInvite
- RefreshSession
- InviteAuditEvent
- LocalePreference
- OperationalProfile
- Contract
- ContractRule
- RuleValidationEvent
- MenuImport
- OperationalCardapio
- MonthlyCycleSummary
- CommemorativeDate
- MenuAdjustedVersion
- MenuRuleAudit
- Suggestion
- Recipe
- RecipeIngredient
- RecipeItemIngredient
- RecipeImportEvent
- RecipeClassificationEvent
- EvaluationImport
- CombinationIntelligence
- NonConformity
- ActionPlan
- NonConformityEvent
- ActionPlanEvent
- ComplianceExportEvent
- NextMenuDecision
- AIPreparationEvent

Observacao: schema.prisma atual modela somente Tenant e User.

### 2) Tabelas criadas via DDL runtime (CREATE TABLE em server.ts) que deveriam ser migrations
- company_locale_preferences
- company_operational_profiles
- contracts
- extracted_rules
- rule_validation_events
- non_conformities
- non_conformity_action_plans
- non_conformity_events
- non_conformity_action_events
- compliance_export_events
- menu_pdf_imports
- menu_operational_cardapios
- menu_import_rule_audits
- menu_import_adjustment_suggestions
- menu_adjusted_versions
- menu_commemorative_dates
- menu_evaluation_imports
- menu_combination_intelligence
- menu_monthly_cycle_summaries
- recipe_library_items
- recipe_ingredients
- recipe_item_ingredients
- recipe_import_events
- recipe_classification_events
- ai_preparation_events
- menu_next_menu_decisions
- first_access_invites
- auth_password_overrides
- invite_audit_events
- auth_refresh_sessions

### 3) Relacionamentos do dominio sem FK no banco
Relacoes de dominio com risco de integridade referencial (sem FK explicita nas DDLs atuais):
- extracted_rules.contract_id -> contracts.id
- rule_validation_events.rule_id -> extracted_rules.id
- non_conformity_action_plans.non_conformity_id -> non_conformities.id
- non_conformity_events.non_conformity_id -> non_conformities.id
- non_conformity_action_events.non_conformity_id -> non_conformities.id
- non_conformity_action_events.action_plan_id -> non_conformity_action_plans.id
- menu_import_rule_audits.menu_import_id -> menu_pdf_imports.id
- menu_import_adjustment_suggestions.menu_import_id -> menu_pdf_imports.id
- menu_adjusted_versions.menu_import_id -> menu_pdf_imports.id
- menu_next_menu_decisions.menu_import_id -> menu_pdf_imports.id
- recipe_item_ingredients.recipe_id -> recipe_library_items.id
- recipe_item_ingredients.ingredient_id -> recipe_ingredients.id
- recipe_classification_events.recipe_id -> recipe_library_items.id

Impacto:
- risco de registros orfaos
- dificuldade de garantir consistencia do dominio em escala

### 4) Campos multi-tenant (tenant_id) ausentes em tabelas criticas
Diagnostico atual:
- Apenas auth_refresh_sessions possui tenant_id explicito.
- A maior parte do dominio usa company_name como escopo.

Tabelas criticas sem tenant_id explicito (exemplos):
- contracts
- extracted_rules
- non_conformities
- non_conformity_action_plans
- menu_pdf_imports
- menu_import_rule_audits
- menu_import_adjustment_suggestions
- menu_adjusted_versions
- menu_evaluation_imports
- menu_combination_intelligence
- recipe_library_items
- menu_next_menu_decisions

Impacto:
- fragilidade no isolamento formal por tenant
- maior risco de inconsistencias em migracao para arquitetura multi-tenant estrita

---

## Backlog Tecnico Priorizado (ordem obrigatoria)

1. Consolidar dominio e schema
- formalizar modelo canonico de entidades e relacoes
- padronizar identidade de tenant (tenant_id) em todo o dominio

2. Implementar migrations versionadas
- eliminar DDL runtime de apps/api/src/server.ts
- criar baseline inicial de migrations para todas as tabelas operacionais

3. Expandir Prisma para refletir o dominio real
- modelar entidades ausentes
- modelar relacoes, constraints e indexes de dominio
- remover persistencia estrutural paralela ao Prisma

4. Aplicar integridade referencial (FK + regras de cascade/restrict)
- cobrir relacionamentos criticos do dominio
- validar estrategia de delecao para evitar orfaos

5. Uniformizar multi-tenant no banco e no codigo
- adicionar tenant_id em entidades criticas
- manter company_name apenas como atributo de negocio, nao como chave de isolamento

6. Modularizar backend por bounded context
- separar rotas, servicos, repositorios e schemas
- reduzir concentracao de regras em server.ts

7. Modularizar frontend por feature de dominio
- reduzir acoplamento de App.tsx
- alinhar contratos de API por contexto

8. Implementar observabilidade de dominio
- trilhas de auditoria consistentes por agregado
- metricas de consistencia e qualidade de dados (incluindo orfaos e faltas de tenant)

9. Introduzir fila e worker para processamento pesado
- mover parse/processamento documental para fluxo assincrono
- preservar API transacional fina

10. Evoluir IA contratual e inteligencia operacional
- manter IA como apoio de extracao/classificacao/sugestao
- manter aprovacao e conformidade em motor deterministico auditavel
