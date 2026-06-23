import { createEvaluationsRepository } from './repository.js';
import type { FastifyRequest } from 'fastify';
import { menuImportMemory } from '../menus/service.js';

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

type MemoryEvaluationImport = {
  id: string;
  tenantId: string;
  companyName: string;
  fileName: string;
  unitName: string;
  serviceName: string;
  referenceDate: string;
  score: number;
  evaluationsCount: number;
  comments: string | null;
  createdAt: Date;
};

type MemoryCombinationIntelligence = {
  id: string;
  tenantId: string;
  companyName: string;
  combinationKey: string;
  recipes: string[];
  unitName: string;
  serviceName: string;
  averageRating: number;
  evaluationsCount: number;
  mappedRecords: number;
  lastReferenceDate: string;
  trend: 'positive' | 'stable' | 'negative';
  createdAt: Date;
};

const evaluationImportMemory = new Map<string, MemoryEvaluationImport>();
const combinationIntelligenceMemory = new Map<string, MemoryCombinationIntelligence>();

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
      const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';
      const companyName = deps.getCompanyFromJwt(request);
      const evaluationId = deps.randomUUID();
      const createdAt = new Date();

      evaluationImportMemory.set(evaluationId, {
        id: evaluationId,
        tenantId,
        companyName,
        fileName: payload.fileName.trim(),
        unitName: payload.unitName.trim(),
        serviceName: payload.serviceName.trim(),
        referenceDate: payload.referenceDate,
        score: Number(payload.score.toFixed(2)),
        evaluationsCount: payload.evaluationsCount,
        comments: payload.comments?.trim() || null,
        createdAt,
      });

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
            createdAt: createdAt.toISOString(),
          },
        },
      };
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
        comments,
        created_at,
        updated_at
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
        ${payload.comments?.trim() || null},
        NOW(),
        NOW()
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
      const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';
      const companyName = deps.getCompanyFromJwt(request);

      const evaluations = Array.from(evaluationImportMemory.values())
        .filter((item) => item.tenantId === tenantId && item.companyName === companyName)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, query.limit)
        .map((item) => ({
          id: item.id,
          fileName: item.fileName,
          unitName: item.unitName,
          serviceName: item.serviceName,
          referenceDate: new Date(item.referenceDate).toISOString(),
          score: Number(item.score.toFixed(2)),
          evaluationsCount: item.evaluationsCount,
          comments: item.comments,
          createdAt: item.createdAt.toISOString(),
        }));

      return {
        statusCode: 200,
        body: {
          status: 'ok',
          evaluations,
        },
      };
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
      const companyName = deps.getCompanyFromJwt(request);
      const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';

      for (const [id, item] of combinationIntelligenceMemory.entries()) {
        if (item.tenantId === tenantId && item.companyName === companyName) {
          combinationIntelligenceMemory.delete(id);
        }
      }

      const evalRows = Array.from(evaluationImportMemory.values())
        .filter((item) => item.tenantId === tenantId && item.companyName === companyName);

      const grouped = new Map<string, {
        recipes: string[];
        unitName: string;
        serviceName: string;
        scoreWeightedSum: number;
        evaluationsCount: number;
        mappedRecords: number;
        lastReferenceDate: string;
      }>();

      for (const row of evalRows) {
        const menuMatch = Array.from(menuImportMemory.values()).find(
          (menu) =>
            menu.tenantId === tenantId
            && menu.companyName === companyName
            && menu.unitName === row.unitName
            && menu.serviceName === row.serviceName
            && menu.referenceDate === row.referenceDate,
        );

        if (!menuMatch || !menuMatch.recipes.length) {
          continue;
        }

        const recipes = [...menuMatch.recipes];
        const key = `${row.unitName}::${row.serviceName}::${JSON.stringify(recipes)}`;
        const current = grouped.get(key);

        if (!current) {
          grouped.set(key, {
            recipes,
            unitName: row.unitName,
            serviceName: row.serviceName,
            scoreWeightedSum: row.score * row.evaluationsCount,
            evaluationsCount: row.evaluationsCount,
            mappedRecords: 1,
            lastReferenceDate: row.referenceDate,
          });
          continue;
        }

        current.scoreWeightedSum += row.score * row.evaluationsCount;
        current.evaluationsCount += row.evaluationsCount;
        current.mappedRecords += 1;
        if (row.referenceDate > current.lastReferenceDate) {
          current.lastReferenceDate = row.referenceDate;
        }
      }

      let generatedCombinations = 0;

      for (const [combinationKey, aggregate] of grouped.entries()) {
        const averageRating = Number((aggregate.scoreWeightedSum / aggregate.evaluationsCount).toFixed(2));
        const trend = averageRating >= 8 ? 'positive' : averageRating >= 6 ? 'stable' : 'negative';
        const id = deps.randomUUID();

        combinationIntelligenceMemory.set(id, {
          id,
          tenantId,
          companyName,
          combinationKey,
          recipes: aggregate.recipes,
          unitName: aggregate.unitName,
          serviceName: aggregate.serviceName,
          averageRating,
          evaluationsCount: aggregate.evaluationsCount,
          mappedRecords: aggregate.mappedRecords,
          lastReferenceDate: aggregate.lastReferenceDate,
          trend,
          createdAt: new Date(),
        });
        generatedCombinations += 1;
      }

      return {
        statusCode: 200,
        body: {
          status: 'ok',
          summary: {
            processedEvaluationRows: evalRows.length,
            generatedCombinations,
          },
        },
      };
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
            trend,
            created_at,
            updated_at
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
            ${trend},
            NOW(),
            NOW()
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
      const companyName = deps.getCompanyFromJwt(request);
      const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';

      const combinations = Array.from(combinationIntelligenceMemory.values())
        .filter((item) => item.tenantId === tenantId && item.companyName === companyName)
        .sort((a, b) => {
          if (b.averageRating !== a.averageRating) {
            return b.averageRating - a.averageRating;
          }
          return b.evaluationsCount - a.evaluationsCount;
        })
        .slice(0, query.limit)
        .map((item) => ({
          id: item.id,
          combinationKey: item.combinationKey,
          recipes: item.recipes,
          unitName: item.unitName,
          serviceName: item.serviceName,
          averageRating: Number(item.averageRating.toFixed(2)),
          evaluationsCount: item.evaluationsCount,
          mappedRecords: item.mappedRecords,
          lastReferenceDate: new Date(item.lastReferenceDate).toISOString(),
          trend: item.trend,
          createdAt: item.createdAt.toISOString(),
        }));

      return {
        statusCode: 200,
        body: {
          status: 'ok',
          combinations,
        },
      };
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
