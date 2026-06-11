# DOMAIN AS-IS - MenuCare

Data: 2026-06-11
Escopo: analise de schema Prisma, endpoints, services backend e paginas frontend.
Regra aplicada: somente documentacao, sem alteracao de codigo.

## 0) Fontes analisadas

### Schema e migrations
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/baseline/migration.sql
- apps/api/prisma/migrations/20260611_sprint_p_compliance_controls/migration.sql
- apps/api/prisma/migrations/20260611_sprint_q_control_state_machine_and_finding_events/migration.sql

### Endpoints e services (backend)
- apps/api/src/server.ts
- apps/api/src/modules/auth/routes.ts
- apps/api/src/modules/auth/service.ts
- apps/api/src/modules/contracts/routes.ts
- apps/api/src/modules/contracts/service.ts
- apps/api/src/modules/rules/routes.ts
- apps/api/src/modules/rules/service.ts
- apps/api/src/modules/compliance/routes.ts
- apps/api/src/modules/compliance/service.ts
- apps/api/src/modules/menus/routes.ts
- apps/api/src/modules/menus/service.ts
- apps/api/src/modules/recipes/routes.ts
- apps/api/src/modules/recipes/service.ts
- apps/api/src/modules/evaluations/routes.ts
- apps/api/src/modules/evaluations/service.ts
- apps/api/src/modules/recommendations/routes.ts
- apps/api/src/modules/recommendations/service.ts
- apps/api/src/modules/governance/routes.ts
- apps/api/src/modules/governance/service.ts

### Paginas e contexto auth (frontend)
- apps/web/src/auth.tsx
- apps/web/src/pages/Contracts.tsx
- apps/web/src/pages/ContractRules.tsx
- apps/web/src/pages/Menus.tsx
- apps/web/src/pages/Compliance.tsx
- apps/web/src/pages/Dashboard.tsx
- apps/web/src/pages/CockpitDaily.tsx

---

## 1) Todas as entidades atuais

### Core
1. Tenant
2. User

### Auth e identidade
3. LocalePreference (company_locale_preferences)
4. OperationalProfile (company_operational_profiles)
5. FirstAccessInvite (first_access_invites)
6. AuthPasswordOverride (auth_password_overrides)
7. InviteAuditEvent (invite_audit_events)
8. RefreshSession (auth_refresh_sessions)

### Contratos e regras
9. Contract (contracts)
10. ContractRule (extracted_rules)
11. RuleValidationEvent (rule_validation_events)

### Compliance e evidencia
12. ComplianceControl (compliance_controls)
13. ComplianceControlExecution (compliance_control_executions)
14. ComplianceControlEvent (compliance_control_events)
15. ComplianceFinding (compliance_findings)
16. ComplianceFindingEvent (compliance_finding_events)
17. EvidenceReference (evidence_references)
18. NonConformity (non_conformities)
19. ActionPlan (non_conformity_action_plans)
20. NonConformityEvent (non_conformity_events)
21. ActionPlanEvent (non_conformity_action_events)
22. ComplianceExportEvent (compliance_export_events)

### Menus e planejamento
23. MenuImport (menu_pdf_imports)
24. OperationalCardapio (menu_operational_cardapios)
25. MonthlyCycleSummary (menu_monthly_cycle_summaries)
26. CommemorativeDate (menu_commemorative_dates)
27. MenuAdjustedVersion (menu_adjusted_versions)
28. MenuRuleAudit (menu_import_rule_audits)
29. Suggestion (menu_import_adjustment_suggestions)

### Receitas
30. Recipe (recipe_library_items)
31. RecipeIngredient (recipe_ingredients)
32. RecipeItemIngredient (recipe_item_ingredients)
33. RecipeImportEvent (recipe_import_events)
34. RecipeClassificationEvent (recipe_classification_events)

### Avaliacoes e inteligencia
35. EvaluationImport (menu_evaluation_imports)
36. CombinationIntelligence (menu_combination_intelligence)

### Recomendacoes e governanca
37. NextMenuDecision (menu_next_menu_decisions)
38. RecommendationPreview (recommendation_previews)
39. RecommendationPolicy (recommendation_policies)
40. RecommendationRecord (recommendations)
41. AuditRecord (audit_records)
42. AIPreparationEvent (ai_preparation_events)

---

## 2) Relacionamentos existentes

## 2.1 Relacionamentos explicitos (FK Prisma)

1. User.tenant_id -> Tenant.id
2. RefreshSession.tenant_id -> Tenant.id
3. RefreshSession.user_id -> User.id
4. Contract.tenant_id -> Tenant.id
5. ContractRule.tenant_id -> Tenant.id
6. ContractRule.contract_id -> Contract.id
7. RuleValidationEvent.tenant_id -> Tenant.id
8. RuleValidationEvent.rule_id -> ContractRule.id
9. ComplianceControl.tenant_id -> Tenant.id
10. ComplianceControl.contract_id -> Contract.id
11. ComplianceControl.contract_rule_id -> ContractRule.id
12. ComplianceControlExecution.tenant_id -> Tenant.id
13. ComplianceControlExecution.control_id -> ComplianceControl.id
14. ComplianceControlEvent.tenant_id -> Tenant.id
15. ComplianceControlEvent.control_id -> ComplianceControl.id
16. ComplianceFinding.tenant_id -> Tenant.id
17. ComplianceFinding.control_id -> ComplianceControl.id
18. ComplianceFinding.execution_id -> ComplianceControlExecution.id (SetNull)
19. ComplianceFindingEvent.tenant_id -> Tenant.id
20. ComplianceFindingEvent.finding_id -> ComplianceFinding.id
21. EvidenceReference.tenant_id -> Tenant.id
22. EvidenceReference.rule_id -> ContractRule.id
23. EvidenceReference.control_id -> ComplianceControl.id
24. EvidenceReference.execution_id -> ComplianceControlExecution.id
25. MenuImport.tenant_id -> Tenant.id
26. MenuRuleAudit.tenant_id -> Tenant.id
27. MenuRuleAudit.menu_import_id -> MenuImport.id
28. MenuRuleAudit.rule_id -> ContractRule.id (SetNull)
29. Suggestion.tenant_id -> Tenant.id
30. Suggestion.menu_import_id -> MenuImport.id
31. MenuAdjustedVersion.tenant_id -> Tenant.id
32. MenuAdjustedVersion.menu_import_id -> MenuImport.id
33. NonConformity.tenant_id -> Tenant.id
34. ActionPlan.tenant_id -> Tenant.id
35. ActionPlan.non_conformity_id -> NonConformity.id
36. NonConformityEvent.tenant_id -> Tenant.id
37. NonConformityEvent.non_conformity_id -> NonConformity.id
38. ActionPlanEvent.tenant_id -> Tenant.id
39. ActionPlanEvent.non_conformity_id -> NonConformity.id
40. ActionPlanEvent.action_plan_id -> ActionPlan.id
41. ComplianceExportEvent.tenant_id -> Tenant.id
42. ComplianceExportEvent.non_conformity_id -> NonConformity.id (SetNull)
43. ComplianceExportEvent.action_plan_id -> ActionPlan.id (SetNull)
44. Recipe.tenant_id -> Tenant.id
45. RecipeIngredient.tenant_id -> Tenant.id
46. RecipeItemIngredient.tenant_id -> Tenant.id
47. RecipeItemIngredient.recipe_id -> Recipe.id
48. RecipeItemIngredient.ingredient_id -> RecipeIngredient.id
49. RecipeImportEvent.tenant_id -> Tenant.id
50. RecipeClassificationEvent.tenant_id -> Tenant.id
51. RecipeClassificationEvent.recipe_id -> Recipe.id
52. EvaluationImport.tenant_id -> Tenant.id
53. CombinationIntelligence.tenant_id -> Tenant.id
54. NextMenuDecision.tenant_id -> Tenant.id
55. NextMenuDecision.menu_import_id -> MenuImport.id
56. RecommendationPreview.tenant_id -> Tenant.id
57. RecommendationPreview.menu_import_id -> MenuImport.id
58. RecommendationPolicy.tenant_id -> Tenant.id
59. RecommendationRecord.tenant_id -> Tenant.id
60. AuditRecord.tenant_id -> Tenant.id
61. AIPreparationEvent.tenant_id -> Tenant.id

## 2.2 Relacionamentos logicos (sem FK dedicado para a regra de negocio)

1. EvaluationImport <-> MenuImport por company_name + unit_name + service_name + reference_date.
2. CombinationIntelligence agregado por company_name + unit_name + service_name + recipes_json.
3. Recommendation flow usa MenuImport e CombinationIntelligence por contexto company/unit/service.
4. Compliance queries reforcam joins por id e company_name simultaneamente para evitar cross-company.

---

## 3) Onde tenant_id e utilizado

## 3.1 No schema
- tenant_id existe em praticamente todas as entidades de dominio e suporte.
- Excecoes funcionais: Tenant (raiz) e alguns campos polimorficos nao usam FK da entidade alvo.

## 3.2 Em services/endpoints

### Uso direto em fluxo de auth/sessao
- server.ts: sessao de refresh inclui tenant_id no insert e no payload.
- auth/service.ts: tenant_id carregado da sessao para emissao de token.

### Uso em insercoes operacionais
- rules/service.ts: inserts de compliance_controls e eventos com tenant_id.
- compliance/service.ts: inserts de executions, findings e events com tenant_id.

### Observacao AS-IS
- tenant_id e forte na modelagem e em inserts.
- filtro de leitura/seguranca em WHERE usa majoritariamente company_name.

---

## 4) Onde contract_id e utilizado

## 4.1 No schema
- ContractRule.contract_id
- ComplianceControl.contract_id
- Indices por tenant_id + contract_id nas tabelas de regras/controles.

## 4.2 Nos services/endpoints
- contracts/service.ts: criacao de regras extraidas com contract_id.
- rules/service.ts: filtros por contract_id, inserts em extracted_rules e reconciliacao de status do contrato.
- compliance/service.ts: listagem/consulta de controles por contract_id e joins com contracts.

## 4.3 No frontend
- ContractRules.tsx consome /rules?contractId=...
- ContractRules.tsx consome /contracts/:id
- Contracts.tsx controla selecao/navegacao por contractId.

---

## 5) Onde company_name e utilizado como filtro de seguranca

Padrao dominante no AS-IS: company_name e a chave de escopo principal em queries.

## 5.1 server.ts
- filtros por company_name em preferencias, perfil operacional, dashboards e cockpit.

## 5.2 Modulos backend
- auth/service.ts: convites, auditoria e operacoes de onboarding.
- contracts/service.ts: leitura/atualizacao de contratos por empresa.
- rules/service.ts: leitura/atualizacao/listagem de regras por empresa.
- compliance/service.ts: uso massivo em controles, execucoes, findings, sugestoes, NC e exportacoes.
- menus/service.ts: imports, ciclo mensal e operacoes de cardapio por empresa.
- recipes/service.ts: biblioteca de receitas por empresa.
- evaluations/service.ts: imports e inteligencia por empresa.
- recommendations/service.ts: proposta e decisao por empresa.

## 5.3 Conclusao de seguranca AS-IS
- company_name funciona como guarda de isolamento no runtime.
- tenant_id nao e o filtro predominante de leitura no estado atual.

---

## 6) Onde unit_name e service_name aparecem

## 6.1 No schema
- menu_pdf_imports
- menu_operational_cardapios
- menu_monthly_cycle_summaries
- menu_evaluation_imports
- menu_combination_intelligence

## 6.2 Nos services backend

### Menus
- inserts e filtros por unit_name/service_name em importacao, ciclo mensal, listagens e reprocessamentos.
- ON CONFLICT e consultas de sumario com unit_name/service_name.

### Compliance
- leitura de importacoes de menu e matching de contexto por unit_name/service_name.

### Evaluations
- insert em menu_evaluation_imports com unit_name/service_name.
- join logico com menu_pdf_imports por company + unit + service + data.

### Recommendations
- proposta e historico por unit_name/service_name com base em intelligence/import.

## 6.3 No frontend
- Menus.tsx exibe unitName e serviceName na tabela.
- ContractRules.tsx e Contracts.tsx sao centradas em contractId (sem unit/service).
- auth.tsx expoe companyName no estado de sessao.

---

## 7) Entidades com ownership implicito

Ownership implicito = quando o escopo de dono e inferido por company_name, contract_id, unit_name/service_name ou entity_type/entity_id, sem modelagem relacional completa para esse criterio.

1. company_locale_preferences
- ownership por company_name (nao existe entidade Company formal com FK).

2. company_operational_profiles
- ownership por company_name.

3. first_access_invites, auth_password_overrides, invite_audit_events
- ownership por company_name + tenant_id, sem entidade Company dedicada.

4. menu_evaluation_imports
- ownership operacional por company_name + unit_name + service_name.
- vinculo com menu_pdf_imports e logico (join por campos), nao por FK direta.

5. menu_combination_intelligence
- ownership por contexto agregado company/unit/service/combination_key.

6. recommendations (RecommendationRecord)
- menu_import_id existe, mas sem relation Prisma explicita para MenuImport.

7. audit_records
- ownership de alvo por entity_type/entity_id (polimorfico), sem FK para cada entidade de dominio.

8. evidence_references
- mistura FK opcionais (rule/control/execution) com entity_type/entity_id generico, criando ownership hibrido.

9. Fluxo de compliance em runtime
- mesmo com FK por id, varios joins reforcam company_name para manter isolamento de empresa.

---

## 8) Diagrama textual do dominio atual (AS-IS)

Tenant
-> User
-> AuthRefreshSessions
-> Auth scopes por company_name (locale, operational profile, invites)

Tenant
-> Contracts
   -> ContractRules
      -> RuleValidationEvents
      -> ComplianceControls
         -> ComplianceControlExecutions
         -> ComplianceFindings
            -> ComplianceFindingEvents
         -> ComplianceControlEvents
         -> EvidenceReferences

Tenant
-> MenuImports
   -> MenuRuleAudits
   -> Suggestions
   -> MenuAdjustedVersions
   -> NextMenuDecisions
   -> RecommendationPreviews

Tenant
-> OperationalCardapios
-> MonthlyCycleSummaries
-> CommemorativeDates

Tenant
-> RecipeLibraryItems
   -> RecipeItemIngredients
      -> RecipeIngredients
   -> RecipeClassificationEvents
-> RecipeImportEvents

Tenant
-> EvaluationImports
-> CombinationIntelligence

Tenant
-> RecommendationPolicies
-> RecommendationRecords
-> AuditRecords
-> AIPreparationEvents

Conexoes logicas relevantes (nao FK dedicada):
- EvaluationImports <-> MenuImports por company_name + unit_name + service_name + reference_date.
- CombinationIntelligence e Recommendations por company_name + unit_name + service_name.
- Seguranca de leitura majoritariamente por company_name em queries SQL raw.

---

## Inventario de endpoints protegidos (visao de cobertura da analise)

### Auth
- POST /auth/login
- POST /auth/refresh
- GET /auth/me
- POST /auth/logout
- GET/POST /onboarding/operational-profile
- POST /auth/first-access/activate
- POST/GET /auth/invites
- GET /auth/invites/audit
- POST /auth/invites/:token/revoke
- POST /auth/invites/:token/regenerate
- GET/POST /preferences/locale

### Contracts
- POST /contracts
- GET /contracts
- GET /contracts/:id
- PATCH /contracts/:id/status

### Rules
- POST /rules
- GET /rules
- PATCH /rules/:ruleId/status
- POST /rules/:ruleId/promote-control
- DELETE /rules/:ruleId
- GET /rules/:ruleId/history

### Menus
- POST /menus/imports
- GET /menus/imports
- POST /menus/operational-cardapios
- GET /menus/operational-cardapios
- POST /menus/imports/monthly-cycle
- GET /menus/imports/monthly-summaries
- POST /menus/imports/monthly-summaries/reprocess-failed
- endpoints adicionais de validacao/reprocessamento no modulo menus

### Evaluations
- POST /evaluations/imports
- GET /evaluations/imports
- POST /evaluations/intelligence/rebuild
- GET /evaluations/intelligence

### Recommendations / Governance
- GET /governance/recommendations/:importId
- POST /governance/recommendations/:importId/next-menu
- POST /governance/recommendations/:importId/next-menu/decision
- GET /governance/recommendations/:importId/next-menu/decisions
- GET /governance/recommendation-policy

### Compliance
- endpoints de controle, execucao, finding, evidencia, NC e action plans no modulo compliance
- uso intensivo de company_name como criterio de escopo nas queries

---

## Conclusao executiva AS-IS

1. O schema esta fortemente orientado a tenant_id e possui grande cobertura de FKs.
2. O runtime de seguranca e leitura esta majoritariamente orientado a company_name.
3. contract_id esta consolidado em regras e controles, e aparece em API/frontend de contratos e regras.
4. unit_name/service_name sao eixos operacionais fortes em menus, avaliacoes e recomendacoes, mas como atributos textuais.
5. Ha ownership implicito relevante em partes do dominio (company e unit/service), com relacoes logicas em SQL raw.
