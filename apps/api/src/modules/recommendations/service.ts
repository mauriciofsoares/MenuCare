import { createRecommendationsRepository } from './repository.js';
import type { FastifyRequest } from 'fastify';

type SafeParseSuccess<T> = { success: true; data: T };
type SafeParseFailure = { success: false };
type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure;

type SchemaLike<T> = {
  safeParse: (input: unknown) => SafeParseResult<T>;
};

type RouteResult = {
  statusCode: number;
  body: unknown;
};

export interface Deps {
  apiMessage: { health: { dbUnavailable: string } };
  authenticate: any;
  menuImportParamsSchema: SchemaLike<{ importId: string }>;
  prisma: {
    $queryRaw: <T>(query: TemplateStringsArray, ...params: unknown[]) => Promise<T>;
    $executeRaw: (query: TemplateStringsArray, ...params: unknown[]) => Promise<unknown>;
  } | null;
  getCompanyFromJwt: (request: FastifyRequest) => string;
  getTenantIdFromJwt: (request: FastifyRequest) => string;
  ensureDomainTables: () => Promise<void>;
  recommendationPolicyContract: unknown;
  buildNextMenuProposal: (payload: { companyName: string; tenantId: string; importId: string }) => Promise<any | null>;
  recordAiPreparationEvent: (...args: any[]) => Promise<void>;
  buildMenuPreparationContext: (payload: Record<string, unknown>) => unknown;
  nextMenuDecisionSchema: SchemaLike<{ decision: 'approved' | 'rejected'; justification: string }>;
  getUserFromJwt: (request: FastifyRequest) => { id: string; name: string };
  randomUUID: () => string;
  nextMenuDecisionListQuerySchema: SchemaLike<{ limit: number }>;
}

export const createRecommendationsService = (deps: Deps) => {
  const repository = createRecommendationsRepository(deps);

  const parseNumber = (value: number | string) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number(parsed.toFixed(2));
  };

  const getRecommendationPreview = async (
    request: FastifyRequest,
    params: { importId: string },
  ): Promise<RouteResult> => {
    if (!deps.prisma) {
      return { statusCode: 503, body: { status: 'error', message: deps.apiMessage.health.dbUnavailable } };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = deps.getTenantIdFromJwt(request);
    const importId = params.importId;

    await deps.ensureDomainTables();

    const importRows = await deps.prisma.$queryRaw<
      Array<{
        id: string;
        unit_name: string;
        service_name: string;
        financial_goal: number | string;
        meal_cost: number | string;
        recipes_json: string;
      }>
    >`
      SELECT id, unit_name, service_name, financial_goal, meal_cost, recipes_json
      FROM menu_pdf_imports
      WHERE id = ${importId}
        AND tenant_id = ${tenantId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
      LIMIT 1
    `;

    const imported = importRows[0];

    if (!imported) {
      return {
        statusCode: 404,
        body: {
          status: 'error',
          message: 'Importacao de cardapio nao encontrada para esta empresa.',
        },
      };
    }

    const mealCost = parseNumber(imported.meal_cost);
    const financialGoal = parseNumber(imported.financial_goal);
    const mandatoryFindings: Array<{
      criterion: string;
      status: 'ok' | 'violation';
      detail: string;
    }> = [];

    const ruleAuditRows = await deps.prisma.$queryRaw<Array<{ result_status: 'compliant' | 'non_compliant' }>>`
      SELECT result_status
      FROM menu_import_rule_audits
      WHERE menu_import_id = ${importId}
        AND tenant_id = ${tenantId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
    `;

    const hasRuleViolation = ruleAuditRows.some((item) => item.result_status === 'non_compliant');
    mandatoryFindings.push({
      criterion: 'contract_rule_violation',
      status: hasRuleViolation ? 'violation' : 'ok',
      detail: hasRuleViolation
        ? 'Ha regras contratuais nao conformes para este cardapio.'
        : 'Regras contratuais obrigatorias atendidas.',
    });

    const isFinancialViolation = mealCost > financialGoal;
    mandatoryFindings.push({
      criterion: 'financial_goal_exceeded',
      status: isFinancialViolation ? 'violation' : 'ok',
      detail: isFinancialViolation
        ? 'O custo da refeicao esta acima da meta financeira definida.'
        : 'Meta financeira atendida para a refeicao.',
    });

    mandatoryFindings.push({
      criterion: 'mandatory_nutritional_restriction_violation',
      status: 'ok',
      detail: 'Sem violacoes nutricionais obrigatorias detectadas no escopo atual.',
    });

    mandatoryFindings.push({
      criterion: 'critical_operational_rule_violation',
      status: 'ok',
      detail: 'Sem violacoes operacionais criticas detectadas no escopo atual.',
    });

    const currentRecipes = JSON.parse(imported.recipes_json) as string[];

    const combinationRows = await deps.prisma.$queryRaw<
      Array<{
        id: string;
        recipes_json: string;
        average_rating: number | string;
        evaluations_count: number;
        trend: 'positive' | 'stable' | 'negative';
      }>
    >`
      SELECT id, recipes_json, average_rating, evaluations_count, trend
      FROM menu_combination_intelligence
      WHERE tenant_id = ${tenantId}
        AND company_name = ${companyName}
        AND unit_name = ${imported.unit_name}
        AND service_name = ${imported.service_name}
      ORDER BY average_rating DESC, evaluations_count DESC
      LIMIT 3
    `;

    const recommendedCombinations = combinationRows.map((item) => ({
      id: item.id,
      recipes: JSON.parse(item.recipes_json) as string[],
      averageRating: parseNumber(item.average_rating),
      evaluationsCount: item.evaluations_count,
      trend: item.trend,
    }));

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        recommendation: {
          policy: deps.recommendationPolicyContract,
          importContext: {
            importId,
            unitName: imported.unit_name,
            serviceName: imported.service_name,
            financialGoal,
            mealCost,
            currentRecipes,
          },
          decision: {
            blocksApproval: mandatoryFindings.some((item) => item.status === 'violation'),
            mandatoryFindings,
          },
          historicalLayer: {
            nonBlocking: true,
            note: 'Avaliacao historica e suporte de recomendacao e nunca bloqueio.',
            recommendedCombinations,
          },
        },
      },
    };
  };

  const createNextMenuProposal = async (
    request: FastifyRequest,
    params: { importId: string },
  ): Promise<RouteResult> => {
    if (!deps.prisma) {
      return { statusCode: 503, body: { status: 'error', message: deps.apiMessage.health.dbUnavailable } };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = deps.getTenantIdFromJwt(request);
    const importId = params.importId;

    const importedRows = await deps.prisma.$queryRaw<
      Array<{
        unit_name: string;
        service_name: string;
        reference_date: Date | string;
        recipes_json: string;
      }>
    >`
      SELECT unit_name, service_name, reference_date, recipes_json
      FROM menu_pdf_imports
      WHERE id = ${importId}
        AND tenant_id = ${tenantId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
      LIMIT 1
    `;

    const imported = importedRows[0];
    const nextMenuProposal = await deps.buildNextMenuProposal({ companyName, tenantId, importId });

    if (!nextMenuProposal) {
      return {
        statusCode: 404,
        body: {
          status: 'error',
          message: 'Importacao de cardapio nao encontrada para esta empresa.',
        },
      };
    }

    await deps.recordAiPreparationEvent({
      tenantId,
      companyName,
      moduleKey: 'menus',
      sourceKind: 'next-menu-proposal',
      providerKey: 'structured-ready',
      data: deps.buildMenuPreparationContext({
        companyName,
        importId,
        unitName: imported?.unit_name ?? nextMenuProposal.unitName,
        serviceName: imported?.service_name ?? nextMenuProposal.serviceName,
        referenceDate:
          typeof imported?.reference_date === 'string'
            ? imported.reference_date.slice(0, 10)
            : imported?.reference_date instanceof Date
              ? imported.reference_date.toISOString().slice(0, 10)
              : new Date().toISOString().slice(0, 10),
        monthsAhead: 0,
        recipes: (() => {
          try {
            return JSON.parse(imported?.recipes_json ?? '[]') as string[];
          } catch {
            return nextMenuProposal.recipes;
          }
        })(),
        targetMonth:
          typeof imported?.reference_date === 'string'
            ? imported.reference_date.slice(0, 7)
            : imported?.reference_date instanceof Date
              ? imported.reference_date.toISOString().slice(0, 7)
              : new Date().toISOString().slice(0, 7),
        commemorativeDates: [],
      }),
    });

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        nextMenuProposal,
      },
    };
  };

  const saveDecision = async (
    request: FastifyRequest,
    params: { importId: string },
    payload: { decision: 'approved' | 'rejected'; justification: string },
  ): Promise<RouteResult> => {
    if (!deps.prisma) {
      return { statusCode: 503, body: { status: 'error', message: deps.apiMessage.health.dbUnavailable } };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const actor = deps.getUserFromJwt(request);
    const tenantId = deps.getTenantIdFromJwt(request);
    const importId = params.importId;

    const nextMenuProposal = await deps.buildNextMenuProposal({ companyName, tenantId, importId });

    if (!nextMenuProposal) {
      return {
        statusCode: 404,
        body: {
          status: 'error',
          message: 'Importacao de cardapio nao encontrada para esta empresa.',
        },
      };
    }

    if (payload.decision === 'approved' && nextMenuProposal.governance.blocksApproval) {
      return {
        statusCode: 409,
        body: {
          status: 'error',
          message: 'Aprovacao bloqueada por criterios obrigatorios de governanca.',
        },
      };
    }

    const decisionId = deps.randomUUID();

    await deps.prisma.$executeRaw`
      INSERT INTO menu_next_menu_decisions (
        id,
        tenant_id,
        company_name,
        menu_import_id,
        decision_status,
        justification,
        proposal_json,
        governance_blocks_approval,
        historical_non_blocking,
        actor_id,
        actor_name
      )
      VALUES (
        ${decisionId},
        ${tenantId},
        ${companyName},
        ${importId},
        ${payload.decision},
        ${payload.justification},
        ${JSON.stringify(nextMenuProposal)},
        ${nextMenuProposal.governance.blocksApproval},
        ${nextMenuProposal.historicalLayer.nonBlocking},
        ${actor.id},
        ${actor.name}
      )
    `;

    const decisionRows = await deps.prisma.$queryRaw<
      Array<{
        id: string;
        decision_status: 'approved' | 'rejected';
        justification: string;
        governance_blocks_approval: boolean;
        historical_non_blocking: boolean;
        actor_id: string;
        actor_name: string;
        created_at: Date | string;
      }>
    >`
      SELECT
        id,
        decision_status,
        justification,
        governance_blocks_approval,
        historical_non_blocking,
        actor_id,
        actor_name,
        created_at
      FROM menu_next_menu_decisions
      WHERE id = ${decisionId}
      LIMIT 1
    `;

    const created = decisionRows[0];

    return {
      statusCode: 201,
      body: {
        status: 'ok',
        decision: {
          id: created.id,
          importId,
          status: created.decision_status,
          justification: created.justification,
          governanceBlocksApproval: created.governance_blocks_approval,
          historicalNonBlocking: created.historical_non_blocking,
          actorId: created.actor_id,
          actorName: created.actor_name,
          createdAt: created.created_at,
          nextMenuProposal,
        },
      },
    };
  };

  const listDecisions = async (
    request: FastifyRequest,
    params: { importId: string },
    query: { limit: number },
  ): Promise<RouteResult> => {
    if (!deps.prisma) {
      return { statusCode: 503, body: { status: 'error', message: deps.apiMessage.health.dbUnavailable } };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = deps.getTenantIdFromJwt(request);
    const importId = params.importId;

    await deps.ensureDomainTables();

    const rows = await deps.prisma.$queryRaw<
      Array<{
        id: string;
        decision_status: 'approved' | 'rejected';
        justification: string;
        proposal_json: string;
        governance_blocks_approval: boolean;
        historical_non_blocking: boolean;
        actor_id: string;
        actor_name: string;
        created_at: Date | string;
      }>
    >`
      SELECT
        id,
        decision_status,
        justification,
        proposal_json,
        governance_blocks_approval,
        historical_non_blocking,
        actor_id,
        actor_name,
        created_at
      FROM menu_next_menu_decisions
      WHERE menu_import_id = ${importId}
        AND tenant_id = ${tenantId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
      ORDER BY created_at DESC
      LIMIT ${query.limit}
    `;

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        decisions: rows.map((row) => ({
          id: row.id,
          importId,
          status: row.decision_status,
          justification: row.justification,
          governanceBlocksApproval: row.governance_blocks_approval,
          historicalNonBlocking: row.historical_non_blocking,
          actorId: row.actor_id,
          actorName: row.actor_name,
          createdAt: row.created_at,
          nextMenuProposal: JSON.parse(row.proposal_json),
        })),
      },
    };
  };

  return {
    repository,
    apiMessage: deps.apiMessage,
    authenticate: deps.authenticate,
    menuImportParamsSchema: deps.menuImportParamsSchema,
    nextMenuDecisionSchema: deps.nextMenuDecisionSchema,
    nextMenuDecisionListQuerySchema: deps.nextMenuDecisionListQuerySchema,
    getRecommendationPreview,
    createNextMenuProposal,
    saveDecision,
    listDecisions,
  };
};
