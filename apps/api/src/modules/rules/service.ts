import { createRulesRepository } from './repository.js';
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

type PromoteRuleToControlPayload = {
  title?: string;
  operationalDescription: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'per_shift' | 'on_demand';
  responsible: string;
  expectedEvidence: string;
  status: 'DRAFT' | 'ACTIVE';
};

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

  const reconcileContractStatusFromRules = async (companyName: string, contractId: string) => {
    if (!deps.prisma) {
      return;
    }

    const rows = await deps.prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status
      FROM extracted_rules
      WHERE company_name = ${companyName}
        AND contract_id = ${contractId}
    `;

    if (!rows.length) {
      await deps.prisma.$executeRaw`
        UPDATE contracts
        SET status = ${'rules_extracted'}
        WHERE id = ${contractId}
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
    if (!deps.prisma) {
      return {
        statusCode: 503,
        body: { status: 'error', message: deps.apiMessage.health.dbUnavailable },
      };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = deps.getTenantIdFromJwt(request);
    const actor = deps.getUserFromJwt(request);
    const ruleId = deps.randomUUID();

    await deps.ensureDomainTables();

    if (!payload.sourceExcerpt?.trim() || !payload.sourcePage) {
      return {
        statusCode: 400,
        body: { status: 'error', message: 'Regra precisa de pagina e trecho de evidencia do contrato.' },
      };
    }

    const contractExists = await deps.prisma.$queryRaw<Array<{ id: string; site_id: string; tenant_id: string }>>`
      SELECT id, site_id, tenant_id
      FROM contracts
      WHERE id = ${payload.contractId}
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
      INSERT INTO extracted_rules (id, tenant_id, site_id, company_name, contract_id, title, description, category, source_excerpt, source_page, evidence_confidence, status)
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
        ${initialStatus}
      )
    `;

    await reconcileContractStatusFromRules(companyName, payload.contractId);

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
        actor_name
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
        ${actor.name}
      )
    `;

    await deps.recordAiPreparationEvent({
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
    if (!deps.prisma) {
      return {
        statusCode: 503,
        body: { status: 'error', message: deps.apiMessage.health.dbUnavailable },
      };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = deps.getTenantIdFromJwt(request);
    const actor = deps.getUserFromJwt(request);

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
        actor_name
      )
      VALUES (
        ${eventId},
        ${existingRule.tenant_id},
        ${existingRule.site_id},
        ${companyName},
        ${params.ruleId},
        ${previousStatus},
        ${nextStatus},
        ${payload.note ?? null},
        ${actor.id},
        ${actor.name}
      )
    `;

    await reconcileContractStatusFromRules(companyName, existingRule.contract_id);

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        message: 'Status da regra atualizado com rastreabilidade.',
      },
    };
  };

  const promoteRuleToControl = async (
    request: FastifyRequest,
    params: { ruleId: string },
    payload: PromoteRuleToControlPayload,
  ): Promise<RouteResult> => {
    if (!deps.prisma) {
      return {
        statusCode: 503,
        body: { status: 'error', message: deps.apiMessage.health.dbUnavailable },
      };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const actor = deps.getUserFromJwt(request);
    const tenantId = deps.getTenantIdFromJwt(request);

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
      WHERE company_name = ${companyName}
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
        created_by
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
        ${actor.id}
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
          created_by
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
          ${actor.id}
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
        actor_name
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
        ${actor.name}
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
      WHERE company_name = ${companyName}
        AND tenant_id = ${tenantId}
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
        AND company_name = ${companyName}
        AND tenant_id = ${tenantId}
    `;

    await deps.prisma.$executeRaw`
      DELETE FROM extracted_rules
      WHERE id = ${params.ruleId}
        AND company_name = ${companyName}
        AND tenant_id = ${tenantId}
    `;

    await reconcileContractStatusFromRules(companyName, existingRows[0].contract_id);

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
    query: { limit: number; status?: string; contractId?: string; siteId?: string },
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
      site_id: string;
      contract_id: string;
      title: string;
      description: string;
      category: string;
      source_excerpt: string | null;
      source_page: number | null;
      evidence_confidence: number | null;
      status: string;
      created_at: Date;
    };

    const rules = query.contractId && query.status
      ? await deps.prisma.$queryRaw<Array<RuleRow>>`
          SELECT id, site_id, contract_id, title, description, category, source_excerpt, source_page, evidence_confidence, status, created_at
          FROM extracted_rules
          WHERE company_name = ${companyName}
            AND tenant_id = ${tenantId}
            AND site_id = ANY(${authorizedSiteIds}::text[])
            AND contract_id = ${query.contractId}
            AND status = ${query.status}
          ORDER BY created_at DESC
          LIMIT ${query.limit}
        `
      : query.contractId
        ? await deps.prisma.$queryRaw<Array<RuleRow>>`
            SELECT id, site_id, contract_id, title, description, category, source_excerpt, source_page, evidence_confidence, status, created_at
            FROM extracted_rules
            WHERE company_name = ${companyName}
              AND tenant_id = ${tenantId}
              AND site_id = ANY(${authorizedSiteIds}::text[])
              AND contract_id = ${query.contractId}
            ORDER BY created_at DESC
            LIMIT ${query.limit}
          `
        : query.status
          ? await deps.prisma.$queryRaw<Array<RuleRow>>`
              SELECT id, site_id, contract_id, title, description, category, source_excerpt, source_page, evidence_confidence, status, created_at
              FROM extracted_rules
              WHERE company_name = ${companyName}
                AND tenant_id = ${tenantId}
                AND site_id = ANY(${authorizedSiteIds}::text[])
                AND status = ${query.status}
              ORDER BY created_at DESC
              LIMIT ${query.limit}
            `
          : await deps.prisma.$queryRaw<Array<RuleRow>>`
              SELECT id, site_id, contract_id, title, description, category, source_excerpt, source_page, evidence_confidence, status, created_at
              FROM extracted_rules
              WHERE company_name = ${companyName}
                AND tenant_id = ${tenantId}
                AND site_id = ANY(${authorizedSiteIds}::text[])
              ORDER BY created_at DESC
              LIMIT ${query.limit}
            `;

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        rules: rules.map((item) => ({
          id: item.id,
          siteId: item.site_id,
          contractId: item.contract_id,
          title: item.title,
          description: item.description,
          category: item.category,
          sourceExcerpt: item.source_excerpt,
          sourcePage: item.source_page,
          evidenceConfidence: item.evidence_confidence,
          status: item.status,
          createdAt: item.created_at.toISOString(),
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
    updateRuleStatus,
    promoteRuleToControl,
    getRuleHistory,
    deleteRule,
    listRules,
  };
};
