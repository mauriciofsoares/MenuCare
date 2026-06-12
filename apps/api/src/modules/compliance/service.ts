import type { FastifyInstance } from 'fastify';
import { createComplianceRepository } from './repository.js';
import { menuImportMemory } from '../menus/service.js';
import { recipeMemory } from '../recipes/service.js';
import { ruleMemory } from '../rules/service.js';

export interface Deps {
  [key: string]: any;
}

const CONTROL_STATUS_VALUES = ['DRAFT', 'ACTIVE', 'PAUSED', 'NON_COMPLIANT', 'COMPLETED'] as const;
const FINDING_STATUS_VALUES = ['OPEN', 'IN_ANALYSIS', 'RESOLVED', 'ACCEPTED_RISK'] as const;
const FINDING_SEVERITY_VALUES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const menuAuditMemory = new Map<string, Array<{
  id: string;
  ruleId: string;
  ruleTitle: string;
  resultStatus: 'compliant' | 'non_compliant';
  evidence: string;
  createdAt: string;
}>>();

const CONTROL_STATUS_TRANSITIONS: Record<(typeof CONTROL_STATUS_VALUES)[number], Array<(typeof CONTROL_STATUS_VALUES)[number]>> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['PAUSED', 'NON_COMPLIANT', 'COMPLETED'],
  PAUSED: ['ACTIVE'],
  NON_COMPLIANT: ['ACTIVE', 'COMPLETED'],
  COMPLETED: [],
};

const FINDING_STATUS_TRANSITIONS: Record<(typeof FINDING_STATUS_VALUES)[number], Array<(typeof FINDING_STATUS_VALUES)[number]>> = {
  OPEN: ['IN_ANALYSIS', 'RESOLVED', 'ACCEPTED_RISK'],
  IN_ANALYSIS: ['OPEN', 'RESOLVED', 'ACCEPTED_RISK'],
  RESOLVED: ['IN_ANALYSIS'],
  ACCEPTED_RISK: ['IN_ANALYSIS'],
};

const normalizeControlStatus = (value: string | null | undefined) => {
  const normalized = (value ?? '').trim().toUpperCase();

  if (normalized === 'INACTIVE') {
    return 'PAUSED';
  }

  return CONTROL_STATUS_VALUES.includes(normalized as (typeof CONTROL_STATUS_VALUES)[number])
    ? normalized
    : 'DRAFT';
};

const normalizeControlStatusFilter = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    return 'all' as const;
  }

  if (value.trim().toLowerCase() === 'all') {
    return 'all' as const;
  }

  const normalized = normalizeControlStatus(value);
  return normalized;
};

const normalizeFindingStatus = (value: string | null | undefined) => {
  const normalized = (value ?? '').trim().toUpperCase();
  return FINDING_STATUS_VALUES.includes(normalized as (typeof FINDING_STATUS_VALUES)[number])
    ? normalized
    : 'OPEN';
};

const normalizeFindingSeverity = (value: string | null | undefined) => {
  const normalized = (value ?? '').trim().toUpperCase();
  return FINDING_SEVERITY_VALUES.includes(normalized as (typeof FINDING_SEVERITY_VALUES)[number])
    ? normalized
    : 'MEDIUM';
};

const canRegisterExecution = (status: string) => ['ACTIVE', 'NON_COMPLIANT'].includes(normalizeControlStatus(status));

const canTransitionControlStatus = (currentStatus: string, nextStatus: string) => {
  const current = normalizeControlStatus(currentStatus) as (typeof CONTROL_STATUS_VALUES)[number];
  const next = normalizeControlStatus(nextStatus) as (typeof CONTROL_STATUS_VALUES)[number];

  if (current === next) {
    return false;
  }

  return CONTROL_STATUS_TRANSITIONS[current].includes(next);
};

const canTransitionFindingStatus = (currentStatus: string, nextStatus: string) => {
  const current = normalizeFindingStatus(currentStatus) as (typeof FINDING_STATUS_VALUES)[number];
  const next = normalizeFindingStatus(nextStatus) as (typeof FINDING_STATUS_VALUES)[number];

  if (current === next) {
    return false;
  }

  return FINDING_STATUS_TRANSITIONS[current].includes(next);
};

export const createComplianceService = (deps: Deps) => {
  const repository = createComplianceRepository(deps);

  const registerRoutes = (app: FastifyInstance) => {
    const service = deps as any;
    const { apiMessage, authenticate, menuImportParamsSchema, prisma, getCompanyFromJwt, ensureDomainTables, normalizeTerm, getDateOnlyString, buildSemanticAliasByContext, resolveStructuredRecipeFromImportedName, startOfIsoWeek, addUtcDays, extractRuleTarget, extractWeeklyMinimum, extractRecurrenceDays, diffUtcDays, inferSuggestionEvidenceSource, inferSuggestionEvidenceSubtype, randomUUID, nonConformitySchema, nonConformityParamsSchema, nonConformityStatusSchema, nonConformityHistoryQuerySchema, getUserFromJwt, actionPlanSchema, actionPlanParamsSchema, actionPlanStatusSchema, actionPlanHistoryQuerySchema, complianceExportAuditQuerySchema, z } = service;

    const buildMemoryMenuAudit = (request: any, importId: string) => {
      const companyName = getCompanyFromJwt(request);
      const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';
      const imported = menuImportMemory.get(importId);

      if (!imported || imported.companyName !== companyName || imported.tenantId !== tenantId) {
        return null;
      }

      const structuredRecipeRows = Array.from(recipeMemory.values())
        .filter((recipe) => recipe.companyName === companyName && recipe.tenantId === tenantId && recipe.isActive)
        .map((recipe) => ({
          name: recipe.name,
          normalized_name: recipe.normalizedName,
          category: recipe.category,
          subcategory: recipe.subcategory,
          food_group: recipe.foodGroup,
        }));
      const structuredRecipeByNormalizedName = new Map(
        structuredRecipeRows.map((item: any) => [item.normalized_name, item]),
      );
      const semanticAliasByContext = buildSemanticAliasByContext({
        mealType: imported.mealType,
        serviceName: imported.serviceName,
      });
      const importedStructuredRecipes = imported.recipes
        .map((recipeName) =>
          resolveStructuredRecipeFromImportedName(
            recipeName,
            structuredRecipeRows,
            structuredRecipeByNormalizedName,
            semanticAliasByContext,
          ),
        )
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      const recipeCorpus = normalizeTerm(imported.recipes.join(' '));
      const importReferenceDate = getDateOnlyString(imported.referenceDate);
      const buildTermVariants = (value: string) => {
        const normalized = normalizeTerm(value);

        if (!normalized || normalized === 'outros' || normalized === 'nao classificado') {
          return [] as string[];
        }

        const variants = new Set<string>([normalized]);

        if (normalized.endsWith('s') && normalized.length > 4) {
          variants.add(normalized.slice(0, -1));
        }

        return Array.from(variants);
      };
      const approvedRules = Array.from(ruleMemory.values())
        .filter((rule) => rule.companyName === companyName && rule.tenantId === tenantId && rule.status === 'approved')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const auditRows: Array<{
        id: string;
        ruleId: string;
        ruleTitle: string;
        resultStatus: 'compliant' | 'non_compliant';
        evidence: string;
        createdAt: string;
      }> = [];

      for (const rule of approvedRules) {
        const normalizedRuleText = normalizeTerm(`${rule.title} ${rule.description}`);
        const ruleTarget = extractRuleTarget(normalizedRuleText);
        const weeklyMinimum = extractWeeklyMinimum(normalizedRuleText);
        const recurrenceDays = extractRecurrenceDays(normalizedRuleText);

        if (ruleTarget && weeklyMinimum !== null) {
          const weekStart = startOfIsoWeek(importReferenceDate);
          const weekEnd = addUtcDays(weekStart, 6);
          const weeklyOccurrences = Array.from(menuImportMemory.values())
            .filter((item) =>
              item.companyName === companyName
              && item.tenantId === tenantId
              && item.unitName === imported.unitName
              && item.serviceName === imported.serviceName
              && item.referenceDate >= weekStart
              && item.referenceDate <= weekEnd
            )
            .filter((item) => {
              const structuredRecipes = item.recipes
                .map((recipeName) =>
                  resolveStructuredRecipeFromImportedName(
                    recipeName,
                    structuredRecipeRows,
                    structuredRecipeByNormalizedName,
                    semanticAliasByContext,
                  ),
                )
                .filter((recipe): recipe is NonNullable<typeof recipe> => Boolean(recipe));

              return structuredRecipes.some((recipe) => ruleTarget.matches(recipe));
            }).length;

          auditRows.push({
            id: randomUUID(),
            ruleId: rule.id,
            ruleTitle: rule.title,
            resultStatus: weeklyOccurrences >= weeklyMinimum ? 'compliant' : 'non_compliant',
            evidence: `Regra avaliada por frequencia estruturada: ${ruleTarget.label} encontrado ${weeklyOccurrences} vez(es) na semana de ${weekStart} a ${weekEnd}; minimo exigido ${weeklyMinimum}.`,
            createdAt: new Date().toISOString(),
          });
          continue;
        }

        if (ruleTarget && recurrenceDays !== null) {
          const currentHasTarget = importedStructuredRecipes.some((recipe) => ruleTarget.matches(recipe));

          if (!currentHasTarget) {
            auditRows.push({
              id: randomUUID(),
              ruleId: rule.id,
              ruleTitle: rule.title,
              resultStatus: 'compliant',
              evidence: `Regra avaliada por recorrencia estruturada: ${ruleTarget.label} nao aparece nesta importacao, sem violacao de recorrencia.`,
              createdAt: new Date().toISOString(),
            });
            continue;
          }

          const recurrenceWindowStart = addUtcDays(importReferenceDate, -(recurrenceDays - 1));
          const previousOccurrence = Array.from(menuImportMemory.values())
            .filter((item) =>
              item.companyName === companyName
              && item.tenantId === tenantId
              && item.unitName === imported.unitName
              && item.serviceName === imported.serviceName
              && item.referenceDate >= recurrenceWindowStart
              && item.referenceDate <= addUtcDays(importReferenceDate, -1)
            )
            .find((item) => {
              const structuredRecipes = item.recipes
                .map((recipeName) =>
                  resolveStructuredRecipeFromImportedName(
                    recipeName,
                    structuredRecipeRows,
                    structuredRecipeByNormalizedName,
                    semanticAliasByContext,
                  ),
                )
                .filter((recipe): recipe is NonNullable<typeof recipe> => Boolean(recipe));

              return structuredRecipes.some((recipe) => ruleTarget.matches(recipe));
            });

          auditRows.push({
            id: randomUUID(),
            ruleId: rule.id,
            ruleTitle: rule.title,
            resultStatus: previousOccurrence ? 'non_compliant' : 'compliant',
            evidence: previousOccurrence
              ? `Regra avaliada por recorrencia estruturada: ${ruleTarget.label} reapareceu abaixo do minimo de ${recurrenceDays} dias.`
              : `Regra avaliada por recorrencia estruturada: ${ruleTarget.label} sem repeticao nos ultimos ${recurrenceDays} dias.`,
            createdAt: new Date().toISOString(),
          });
          continue;
        }

        const structuredEvidenceByTarget = ruleTarget
          ? importedStructuredRecipes.find((recipe) => ruleTarget.matches(recipe))
          : null;
        const structuredEvidenceByLexicalMatch = importedStructuredRecipes.find((recipe) => {
          const candidates = [
            ...buildTermVariants(recipe.name),
            ...buildTermVariants(recipe.category),
            ...buildTermVariants(recipe.subcategory),
            ...buildTermVariants(recipe.food_group),
          ];

          return candidates.some((candidate) => candidate.length >= 4 && normalizedRuleText.includes(candidate));
        });
        const structuredEvidenceBySemanticTarget = (() => {
          if (!ruleTarget) {
            return null;
          }

          const label = normalizeTerm(ruleTarget.label);
          const keywordByLabel: Record<string, string[]> = {
            peixe: ['peixe', 'pescado', 'tilapia', 'merluza', 'sardinha', 'posta', 'file'],
            frango: ['frango', 'galeto', 'sobrecoxa', 'coxa'],
            bovino: ['carne', 'bovina', 'boi', 'bife'],
            suino: ['suino', 'porco', 'lombo', 'pernil'],
            carboidrato: ['carboidrato', 'arroz', 'massa', 'macarrao', 'batata', 'mandioca', 'pure'],
            fruta: ['fruta', 'laranja', 'banana', 'maca', 'mamao', 'abacaxi', 'suco', 'citrico'],
            vegetais: ['verdura', 'vegetal', 'vegetais', 'legume', 'salada', 'folhas', 'hortalica'],
          };
          const matchedKey = Object.keys(keywordByLabel).find((key) => label.includes(key));

          if (!matchedKey || !keywordByLabel[matchedKey].some((keyword) => recipeCorpus.includes(keyword))) {
            return null;
          }

          return {
            name: `Evidencia contextual ${ruleTarget.label}`,
            category: ruleTarget.label,
            subcategory: 'Contextual',
            food_group: 'Contextual',
          };
        })();
        const structuredEvidenceByRecipeLibrary = structuredRecipeRows.find((recipe) => {
          const candidates = [
            ...buildTermVariants(recipe.name),
            ...buildTermVariants(recipe.category),
            ...buildTermVariants(recipe.subcategory),
            ...buildTermVariants(recipe.food_group),
          ];

          return candidates.some(
            (candidate) =>
              candidate.length >= 4
              && normalizedRuleText.includes(candidate)
              && recipeCorpus.includes(candidate.split(' ')[0] ?? candidate),
          );
        });
        const structuredEvidence =
          structuredEvidenceByTarget
          ?? structuredEvidenceBySemanticTarget
          ?? structuredEvidenceByLexicalMatch
          ?? structuredEvidenceByRecipeLibrary;
        const tokenSource = normalizedRuleText
          .split(/[^a-z0-9]+/)
          .filter((token: any) => token.length >= 4)
          .slice(0, 12);
        const hasTextualEvidence = tokenSource.some((token: any) => recipeCorpus.includes(token));
        const hasEvidence = Boolean(structuredEvidence) || hasTextualEvidence;

        auditRows.push({
          id: randomUUID(),
          ruleId: rule.id,
          ruleTitle: rule.title,
          resultStatus: hasEvidence ? 'compliant' : 'non_compliant',
          evidence: structuredEvidence
            ? `Regra com evidencia por classificacao estruturada: ${structuredEvidence.name} (${structuredEvidence.category} / ${structuredEvidence.subcategory} / ${structuredEvidence.food_group}).`
            : hasTextualEvidence
              ? 'Regra com evidencia textual nas receitas importadas por fallback.'
              : 'Regra sem evidencia estruturada ou textual nas receitas importadas.',
          createdAt: new Date().toISOString(),
        });
      }

      menuAuditMemory.set(importId, auditRows);
      return auditRows;
    };

app.get('/compliance-controls', { preHandler: authenticate }, async (request, reply) => {
  const parsedQuery = z.object({
    status: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  }).safeParse(request.query);

  if (!parsedQuery.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const companyName = getCompanyFromJwt(request);
  const requestedStatus = normalizeControlStatusFilter(parsedQuery.data.status);

  await ensureDomainTables();

  const controls = requestedStatus === 'all'
    ? await prisma.$queryRaw<Array<{
        id: string;
        contract_id: string;
        contract_rule_id: string;
        title: string;
        operational_description: string;
        frequency: string;
        responsible: string;
        expected_evidence: string;
        status: string;
        activated_at: Date | null;
        deactivated_at: Date | null;
        created_by: string;
        created_at: Date;
        contract_title: string | null;
        rule_title: string | null;
        last_execution_status: string | null;
        last_execution_at: Date | null;
        open_findings_count: number;
      }>>`
        SELECT
          control.id,
          control.contract_id,
          control.contract_rule_id,
          control.title,
          control.operational_description,
          control.frequency,
          control.responsible,
          control.expected_evidence,
          UPPER(control.status) AS status,
          control.activated_at,
          control.deactivated_at,
          control.created_by,
          control.created_at,
          contract.title AS contract_title,
          rule.title AS rule_title,
          last_execution.status AS last_execution_status,
          last_execution.executed_at AS last_execution_at,
          COALESCE(open_findings.total, 0)::int AS open_findings_count
        FROM compliance_controls control
        INNER JOIN contracts contract
          ON contract.id = control.contract_id
         AND contract.company_name = control.company_name
        INNER JOIN extracted_rules rule
          ON rule.id = control.contract_rule_id
         AND rule.company_name = control.company_name
        LEFT JOIN LATERAL (
          SELECT status, executed_at
          FROM compliance_control_executions execution
          WHERE execution.control_id = control.id
            AND execution.company_name = control.company_name
          ORDER BY executed_at DESC
          LIMIT 1
        ) AS last_execution ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS total
          FROM compliance_findings finding
          WHERE finding.control_id = control.id
            AND finding.company_name = control.company_name
            AND finding.status IN ('OPEN', 'IN_ANALYSIS')
        ) AS open_findings ON TRUE
        WHERE control.tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
          AND control.company_name = ${companyName}
        ORDER BY control.created_at DESC
        LIMIT ${parsedQuery.data.limit}
      `
    : await prisma.$queryRaw<Array<{
        id: string;
        contract_id: string;
        contract_rule_id: string;
        title: string;
        operational_description: string;
        frequency: string;
        responsible: string;
        expected_evidence: string;
        status: string;
        activated_at: Date | null;
        deactivated_at: Date | null;
        created_by: string;
        created_at: Date;
        contract_title: string | null;
        rule_title: string | null;
        last_execution_status: string | null;
        last_execution_at: Date | null;
        open_findings_count: number;
      }>>`
        SELECT
          control.id,
          control.contract_id,
          control.contract_rule_id,
          control.title,
          control.operational_description,
          control.frequency,
          control.responsible,
          control.expected_evidence,
          UPPER(control.status) AS status,
          control.activated_at,
          control.deactivated_at,
          control.created_by,
          control.created_at,
          contract.title AS contract_title,
          rule.title AS rule_title,
          last_execution.status AS last_execution_status,
          last_execution.executed_at AS last_execution_at,
          COALESCE(open_findings.total, 0)::int AS open_findings_count
        FROM compliance_controls control
        INNER JOIN contracts contract
          ON contract.id = control.contract_id
         AND contract.company_name = control.company_name
        INNER JOIN extracted_rules rule
          ON rule.id = control.contract_rule_id
         AND rule.company_name = control.company_name
        LEFT JOIN LATERAL (
          SELECT status, executed_at
          FROM compliance_control_executions execution
          WHERE execution.control_id = control.id
            AND execution.company_name = control.company_name
          ORDER BY executed_at DESC
          LIMIT 1
        ) AS last_execution ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS total
          FROM compliance_findings finding
          WHERE finding.control_id = control.id
            AND finding.company_name = control.company_name
            AND finding.status IN ('OPEN', 'IN_ANALYSIS')
        ) AS open_findings ON TRUE
        WHERE control.tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
          AND control.company_name = ${companyName}
          AND UPPER(control.status) = ${requestedStatus}
        ORDER BY control.created_at DESC
        LIMIT ${parsedQuery.data.limit}
      `;

  const latestExecutions = await prisma.$queryRaw<Array<{
    id: string;
    control_id: string;
    control_title: string;
    execution_date: Date;
    status: string;
    evidence_summary: string;
    evidence_reference: string | null;
    executed_by: string;
    executed_at: Date;
  }>>`
    SELECT
      execution.id,
      execution.control_id,
      control.title AS control_title,
      execution.execution_date,
      execution.status,
      execution.evidence_summary,
      execution.evidence_reference,
      execution.executed_by,
      execution.executed_at
    FROM compliance_control_executions execution
    INNER JOIN compliance_controls control
      ON control.id = execution.control_id
     AND control.company_name = execution.company_name
 AND execution.tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
      AND execution.company_name = ${companyName}
    ORDER BY execution.executed_at DESC
    LIMIT 10
  `;

  const failedExecutions = latestExecutions.filter((item: (typeof latestExecutions)[number]) => item.status === 'failed');

  return reply.code(200).send({
    status: 'ok',
    summary: {
      totalControls: controls.length,
      activeControls: controls.filter((item: (typeof controls)[number]) => normalizeControlStatus(item.status) === 'ACTIVE').length,
      pendingControls: controls.filter((item: (typeof controls)[number]) => ['DRAFT', 'PAUSED'].includes(normalizeControlStatus(item.status))).length,
      draftControls: controls.filter((item: (typeof controls)[number]) => normalizeControlStatus(item.status) === 'DRAFT').length,
      pausedControls: controls.filter((item: (typeof controls)[number]) => normalizeControlStatus(item.status) === 'PAUSED').length,
      nonCompliantControls: controls.filter((item: (typeof controls)[number]) => normalizeControlStatus(item.status) === 'NON_COMPLIANT').length,
      completedControls: controls.filter((item: (typeof controls)[number]) => normalizeControlStatus(item.status) === 'COMPLETED').length,
      openFindings: controls.reduce((acc: number, item: (typeof controls)[number]) => acc + Number(item.open_findings_count ?? 0), 0),
      failedExecutions: failedExecutions.length,
    },
    controls: controls.map((item: (typeof controls)[number]) => ({
      id: item.id,
      contractId: item.contract_id,
      contractRuleId: item.contract_rule_id,
      title: item.title,
      contractTitle: item.contract_title,
      ruleTitle: item.rule_title,
      operationalDescription: item.operational_description,
      frequency: item.frequency,
      responsible: item.responsible,
      expectedEvidence: item.expected_evidence,
      status: normalizeControlStatus(item.status),
      activatedAt: item.activated_at?.toISOString() ?? null,
      deactivatedAt: item.deactivated_at?.toISOString() ?? null,
      createdBy: item.created_by,
      createdAt: item.created_at.toISOString(),
      lastExecutionStatus: item.last_execution_status,
      lastExecutionAt: item.last_execution_at?.toISOString() ?? null,
      openFindingsCount: Number(item.open_findings_count ?? 0),
    })),
    latestExecutions: latestExecutions.map((item: (typeof latestExecutions)[number]) => ({
      id: item.id,
      controlId: item.control_id,
      controlTitle: item.control_title,
      executionDate: item.execution_date.toISOString(),
      status: item.status,
      evidenceSummary: item.evidence_summary,
      evidenceReference: item.evidence_reference,
      executedBy: item.executed_by,
      executedAt: item.executed_at.toISOString(),
    })),
    failures: failedExecutions.map((item: (typeof failedExecutions)[number]) => ({
      id: item.id,
      controlId: item.control_id,
      controlTitle: item.control_title,
      executionDate: item.execution_date.toISOString(),
      status: item.status,
      evidenceSummary: item.evidence_summary,
      evidenceReference: item.evidence_reference,
      executedBy: item.executed_by,
      executedAt: item.executed_at.toISOString(),
    })),
  });
});

app.get('/contracts/:id/controls', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = z.object({ id: z.string().min(1) }).safeParse(request.params);

  if (!parsedParams.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const companyName = getCompanyFromJwt(request);

  await ensureDomainTables();

  const controls = await prisma.$queryRaw<Array<{
    id: string;
    contract_id: string;
    contract_rule_id: string;
    title: string;
    operational_description: string;
    frequency: string;
    responsible: string;
    expected_evidence: string;
    status: string;
    activated_at: Date | null;
    deactivated_at: Date | null;
    created_by: string;
    created_at: Date;
    contract_title: string | null;
    rule_title: string | null;
    last_execution_status: string | null;
    last_execution_at: Date | null;
  }>>`
    SELECT
      control.id,
      control.contract_id,
      control.contract_rule_id,
      control.title,
      control.operational_description,
      control.frequency,
      control.responsible,
      control.expected_evidence,
      UPPER(control.status) AS status,
      control.activated_at,
      control.deactivated_at,
      control.created_by,
      control.created_at,
      contract.title AS contract_title,
      rule.title AS rule_title,
      last_execution.status AS last_execution_status,
      last_execution.executed_at AS last_execution_at
    FROM compliance_controls control
    INNER JOIN contracts contract
      ON contract.id = control.contract_id
     AND contract.company_name = control.company_name
    INNER JOIN extracted_rules rule
      ON rule.id = control.contract_rule_id
     AND rule.company_name = control.company_name
    LEFT JOIN LATERAL (
      SELECT status, executed_at
      FROM compliance_control_executions execution
      WHERE execution.control_id = control.id
        AND execution.company_name = control.company_name
      ORDER BY executed_at DESC
      LIMIT 1
    ) AS last_execution ON TRUE
    WHERE control.tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
      AND control.company_name = ${companyName}
      AND control.contract_id = ${parsedParams.data.id}
    ORDER BY control.created_at DESC
  `;

  return reply.code(200).send({
    status: 'ok',
    controls: controls.map((item: (typeof controls)[number]) => ({
      id: item.id,
      contractId: item.contract_id,
      contractRuleId: item.contract_rule_id,
      title: item.title,
      contractTitle: item.contract_title,
      ruleTitle: item.rule_title,
      operationalDescription: item.operational_description,
      frequency: item.frequency,
      responsible: item.responsible,
      expectedEvidence: item.expected_evidence,
      status: normalizeControlStatus(item.status),
      activatedAt: item.activated_at?.toISOString() ?? null,
      deactivatedAt: item.deactivated_at?.toISOString() ?? null,
      createdBy: item.created_by,
      createdAt: item.created_at.toISOString(),
      lastExecutionStatus: item.last_execution_status,
      lastExecutionAt: item.last_execution_at?.toISOString() ?? null,
    })),
  });
});

app.get('/compliance-controls/:controlId', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = z.object({ controlId: z.string().min(1) }).safeParse(request.params);

  if (!parsedParams.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const companyName = getCompanyFromJwt(request);

  await ensureDomainTables();

  const controlRows = await prisma.$queryRaw<Array<{
    id: string;
    contract_id: string;
    contract_rule_id: string;
    title: string;
    operational_description: string;
    frequency: string;
    responsible: string;
    expected_evidence: string;
    status: string;
    activated_at: Date | null;
    deactivated_at: Date | null;
    created_by: string;
    created_at: Date;
    contract_title: string | null;
    rule_title: string | null;
    rule_source_excerpt: string | null;
    rule_source_page: number | null;
  }>>`
    SELECT
      control.id,
      control.contract_id,
      control.contract_rule_id,
      control.title,
      control.operational_description,
      control.frequency,
      control.responsible,
      control.expected_evidence,
      UPPER(control.status) AS status,
      control.activated_at,
      control.deactivated_at,
      control.created_by,
      control.created_at,
      contract.title AS contract_title,
      rule.title AS rule_title,
      rule.source_excerpt AS rule_source_excerpt,
      rule.source_page AS rule_source_page
    FROM compliance_controls control
    INNER JOIN contracts contract
      ON contract.id = control.contract_id
     AND contract.company_name = control.company_name
    INNER JOIN extracted_rules rule
      ON rule.id = control.contract_rule_id
     AND rule.company_name = control.company_name
    WHERE control.id = ${parsedParams.data.controlId}
 AND control.tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND control.company_name = ${companyName}
    LIMIT 1
  `;

  const control = controlRows[0];

  if (!control) {
    return reply.code(404).send({
      status: 'error',
      message: 'Controle nao encontrado para esta empresa.',
    });
  }

  const executionRows = await prisma.$queryRaw<Array<{
    id: string;
    execution_date: Date;
    status: string;
    evidence_summary: string;
    evidence_reference: string | null;
    executed_by: string;
    executed_at: Date;
  }>>`
    SELECT id, execution_date, status, evidence_summary, evidence_reference, executed_by, executed_at
    FROM compliance_control_executions
    WHERE control_id = ${parsedParams.data.controlId}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
    ORDER BY executed_at DESC
    LIMIT 50
  `;

  const eventRows = await prisma.$queryRaw<Array<{
    id: string;
    previous_status: string;
    next_status: string;
    description: string;
    justification: string | null;
    evidence_reference: string | null;
    actor_name: string;
    created_at: Date;
  }>>`
    SELECT id, previous_status, next_status, description, justification, evidence_reference, actor_name, created_at
    FROM compliance_control_events
    WHERE control_id = ${parsedParams.data.controlId}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
    ORDER BY created_at DESC
    LIMIT 50
  `;

  const findingEventRows = await prisma.$queryRaw<Array<{
    id: string;
    finding_id: string;
    previous_status: string;
    next_status: string;
    description: string;
    evidence_reference: string | null;
    actor_name: string;
    created_at: Date;
  }>>`
    SELECT id, finding_id, previous_status, next_status, description, evidence_reference, actor_name, created_at
    FROM compliance_finding_events
    WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
      AND company_name = ${companyName}
      AND finding_id IN (
        SELECT id
        FROM compliance_findings
        WHERE control_id = ${parsedParams.data.controlId}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
      )
    ORDER BY created_at DESC
    LIMIT 50
  `;

  const findingRows = await prisma.$queryRaw<Array<{
    id: string;
    execution_id: string | null;
    severity: string;
    description: string;
    status: string;
    detected_at: Date;
    resolved_at: Date | null;
    resolved_by: string | null;
    created_by: string;
  }>>`
    SELECT id, execution_id, severity, description, status, detected_at, resolved_at, resolved_by, created_by
    FROM compliance_findings
    WHERE control_id = ${parsedParams.data.controlId}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
    ORDER BY detected_at DESC
    LIMIT 50
  `;

  const evidenceRows = await prisma.$queryRaw<Array<{
    id: string;
    entity_type: string;
    entity_id: string;
    source_type: string;
    page: number | null;
    section: string | null;
    excerpt: string | null;
    created_at: Date;
  }>>`
    SELECT id, entity_type, entity_id, source_type, page, section, excerpt, created_at
    FROM evidence_references
    WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
      AND company_name = ${companyName}
      AND (
        control_id = ${parsedParams.data.controlId}
        OR entity_id = ${parsedParams.data.controlId}
      )
    ORDER BY created_at DESC
    LIMIT 20
  `;

  const timeline = [
    ...eventRows.map((item: (typeof eventRows)[number]) => ({
      id: item.id,
      type: 'event',
      createdAt: item.created_at.toISOString(),
      title: `${normalizeControlStatus(item.previous_status)} -> ${normalizeControlStatus(item.next_status)}`,
      description: [item.description, item.justification ? `Justificativa: ${item.justification}` : null, item.evidence_reference ? `EvidÃƒÂªncia: ${item.evidence_reference}` : null].filter(Boolean).join(' Ã‚Â· '),
      actorName: item.actor_name,
    })),
    ...executionRows.map((item: (typeof executionRows)[number]) => ({
      id: item.id,
      type: 'execution',
      createdAt: item.executed_at.toISOString(),
      title: item.status === 'completed' ? 'ExecuÃƒÂ§ÃƒÂ£o conforme' : 'ExecuÃƒÂ§ÃƒÂ£o com desvio',
      description: item.evidence_summary,
      actorName: item.executed_by,
    })),
    ...findingRows.map((item: (typeof findingRows)[number]) => ({
      id: item.id,
      type: 'finding',
      createdAt: item.detected_at.toISOString(),
      title: `Finding ${normalizeFindingStatus(item.status)}`,
      description: item.description,
      actorName: item.created_by,
    })),
    ...findingEventRows.map((item: (typeof findingEventRows)[number]) => ({
      id: item.id,
      type: 'finding',
      createdAt: item.created_at.toISOString(),
      title: `Finding ${normalizeFindingStatus(item.previous_status)} -> ${normalizeFindingStatus(item.next_status)}`,
      description: [item.description, item.evidence_reference ? `EvidÃƒÂªncia: ${item.evidence_reference}` : null].filter(Boolean).join(' Ã‚Â· '),
      actorName: item.actor_name,
    })),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return reply.code(200).send({
    status: 'ok',
    control: {
      id: control.id,
      contractId: control.contract_id,
      contractRuleId: control.contract_rule_id,
      title: control.title,
      contractTitle: control.contract_title,
      ruleTitle: control.rule_title,
      operationalDescription: control.operational_description,
      frequency: control.frequency,
      responsible: control.responsible,
      expectedEvidence: control.expected_evidence,
      status: normalizeControlStatus(control.status),
      activatedAt: control.activated_at?.toISOString() ?? null,
      deactivatedAt: control.deactivated_at?.toISOString() ?? null,
      createdBy: control.created_by,
      createdAt: control.created_at.toISOString(),
      origin: {
        contractTitle: control.contract_title,
        ruleTitle: control.rule_title,
        page: control.rule_source_page,
        excerpt: control.rule_source_excerpt,
      },
    },
    executions: executionRows.map((item: (typeof executionRows)[number]) => ({
      id: item.id,
      executionDate: item.execution_date.toISOString(),
      status: item.status,
      evidenceSummary: item.evidence_summary,
      evidenceReference: item.evidence_reference,
      executedBy: item.executed_by,
      executedAt: item.executed_at.toISOString(),
    })),
    events: eventRows.map((item: (typeof eventRows)[number]) => ({
      id: item.id,
      previousStatus: normalizeControlStatus(item.previous_status),
      nextStatus: normalizeControlStatus(item.next_status),
      description: item.description,
      justification: item.justification,
      evidenceReference: item.evidence_reference,
      actorName: item.actor_name,
      createdAt: item.created_at.toISOString(),
    })),
    findings: findingRows.map((item: (typeof findingRows)[number]) => ({
      id: item.id,
      executionId: item.execution_id,
      severity: normalizeFindingSeverity(item.severity),
      description: item.description,
      status: normalizeFindingStatus(item.status),
      detectedAt: item.detected_at.toISOString(),
      resolvedAt: item.resolved_at?.toISOString() ?? null,
      resolvedBy: item.resolved_by,
      createdBy: item.created_by,
    })),
    evidenceReferences: evidenceRows.map((item: (typeof evidenceRows)[number]) => ({
      id: item.id,
      entityType: item.entity_type,
      entityId: item.entity_id,
      sourceType: item.source_type,
      page: item.page,
      section: item.section,
      excerpt: item.excerpt,
      createdAt: item.created_at.toISOString(),
    })),
    timeline,
    findingEvents: findingEventRows.map((item: (typeof findingEventRows)[number]) => ({
      id: item.id,
      findingId: item.finding_id,
      previousStatus: normalizeFindingStatus(item.previous_status),
      nextStatus: normalizeFindingStatus(item.next_status),
      description: item.description,
      evidenceReference: item.evidence_reference,
      actorName: item.actor_name,
      createdAt: item.created_at.toISOString(),
    })),
  });
});

app.patch('/compliance-controls/:controlId/status', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = z.object({ controlId: z.string().min(1) }).safeParse(request.params);
  const parsedBody = z.object({
    status: z.enum(CONTROL_STATUS_VALUES),
    justification: z.string().trim().min(3).max(400),
    evidenceReference: z.string().trim().min(3).max(500).optional(),
  }).safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);
  const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';

  await ensureDomainTables();

  const controlRows = await prisma.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT id, status
    FROM compliance_controls
    WHERE id = ${parsedParams.data.controlId}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
    LIMIT 1
  `;

  const control = controlRows[0];

  if (!control) {
    return reply.code(404).send({ status: 'error', message: 'Controle nao encontrado para esta empresa.' });
  }

  const previousStatus = normalizeControlStatus(control.status);
  const nextStatus = parsedBody.data.status;

  if (!canTransitionControlStatus(previousStatus, nextStatus)) {
    return reply.code(409).send({
      status: 'error',
      message: `Transicao de status invalida: ${previousStatus} -> ${nextStatus}.`,
    });
  }

  const now = new Date();
  const nextActivatedAt = nextStatus === 'ACTIVE' ? now : previousStatus === 'ACTIVE' ? null : null;
  const nextDeactivatedAt = ['PAUSED', 'COMPLETED'].includes(nextStatus) ? now : null;

  await prisma.$executeRaw`
    UPDATE compliance_controls
    SET status = ${nextStatus},
        activated_at = CASE
          WHEN ${nextStatus} = 'ACTIVE' THEN COALESCE(activated_at, ${now})
          WHEN ${nextStatus} = 'DRAFT' THEN NULL
          ELSE activated_at
        END,
        deactivated_at = CASE
          WHEN ${nextStatus} IN ('PAUSED', 'COMPLETED') THEN ${now}
          ELSE NULL
        END
    WHERE id = ${parsedParams.data.controlId}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
  `;

  const eventId = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO compliance_control_events (
      id,
      tenant_id,
      company_name,
      control_id,
      previous_status,
      next_status,
      description,
      justification,
      evidence_reference,
      actor_id,
      actor_name,
      created_at,
      updated_at
    )
    VALUES (
      ${eventId},
      ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
      ${companyName},
      ${parsedParams.data.controlId},
      ${previousStatus},
      ${nextStatus},
      ${`Status operacional alterado para ${nextStatus}.`},
      ${parsedBody.data.justification},
      ${parsedBody.data.evidenceReference ?? null},
      ${actor.id},
      ${actor.name},
      NOW(),
      NOW()
    )
  `;

  return reply.code(200).send({
    status: 'ok',
    control: {
      id: parsedParams.data.controlId,
      status: nextStatus,
      activatedAt: nextStatus === 'ACTIVE' ? (nextActivatedAt ?? now).toISOString() : null,
      deactivatedAt: nextDeactivatedAt?.toISOString() ?? null,
    },
  });
});

app.post('/compliance-controls/:controlId/executions', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = z.object({ controlId: z.string().min(1) }).safeParse(request.params);
  const parsedBody = z.object({
    executionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(['completed', 'failed']),
    evidenceSummary: z.string().trim().min(3).max(500),
    evidenceReference: z.string().trim().min(3).max(500).optional(),
  }).safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);
  const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';

  await ensureDomainTables();

  const controlRows = await prisma.$queryRaw<Array<{ id: string; title: string; status: string }>>`
    SELECT id, title, status
    FROM compliance_controls
    WHERE id = ${parsedParams.data.controlId}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
    LIMIT 1
  `;

  const control = controlRows[0];

  if (!control) {
    return reply.code(404).send({
      status: 'error',
      message: 'Controle nao encontrado para esta empresa.',
    });
  }

  if (!canRegisterExecution(control.status)) {
    return reply.code(409).send({
      status: 'error',
      message: 'Somente controles ativos ou sob tratamento podem registrar execucao.',
    });
  }

  const executionId = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO compliance_control_executions (
      id,
      tenant_id,
      company_name,
      control_id,
      execution_date,
      status,
      evidence_summary,
      evidence_reference,
      executed_by,
      executed_at,
      created_at,
      updated_at
    )
    VALUES (
      ${executionId},
      ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
      ${companyName},
      ${parsedParams.data.controlId},
      ${parsedBody.data.executionDate}::date,
      ${parsedBody.data.status},
      ${parsedBody.data.evidenceSummary},
      ${parsedBody.data.evidenceReference ?? null},
      ${actor.id},
      ${new Date()},
      NOW(),
      NOW()
    )
  `;

  const eventId = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO compliance_control_events (
      id,
      tenant_id,
      company_name,
      control_id,
      previous_status,
      next_status,
      description,
      actor_id,
      actor_name,
      created_at,
      updated_at
    )
    VALUES (
      ${eventId},
      ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
      ${companyName},
      ${parsedParams.data.controlId},
      ${control.status},
      ${control.status},
      ${`Execucao manual registrada com status ${parsedBody.data.status}.`},
      ${actor.id},
      ${actor.name},
      NOW(),
      NOW()
    )
  `;

  const executionRows = await prisma.$queryRaw<Array<{
    id: string;
    control_id: string;
    execution_date: Date;
    status: string;
    evidence_summary: string;
    evidence_reference: string | null;
    executed_by: string;
    executed_at: Date;
  }>>`
    SELECT id, control_id, execution_date, status, evidence_summary, evidence_reference, executed_by, executed_at
    FROM compliance_control_executions
    WHERE id = ${executionId}
    LIMIT 1
  `;

  const execution = executionRows[0];

  return reply.code(201).send({
    status: 'ok',
    execution: {
      id: execution?.id ?? executionId,
      controlId: execution?.control_id ?? parsedParams.data.controlId,
      controlTitle: control.title,
      executionDate: (execution?.execution_date ?? new Date(parsedBody.data.executionDate)).toISOString(),
      status: execution?.status ?? parsedBody.data.status,
      evidenceSummary: execution?.evidence_summary ?? parsedBody.data.evidenceSummary,
      evidenceReference: execution?.evidence_reference ?? parsedBody.data.evidenceReference ?? null,
      executedBy: execution?.executed_by ?? actor.id,
      executedAt: (execution?.executed_at ?? new Date()).toISOString(),
    },
  });
});

app.post('/compliance-controls/:controlId/findings', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = z.object({ controlId: z.string().min(1) }).safeParse(request.params);
  const parsedBody = z.object({
    executionId: z.string().min(1).optional(),
    severity: z.enum(FINDING_SEVERITY_VALUES).default('MEDIUM'),
    description: z.string().trim().min(5).max(800),
    status: z.enum(FINDING_STATUS_VALUES).default('OPEN'),
    detectedAt: z.string().datetime().optional(),
  }).safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);
  const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';

  await ensureDomainTables();

  const controlRows = await prisma.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT id, status
    FROM compliance_controls
    WHERE id = ${parsedParams.data.controlId}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
    LIMIT 1
  `;

  const control = controlRows[0];

  if (!control) {
    return reply.code(404).send({ status: 'error', message: 'Controle nao encontrado para esta empresa.' });
  }

  if (parsedBody.data.executionId) {
    const executionRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM compliance_control_executions
      WHERE id = ${parsedBody.data.executionId}
        AND control_id = ${parsedParams.data.controlId}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
      LIMIT 1
    `;

    if (!executionRows[0]) {
      return reply.code(404).send({
        status: 'error',
        message: 'Execucao informada nao pertence a este controle.',
      });
    }
  }

  const findingId = randomUUID();
  const detectedAt = parsedBody.data.detectedAt ? new Date(parsedBody.data.detectedAt) : new Date();

  await prisma.$executeRaw`
    INSERT INTO compliance_findings (
      id,
      tenant_id,
      company_name,
      control_id,
      execution_id,
      severity,
      description,
      status,
      detected_at,
      created_by,
      created_at,
      updated_at
    )
    VALUES (
      ${findingId},
      ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
      ${companyName},
      ${parsedParams.data.controlId},
      ${parsedBody.data.executionId ?? null},
      ${parsedBody.data.severity},
      ${parsedBody.data.description},
      ${parsedBody.data.status},
      ${detectedAt},
      ${actor.id},
      NOW(),
      NOW()
    )
  `;

  const findingEventId = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO compliance_finding_events (
      id,
      tenant_id,
      company_name,
      finding_id,
      previous_status,
      next_status,
      description,
      evidence_reference,
      actor_id,
      actor_name,
      created_at,
      updated_at
    )
    VALUES (
      ${findingEventId},
      ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
      ${companyName},
      ${findingId},
      ${parsedBody.data.status},
      ${parsedBody.data.status},
      ${'Finding registrado manualmente no controle.'},
      ${null},
      ${actor.id},
      ${actor.name},
      NOW(),
      NOW()
    )
  `;

  return reply.code(201).send({
    status: 'ok',
    finding: {
      id: findingId,
      controlId: parsedParams.data.controlId,
      executionId: parsedBody.data.executionId ?? null,
      severity: parsedBody.data.severity,
      description: parsedBody.data.description,
      status: parsedBody.data.status,
      detectedAt: detectedAt.toISOString(),
      createdBy: actor.id,
    },
  });
});

app.patch('/compliance-controls/:controlId/findings/:findingId/status', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = z.object({
    controlId: z.string().min(1),
    findingId: z.string().min(1),
  }).safeParse(request.params);
  const parsedBody = z.object({
    status: z.enum(FINDING_STATUS_VALUES),
    description: z.string().trim().min(3).max(600),
    evidenceReference: z.string().trim().min(3).max(500).optional(),
  }).safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);
  const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';

  await ensureDomainTables();

  const findingRows = await prisma.$queryRaw<Array<{
    id: string;
    status: string;
    severity: string;
    description: string;
    detected_at: Date;
    resolved_at: Date | null;
    resolved_by: string | null;
    execution_id: string | null;
    created_by: string;
  }>>`
    SELECT id, status, severity, description, detected_at, resolved_at, resolved_by, execution_id, created_by
    FROM compliance_findings
    WHERE id = ${parsedParams.data.findingId}
      AND control_id = ${parsedParams.data.controlId}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
    LIMIT 1
  `;

  const finding = findingRows[0];

  if (!finding) {
    return reply.code(404).send({
      status: 'error',
      message: 'Finding nao encontrado para este controle.',
    });
  }

  const previousStatus = normalizeFindingStatus(finding.status);
  const nextStatus = parsedBody.data.status;

  if (!canTransitionFindingStatus(previousStatus, nextStatus)) {
    return reply.code(409).send({
      status: 'error',
      message: `Transicao de status invalida: ${previousStatus} -> ${nextStatus}.`,
    });
  }

  const now = new Date();
  const resolvedAt = ['RESOLVED', 'ACCEPTED_RISK'].includes(nextStatus) ? now : null;
  const resolvedBy = ['RESOLVED', 'ACCEPTED_RISK'].includes(nextStatus) ? actor.id : null;

  await prisma.$executeRaw`
    UPDATE compliance_findings
    SET status = ${nextStatus},
        resolved_at = ${resolvedAt},
        resolved_by = ${resolvedBy}
    WHERE id = ${parsedParams.data.findingId}
      AND control_id = ${parsedParams.data.controlId}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
  `;

  const findingEventId = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO compliance_finding_events (
      id,
      tenant_id,
      company_name,
      finding_id,
      previous_status,
      next_status,
      description,
      evidence_reference,
      actor_id,
      actor_name,
      created_at,
      updated_at
    )
    VALUES (
      ${findingEventId},
      ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
      ${companyName},
      ${parsedParams.data.findingId},
      ${previousStatus},
      ${nextStatus},
      ${parsedBody.data.description},
      ${parsedBody.data.evidenceReference ?? null},
      ${actor.id},
      ${actor.name},
      NOW(),
      NOW()
    )
  `;

  return reply.code(200).send({
    status: 'ok',
    finding: {
      id: finding.id,
      status: nextStatus,
      severity: normalizeFindingSeverity(finding.severity),
      description: finding.description,
      detectedAt: finding.detected_at.toISOString(),
      resolvedAt: resolvedAt?.toISOString() ?? null,
      resolvedBy,
      createdBy: finding.created_by,
      executionId: finding.execution_id,
    },
  });
});

app.post('/menus/imports/:importId/audit', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = menuImportParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Identificador de importacao invalido.',
    });
  }

  if (!prisma) {
    const auditRows = buildMemoryMenuAudit(request, parsedParams.data.importId);

    if (!auditRows) {
      return reply.code(404).send({
        status: 'error',
        message: 'Importacao de cardapio nao encontrada para esta empresa.',
      });
    }

    const compliantCount = auditRows.filter((item) => item.resultStatus === 'compliant').length;
    const nonCompliantCount = auditRows.filter((item) => item.resultStatus === 'non_compliant').length;

    return {
      status: 'ok',
      summary: {
        auditedRules: auditRows.length,
        compliantCount,
        nonCompliantCount,
      },
      results: auditRows,
    };
  }

  const companyName = getCompanyFromJwt(request);
  const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';
  const importId = parsedParams.data.importId;

  await ensureDomainTables();

  const importedRows = await prisma.$queryRaw<Array<{
    id: string;
    unit_name: string;
    service_name: string;
    meal_type: string;
    reference_date: Date | string;
    recipes_json: string;
  }>>`
    SELECT id, unit_name, service_name, meal_type, reference_date, recipes_json
    FROM menu_pdf_imports
    WHERE id = ${importId}
      AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
    LIMIT 1
  `;

  const imported = importedRows[0];

  if (!imported) {
    return reply.code(404).send({
      status: 'error',
      message: 'Importacao de cardapio nao encontrada para esta empresa.',
    });
  }

  const approvedRules = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    description: string;
  }>>`
    SELECT id, title, description
    FROM extracted_rules
    WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
      AND status = 'approved'
    ORDER BY created_at DESC
    LIMIT 200
  `;

  const importedRecipes = (() => {
    try {
      const parsed = JSON.parse(imported.recipes_json) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const normalizedImportedRecipes = importedRecipes.map((item) => normalizeTerm(item));
  const importReferenceDate = getDateOnlyString(imported.reference_date);

  const structuredRecipeRows = await prisma.$queryRaw<Array<{
    name: string;
    normalized_name: string;
    category: string;
    subcategory: string;
    food_group: string;
  }>>`
    SELECT name, normalized_name, category, subcategory, food_group
    FROM recipe_library_items
    WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
      AND is_active = TRUE
  `;

  const structuredRecipeByNormalizedName = new Map(
    structuredRecipeRows.map((item: any) => [item.normalized_name, item]),
  );
  const semanticAliasByContext = buildSemanticAliasByContext({
    mealType: imported.meal_type,
    serviceName: imported.service_name,
  })

  const importedStructuredRecipes = importedRecipes
    .map((recipeName) =>
      resolveStructuredRecipeFromImportedName(
        recipeName,
        structuredRecipeRows,
        structuredRecipeByNormalizedName,
        semanticAliasByContext,
      ),
    )
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const recipeCorpus = normalizeTerm(importedRecipes.join(' '));

  const buildTermVariants = (value: string) => {
    const normalized = normalizeTerm(value);

    if (!normalized || normalized === 'outros' || normalized === 'nao classificado') {
      return [] as string[];
    }

    const variants = new Set<string>([normalized]);

    if (normalized.endsWith('s') && normalized.length > 4) {
      variants.add(normalized.slice(0, -1));
    }

    return Array.from(variants);
  };

  await prisma.$executeRaw`
    DELETE FROM menu_import_rule_audits
    WHERE menu_import_id = ${importId}
      AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
  `;

  const auditRows: Array<{
    id: string;
    ruleId: string;
    ruleTitle: string;
    resultStatus: 'compliant' | 'non_compliant';
    evidence: string;
    createdAt: string;
  }> = [];

  for (const rule of approvedRules) {
    const normalizedRuleText = normalizeTerm(`${rule.title} ${rule.description}`);
    const tokenSource = normalizedRuleText
      .split(/[^a-z0-9]+/)
      .filter((token: any) => token.length >= 4)
      .slice(0, 12);
    const ruleTarget = extractRuleTarget(normalizedRuleText);
    const weeklyMinimum = extractWeeklyMinimum(normalizedRuleText);
    const recurrenceDays = extractRecurrenceDays(normalizedRuleText);

    if (ruleTarget && weeklyMinimum !== null) {
      const weekStart = startOfIsoWeek(importReferenceDate);
      const weekEnd = addUtcDays(weekStart, 6);
      const weekImportRows = await prisma.$queryRaw<Array<{
        reference_date: Date | string;
        recipes_json: string;
      }>>`
        SELECT reference_date, recipes_json
        FROM menu_pdf_imports
        WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
          AND company_name = ${companyName}
          AND unit_name = ${imported.unit_name}
          AND service_name = ${imported.service_name}
          AND reference_date BETWEEN CAST(${weekStart} AS date) AND CAST(${weekEnd} AS date)
        ORDER BY reference_date ASC
      `;

      const weeklyOccurrences = weekImportRows.filter((item: any) => {
        try {
          const parsedRecipes = JSON.parse(item.recipes_json) as string[];
          const structuredRecipes = parsedRecipes
            .map((recipeName) =>
              resolveStructuredRecipeFromImportedName(
                recipeName,
                structuredRecipeRows,
                structuredRecipeByNormalizedName,
                semanticAliasByContext,
              ),
            )
            .filter((recipe): recipe is NonNullable<typeof recipe> => Boolean(recipe));

          return structuredRecipes.some((recipe) => ruleTarget.matches(recipe));
        } catch {
          return false;
        }
      }).length;

      const resultStatus: 'compliant' | 'non_compliant' = weeklyOccurrences >= weeklyMinimum
        ? 'compliant'
        : 'non_compliant';
      const evidence = `Regra avaliada por frequencia estruturada: ${ruleTarget.label} encontrado ${weeklyOccurrences} vez(es) na semana de ${weekStart} a ${weekEnd}; minimo exigido ${weeklyMinimum}.`;
      const rowId = randomUUID();

      await prisma.$executeRaw`
        INSERT INTO menu_import_rule_audits (
          id,
          tenant_id,
          company_name,
          menu_import_id,
          rule_id,
          rule_title,
          result_status,
          evidence,
          created_at,
          updated_at
        )
        VALUES (
          ${rowId},
          ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
          ${companyName},
          ${importId},
          ${rule.id},
          ${rule.title},
          ${resultStatus},
          ${evidence},
          NOW(),
          NOW()
        )
      `;

      auditRows.push({
        id: rowId,
        ruleId: rule.id,
        ruleTitle: rule.title,
        resultStatus,
        evidence,
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    if (ruleTarget && recurrenceDays !== null) {
      const currentHasTarget = importedStructuredRecipes.some((recipe) => ruleTarget.matches(recipe));

      if (!currentHasTarget) {
        const rowId = randomUUID();
        const evidence = `Regra avaliada por recorrencia estruturada: ${ruleTarget.label} nao aparece nesta importacao, sem violacao de recorrencia.`;

        await prisma.$executeRaw`
          INSERT INTO menu_import_rule_audits (
            id,
            tenant_id,
            company_name,
            menu_import_id,
            rule_id,
            rule_title,
            result_status,
            evidence,
            created_at,
            updated_at
          )
          VALUES (
            ${rowId},
            ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
            ${companyName},
            ${importId},
            ${rule.id},
            ${rule.title},
            ${'compliant'},
            ${evidence},
            NOW(),
            NOW()
          )
        `;

        auditRows.push({
          id: rowId,
          ruleId: rule.id,
          ruleTitle: rule.title,
          resultStatus: 'compliant',
          evidence,
          createdAt: new Date().toISOString(),
        });
        continue;
      }

      const recurrenceWindowStart = addUtcDays(importReferenceDate, -(recurrenceDays - 1));
      const previousImportRows = await prisma.$queryRaw<Array<{
        reference_date: Date | string;
        recipes_json: string;
      }>>`
        SELECT reference_date, recipes_json
        FROM menu_pdf_imports
        WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
          AND company_name = ${companyName}
          AND unit_name = ${imported.unit_name}
          AND service_name = ${imported.service_name}
          AND reference_date BETWEEN CAST(${recurrenceWindowStart} AS date) AND CAST(${addUtcDays(importReferenceDate, -1)} AS date)
        ORDER BY reference_date DESC
      `;

      const previousOccurrence = previousImportRows.find((item: any) => {
        try {
          const parsedRecipes = JSON.parse(item.recipes_json) as string[];
          const structuredRecipes = parsedRecipes
            .map((recipeName) =>
              resolveStructuredRecipeFromImportedName(
                recipeName,
                structuredRecipeRows,
                structuredRecipeByNormalizedName,
                semanticAliasByContext,
              ),
            )
            .filter((recipe): recipe is NonNullable<typeof recipe> => Boolean(recipe));

          return structuredRecipes.some((recipe) => ruleTarget.matches(recipe));
        } catch {
          return false;
        }
      });

      const previousOccurrenceDate = previousOccurrence
        ? getDateOnlyString(previousOccurrence.reference_date)
        : null;
      const daysSincePreviousOccurrence = previousOccurrenceDate
        ? diffUtcDays(previousOccurrenceDate, importReferenceDate)
        : null;
      const resultStatus: 'compliant' | 'non_compliant' = previousOccurrenceDate ? 'non_compliant' : 'compliant';
      const evidence = previousOccurrenceDate
        ? `Regra avaliada por recorrencia estruturada: ${ruleTarget.label} reapareceu apos ${daysSincePreviousOccurrence} dia(s), abaixo do minimo de ${recurrenceDays} dias.`
        : `Regra avaliada por recorrencia estruturada: ${ruleTarget.label} sem repeticao nos ultimos ${recurrenceDays} dias.`;
      const rowId = randomUUID();

      await prisma.$executeRaw`
        INSERT INTO menu_import_rule_audits (
          id,
          tenant_id,
          company_name,
          menu_import_id,
          rule_id,
          rule_title,
          result_status,
          evidence,
          created_at,
          updated_at
        )
        VALUES (
          ${rowId},
          ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
          ${companyName},
          ${importId},
          ${rule.id},
          ${rule.title},
          ${resultStatus},
          ${evidence},
          NOW(),
          NOW()
        )
      `;

      auditRows.push({
        id: rowId,
        ruleId: rule.id,
        ruleTitle: rule.title,
        resultStatus,
        evidence,
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    const structuredEvidenceByTarget = ruleTarget
      ? importedStructuredRecipes.find((recipe) => ruleTarget.matches(recipe))
      : null;

    const structuredEvidenceBySemanticTarget = (() => {
      if (!ruleTarget) {
        return null;
      }

      const corpus = normalizeTerm(importedRecipes.join(' '));
      const label = normalizeTerm(ruleTarget.label);
      const keywordByLabel: Record<string, string[]> = {
        peixe: ['peixe', 'pescado', 'tilapia', 'merluza', 'sardinha', 'posta', 'file'],
        frango: ['frango', 'galeto', 'sobrecoxa', 'coxa'],
        bovino: ['carne', 'bovina', 'boi', 'bife'],
        suino: ['suino', 'porco', 'lombo', 'pernil'],
        carboidrato: ['carboidrato', 'arroz', 'massa', 'macarrao', 'batata', 'mandioca', 'pure'],
        fruta: ['fruta', 'laranja', 'banana', 'maca', 'mamao', 'abacaxi', 'suco', 'citrico'],
        vegetais: ['verdura', 'vegetal', 'vegetais', 'legume', 'salada', 'folhas', 'hortalica'],
      };

      const matchedKey = Object.keys(keywordByLabel).find((key) => label.includes(key));

      if (!matchedKey) {
        return null;
      }

      const keywords = keywordByLabel[matchedKey];
      const hasSemanticTarget = keywords.some((keyword) => corpus.includes(keyword));

      if (!hasSemanticTarget) {
        return null;
      }

      return {
        name: `Evidencia contextual ${ruleTarget.label}`,
        category: ruleTarget.label,
        subcategory: 'Contextual',
        food_group: 'Contextual',
      };
    })();

    const structuredEvidenceByLexicalMatch = importedStructuredRecipes.find((recipe) => {
      const candidates = [
        ...buildTermVariants(recipe.name),
        ...buildTermVariants(recipe.category),
        ...buildTermVariants(recipe.subcategory),
        ...buildTermVariants(recipe.food_group),
      ];

      return candidates.some((candidate) => candidate.length >= 4 && normalizedRuleText.includes(candidate));
    });

    const structuredEvidence =
      structuredEvidenceByTarget
      ?? structuredEvidenceBySemanticTarget
      ?? structuredEvidenceByLexicalMatch;

    const hasTextualEvidence = tokenSource.some((token: any) => recipeCorpus.includes(token));
    const hasEvidence = Boolean(structuredEvidence) || hasTextualEvidence;
    const resultStatus: 'compliant' | 'non_compliant' = hasEvidence
      ? 'compliant'
      : 'non_compliant';
    const evidence = structuredEvidence
      ? `Regra com evidencia por classificacao estruturada: ${structuredEvidence.name} (${structuredEvidence.category} / ${structuredEvidence.subcategory} / ${structuredEvidence.food_group}).`
      : hasTextualEvidence
        ? 'Regra com evidencia textual nas receitas importadas por fallback.'
        : 'Regra sem evidencia estruturada ou textual nas receitas importadas.';
    const rowId = randomUUID();

    await prisma.$executeRaw`
      INSERT INTO menu_import_rule_audits (
        id,
        tenant_id,
        company_name,
        menu_import_id,
        rule_id,
        rule_title,
        result_status,
        evidence,
        created_at,
        updated_at
      )
      VALUES (
        ${rowId},
        ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
        ${companyName},
        ${importId},
        ${rule.id},
        ${rule.title},
        ${resultStatus},
        ${evidence},
        NOW(),
        NOW()
      )
    `;

    auditRows.push({
      id: rowId,
      ruleId: rule.id,
      ruleTitle: rule.title,
      resultStatus,
      evidence,
      createdAt: new Date().toISOString(),
    });
  }

  const compliantCount = auditRows.filter((item) => item.resultStatus === 'compliant').length;
  const nonCompliantCount = auditRows.filter((item) => item.resultStatus === 'non_compliant').length;
  const orderedAuditRows = [...auditRows].sort((left, right) => {
    const leftStructured = /classificacao estruturada/i.test(left.evidence) ? 0 : 1;
    const rightStructured = /classificacao estruturada/i.test(right.evidence) ? 0 : 1;
    return leftStructured - rightStructured;
  });

  return {
    status: 'ok',
    summary: {
      auditedRules: auditRows.length,
      compliantCount,
      nonCompliantCount,
    },
    results: orderedAuditRows,
  };
});

app.get('/menus/imports/:importId/audit', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = menuImportParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Identificador de importacao invalido.',
    });
  }

  if (!prisma) {
    const rows = menuAuditMemory.get(parsedParams.data.importId) ?? [];
    const compliantCount = rows.filter((item) => item.resultStatus === 'compliant').length;
    const nonCompliantCount = rows.filter((item) => item.resultStatus === 'non_compliant').length;

    return {
      status: 'ok',
      summary: {
        auditedRules: rows.length,
        compliantCount,
        nonCompliantCount,
      },
      results: rows,
    };
  }

  const companyName = getCompanyFromJwt(request);
  const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';
  const importId = parsedParams.data.importId;

  await ensureDomainTables();

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    rule_id: string | null;
    rule_title: string;
    result_status: 'compliant' | 'non_compliant';
    evidence: string;
    created_at: Date;
  }>>`
    SELECT id, rule_id, rule_title, result_status, evidence, created_at
    FROM menu_import_rule_audits
    WHERE menu_import_id = ${importId}
      AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
    ORDER BY created_at DESC
  `;

  const compliantCount = rows.filter((item: any) => item.result_status === 'compliant').length;
  const nonCompliantCount = rows.filter((item: any) => item.result_status === 'non_compliant').length;
  const mappedRows: Array<{
    id: string;
    ruleId: string | null;
    ruleTitle: string;
    resultStatus: 'compliant' | 'non_compliant';
    evidence: string;
    createdAt: string;
  }> = rows.map((item: any) => ({
    id: item.id,
    ruleId: item.rule_id,
    ruleTitle: item.rule_title,
    resultStatus: item.result_status,
    evidence: item.evidence,
    createdAt: item.created_at.toISOString(),
  }));
  const orderedRows = mappedRows.sort((left, right) => {
    const leftStructured = /classificacao estruturada/i.test(left.evidence) ? 0 : 1;
    const rightStructured = /classificacao estruturada/i.test(right.evidence) ? 0 : 1;
    return leftStructured - rightStructured;
  });

  return {
    status: 'ok',
    summary: {
      auditedRules: rows.length,
      compliantCount,
      nonCompliantCount,
    },
    results: orderedRows,
  };
});

app.post('/menus/imports/:importId/suggestions', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = menuImportParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Identificador de importacao invalido.',
    });
  }

  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const companyName = getCompanyFromJwt(request);
  const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';
  const importId = parsedParams.data.importId;

  await ensureDomainTables();

  const importedRows = await prisma.$queryRaw<Array<{
    id: string;
    unit_name: string;
    service_name: string;
    meal_type: string;
    meal_cost: number | string;
    financial_goal: number | string;
    exceeded_value: number | string;
    recipes_json: string;
  }>>`
    SELECT id, unit_name, service_name, meal_type, meal_cost, financial_goal, exceeded_value, recipes_json
    FROM menu_pdf_imports
    WHERE id = ${importId}
      AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
    LIMIT 1
  `;

  const imported = importedRows[0];

  if (!imported) {
    return reply.code(404).send({
      status: 'error',
      message: 'Importacao de cardapio nao encontrada para esta empresa.',
    });
  }

  const auditRows = await prisma.$queryRaw<Array<{
    rule_id: string | null;
    rule_title: string;
    result_status: 'compliant' | 'non_compliant';
  }>>`
    SELECT rule_id, rule_title, result_status
    FROM menu_import_rule_audits
    WHERE menu_import_id = ${importId}
      AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
    ORDER BY created_at DESC
  `;

  await prisma.$executeRaw`
    DELETE FROM menu_import_adjustment_suggestions
    WHERE menu_import_id = ${importId}
      AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
  `;

  const parseNumber = (value: number | string) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number(parsed.toFixed(2));
  };

  const exceededValue = parseNumber(imported.exceeded_value);
  const importedRecipes = (() => {
    try {
      const parsed = JSON.parse(imported.recipes_json) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const normalizedImportedRecipes = importedRecipes.map((item) => normalizeTerm(item));

  const structuredRecipeRows = await prisma.$queryRaw<Array<{
    name: string;
    normalized_name: string;
    category: string;
    subcategory: string;
    food_group: string;
    cost_per_capita: number | string | null;
  }>>`
    SELECT name, normalized_name, category, subcategory, food_group, cost_per_capita
    FROM recipe_library_items
    WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
      AND is_active = TRUE
  `;

  const structuredRecipeByNormalizedName = new Map(
    structuredRecipeRows.map((item: any) => [item.normalized_name, item]),
  );
  const semanticAliasByContext = buildSemanticAliasByContext({
    mealType: imported.meal_type,
    serviceName: imported.service_name,
  })

  const importedStructuredRecipes = importedRecipes
    .map((recipeName) =>
      resolveStructuredRecipeFromImportedName(
        recipeName,
        structuredRecipeRows,
        structuredRecipeByNormalizedName,
        semanticAliasByContext,
      ),
    )
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const importedStructuredRecipeNames = new Set(
    importedStructuredRecipes.map((item) => item.normalized_name),
  );

  const parseOptionalNumber = (value: number | string | null) => {
    if (value === null) {
      return null;
    }

    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
  };

  const historicalCombinationRows = await prisma.$queryRaw<Array<{
    recipes_json: string;
    average_rating: number | string;
    evaluations_count: number;
  }>>`
    SELECT recipes_json, average_rating, evaluations_count
    FROM menu_combination_intelligence
    WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
      AND unit_name = ${imported.unit_name}
      AND service_name = ${imported.service_name}
    ORDER BY average_rating DESC, evaluations_count DESC
    LIMIT 5
  `;

  const historicalSupport = historicalCombinationRows
    .map((row: any) => {
      const recipes = (() => {
        try {
          const parsed = JSON.parse(row.recipes_json) as string[];
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })();

      const overlapCount = recipes
        .map((item) =>
          resolveStructuredRecipeFromImportedName(
            item,
            structuredRecipeRows,
            structuredRecipeByNormalizedName,
            semanticAliasByContext,
          ),
        )
        .filter((recipe): recipe is NonNullable<typeof recipe> => Boolean(recipe))
        .filter((recipe) => importedStructuredRecipeNames.has(recipe.normalized_name)).length;

      return {
        averageRating: parseNumber(row.average_rating),
        evaluationsCount: row.evaluations_count,
        overlapCount,
      };
    })
    .filter((item: any) => item.overlapCount > 0)
    .sort((a: any, b: any) => {
      if (b.overlapCount !== a.overlapCount) {
        return b.overlapCount - a.overlapCount;
      }

      if (b.averageRating !== a.averageRating) {
        return b.averageRating - a.averageRating;
      }

      return b.evaluationsCount - a.evaluationsCount;
    })[0] ?? null;

  const suggestions: Array<{
    id: string;
    sourceType: 'rule' | 'financial_goal';
    sourceReference: string | null;
    suggestionText: string;
    estimatedFinancialImpact: number;
    estimatedNutritionalImpact: string;
    evidenceSource: 'structured' | 'textual_fallback' | 'financial_goal' | 'preventive';
    evidenceSubtype: 'frequency' | 'recurrence' | 'classification' | null;
    priorityLevel: 'high' | 'medium';
    createdAt: string;
  }> = [];

  for (const audit of auditRows.filter((item: any) => item.result_status === 'non_compliant')) {
    const suggestionId = randomUUID();
    const ruleTarget = extractRuleTarget(audit.rule_title);
    const replacementCandidate = ruleTarget
      ? structuredRecipeRows.find(
          (item: any) =>
            ruleTarget.matches(item) &&
            !normalizedImportedRecipes.includes(item.normalized_name),
        )
      : null;
    const recipeToReplace = importedStructuredRecipes.find(
      (item: any) => !ruleTarget?.matches(item),
    );
    const fallbackRecipeToReplace = importedRecipes[0] ?? 'um item atual da refeicao';
    const replacementName = replacementCandidate?.name ?? `uma receita classificada como ${ruleTarget?.label ?? 'equivalente'}`;
    const recipeToReplaceName = recipeToReplace?.name ?? fallbackRecipeToReplace;
    const suggestionText = ruleTarget
      ? `Substituir ${recipeToReplaceName} por ${replacementName} para atender a regra: ${audit.rule_title}.`
      : `Ajustar composicao da refeicao para atender a regra: ${audit.rule_title}.`;
    const replacementImpactBase = parseOptionalNumber(replacementCandidate?.cost_per_capita ?? null);
    const estimatedFinancialImpact = Number((
      replacementImpactBase !== null
        ? -Math.max(replacementImpactBase, 0.5)
        : -Math.max(exceededValue * 0.35, 0.5)
    ).toFixed(2));
    const estimatedNutritionalImpact = ruleTarget
      ? `Reforca aderencia ao grupo ${ruleTarget.label} com substituicao equivalente.`
      : 'Preserva aderencia nutricional com substituicoes equivalentes.';
    const estimatedNutritionalImpactWithHistory = historicalSupport
      ? `${estimatedNutritionalImpact} Contexto historico operacional: combinacao semelhante com nota media ${historicalSupport.averageRating.toFixed(2)} em ${historicalSupport.evaluationsCount} avaliacoes.`
      : `${estimatedNutritionalImpact} Contexto historico operacional indisponivel para esta combinacao.`;

    await prisma.$executeRaw`
      INSERT INTO menu_import_adjustment_suggestions (
        id,
        tenant_id,
        company_name,
        menu_import_id,
        source_type,
        source_reference,
        suggestion_text,
        estimated_financial_impact,
        estimated_nutritional_impact,
        priority_level,
        created_at,
        updated_at
      )
      VALUES (
        ${suggestionId},
        ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
        ${companyName},
        ${importId},
        ${'rule'},
        ${audit.rule_id ?? audit.rule_title},
        ${suggestionText},
        ${estimatedFinancialImpact},
        ${estimatedNutritionalImpactWithHistory},
        ${'high'},
        NOW(),
        NOW()
      )
    `;

    const evidenceSource = inferSuggestionEvidenceSource({
      sourceType: 'rule',
      suggestionText,
      estimatedNutritionalImpact: estimatedNutritionalImpactWithHistory,
      sourceReference: audit.rule_id ?? audit.rule_title,
    });

    suggestions.push({
      id: suggestionId,
      sourceType: 'rule',
      sourceReference: audit.rule_id ?? audit.rule_title,
      suggestionText,
      estimatedFinancialImpact,
      estimatedNutritionalImpact: estimatedNutritionalImpactWithHistory,
      evidenceSource,
      evidenceSubtype: inferSuggestionEvidenceSubtype({
        evidenceSource,
        suggestionText,
        sourceReference: audit.rule_id ?? audit.rule_title,
      }),
      priorityLevel: 'high',
      createdAt: new Date().toISOString(),
    });
  }

  if (exceededValue > 0) {
    const suggestionId = randomUUID();
    const suggestionText = 'Substituir ao menos um item de maior custo por alternativa equivalente para voltar a meta financeira.';
    const estimatedFinancialImpact = Number((-Math.max(exceededValue, 0.5)).toFixed(2));

    await prisma.$executeRaw`
      INSERT INTO menu_import_adjustment_suggestions (
        id,
        tenant_id,
        company_name,
        menu_import_id,
        source_type,
        source_reference,
        suggestion_text,
        estimated_financial_impact,
        estimated_nutritional_impact,
        priority_level,
        created_at,
        updated_at
      )
      VALUES (
        ${suggestionId},
        ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
        ${companyName},
        ${importId},
        ${'financial_goal'},
        ${'meal_cost_vs_goal'},
        ${suggestionText},
        ${estimatedFinancialImpact},
        ${'Mantem cobertura nutricional prevista para a refeicao.'},
        ${'high'},
        NOW(),
        NOW()
      )
    `;

    const evidenceSource = inferSuggestionEvidenceSource({
      sourceType: 'financial_goal',
      suggestionText,
      estimatedNutritionalImpact: 'Mantem cobertura nutricional prevista para a refeicao.',
      sourceReference: 'meal_cost_vs_goal',
    });

    suggestions.push({
      id: suggestionId,
      sourceType: 'financial_goal',
      sourceReference: 'meal_cost_vs_goal',
      suggestionText,
      estimatedFinancialImpact,
      estimatedNutritionalImpact: 'Mantem cobertura nutricional prevista para a refeicao.',
      evidenceSource,
      evidenceSubtype: inferSuggestionEvidenceSubtype({
        evidenceSource,
        suggestionText,
        sourceReference: 'meal_cost_vs_goal',
      }),
      priorityLevel: 'high',
      createdAt: new Date().toISOString(),
    });
  }

  if (!suggestions.length) {
    const suggestionId = randomUUID();

    await prisma.$executeRaw`
      INSERT INTO menu_import_adjustment_suggestions (
        id,
        tenant_id,
        company_name,
        menu_import_id,
        source_type,
        source_reference,
        suggestion_text,
        estimated_financial_impact,
        estimated_nutritional_impact,
        priority_level,
        created_at,
        updated_at
      )
      VALUES (
        ${suggestionId},
        ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
        ${companyName},
        ${importId},
        ${'rule'},
        ${'preventive_optimization'},
        ${'Manter cardapio atual e registrar combinacoes de melhor aceitacao para proxima versao.'},
        ${0},
        ${'Sem impacto nutricional adverso previsto.'},
        ${'medium'},
        NOW(),
        NOW()
      )
    `;

    const evidenceSource = inferSuggestionEvidenceSource({
      sourceType: 'rule',
      suggestionText:
        'Manter cardapio atual e registrar combinacoes de melhor aceitacao para proxima versao.',
      estimatedNutritionalImpact: 'Sem impacto nutricional adverso previsto.',
      sourceReference: 'preventive_optimization',
    });

    suggestions.push({
      id: suggestionId,
      sourceType: 'rule',
      sourceReference: 'preventive_optimization',
      suggestionText:
        'Manter cardapio atual e registrar combinacoes de melhor aceitacao para proxima versao.',
      estimatedFinancialImpact: 0,
      estimatedNutritionalImpact: 'Sem impacto nutricional adverso previsto.',
      evidenceSource,
      evidenceSubtype: inferSuggestionEvidenceSubtype({
        evidenceSource,
        suggestionText:
          'Manter cardapio atual e registrar combinacoes de melhor aceitacao para proxima versao.',
        sourceReference: 'preventive_optimization',
      }),
      priorityLevel: 'medium',
      createdAt: new Date().toISOString(),
    });
  }

  const suggestionRank = (item: { evidenceSource: string; evidenceSubtype: string | null; sourceType: string }) => {
    if (item.evidenceSource === 'structured' && item.evidenceSubtype === 'classification') {
      return 0;
    }

    if (item.evidenceSource === 'structured') {
      return 1;
    }

    if (item.sourceType === 'rule') {
      return 2;
    }

    return 3;
  };
  const orderedSuggestions = [...suggestions].sort((left, right) => suggestionRank(left) - suggestionRank(right));

  return {
    status: 'ok',
    summary: {
      generatedSuggestions: suggestions.length,
      estimatedTotalFinancialImpact: Number(
        suggestions.reduce((sum, item) => sum + item.estimatedFinancialImpact, 0).toFixed(2),
      ),
      estimatedContractualFinancialImpact: Number(
        suggestions
          .filter((item) => item.sourceType === 'rule')
          .reduce((sum, item) => sum + item.estimatedFinancialImpact, 0)
          .toFixed(2),
      ),
      estimatedGoalFinancialImpact: Number(
        suggestions
          .filter((item) => item.sourceType === 'financial_goal')
          .reduce((sum, item) => sum + item.estimatedFinancialImpact, 0)
          .toFixed(2),
      ),
    },
    suggestions: orderedSuggestions,
  };
});

app.get('/menus/imports/:importId/suggestions', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = menuImportParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Identificador de importacao invalido.',
    });
  }

  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const companyName = getCompanyFromJwt(request);
  const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';
  const importId = parsedParams.data.importId;

  await ensureDomainTables();

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    source_type: 'rule' | 'financial_goal';
    source_reference: string | null;
    suggestion_text: string;
    estimated_financial_impact: number | string;
    estimated_nutritional_impact: string;
    priority_level: 'high' | 'medium';
    created_at: Date;
  }>>`
    SELECT
      id,
      source_type,
      source_reference,
      suggestion_text,
      estimated_financial_impact,
      estimated_nutritional_impact,
      priority_level,
      created_at
    FROM menu_import_adjustment_suggestions
    WHERE menu_import_id = ${importId}
      AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
      AND company_name = ${companyName}
    ORDER BY created_at DESC
  `;

  const parseNumber = (value: number | string) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number(parsed.toFixed(2));
  };

  const mappedSuggestions: Array<{
    id: string;
    sourceType: 'rule' | 'financial_goal';
    sourceReference: string | null;
    suggestionText: string;
    estimatedFinancialImpact: number;
    estimatedNutritionalImpact: string;
    evidenceSource: 'structured' | 'textual_fallback' | 'financial_goal' | 'preventive';
    evidenceSubtype: 'frequency' | 'recurrence' | 'classification' | null;
    priorityLevel: 'high' | 'medium';
    createdAt: string;
  }> = rows.map((item: any) => {
    const evidenceSource = inferSuggestionEvidenceSource({
      sourceType: item.source_type,
      suggestionText: item.suggestion_text,
      estimatedNutritionalImpact: item.estimated_nutritional_impact,
      sourceReference: item.source_reference,
    });

    return {
      id: item.id,
      sourceType: item.source_type,
      sourceReference: item.source_reference,
      suggestionText: item.suggestion_text,
      estimatedFinancialImpact: parseNumber(item.estimated_financial_impact),
      estimatedNutritionalImpact: item.estimated_nutritional_impact,
      evidenceSource,
      evidenceSubtype: inferSuggestionEvidenceSubtype({
        evidenceSource,
        suggestionText: item.suggestion_text,
        sourceReference: item.source_reference,
      }),
      priorityLevel: item.priority_level,
      createdAt: item.created_at.toISOString(),
    };
  });
  const orderedSuggestions = mappedSuggestions.sort((left, right) => {
    const rank = (item: { evidenceSource: string; evidenceSubtype: string | null; sourceType: string }) => {
      if (item.evidenceSource === 'structured' && item.evidenceSubtype === 'classification') {
        return 0;
      }

      if (item.evidenceSource === 'structured') {
        return 1;
      }

      if (item.sourceType === 'rule') {
        return 2;
      }

      return 3;
    };

    return rank(left) - rank(right);
  });

  return {
    status: 'ok',
    summary: {
      generatedSuggestions: rows.length,
      estimatedTotalFinancialImpact: Number(
        rows.reduce((sum: any, item: any) => sum + parseNumber(item.estimated_financial_impact), 0).toFixed(2),
      ),
    },
    suggestions: orderedSuggestions,
  };
});

app.post('/non-conformities', { preHandler: authenticate }, async (request, reply) => {
  const parsed = nonConformitySchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({ status: 'error', message: apiMessage.auth.invalidCredentials });
  }

  if (!prisma) {
    return reply.code(503).send({ status: 'error', message: apiMessage.health.dbUnavailable });
  }

  await ensureDomainTables();

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);
  const itemId = randomUUID();
  const payload = parsed.data;

  await prisma.$executeRaw`
    INSERT INTO non_conformities (
      id,
      tenant_id,
      company_name,
      title,
      description,
      origin,
      impact,
      owner,
      due_date,
      status,
      created_by,
      created_at,
      updated_at
    )
    VALUES (
      ${itemId},
      ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
      ${companyName},
      ${payload.title},
      ${payload.description},
      ${payload.origin},
      ${payload.impact},
      ${payload.owner},
      ${payload.dueDate},
      ${payload.status},
      ${actor.id},
      NOW(),
      NOW()
    )
  `;

  const eventId = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO non_conformity_events (
      id,
      tenant_id,
      company_name,
      non_conformity_id,
      previous_status,
      next_status,
      actor_id,
      actor_name,
      created_at,
      updated_at
    )
    VALUES (
      ${eventId},
      ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
      ${companyName},
      ${itemId},
      ${payload.status},
      ${payload.status},
      ${actor.id},
      ${actor.name},
      NOW(),
      NOW()
    )
  `;

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    description: string;
    origin: string;
    impact: string;
    owner: string;
    due_date: Date;
    status: string;
    created_at: Date;
  }>>`
    SELECT id, title, description, origin, impact, owner, due_date, status, created_at
    FROM non_conformities
    WHERE id = ${itemId}
    LIMIT 1
  `;

  return reply.code(201).send({
    status: 'ok',
    nonConformity: {
      id: rows[0]?.id ?? itemId,
      title: rows[0]?.title ?? payload.title,
      description: rows[0]?.description ?? payload.description,
      origin: rows[0]?.origin ?? payload.origin,
      impact: rows[0]?.impact ?? payload.impact,
      owner: rows[0]?.owner ?? payload.owner,
      dueDate: (rows[0]?.due_date ?? new Date(payload.dueDate)).toISOString(),
      status: rows[0]?.status ?? payload.status,
      createdAt: (rows[0]?.created_at ?? new Date()).toISOString(),
    },
  });
});

app.get('/non-conformities', { preHandler: authenticate }, async (request, reply) => {
  if (!prisma) {
    return reply.code(503).send({ status: 'error', message: apiMessage.health.dbUnavailable });
  }

  const query = z
    .object({
      status: z.enum(['open', 'in_progress', 'resolved', 'cancelled']).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(30),
    })
    .safeParse(request.query);

  await ensureDomainTables();

  const companyName = getCompanyFromJwt(request);
  const limit = query.success ? query.data.limit : 30;
  const selectedStatus = query.success ? query.data.status : undefined;

  const rows = selectedStatus
    ? await prisma.$queryRaw<Array<{
        id: string;
        title: string;
        description: string;
        origin: string;
        impact: string;
        owner: string;
        due_date: Date;
        status: string;
        created_at: Date;
      }>>`
        SELECT id, title, description, origin, impact, owner, due_date, status, created_at
        FROM non_conformities
        WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
          AND company_name = ${companyName}
          AND status = ${selectedStatus}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await prisma.$queryRaw<Array<{
        id: string;
        title: string;
        description: string;
        origin: string;
        impact: string;
        owner: string;
        due_date: Date;
        status: string;
        created_at: Date;
      }>>`
        SELECT id, title, description, origin, impact, owner, due_date, status, created_at
        FROM non_conformities
        WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
          AND company_name = ${companyName}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

  return {
    status: 'ok',
    nonConformities: rows.map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      origin: item.origin,
      impact: item.impact,
      owner: item.owner,
      dueDate: item.due_date.toISOString(),
      status: item.status,
      createdAt: item.created_at.toISOString(),
    })),
  };
});

app.patch('/non-conformities/:nonConformityId/status', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = nonConformityParamsSchema.safeParse(request.params);
  const parsedBody = nonConformityStatusSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return reply.code(400).send({ status: 'error', message: apiMessage.auth.invalidCredentials });
  }

  if (!prisma) {
    return reply.code(503).send({ status: 'error', message: apiMessage.health.dbUnavailable });
  }

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);

  await ensureDomainTables();

  const existing = await prisma.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT id, status
    FROM non_conformities
    WHERE id = ${parsedParams.data.nonConformityId}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
    LIMIT 1
  `;

  if (!existing.length) {
    return reply.code(404).send({ status: 'error', message: 'Nao conformidade nao encontrada.' });
  }

  await prisma.$executeRaw`
    UPDATE non_conformities
    SET status = ${parsedBody.data.status},
        updated_at = NOW()
    WHERE id = ${parsedParams.data.nonConformityId}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
  `;

  const eventId = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO non_conformity_events (
      id,
      tenant_id,
      company_name,
      non_conformity_id,
      previous_status,
      next_status,
      actor_id,
      actor_name,
      created_at,
      updated_at
    )
    VALUES (
      ${eventId},
      ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
      ${companyName},
      ${parsedParams.data.nonConformityId},
      ${existing[0]?.status ?? parsedBody.data.status},
      ${parsedBody.data.status},
      ${actor.id},
      ${actor.name},
      NOW(),
      NOW()
    )
  `;

  return { status: 'ok' };
});

app.get('/non-conformities/:nonConformityId/history', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = nonConformityParamsSchema.safeParse(request.params);
  const parsedQuery = nonConformityHistoryQuerySchema.safeParse(request.query);

  if (!parsedParams.success || !parsedQuery.success) {
    return reply.code(400).send({ status: 'error', message: apiMessage.auth.invalidCredentials });
  }

  if (!prisma) {
    return reply.code(503).send({ status: 'error', message: apiMessage.health.dbUnavailable });
  }

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);
  const actorFilter = parsedQuery.data.actor?.trim() ? `%${parsedQuery.data.actor.trim()}%` : null;
  const fromDate = parsedQuery.data.from ? new Date(`${parsedQuery.data.from}T00:00:00.000Z`) : null;
  const toDate = parsedQuery.data.to ? new Date(`${parsedQuery.data.to}T23:59:59.999Z`) : null;
  const offset = (parsedQuery.data.page - 1) * parsedQuery.data.limit;

  await ensureDomainTables();

  const countRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COUNT(*)::bigint AS total
    FROM non_conformity_events
    WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
      AND company_name = ${companyName}
      AND non_conformity_id = ${parsedParams.data.nonConformityId}
      AND (${actorFilter}::text IS NULL OR actor_name ILIKE ${actorFilter})
      AND (${fromDate}::timestamptz IS NULL OR created_at >= ${fromDate})
      AND (${toDate}::timestamptz IS NULL OR created_at <= ${toDate})
  `;
  const total = Number(countRows[0]?.total ?? 0);

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    previous_status: string;
    next_status: string;
    actor_name: string;
    created_at: Date;
  }>>`
    SELECT id, previous_status, next_status, actor_name, created_at
    FROM non_conformity_events
    WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
      AND company_name = ${companyName}
      AND non_conformity_id = ${parsedParams.data.nonConformityId}
      AND (${actorFilter}::text IS NULL OR actor_name ILIKE ${actorFilter})
      AND (${fromDate}::timestamptz IS NULL OR created_at >= ${fromDate})
      AND (${toDate}::timestamptz IS NULL OR created_at <= ${toDate})
    ORDER BY created_at DESC
    LIMIT ${parsedQuery.data.limit}
    OFFSET ${offset}
  `;

  return {
    status: 'ok',
    events: rows.map((event: any) => ({
      id: event.id,
      previousStatus: event.previous_status,
      nextStatus: event.next_status,
      actorName: event.actor_name,
      createdAt: event.created_at.toISOString(),
    })),
    page: parsedQuery.data.page,
    limit: parsedQuery.data.limit,
    total,
    hasNext: offset + rows.length < total,
  };
});

app.get('/non-conformities/:nonConformityId/history/export', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = nonConformityParamsSchema.safeParse(request.params);
  const parsedQuery = nonConformityHistoryQuerySchema.safeParse(request.query);

  if (!parsedParams.success || !parsedQuery.success) {
    return reply.code(400).send({ status: 'error', message: apiMessage.auth.invalidCredentials });
  }

  if (!prisma) {
    return reply.code(503).send({ status: 'error', message: apiMessage.health.dbUnavailable });
  }

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);
  const actorFilter = parsedQuery.data.actor?.trim() ? `%${parsedQuery.data.actor.trim()}%` : null;
  const fromDate = parsedQuery.data.from ? new Date(`${parsedQuery.data.from}T00:00:00.000Z`) : null;
  const toDate = parsedQuery.data.to ? new Date(`${parsedQuery.data.to}T23:59:59.999Z`) : null;

  await ensureDomainTables();

  const rows = await prisma.$queryRaw<Array<{
    previous_status: string;
    next_status: string;
    actor_name: string;
    created_at: Date;
  }>>`
    SELECT previous_status, next_status, actor_name, created_at
    FROM non_conformity_events
    WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
      AND company_name = ${companyName}
      AND non_conformity_id = ${parsedParams.data.nonConformityId}
      AND (${actorFilter}::text IS NULL OR actor_name ILIKE ${actorFilter})
      AND (${fromDate}::timestamptz IS NULL OR created_at >= ${fromDate})
      AND (${toDate}::timestamptz IS NULL OR created_at <= ${toDate})
    ORDER BY created_at DESC
    LIMIT 5000
  `;

  const csvEscape = (value: string) => {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const header = 'created_at,actor_name,previous_status,next_status';
  const exportId = randomUUID();

  const exportEventId = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO compliance_export_events (
      id,
      export_id,
      tenant_id,
      company_name,
      export_type,
      non_conformity_id,
      filter_actor,
      filter_from,
      filter_to,
      actor_id,
      actor_name,
      created_at,
      updated_at
    )
    VALUES (
      ${exportEventId},
      ${exportId},
      ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
      ${companyName},
      ${'non_conformity_history'},
      ${parsedParams.data.nonConformityId},
      ${parsedQuery.data.actor?.trim() || null},
      ${parsedQuery.data.from || null},
      ${parsedQuery.data.to || null},
      ${actor.id},
      ${actor.name},
      NOW(),
      NOW()
    )
  `;

  const metadata = [
    '# export_type,non_conformity_history',
    '# csv_schema_version,2',
    `# export_id,${csvEscape(exportId)}`,
    `# generated_at,${new Date().toISOString()}`,
    `# company_name,${csvEscape(companyName)}`,
    `# non_conformity_id,${csvEscape(parsedParams.data.nonConformityId)}`,
    `# filter_actor,${csvEscape(parsedQuery.data.actor?.trim() ?? '')}`,
    `# filter_from,${csvEscape(parsedQuery.data.from ?? '')}`,
    `# filter_to,${csvEscape(parsedQuery.data.to ?? '')}`,
    '# ----',
  ];
  const lines = rows.map((row: any) =>
    [
      csvEscape(row.created_at.toISOString()),
      csvEscape(row.actor_name),
      csvEscape(row.previous_status),
      csvEscape(row.next_status),
    ].join(','),
  );

  const csv = [...metadata, header, ...lines].join('\n');

  reply.header('Content-Type', 'text/csv; charset=utf-8');
  reply.header(
    'Content-Disposition',
    `attachment; filename="non-conformity-history-${parsedParams.data.nonConformityId}.csv"`,
  );

  return reply.send(csv);
});

app.post('/non-conformities/:nonConformityId/actions', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = nonConformityParamsSchema.safeParse(request.params);
  const parsedBody = actionPlanSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return reply.code(400).send({ status: 'error', message: apiMessage.auth.invalidCredentials });
  }

  if (!prisma) {
    return reply.code(503).send({ status: 'error', message: apiMessage.health.dbUnavailable });
  }

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);
  const actionId = randomUUID();

  await ensureDomainTables();

  await prisma.$executeRaw`
    INSERT INTO non_conformity_action_plans (
      id,
      tenant_id,
      company_name,
      non_conformity_id,
      description,
      owner,
      due_date,
      status,
      created_by,
      created_at,
      updated_at
    )
    VALUES (
      ${actionId},
      ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
      ${companyName},
      ${parsedParams.data.nonConformityId},
      ${parsedBody.data.description},
      ${parsedBody.data.owner},
      ${parsedBody.data.dueDate},
      ${parsedBody.data.status},
      ${actor.id},
      NOW(),
      NOW()
    )
  `;

  const creationEventId = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO non_conformity_action_events (
      id,
      tenant_id,
      company_name,
      non_conformity_id,
      action_plan_id,
      previous_status,
      next_status,
      actor_id,
      actor_name,
      created_at,
      updated_at
    )
    VALUES (
      ${creationEventId},
      ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
      ${companyName},
      ${parsedParams.data.nonConformityId},
      ${actionId},
      ${parsedBody.data.status},
      ${parsedBody.data.status},
      ${actor.id},
      ${actor.name},
      NOW(),
      NOW()
    )
  `;

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    non_conformity_id: string;
    description: string;
    owner: string;
    due_date: Date;
    status: string;
    created_at: Date;
  }>>`
    SELECT id, non_conformity_id, description, owner, due_date, status, created_at
    FROM non_conformity_action_plans
    WHERE id = ${actionId}
    LIMIT 1
  `;

  return reply.code(201).send({
    status: 'ok',
    action: {
      id: rows[0]?.id ?? actionId,
      nonConformityId: rows[0]?.non_conformity_id ?? parsedParams.data.nonConformityId,
      description: rows[0]?.description ?? parsedBody.data.description,
      owner: rows[0]?.owner ?? parsedBody.data.owner,
      dueDate: (rows[0]?.due_date ?? new Date(parsedBody.data.dueDate)).toISOString(),
      status: rows[0]?.status ?? parsedBody.data.status,
      createdAt: (rows[0]?.created_at ?? new Date()).toISOString(),
    },
  });
});

app.patch('/non-conformities/:nonConformityId/actions/:actionId/status', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = actionPlanParamsSchema.safeParse(request.params);
  const parsedBody = actionPlanStatusSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return reply.code(400).send({ status: 'error', message: apiMessage.auth.invalidCredentials });
  }

  if (!prisma) {
    return reply.code(503).send({ status: 'error', message: apiMessage.health.dbUnavailable });
  }

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);

  await ensureDomainTables();

  const existing = await prisma.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT id, status
    FROM non_conformity_action_plans
    WHERE id = ${parsedParams.data.actionId}
      AND non_conformity_id = ${parsedParams.data.nonConformityId}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
    LIMIT 1
  `;

  if (!existing.length) {
    return reply.code(404).send({ status: 'error', message: 'Acao nao encontrada.' });
  }

  await prisma.$executeRaw`
    UPDATE non_conformity_action_plans
    SET status = ${parsedBody.data.status}
    WHERE id = ${parsedParams.data.actionId}
      AND non_conformity_id = ${parsedParams.data.nonConformityId}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
  `;

  const eventId = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO non_conformity_action_events (
      id,
      tenant_id,
      company_name,
      non_conformity_id,
      action_plan_id,
      previous_status,
      next_status,
      actor_id,
      actor_name,
      created_at,
      updated_at
    )
    VALUES (
      ${eventId},
      ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
      ${companyName},
      ${parsedParams.data.nonConformityId},
      ${parsedParams.data.actionId},
      ${existing[0]?.status ?? parsedBody.data.status},
      ${parsedBody.data.status},
      ${actor.id},
      ${actor.name},
      NOW(),
      NOW()
    )
  `;

  return { status: 'ok' };
});

app.get('/non-conformities/:nonConformityId/actions/:actionId/history', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = actionPlanParamsSchema.safeParse(request.params);
  const parsedQuery = actionPlanHistoryQuerySchema.safeParse(request.query);

  if (!parsedParams.success || !parsedQuery.success) {
    return reply.code(400).send({ status: 'error', message: apiMessage.auth.invalidCredentials });
  }

  if (!prisma) {
    return reply.code(503).send({ status: 'error', message: apiMessage.health.dbUnavailable });
  }

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);
  const actorFilter = parsedQuery.data.actor?.trim() ? `%${parsedQuery.data.actor.trim()}%` : null;
  const fromDate = parsedQuery.data.from ? new Date(`${parsedQuery.data.from}T00:00:00.000Z`) : null;
  const toDate = parsedQuery.data.to ? new Date(`${parsedQuery.data.to}T23:59:59.999Z`) : null;
  const offset = (parsedQuery.data.page - 1) * parsedQuery.data.limit;

  await ensureDomainTables();

  const countRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COUNT(*)::bigint AS total
    FROM non_conformity_action_events
    WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
      AND company_name = ${companyName}
      AND non_conformity_id = ${parsedParams.data.nonConformityId}
      AND action_plan_id = ${parsedParams.data.actionId}
      AND (${actorFilter}::text IS NULL OR actor_name ILIKE ${actorFilter})
      AND (${fromDate}::timestamptz IS NULL OR created_at >= ${fromDate})
      AND (${toDate}::timestamptz IS NULL OR created_at <= ${toDate})
  `;
  const total = Number(countRows[0]?.total ?? 0);

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    previous_status: string;
    next_status: string;
    actor_name: string;
    created_at: Date;
  }>>`
    SELECT id, previous_status, next_status, actor_name, created_at
    FROM non_conformity_action_events
    WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
      AND company_name = ${companyName}
      AND non_conformity_id = ${parsedParams.data.nonConformityId}
      AND action_plan_id = ${parsedParams.data.actionId}
      AND (${actorFilter}::text IS NULL OR actor_name ILIKE ${actorFilter})
      AND (${fromDate}::timestamptz IS NULL OR created_at >= ${fromDate})
      AND (${toDate}::timestamptz IS NULL OR created_at <= ${toDate})
    ORDER BY created_at DESC
    LIMIT ${parsedQuery.data.limit}
    OFFSET ${offset}
  `;

  return {
    status: 'ok',
    events: rows.map((event: any) => ({
      id: event.id,
      previousStatus: event.previous_status,
      nextStatus: event.next_status,
      actorName: event.actor_name,
      createdAt: event.created_at.toISOString(),
    })),
    page: parsedQuery.data.page,
    limit: parsedQuery.data.limit,
    total,
    hasNext: offset + rows.length < total,
  };
});

app.get('/non-conformities/:nonConformityId/actions/:actionId/history/export', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = actionPlanParamsSchema.safeParse(request.params);
  const parsedQuery = actionPlanHistoryQuerySchema.safeParse(request.query);

  if (!parsedParams.success || !parsedQuery.success) {
    return reply.code(400).send({ status: 'error', message: apiMessage.auth.invalidCredentials });
  }

  if (!prisma) {
    return reply.code(503).send({ status: 'error', message: apiMessage.health.dbUnavailable });
  }

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);
  const actorFilter = parsedQuery.data.actor?.trim() ? `%${parsedQuery.data.actor.trim()}%` : null;
  const fromDate = parsedQuery.data.from ? new Date(`${parsedQuery.data.from}T00:00:00.000Z`) : null;
  const toDate = parsedQuery.data.to ? new Date(`${parsedQuery.data.to}T23:59:59.999Z`) : null;

  await ensureDomainTables();

  const rows = await prisma.$queryRaw<Array<{
    previous_status: string;
    next_status: string;
    actor_name: string;
    created_at: Date;
  }>>`
    SELECT previous_status, next_status, actor_name, created_at
    FROM non_conformity_action_events
    WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
      AND company_name = ${companyName}
      AND non_conformity_id = ${parsedParams.data.nonConformityId}
      AND action_plan_id = ${parsedParams.data.actionId}
      AND (${actorFilter}::text IS NULL OR actor_name ILIKE ${actorFilter})
      AND (${fromDate}::timestamptz IS NULL OR created_at >= ${fromDate})
      AND (${toDate}::timestamptz IS NULL OR created_at <= ${toDate})
    ORDER BY created_at DESC
    LIMIT 5000
  `;

  const csvEscape = (value: string) => {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const header = 'created_at,actor_name,previous_status,next_status';
  const exportId = randomUUID();

  const exportEventId = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO compliance_export_events (
      id,
      export_id,
      tenant_id,
      company_name,
      export_type,
      non_conformity_id,
      action_plan_id,
      filter_actor,
      filter_from,
      filter_to,
      actor_id,
      actor_name,
      created_at,
      updated_at
    )
    VALUES (
      ${exportEventId},
      ${exportId},
      ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
      ${companyName},
      ${'action_plan_history'},
      ${parsedParams.data.nonConformityId},
      ${parsedParams.data.actionId},
      ${parsedQuery.data.actor?.trim() || null},
      ${parsedQuery.data.from || null},
      ${parsedQuery.data.to || null},
      ${actor.id},
      ${actor.name},
      NOW(),
      NOW()
    )
  `;

  const metadata = [
    '# export_type,action_plan_history',
    '# csv_schema_version,2',
    `# export_id,${csvEscape(exportId)}`,
    `# generated_at,${new Date().toISOString()}`,
    `# company_name,${csvEscape(companyName)}`,
    `# non_conformity_id,${csvEscape(parsedParams.data.nonConformityId)}`,
    `# action_plan_id,${csvEscape(parsedParams.data.actionId)}`,
    `# filter_actor,${csvEscape(parsedQuery.data.actor?.trim() ?? '')}`,
    `# filter_from,${csvEscape(parsedQuery.data.from ?? '')}`,
    `# filter_to,${csvEscape(parsedQuery.data.to ?? '')}`,
    '# ----',
  ];
  const lines = rows.map((row: any) =>
    [
      csvEscape(row.created_at.toISOString()),
      csvEscape(row.actor_name),
      csvEscape(row.previous_status),
      csvEscape(row.next_status),
    ].join(','),
  );

  const csv = [...metadata, header, ...lines].join('\n');

  reply.header('Content-Type', 'text/csv; charset=utf-8');
  reply.header(
    'Content-Disposition',
    `attachment; filename="action-plan-history-${parsedParams.data.actionId}.csv"`,
  );

  return reply.send(csv);
});

app.get('/non-conformities/:nonConformityId/actions', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = nonConformityParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return reply.code(400).send({ status: 'error', message: apiMessage.auth.invalidCredentials });
  }

  if (!prisma) {
    return reply.code(503).send({ status: 'error', message: apiMessage.health.dbUnavailable });
  }

  const companyName = getCompanyFromJwt(request);

  await ensureDomainTables();

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    non_conformity_id: string;
    description: string;
    owner: string;
    due_date: Date;
    status: string;
    created_at: Date;
  }>>`
    SELECT id, non_conformity_id, description, owner, due_date, status, created_at
    FROM non_conformity_action_plans
    WHERE non_conformity_id = ${parsedParams.data.nonConformityId}
 AND tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
 AND company_name = ${companyName}
    ORDER BY created_at DESC
    LIMIT 50
  `;

  return {
    status: 'ok',
    actions: rows.map((action: any) => ({
      id: action.id,
      nonConformityId: action.non_conformity_id,
      description: action.description,
      owner: action.owner,
      dueDate: action.due_date.toISOString(),
      status: action.status,
      createdAt: action.created_at.toISOString(),
    })),
  };
});

app.get('/compliance/exports/audit', { preHandler: authenticate }, async (request, reply) => {
  const parsedQuery = complianceExportAuditQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return reply.code(400).send({ status: 'error', message: apiMessage.auth.invalidCredentials });
  }

  if (!prisma) {
    return reply.code(503).send({ status: 'error', message: apiMessage.health.dbUnavailable });
  }

  const companyName = getCompanyFromJwt(request);
  const exportTypeFilter =
    parsedQuery.data.exportType === 'all' ? null : parsedQuery.data.exportType;
  const exportIdFilter = parsedQuery.data.exportId?.trim() ? parsedQuery.data.exportId.trim() : null;
  const nonConformityFilter =
    parsedQuery.data.nonConformityId?.trim() ? parsedQuery.data.nonConformityId.trim() : null;
  const actionPlanFilter =
    parsedQuery.data.actionPlanId?.trim() ? parsedQuery.data.actionPlanId.trim() : null;
  const actorFilter = parsedQuery.data.actor?.trim() ? `%${parsedQuery.data.actor.trim()}%` : null;
  const fromDate = parsedQuery.data.from ? new Date(`${parsedQuery.data.from}T00:00:00.000Z`) : null;
  const toDate = parsedQuery.data.to ? new Date(`${parsedQuery.data.to}T23:59:59.999Z`) : null;
  const sortOrder = parsedQuery.data.sortOrder;
  const offset = (parsedQuery.data.page - 1) * parsedQuery.data.limit;

  await ensureDomainTables();

  const countRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COUNT(*)::bigint AS total
    FROM compliance_export_events
    WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
      AND company_name = ${companyName}
      AND (${exportTypeFilter}::text IS NULL OR export_type = ${exportTypeFilter})
      AND (${exportIdFilter}::text IS NULL OR export_id = ${exportIdFilter})
      AND (${nonConformityFilter}::text IS NULL OR non_conformity_id = ${nonConformityFilter})
      AND (${actionPlanFilter}::text IS NULL OR action_plan_id = ${actionPlanFilter})
      AND (${actorFilter}::text IS NULL OR actor_name ILIKE ${actorFilter})
      AND (${fromDate}::timestamptz IS NULL OR created_at >= ${fromDate})
      AND (${toDate}::timestamptz IS NULL OR created_at <= ${toDate})
  `;
  const total = Number(countRows[0]?.total ?? 0);

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    export_id: string;
    export_type: string;
    non_conformity_id: string | null;
    action_plan_id: string | null;
    filter_export_id: string | null;
    filter_non_conformity_id: string | null;
    filter_action_plan_id: string | null;
    filter_sort_order: string | null;
    filter_export_scope: string | null;
    filter_actor: string | null;
    filter_from: Date | null;
    filter_to: Date | null;
    actor_name: string;
    created_at: Date;
  }>>`
    SELECT
      id,
      export_id,
      export_type,
      non_conformity_id,
      action_plan_id,
      filter_export_id,
      filter_non_conformity_id,
      filter_action_plan_id,
      filter_sort_order,
      filter_export_scope,
      filter_actor,
      filter_from,
      filter_to,
      actor_name,
      created_at
    FROM compliance_export_events
    WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
      AND company_name = ${companyName}
      AND (${exportTypeFilter}::text IS NULL OR export_type = ${exportTypeFilter})
      AND (${exportIdFilter}::text IS NULL OR export_id = ${exportIdFilter})
      AND (${nonConformityFilter}::text IS NULL OR non_conformity_id = ${nonConformityFilter})
      AND (${actionPlanFilter}::text IS NULL OR action_plan_id = ${actionPlanFilter})
      AND (${actorFilter}::text IS NULL OR actor_name ILIKE ${actorFilter})
      AND (${fromDate}::timestamptz IS NULL OR created_at >= ${fromDate})
      AND (${toDate}::timestamptz IS NULL OR created_at <= ${toDate})
    ORDER BY
      CASE WHEN ${sortOrder} = 'asc' THEN created_at END ASC,
      CASE WHEN ${sortOrder} = 'desc' THEN created_at END DESC
    LIMIT ${parsedQuery.data.limit}
    OFFSET ${offset}
  `;

  return {
    status: 'ok',
    events: rows.map((row: any) => ({
      id: row.id,
      exportId: row.export_id,
      exportType: row.export_type,
      nonConformityId: row.non_conformity_id,
      actionPlanId: row.action_plan_id,
      filterExportId: row.filter_export_id,
      filterNonConformityId: row.filter_non_conformity_id,
      filterActionPlanId: row.filter_action_plan_id,
      filterSortOrder: row.filter_sort_order,
      filterExportScope: row.filter_export_scope,
      filterActor: row.filter_actor,
      filterFrom: row.filter_from ? row.filter_from.toISOString() : null,
      filterTo: row.filter_to ? row.filter_to.toISOString() : null,
      actorName: row.actor_name,
      createdAt: row.created_at.toISOString(),
    })),
    page: parsedQuery.data.page,
    limit: parsedQuery.data.limit,
    total,
    hasNext: offset + rows.length < total,
  };
});

app.get('/compliance/exports/audit/export', { preHandler: authenticate }, async (request, reply) => {
  const parsedQuery = complianceExportAuditQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return reply.code(400).send({ status: 'error', message: apiMessage.auth.invalidCredentials });
  }

  if (!prisma) {
    return reply.code(503).send({ status: 'error', message: apiMessage.health.dbUnavailable });
  }

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);
  const exportTypeFilter =
    parsedQuery.data.exportType === 'all' ? null : parsedQuery.data.exportType;
  const exportIdFilter = parsedQuery.data.exportId?.trim() ? parsedQuery.data.exportId.trim() : null;
  const nonConformityFilter =
    parsedQuery.data.nonConformityId?.trim() ? parsedQuery.data.nonConformityId.trim() : null;
  const actionPlanFilter =
    parsedQuery.data.actionPlanId?.trim() ? parsedQuery.data.actionPlanId.trim() : null;
  const actorFilter = parsedQuery.data.actor?.trim() ? `%${parsedQuery.data.actor.trim()}%` : null;
  const fromDate = parsedQuery.data.from ? new Date(`${parsedQuery.data.from}T00:00:00.000Z`) : null;
  const toDate = parsedQuery.data.to ? new Date(`${parsedQuery.data.to}T23:59:59.999Z`) : null;
  const sortOrder = parsedQuery.data.sortOrder;
  const exportScope = parsedQuery.data.exportScope;
  const offset = (parsedQuery.data.page - 1) * parsedQuery.data.limit;

  await ensureDomainTables();

  const countRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COUNT(*)::bigint AS total
    FROM compliance_export_events
    WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
      AND company_name = ${companyName}
      AND (${exportTypeFilter}::text IS NULL OR export_type = ${exportTypeFilter})
      AND (${exportIdFilter}::text IS NULL OR export_id = ${exportIdFilter})
      AND (${nonConformityFilter}::text IS NULL OR non_conformity_id = ${nonConformityFilter})
      AND (${actionPlanFilter}::text IS NULL OR action_plan_id = ${actionPlanFilter})
      AND (${actorFilter}::text IS NULL OR actor_name ILIKE ${actorFilter})
      AND (${fromDate}::timestamptz IS NULL OR created_at >= ${fromDate})
      AND (${toDate}::timestamptz IS NULL OR created_at <= ${toDate})
  `;
  const total = Number(countRows[0]?.total ?? 0);
  const effectiveOffset = exportScope === 'all' ? 0 : offset;
  const effectiveLimit = exportScope === 'all' ? total : parsedQuery.data.limit;

  const rows = await prisma.$queryRaw<Array<{
    export_id: string;
    export_type: string;
    non_conformity_id: string | null;
    action_plan_id: string | null;
    filter_export_id: string | null;
    filter_non_conformity_id: string | null;
    filter_action_plan_id: string | null;
    filter_sort_order: string | null;
    filter_export_scope: string | null;
    filter_actor: string | null;
    filter_from: Date | null;
    filter_to: Date | null;
    actor_name: string;
    created_at: Date;
  }>>`
    SELECT
      export_id,
      export_type,
      non_conformity_id,
      action_plan_id,
      filter_export_id,
      filter_non_conformity_id,
      filter_action_plan_id,
      filter_sort_order,
      filter_export_scope,
      filter_actor,
      filter_from,
      filter_to,
      actor_name,
      created_at
    FROM compliance_export_events
    WHERE tenant_id = ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'}
      AND company_name = ${companyName}
      AND (${exportTypeFilter}::text IS NULL OR export_type = ${exportTypeFilter})
      AND (${exportIdFilter}::text IS NULL OR export_id = ${exportIdFilter})
      AND (${nonConformityFilter}::text IS NULL OR non_conformity_id = ${nonConformityFilter})
      AND (${actionPlanFilter}::text IS NULL OR action_plan_id = ${actionPlanFilter})
      AND (${actorFilter}::text IS NULL OR actor_name ILIKE ${actorFilter})
      AND (${fromDate}::timestamptz IS NULL OR created_at >= ${fromDate})
      AND (${toDate}::timestamptz IS NULL OR created_at <= ${toDate})
    ORDER BY
      CASE WHEN ${sortOrder} = 'asc' THEN created_at END ASC,
      CASE WHEN ${sortOrder} = 'desc' THEN created_at END DESC
    LIMIT ${effectiveLimit}
    OFFSET ${effectiveOffset}
  `;

  const csvEscape = (value: string) => {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const exportId = randomUUID();
  const exportEventId = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO compliance_export_events (
      id,
      export_id,
      tenant_id,
      company_name,
      export_type,
      filter_export_id,
      filter_non_conformity_id,
      filter_action_plan_id,
      filter_sort_order,
      filter_export_scope,
      filter_actor,
      filter_from,
      filter_to,
      actor_id,
      actor_name,
      created_at,
      updated_at
    )
    VALUES (
      ${exportEventId},
      ${exportId},
      ${(request.user as { tenantId?: string }).tenantId ?? 'demo-tenant'},
      ${companyName},
      ${'compliance_export_audit'},
      ${parsedQuery.data.exportId?.trim() || null},
      ${parsedQuery.data.nonConformityId?.trim() || null},
      ${parsedQuery.data.actionPlanId?.trim() || null},
      ${parsedQuery.data.sortOrder},
      ${parsedQuery.data.exportScope},
      ${parsedQuery.data.actor?.trim() || null},
      ${parsedQuery.data.from || null},
      ${parsedQuery.data.to || null},
      ${actor.id},
      ${actor.name},
      NOW(),
      NOW()
    )
  `;

  const metadata = [
    '# export_type,compliance_export_audit',
    '# csv_schema_version,1',
    `# export_id,${csvEscape(exportId)}`,
    `# generated_at,${new Date().toISOString()}`,
    `# company_name,${csvEscape(companyName)}`,
    `# filter_export_type,${csvEscape(parsedQuery.data.exportType)}`,
    `# filter_export_id,${csvEscape(parsedQuery.data.exportId?.trim() ?? '')}`,
    `# filter_non_conformity_id,${csvEscape(parsedQuery.data.nonConformityId?.trim() ?? '')}`,
    `# filter_action_plan_id,${csvEscape(parsedQuery.data.actionPlanId?.trim() ?? '')}`,
    `# filter_sort_order,${csvEscape(parsedQuery.data.sortOrder)}`,
    `# filter_export_scope,${csvEscape(parsedQuery.data.exportScope)}`,
    `# filter_actor,${csvEscape(parsedQuery.data.actor?.trim() ?? '')}`,
    `# filter_from,${csvEscape(parsedQuery.data.from ?? '')}`,
    `# filter_to,${csvEscape(parsedQuery.data.to ?? '')}`,
    `# page,${parsedQuery.data.page}`,
    `# limit,${parsedQuery.data.limit}`,
    `# total,${total}`,
    `# has_next,${effectiveOffset + rows.length < total ? 'true' : 'false'}`,
    '# ----',
  ];

  const header =
    'created_at,export_id,export_type,actor_name,non_conformity_id,action_plan_id,filter_export_id,filter_non_conformity_id,filter_action_plan_id,filter_sort_order,filter_export_scope,filter_actor,filter_from,filter_to';
  const lines = rows.map((row: any) =>
    [
      csvEscape(row.created_at.toISOString()),
      csvEscape(row.export_id),
      csvEscape(row.export_type),
      csvEscape(row.actor_name),
      csvEscape(row.non_conformity_id ?? ''),
      csvEscape(row.action_plan_id ?? ''),
      csvEscape(row.filter_export_id ?? ''),
      csvEscape(row.filter_non_conformity_id ?? ''),
      csvEscape(row.filter_action_plan_id ?? ''),
      csvEscape(row.filter_sort_order ?? ''),
      csvEscape(row.filter_export_scope ?? ''),
      csvEscape(row.filter_actor ?? ''),
      csvEscape(row.filter_from ? row.filter_from.toISOString() : ''),
      csvEscape(row.filter_to ? row.filter_to.toISOString() : ''),
    ].join(','),
  );

  const csv = [...metadata, header, ...lines].join('\n');

  reply.header('Content-Type', 'text/csv; charset=utf-8');
  reply.header('Content-Disposition', 'attachment; filename="compliance-export-audit.csv"');

  return reply.send(csv);
});
  };

  return {
    repository,
    registerRoutes,
  };
};
