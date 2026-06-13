import { createRulesRepository } from './repository.js';
import type { FastifyRequest } from 'fastify';
import { contractMemory } from '../contracts/service.js';

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

type PromoteRuleToControlPayload = {
  title?: string;
  operationalDescription: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'per_shift' | 'on_demand';
  responsible: string;
  expectedEvidence: string;
  status: 'DRAFT' | 'ACTIVE';
};

type RuleUpdatePayload = {
  title?: string;
  description?: string;
  category?: string;
  ruleType?: string | null;
  periodicity?: string | null;
  quantity?: number | null;
  unitMeasure?: string | null;
  calculationBasis?: string | null;
  applicability?: string | null;
};

type MemoryRule = {
  id: string;
  tenantId: string;
  siteId: string;
  companyName: string;
  contractId: string;
  title: string;
  description: string;
  category: string;
  ruleType: string | null;
  periodicity: string | null;
  quantity: number | null;
  unitMeasure: string | null;
  calculationBasis: string | null;
  applicability: string | null;
  sourceExcerpt: string | null;
  sourceItem: string | null;
  sourcePage: number | null;
  sourceBlockId: string | null;
  evidenceConfidence: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export const ruleMemory = new Map<string, MemoryRule>();

export const controlMemory = new Map<string, {
  id: string;
  tenantId: string;
  siteId: string;
  companyName: string;
  contractId: string;
  contractRuleId: string;
  title: string;
  operationalDescription: string;
  frequency: string;
  responsible: string;
  expectedEvidence: string;
  status: string;
  activatedAt: Date | null;
  deactivatedAt: Date | null;
  createdBy: string;
  createdAt: Date;
}>();

export interface Deps {
  apiMessage: {
    auth: { invalidCredentials: string };
    health: { dbUnavailable: string };
  };
  authenticate: any;
  ruleSchema: SchemaLike<{
    contractId: string;
    title: string;
    description: string;
    category: string;
    sourceExcerpt?: string;
    sourcePage?: number;
    evidenceConfidence?: number;
    status: string;
  }>;
  ruleParamsSchema: SchemaLike<{ ruleId: string }>;
  ruleStatusUpdateSchema: SchemaLike<{ status: string; note?: string | null }>;
  prisma: {
    $queryRaw: <T>(query: TemplateStringsArray, ...params: unknown[]) => Promise<T>;
    $executeRaw: (query: TemplateStringsArray, ...params: unknown[]) => Promise<unknown>;
  } | null;
  getCompanyFromJwt: (request: FastifyRequest) => string;
  getTenantIdFromJwt: (request: FastifyRequest) => string;
  getUserFromJwt: (request: FastifyRequest) => { id: string; name: string };
  resolveAuthorizedSite: (request: FastifyRequest, siteId: string) => Promise<
    | { allowed: true; site: { id: string; tenantId: string; name: string; city: string | null; state: string | null; role: string } }
    | { allowed: false; statusCode: number; body: unknown }
  >;
  listAuthorizedSites: (request: FastifyRequest) => Promise<Array<{
    id: string;
    tenantId: string;
    name: string;
    city: string | null;
    state: string | null;
    role: string;
  }>>;
  randomUUID: () => string;
  ensureDomainTables: () => Promise<void>;
  recordAiPreparationEvent: (payload: Record<string, unknown>) => Promise<void>;
  buildRulePreparationContext: (payload: Record<string, unknown>) => unknown;
  z: any;
}

export const createRulesService = (deps: Deps) => {
  const repository = createRulesRepository(deps);

  const allowedReviewCategories = new Set([
    'nutrition',
    'management',
    'legal',
    'compliance',
    'operations',
    'PROTEIN',
    'SALAD',
    'SIDE_DISH',
    'RICE',
    'BEAN',
    'JUICE',
    'BEVERAGE',
    'DESSERT',
    'FRUIT',
    'EGG_REPLACEMENT',
    'BUFFET_FREE',
    'BUFFET_SPECIAL',
    'SPECIAL_DISH',
    'LIGHT_VEGAN_OPTION',
    'MONTHLY_INCIDENCE',
    'WEEKLY_PERIODICITY',
    'UNIT_SPECIFIC_RULE',
    'MEAL_TIME',
    'MEAL_VOLUME',
    'MENU_COMPOSITION',
  ]);

  const allowedReviewPeriodicities = new Set([
    'DAILY',
    'WEEKLY',
    'MONTHLY',
    'PER_SERVICE',
    'PER_MENU_CYCLE',
  ]);

  const validateRuleUpdatePayload = (payload: RuleUpdatePayload): RouteResult | null => {
    if (payload.category && !allowedReviewCategories.has(payload.category)) {
      return {
        statusCode: 400,
        body: { status: 'error', message: 'Categoria de regra invalida.' },
      };
    }

    if (payload.periodicity && !allowedReviewPeriodicities.has(payload.periodicity)) {
      return {
        statusCode: 400,
        body: { status: 'error', message: 'Periodicidade de regra invalida.' },
      };
    }

    return null;
  };

  const requireSiteAccess = async (request: FastifyRequest, siteId: string): Promise<RouteResult | null> => {
    const siteAccess = await deps.resolveAuthorizedSite(request, siteId);
    if (!siteAccess.allowed) {
      return {
        statusCode: siteAccess.statusCode,
        body: siteAccess.body,
      };
    }

    return null;
  };

  const reconcileContractStatusFromRules = async (tenantId: string, companyName: string, contractId: string) => {
    if (!deps.prisma) {
      return;
    }

    const rows = await deps.prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status
      FROM extracted_rules
      WHERE tenant_id = ${tenantId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
        AND contract_id = ${contractId}
    `;

    if (!rows.length) {
      await deps.prisma.$executeRaw`
        UPDATE contracts
        SET status = ${'rules_extracted'}
        WHERE id = ${contractId}
          AND tenant_id = ${tenantId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
      `;
      return;
    }

    const hasPending = rows.some((item) => item.status === 'pending');
    const allApproved = rows.every((item) => item.status === 'approved');

    const nextContractStatus = hasPending
      ? 'rules_extracted'
      : allApproved
        ? 'active'
        : 'rules_validated';

    await deps.prisma.$executeRaw`
      UPDATE contracts
      SET status = ${nextContractStatus}
      WHERE id = ${contractId}
        AND tenant_id = ${tenantId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
    `;
  };

  const createRule = async (
    request: FastifyRequest,
    payload: {
      contractId: string;
      title: string;
      description: string;
      category: string;
      sourceExcerpt?: string;
      sourcePage?: number;
      evidenceConfidence?: number;
      status: string;
    },
  ): Promise<RouteResult> => {
    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = deps.getTenantIdFromJwt(request);
    const actor = deps.getUserFromJwt(request);
    const ruleId = deps.randomUUID();

    if (!payload.sourceExcerpt?.trim() || !payload.sourcePage) {
      return {
        statusCode: 400,
        body: { status: 'error', message: 'Regra precisa de pagina e trecho de evidencia do contrato.' },
      };
    }

    if (!deps.prisma) {
      const contract = contractMemory.get(payload.contractId);
      if (!contract || contract.companyName !== companyName || contract.tenantId !== tenantId) {
        return {
          statusCode: 404,
          body: { status: 'error', message: 'Contrato nao encontrado para esta empresa.' },
        };
      }

      const accessDenied = await requireSiteAccess(request, contract.siteId);
      if (accessDenied) {
        return accessDenied;
      }

      const initialStatus = payload.status === 'approved' ? 'pending' : payload.status;
      const createdAt = new Date();
      const rule: MemoryRule = {
        id: ruleId,
        tenantId,
        siteId: contract.siteId,
        companyName,
        contractId: payload.contractId,
        title: payload.title,
        description: payload.description,
        category: payload.category,
        ruleType: null,
        periodicity: null,
        quantity: null,
        unitMeasure: null,
        calculationBasis: null,
        applicability: null,
        sourceExcerpt: payload.sourceExcerpt,
        sourceItem: null,
        sourcePage: payload.sourcePage,
        sourceBlockId: null,
        evidenceConfidence: payload.evidenceConfidence ?? null,
        status: initialStatus,
        createdAt,
        updatedAt: createdAt,
      };
      ruleMemory.set(ruleId, rule);
      void actor;

      return {
        statusCode: 201,
        body: {
          status: 'ok',
          rule: {
            id: rule.id,
            contractId: rule.contractId,
            title: rule.title,
            description: rule.description,
            category: rule.category,
            ruleType: rule.ruleType,
            periodicity: rule.periodicity,
            quantity: rule.quantity,
            unitMeasure: rule.unitMeasure,
            calculationBasis: rule.calculationBasis,
            applicability: rule.applicability,
            sourceExcerpt: rule.sourceExcerpt,
            sourceItem: rule.sourceItem,
            sourcePage: rule.sourcePage,
            sourceBlockId: rule.sourceBlockId,
            evidenceConfidence: rule.evidenceConfidence,
            status: rule.status,
            createdAt: rule.createdAt.toISOString(),
            updatedAt: rule.updatedAt.toISOString(),
          },
        },
      };
    }

    await deps.ensureDomainTables();

    const contractExists = await deps.prisma.$queryRaw<Array<{ id: string; site_id: string; tenant_id: string }>>`
      SELECT id, site_id, tenant_id
      FROM contracts
      WHERE id = ${payload.contractId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
        AND tenant_id = ${tenantId}
      LIMIT 1
    `;

    if (!contractExists.length) {
      return {
        statusCode: 404,
        body: { status: 'error', message: 'Contrato nao encontrado para esta empresa.' },
      };
    }

    const contract = contractExists[0];
    const accessDenied = await requireSiteAccess(request, contract.site_id);
    if (accessDenied) {
      return accessDenied;
    }

    const initialStatus = payload.status === 'approved' ? 'pending' : payload.status;

    await deps.prisma.$executeRaw`
      INSERT INTO extracted_rules (id, tenant_id, site_id, company_name, contract_id, title, description, category, source_excerpt, source_page, evidence_confidence, status, created_at, updated_at)
      VALUES (
        ${ruleId},
        ${contract.tenant_id},
        ${contract.site_id},
        ${companyName},
        ${payload.contractId},
        ${payload.title},
        ${payload.description},
        ${payload.category},
        ${payload.sourceExcerpt ?? null},
        ${payload.sourcePage ?? null},
        ${payload.evidenceConfidence ?? null},
        ${initialStatus},
        NOW(),
        NOW()
      )
    `;

    await reconcileContractStatusFromRules(tenantId, companyName, payload.contractId);

    const creationEventId = deps.randomUUID();
    await deps.prisma.$executeRaw`
      INSERT INTO rule_validation_events (
        id,
        tenant_id,
        site_id,
        company_name,
        rule_id,
        previous_status,
        next_status,
        note,
        actor_id,
        actor_name,
        created_at,
        updated_at
      )
      VALUES (
        ${creationEventId},
        ${contract.tenant_id},
        ${contract.site_id},
        ${companyName},
        ${ruleId},
        ${initialStatus},
        ${initialStatus},
        ${'Regra cadastrada no fluxo operacional.'},
        ${actor.id},
        ${actor.name},
        NOW(),
        NOW()
      )
    `;

    await deps.recordAiPreparationEvent({
      tenantId,
      companyName,
      moduleKey: 'rules',
      sourceKind: 'contract-rule-creation',
      providerKey: 'structured-ready',
      data: deps.buildRulePreparationContext({
        companyName,
        contractId: payload.contractId,
        title: payload.title,
        description: payload.description,
        category: payload.category,
        sourceExcerpt: payload.sourceExcerpt ?? null,
        sourcePage: payload.sourcePage ?? null,
        evidenceConfidence: payload.evidenceConfidence ?? null,
      }),
    });

    const rows = await deps.prisma.$queryRaw<
      Array<{
        id: string;
        contract_id: string;
        title: string;
        description: string;
        category: string;
        source_excerpt: string | null;
        source_page: number | null;
        evidence_confidence: number | null;
        status: string;
        created_at: Date;
      }>
    >`
      SELECT id, contract_id, title, description, category, source_excerpt, source_page, evidence_confidence, status, created_at
      FROM extracted_rules
      WHERE id = ${ruleId}
      LIMIT 1
    `;

    return {
      statusCode: 201,
      body: {
        status: 'ok',
        rule: {
          id: rows[0]?.id ?? ruleId,
          contractId: rows[0]?.contract_id ?? payload.contractId,
          title: rows[0]?.title ?? payload.title,
          description: rows[0]?.description ?? payload.description,
          category: rows[0]?.category ?? payload.category,
          sourceExcerpt: rows[0]?.source_excerpt ?? payload.sourceExcerpt ?? null,
          sourcePage: rows[0]?.source_page ?? payload.sourcePage ?? null,
          evidenceConfidence: rows[0]?.evidence_confidence ?? payload.evidenceConfidence ?? null,
          status: rows[0]?.status ?? initialStatus,
          createdAt: (rows[0]?.created_at ?? new Date()).toISOString(),
        },
      },
    };
  };

  const updateRuleStatus = async (
    request: FastifyRequest,
    params: { ruleId: string },
    payload: { status: string; note?: string | null },
  ): Promise<RouteResult> => {
    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = deps.getTenantIdFromJwt(request);
    const actor = deps.getUserFromJwt(request);
    const statusNote = payload.note?.trim() ?? null;

    if (payload.status === 'rejected' && !statusNote) {
      return {
        statusCode: 400,
        body: { status: 'error', message: 'Informe o motivo da rejeicao da regra.' },
      };
    }

    if (!deps.prisma) {
      const existingRule = ruleMemory.get(params.ruleId);
      if (!existingRule || existingRule.companyName !== companyName || existingRule.tenantId !== tenantId) {
        return {
          statusCode: 404,
          body: { status: 'error', message: 'Regra nao encontrada para esta empresa.' },
        };
      }

      const accessDenied = await requireSiteAccess(request, existingRule.siteId);
      if (accessDenied) {
        return accessDenied;
      }

      if (payload.status === 'approved' && (!existingRule.sourceExcerpt || !existingRule.sourcePage)) {
        return {
          statusCode: 409,
          body: { status: 'error', message: 'Regra sem evidencia nao pode ser aprovada.' },
        };
      }

      existingRule.status = payload.status;
      ruleMemory.set(existingRule.id, existingRule);
      void actor;

      return {
        statusCode: 200,
        body: {
          status: 'ok',
          message: 'Status da regra atualizado com rastreabilidade.',
        },
      };
    }

    await deps.ensureDomainTables();

    const existingRows = await deps.prisma.$queryRaw<Array<{
      id: string;
      status: string;
      contract_id: string;
      site_id: string;
      tenant_id: string;
      source_excerpt: string | null;
      source_page: number | null;
    }>>`
      SELECT id, status, contract_id, site_id, tenant_id, source_excerpt, source_page
      FROM extracted_rules
      WHERE id = ${params.ruleId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
        AND tenant_id = ${tenantId}
      LIMIT 1
    `;

    const existingRule = existingRows[0];

    if (!existingRule) {
      return {
        statusCode: 404,
        body: { status: 'error', message: 'Regra nao encontrada para esta empresa.' },
      };
    }

    const accessDenied = await requireSiteAccess(request, existingRule.site_id);
    if (accessDenied) {
      return accessDenied;
    }

    if (payload.status === 'approved' && (!existingRule.source_excerpt || !existingRule.source_page)) {
      return {
        statusCode: 409,
        body: { status: 'error', message: 'Regra sem evidencia nao pode ser aprovada.' },
      };
    }

    const previousStatus = existingRule.status;
    const nextStatus = payload.status;

    await deps.prisma.$executeRaw`
      UPDATE extracted_rules
      SET status = ${nextStatus}
      WHERE id = ${params.ruleId}
        AND tenant_id = ${tenantId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
    `;

    const eventId = deps.randomUUID();
    await deps.prisma.$executeRaw`
      INSERT INTO rule_validation_events (
        id,
        tenant_id,
        site_id,
        company_name,
        rule_id,
        previous_status,
        next_status,
        note,
        actor_id,
        actor_name,
        created_at,
        updated_at
      )
      VALUES (
        ${eventId},
        ${existingRule.tenant_id},
        ${existingRule.site_id},
        ${companyName},
        ${params.ruleId},
        ${previousStatus},
        ${nextStatus},
        ${statusNote},
        ${actor.id},
        ${actor.name},
        NOW(),
        NOW()
      )
    `;

    await reconcileContractStatusFromRules(existingRule.tenant_id, companyName, existingRule.contract_id);

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        message: 'Status da regra atualizado com rastreabilidade.',
      },
    };
  };

  const updateRule = async (
    request: FastifyRequest,
    params: { ruleId: string },
    payload: RuleUpdatePayload,
  ): Promise<RouteResult> => {
    const validationError = validateRuleUpdatePayload(payload);
    if (validationError) {
      return validationError;
    }

    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = deps.getTenantIdFromJwt(request);
    const actor = deps.getUserFromJwt(request);

    if (!deps.prisma) {
      const existingRule = ruleMemory.get(params.ruleId);
      if (!existingRule || existingRule.companyName !== companyName || existingRule.tenantId !== tenantId) {
        return {
          statusCode: 404,
          body: { status: 'error', message: 'Regra nao encontrada para esta empresa.' },
        };
      }

      const accessDenied = await requireSiteAccess(request, existingRule.siteId);
      if (accessDenied) {
        return accessDenied;
      }

      if (existingRule.status !== 'pending') {
        return {
          statusCode: 409,
          body: { status: 'error', message: 'Apenas regras pendentes podem ser editadas.' },
        };
      }

      if (!existingRule.sourceExcerpt?.trim() || !existingRule.sourcePage) {
        return {
          statusCode: 409,
          body: { status: 'error', message: 'Regra sem evidencia nao pode ser editada.' },
        };
      }

      const updatedAt = new Date();
      const updatedRule: MemoryRule = {
        ...existingRule,
        title: payload.title ?? existingRule.title,
        description: payload.description ?? existingRule.description,
        category: payload.category ?? existingRule.category,
        ruleType: payload.ruleType === undefined ? existingRule.ruleType : payload.ruleType,
        periodicity: payload.periodicity === undefined ? existingRule.periodicity : payload.periodicity,
        quantity: payload.quantity === undefined ? existingRule.quantity : payload.quantity,
        unitMeasure: payload.unitMeasure === undefined ? existingRule.unitMeasure : payload.unitMeasure,
        calculationBasis: payload.calculationBasis === undefined ? existingRule.calculationBasis : payload.calculationBasis,
        applicability: payload.applicability === undefined ? existingRule.applicability : payload.applicability,
        updatedAt,
      };
      ruleMemory.set(existingRule.id, updatedRule);
      void actor;

      return {
        statusCode: 200,
        body: {
          status: 'ok',
          rule: {
            id: updatedRule.id,
            tenantId: updatedRule.tenantId,
            siteId: updatedRule.siteId,
            contractId: updatedRule.contractId,
            title: updatedRule.title,
            description: updatedRule.description,
            category: updatedRule.category,
            ruleType: updatedRule.ruleType,
            periodicity: updatedRule.periodicity,
            quantity: updatedRule.quantity,
            unitMeasure: updatedRule.unitMeasure,
            calculationBasis: updatedRule.calculationBasis,
            applicability: updatedRule.applicability,
            sourcePage: updatedRule.sourcePage,
            sourceItem: updatedRule.sourceItem,
            sourceExcerpt: updatedRule.sourceExcerpt,
            evidenceConfidence: updatedRule.evidenceConfidence,
            sourceBlockId: updatedRule.sourceBlockId,
            status: updatedRule.status,
            createdAt: updatedRule.createdAt.toISOString(),
            updatedAt: updatedRule.updatedAt.toISOString(),
          },
        },
      };
    }

    await deps.ensureDomainTables();

    const existingRows = await deps.prisma.$queryRaw<Array<{
      id: string;
      tenant_id: string;
      site_id: string;
      contract_id: string;
      title: string;
      description: string;
      category: string;
      rule_type: string | null;
      periodicity: string | null;
      quantity: number | null;
      unit_measure: string | null;
      calculation_basis: string | null;
      applicability: string | null;
      source_page: number | null;
      source_item: string | null;
      source_excerpt: string | null;
      evidence_confidence: number | null;
      source_block_id: string | null;
      status: string;
      created_at: Date;
      updated_at: Date;
    }>>`
      SELECT
        id,
        tenant_id,
        site_id,
        contract_id,
        title,
        description,
        category,
        rule_type,
        periodicity,
        quantity,
        unit_measure,
        calculation_basis,
        applicability,
        source_page,
        source_item,
        source_excerpt,
        evidence_confidence,
        source_block_id,
        status,
        created_at,
        updated_at
      FROM extracted_rules
      WHERE id = ${params.ruleId}
        AND tenant_id = ${tenantId}
        AND company_name = ${companyName}
      LIMIT 1
    `;

    const existingRule = existingRows[0];
    if (!existingRule) {
      return {
        statusCode: 404,
        body: { status: 'error', message: 'Regra nao encontrada para esta empresa.' },
      };
    }

    const accessDenied = await requireSiteAccess(request, existingRule.site_id);
    if (accessDenied) {
      return accessDenied;
    }

    if (existingRule.status !== 'pending') {
      return {
        statusCode: 409,
        body: { status: 'error', message: 'Apenas regras pendentes podem ser editadas.' },
      };
    }

    if (!existingRule.source_excerpt?.trim() || !existingRule.source_page) {
      return {
        statusCode: 409,
        body: { status: 'error', message: 'Regra sem evidencia nao pode ser editada.' },
      };
    }

    const nextRule = {
      title: payload.title ?? existingRule.title,
      description: payload.description ?? existingRule.description,
      category: payload.category ?? existingRule.category,
      ruleType: payload.ruleType === undefined ? existingRule.rule_type : payload.ruleType,
      periodicity: payload.periodicity === undefined ? existingRule.periodicity : payload.periodicity,
      quantity: payload.quantity === undefined ? existingRule.quantity : payload.quantity,
      unitMeasure: payload.unitMeasure === undefined ? existingRule.unit_measure : payload.unitMeasure,
      calculationBasis: payload.calculationBasis === undefined ? existingRule.calculation_basis : payload.calculationBasis,
      applicability: payload.applicability === undefined ? existingRule.applicability : payload.applicability,
    };

    await deps.prisma.$executeRaw`
      UPDATE extracted_rules
      SET title = ${nextRule.title},
          description = ${nextRule.description},
          category = ${nextRule.category},
          rule_type = ${nextRule.ruleType},
          periodicity = ${nextRule.periodicity},
          quantity = ${nextRule.quantity},
          unit_measure = ${nextRule.unitMeasure},
          calculation_basis = ${nextRule.calculationBasis},
          applicability = ${nextRule.applicability},
          updated_at = NOW()
      WHERE id = ${params.ruleId}
        AND tenant_id = ${tenantId}
        AND company_name = ${companyName}
    `;

    const eventId = deps.randomUUID();
    await deps.prisma.$executeRaw`
      INSERT INTO rule_validation_events (
        id,
        tenant_id,
        site_id,
        company_name,
        rule_id,
        previous_status,
        next_status,
        note,
        actor_id,
        actor_name,
        created_at,
        updated_at
      )
      VALUES (
        ${eventId},
        ${existingRule.tenant_id},
        ${existingRule.site_id},
        ${companyName},
        ${params.ruleId},
        ${existingRule.status},
        ${existingRule.status},
        ${'Regra editada antes da aprovacao humana.'},
        ${actor.id},
        ${actor.name},
        NOW(),
        NOW()
      )
    `;

    const updatedRows = await deps.prisma.$queryRaw<Array<typeof existingRule>>`
      SELECT
        id,
        tenant_id,
        site_id,
        contract_id,
        title,
        description,
        category,
        rule_type,
        periodicity,
        quantity,
        unit_measure,
        calculation_basis,
        applicability,
        source_page,
        source_item,
        source_excerpt,
        evidence_confidence,
        source_block_id,
        status,
        created_at,
        updated_at
      FROM extracted_rules
      WHERE id = ${params.ruleId}
        AND tenant_id = ${tenantId}
        AND company_name = ${companyName}
      LIMIT 1
    `;

    const updatedRule = updatedRows[0] ?? existingRule;

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        rule: {
          id: updatedRule.id,
          tenantId: updatedRule.tenant_id,
          siteId: updatedRule.site_id,
          contractId: updatedRule.contract_id,
          title: updatedRule.title,
          description: updatedRule.description,
          category: updatedRule.category,
          ruleType: updatedRule.rule_type,
          periodicity: updatedRule.periodicity,
          quantity: updatedRule.quantity,
          unitMeasure: updatedRule.unit_measure,
          calculationBasis: updatedRule.calculation_basis,
          applicability: updatedRule.applicability,
          sourcePage: updatedRule.source_page,
          sourceItem: updatedRule.source_item,
          sourceExcerpt: updatedRule.source_excerpt,
          evidenceConfidence: updatedRule.evidence_confidence,
          sourceBlockId: updatedRule.source_block_id,
          status: updatedRule.status,
          createdAt: updatedRule.created_at.toISOString(),
          updatedAt: updatedRule.updated_at.toISOString(),
        },
      },
    };
  };

  const promoteRuleToControl = async (
    request: FastifyRequest,
    params: { ruleId: string },
    payload: PromoteRuleToControlPayload,
  ): Promise<RouteResult> => {
    const companyName = deps.getCompanyFromJwt(request);
    const actor = deps.getUserFromJwt(request);
    const tenantId = deps.getTenantIdFromJwt(request);

    if (!deps.prisma) {
      const rule = ruleMemory.get(params.ruleId);
      if (!rule || rule.companyName !== companyName || rule.tenantId !== tenantId) {
        return {
          statusCode: 404,
          body: { status: 'error', message: 'Regra nao encontrada para esta empresa.' },
        };
      }

      const accessDenied = await requireSiteAccess(request, rule.siteId);
      if (accessDenied) {
        return accessDenied;
      }

      if (rule.status !== 'approved') {
        return {
          statusCode: 409,
          body: { status: 'error', message: 'Apenas regras aprovadas podem virar controles.' },
        };
      }

      const existingControl = Array.from(controlMemory.values()).find(
        (control) =>
          control.companyName === companyName
          && control.tenantId === tenantId
          && control.contractRuleId === params.ruleId
          && control.siteId === rule.siteId,
      );

      if (existingControl) {
        return {
          statusCode: 409,
          body: {
            status: 'error',
            message: 'Esta regra aprovada ja foi transformada em controle.',
            controlId: existingControl.id,
          },
        };
      }

      const controlId = deps.randomUUID();
      const activatedAt = payload.status === 'ACTIVE' ? new Date() : null;
      const createdAt = new Date();
      const control = {
        id: controlId,
        tenantId,
        siteId: rule.siteId,
        companyName,
        contractId: rule.contractId,
        contractRuleId: params.ruleId,
        title: payload.title?.trim() || rule.title,
        operationalDescription: payload.operationalDescription,
        frequency: payload.frequency,
        responsible: payload.responsible,
        expectedEvidence: payload.expectedEvidence,
        status: payload.status,
        activatedAt,
        deactivatedAt: null,
        createdBy: actor.id,
        createdAt,
      };
      controlMemory.set(controlId, control);

      return {
        statusCode: 201,
        body: {
          status: 'ok',
          control: {
            id: control.id,
            contractId: control.contractId,
            contractRuleId: control.contractRuleId,
            title: control.title,
            operationalDescription: control.operationalDescription,
            frequency: control.frequency,
            responsible: control.responsible,
            expectedEvidence: control.expectedEvidence,
            status: control.status,
            activatedAt: control.activatedAt?.toISOString() ?? null,
            deactivatedAt: control.deactivatedAt,
            createdBy: control.createdBy,
            createdAt: control.createdAt.toISOString(),
          },
        },
      };
    }

    await deps.ensureDomainTables();

    const ruleRows = await deps.prisma.$queryRaw<Array<{
      id: string;
      contract_id: string;
      site_id: string;
      title: string;
      status: string;
      source_excerpt: string | null;
      source_page: number | null;
    }>>`
      SELECT id, contract_id, site_id, title, status, source_excerpt, source_page
      FROM extracted_rules
      WHERE id = ${params.ruleId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
        AND tenant_id = ${tenantId}
      LIMIT 1
    `;

    const rule = ruleRows[0];

    if (!rule) {
      return {
        statusCode: 404,
        body: { status: 'error', message: 'Regra nao encontrada para esta empresa.' },
      };
    }

    const accessDenied = await requireSiteAccess(request, rule.site_id);
    if (accessDenied) {
      return accessDenied;
    }

    if (rule.status !== 'approved') {
      return {
        statusCode: 409,
        body: { status: 'error', message: 'Apenas regras aprovadas podem virar controles.' },
      };
    }

    const existingControlRows = await deps.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM compliance_controls
      WHERE tenant_id = ${tenantId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
        AND contract_rule_id = ${params.ruleId}
        AND site_id = ${rule.site_id}
      LIMIT 1
    `;

    if (existingControlRows[0]) {
      return {
        statusCode: 409,
        body: {
          status: 'error',
          message: 'Esta regra aprovada ja foi transformada em controle.',
          controlId: existingControlRows[0].id,
        },
      };
    }

    const controlId = deps.randomUUID();
    const activatedAt = payload.status === 'ACTIVE' ? new Date() : null;

    await deps.prisma.$executeRaw`
      INSERT INTO compliance_controls (
        id,
        tenant_id,
        site_id,
        company_name,
        contract_id,
        contract_rule_id,
        title,
        operational_description,
        frequency,
        responsible,
        expected_evidence,
        status,
        activated_at,
        created_by,
        created_at,
        updated_at
      )
      VALUES (
        ${controlId},
        ${tenantId},
        ${rule.site_id},
        ${companyName},
        ${rule.contract_id},
        ${params.ruleId},
        ${payload.title?.trim() || rule.title},
        ${payload.operationalDescription},
        ${payload.frequency},
        ${payload.responsible},
        ${payload.expectedEvidence},
        ${payload.status},
        ${activatedAt},
        ${actor.id},
        NOW(),
        NOW()
      )
    `;

    if (rule.source_excerpt || rule.source_page) {
      const evidenceReferenceId = deps.randomUUID();

      await deps.prisma.$executeRaw`
        INSERT INTO evidence_references (
          id,
          tenant_id,
          company_name,
          entity_type,
          entity_id,
          rule_id,
          control_id,
          source_type,
          page,
          excerpt,
          created_by,
          created_at,
          updated_at
        )
        VALUES (
          ${evidenceReferenceId},
          ${tenantId},
          ${companyName},
          ${'CONTROL'},
          ${controlId},
          ${params.ruleId},
          ${controlId},
          ${'CONTRACT'},
          ${rule.source_page ?? null},
          ${rule.source_excerpt ?? null},
          ${actor.id},
          NOW(),
          NOW()
        )
      `;
    }

    const eventId = deps.randomUUID();
    await deps.prisma.$executeRaw`
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
        ${tenantId},
        ${companyName},
        ${controlId},
        ${payload.status},
        ${payload.status},
        ${'Controle criado a partir de regra aprovada.'},
        ${actor.id},
        ${actor.name},
        NOW(),
        NOW()
      )
    `;

    const controlRows = await deps.prisma.$queryRaw<Array<{
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
    }>>`
      SELECT
        id,
        contract_id,
        contract_rule_id,
        title,
        operational_description,
        frequency,
        responsible,
        expected_evidence,
        status,
        activated_at,
        deactivated_at,
        created_by,
        created_at
      FROM compliance_controls
      WHERE id = ${controlId}
      LIMIT 1
    `;

    const control = controlRows[0];

    return {
      statusCode: 201,
      body: {
        status: 'ok',
        control: {
          id: control?.id ?? controlId,
          contractId: control?.contract_id ?? rule.contract_id,
          contractRuleId: control?.contract_rule_id ?? params.ruleId,
          title: control?.title ?? payload.title?.trim() ?? rule.title,
          operationalDescription: control?.operational_description ?? payload.operationalDescription,
          frequency: control?.frequency ?? payload.frequency,
          responsible: control?.responsible ?? payload.responsible,
          expectedEvidence: control?.expected_evidence ?? payload.expectedEvidence,
          status: control?.status ?? payload.status,
          activatedAt: control?.activated_at?.toISOString() ?? activatedAt?.toISOString() ?? null,
          deactivatedAt: control?.deactivated_at?.toISOString() ?? null,
          createdBy: control?.created_by ?? actor.id,
          createdAt: (control?.created_at ?? new Date()).toISOString(),
        },
      },
    };
  };

  const getRuleHistory = async (
    request: FastifyRequest,
    params: { ruleId: string },
  ): Promise<RouteResult> => {
    if (!deps.prisma) {
      return {
        statusCode: 503,
        body: { status: 'error', message: deps.apiMessage.health.dbUnavailable },
      };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = deps.getTenantIdFromJwt(request);

    await deps.ensureDomainTables();

    const ruleRows = await deps.prisma.$queryRaw<Array<{ site_id: string }>>`
      SELECT site_id
      FROM extracted_rules
      WHERE id = ${params.ruleId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
        AND tenant_id = ${tenantId}
      LIMIT 1
    `;

    if (!ruleRows[0]) {
      return {
        statusCode: 404,
        body: { status: 'error', message: 'Regra nao encontrada para esta empresa.' },
      };
    }

    const accessDenied = await requireSiteAccess(request, ruleRows[0].site_id);
    if (accessDenied) {
      return accessDenied;
    }

    const events = await deps.prisma.$queryRaw<
      Array<{
        id: string;
        previous_status: string;
        next_status: string;
        note: string | null;
        actor_name: string;
        created_at: Date;
      }>
    >`
      SELECT id, previous_status, next_status, note, actor_name, created_at
      FROM rule_validation_events
      WHERE tenant_id = ${tenantId}
        AND company_name = ${companyName}
        AND rule_id = ${params.ruleId}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        events: events.map((event) => ({
          id: event.id,
          previousStatus: event.previous_status,
          nextStatus: event.next_status,
          note: event.note,
          actorName: event.actor_name,
          createdAt: event.created_at.toISOString(),
        })),
      },
    };
  };

  const getRuleEvidence = async (
    request: FastifyRequest,
    params: { ruleId: string },
  ): Promise<RouteResult> => {
    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = deps.getTenantIdFromJwt(request);

    if (!deps.prisma) {
      const rule = ruleMemory.get(params.ruleId);
      if (!rule || rule.companyName !== companyName || rule.tenantId !== tenantId) {
        return {
          statusCode: 404,
          body: { status: 'error', message: 'Regra nao encontrada para esta empresa.' },
        };
      }

      const accessDenied = await requireSiteAccess(request, rule.siteId);
      if (accessDenied) {
        return accessDenied;
      }

      return {
        statusCode: 200,
        body: {
          status: 'ok',
          evidence: {
            rule: {
              id: rule.id,
              sourcePage: rule.sourcePage,
              sourceItem: rule.sourceItem,
              sourceExcerpt: rule.sourceExcerpt,
              evidenceConfidence: rule.evidenceConfidence,
              sourceBlockId: rule.sourceBlockId,
            },
            block: null,
            page: null,
          },
        },
      };
    }

    await deps.ensureDomainTables();

    const rows = await deps.prisma.$queryRaw<Array<{
      id: string;
      site_id: string;
      contract_id: string;
      source_page: number | null;
      source_item: string | null;
      source_excerpt: string | null;
      evidence_confidence: number | null;
      source_block_id: string | null;
      block_type: string | null;
      block_page_number: number | null;
      block_source_item: string | null;
      raw_text: string | null;
      normalized_text: string | null;
      normalized_table_markdown: string | null;
      normalized_table_json: string | null;
      detected_units_json: string | null;
      page_number: number | null;
      page_raw_text: string | null;
      text_quality: string | null;
    }>>`
      SELECT
        rule.id,
        rule.site_id,
        rule.contract_id,
        rule.source_page,
        rule.source_item,
        rule.source_excerpt,
        rule.evidence_confidence,
        rule.source_block_id,
        block.block_type,
        block.page_number AS block_page_number,
        block.source_item AS block_source_item,
        block.raw_text,
        block.normalized_text,
        block.normalized_table_markdown,
        block.normalized_table_json,
        block.detected_units_json,
        page.page_number,
        page.raw_text AS page_raw_text,
        page.text_quality
      FROM extracted_rules rule
      LEFT JOIN contract_blocks block
        ON block.id = rule.source_block_id
       AND block.tenant_id = rule.tenant_id
       AND block.contract_id = rule.contract_id
       AND block.site_id IS NOT DISTINCT FROM rule.site_id
      LEFT JOIN contract_pages page
        ON page.id = block.contract_page_id
       AND page.tenant_id = rule.tenant_id
       AND page.contract_id = rule.contract_id
       AND page.site_id IS NOT DISTINCT FROM rule.site_id
      WHERE rule.id = ${params.ruleId}
        AND rule.tenant_id = ${tenantId}
        AND rule.company_name = ${companyName}
      LIMIT 1
    `;

    const evidence = rows[0];
    if (!evidence) {
      return {
        statusCode: 404,
        body: { status: 'error', message: 'Regra nao encontrada para esta empresa.' },
      };
    }

    const accessDenied = await requireSiteAccess(request, evidence.site_id);
    if (accessDenied) {
      return accessDenied;
    }

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        evidence: {
          rule: {
            id: evidence.id,
            contractId: evidence.contract_id,
            sourcePage: evidence.source_page,
            sourceItem: evidence.source_item,
            sourceExcerpt: evidence.source_excerpt,
            evidenceConfidence: evidence.evidence_confidence,
            sourceBlockId: evidence.source_block_id,
          },
          block: evidence.source_block_id
            ? {
              id: evidence.source_block_id,
              blockType: evidence.block_type,
              pageNumber: evidence.block_page_number,
              sourceItem: evidence.block_source_item,
              rawText: evidence.raw_text,
              normalizedText: evidence.normalized_text,
              normalizedTableMarkdown: evidence.normalized_table_markdown,
              normalizedTableJson: evidence.normalized_table_json,
              detectedUnitsJson: evidence.detected_units_json,
            }
            : null,
          page: evidence.page_number
            ? {
              pageNumber: evidence.page_number,
              rawText: evidence.page_raw_text,
              textQuality: evidence.text_quality,
            }
            : null,
        },
      },
    };
  };

  const deleteRule = async (
    request: FastifyRequest,
    params: { ruleId: string },
  ): Promise<RouteResult> => {
    if (!deps.prisma) {
      return {
        statusCode: 503,
        body: { status: 'error', message: deps.apiMessage.health.dbUnavailable },
      };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = deps.getTenantIdFromJwt(request);

    await deps.ensureDomainTables();

    const existingRows = await deps.prisma.$queryRaw<Array<{ id: string; contract_id: string; site_id: string }>>`
      SELECT id, contract_id, site_id
      FROM extracted_rules
      WHERE id = ${params.ruleId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
        AND tenant_id = ${tenantId}
      LIMIT 1
    `;

    if (!existingRows[0]) {
      return {
        statusCode: 404,
        body: { status: 'error', message: 'Regra nao encontrada para esta empresa.' },
      };
    }

    const accessDenied = await requireSiteAccess(request, existingRows[0].site_id);
    if (accessDenied) {
      return accessDenied;
    }

    await deps.prisma.$executeRaw`
      DELETE FROM rule_validation_events
      WHERE rule_id = ${params.ruleId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
        AND tenant_id = ${tenantId}
    `;

    await deps.prisma.$executeRaw`
      DELETE FROM extracted_rules
      WHERE id = ${params.ruleId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
        AND tenant_id = ${tenantId}
    `;

    await reconcileContractStatusFromRules(tenantId, companyName, existingRows[0].contract_id);

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        message: 'Regra excluida com sucesso.',
      },
    };
  };

  const listRules = async (
    request: FastifyRequest,
    query: { limit: number; status?: string; category?: string; contractId?: string; siteId?: string },
  ): Promise<RouteResult> => {
    if (!deps.prisma) {
      const companyName = deps.getCompanyFromJwt(request);
      const tenantId = deps.getTenantIdFromJwt(request);
      const authorizedSiteIds = query.siteId ? [query.siteId] : [];

      if (query.siteId) {
        const accessDenied = await requireSiteAccess(request, query.siteId);
        if (accessDenied) {
          return accessDenied;
        }
      } else if (query.contractId) {
        const contract = contractMemory.get(query.contractId);
        if (!contract || contract.companyName !== companyName || contract.tenantId !== tenantId) {
          return {
            statusCode: 404,
            body: { status: 'error', message: 'Contrato nao encontrado para esta empresa.' },
          };
        }

        const accessDenied = await requireSiteAccess(request, contract.siteId);
        if (accessDenied) {
          return accessDenied;
        }

        authorizedSiteIds.push(contract.siteId);
      } else {
        const sites = await deps.listAuthorizedSites(request);
        authorizedSiteIds.push(...sites.map((site) => site.id));
      }

      const rules = Array.from(ruleMemory.values())
        .filter((item) => item.companyName === companyName)
        .filter((item) => item.tenantId === tenantId)
        .filter((item) => authorizedSiteIds.length === 0 || authorizedSiteIds.includes(item.siteId))
        .filter((item) => !query.contractId || item.contractId === query.contractId)
        .filter((item) => !query.status || item.status === query.status)
        .filter((item) => !query.category || item.category === query.category)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, query.limit);

      return {
        statusCode: 200,
        body: {
          status: 'ok',
          rules: rules.map((item) => ({
            id: item.id,
            tenantId: item.tenantId,
            siteId: item.siteId,
            siteName: null,
            contractId: item.contractId,
            title: item.title,
            description: item.description,
            category: item.category,
            ruleType: item.ruleType,
            periodicity: item.periodicity,
            quantity: item.quantity,
            unitMeasure: item.unitMeasure,
            calculationBasis: item.calculationBasis,
            applicability: item.applicability,
            sourceExcerpt: item.sourceExcerpt,
            sourceItem: item.sourceItem,
            sourcePage: item.sourcePage,
            sourceBlockId: item.sourceBlockId,
            evidenceConfidence: item.evidenceConfidence,
            status: item.status,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
          })),
        },
      };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = deps.getTenantIdFromJwt(request);

    await deps.ensureDomainTables();

    const authorizedSiteIds = query.siteId ? [query.siteId] : [];
    if (query.siteId) {
      const accessDenied = await requireSiteAccess(request, query.siteId);
      if (accessDenied) {
        return accessDenied;
      }
    } else if (query.contractId) {
      const contractRows = await deps.prisma.$queryRaw<Array<{ site_id: string }>>`
        SELECT site_id
        FROM contracts
        WHERE id = ${query.contractId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
          AND tenant_id = ${tenantId}
        LIMIT 1
      `;

      if (!contractRows[0]) {
        return {
          statusCode: 404,
          body: { status: 'error', message: 'Contrato nao encontrado para esta empresa.' },
        };
      }

      const accessDenied = await requireSiteAccess(request, contractRows[0].site_id);
      if (accessDenied) {
        return accessDenied;
      }

      authorizedSiteIds.push(contractRows[0].site_id);
    } else {
      const sites = await deps.listAuthorizedSites(request);
      authorizedSiteIds.push(...sites.map((site) => site.id));
    }

    if (!authorizedSiteIds.length) {
      return {
        statusCode: 200,
        body: { status: 'ok', rules: [] },
      };
    }

    type RuleRow = {
      id: string;
      tenant_id: string;
      site_id: string;
      site_name: string | null;
      contract_id: string;
      title: string;
      description: string;
      category: string;
      rule_type: string | null;
      periodicity: string | null;
      quantity: number | null;
      unit_measure: string | null;
      calculation_basis: string | null;
      applicability: string | null;
      source_excerpt: string | null;
      source_item: string | null;
      source_page: number | null;
      source_block_id: string | null;
      evidence_confidence: number | null;
      status: string;
      created_at: Date;
      updated_at: Date;
    };

    const rules = await deps.prisma.$queryRaw<Array<RuleRow>>`
      SELECT
        rule.id,
        rule.tenant_id,
        rule.site_id,
        site.name AS site_name,
        rule.contract_id,
        rule.title,
        rule.description,
        rule.category,
        rule.rule_type,
        rule.periodicity,
        rule.quantity,
        rule.unit_measure,
        rule.calculation_basis,
        rule.applicability,
        rule.source_excerpt,
        rule.source_item,
        rule.source_page,
        rule.source_block_id,
        rule.evidence_confidence,
        rule.status,
        rule.created_at,
        rule.updated_at
      FROM extracted_rules rule
      LEFT JOIN sites site
        ON site.id = rule.site_id
       AND site.tenant_id = rule.tenant_id
      WHERE rule.tenant_id = ${tenantId}
        AND rule.company_name = ${companyName}
        AND rule.site_id = ANY(${authorizedSiteIds}::text[])
        AND (${query.contractId ?? null}::text IS NULL OR rule.contract_id = ${query.contractId ?? null})
        AND (${query.status ?? null}::text IS NULL OR rule.status = ${query.status ?? null})
        AND (${query.category ?? null}::text IS NULL OR rule.category = ${query.category ?? null})
      ORDER BY rule.created_at DESC
      LIMIT ${query.limit}
    `;

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        rules: rules.map((item) => ({
          id: item.id,
          tenantId: item.tenant_id,
          siteId: item.site_id,
          siteName: item.site_name,
          contractId: item.contract_id,
          title: item.title,
          description: item.description,
          category: item.category,
          ruleType: item.rule_type,
          periodicity: item.periodicity,
          quantity: item.quantity,
          unitMeasure: item.unit_measure,
          calculationBasis: item.calculation_basis,
          applicability: item.applicability,
          sourceExcerpt: item.source_excerpt,
          sourceItem: item.source_item,
          sourcePage: item.source_page,
          sourceBlockId: item.source_block_id,
          evidenceConfidence: item.evidence_confidence,
          status: item.status,
          createdAt: item.created_at.toISOString(),
          updatedAt: item.updated_at.toISOString(),
        })),
      },
    };
  };

  return {
    repository,
    apiMessage: deps.apiMessage,
    authenticate: deps.authenticate,
    ruleSchema: deps.ruleSchema,
    ruleParamsSchema: deps.ruleParamsSchema,
    ruleStatusUpdateSchema: deps.ruleStatusUpdateSchema,
    z: deps.z,
    createRule,
    updateRule,
    updateRuleStatus,
    promoteRuleToControl,
    getRuleHistory,
    getRuleEvidence,
    deleteRule,
    listRules,
  };
};
