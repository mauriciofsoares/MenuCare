import { createEvaluationsRepository } from './repository.js';
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
  evaluationImportSchema: SchemaLike<{
    fileName: string;
    unitName: string;
    serviceName: string;
    referenceDate: string;
    score: number;
    evaluationsCount: number;
    comments?: string;
  }>;
  evaluationImportListQuerySchema: SchemaLike<{ limit: number }>;
  intelligenceListQuerySchema: SchemaLike<{ limit: number }>;
  prisma: {
    $queryRaw: <T>(query: TemplateStringsArray, ...params: unknown[]) => Promise<T>;
    $executeRaw: (query: TemplateStringsArray, ...params: unknown[]) => Promise<unknown>;
  } | null;
  getCompanyFromJwt: (request: FastifyRequest) => string;
  ensureDomainTables: () => Promise<void>;
  randomUUID: () => string;
}

export const createEvaluationsService = (deps: Deps) => {
  const repository = createEvaluationsRepository(deps);

  const parseNumber = (value: number | string) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number(parsed.toFixed(2));
  };

  const importEvaluation = async (
    request: FastifyRequest,
    payload: {
      fileName: string;
      unitName: string;
      serviceName: string;
      referenceDate: string;
      score: number;
      evaluationsCount: number;
      comments?: string;
    },
  ): Promise<RouteResult> => {
    if (!deps.prisma) {
      return { statusCode: 503, body: { status: 'error', message: deps.apiMessage.health.dbUnavailable } };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';
    const evaluationId = deps.randomUUID();

    await deps.ensureDomainTables();

    await deps.prisma.$executeRaw`
      INSERT INTO menu_evaluation_imports (
        id,
        tenant_id,
        company_name,
        file_name,
        unit_name,
        service_name,
        reference_date,
        score,
        evaluations_count,
        comments
      )
      VALUES (
        ${evaluationId},
        ${tenantId},
        ${companyName},
        ${payload.fileName.trim()},
        ${payload.unitName.trim()},
        ${payload.serviceName.trim()},
        CAST(${payload.referenceDate} AS date),
        ${payload.score},
        ${payload.evaluationsCount},
        ${payload.comments?.trim() || null}
      )
    `;

    return {
      statusCode: 201,
      body: {
        status: 'ok',
        evaluation: {
          id: evaluationId,
          fileName: payload.fileName.trim(),
          unitName: payload.unitName.trim(),
          serviceName: payload.serviceName.trim(),
          referenceDate: new Date(payload.referenceDate).toISOString(),
          score: Number(payload.score.toFixed(2)),
          evaluationsCount: payload.evaluationsCount,
          comments: payload.comments?.trim() || null,
          createdAt: new Date().toISOString(),
        },
      },
    };
  };

  const listEvaluationImports = async (
    request: FastifyRequest,
    query: { limit: number },
  ): Promise<RouteResult> => {
    if (!deps.prisma) {
      return { statusCode: 503, body: { status: 'error', message: deps.apiMessage.health.dbUnavailable } };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';
    await deps.ensureDomainTables();

    const rows = await deps.prisma.$queryRaw<
      Array<{
        id: string;
        file_name: string;
        unit_name: string;
        service_name: string;
        reference_date: Date;
        score: number | string;
        evaluations_count: number;
        comments: string | null;
        created_at: Date;
      }>
    >`
      SELECT
        id,
        file_name,
        unit_name,
        service_name,
        reference_date,
        score,
        evaluations_count,
        comments,
        created_at
      FROM menu_evaluation_imports
      WHERE tenant_id = ${tenantId}
        AND company_name = ${companyName}
      ORDER BY created_at DESC
      LIMIT ${query.limit}
    `;

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        evaluations: rows.map((item) => ({
          id: item.id,
          fileName: item.file_name,
          unitName: item.unit_name,
          serviceName: item.service_name,
          referenceDate: item.reference_date.toISOString(),
          score: parseNumber(item.score),
          evaluationsCount: item.evaluations_count,
          comments: item.comments,
          createdAt: item.created_at.toISOString(),
        })),
      },
    };
  };

  const rebuildIntelligence = async (request: FastifyRequest): Promise<RouteResult> => {
    if (!deps.prisma) {
      return { statusCode: 503, body: { status: 'error', message: deps.apiMessage.health.dbUnavailable } };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';

    await deps.ensureDomainTables();

    const rows = await deps.prisma.$queryRaw<
      Array<{
        unit_name: string;
        service_name: string;
        reference_date: Date;
        score: number | string;
        evaluations_count: number;
        menu_import_id: string | null;
        recipes_json: string | null;
      }>
    >`
      SELECT
        eval.unit_name,
        eval.service_name,
        eval.reference_date,
        eval.score,
        eval.evaluations_count,
        menu.id AS menu_import_id,
        menu.recipes_json
      FROM menu_evaluation_imports eval
      LEFT JOIN menu_pdf_imports menu
        ON menu.tenant_id = eval.tenant_id
        AND menu.company_name = eval.company_name
        AND menu.unit_name = eval.unit_name
        AND menu.service_name = eval.service_name
        AND menu.reference_date = eval.reference_date
      WHERE eval.tenant_id = ${tenantId}
        AND eval.company_name = ${companyName}
      ORDER BY eval.reference_date DESC
    `;

    await deps.prisma.$executeRaw`
      DELETE FROM menu_combination_intelligence
      WHERE tenant_id = ${tenantId}
        AND company_name = ${companyName}
    `;

    const grouped = new Map<string, {
      recipesJson: string;
      unitName: string;
      serviceName: string;
      scoreWeightedSum: number;
      evaluationsCount: number;
      mappedRecords: number;
      lastReferenceDate: Date;
    }>();

    for (const item of rows) {
      if (!item.menu_import_id || !item.recipes_json) {
        continue;
      }

      const key = `${item.unit_name}::${item.service_name}::${item.recipes_json}`;
      const score = parseNumber(item.score);
      const evalCount = item.evaluations_count;
      const current = grouped.get(key);

      if (!current) {
        grouped.set(key, {
          recipesJson: item.recipes_json,
          unitName: item.unit_name,
          serviceName: item.service_name,
          scoreWeightedSum: score * evalCount,
          evaluationsCount: evalCount,
          mappedRecords: 1,
          lastReferenceDate: item.reference_date,
        });
        continue;
      }

      current.scoreWeightedSum += score * evalCount;
      current.evaluationsCount += evalCount;
      current.mappedRecords += 1;
      if (item.reference_date > current.lastReferenceDate) {
        current.lastReferenceDate = item.reference_date;
      }
    }

    let generatedCombinations = 0;

    for (const [combinationKey, aggregate] of grouped.entries()) {
      const averageRating = Number((aggregate.scoreWeightedSum / aggregate.evaluationsCount).toFixed(2));
      const trend = averageRating >= 8 ? 'positive' : averageRating >= 6 ? 'stable' : 'negative';

      await deps.prisma.$executeRaw`
        INSERT INTO menu_combination_intelligence (
          id,
          tenant_id,
          company_name,
          combination_key,
          recipes_json,
          unit_name,
          service_name,
          average_rating,
          evaluations_count,
          mapped_records,
          last_reference_date,
          trend
        )
        VALUES (
          ${deps.randomUUID()},
          ${tenantId},
          ${companyName},
          ${combinationKey},
          ${aggregate.recipesJson},
          ${aggregate.unitName},
          ${aggregate.serviceName},
          ${averageRating},
          ${aggregate.evaluationsCount},
          ${aggregate.mappedRecords},
          CAST(${aggregate.lastReferenceDate.toISOString().slice(0, 10)} AS date),
          ${trend}
        )
      `;

      generatedCombinations += 1;
    }

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        summary: {
          processedEvaluationRows: rows.length,
          generatedCombinations,
        },
      },
    };
  };

  const listIntelligence = async (
    request: FastifyRequest,
    query: { limit: number },
  ): Promise<RouteResult> => {
    if (!deps.prisma) {
      return { statusCode: 503, body: { status: 'error', message: deps.apiMessage.health.dbUnavailable } };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';
    await deps.ensureDomainTables();

    const rows = await deps.prisma.$queryRaw<
      Array<{
        id: string;
        combination_key: string;
        recipes_json: string;
        unit_name: string;
        service_name: string;
        average_rating: number | string;
        evaluations_count: number;
        mapped_records: number;
        last_reference_date: Date;
        trend: 'positive' | 'stable' | 'negative';
        created_at: Date;
      }>
    >`
      SELECT
        id,
        combination_key,
        recipes_json,
        unit_name,
        service_name,
        average_rating,
        evaluations_count,
        mapped_records,
        last_reference_date,
        trend,
        created_at
      FROM menu_combination_intelligence
      WHERE tenant_id = ${tenantId}
        AND company_name = ${companyName}
      ORDER BY average_rating DESC, evaluations_count DESC
      LIMIT ${query.limit}
    `;

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        combinations: rows.map((item) => ({
          id: item.id,
          combinationKey: item.combination_key,
          recipes: JSON.parse(item.recipes_json) as string[],
          unitName: item.unit_name,
          serviceName: item.service_name,
          averageRating: parseNumber(item.average_rating),
          evaluationsCount: item.evaluations_count,
          mappedRecords: item.mapped_records,
          lastReferenceDate: item.last_reference_date.toISOString(),
          trend: item.trend,
          createdAt: item.created_at.toISOString(),
        })),
      },
    };
  };

  return {
    repository,
    apiMessage: deps.apiMessage,
    authenticate: deps.authenticate,
    evaluationImportSchema: deps.evaluationImportSchema,
    evaluationImportListQuerySchema: deps.evaluationImportListQuerySchema,
    intelligenceListQuerySchema: deps.intelligenceListQuerySchema,
    importEvaluation,
    listEvaluationImports,
    rebuildIntelligence,
    listIntelligence,
  };
};
