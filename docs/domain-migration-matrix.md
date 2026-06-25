# MenuCare - Matriz de Migracao de Dominio

Data: 2026-06-11
Escopo: matriz conceitual baseada em `DOMAIN-AS-IS.md` e `DOMAIN-TO-BE.md`.
Restricoes aplicadas: documentacao apenas; sem alteracao de codigo, schema ou migrations.

---

## 1) Objetivo

Esta matriz organiza a transicao conceitual do dominio atual do MenuCare para o modelo alvo:

```text
Tenant -> Site -> Contract -> Service
```

O objetivo e explicitar, por entidade atual, qual e o escopo de ownership atual, qual deve ser o escopo relacional alvo, quais campos textuais legados sustentam o isolamento hoje e quais campos relacionais devem assumir esse papel no futuro.

Campos textuais como `company_name`, `unit_name` e `service_name` devem permanecer como contexto historico/exibicao durante a transicao, mas nao devem ser a base final de autorizacao, seguranca ou ownership.

---

## 2) Criterios de classificacao

### Ownership alvo

- Tenant-owned: entidade pertence ao tenant como fronteira maxima de isolamento.
- Site-owned: entidade representa contexto local/unidade institucional dentro do tenant.
- Contract-owned: entidade pertence ao contrato e sustenta regras, controles e governanca contratual.
- Service-owned: entidade pertence ao escopo operacional executavel do dia a dia.

### Risco da migracao

- Alto: envolve seguranca, joins logicos por texto, historico operacional, fluxo critico ou alto volume.
- Medio: envolve ownership implicito ou impacto funcional moderado.
- Baixo: entidade transversal, suporte ou com escopo relacional ja simples.

### Fase recomendada

- Fase 0 - Inventario e reconciliacao: mapear dados atuais e divergencias textuais.
- Fase 1 - Site minimo: criar Site, vincular Contract a Site e manter compatibilidade com `company_name`.
- Fase 2 - Contratos e regras: consolidar ownership contratual sem introduzir Service.
- Fase 3 - Operacao por service: introduzir Service e migrar menus, avaliacoes, execucoes, findings e decisoes para `service_id`.
- Fase 4 - Governanca e historico: ajustar recomendacoes, auditoria, evidencias e registros derivados.
- Fase 5 - Descontinuacao controlada: remover dependencia de filtros textuais como criterio de seguranca.

### Uso de `site_id`

A presenca de `site_id` deve ser avaliada por ownership, nao aplicada automaticamente em todas as tabelas.

Categorias obrigatorias:

1. `site_id` obrigatorio direto:
- entidades raiz ou de contexto local cujo ownership primario e Site.
- exemplos: `contracts`, futura tabela `sites`, configuracoes locais e calendario local quando aplicavel.

2. `site_id` derivado por `contract_id`:
- entidades Contract-owned ou eventos contratuais que ja pertencem a Contract, Rule ou Control.
- exemplos: `extracted_rules`, `rule_validation_events`, `compliance_controls`, `compliance_control_events`.

3. `site_id` derivado por `service_id`:
- entidades Service-owned que representam operacao diaria.
- exemplos: `menu_pdf_imports`, `menu_operational_cardapios`, `menu_evaluation_imports`, `menu_combination_intelligence`, `compliance_control_executions`, operational `compliance_findings`, `menu_next_menu_decisions`, `recommendation_previews` e `recommendations`.

Entidades hibridas ou polimorficas, como `evidence_references` e `audit_records`, devem derivar escopo pelo alvo referenciado sempre que possivel. Nao devem receber `site_id` direto sem justificativa especifica.

---

## 3) Matriz de migracao

| Entidade atual | Tabela atual | Classificacao alvo | Escopo atual | Escopo alvo | Campo textual legado usado hoje | Campo relacional alvo | Risco da migracao | Prioridade | Fase recomendada |
|---|---|---|---|---|---|---|---|---|---|
| Tenant | tenants | Tenant-owned | Raiz de tenant | Tenant | N/A | `tenant_id` como raiz para dependentes | Baixo | P0 | Base existente |
| User | users | Tenant-owned | `tenant_id` | Tenant | N/A | `tenant_id` | Baixo | P1 | Sem mudanca estrutural |
| LocalePreference | company_locale_preferences | Tenant-owned | `tenant_id` + `company_name` | Tenant/Site conforme configuracao local | `company_name` | `tenant_id`, futuro `site_id` se preferencia for local | Medio | P2 | Fase 4 |
| OperationalProfile | company_operational_profiles | Tenant-owned | `tenant_id` + `company_name` | Tenant/Site conforme perfil operacional | `company_name` | `tenant_id`, futuro `site_id` se perfil variar por unidade | Medio | P2 | Fase 4 |
| FirstAccessInvite | first_access_invites | Tenant-owned | `tenant_id` + `company_name` | Tenant | `company_name` | `tenant_id` | Medio | P2 | Fase 4 |
| AuthPasswordOverride | auth_password_overrides | Tenant-owned | `tenant_id` + `company_name` | Tenant | `company_name` | `tenant_id` | Medio | P2 | Fase 4 |
| InviteAuditEvent | invite_audit_events | Tenant-owned | `tenant_id` + `company_name` | Tenant | `company_name` | `tenant_id` | Baixo | P3 | Fase 4 |
| RefreshSession | auth_refresh_sessions | Tenant-owned | `tenant_id` + `company_name` | Tenant | `company_name` | `tenant_id` | Medio | P1 | Fase 4 |
| **Contract** | **contracts** | **Contract-owned** | `tenant_id` + `company_name` | Tenant -> Site -> Contract | `company_name` | `tenant_id`, `site_id` direto; `id` e a raiz contratual | Alto | P0 | Fase 1 |
| **ContractRule** | **extracted_rules** | **Contract-owned** | `tenant_id` + `company_name` + `contract_id` | Tenant -> Site -> Contract | `company_name` | `tenant_id`, `contract_id`; `site_id` derivado via Contract | Alto | P0 | Fase 2 |
| RuleValidationEvent | rule_validation_events | Contract-owned | `tenant_id` + `company_name` + `rule_id` | Tenant -> Site -> Contract -> Rule | `company_name` | `tenant_id`, `rule_id`; `contract_id`/`site_id` derivados pela Rule | Medio | P1 | Fase 2 |
| **ComplianceControl** | **compliance_controls** | **Contract-owned** | `tenant_id` + `company_name` + `contract_id` + `contract_rule_id` | Tenant -> Site -> Contract -> Control | `company_name` | `tenant_id`, `contract_id`, `contract_rule_id`; `site_id` derivado via Contract | Alto | P0 | Fase 2 |
| **ComplianceControlExecution** | **compliance_control_executions** | **Service-owned** | `tenant_id` + `company_name` + `control_id` | Tenant -> Site -> Contract -> Service -> Execution | `company_name` | `tenant_id`, futuro `service_id`, `control_id`; `contract_id`/`site_id` derivados | Alto | P0 | Fase 3 |
| ComplianceControlEvent | compliance_control_events | Contract-owned | `tenant_id` + `company_name` + `control_id` | Tenant -> Site -> Contract -> Control | `company_name` | `tenant_id`, `control_id`; `contract_id`/`site_id` derivados pelo Control | Medio | P1 | Fase 2 |
| **ComplianceFinding** | **compliance_findings** | **Service-owned quando operacional** | `tenant_id` + `company_name` + `control_id` + `execution_id` | Tenant -> Site -> Contract -> Service -> Finding quando houver execucao | `company_name` | `tenant_id`, `control_id`, `execution_id`; futuro `service_id` quando vinculado a execucao operacional | Alto | P0 | Fase 3 |
| ComplianceFindingEvent | compliance_finding_events | Service-owned quando operacional | `tenant_id` + `company_name` + `finding_id` | Tenant -> Site -> Contract -> Service -> Finding quando houver execucao | `company_name` | `tenant_id`, `finding_id`; escopo derivado pelo Finding | Medio | P1 | Fase 3 |
| EvidenceReference | evidence_references | Ownership hibrido | `tenant_id` + `company_name` + `entity_type/entity_id` + FKs opcionais | Rule/Control/Execution/Finding/MenuImport/Recommendation/outro alvo | `company_name` | `tenant_id`, FKs especificas; `service_id` opcional/futuro apenas quando evidencia for operacional | Alto | P0 | Fase 4 |
| NonConformity | non_conformities | Service-owned | `tenant_id` + `company_name` | Tenant -> Site -> Contract -> Service -> NonConformity | `company_name` | `tenant_id`, futuro `service_id`; `contract_id`/`site_id` derivados via Service | Alto | P1 | Fase 3 |
| ActionPlan | non_conformity_action_plans | Service-owned | `tenant_id` + `company_name` + `non_conformity_id` | Tenant -> Site -> Contract -> Service -> ActionPlan | `company_name` | `tenant_id`, `non_conformity_id`; futuro `service_id` derivado pela NC ou direto se necessario | Alto | P1 | Fase 3 |
| NonConformityEvent | non_conformity_events | Service-owned | `tenant_id` + `company_name` + `non_conformity_id` | Tenant -> Site -> Contract -> Service -> NonConformity | `company_name` | `tenant_id`, `non_conformity_id`; escopo derivado pela NC | Medio | P2 | Fase 3 |
| ActionPlanEvent | non_conformity_action_events | Service-owned | `tenant_id` + `company_name` + `action_plan_id` | Tenant -> Site -> Contract -> Service -> ActionPlan | `company_name` | `tenant_id`, `action_plan_id`; escopo derivado pelo ActionPlan | Medio | P2 | Fase 3 |
| ComplianceExportEvent | compliance_export_events | Tenant-owned | `tenant_id` + `company_name` + filtros polimorficos | Tenant com filtros por Site/Contract/Service | `company_name` | `tenant_id`; escopos adicionais derivados dos filtros/alvos quando aplicavel | Medio | P3 | Fase 4 |
| **MenuImport** | **menu_pdf_imports** | **Service-owned** | `tenant_id` + `company_name` + `unit_name` + `service_name` | Tenant -> Site -> Contract -> Service -> MenuImport | `company_name`, `unit_name`, `service_name` | `tenant_id`, futuro `service_id`; `contract_id`/`site_id` derivados via Service | Alto | P0 | Fase 3 |
| **OperationalCardapio** | **menu_operational_cardapios** | **Service-owned** | `tenant_id` + `company_name` + `unit_name` + `service_name` | Tenant -> Site -> Contract -> Service -> OperationalCardapio | `company_name`, `unit_name`, `service_name` | `tenant_id`, futuro `service_id`; `contract_id`/`site_id` derivados via Service | Alto | P0 | Fase 3 |
| MonthlyCycleSummary | menu_monthly_cycle_summaries | Service-owned | `tenant_id` + `company_name` + `unit_name` + `service_name` | Tenant -> Site -> Contract -> Service -> MonthlyCycleSummary | `company_name`, `unit_name`, `service_name` | `tenant_id`, futuro `service_id`; `contract_id`/`site_id` derivados via Service | Alto | P1 | Fase 3 |
| CommemorativeDate | menu_commemorative_dates | Site-owned | `tenant_id` + `company_name` + `reference_date` | Tenant -> Site -> CalendarDate | `company_name` | `tenant_id`, futuro `site_id` direto quando calendario for local | Medio | P2 | Fase 3 |
| MenuAdjustedVersion | menu_adjusted_versions | Service-owned | `tenant_id` + `company_name` + `menu_import_id` | Tenant -> Site -> Contract -> Service -> MenuImport -> AdjustedVersion | `company_name` | `tenant_id`, `menu_import_id`; escopo derivado pelo MenuImport/futuro Service | Alto | P1 | Fase 3 |
| MenuRuleAudit | menu_import_rule_audits | Service-owned | `tenant_id` + `company_name` + `menu_import_id` + `rule_id` | Tenant -> Site -> Contract -> Service -> MenuImport -> RuleAudit | `company_name` | `tenant_id`, `menu_import_id`, `rule_id`; escopo derivado pelo MenuImport/futuro Service | Alto | P0 | Fase 3 |
| Suggestion | menu_import_adjustment_suggestions | Service-owned | `tenant_id` + `company_name` + `menu_import_id` | Tenant -> Site -> Contract -> Service -> MenuImport -> Suggestion | `company_name` | `tenant_id`, `menu_import_id`; escopo derivado pelo MenuImport/futuro Service | Alto | P1 | Fase 4 |
| Recipe | recipe_library_items | Tenant-owned | `tenant_id` + `company_name` | Tenant, com possivel disponibilidade por Site/Service futura | `company_name` | `tenant_id`, possivel futuro `site_id` para escopo local | Medio | P3 | Fase 4 |
| RecipeIngredient | recipe_ingredients | Tenant-owned | `tenant_id` + `company_name` | Tenant | `company_name` | `tenant_id` | Baixo | P3 | Fase 4 |
| RecipeItemIngredient | recipe_item_ingredients | Tenant-owned | `tenant_id` + `company_name` + `recipe_id` | Tenant -> Recipe | `company_name` | `tenant_id`, `recipe_id`, `ingredient_id` | Baixo | P3 | Fase 4 |
| RecipeImportEvent | recipe_import_events | Tenant-owned | `tenant_id` + `company_name` | Tenant | `company_name` | `tenant_id` | Baixo | P3 | Fase 4 |
| RecipeClassificationEvent | recipe_classification_events | Tenant-owned | `tenant_id` + `company_name` + `recipe_id` | Tenant -> Recipe | `company_name` | `tenant_id`, `recipe_id` | Baixo | P3 | Fase 4 |
| **EvaluationImport** | **menu_evaluation_imports** | **Service-owned** | `tenant_id` + `company_name` + `unit_name` + `service_name` | Tenant -> Site -> Contract -> Service -> EvaluationImport | `company_name`, `unit_name`, `service_name` | `tenant_id`, futuro `service_id`; `contract_id`/`site_id` derivados via Service | Alto | P0 | Fase 3 |
| **CombinationIntelligence** | **menu_combination_intelligence** | **Service-owned** | `tenant_id` + `company_name` + `unit_name` + `service_name` + `combination_key` | Tenant -> Site -> Contract -> Service -> CombinationIntelligence | `company_name`, `unit_name`, `service_name` | `tenant_id`, futuro `service_id`, `combination_key`; `contract_id`/`site_id` derivados via Service | Alto | P1 | Fase 3 |
| **NextMenuDecision** | **menu_next_menu_decisions** | **Service-owned** | `tenant_id` + `company_name` + `menu_import_id` | Tenant -> Site -> Contract -> Service -> MenuImport -> Decision | `company_name` | `tenant_id`, `menu_import_id`; escopo derivado pelo MenuImport/futuro Service | Alto | P1 | Fase 4 |
| **RecommendationPreview** | **recommendation_previews** | **Service-owned** | `tenant_id` + `menu_import_id` | Tenant -> Site -> Contract -> Service -> MenuImport -> Preview | N/A direto; herda contexto textual de MenuImport | `tenant_id`, `menu_import_id`; escopo derivado pelo MenuImport/futuro Service | Medio | P2 | Fase 4 |
| RecommendationPolicy | recommendation_policies | Tenant-owned | `tenant_id` | Tenant, com possivel override por Contract/Service no futuro | N/A | `tenant_id`; possivel futuro `contract_id`/`service_id` se politica variar | Baixo | P3 | Fase 4 |
| **RecommendationRecord** | **recommendations** | **Service-owned** | `tenant_id` + `menu_import_id` opcional | Tenant -> Site -> Contract -> Service -> RecommendationRecord | N/A direto; contexto operacional pode ser indireto | `tenant_id`, futuro `service_id` ou `menu_import_id`; `contract_id`/`site_id` derivados | Alto | P1 | Fase 4 |
| AuditRecord | audit_records | Tenant-owned | `tenant_id` + `entity_type/entity_id` | Tenant com referencias por Site/Contract/Service quando aplicavel | N/A direto; alvo pode conter contexto textual | `tenant_id`; escopos especificos derivados do alvo auditado quando aplicavel | Medio | P2 | Fase 4 |
| AIPreparationEvent | ai_preparation_events | Tenant-owned | `tenant_id` + `company_name` + `module_key` | Tenant; nunca decisorio | `company_name` | `tenant_id`, possivel futuro `site_id`/`contract_id` conforme fonte documental | Medio | P3 | Fase 4 |

---

## 4) Entidades criticas destacadas

### Contratos e regras

As tabelas `contracts`, `extracted_rules` e `compliance_controls` devem ser a primeira consolidacao funcional apos a fundacao estrutural, porque sustentam o eixo:

```text
Contrato -> Regra -> Controle
```

Estado atual:
- `contracts` usa `tenant_id` no schema, mas o runtime ainda escopa por `company_name`.
- `extracted_rules` ja possui `contract_id`, porem ainda carrega `company_name`.
- `compliance_controls` ja possui `contract_id` e `contract_rule_id`, mas ainda usa `company_name` em filtros e joins.

Alvo:
- `contracts` deve pertencer a `tenant_id + site_id`.
- `contracts` nao deve receber `contract_id`, porque Contract e a propria raiz contratual.
- `contracts` nao deve receber `service_id`, porque Service e descendente operacional do Contract.
- `extracted_rules` e `compliance_controls` devem ser `Contract-owned`.
- `extracted_rules` e `compliance_controls` podem derivar `site_id` via `contract_id`.
- `company_name` deve virar snapshot textual legado, nao criterio de autorizacao.

### `site_id` direto vs derivado

`site_id` nao deve ser adicionado indiscriminadamente em todas as tabelas. A decisao deve seguir a fronteira de ownership:

#### `site_id` obrigatorio direto

- `contracts`: Contract e a raiz contratual dentro de um Site.
- futuras entidades de Site, como cadastro de Site, calendario local e configuracoes locais.
- `menu_commemorative_dates`, se o calendario comemorativo for gerido por unidade local.

#### `site_id` derivado por `contract_id`

- `extracted_rules`: deriva Site por `contract_id`.
- `rule_validation_events`: deriva Site pela Rule e seu Contract.
- `compliance_controls`: deriva Site por `contract_id`.
- `compliance_control_events`: deriva Site pelo Control.

#### `site_id` derivado por `service_id`

- `menu_pdf_imports`, `menu_operational_cardapios`, `menu_evaluation_imports` e `menu_combination_intelligence`: derivam Site pelo futuro Service.
- `compliance_control_executions`: deriva Site pelo futuro Service; antes disso pode derivar pelo Control/Contract apenas como compatibilidade.
- `compliance_findings`: quando operacional, deriva Site por Execution/Service; se contratual, deriva por Control/Contract.
- `menu_import_rule_audits`, `menu_import_adjustment_suggestions`, `menu_adjusted_versions`, `menu_next_menu_decisions`, `recommendation_previews` e `recommendations`: devem derivar Site pelo MenuImport ou pelo futuro Service.
- `audit_records` e `compliance_export_events`: devem derivar Site pelo alvo auditado/exportado quando aplicavel.

### Execucao, finding e evidencia

As tabelas `compliance_control_executions`, `compliance_findings` e `evidence_references` devem ser tratadas com mais cuidado, preservando:

```text
Controle -> Execucao -> Finding -> Evidencia
```

Alvo:
- `ComplianceControl` permanece Contract-owned.
- `ComplianceControlExecution` e Service-owned porque representa execucao operacional.
- `ComplianceFinding` e Service-owned quando estiver relacionado a uma execucao operacional; findings puramente contratuais podem derivar escopo pelo Control.
- `ComplianceFinding` pode manter `control_id` para rastreabilidade mesmo quando o escopo operacional futuro vier de Execution/Service.
- `ComplianceControl` nao deve virar Service-owned por padrao.
- `EvidenceReference` tem ownership hibrido e pode apontar para Rule, Control, Execution, Finding, MenuImport, Recommendation ou outro alvo.
- `EvidenceReference` nao deve receber `service_id` obrigatorio na primeira fase; `service_id` deve ser opcional/futuro quando a evidencia estiver ligada a execucao operacional.
- evidencia deve apontar para a entidade correta sem depender de `entity_type/entity_id` como unica fonte de ownership no estado final.
- a rastreabilidade nao pode ser reduzida durante a transicao.

### Menus, avaliacoes e inteligencia

As tabelas `menu_pdf_imports`, `menu_operational_cardapios`, `menu_evaluation_imports` e `menu_combination_intelligence` concentram o maior risco de migracao porque hoje usam:

```text
company_name + unit_name + service_name
```

Alvo:
- `unit_name` deve mapear para `site_id`.
- `service_name` deve mapear para `service_id`.
- registros historicos podem manter `unit_name` e `service_name` como snapshot de exibicao.
- joins entre cardapio e avaliacao devem migrar de texto para `service_id` e datas de referencia.

### Recomendacoes e decisoes

As tabelas `menu_next_menu_decisions`, `recommendation_previews` e `recommendations` devem ser tratadas como Service-owned porque dependem do contexto operacional do cardapio.

Regras preservadas:
- historico de avaliacoes nunca bloqueia sozinho.
- decisao final e humana e auditavel.
- recomendacao deve manter origem, motivo, regra relacionada e evidencia utilizada.

---

## 5) Sequencia recomendada de migracao conceitual

1. Fase 0 - Inventario e reconciliacao
- Levantar valores distintos de `company_name`, `unit_name` e `service_name`.
- Identificar duplicidades, sinonimos e registros sem correspondencia clara.
- Definir regras humanas de consolidacao para Site e Service.

2. Fase 1 - Site minimo
- Criar Site.
- Vincular Contract a Site.
- Fazer backfill inicial usando `company_name` e `unit_name` quando aplicavel.
- Manter compatibilidade com campos textuais legados.
- Nao alterar Service ainda.
- Nao alterar menus ainda.
- Nao alterar compliance ainda.
- Nao trocar definitivamente filtros de seguranca ainda.

3. Fase 2 - Contratos e regras
- Manter `ContractRule` e `ComplianceControl` como Contract-owned.
- Usar `contract_id` como eixo de derivacao de Site para regras, controles e eventos contratuais.
- Preservar historico de validacao e eventos.

4. Fase 3 - Operacao por Service
- Introduzir Service apos a relacao Contract -> Site estar estavel.
- Migrar conceitualmente menus, cardapios, avaliacoes, execucoes, findings, nao conformidades e planos de acao para Service-owned.
- Substituir joins logicos por texto por relacoes derivadas de `service_id`.
- Preservar snapshots textuais como evidencias historicas.

5. Fase 4 - Governanca e historico
- Ajustar recomendacoes, decisoes, auditorias, evidencias e exportacoes para carregar o escopo relacional correto.
- Garantir que recomendacoes continuem explicaveis e nao decisorias.

6. Fase 5 - Descontinuacao controlada
- Remover dependencia de `company_name`, `unit_name` e `service_name` como filtros de seguranca.
- Manter campos legados somente enquanto forem necessarios para exibicao, compatibilidade ou auditoria historica.

---

## 6) Fase 1 minima recomendada

### Objetivo

Estabelecer a primeira fronteira relacional abaixo de Tenant sem alterar o fluxo operacional. A Fase 1 deve apenas criar o conceito de Site e vincular Contract a Site, mantendo `company_name`, `unit_name` e demais campos textuais como compatibilidade historica e operacional.

Esta fase nao deve introduzir Service, nao deve migrar menus, nao deve alterar compliance e nao deve trocar definitivamente filtros de seguranca ainda.

### Tabelas afetadas

- `contracts`: tabela principal afetada, pois Contract passa a ser raiz contratual dentro de um Site.
- futura tabela estrutural de Site, caso aprovada em desenho e migration posterior.

Tabelas nao afetadas diretamente nesta fase:
- `extracted_rules`
- `compliance_controls`
- `compliance_control_executions`
- `compliance_findings`
- `menu_pdf_imports`
- `menu_operational_cardapios`
- `menu_evaluation_imports`
- `menu_combination_intelligence`
- `menu_next_menu_decisions`
- `recommendation_previews`
- `recommendations`

Essas entidades devem continuar funcionando por compatibilidade ate fases posteriores.

### Campos novos propostos

- Em uma futura entidade `sites`: `id`, `tenant_id`, `code`, `name`, `status`, `timezone`, `created_at`, `updated_at`.
- Em `contracts`: `site_id`.

Nao propor nesta fase:
- `service_id` em qualquer tabela.
- `site_id` em todas as tabelas derivadas.
- troca global de `company_name` por `site_id` em filtros de seguranca.

### Dados legados usados para backfill

- `contracts.company_name`: fonte inicial para sugerir ou associar Site.
- `unit_name`, quando existir em dados operacionais ja importados, pode apoiar reconciliacao humana do Site canonico.
- `tenants.id` / `contracts.tenant_id`: fronteira obrigatoria para impedir cruzamento multi-tenant.
- dados operacionais existentes podem informar a reconciliacao, mas nao devem dirigir alteracao de menus nesta fase.

### Riscos

- `company_name` pode representar empresa, unidade ou contexto textual, nao necessariamente Site canonico.
- Pode haver multiplos contratos com o mesmo `company_name` que deveriam pertencer a Sites distintos.
- Criar Site sem reconciliacao humana pode cristalizar aliases ou nomes inconsistentes.
- Trocar filtros de seguranca cedo demais pode quebrar isolamento se o backfill de Site estiver incompleto.

### Rollback conceitual

- Manter `company_name` como criterio de compatibilidade durante toda a Fase 1.
- Tratar `site_id` em Contract como enriquecimento estrutural, nao como unico criterio de seguranca no primeiro momento.
- Se a associacao Contract -> Site estiver incorreta, reverter conceitualmente a vinculacao para o Site correto sem alterar regras, controles, menus ou historico operacional.

### Criterios de aceite

- Todo Contract ativo possui um Site associado dentro do mesmo Tenant.
- Nenhum Contract recebe `contract_id` ou `service_id`.
- `company_name` continua disponivel como contexto textual legado.
- Regras e controles continuam acessiveis via `contract_id`.
- Nenhum menu, avaliacao, execution, finding ou recommendation e migrado nesta fase.
- Nenhum filtro de seguranca deixa de funcionar por falta de Site.
- A relacao Tenant -> Site -> Contract fica validada sem reduzir auditoria, rastreabilidade ou isolamento multi-tenant.

---

## 7) Gates obrigatorios antes de qualquer implementacao futura

Qualquer mudanca derivada desta matriz deve responder antes da implementacao:

1. Preserva rastreabilidade?
2. Preserva auditoria?
3. Preserva multi-tenant?
4. Preserva explicabilidade?
5. Reduz acoplamento?
6. Aproxima a arquitetura do dominio alvo?
7. Mantem o fluxo `Contrato -> Regra -> Controle -> Execucao -> Finding -> Evidencia`?
8. Mantem `company_name`, `unit_name` e `service_name` como legado/contexto textual?
9. Usa `tenant_id`, `site_id`, `contract_id` e `service_id` como base futura de seguranca?

Se qualquer resposta for "nao", o desenho deve ser reavaliado antes de qualquer alteracao de codigo, schema ou migration.

---

## 8) Decisoes arquiteturais corrigidas

### Por que Contract nao recebe `contract_id`

`Contract` e a propria raiz contratual dentro de um Site. Na tabela `contracts`, o identificador do contrato ja e o proprio `id`; adicionar `contract_id` criaria duplicidade semantica e risco de inconsistencia. Entidades filhas como `extracted_rules` e `compliance_controls` devem apontar para `contracts.id` por meio de `contract_id`.

### Por que Site vem antes de Service

`Site` resolve primeiro a fronteira local dentro do Tenant e permite posicionar Contract no lugar correto da hierarquia:

```text
Tenant -> Site -> Contract
```

Sem essa base, criar `Service` antecipadamente forçaria mapeamentos operacionais baseados em `unit_name` e `service_name` ainda nao reconciliados. A ordem correta reduz ambiguidade, preserva compatibilidade com `company_name` e evita migrar menus/compliance antes de existir uma raiz local confiavel.

### Por que ComplianceControl continua Contract-owned

`ComplianceControl` nasce de uma regra contratual aprovada e representa o controle esperado para cumprir o contrato. Portanto, seu ownership funcional e contratual:

```text
Contract -> ContractRule -> ComplianceControl
```

Transformar `ComplianceControl` em Service-owned por padrao misturaria definicao contratual com execucao operacional. A execucao do controle acontece em Service, mas o controle em si continua pertencendo ao Contract.

### Por que Execution e Finding sao Service-owned

`ComplianceControlExecution` representa a execucao operacional de um controle em contexto de dia a dia. Por isso, no modelo alvo, deve pertencer ao Service.

`ComplianceFinding` tambem e Service-owned quando nasce de uma execucao operacional, pois o achado reflete uma ocorrencia concreta em um contexto operacional. Ainda assim, deve manter `control_id` e, quando aplicavel, `execution_id` para preservar rastreabilidade:

```text
Control -> Execution -> Finding
```

Findings que nao nascem de execucao operacional podem derivar escopo pelo Control/Contract ate uma normalizacao posterior.

### Por que EvidenceReference nao sera migrado totalmente na primeira fase

`EvidenceReference` possui ownership hibrido: pode estar vinculada a Rule, Control, Execution, Finding, MenuImport, Recommendation ou outro alvo. Como a Fase 1 minima introduz apenas Site e vincula Contract a Site, ainda nao existe Service normalizado nem migracao de menus/compliance.

Obrigar `service_id` em EvidenceReference na primeira fase quebraria evidencias contratuais e polimorficas que nao pertencem a uma execucao operacional. Por isso, a decisao corrigida e:

- manter `EvidenceReference` com `tenant_id` e FKs/alvos especificos;
- derivar Site/Contract/Service pelo alvo quando possivel;
- tratar `service_id` como opcional/futuro apenas para evidencias operacionais;
- adiar a migracao completa de EvidenceReference para uma fase posterior de governanca e historico.
