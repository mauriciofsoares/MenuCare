import { createRecipesRepository } from './repository.js';
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

export type MemoryRecipe = {
  id: string;
  tenantId: string;
  companyName: string;
  sourceFileName: string;
  sourceReference: string | null;
  name: string;
  normalizedName: string;
  category: string;
  subcategory: string;
  foodGroup: string;
  costPerCapita: number | null;
  servingYield: number | null;
  preparationMethod: string | null;
  nutritionalInfo: unknown;
  compatibleDiets: string[];
  allergens: string[];
  aiClassification: unknown;
  aiProvider: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export const recipeMemory = new Map<string, MemoryRecipe>();

export interface Deps {
  apiMessage: { health: { dbUnavailable: string } };
  authenticate: any;
  recipeImportSchema: SchemaLike<{
    fileName: string;
    sourceReference?: string;
    recipes: Array<{
      name: string;
      ingredients: string[];
      preparationMethod?: string;
      perCapita?: number;
      yield?: number;
      group?: string;
      nutritionalInfo?: unknown;
      compatibleDiets?: string[];
      allergens?: string[];
      cost?: number;
    }>;
  }>;
  recipeParamsSchema: SchemaLike<{ recipeId: string }>;
  recipeClassificationUpdateSchema: SchemaLike<{
    category: string;
    subcategory: string;
    foodGroup: string;
    confidence?: number;
    tags?: string[];
    reason?: string;
  }>;
  prisma: {
    $queryRaw: <T>(query: TemplateStringsArray, ...params: unknown[]) => Promise<T>;
    $executeRaw: (query: TemplateStringsArray, ...params: unknown[]) => Promise<unknown>;
  } | null;
  getCompanyFromJwt: (request: FastifyRequest) => string;
  getUserFromJwt: (request: FastifyRequest) => { id: string; name: string };
  ensureDomainTables: () => Promise<void>;
  buildRecipeImportContext: (payload: Record<string, unknown>) => any;
  recordAiPreparationEvent: (...args: any[]) => Promise<void>;
  classifyRecipeFromText: (name: string, ingredients: string[]) => {
    category: string;
    subcategory: string;
    foodGroup: string;
    confidence: number;
  };
  normalizeTerm: (value: string) => string;
  randomUUID: () => string;
  z: any;
}

export const createRecipesService = (deps: Deps) => {
  const repository = createRecipesRepository(deps);

  const parseNumber = (value: number | string | null) => {
    if (value === null) {
      return null;
    }

    const parsed = typeof value === 'number' ? value : Number(value);
    return Number(parsed.toFixed(2));
  };

  const toInt = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) {
      return 0;
    }

    return typeof value === 'number' ? value : Number(value);
  };

  const extractClassification = (rawValue: string) => {
    try {
      const parsed = JSON.parse(rawValue) as unknown;

      if (parsed && typeof parsed === 'object' && 'classification' in parsed) {
        const wrapped = (parsed as { classification?: unknown }).classification;

        if (wrapped && typeof wrapped === 'object') {
          return wrapped as {
            category?: string;
            subcategory?: string;
            foodGroup?: string;
            confidence?: number;
            tags?: string[];
          };
        }
      }

      if (parsed && typeof parsed === 'object') {
        return parsed as {
          category?: string;
          subcategory?: string;
          foodGroup?: string;
          confidence?: number;
          tags?: string[];
        };
      }
    } catch {
      return null;
    }

    return null;
  };

  const importRecipes = async (
    request: FastifyRequest,
    payload: {
      fileName: string;
      sourceReference?: string;
      recipes: Array<{
        name: string;
        ingredients: string[];
        preparationMethod?: string;
        yield?: number;
        nutritionalInfo?: unknown;
        compatibleDiets?: string[];
        allergens?: string[];
        cost?: number;
      }>;
    },
  ): Promise<RouteResult> => {
    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';
    const actor = deps.getUserFromJwt(request);

    const aiContext = deps.buildRecipeImportContext({
      companyName,
      sourceFileName: payload.fileName.trim(),
      recipes: payload.recipes.map((recipe) => ({
        name: recipe.name.trim(),
        ingredients: recipe.ingredients,
        preparationMethod: recipe.preparationMethod ?? null,
        perCapita: null,
        yield: recipe.yield ?? null,
        group: null,
        nutritionalInfo: recipe.nutritionalInfo ?? null,
        compatibleDiets: recipe.compatibleDiets ?? [],
        allergens: recipe.allergens ?? [],
        cost: recipe.cost ?? null,
      })),
    });

    if (!deps.prisma) {
      const importEventId = deps.randomUUID();
      const importedItems = payload.recipes.map((recipe) => {
        const classification = deps.classifyRecipeFromText(recipe.name, recipe.ingredients);
        const recipeId = deps.randomUUID();
        const now = new Date();
        const memoryRecipe: MemoryRecipe = {
          id: recipeId,
          tenantId,
          companyName,
          sourceFileName: payload.fileName.trim(),
          sourceReference: payload.sourceReference?.trim() || null,
          name: recipe.name.trim(),
          normalizedName: deps.normalizeTerm(recipe.name),
          category: classification.category,
          subcategory: classification.subcategory,
          foodGroup: classification.foodGroup,
          costPerCapita: recipe.cost ?? null,
          servingYield: recipe.yield ?? null,
          preparationMethod: recipe.preparationMethod ?? null,
          nutritionalInfo: recipe.nutritionalInfo ?? null,
          compatibleDiets: recipe.compatibleDiets ?? [],
          allergens: recipe.allergens ?? [],
          aiClassification: { classification, source: 'heuristic-ready' },
          aiProvider: 'heuristic-ready',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        recipeMemory.set(recipeId, memoryRecipe);

        return {
          id: recipeId,
          name: memoryRecipe.name,
          category: classification.category,
          subcategory: classification.subcategory,
          foodGroup: classification.foodGroup,
          confidence: classification.confidence,
        };
      });

      void actor;

      return {
        statusCode: 201,
        body: {
          status: 'ok',
          recipeImport: {
            id: importEventId,
            fileName: payload.fileName.trim(),
            sourceReference: payload.sourceReference?.trim() || null,
            importedCount: importedItems.length,
            classifiedCount: importedItems.length,
            recipes: importedItems,
            createdAt: new Date().toISOString(),
            aiPreparation: aiContext,
          },
        },
      };
    }

    await deps.ensureDomainTables();

    await deps.recordAiPreparationEvent({
      tenantId,
      companyName,
      moduleKey: 'recipes',
      sourceKind: 'pdf-import',
      providerKey: 'structured-ready',
      data: aiContext,
    });

    const importEventId = deps.randomUUID();
    const importedItems: Array<{
      id: string;
      name: string;
      category: string;
      subcategory: string;
      foodGroup: string;
      confidence: number;
    }> = [];

    for (const recipe of payload.recipes) {
      const classification = deps.classifyRecipeFromText(recipe.name, recipe.ingredients);
      const normalizedName = deps.normalizeTerm(recipe.name);
      const recipeId = deps.randomUUID();

      const persistedRecipeRows = await deps.prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO recipe_library_items (
          id,
          tenant_id,
          company_name,
          source_file_name,
          source_reference,
          name,
          normalized_name,
          category,
          subcategory,
          food_group,
          cost_per_capita,
          serving_yield,
          preparation_method,
          nutritional_info_json,
          compatible_diets_json,
          allergens_json,
          ai_classification_json,
          ai_provider,
          is_active,
          created_at,
          updated_at
        )
        VALUES (
          ${recipeId},
          ${tenantId},
          ${companyName},
          ${payload.fileName.trim()},
          ${payload.sourceReference?.trim() || null},
          ${recipe.name.trim()},
          ${normalizedName},
          ${classification.category},
          ${classification.subcategory},
          ${classification.foodGroup},
          ${recipe.cost ?? null},
          ${recipe.yield ?? null},
          ${recipe.preparationMethod ?? null},
          ${JSON.stringify(recipe.nutritionalInfo ?? null)},
          ${JSON.stringify(recipe.compatibleDiets ?? [])},
          ${JSON.stringify(recipe.allergens ?? [])},
          ${JSON.stringify({ classification, source: 'heuristic-ready' })},
          ${'heuristic-ready'},
          TRUE,
          NOW(),
          NOW()
        )
        ON CONFLICT (tenant_id, normalized_name)
        DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          source_file_name = EXCLUDED.source_file_name,
          source_reference = EXCLUDED.source_reference,
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          subcategory = EXCLUDED.subcategory,
          food_group = EXCLUDED.food_group,
          cost_per_capita = EXCLUDED.cost_per_capita,
          serving_yield = EXCLUDED.serving_yield,
          preparation_method = EXCLUDED.preparation_method,
          nutritional_info_json = EXCLUDED.nutritional_info_json,
          compatible_diets_json = EXCLUDED.compatible_diets_json,
          allergens_json = EXCLUDED.allergens_json,
          ai_classification_json = EXCLUDED.ai_classification_json,
          ai_provider = EXCLUDED.ai_provider,
          is_active = TRUE,
          updated_at = NOW()
        RETURNING id
      `;

      const persistedRecipeId = persistedRecipeRows[0]?.id ?? recipeId;

      for (const ingredientName of recipe.ingredients) {
        const normalizedIngredientName = deps.normalizeTerm(ingredientName);
        const ingredientId = deps.randomUUID();

        const ingredientRows = await deps.prisma.$queryRaw<Array<{ id: string }>>`
          INSERT INTO recipe_ingredients (
            id,
            tenant_id,
            company_name,
            name,
            normalized_name,
            ingredient_group,
            created_at,
            updated_at
          )
          VALUES (
            ${ingredientId},
            ${tenantId},
            ${companyName},
            ${ingredientName.trim()},
            ${normalizedIngredientName},
            ${classification.foodGroup},
            NOW(),
            NOW()
          )
          ON CONFLICT (tenant_id, normalized_name)
          DO UPDATE SET
            tenant_id = EXCLUDED.tenant_id,
            name = EXCLUDED.name,
            ingredient_group = EXCLUDED.ingredient_group,
            updated_at = NOW()
          RETURNING id
        `;

        const linkedIngredientId = ingredientRows[0]?.id ?? ingredientId;

        await deps.prisma.$executeRaw`
          INSERT INTO recipe_item_ingredients (
            id,
            tenant_id,
            company_name,
            recipe_id,
            ingredient_id,
            quantity,
            unit,
            created_at,
            updated_at
          )
          VALUES (
            ${deps.randomUUID()},
            ${tenantId},
            ${companyName},
            ${persistedRecipeId},
            ${linkedIngredientId},
            ${null},
            ${null},
            NOW(),
            NOW()
          )
        `;
      }

      importedItems.push({
        id: persistedRecipeId,
        name: recipe.name.trim(),
        category: classification.category,
        subcategory: classification.subcategory,
        foodGroup: classification.foodGroup,
        confidence: classification.confidence,
      });
    }

    await deps.prisma.$executeRaw`
      INSERT INTO recipe_import_events (
        id,
        tenant_id,
        company_name,
        file_name,
        imported_count,
        classified_count,
        warnings_json,
        actor_id,
        actor_name,
        created_at,
        updated_at
      )
      VALUES (
        ${importEventId},
        ${tenantId},
        ${companyName},
        ${payload.fileName.trim()},
        ${payload.recipes.length},
        ${importedItems.length},
        ${JSON.stringify([])},
        ${actor.id},
        ${actor.name},
        NOW(),
        NOW()
      )
    `;

    return {
      statusCode: 201,
      body: {
        status: 'ok',
        recipeImport: {
          id: importEventId,
          fileName: payload.fileName.trim(),
          sourceReference: payload.sourceReference?.trim() || null,
          importedCount: importedItems.length,
          classifiedCount: importedItems.length,
          recipes: importedItems,
          createdAt: new Date().toISOString(),
          aiPreparation: aiContext,
        },
      },
    };
  };

  const listRecipes = async (
    request: FastifyRequest,
    query: {
      limit: number;
      category?: string;
      subcategory?: string;
      foodGroup?: string;
      active: 'all' | 'active' | 'inactive';
    },
  ): Promise<RouteResult> => {
    if (!deps.prisma) {
      const companyName = deps.getCompanyFromJwt(request);
      const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';
      const recipes = Array.from(recipeMemory.values())
        .filter((item) => item.companyName === companyName && item.tenantId === tenantId)
        .filter((item) => query.active === 'all' || (query.active === 'active' ? item.isActive : !item.isActive))
        .filter((item) => !query.category || item.category === query.category)
        .filter((item) => !query.subcategory || item.subcategory === query.subcategory)
        .filter((item) => !query.foodGroup || item.foodGroup === query.foodGroup)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, query.limit);

      return {
        statusCode: 200,
        body: {
          status: 'ok',
          recipes: recipes.map((item) => ({
            id: item.id,
            sourceFileName: item.sourceFileName,
            sourceReference: item.sourceReference,
            name: item.name,
            normalizedName: item.normalizedName,
            category: item.category,
            subcategory: item.subcategory,
            foodGroup: item.foodGroup,
            costPerCapita: item.costPerCapita,
            servingYield: item.servingYield,
            preparationMethod: item.preparationMethod,
            nutritionalInfo: item.nutritionalInfo,
            compatibleDiets: item.compatibleDiets,
            allergens: item.allergens,
            aiClassification: item.aiClassification,
            aiProvider: item.aiProvider,
            isActive: item.isActive,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
          })),
        },
      };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';

    await deps.ensureDomainTables();

    const rows = await deps.prisma.$queryRaw<
      Array<{
        id: string;
        source_file_name: string;
        source_reference: string | null;
        name: string;
        normalized_name: string;
        category: string;
        subcategory: string;
        food_group: string;
        cost_per_capita: number | string | null;
        serving_yield: number | string | null;
        preparation_method: string | null;
        nutritional_info_json: string | null;
        compatible_diets_json: string | null;
        allergens_json: string | null;
        ai_classification_json: string;
        ai_provider: string;
        is_active: boolean;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      SELECT
        id,
        source_file_name,
        source_reference,
        name,
        normalized_name,
        category,
        subcategory,
        food_group,
        cost_per_capita,
        serving_yield,
        preparation_method,
        nutritional_info_json,
        compatible_diets_json,
        allergens_json,
        ai_classification_json,
        ai_provider,
        is_active,
        created_at,
        updated_at
      FROM recipe_library_items
      WHERE tenant_id = ${tenantId}
        AND company_name = ${companyName}
        AND category = COALESCE(CAST(${query.category ?? null} AS text), category)
        AND subcategory = COALESCE(CAST(${query.subcategory ?? null} AS text), subcategory)
        AND food_group = COALESCE(CAST(${query.foodGroup ?? null} AS text), food_group)
        AND (
          ${query.active} = 'all'
          OR (${query.active} = 'active' AND is_active = TRUE)
          OR (${query.active} = 'inactive' AND is_active = FALSE)
        )
      ORDER BY created_at DESC
      LIMIT ${query.limit}
    `;

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        recipes: rows.map((item) => ({
          id: item.id,
          sourceFileName: item.source_file_name,
          sourceReference: item.source_reference,
          name: item.name,
          normalizedName: item.normalized_name,
          category: item.category,
          subcategory: item.subcategory,
          foodGroup: item.food_group,
          costPerCapita: parseNumber(item.cost_per_capita),
          servingYield: parseNumber(item.serving_yield),
          preparationMethod: item.preparation_method,
          nutritionalInfo: item.nutritional_info_json ? JSON.parse(item.nutritional_info_json) : null,
          compatibleDiets: item.compatible_diets_json ? JSON.parse(item.compatible_diets_json) as string[] : [],
          allergens: item.allergens_json ? JSON.parse(item.allergens_json) as string[] : [],
          aiClassification: JSON.parse(item.ai_classification_json),
          aiProvider: item.ai_provider,
          isActive: item.is_active,
          createdAt: item.created_at.toISOString(),
          updatedAt: item.updated_at.toISOString(),
        })),
      },
    };
  };

  const getCoverage = async (request: FastifyRequest): Promise<RouteResult> => {
    if (!deps.prisma) {
      const companyName = deps.getCompanyFromJwt(request);
      const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';
      const recipes = Array.from(recipeMemory.values())
        .filter((item) => item.companyName === companyName && item.tenantId === tenantId);
      const activeRecipes = recipes.filter((item) => item.isActive).length;
      const manualReviewedRecipes = recipes.filter((item) => item.aiProvider === 'manual-reviewed').length;
      const categoryDistribution = Array.from(
        recipes.reduce((acc, item) => acc.set(item.category, (acc.get(item.category) ?? 0) + 1), new Map<string, number>()),
      ).map(([category, total]) => ({ category, total }));

      return {
        statusCode: 200,
        body: {
          status: 'ok',
          coverage: {
            totalRecipes: recipes.length,
            activeRecipes,
            classifiedRecipes: recipes.length,
            manualReviewedRecipes,
            heuristicRecipes: Math.max(0, recipes.length - manualReviewedRecipes),
            coveragePercent: recipes.length > 0 ? 100 : 0,
            categoryDistribution,
          },
        },
      };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';

    await deps.ensureDomainTables();

    const summaryRows = await deps.prisma.$queryRaw<
      Array<{
        total_recipes: number | string;
        active_recipes: number | string;
        classified_recipes: number | string;
        manual_reviewed_recipes: number | string;
      }>
    >`
      SELECT
        COUNT(*) AS total_recipes,
        SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) AS active_recipes,
        SUM(CASE WHEN category <> 'Outros' AND subcategory <> 'Nao classificado' THEN 1 ELSE 0 END) AS classified_recipes,
        SUM(CASE WHEN ai_provider = 'manual-reviewed' THEN 1 ELSE 0 END) AS manual_reviewed_recipes
      FROM recipe_library_items
      WHERE tenant_id = ${tenantId}
        AND company_name = ${companyName}
    `;

    const categoryRows = await deps.prisma.$queryRaw<Array<{ category: string; total: number | string }>>`
      SELECT category, COUNT(*) AS total
      FROM recipe_library_items
      WHERE tenant_id = ${tenantId}
        AND company_name = ${companyName}
      GROUP BY category
      ORDER BY total DESC
      LIMIT 8
    `;

    const summary = summaryRows[0] ?? {
      total_recipes: 0,
      active_recipes: 0,
      classified_recipes: 0,
      manual_reviewed_recipes: 0,
    };

    const totalRecipes = toInt(summary.total_recipes);
    const activeRecipes = toInt(summary.active_recipes);
    const classifiedRecipes = toInt(summary.classified_recipes);
    const manualReviewedRecipes = toInt(summary.manual_reviewed_recipes);
    const heuristicRecipes = Math.max(0, totalRecipes - manualReviewedRecipes);
    const coveragePercent = totalRecipes > 0 ? Number(((classifiedRecipes / totalRecipes) * 100).toFixed(2)) : 0;

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        coverage: {
          totalRecipes,
          activeRecipes,
          classifiedRecipes,
          manualReviewedRecipes,
          heuristicRecipes,
          coveragePercent,
          categoryDistribution: categoryRows.map((item) => ({ category: item.category, total: toInt(item.total) })),
        },
      },
    };
  };

  const updateClassification = async (
    request: FastifyRequest,
    params: { recipeId: string },
    payload: {
      category: string;
      subcategory: string;
      foodGroup: string;
      confidence?: number;
      tags?: string[];
      reason?: string;
    },
  ): Promise<RouteResult> => {
    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = (request.user as { tenantId?: string }).tenantId ?? 'demo-tenant';
    const actor = deps.getUserFromJwt(request);

    if (!deps.prisma) {
      const recipe = recipeMemory.get(params.recipeId);

      if (!recipe || recipe.companyName !== companyName || recipe.tenantId !== tenantId) {
        return { statusCode: 404, body: { status: 'error', message: 'Receita nao encontrada para reclassificacao.' } };
      }

      const nextClassification = {
        category: payload.category,
        subcategory: payload.subcategory,
        foodGroup: payload.foodGroup,
        confidence: payload.confidence ?? 0,
        tags: payload.tags ?? [],
      };

      recipe.category = nextClassification.category;
      recipe.subcategory = nextClassification.subcategory;
      recipe.foodGroup = nextClassification.foodGroup;
      recipe.aiClassification = {
        classification: nextClassification,
        source: 'manual-reviewed',
        reason: payload.reason ?? null,
      };
      recipe.aiProvider = 'manual-reviewed';
      recipe.updatedAt = new Date();
      recipeMemory.set(recipe.id, recipe);
      void actor;

      return {
        statusCode: 200,
        body: {
          status: 'ok',
          recipe: {
            id: recipe.id,
            name: recipe.name,
            category: nextClassification.category,
            subcategory: nextClassification.subcategory,
            foodGroup: nextClassification.foodGroup,
            aiClassification: nextClassification,
            aiProvider: 'manual-reviewed',
          },
        },
      };
    }

    await deps.ensureDomainTables();

    const recipeRows = await deps.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        category: string;
        subcategory: string;
        food_group: string;
        ai_classification_json: string;
      }>
    >`
      SELECT id, name, category, subcategory, food_group, ai_classification_json
      FROM recipe_library_items
      WHERE id = ${params.recipeId}
        AND tenant_id = ${tenantId}
        AND company_name = ${companyName}
      LIMIT 1
    `;

    const recipe = recipeRows[0];

    if (!recipe) {
      return { statusCode: 404, body: { status: 'error', message: 'Receita nao encontrada para reclassificacao.' } };
    }

    const previousClassificationParsed = extractClassification(recipe.ai_classification_json);
    const previousClassification = {
      category: previousClassificationParsed?.category ?? recipe.category,
      subcategory: previousClassificationParsed?.subcategory ?? recipe.subcategory,
      foodGroup: previousClassificationParsed?.foodGroup ?? recipe.food_group,
      confidence: typeof previousClassificationParsed?.confidence === 'number' ? previousClassificationParsed.confidence : 0,
      tags: Array.isArray(previousClassificationParsed?.tags) ? previousClassificationParsed.tags : [],
    };

    const nextClassification = {
      category: payload.category,
      subcategory: payload.subcategory,
      foodGroup: payload.foodGroup,
      confidence: payload.confidence ?? previousClassification.confidence,
      tags: payload.tags ?? previousClassification.tags,
    };

    await deps.prisma.$executeRaw`
      UPDATE recipe_library_items
      SET
        category = ${nextClassification.category},
        subcategory = ${nextClassification.subcategory},
        food_group = ${nextClassification.foodGroup},
        ai_classification_json = ${JSON.stringify({
          classification: nextClassification,
          source: 'manual-reviewed',
          reason: payload.reason ?? null,
        })},
        ai_provider = ${'manual-reviewed'},
        updated_at = NOW()
      WHERE id = ${recipe.id}
        AND tenant_id = ${tenantId}
        AND company_name = ${companyName}
    `;

    await deps.prisma.$executeRaw`
      INSERT INTO recipe_classification_events (
        id,
        tenant_id,
        company_name,
        recipe_id,
        previous_classification_json,
        next_classification_json,
        reason,
        actor_id,
        actor_name,
        created_at,
        updated_at
      )
      VALUES (
        ${deps.randomUUID()},
        ${tenantId},
        ${companyName},
        ${recipe.id},
        ${JSON.stringify(previousClassification)},
        ${JSON.stringify(nextClassification)},
        ${payload.reason ?? null},
        ${actor.id},
        ${actor.name},
        NOW(),
        NOW()
      )
    `;

    await deps.recordAiPreparationEvent({
      tenantId,
      companyName,
      moduleKey: 'recipes',
      sourceKind: 'manual-reclassification',
      providerKey: 'manual-reviewed',
      data: {
        recipeId: recipe.id,
        recipeName: recipe.name,
        previousClassification,
        nextClassification,
        reason: payload.reason ?? null,
        actor,
      },
    });

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        recipe: {
          id: recipe.id,
          name: recipe.name,
          category: nextClassification.category,
          subcategory: nextClassification.subcategory,
          foodGroup: nextClassification.foodGroup,
          aiClassification: nextClassification,
          aiProvider: 'manual-reviewed',
        },
      },
    };
  };

  return {
    repository,
    apiMessage: deps.apiMessage,
    authenticate: deps.authenticate,
    recipeImportSchema: deps.recipeImportSchema,
    recipeParamsSchema: deps.recipeParamsSchema,
    recipeClassificationUpdateSchema: deps.recipeClassificationUpdateSchema,
    z: deps.z,
    importRecipes,
    listRecipes,
    getCoverage,
    updateClassification,
  };
};
