import type { FastifyInstance } from 'fastify';
import { createMenusRepository } from './repository.js';

export interface Deps {
  [key: string]: any;
}

export const createMenusService = (deps: Deps) => {
  const repository = createMenusRepository(deps);

  const registerRoutes = (app: FastifyInstance) => {
    const service = deps as any;
    const {
      z,
      PDFParse,
      apiMessage,
      authenticate,
      authSchema,
      consumeLoginAttempt,
      isLoginBlocked,
      demoUser,
      demoContext,
      demoPassword,
      prisma,
      readPasswordOverride,
      verifyPassword,
      issueAccessToken,
      getRefreshSessionDeviceContext,
      resolveAuthFlowId,
      setAuthFlowHeader,
      createRefreshSession,
      setRefreshTokenCookie,
      parseCookieHeader,
      refreshCookieName,
      readRefreshSession,
      revokeRefreshSession,
      clearRefreshTokenCookie,
      touchRefreshSession,
      getCompanyFromJwt,
      readOperationalProfile,
      operationalProfileSchema,
      saveOperationalProfile,
      inviteActivationSchema,
      ensureAuthTables,
      hashPassword,
      registerInviteAuditEvent,
      inviteCreationSchema,
      getUserFromJwt,
      inviteAuditQuerySchema,
      inviteListQuerySchema,
      inviteTokenParamSchema,
      localeByCompany,
      loginAttemptByKey,
      normalizeLocale,
      readLocaleFromDatabase,
      saveLocaleInDatabase,
      localeSchema,
      randomUUID,
      contractSchema,
      ensureDomainTables,
      buildRulePreparationContext,
      ruleSchema,
      ruleParamsSchema,
      ruleStatusUpdateSchema,
      recordAiPreparationEvent,
      menuImportSchema,
      menuImportParseReportSchema,
      buildParsedMenuImportPayload,
      operationalMenuCardapioSchema,
      menuMonthlyCycleQuerySchema,
      buildSemanticAliasByContext,
      resolveStructuredRecipeFromImportedName,
      getMonthKeyFromDate,
      getDateOnlyString,
      addUtcDays,
      startOfIsoWeek,
      diffUtcDays,
      extractRuleTarget,
      extractWeeklyMinimum,
      extractRecurrenceDays,
      normalizeTerm,
      inferSuggestionEvidenceSource,
      inferSuggestionEvidenceSubtype,
      adjustedVersionGenerationSchema,
      buildMenuPreparationContext,
      commemorativeDateSchema,
      commemorativeDateListQuerySchema,
      menuImportListQuerySchema,
      menuMonthlySummaryListQuerySchema,
      menuMonthlySummaryReprocessSchema,
      menuImportParamsSchema,
      recipeImportSchema,
      buildRecipeImportContext,
      classifyRecipeFromText,
      recipeParamsSchema,
      recipeClassificationUpdateSchema,
      nonConformitySchema,
      nonConformityParamsSchema,
      nonConformityStatusSchema,
      nonConformityHistoryQuerySchema,
      actionPlanSchema,
      actionPlanParamsSchema,
      actionPlanStatusSchema,
      actionPlanHistoryQuerySchema,
      complianceExportAuditQuerySchema,
      evaluationImportSchema,
      evaluationImportListQuerySchema,
      intelligenceListQuerySchema,
      recommendationPolicyContract,
      buildNextMenuProposal,
      nextMenuDecisionSchema,
      nextMenuDecisionListQuerySchema,
    } = service;

app.post('/menus/imports', { preHandler: authenticate }, async (request, reply) => {
  const parsed = menuImportSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Payload de importacao de cardapio invalido.',
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
  const payload = parsed.data;
  const importId = randomUUID();
  const recipesFromItems = (payload.recipeItems ?? []).map((item: any) => item.name.trim()).filter(Boolean)
  const effectiveRecipes = recipesFromItems.length > 0 ? recipesFromItems : payload.recipes
  const computedMealCost = payload.recipeItems && payload.recipeItems.length > 0
    ? Number(payload.recipeItems.reduce((sum: any, item: any) => sum + item.cost, 0).toFixed(2))
    : Number((payload.mealCost ?? 0).toFixed(2))
  const exceededValue = Math.max(computedMealCost - payload.financialGoal, 0);
  const exceededPercent =
    payload.financialGoal > 0
      ? (exceededValue / payload.financialGoal) * 100
      : 0;
  const status = exceededValue > 0 ? 'above_goal' : 'within_goal';

  await ensureDomainTables();

  await prisma.$executeRaw`
    INSERT INTO menu_pdf_imports (
      id,
      company_name,
      file_name,
      unit_name,
      service_name,
      reference_date,
      meal_type,
      financial_goal,
      meal_cost,
      exceeded_value,
      exceeded_percent,
      validation_status,
      recipes_json,
      imported_by
    )
    VALUES (
      ${importId},
      ${companyName},
      ${payload.fileName.trim()},
      ${payload.unitName.trim()},
      ${payload.serviceName.trim()},
      ${payload.referenceDate},
      ${payload.mealType.trim()},
      ${payload.financialGoal},
      ${computedMealCost},
      ${Number(exceededValue.toFixed(2))},
      ${Number(exceededPercent.toFixed(2))},
      ${status},
      ${JSON.stringify(effectiveRecipes)},
      ${actor.id}
    )
  `;

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    file_name: string;
    unit_name: string;
    service_name: string;
    reference_date: Date;
    meal_type: string;
    financial_goal: number | string;
    meal_cost: number | string;
    exceeded_value: number | string;
    exceeded_percent: number | string;
    validation_status: string;
    recipes_json: string;
    created_at: Date;
  }>>`
    SELECT
      id,
      file_name,
      unit_name,
      service_name,
      reference_date,
      meal_type,
      financial_goal,
      meal_cost,
      exceeded_value,
      exceeded_percent,
      validation_status,
      recipes_json,
      created_at
    FROM menu_pdf_imports
    WHERE id = ${importId}
    LIMIT 1
  `;

  const imported = rows[0];

  const parseNumber = (value: number | string | undefined) => {
    if (typeof value === 'number') {
      return Number(value.toFixed(2));
    }

    const parsedValue = Number(value ?? 0);
    return Number(parsedValue.toFixed(2));
  };

  return reply.code(201).send({
    status: 'ok',
    import: {
      id: imported?.id ?? importId,
      fileName: imported?.file_name ?? payload.fileName,
      unitName: imported?.unit_name ?? payload.unitName,
      serviceName: imported?.service_name ?? payload.serviceName,
      referenceDate: (imported?.reference_date ?? new Date(payload.referenceDate)).toISOString(),
      mealType: imported?.meal_type ?? payload.mealType,
      financialGoal: parseNumber(imported?.financial_goal),
      mealCost: parseNumber(imported?.meal_cost),
      exceededValue: parseNumber(imported?.exceeded_value),
      exceededPercent: parseNumber(imported?.exceeded_percent),
      validationStatus: imported?.validation_status ?? status,
      recipes: imported ? JSON.parse(imported.recipes_json) : effectiveRecipes,
      createdAt: (imported?.created_at ?? new Date()).toISOString(),
    },
  });
});

app.post('/menus/imports/parse-report', { preHandler: authenticate }, async (request, reply) => {
  const parsed = menuImportParseReportSchema.safeParse(request.body)

  if (!parsed.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Payload de parse do relatorio invalido.',
    })
  }

  const parsedPayload = buildParsedMenuImportPayload(parsed.data)

  if (!parsedPayload) {
    return reply.code(400).send({
      status: 'error',
      message: 'Nao foi possivel identificar unidade, servico e meta no relatorio.',
    })
  }

  return {
    status: 'ok',
    parsed: parsedPayload,
  }
})

app.post('/menus/imports/parse-report-file', { preHandler: authenticate }, async (request, reply) => {
  const file = await request.file()

  if (!file) {
    return reply.code(400).send({
      status: 'error',
      message: 'Arquivo PDF obrigatorio.',
    })
  }

  const fileName = file.filename ?? 'RELATORIO-PRE-CUSTO.pdf'

  if (!/\.pdf$/i.test(fileName) || file.mimetype !== 'application/pdf') {
    return reply.code(400).send({
      status: 'error',
      message: 'Envie um arquivo PDF valido.',
    })
  }

  const fileBuffer = await file.toBuffer()
  const parser = new PDFParse({ data: fileBuffer })
  const pdfParsed = await parser.getText()
  await parser.destroy()
  const rawText = pdfParsed.text.trim()

  if (rawText.length < 20) {
    return reply.code(400).send({
      status: 'error',
      message: 'Nao foi possivel extrair texto suficiente do PDF.',
    })
  }

  const parsedPayload = buildParsedMenuImportPayload({
    rawText,
    fileName,
  })

  if (!parsedPayload) {
    return reply.code(400).send({
      status: 'error',
      message: 'Nao foi possivel identificar unidade, servico e meta no relatorio.',
    })
  }

  return {
    status: 'ok',
    parsed: parsedPayload,
  }
})

app.post('/menus/operational-cardapios', { preHandler: authenticate }, async (request, reply) => {
  const parsed = operationalMenuCardapioSchema.safeParse(request.body)

  if (!parsed.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Payload de cardapio operacional invalido.',
    })
  }

  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    })
  }

  const companyName = getCompanyFromJwt(request)
  const actor = getUserFromJwt(request)
  const payload = parsed.data
  const cardapioId = randomUUID()
  const exceededValue = Math.max(payload.mealCost - payload.financialGoal, 0)
  const exceededPercent = payload.financialGoal > 0 ? (exceededValue / payload.financialGoal) * 100 : 0
  const status = exceededValue > 0 ? 'above_goal' : 'within_goal'

  await ensureDomainTables()

  await prisma.$executeRaw`
    INSERT INTO menu_operational_cardapios (
      id,
      company_name,
      entry_label,
      unit_name,
      service_name,
      reference_date,
      meal_type,
      financial_goal,
      meal_cost,
      exceeded_value,
      exceeded_percent,
      validation_status,
      recipes_json,
      created_by
    )
    VALUES (
      ${cardapioId},
      ${companyName},
      ${payload.entryLabel.trim()},
      ${payload.unitName.trim()},
      ${payload.serviceName.trim()},
      ${payload.referenceDate},
      ${payload.mealType.trim()},
      ${payload.financialGoal},
      ${payload.mealCost},
      ${Number(exceededValue.toFixed(2))},
      ${Number(exceededPercent.toFixed(2))},
      ${status},
      ${JSON.stringify(payload.recipes)},
      ${actor.id}
    )
  `

  const rows = await prisma.$queryRaw<Array<{
    id: string
    entry_label: string
    unit_name: string
    service_name: string
    reference_date: Date
    meal_type: string
    financial_goal: number | string
    meal_cost: number | string
    exceeded_value: number | string
    exceeded_percent: number | string
    validation_status: string
    recipes_json: string
    created_at: Date
  }>>`
    SELECT
      id,
      entry_label,
      unit_name,
      service_name,
      reference_date,
      meal_type,
      financial_goal,
      meal_cost,
      exceeded_value,
      exceeded_percent,
      validation_status,
      recipes_json,
      created_at
    FROM menu_operational_cardapios
    WHERE id = ${cardapioId}
    LIMIT 1
  `

  const created = rows[0]

  const parseNumber = (value: number | string | undefined) => {
    if (typeof value === 'number') {
      return Number(value.toFixed(2))
    }

    return Number(Number(value ?? 0).toFixed(2))
  }

  return reply.code(201).send({
    status: 'ok',
    operationalCardapio: {
      id: created?.id ?? cardapioId,
      entryLabel: created?.entry_label ?? payload.entryLabel,
      unitName: created?.unit_name ?? payload.unitName,
      serviceName: created?.service_name ?? payload.serviceName,
      referenceDate: (created?.reference_date ?? new Date(payload.referenceDate)).toISOString(),
      mealType: created?.meal_type ?? payload.mealType,
      financialGoal: parseNumber(created?.financial_goal),
      mealCost: parseNumber(created?.meal_cost),
      exceededValue: parseNumber(created?.exceeded_value),
      exceededPercent: parseNumber(created?.exceeded_percent),
      validationStatus: created?.validation_status ?? status,
      recipes: created ? JSON.parse(created.recipes_json) : payload.recipes,
      createdAt: (created?.created_at ?? new Date()).toISOString(),
    },
  })
})

app.post('/menus/imports/monthly-cycle', { preHandler: authenticate }, async (request, reply) => {
  const file = await request.file()

  if (!file) {
    return reply.code(400).send({
      status: 'error',
      message: 'Arquivo PDF obrigatorio.',
    })
  }

  const fileName = file.filename ?? 'RELATORIO-PRE-CUSTO.pdf'

  if (!/\.pdf$/i.test(fileName) || file.mimetype !== 'application/pdf') {
    return reply.code(400).send({
      status: 'error',
      message: 'Envie um arquivo PDF valido.',
    })
  }

  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    })
  }

  const fileBuffer = await file.toBuffer()
  const parser = new PDFParse({ data: fileBuffer })
  const pdfParsed = await parser.getText()
  await parser.destroy()
  const rawText = pdfParsed.text.trim()

  if (rawText.length < 20) {
    return reply.code(400).send({
      status: 'error',
      message: 'Nao foi possivel extrair texto suficiente do PDF.',
    })
  }

  const parsedPayload = buildParsedMenuImportPayload({
    rawText,
    fileName,
  })

  if (!parsedPayload) {
    return reply.code(400).send({
      status: 'error',
      message: 'Nao foi possivel identificar unidade, servico e meta no relatorio.',
    })
  }

  const authorization = request.headers.authorization

  const parsedQuery = menuMonthlyCycleQuerySchema.safeParse(request.query)

  if (!parsedQuery.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Parametros invalidos para processamento mensal.',
    })
  }

  const { continueOnItemError, maxAutoRetries } = parsedQuery.data

  if (!authorization) {
    return reply.code(401).send({
      status: 'error',
      message: apiMessage.auth.sessionExpired,
    })
  }

  const parsedOrNull = <T>(body: string): T | null => {
    try {
      return JSON.parse(body) as T
    } catch {
      return null
    }
  }

  const structuredRecipeRows = await prisma.$queryRaw<Array<{
    name: string
    normalized_name: string
  }>>`
    SELECT name, normalized_name
    FROM recipe_library_items
    WHERE company_name = ${getCompanyFromJwt(request)}
      AND is_active = TRUE
  `

  const structuredRecipeByNormalizedName = new Map(
    structuredRecipeRows.map((item: any) => [item.normalized_name, item]),
  )

  const executeStepWithAutoRetry = async (
    execute: () => Promise<{ statusCode: number; body: string }>,
  ): Promise<{
    response: { statusCode: number; body: string }
    retriesUsed: number
    recoveredByRetry: boolean
    lastErrorMessage: string | null
  }> => {
    let retriesUsed = 0
    let recoveredByRetry = false
    let lastErrorMessage: string | null = null
    let response = await execute()

    const firstErrorBody = parsedOrNull<{ message?: string }>(response.body)
    lastErrorMessage = firstErrorBody?.message ?? null

    while (response.statusCode >= 500 && retriesUsed < maxAutoRetries) {
      retriesUsed += 1
      response = await execute()
      const parsedErrorBody = parsedOrNull<{ message?: string }>(response.body)
      lastErrorMessage = parsedErrorBody?.message ?? null

      if (response.statusCode < 500) {
        recoveredByRetry = true
      }
    }

    return {
      response,
      retriesUsed,
      recoveredByRetry,
      lastErrorMessage,
    }
  }

  const processedImports: Array<{
    processingStatus: 'completed' | 'completed_with_warnings' | 'failed'
    failedStage: 'import' | 'audit' | 'suggestions' | null
    autoRemediation: {
      attempted: boolean
      retriesUsed: number
      recoveredByRetry: boolean
      lastErrorMessage: string | null
    }
    import: {
      id: string
      referenceDate: string
      mealCost: number
      financialGoal: number
      validationStatus: string
      exceededValue: number
      exceededPercent: number
    }
    audit: {
      auditedRules: number
      compliantCount: number
      nonCompliantCount: number
    }
    suggestions: {
      generatedSuggestions: number
      estimatedTotalFinancialImpact: number
      estimatedContractualFinancialImpact: number
      estimatedGoalFinancialImpact: number
    }
    recipeCrosscheck: {
      sourceRecipeNames: string[]
      totalRecipes: number
      matchedRecipes: number
      unmatchedRecipes: number
      coveragePercent: number
      unresolvedRecipeNames: string[]
      suggestedRecipeCreations: string[]
    }
    processingMessages: Array<{
      level: 'info' | 'warning'
      code: string
      message: string
      actionLabel: string
      actionIntent: 'open_import' | 'review_audit' | 'review_suggestions'
    }>
  }> = []

  for (const [index, suggestedImport] of parsedPayload.suggestedImports.entries()) {
    const fallbackImportId = `pending-${suggestedImport.referenceDate}-${index + 1}`
    const baseImportSummary = {
      id: fallbackImportId,
      referenceDate: suggestedImport.referenceDate,
      mealCost: Number((suggestedImport.mealCost ?? 0).toFixed(2)),
      financialGoal: Number((suggestedImport.financialGoal ?? parsedPayload.financialGoal).toFixed(2)),
      validationStatus: suggestedImport.mealCost > suggestedImport.financialGoal ? 'above_goal' : 'within_goal',
      exceededValue: Number(Math.max((suggestedImport.mealCost ?? 0) - suggestedImport.financialGoal, 0).toFixed(2)),
      exceededPercent: Number(
        (
          suggestedImport.financialGoal > 0
            ? (Math.max((suggestedImport.mealCost ?? 0) - suggestedImport.financialGoal, 0) / suggestedImport.financialGoal) * 100
            : 0
        ).toFixed(2),
      ),
    } as {
      id: string
      referenceDate: string
      mealCost: number
      financialGoal: number
      validationStatus: string
      exceededValue: number
      exceededPercent: number
    }

    const auditSummary = {
      auditedRules: 0,
      compliantCount: 0,
      nonCompliantCount: 0,
    }

    const suggestionSummary = {
      generatedSuggestions: 0,
      estimatedTotalFinancialImpact: 0,
      estimatedContractualFinancialImpact: 0,
      estimatedGoalFinancialImpact: 0,
    }

    const uniqueSourceRecipes = Array.from(new Set(suggestedImport.recipes.map((item: any) => item.trim()).filter(Boolean)))
    const semanticAliasByContext = buildSemanticAliasByContext({
      mealType: suggestedImport.mealType,
      serviceName: suggestedImport.serviceName,
    })
    const unresolvedRecipeNames = uniqueSourceRecipes.filter((recipeName) => {
      const matchedRecipe = resolveStructuredRecipeFromImportedName(
        recipeName,
        structuredRecipeRows,
        structuredRecipeByNormalizedName,
        semanticAliasByContext,
      )
      return !matchedRecipe
    })
    const matchedRecipes = uniqueSourceRecipes.length - unresolvedRecipeNames.length
    const recipeCrosscheck = {
      sourceRecipeNames: uniqueSourceRecipes as string[],
      totalRecipes: uniqueSourceRecipes.length,
      matchedRecipes,
      unmatchedRecipes: unresolvedRecipeNames.length,
      coveragePercent: uniqueSourceRecipes.length
        ? Number(((matchedRecipes / uniqueSourceRecipes.length) * 100).toFixed(2))
        : 100,
      unresolvedRecipeNames: unresolvedRecipeNames as string[],
      suggestedRecipeCreations: unresolvedRecipeNames as string[],
    }

    const processingMessages: Array<{
      level: 'info' | 'warning'
      code: string
      message: string
      actionLabel: string
      actionIntent: 'open_import' | 'review_audit' | 'review_suggestions'
    }> = []

    let failedStage: 'import' | 'audit' | 'suggestions' | null = null
    let retriesUsed = 0
    let recoveredByRetry = false
    let lastErrorMessage: string | null = null

    const createImportAttempt = await executeStepWithAutoRetry(() => app.inject({
      method: 'POST',
      url: '/menus/imports',
      headers: {
        authorization,
      },
      payload: suggestedImport,
    }))

    retriesUsed += createImportAttempt.retriesUsed
    recoveredByRetry = recoveredByRetry || createImportAttempt.recoveredByRetry
    lastErrorMessage = createImportAttempt.lastErrorMessage

    if (createImportAttempt.response.statusCode !== 201) {
      const errorBody = parsedOrNull<{ message?: string }>(createImportAttempt.response.body)
      failedStage = 'import'
      lastErrorMessage = errorBody?.message ?? lastErrorMessage
      processingMessages.push({
        level: 'warning',
        code: 'import_failed',
        message: lastErrorMessage ?? 'Falha ao importar o dia no ciclo mensal.',
        actionLabel: 'Revisar arquivo e executar novo ciclo',
        actionIntent: 'review_suggestions',
      })
    } else {
      const created = parsedOrNull<{
        import?: {
          id?: string
          referenceDate?: string
          mealCost?: number
          financialGoal?: number
          validationStatus?: string
          exceededValue?: number
          exceededPercent?: number
        }
      }>(createImportAttempt.response.body)

      const importId = created?.import?.id

      if (!importId) {
        failedStage = 'import'
        lastErrorMessage = 'Falha ao recuperar o identificador da importacao criada.'
        processingMessages.push({
          level: 'warning',
          code: 'import_id_missing',
          message: lastErrorMessage,
          actionLabel: 'Revisar arquivo e executar novo ciclo',
          actionIntent: 'review_suggestions',
        })
      } else {
        baseImportSummary.id = importId
        baseImportSummary.referenceDate = created?.import?.referenceDate ?? suggestedImport.referenceDate
        baseImportSummary.mealCost = Number((created?.import?.mealCost ?? suggestedImport.mealCost).toFixed(2))
        baseImportSummary.financialGoal = Number((created?.import?.financialGoal ?? suggestedImport.financialGoal).toFixed(2))
        baseImportSummary.validationStatus = created?.import?.validationStatus ?? 'within_goal'
        baseImportSummary.exceededValue = Number((created?.import?.exceededValue ?? 0).toFixed(2))
        baseImportSummary.exceededPercent = Number((created?.import?.exceededPercent ?? 0).toFixed(2))

        const auditAttempt = await executeStepWithAutoRetry(() => app.inject({
          method: 'POST',
          url: `/menus/imports/${importId}/audit`,
          headers: {
            authorization,
          },
        }))

        retriesUsed += auditAttempt.retriesUsed
        recoveredByRetry = recoveredByRetry || auditAttempt.recoveredByRetry
        lastErrorMessage = auditAttempt.lastErrorMessage

        if (auditAttempt.response.statusCode !== 200) {
          const errorBody = parsedOrNull<{ message?: string }>(auditAttempt.response.body)
          failedStage = 'audit'
          lastErrorMessage = errorBody?.message ?? lastErrorMessage
          processingMessages.push({
            level: 'warning',
            code: 'audit_failed',
            message: lastErrorMessage ?? 'Falha ao auditar um dia do ciclo mensal.',
            actionLabel: 'Abrir auditoria contratual',
            actionIntent: 'review_audit',
          })
        } else {
          const auditBody = parsedOrNull<{
            summary?: {
              auditedRules?: number
              compliantCount?: number
              nonCompliantCount?: number
            }
          }>(auditAttempt.response.body)

          auditSummary.auditedRules = auditBody?.summary?.auditedRules ?? 0
          auditSummary.compliantCount = auditBody?.summary?.compliantCount ?? 0
          auditSummary.nonCompliantCount = auditBody?.summary?.nonCompliantCount ?? 0

          const suggestionsAttempt = await executeStepWithAutoRetry(() => app.inject({
            method: 'POST',
            url: `/menus/imports/${importId}/suggestions`,
            headers: {
              authorization,
            },
          }))

          retriesUsed += suggestionsAttempt.retriesUsed
          recoveredByRetry = recoveredByRetry || suggestionsAttempt.recoveredByRetry
          lastErrorMessage = suggestionsAttempt.lastErrorMessage

          if (suggestionsAttempt.response.statusCode !== 200) {
            const errorBody = parsedOrNull<{ message?: string }>(suggestionsAttempt.response.body)
            failedStage = 'suggestions'
            lastErrorMessage = errorBody?.message ?? lastErrorMessage
            processingMessages.push({
              level: 'warning',
              code: 'suggestions_failed',
              message: lastErrorMessage ?? 'Falha ao gerar sugestoes para um dia do ciclo mensal.',
              actionLabel: 'Abrir sugestoes de ajuste',
              actionIntent: 'review_suggestions',
            })
          } else {
            const suggestionsBody = parsedOrNull<{
              summary?: {
                generatedSuggestions?: number
                estimatedTotalFinancialImpact?: number
                estimatedContractualFinancialImpact?: number
                estimatedGoalFinancialImpact?: number
              }
            }>(suggestionsAttempt.response.body)

            suggestionSummary.generatedSuggestions = suggestionsBody?.summary?.generatedSuggestions ?? 0
            suggestionSummary.estimatedTotalFinancialImpact = Number((
              suggestionsBody?.summary?.estimatedTotalFinancialImpact ?? 0
            ).toFixed(2))
            suggestionSummary.estimatedContractualFinancialImpact = Number((
              suggestionsBody?.summary?.estimatedContractualFinancialImpact ?? 0
            ).toFixed(2))
            suggestionSummary.estimatedGoalFinancialImpact = Number((
              suggestionsBody?.summary?.estimatedGoalFinancialImpact ?? 0
            ).toFixed(2))
          }
        }
      }
    }

    if (baseImportSummary.validationStatus === 'above_goal') {
      processingMessages.push({
        level: 'warning',
        code: 'above_goal',
        message: `Custo acima da meta em R$ ${baseImportSummary.exceededValue.toFixed(2)} (${baseImportSummary.exceededPercent.toFixed(2)}%).`,
        actionLabel: 'Revisar custo e sugestoes',
        actionIntent: 'review_suggestions',
      })
    } else {
      processingMessages.push({
        level: 'info',
        code: 'within_goal',
        message: 'Custo dentro da meta financeira do servico.',
        actionLabel: 'Abrir importacao',
        actionIntent: 'open_import',
      })
    }

    if (auditSummary.nonCompliantCount > 0) {
      processingMessages.push({
        level: 'warning',
        code: 'contract_non_compliance',
        message: `${auditSummary.nonCompliantCount} regra(s) com nao conformidade na auditoria contratual.`,
        actionLabel: 'Abrir auditoria contratual',
        actionIntent: 'review_audit',
      })
    } else {
      processingMessages.push({
        level: 'info',
        code: 'contract_compliant',
        message: 'Auditoria contratual sem nao conformidades para este dia.',
        actionLabel: 'Abrir auditoria contratual',
        actionIntent: 'review_audit',
      })
    }

    if (suggestionSummary.generatedSuggestions > 0) {
      processingMessages.push({
        level: 'info',
        code: 'suggestions_generated',
        message: `${suggestionSummary.generatedSuggestions} sugestao(oes) gerada(s) para o dia.`,
        actionLabel: 'Abrir sugestoes de ajuste',
        actionIntent: 'review_suggestions',
      })
    }

    if (recoveredByRetry) {
      processingMessages.push({
        level: 'info',
        code: 'auto_remediated',
        message: 'Instabilidade detectada e tratada automaticamente durante o processamento do dia.',
        actionLabel: 'Abrir importacao',
        actionIntent: 'open_import',
      })
    }

    if (failedStage) {
      processingMessages.push({
        level: 'warning',
        code: 'item_failed',
        message: `Falha na etapa ${failedStage}. O ciclo seguiu para os demais dias.`,
        actionLabel: 'Reexecutar ciclo mensal',
        actionIntent: 'review_suggestions',
      })
    }

    if (recipeCrosscheck.unmatchedRecipes > 0) {
      processingMessages.push({
        level: 'warning',
        code: 'recipe_crosscheck_partial',
        message: `${recipeCrosscheck.unmatchedRecipes} receita(s) do relatorio ainda sem correspondencia na base estruturada.`,
        actionLabel: 'Revisar base estruturada de receitas',
        actionIntent: 'review_suggestions',
      })
      processingMessages.push({
        level: 'info',
        code: 'recipe_creation_suggested',
        message: `Sugestao: cadastrar ${recipeCrosscheck.suggestedRecipeCreations.length} receita(s) nao localizada(s) para aumentar cobertura do proximo ciclo.`,
        actionLabel: 'Revisar base estruturada de receitas',
        actionIntent: 'review_suggestions',
      })
    } else {
      processingMessages.push({
        level: 'info',
        code: 'recipe_crosscheck_ok',
        message: 'Receitas do relatorio mensal cruzadas com sucesso na base estruturada.',
        actionLabel: 'Abrir importacao',
        actionIntent: 'open_import',
      })
    }

    const processingStatus =
      failedStage
        ? 'failed'
        : baseImportSummary.validationStatus === 'above_goal' || auditSummary.nonCompliantCount > 0
          ? 'completed_with_warnings'
          : 'completed'

    processedImports.push({
      processingStatus,
      failedStage,
      autoRemediation: {
        attempted: retriesUsed > 0,
        retriesUsed,
        recoveredByRetry,
        lastErrorMessage,
      },
      import: {
        ...baseImportSummary,
      },
      audit: auditSummary,
      suggestions: suggestionSummary,
      recipeCrosscheck,
      processingMessages,
    })

    if (failedStage && !continueOnItemError) {
      return reply.code(502).send({
        status: 'error',
        message: `Falha no processamento mensal na etapa ${failedStage}.`,
        failedImport: {
          referenceDate: baseImportSummary.referenceDate,
          failedStage,
          errorMessage: lastErrorMessage,
        },
      })
    }
  }

  const totalMealCost = Number(
    processedImports.reduce((sum, item) => sum + item.import.mealCost, 0).toFixed(2),
  )
  const totalGoal = Number(
    processedImports.reduce((sum, item) => sum + item.import.financialGoal, 0).toFixed(2),
  )
  const failedItems = processedImports.filter((item) => item.processingStatus === 'failed').length
  const aboveGoalDays = processedImports.filter(
    (item) => item.processingStatus !== 'failed' && item.import.validationStatus === 'above_goal',
  ).length
  const withinGoalDays = processedImports.filter(
    (item) => item.processingStatus !== 'failed' && item.import.validationStatus === 'within_goal',
  ).length
  const totalSuggestions = processedImports.reduce((sum, item) => sum + item.suggestions.generatedSuggestions, 0)
  const totalEstimatedFinancialImpact = Number(
    processedImports.reduce((sum, item) => sum + item.suggestions.estimatedTotalFinancialImpact, 0).toFixed(2),
  )
  const totalContractualEstimatedFinancialImpact = Number(
    processedImports.reduce((sum, item) => sum + item.suggestions.estimatedContractualFinancialImpact, 0).toFixed(2),
  )
  const totalGoalEstimatedFinancialImpact = Number(
    processedImports.reduce((sum, item) => sum + item.suggestions.estimatedGoalFinancialImpact, 0).toFixed(2),
  )
  const totalRecipesCrosschecked = processedImports.reduce((sum, item) => sum + item.recipeCrosscheck.totalRecipes, 0)
  const totalRecipesMatched = processedImports.reduce((sum, item) => sum + item.recipeCrosscheck.matchedRecipes, 0)
  const totalRecipesUnmatched = processedImports.reduce((sum, item) => sum + item.recipeCrosscheck.unmatchedRecipes, 0)
  const recipeCrosscheckCoveragePercent = totalRecipesCrosschecked
    ? Number(((totalRecipesMatched / totalRecipesCrosschecked) * 100).toFixed(2))
    : 100
  const sortedReferenceDates = processedImports
    .map((item) => item.import.referenceDate.slice(0, 10))
    .sort()
  const periodStartDate = sortedReferenceDates[0] ?? parsedPayload.days[0]?.referenceDate ?? new Date().toISOString().slice(0, 10)
  const periodEndDate = sortedReferenceDates[sortedReferenceDates.length - 1] ?? periodStartDate
  const summaryMonth = getMonthKeyFromDate(periodStartDate)

  const summaryIdRows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM menu_monthly_cycle_summaries
    WHERE company_name = ${getCompanyFromJwt(request)}
      AND summary_month = ${summaryMonth}
      AND unit_name = ${parsedPayload.unitName}
      AND service_name = ${parsedPayload.serviceName}
    LIMIT 1
  `

  const summaryId = summaryIdRows[0]?.id ?? randomUUID()

  await prisma.$executeRaw`
    INSERT INTO menu_monthly_cycle_summaries (
      id,
      company_name,
      summary_month,
      unit_name,
      service_name,
      meal_type,
      source_file_name,
      financial_goal,
      days_parsed,
      imports_processed,
      above_goal_days,
      within_goal_days,
      total_meal_cost,
      total_goal,
      total_suggestions,
      total_estimated_financial_impact,
      total_contractual_estimated_financial_impact,
      total_goal_estimated_financial_impact,
      processed_imports_json,
      period_start_date,
      period_end_date,
      updated_at
    )
    VALUES (
      ${summaryId},
      ${getCompanyFromJwt(request)},
      ${summaryMonth},
      ${parsedPayload.unitName},
      ${parsedPayload.serviceName},
      ${parsedPayload.mealType},
      ${fileName},
      ${parsedPayload.financialGoal},
      ${parsedPayload.days.length},
      ${processedImports.length},
      ${aboveGoalDays},
      ${withinGoalDays},
      ${totalMealCost},
      ${totalGoal},
      ${totalSuggestions},
      ${totalEstimatedFinancialImpact},
      ${totalContractualEstimatedFinancialImpact},
      ${totalGoalEstimatedFinancialImpact},
      ${JSON.stringify(processedImports)},
      ${periodStartDate},
      ${periodEndDate},
      NOW()
    )
    ON CONFLICT (company_name, summary_month, unit_name, service_name)
    DO UPDATE SET
      meal_type = EXCLUDED.meal_type,
      source_file_name = EXCLUDED.source_file_name,
      financial_goal = EXCLUDED.financial_goal,
      days_parsed = EXCLUDED.days_parsed,
      imports_processed = EXCLUDED.imports_processed,
      above_goal_days = EXCLUDED.above_goal_days,
      within_goal_days = EXCLUDED.within_goal_days,
      total_meal_cost = EXCLUDED.total_meal_cost,
      total_goal = EXCLUDED.total_goal,
      total_suggestions = EXCLUDED.total_suggestions,
      total_estimated_financial_impact = EXCLUDED.total_estimated_financial_impact,
      total_contractual_estimated_financial_impact = EXCLUDED.total_contractual_estimated_financial_impact,
      total_goal_estimated_financial_impact = EXCLUDED.total_goal_estimated_financial_impact,
      processed_imports_json = EXCLUDED.processed_imports_json,
      period_start_date = EXCLUDED.period_start_date,
      period_end_date = EXCLUDED.period_end_date,
      updated_at = NOW()
  `

  return {
    status: 'ok',
    cycle: {
      fileName,
      unitName: parsedPayload.unitName,
      serviceName: parsedPayload.serviceName,
      mealType: parsedPayload.mealType,
      financialGoal: parsedPayload.financialGoal,
      daysParsed: parsedPayload.days.length,
      importsProcessed: processedImports.length,
      summaryMonth,
      aboveGoalDays,
      withinGoalDays,
      failedItems,
      totalMealCost,
      totalGoal,
      totalSuggestions,
      totalEstimatedFinancialImpact,
      totalContractualEstimatedFinancialImpact,
      totalGoalEstimatedFinancialImpact,
      recipeCrosscheck: {
        totalRecipesCrosschecked,
        totalRecipesMatched,
        totalRecipesUnmatched,
        coveragePercent: recipeCrosscheckCoveragePercent,
      },
    },
    imports: processedImports,
  }
})

app.get('/menus/imports/monthly-summaries', { preHandler: authenticate }, async (request, reply) => {
  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    })
  }

  const parsedQuery = menuMonthlySummaryListQuerySchema.safeParse(request.query)

  if (!parsedQuery.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Filtro de resumo mensal invalido.',
    })
  }

  const companyName = getCompanyFromJwt(request)
  const { month, unitName, serviceName, limit } = parsedQuery.data

  const rows = await prisma.$queryRaw<Array<{
    id: string
    summary_month: string
    unit_name: string
    service_name: string
    meal_type: string
    source_file_name: string
    financial_goal: number | string
    days_parsed: number
    imports_processed: number
    above_goal_days: number
    within_goal_days: number
    total_meal_cost: number | string
    total_goal: number | string
    total_suggestions: number
    total_estimated_financial_impact: number | string
    total_contractual_estimated_financial_impact: number | string
    total_goal_estimated_financial_impact: number | string
    processed_imports_json: string
    period_start_date: Date | string
    period_end_date: Date | string
    created_at: Date
    updated_at: Date
  }>>`
    SELECT
      id,
      summary_month,
      unit_name,
      service_name,
      meal_type,
      source_file_name,
      financial_goal,
      days_parsed,
      imports_processed,
      above_goal_days,
      within_goal_days,
      total_meal_cost,
      total_goal,
      total_suggestions,
      total_estimated_financial_impact,
      total_contractual_estimated_financial_impact,
      total_goal_estimated_financial_impact,
      processed_imports_json,
      period_start_date,
      period_end_date,
      created_at,
      updated_at
    FROM menu_monthly_cycle_summaries
    WHERE company_name = ${companyName}
      AND (${month ?? null} IS NULL OR summary_month = ${month ?? null})
      AND (${unitName ?? null} IS NULL OR unit_name = ${unitName ?? null})
      AND (${serviceName ?? null} IS NULL OR service_name = ${serviceName ?? null})
    ORDER BY summary_month DESC, updated_at DESC
    LIMIT ${limit}
  `

  const parseNumber = (value: number | string) => {
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number(parsed.toFixed(2))
  }

  const parseProcessedImports = (rawValue: string) => {
    try {
      const parsed = JSON.parse(rawValue) as unknown
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return {
    status: 'ok',
    summaries: rows.map((row: any) => ({
      id: row.id,
      summaryMonth: row.summary_month,
      unitName: row.unit_name,
      serviceName: row.service_name,
      mealType: row.meal_type,
      sourceFileName: row.source_file_name,
      financialGoal: parseNumber(row.financial_goal),
      daysParsed: row.days_parsed,
      importsProcessed: row.imports_processed,
      aboveGoalDays: row.above_goal_days,
      withinGoalDays: row.within_goal_days,
      totalMealCost: parseNumber(row.total_meal_cost),
      totalGoal: parseNumber(row.total_goal),
      totalSuggestions: row.total_suggestions,
      totalEstimatedFinancialImpact: parseNumber(row.total_estimated_financial_impact),
      totalContractualEstimatedFinancialImpact: parseNumber(row.total_contractual_estimated_financial_impact),
      totalGoalEstimatedFinancialImpact: parseNumber(row.total_goal_estimated_financial_impact),
      processedImports: parseProcessedImports(row.processed_imports_json),
      periodStartDate: getDateOnlyString(row.period_start_date),
      periodEndDate: getDateOnlyString(row.period_end_date),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    })),
  }
})

app.post('/menus/imports/monthly-summaries/reprocess-failed', { preHandler: authenticate }, async (request, reply) => {
  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    })
  }

  const parsedBody = menuMonthlySummaryReprocessSchema.safeParse(request.body)

  if (!parsedBody.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Parametros invalidos para reprocessamento seletivo.',
    })
  }

  const authorization = request.headers.authorization

  if (!authorization) {
    return reply.code(401).send({
      status: 'error',
      message: apiMessage.auth.sessionExpired,
    })
  }

  const parsedOrNull = <T>(body: string): T | null => {
    try {
      return JSON.parse(body) as T
    } catch {
      return null
    }
  }

  const parseProcessedImports = (rawValue: string) => {
    try {
      const parsed = JSON.parse(rawValue) as unknown
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  const executeStepWithAutoRetry = async (
    execute: () => Promise<{ statusCode: number; body: string }>,
  ): Promise<{
    response: { statusCode: number; body: string }
    retriesUsed: number
    recoveredByRetry: boolean
    lastErrorMessage: string | null
  }> => {
    let retriesUsed = 0
    let recoveredByRetry = false
    let lastErrorMessage: string | null = null
    let response = await execute()

    const firstErrorBody = parsedOrNull<{ message?: string }>(response.body)
    lastErrorMessage = firstErrorBody?.message ?? null

    while (response.statusCode >= 500 && retriesUsed < parsedBody.data.maxAutoRetries) {
      retriesUsed += 1
      response = await execute()
      const parsedErrorBody = parsedOrNull<{ message?: string }>(response.body)
      lastErrorMessage = parsedErrorBody?.message ?? null

      if (response.statusCode < 500) {
        recoveredByRetry = true
      }
    }

    return {
      response,
      retriesUsed,
      recoveredByRetry,
      lastErrorMessage,
    }
  }

  const buildProcessingMessages = (params: {
    importSummary: {
      exceededValue: number
      exceededPercent: number
      validationStatus: string
    }
    auditSummary: {
      nonCompliantCount: number
    }
    suggestionSummary: {
      generatedSuggestions: number
    }
    failedStage: 'import' | 'audit' | 'suggestions' | null
    recoveredByRetry: boolean
  }) => {
    const messages: Array<{
      level: 'info' | 'warning'
      code: string
      message: string
      actionLabel: string
      actionIntent: 'open_import' | 'review_audit' | 'review_suggestions'
    }> = []

    if (params.importSummary.validationStatus === 'above_goal') {
      messages.push({
        level: 'warning',
        code: 'above_goal',
        message: `Custo acima da meta em R$ ${params.importSummary.exceededValue.toFixed(2)} (${params.importSummary.exceededPercent.toFixed(2)}%).`,
        actionLabel: 'Revisar custo e sugestoes',
        actionIntent: 'review_suggestions',
      })
    } else {
      messages.push({
        level: 'info',
        code: 'within_goal',
        message: 'Custo dentro da meta financeira do servico.',
        actionLabel: 'Abrir importacao',
        actionIntent: 'open_import',
      })
    }

    if (params.auditSummary.nonCompliantCount > 0) {
      messages.push({
        level: 'warning',
        code: 'contract_non_compliance',
        message: `${params.auditSummary.nonCompliantCount} regra(s) com nao conformidade na auditoria contratual.`,
        actionLabel: 'Abrir auditoria contratual',
        actionIntent: 'review_audit',
      })
    } else {
      messages.push({
        level: 'info',
        code: 'contract_compliant',
        message: 'Auditoria contratual sem nao conformidades para este dia.',
        actionLabel: 'Abrir auditoria contratual',
        actionIntent: 'review_audit',
      })
    }

    if (params.suggestionSummary.generatedSuggestions > 0) {
      messages.push({
        level: 'info',
        code: 'suggestions_generated',
        message: `${params.suggestionSummary.generatedSuggestions} sugestao(oes) gerada(s) para o dia.`,
        actionLabel: 'Abrir sugestoes de ajuste',
        actionIntent: 'review_suggestions',
      })
    }

    if (params.recoveredByRetry) {
      messages.push({
        level: 'info',
        code: 'auto_remediated',
        message: 'Instabilidade detectada e tratada automaticamente durante o processamento do dia.',
        actionLabel: 'Abrir importacao',
        actionIntent: 'open_import',
      })
    }

    if (params.failedStage) {
      messages.push({
        level: 'warning',
        code: 'item_failed',
        message: `Falha na etapa ${params.failedStage}. O ciclo seguiu para os demais dias.`,
        actionLabel: 'Reexecutar ciclo mensal',
        actionIntent: 'review_suggestions',
      })
    }

    return messages
  }

  const companyName = getCompanyFromJwt(request)
  const rows = await prisma.$queryRaw<Array<{
    id: string
    summary_month: string
    unit_name: string
    service_name: string
    meal_type: string
    source_file_name: string
    financial_goal: number | string
    days_parsed: number
    processed_imports_json: string
  }>>`
    SELECT
      id,
      summary_month,
      unit_name,
      service_name,
      meal_type,
      source_file_name,
      financial_goal,
      days_parsed,
      processed_imports_json
    FROM menu_monthly_cycle_summaries
    WHERE company_name = ${companyName}
      AND summary_month = ${parsedBody.data.summaryMonth}
      AND unit_name = ${parsedBody.data.unitName}
      AND service_name = ${parsedBody.data.serviceName}
    LIMIT 1
  `

  const row = rows[0]

  if (!row) {
    return reply.code(404).send({
      status: 'error',
      message: 'Resumo mensal nao encontrado para o escopo informado.',
    })
  }

  const processedImports = parseProcessedImports(row.processed_imports_json) as Array<{
    processingStatus?: 'completed' | 'completed_with_warnings' | 'failed'
    failedStage?: 'import' | 'audit' | 'suggestions' | null
    autoRemediation?: {
      attempted?: boolean
      retriesUsed?: number
      recoveredByRetry?: boolean
      lastErrorMessage?: string | null
    }
    import: {
      id: string
      referenceDate: string
      mealCost: number
      financialGoal: number
      validationStatus: string
      exceededValue: number
      exceededPercent: number
    }
    audit: {
      auditedRules: number
      compliantCount: number
      nonCompliantCount: number
    }
    suggestions: {
      generatedSuggestions: number
      estimatedTotalFinancialImpact: number
      estimatedContractualFinancialImpact: number
      estimatedGoalFinancialImpact: number
    }
    recipeCrosscheck?: {
      sourceRecipeNames?: string[]
      totalRecipes?: number
      matchedRecipes?: number
      unmatchedRecipes?: number
      coveragePercent?: number
      unresolvedRecipeNames?: string[]
      suggestedRecipeCreations?: string[]
    }
    processingMessages: Array<{
      level: 'info' | 'warning'
      code: string
      message: string
      actionLabel: string
      actionIntent: 'open_import' | 'review_audit' | 'review_suggestions'
    }>
  }>

  const failedItemsBefore = processedImports.filter((item) => item.processingStatus === 'failed').length
  let recoveredItems = 0
  let skippedItems = 0

  for (const item of processedImports) {
    if (item.processingStatus !== 'failed') {
      continue
    }

    let itemId = item.import?.id
    const currentFailedStage = item.failedStage ?? 'audit'

    if (!itemId) {
      skippedItems += 1
      item.processingMessages = buildProcessingMessages({
        importSummary: item.import,
        auditSummary: item.audit,
        suggestionSummary: item.suggestions,
        failedStage: currentFailedStage,
        recoveredByRetry: false,
      })
      item.processingMessages.push({
        level: 'warning',
        code: 'reprocess_skipped',
        message: 'Nao foi possivel reprocessar automaticamente este item por ausencia de identificador de importacao.',
        actionLabel: 'Reexecutar ciclo mensal',
        actionIntent: 'review_suggestions',
      })
      continue
    }

    let retriesUsed = 0
    let recoveredByRetry = false
    let lastErrorMessage: string | null = null
    let failedStage: 'import' | 'audit' | 'suggestions' | null = currentFailedStage

    if (failedStage === 'import') {
      const createImportAttempt = await executeStepWithAutoRetry(() => app.inject({
        method: 'POST',
        url: '/menus/imports',
        headers: {
          authorization,
        },
        payload: {
          fileName: row.source_file_name,
          unitName: row.unit_name,
          serviceName: row.service_name,
          referenceDate: item.import.referenceDate.slice(0, 10),
          mealType: row.meal_type,
          financialGoal: item.import.financialGoal,
          mealCost: item.import.mealCost,
          recipes: item.recipeCrosscheck?.sourceRecipeNames ?? [],
        },
      }))

      retriesUsed += createImportAttempt.retriesUsed
      recoveredByRetry = recoveredByRetry || createImportAttempt.recoveredByRetry
      lastErrorMessage = createImportAttempt.lastErrorMessage

      if (createImportAttempt.response.statusCode !== 201) {
        const errorBody = parsedOrNull<{ message?: string }>(createImportAttempt.response.body)
        failedStage = 'import'
        lastErrorMessage = errorBody?.message ?? lastErrorMessage
      } else {
        const createBody = parsedOrNull<{
          import?: {
            id?: string
            referenceDate?: string
            mealCost?: number
            financialGoal?: number
            validationStatus?: string
            exceededValue?: number
            exceededPercent?: number
          }
        }>(createImportAttempt.response.body)

        const createdImportId = createBody?.import?.id

        if (!createdImportId) {
          failedStage = 'import'
          lastErrorMessage = 'Falha ao recuperar o identificador da importacao criada no reprocessamento.'
        } else {
          itemId = createdImportId
          item.import.id = createdImportId
          item.import.referenceDate = createBody?.import?.referenceDate ?? item.import.referenceDate
          item.import.mealCost = Number((createBody?.import?.mealCost ?? item.import.mealCost).toFixed(2))
          item.import.financialGoal = Number((createBody?.import?.financialGoal ?? item.import.financialGoal).toFixed(2))
          item.import.validationStatus = createBody?.import?.validationStatus ?? item.import.validationStatus
          item.import.exceededValue = Number((createBody?.import?.exceededValue ?? item.import.exceededValue).toFixed(2))
          item.import.exceededPercent = Number((createBody?.import?.exceededPercent ?? item.import.exceededPercent).toFixed(2))
          failedStage = 'audit'
        }
      }
    }

    if (!itemId) {
      skippedItems += 1
      item.processingMessages = buildProcessingMessages({
        importSummary: item.import,
        auditSummary: item.audit,
        suggestionSummary: item.suggestions,
        failedStage,
        recoveredByRetry,
      })
      item.processingMessages.push({
        level: 'warning',
        code: 'reprocess_skipped',
        message: 'Nao foi possivel concluir o reprocessamento por ausencia de identificador de importacao.',
        actionLabel: 'Reexecutar ciclo mensal',
        actionIntent: 'review_suggestions',
      })

      if (failedStage && parsedBody.data.continueOnItemError === false) {
        return reply.code(502).send({
          status: 'error',
          message: `Falha no reprocessamento seletivo na etapa ${failedStage}.`,
        })
      }
      continue
    }

    if (failedStage === 'audit') {
      const auditAttempt = await executeStepWithAutoRetry(() => app.inject({
        method: 'POST',
        url: `/menus/imports/${itemId}/audit`,
        headers: {
          authorization,
        },
      }))

      retriesUsed += auditAttempt.retriesUsed
      recoveredByRetry = recoveredByRetry || auditAttempt.recoveredByRetry
      lastErrorMessage = auditAttempt.lastErrorMessage

      if (auditAttempt.response.statusCode !== 200) {
        const errorBody = parsedOrNull<{ message?: string }>(auditAttempt.response.body)
        failedStage = 'audit'
        lastErrorMessage = errorBody?.message ?? lastErrorMessage
      } else {
        const auditBody = parsedOrNull<{
          summary?: {
            auditedRules?: number
            compliantCount?: number
            nonCompliantCount?: number
          }
        }>(auditAttempt.response.body)

        item.audit = {
          auditedRules: auditBody?.summary?.auditedRules ?? 0,
          compliantCount: auditBody?.summary?.compliantCount ?? 0,
          nonCompliantCount: auditBody?.summary?.nonCompliantCount ?? 0,
        }

        failedStage = 'suggestions'
      }
    }

    if (failedStage === 'suggestions') {
      const suggestionsAttempt = await executeStepWithAutoRetry(() => app.inject({
        method: 'POST',
        url: `/menus/imports/${itemId}/suggestions`,
        headers: {
          authorization,
        },
      }))

      retriesUsed += suggestionsAttempt.retriesUsed
      recoveredByRetry = recoveredByRetry || suggestionsAttempt.recoveredByRetry
      lastErrorMessage = suggestionsAttempt.lastErrorMessage

      if (suggestionsAttempt.response.statusCode !== 200) {
        const errorBody = parsedOrNull<{ message?: string }>(suggestionsAttempt.response.body)
        failedStage = 'suggestions'
        lastErrorMessage = errorBody?.message ?? lastErrorMessage
      } else {
        const suggestionsBody = parsedOrNull<{
          summary?: {
            generatedSuggestions?: number
            estimatedTotalFinancialImpact?: number
            estimatedContractualFinancialImpact?: number
            estimatedGoalFinancialImpact?: number
          }
        }>(suggestionsAttempt.response.body)

        item.suggestions = {
          generatedSuggestions: suggestionsBody?.summary?.generatedSuggestions ?? 0,
          estimatedTotalFinancialImpact: Number((
            suggestionsBody?.summary?.estimatedTotalFinancialImpact ?? 0
          ).toFixed(2)),
          estimatedContractualFinancialImpact: Number((
            suggestionsBody?.summary?.estimatedContractualFinancialImpact ?? 0
          ).toFixed(2)),
          estimatedGoalFinancialImpact: Number((
            suggestionsBody?.summary?.estimatedGoalFinancialImpact ?? 0
          ).toFixed(2)),
        }

        failedStage = null
      }
    }

    item.failedStage = failedStage
    item.autoRemediation = {
      attempted: retriesUsed > 0,
      retriesUsed,
      recoveredByRetry,
      lastErrorMessage,
    }

    item.processingStatus =
      failedStage
        ? 'failed'
        : item.import.validationStatus === 'above_goal' || item.audit.nonCompliantCount > 0
          ? 'completed_with_warnings'
          : 'completed'

    item.processingMessages = buildProcessingMessages({
      importSummary: item.import,
      auditSummary: item.audit,
      suggestionSummary: item.suggestions,
      failedStage,
      recoveredByRetry,
    })

    if (!failedStage) {
      recoveredItems += 1
      item.processingMessages.push({
        level: 'info',
        code: 'reprocess_success',
        message: 'Reprocessamento seletivo concluido com sucesso para este item.',
        actionLabel: 'Abrir importacao',
        actionIntent: 'open_import',
      })
    }

    if (failedStage && parsedBody.data.continueOnItemError === false) {
      return reply.code(502).send({
        status: 'error',
        message: `Falha no reprocessamento seletivo na etapa ${failedStage}.`,
      })
    }
  }

  const totalMealCost = Number(
    processedImports.reduce((sum, item) => sum + item.import.mealCost, 0).toFixed(2),
  )
  const totalGoal = Number(
    processedImports.reduce((sum, item) => sum + item.import.financialGoal, 0).toFixed(2),
  )
  const failedItems = processedImports.filter((item) => item.processingStatus === 'failed').length
  const aboveGoalDays = processedImports.filter(
    (item) => item.processingStatus !== 'failed' && item.import.validationStatus === 'above_goal',
  ).length
  const withinGoalDays = processedImports.filter(
    (item) => item.processingStatus !== 'failed' && item.import.validationStatus === 'within_goal',
  ).length
  const totalSuggestions = processedImports.reduce((sum, item) => sum + item.suggestions.generatedSuggestions, 0)
  const totalEstimatedFinancialImpact = Number(
    processedImports.reduce((sum, item) => sum + item.suggestions.estimatedTotalFinancialImpact, 0).toFixed(2),
  )
  const totalContractualEstimatedFinancialImpact = Number(
    processedImports.reduce((sum, item) => sum + item.suggestions.estimatedContractualFinancialImpact, 0).toFixed(2),
  )
  const totalGoalEstimatedFinancialImpact = Number(
    processedImports.reduce((sum, item) => sum + item.suggestions.estimatedGoalFinancialImpact, 0).toFixed(2),
  )

  await prisma.$executeRaw`
    UPDATE menu_monthly_cycle_summaries
    SET
      imports_processed = ${processedImports.length},
      above_goal_days = ${aboveGoalDays},
      within_goal_days = ${withinGoalDays},
      total_meal_cost = ${totalMealCost},
      total_goal = ${totalGoal},
      total_suggestions = ${totalSuggestions},
      total_estimated_financial_impact = ${totalEstimatedFinancialImpact},
      total_contractual_estimated_financial_impact = ${totalContractualEstimatedFinancialImpact},
      total_goal_estimated_financial_impact = ${totalGoalEstimatedFinancialImpact},
      processed_imports_json = ${JSON.stringify(processedImports)},
      updated_at = NOW()
    WHERE id = ${row.id}
  `

  const financialGoal = typeof row.financial_goal === 'number' ? row.financial_goal : Number(row.financial_goal)

  return {
    status: 'ok',
    cycle: {
      fileName: row.source_file_name,
      unitName: row.unit_name,
      serviceName: row.service_name,
      mealType: row.meal_type,
      financialGoal: Number(financialGoal.toFixed(2)),
      daysParsed: row.days_parsed,
      importsProcessed: processedImports.length,
      summaryMonth: row.summary_month,
      aboveGoalDays,
      withinGoalDays,
      failedItems,
      totalMealCost,
      totalGoal,
      totalSuggestions,
      totalEstimatedFinancialImpact,
      totalContractualEstimatedFinancialImpact,
      totalGoalEstimatedFinancialImpact,
    },
    imports: processedImports,
    reprocess: {
      failedItemsBefore,
      recoveredItems,
      skippedItems,
      failedItemsAfter: failedItems,
    },
  }
})

app.get('/menus/imports', { preHandler: authenticate }, async (request, reply) => {
  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const parsedQuery = menuImportListQuerySchema.safeParse(request.query);
  const limit = parsedQuery.success ? parsedQuery.data.limit : 20;
  const companyName = getCompanyFromJwt(request);

  await ensureDomainTables();

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    file_name: string;
    unit_name: string;
    service_name: string;
    reference_date: Date;
    meal_type: string;
    financial_goal: number | string;
    meal_cost: number | string;
    exceeded_value: number | string;
    exceeded_percent: number | string;
    validation_status: string;
    recipes_json: string;
    created_at: Date;
  }>>`
    SELECT
      id,
      file_name,
      unit_name,
      service_name,
      reference_date,
      meal_type,
      financial_goal,
      meal_cost,
      exceeded_value,
      exceeded_percent,
      validation_status,
      recipes_json,
      created_at
    FROM menu_pdf_imports
    WHERE company_name = ${companyName}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  const parseNumber = (value: number | string) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number(parsed.toFixed(2));
  };

  return {
    status: 'ok',
    imports: rows.map((item: any) => ({
      id: item.id,
      fileName: item.file_name,
      unitName: item.unit_name,
      serviceName: item.service_name,
      referenceDate: item.reference_date.toISOString(),
      mealType: item.meal_type,
      financialGoal: parseNumber(item.financial_goal),
      mealCost: parseNumber(item.meal_cost),
      exceededValue: parseNumber(item.exceeded_value),
      exceededPercent: parseNumber(item.exceeded_percent),
      validationStatus: item.validation_status,
      recipes: JSON.parse(item.recipes_json) as string[],
      createdAt: item.created_at.toISOString(),
    })),
  };
});

app.get('/menus/operational-cardapios', { preHandler: authenticate }, async (request, reply) => {
  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    })
  }

  const parsedQuery = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(12),
  }).safeParse(request.query)

  const limit = parsedQuery.success ? parsedQuery.data.limit : 12
  const companyName = getCompanyFromJwt(request)

  await ensureDomainTables()

  const rows = await prisma.$queryRaw<Array<{
    id: string
    entry_label: string
    unit_name: string
    service_name: string
    reference_date: Date
    meal_type: string
    financial_goal: number | string
    meal_cost: number | string
    exceeded_value: number | string
    exceeded_percent: number | string
    validation_status: string
    recipes_json: string
    created_at: Date
  }>>`
    SELECT
      id,
      entry_label,
      unit_name,
      service_name,
      reference_date,
      meal_type,
      financial_goal,
      meal_cost,
      exceeded_value,
      exceeded_percent,
      validation_status,
      recipes_json,
      created_at
    FROM menu_operational_cardapios
    WHERE company_name = ${companyName}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `

  const parseNumber = (value: number | string) => {
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number(parsed.toFixed(2))
  }

  return {
    status: 'ok',
    operationalCardapios: rows.map((item: any) => ({
      id: item.id,
      entryLabel: item.entry_label,
      unitName: item.unit_name,
      serviceName: item.service_name,
      referenceDate: item.reference_date.toISOString(),
      mealType: item.meal_type,
      financialGoal: parseNumber(item.financial_goal),
      mealCost: parseNumber(item.meal_cost),
      exceededValue: parseNumber(item.exceeded_value),
      exceededPercent: parseNumber(item.exceeded_percent),
      validationStatus: item.validation_status,
      recipes: JSON.parse(item.recipes_json) as string[],
      createdAt: item.created_at.toISOString(),
    })),
  }
})

app.post('/menus/imports/:importId/adjusted-version', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = menuImportParamsSchema.safeParse(request.params);
  const parsedBody = adjustedVersionGenerationSchema.safeParse(request.body ?? {});

  if (!parsedParams.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Identificador de importacao invalido.',
    });
  }

  if (!parsedBody.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Payload de geracao de versao ajustada invalido.',
    });
  }

  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const companyName = getCompanyFromJwt(request);
  const importId = parsedParams.data.importId;
  const { monthsAhead } = parsedBody.data;

  await ensureDomainTables();

  const importRows = await prisma.$queryRaw<Array<{
    unit_name: string;
    service_name: string;
    meal_cost: number | string;
    financial_goal: number | string;
    reference_date: Date | string;
    recipes_json: string;
  }>>`
    SELECT unit_name, service_name, meal_cost, financial_goal, reference_date, recipes_json
    FROM menu_pdf_imports
    WHERE id = ${importId}
      AND company_name = ${companyName}
    LIMIT 1
  `;

  const imported = importRows[0];

  if (!imported) {
    return reply.code(404).send({
      status: 'error',
      message: 'Importacao de cardapio nao encontrada para esta empresa.',
    });
  }

  const suggestionRows = await prisma.$queryRaw<Array<{
    id: string;
    suggestion_text: string;
    estimated_financial_impact: number | string;
    estimated_nutritional_impact: string;
    priority_level: 'high' | 'medium';
  }>>`
    SELECT
      id,
      suggestion_text,
      estimated_financial_impact,
      estimated_nutritional_impact,
      priority_level
    FROM menu_import_adjustment_suggestions
    WHERE menu_import_id = ${importId}
      AND company_name = ${companyName}
    ORDER BY created_at DESC
  `;

  if (!suggestionRows.length) {
    return reply.code(400).send({
      status: 'error',
      message: 'Nao existem sugestoes para gerar versao ajustada.',
    });
  }

  const parseNumber = (value: number | string) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number(parsed.toFixed(2));
  };

  const currentMealCost = parseNumber(imported.meal_cost);
  const financialGoal = parseNumber(imported.financial_goal);
  const totalFinancialImpact = Number(
    suggestionRows
      .reduce((sum: any, item: any) => sum + parseNumber(item.estimated_financial_impact), 0)
      .toFixed(2),
  );

  const baseReferenceDate = new Date(imported.reference_date);
  const shiftedDate = new Date(Date.UTC(
    baseReferenceDate.getUTCFullYear(),
    baseReferenceDate.getUTCMonth() + monthsAhead,
    1,
  ));
  const targetMonth = `${shiftedDate.getUTCFullYear()}-${String(shiftedDate.getUTCMonth() + 1).padStart(2, '0')}`;

  const commemorativeRows = await prisma.$queryRaw<Array<{
    reference_date: Date | string;
    title: string;
    noble_dish_hint: string | null;
  }>>`
    SELECT reference_date, title, noble_dish_hint
    FROM menu_commemorative_dates
    WHERE company_name = ${companyName}
      AND TO_CHAR(reference_date, 'YYYY-MM') = ${targetMonth}
    ORDER BY reference_date ASC
  `;

  const commemorativeContext = {
    targetMonth,
    planningMonthsAhead: monthsAhead,
    prioritizeNobleDishes: commemorativeRows.length > 0,
    commemorativeDates: commemorativeRows.map((item: any) => ({
      referenceDate:
        item.reference_date instanceof Date
          ? item.reference_date.toISOString().slice(0, 10)
          : String(item.reference_date).slice(0, 10),
      title: item.title,
      nobleDishHint: item.noble_dish_hint,
    })),
  };

  const nobleDishExtraCostFactor = commemorativeContext.prioritizeNobleDishes ? 1.08 : 1;
  const adjustedMealCost = Number(
    Math.max((currentMealCost + totalFinancialImpact) * nobleDishExtraCostFactor, financialGoal * 0.85).toFixed(2),
  );

  const versionCountRows = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*)::int AS total
    FROM menu_adjusted_versions
    WHERE menu_import_id = ${importId}
      AND company_name = ${companyName}
  `;

  const nextVersionNumber = (versionCountRows[0]?.total ?? 0) + 1;
  const versionId = randomUUID();
  const versionLabel = `v${nextVersionNumber}`;
  const nutritionalImpactSummary = suggestionRows
    .map((item: any) => item.estimated_nutritional_impact)
    .filter((value: any, index: any, source: any) => source.indexOf(value) === index)
    .join(' | ');
  const appliedSuggestions = suggestionRows.map((item: any) => ({
    id: item.id,
    suggestionText: item.suggestion_text,
    estimatedFinancialImpact: parseNumber(item.estimated_financial_impact),
    estimatedNutritionalImpact: item.estimated_nutritional_impact,
    priorityLevel: item.priority_level,
  }));

  await prisma.$executeRaw`
    INSERT INTO menu_adjusted_versions (
      id,
      company_name,
      menu_import_id,
      version_label,
      target_month,
      planning_months_ahead,
      adjusted_meal_cost,
      total_financial_impact,
      nutritional_impact_summary,
      commemorative_context_json,
      applied_suggestions_json
    )
    VALUES (
      ${versionId},
      ${companyName},
      ${importId},
      ${versionLabel},
      ${targetMonth},
      ${monthsAhead},
      ${adjustedMealCost},
      ${totalFinancialImpact},
      ${nutritionalImpactSummary || 'Sem alteracoes nutricionais relevantes.'},
      ${JSON.stringify(commemorativeContext)},
      ${JSON.stringify(appliedSuggestions)}
    )
  `;

  await recordAiPreparationEvent({
    companyName,
    moduleKey: 'menus',
    sourceKind: 'adjusted-version-generation',
    providerKey: 'structured-ready',
    data: buildMenuPreparationContext({
      companyName,
      importId,
      unitName: imported.unit_name,
      serviceName: imported.service_name,
      referenceDate:
        typeof imported.reference_date === 'string'
          ? imported.reference_date.slice(0, 10)
          : imported.reference_date.toISOString().slice(0, 10),
      monthsAhead,
      recipes: (() => {
        try {
          return JSON.parse(imported.recipes_json) as string[];
        } catch {
          return [];
        }
      })(),
      targetMonth,
      commemorativeDates: commemorativeContext.commemorativeDates,
    }),
  });

  return reply.code(201).send({
    status: 'ok',
    adjustedVersion: {
      id: versionId,
      versionLabel,
      targetMonth,
      planningMonthsAhead: monthsAhead,
      adjustedMealCost,
      totalFinancialImpact,
      nutritionalImpactSummary: nutritionalImpactSummary || 'Sem alteracoes nutricionais relevantes.',
      commemorativeContext,
      appliedSuggestions,
      createdAt: new Date().toISOString(),
    },
  });
});

app.get('/menus/imports/:importId/adjusted-versions', { preHandler: authenticate }, async (request, reply) => {
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
  const importId = parsedParams.data.importId;

  await ensureDomainTables();

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    version_label: string;
    target_month: string | null;
    planning_months_ahead: number | null;
    adjusted_meal_cost: number | string;
    total_financial_impact: number | string;
    nutritional_impact_summary: string;
    commemorative_context_json: string | null;
    applied_suggestions_json: string;
    created_at: Date;
  }>>`
    SELECT
      id,
      version_label,
      target_month,
      planning_months_ahead,
      adjusted_meal_cost,
      total_financial_impact,
      nutritional_impact_summary,
      commemorative_context_json,
      applied_suggestions_json,
      created_at
    FROM menu_adjusted_versions
    WHERE menu_import_id = ${importId}
      AND company_name = ${companyName}
    ORDER BY created_at DESC
  `;

  const parseNumber = (value: number | string) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number(parsed.toFixed(2));
  };

  return {
    status: 'ok',
    versions: rows.map((item: any) => ({
      id: item.id,
      versionLabel: item.version_label,
      targetMonth: item.target_month,
      planningMonthsAhead: item.planning_months_ahead ?? 0,
      adjustedMealCost: parseNumber(item.adjusted_meal_cost),
      totalFinancialImpact: parseNumber(item.total_financial_impact),
      nutritionalImpactSummary: item.nutritional_impact_summary,
      commemorativeContext: item.commemorative_context_json
        ? JSON.parse(item.commemorative_context_json) as {
            targetMonth: string;
            planningMonthsAhead: number;
            prioritizeNobleDishes: boolean;
            commemorativeDates: Array<{
              referenceDate: string;
              title: string;
              nobleDishHint: string | null;
            }>;
          }
        : {
            targetMonth: item.target_month ?? '',
            planningMonthsAhead: item.planning_months_ahead ?? 0,
            prioritizeNobleDishes: false,
            commemorativeDates: [],
          },
      appliedSuggestions: JSON.parse(item.applied_suggestions_json) as Array<{
        id: string;
        suggestionText: string;
        estimatedFinancialImpact: number;
        estimatedNutritionalImpact: string;
        priorityLevel: 'high' | 'medium';
      }>,
      createdAt: item.created_at.toISOString(),
    })),
  };
});

app.post('/menus/commemorative-dates', { preHandler: authenticate }, async (request, reply) => {
  const parsed = commemorativeDateSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Payload de data comemorativa invalido.',
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
  const payload = parsed.data;
  const dateYear = Number(payload.referenceDate.slice(0, 4));
  const id = randomUUID();

  await ensureDomainTables();

  await prisma.$executeRaw`
    INSERT INTO menu_commemorative_dates (
      id,
      company_name,
      reference_date,
      date_year,
      title,
      noble_dish_hint,
      created_by
    )
    VALUES (
      ${id},
      ${companyName},
      ${payload.referenceDate},
      ${dateYear},
      ${payload.title.trim()},
      ${payload.nobleDishHint?.trim() || null},
      ${actor.name}
    )
    ON CONFLICT (company_name, reference_date)
    DO UPDATE SET
      title = EXCLUDED.title,
      noble_dish_hint = EXCLUDED.noble_dish_hint,
      created_by = EXCLUDED.created_by
  `;

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    reference_date: Date | string;
    date_year: number;
    title: string;
    noble_dish_hint: string | null;
    created_by: string;
    created_at: Date | string;
  }>>`
    SELECT id, reference_date, date_year, title, noble_dish_hint, created_by, created_at
    FROM menu_commemorative_dates
    WHERE company_name = ${companyName}
      AND reference_date = ${payload.referenceDate}
    LIMIT 1
  `;

  const created = rows[0];

  return reply.code(201).send({
    status: 'ok',
    commemorativeDate: {
      id: created.id,
      referenceDate:
        created.reference_date instanceof Date
          ? created.reference_date.toISOString().slice(0, 10)
          : String(created.reference_date).slice(0, 10),
      year: created.date_year,
      title: created.title,
      nobleDishHint: created.noble_dish_hint,
      createdBy: created.created_by,
      createdAt: created.created_at,
    },
  });
});

app.get('/menus/commemorative-dates', { preHandler: authenticate }, async (request, reply) => {
  const parsedQuery = commemorativeDateListQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Parametros de consulta invalidos para datas comemorativas.',
    });
  }

  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const companyName = getCompanyFromJwt(request);
  const { year, limit } = parsedQuery.data;

  await ensureDomainTables();

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    reference_date: Date | string;
    date_year: number;
    title: string;
    noble_dish_hint: string | null;
    created_by: string;
    created_at: Date | string;
  }>>`
    SELECT id, reference_date, date_year, title, noble_dish_hint, created_by, created_at
    FROM menu_commemorative_dates
    WHERE company_name = ${companyName}
      AND date_year = ${year}
    ORDER BY reference_date ASC
    LIMIT ${limit}
  `;

  return {
    status: 'ok',
    year,
    commemorativeDates: rows.map((item: any) => ({
      id: item.id,
      referenceDate:
        item.reference_date instanceof Date
          ? item.reference_date.toISOString().slice(0, 10)
          : String(item.reference_date).slice(0, 10),
      year: item.date_year,
      title: item.title,
      nobleDishHint: item.noble_dish_hint,
      createdBy: item.created_by,
      createdAt: item.created_at,
    })),
  };
});
  };

  return {
    repository,
    registerRoutes,
  };
};
