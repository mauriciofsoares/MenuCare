import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import { app } from './server.js'

describe('API integration', () => {
  before(async () => {
    await app.ready()
  })

  after(async () => {
    await app.close()
  })

  it('health endpoint should return service ok', async () => {
    const response = await request(app.server).get('/health')

    assert.equal(response.status, 200)
    assert.equal(response.body.status, 'ok')
    assert.equal(response.body.service, 'menucare-api')
  })

  it('login should reject wrong password', async () => {
    const response = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'wrong-password',
    })

    assert.equal(response.status, 401)
    assert.equal(response.body.status, 'error')
  })

  it('login should return token with valid credentials', async () => {
    const response = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.status, 'ok')
    assert.equal(typeof response.body.token, 'string')
    assert.ok(response.body.token.length > 20)
    assert.equal(response.body.user?.email, 'admin@menucare.local')
  })

  it('protected endpoint should require authentication', async () => {
    const response = await request(app.server).get('/compliance/exports/audit')

    assert.equal(response.status, 401)
    assert.equal(response.body.status, 'error')
  })

  it('recommendation policy endpoint should return contract with authentication', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const response = await request(app.server)
      .get('/governance/recommendation-policy')
      .set('Authorization', `Bearer ${loginResponse.body.token as string}`)

    assert.equal(response.status, 200)
    assert.equal(response.body.status, 'ok')
    assert.deepEqual(response.body.policy?.priorityOrder, [
      'contract_rules',
      'financial_goal',
      'nutritional_restrictions',
      'operational_rules',
      'historical_ratings',
    ])
    assert.equal(Array.isArray(response.body.policy?.levels), true)
    assert.equal(Array.isArray(response.body.policy?.blockingCriteria), true)
  })

  it('menu import endpoint should create and list pdf imports', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const createResponse = await request(app.server)
      .post('/menus/imports')
      .set('Authorization', `Bearer ${loginResponse.body.token as string}`)
      .send({
        fileName: 'BROKER2.GENIALNET.COM.BR.pdf',
        unitName: 'Hospital Sao Marcelino Champagnat',
        serviceName: 'Almoco',
        referenceDate: '2026-06-08',
        mealType: 'Almoco',
        financialGoal: 14.5,
        mealCost: 15.8,
        recipes: ['Arroz integral', 'Feijao carioca', 'Frango grelhado'],
      })

    if (createResponse.status === 503) {
      assert.equal(createResponse.body.status, 'error')
      return
    }

    assert.equal(createResponse.status, 201)
    assert.equal(createResponse.body.status, 'ok')
    assert.equal(createResponse.body.import?.validationStatus, 'above_goal')
    assert.equal(createResponse.body.import?.fileName, 'BROKER2.GENIALNET.COM.BR.pdf')

    const listResponse = await request(app.server)
      .get('/menus/imports?limit=5')
      .set('Authorization', `Bearer ${loginResponse.body.token as string}`)

    assert.equal(listResponse.status, 200)
    assert.equal(listResponse.body.status, 'ok')
    assert.equal(Array.isArray(listResponse.body.imports), true)
    assert.ok((listResponse.body.imports as Array<{ id: string }>).length >= 1)
  })

  it('recipe import endpoint should accept structured recipes or return db fallback', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const response = await request(app.server)
      .post('/recipes/imports')
      .set('Authorization', `Bearer ${loginResponse.body.token as string}`)
      .send({
        fileName: 'FICHAS-TECNICAS-GENIAL.pdf',
        sourceReference: 'Genial',
        recipes: [
          {
            name: 'Laranja em Gomos',
            ingredients: ['Laranja'],
            preparationMethod: 'Higienizar, descascar e cortar em gomos.',
            perCapita: 0.18,
            yield: 100,
            group: 'Fruta',
            nutritionalInfo: { calories: 46 },
            compatibleDiets: ['geral'],
            allergens: [],
            cost: 0.5,
          },
        ],
      })

    if (response.status === 503) {
      assert.equal(response.body.status, 'error')
      return
    }

    assert.equal(response.status, 201)
    assert.equal(response.body.status, 'ok')
    assert.equal(Array.isArray(response.body.recipeImport?.recipes), true)
  })

  it('recipe manual classification endpoint should reclassify recipe or return db fallback', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const token = loginResponse.body.token as string
    const uniqueName = `Receita de Teste ${Date.now()}`

    const importResponse = await request(app.server)
      .post('/recipes/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'FICHAS-TECNICAS-GENIAL.pdf',
        sourceReference: 'Genial',
        recipes: [
          {
            name: uniqueName,
            ingredients: ['Frango', 'Ervas'],
            preparationMethod: 'Assar e servir.',
            cost: 2.5,
          },
        ],
      })

    if (importResponse.status === 503) {
      assert.equal(importResponse.body.status, 'error')
      return
    }

    assert.equal(importResponse.status, 201)

    const recipeId = importResponse.body.recipeImport?.recipes?.[0]?.id as string
    assert.equal(typeof recipeId, 'string')
    assert.ok(recipeId.length > 10)

    const reclassifyResponse = await request(app.server)
      .patch(`/recipes/${recipeId}/classification`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'Proteina',
        subcategory: 'Frango',
        foodGroup: 'Proteinas',
        confidence: 0.99,
        tags: ['protein', 'poultry'],
        reason: 'Classificacao revisada por nutricionista.',
      })

    assert.equal(reclassifyResponse.status, 200)
    assert.equal(reclassifyResponse.body.status, 'ok')
    assert.equal(reclassifyResponse.body.recipe?.id, recipeId)
    assert.equal(reclassifyResponse.body.recipe?.category, 'Proteina')
    assert.equal(reclassifyResponse.body.recipe?.subcategory, 'Frango')
    assert.equal(reclassifyResponse.body.recipe?.foodGroup, 'Proteinas')

    const listResponse = await request(app.server)
      .get('/recipes?limit=20&active=all')
      .set('Authorization', `Bearer ${token}`)

    assert.equal(listResponse.status, 200)
    assert.equal(listResponse.body.status, 'ok')
    assert.equal(Array.isArray(listResponse.body.recipes), true)

    const reclassified = (listResponse.body.recipes as Array<{
      id: string
      category: string
      subcategory: string
      foodGroup: string
      aiProvider: string
    }>).find((item) => item.id === recipeId)

    assert.ok(reclassified)
    assert.equal(reclassified?.category, 'Proteina')
    assert.equal(reclassified?.subcategory, 'Frango')
    assert.equal(reclassified?.foodGroup, 'Proteinas')
    assert.equal(reclassified?.aiProvider, 'manual-reviewed')
  })

  it('recipe coverage endpoint should return metrics or db fallback', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const response = await request(app.server)
      .get('/recipes/coverage')
      .set('Authorization', `Bearer ${loginResponse.body.token as string}`)

    if (response.status === 503) {
      assert.equal(response.body.status, 'error')
      return
    }

    assert.equal(response.status, 200)
    assert.equal(response.body.status, 'ok')
    assert.equal(typeof response.body.coverage?.totalRecipes, 'number')
    assert.equal(typeof response.body.coverage?.coveragePercent, 'number')
    assert.equal(Array.isArray(response.body.coverage?.categoryDistribution), true)
  })

  it('menu import audit should compare imported recipes against approved rules', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const token = loginResponse.body.token as string

    const contractResponse = await request(app.server)
      .post('/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Contrato Auditoria Cardapio',
        sourceType: 'contract',
        status: 'active',
      })

    if (contractResponse.status === 503) {
      assert.equal(contractResponse.body.status, 'error')
      return
    }

    assert.equal(contractResponse.status, 201)

    const ruleResponse = await request(app.server)
      .post('/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractId: contractResponse.body.contract?.id as string,
        title: 'Frango grelhado obrigatorio no almoco',
        description: 'Cardapio deve conter frango grelhado no almoco',
        category: 'proteina',
        status: 'approved',
      })

    assert.equal(ruleResponse.status, 201)

    const recipeImportResponse = await request(app.server)
      .post('/recipes/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'FICHAS-TECNICAS-GENIAL.pdf',
        sourceReference: 'Genial',
        recipes: [
          {
            name: 'Frango grelhado',
            ingredients: ['Frango', 'Sal'],
            preparationMethod: 'Grelhar e servir.',
            group: 'Proteina',
            cost: 2.1,
          },
        ],
      })

    assert.equal(recipeImportResponse.status, 201)

    const importResponse = await request(app.server)
      .post('/menus/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'BROKER2.GENIALNET.COM.BR.pdf',
        unitName: 'Hospital Sao Marcelino Champagnat',
        serviceName: 'Almoco',
        referenceDate: '2026-06-08',
        mealType: 'Almoco',
        financialGoal: 14.5,
        mealCost: 13.9,
        recipes: ['Arroz integral', 'Feijao carioca', 'Frango grelhado'],
      })

    assert.equal(importResponse.status, 201)

    const auditResponse = await request(app.server)
      .post(`/menus/imports/${importResponse.body.import?.id as string}/audit`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(auditResponse.status, 200)
    assert.equal(auditResponse.body.status, 'ok')
    assert.ok((auditResponse.body.summary?.auditedRules as number) >= 1)
    assert.equal(
      typeof auditResponse.body.results?.[0]?.evidence,
      'string',
    )
    assert.match(
      auditResponse.body.results?.[0]?.evidence as string,
      /classificacao estruturada/i,
    )

    const fetchAuditResponse = await request(app.server)
      .get(`/menus/imports/${importResponse.body.import?.id as string}/audit`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(fetchAuditResponse.status, 200)
    assert.equal(fetchAuditResponse.body.status, 'ok')
    assert.equal(Array.isArray(fetchAuditResponse.body.results), true)
    assert.match(fetchAuditResponse.body.results?.[0]?.evidence as string, /classificacao estruturada/i)
  })

  it('menu import audit should evaluate structured frequency and recurrence rules', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const token = loginResponse.body.token as string

    const contractResponse = await request(app.server)
      .post('/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Contrato Frequencia e Recorrencia',
        sourceType: 'contract',
        status: 'active',
      })

    if (contractResponse.status === 503) {
      assert.equal(contractResponse.body.status, 'error')
      return
    }

    const contractId = contractResponse.body.contract?.id as string

    const citrusRuleResponse = await request(app.server)
      .post('/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractId,
        title: 'Fruta citrica 3x por semana',
        description: 'Cardapio deve contemplar fruta citrica ao menos 3 vezes por semana.',
        category: 'fruta',
        status: 'approved',
      })

    assert.equal(citrusRuleResponse.status, 201)

    const recurrenceRuleResponse = await request(app.server)
      .post('/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractId,
        title: 'Nao repetir peixe em menos de 7 dias',
        description: 'Peixe nao pode reaparecer em menos de 7 dias no mesmo servico.',
        category: 'proteina',
        status: 'approved',
      })

    assert.equal(recurrenceRuleResponse.status, 201)

    const recipeImportResponse = await request(app.server)
      .post('/recipes/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'FICHAS-TECNICAS-GENIAL.pdf',
        sourceReference: 'Genial',
        recipes: [
          {
            name: 'Laranja em Gomos',
            ingredients: ['Laranja'],
            preparationMethod: 'Servir gelada.',
            group: 'Fruta',
            cost: 0.6,
          },
          {
            name: 'Peixe assado',
            ingredients: ['Peixe', 'Ervas'],
            preparationMethod: 'Assar e servir.',
            group: 'Proteina',
            cost: 3.4,
          },
        ],
      })

    assert.equal(recipeImportResponse.status, 201)

    const importPayloads = [
      {
        referenceDate: '2026-06-01',
        recipes: ['Arroz', 'Feijao', 'Laranja em Gomos'],
      },
      {
        referenceDate: '2026-06-03',
        recipes: ['Peixe assado', 'Arroz', 'Laranja em Gomos'],
      },
      {
        referenceDate: '2026-06-05',
        recipes: ['Arroz', 'Feijao', 'Laranja em Gomos'],
      },
      {
        referenceDate: '2026-06-08',
        recipes: ['Peixe assado', 'Arroz', 'Feijao'],
      },
    ]

    let lastImportId = ''

    for (const payload of importPayloads) {
      const importResponse = await request(app.server)
        .post('/menus/imports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fileName: 'BROKER2.GENIALNET.COM.BR.pdf',
          unitName: 'Hospital Sao Marcelino Champagnat',
          serviceName: 'Almoco',
          referenceDate: payload.referenceDate,
          mealType: 'Almoco',
          financialGoal: 14,
          mealCost: 13,
          recipes: payload.recipes,
        })

      assert.equal(importResponse.status, 201)
      lastImportId = importResponse.body.import?.id as string
    }

    const auditResponse = await request(app.server)
      .post(`/menus/imports/${lastImportId}/audit`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(auditResponse.status, 200)
    assert.equal(auditResponse.body.status, 'ok')

    const citrusRuleResult = (auditResponse.body.results as Array<{
      ruleTitle: string
      resultStatus: string
      evidence: string
    }>).find((item) => item.ruleTitle === 'Fruta citrica 3x por semana')

    assert.ok(citrusRuleResult)
    assert.equal(citrusRuleResult?.resultStatus, 'non_compliant')
    assert.match(citrusRuleResult?.evidence as string, /frequencia estruturada/i)
    assert.match(citrusRuleResult?.evidence as string, /minimo exigido 3/i)

    const recurrenceRuleResult = (auditResponse.body.results as Array<{
      ruleTitle: string
      resultStatus: string
      evidence: string
    }>).find((item) => item.ruleTitle === 'Nao repetir peixe em menos de 7 dias')

    assert.ok(recurrenceRuleResult)
    assert.equal(recurrenceRuleResult?.resultStatus, 'non_compliant')
    assert.match(recurrenceRuleResult?.evidence as string, /recorrencia estruturada/i)
    assert.match(recurrenceRuleResult?.evidence as string, /abaixo do minimo de 7 dias/i)
  })

  it('menu import suggestions should be generated from audit and financial context', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const token = loginResponse.body.token as string

    const contractResponse = await request(app.server)
      .post('/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Contrato Sugestoes de Ajuste',
        sourceType: 'contract',
        status: 'active',
      })

    if (contractResponse.status === 503) {
      assert.equal(contractResponse.body.status, 'error')
      return
    }

    const ruleResponse = await request(app.server)
      .post('/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractId: contractResponse.body.contract?.id as string,
        title: 'Peixe no almoco',
        description: 'Cardapio deve conter peixe no almoco de sexta',
        category: 'proteina',
        status: 'approved',
      })

    assert.equal(ruleResponse.status, 201)

    const recipeImportResponse = await request(app.server)
      .post('/recipes/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'FICHAS-TECNICAS-GENIAL.pdf',
        sourceReference: 'Genial',
        recipes: [
          {
            name: 'Peixe assado',
            ingredients: ['Peixe', 'Ervas'],
            preparationMethod: 'Assar e servir.',
            group: 'Proteina',
            cost: 3.2,
          },
          {
            name: 'Frango grelhado',
            ingredients: ['Frango', 'Sal'],
            preparationMethod: 'Grelhar e servir.',
            group: 'Proteina',
            cost: 2.1,
          },
        ],
      })

    assert.equal(recipeImportResponse.status, 201)

    const importResponse = await request(app.server)
      .post('/menus/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'BROKER2.GENIALNET.COM.BR.pdf',
        unitName: 'Hospital Sao Marcelino Champagnat',
        serviceName: 'Almoco',
        referenceDate: '2026-06-08',
        mealType: 'Almoco',
        financialGoal: 10,
        mealCost: 12,
        recipes: ['Arroz', 'Feijao', 'Frango'],
      })

    assert.equal(importResponse.status, 201)

    const importId = importResponse.body.import?.id as string

    const runAuditResponse = await request(app.server)
      .post(`/menus/imports/${importId}/audit`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(runAuditResponse.status, 200)

    const runSuggestionsResponse = await request(app.server)
      .post(`/menus/imports/${importId}/suggestions`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(runSuggestionsResponse.status, 200)
    assert.equal(runSuggestionsResponse.body.status, 'ok')
    assert.ok((runSuggestionsResponse.body.summary?.generatedSuggestions as number) >= 1)
    assert.equal(runSuggestionsResponse.body.suggestions?.[0]?.evidenceSource, 'structured')
    assert.equal(runSuggestionsResponse.body.suggestions?.[0]?.evidenceSubtype, 'classification')
    assert.match(
      runSuggestionsResponse.body.suggestions?.[0]?.suggestionText as string,
      /substituir|peixe assado|classificada como peixe/i,
    )

    const listSuggestionsResponse = await request(app.server)
      .get(`/menus/imports/${importId}/suggestions`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(listSuggestionsResponse.status, 200)
    assert.equal(listSuggestionsResponse.body.status, 'ok')
    assert.equal(Array.isArray(listSuggestionsResponse.body.suggestions), true)
    assert.equal(listSuggestionsResponse.body.suggestions?.[0]?.evidenceSource, 'structured')
    assert.equal(listSuggestionsResponse.body.suggestions?.[0]?.evidenceSubtype, 'classification')
    assert.match(
      listSuggestionsResponse.body.suggestions?.[0]?.suggestionText as string,
      /substituir|peixe assado|classificada como peixe/i,
    )
  })

  it('menu import suggestions should expose explicit structured frequency and recurrence subtypes', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const token = loginResponse.body.token as string

    const contractResponse = await request(app.server)
      .post('/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Contrato Sugestoes Estruturadas R4',
        sourceType: 'contract',
        status: 'active',
      })

    if (contractResponse.status === 503) {
      assert.equal(contractResponse.body.status, 'error')
      return
    }

    const contractId = contractResponse.body.contract?.id as string

    const citrusRuleResponse = await request(app.server)
      .post('/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractId,
        title: 'Fruta citrica 3x por semana',
        description: 'Cardapio deve contemplar fruta citrica ao menos 3 vezes por semana.',
        category: 'fruta',
        status: 'approved',
      })

    assert.equal(citrusRuleResponse.status, 201)

    const recurrenceRuleResponse = await request(app.server)
      .post('/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractId,
        title: 'Nao repetir peixe em menos de 7 dias',
        description: 'Peixe nao pode reaparecer em menos de 7 dias no mesmo servico.',
        category: 'proteina',
        status: 'approved',
      })

    assert.equal(recurrenceRuleResponse.status, 201)

    const recipeImportResponse = await request(app.server)
      .post('/recipes/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'FICHAS-TECNICAS-GENIAL.pdf',
        sourceReference: 'Genial',
        recipes: [
          {
            name: 'Laranja em Gomos',
            ingredients: ['Laranja'],
            preparationMethod: 'Servir gelada.',
            group: 'Fruta',
            cost: 0.6,
          },
          {
            name: 'Peixe assado',
            ingredients: ['Peixe', 'Ervas'],
            preparationMethod: 'Assar e servir.',
            group: 'Proteina',
            cost: 3.4,
          },
          {
            name: 'Frango grelhado',
            ingredients: ['Frango', 'Sal'],
            preparationMethod: 'Grelhar e servir.',
            group: 'Proteina',
            cost: 2.1,
          },
        ],
      })

    assert.equal(recipeImportResponse.status, 201)

    const importPayloads = [
      {
        referenceDate: '2026-06-01',
        recipes: ['Arroz', 'Feijao', 'Laranja em Gomos'],
      },
      {
        referenceDate: '2026-06-03',
        recipes: ['Peixe assado', 'Arroz', 'Laranja em Gomos'],
      },
      {
        referenceDate: '2026-06-05',
        recipes: ['Arroz', 'Feijao', 'Laranja em Gomos'],
      },
      {
        referenceDate: '2026-06-08',
        recipes: ['Peixe assado', 'Arroz', 'Feijao', 'Frango grelhado'],
      },
    ]

    let lastImportId = ''

    for (const payload of importPayloads) {
      const importResponse = await request(app.server)
        .post('/menus/imports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fileName: 'BROKER2.GENIALNET.COM.BR.pdf',
          unitName: 'Hospital Sao Marcelino Champagnat',
          serviceName: 'Almoco',
          referenceDate: payload.referenceDate,
          mealType: 'Almoco',
          financialGoal: 14,
          mealCost: 13,
          recipes: payload.recipes,
        })

      assert.equal(importResponse.status, 201)
      lastImportId = importResponse.body.import?.id as string
    }

    const auditResponse = await request(app.server)
      .post(`/menus/imports/${lastImportId}/audit`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(auditResponse.status, 200)

    const suggestionsResponse = await request(app.server)
      .post(`/menus/imports/${lastImportId}/suggestions`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(suggestionsResponse.status, 200)
    assert.equal(suggestionsResponse.body.status, 'ok')

    const suggestions = suggestionsResponse.body.suggestions as Array<{
      evidenceSource: string
      evidenceSubtype: string | null
      suggestionText: string
    }>

    const frequencySuggestion = suggestions.find((item) =>
      /fruta citrica 3x por semana/i.test(item.suggestionText),
    )
    const recurrenceSuggestion = suggestions.find((item) =>
      /nao repetir peixe em menos de 7 dias/i.test(item.suggestionText),
    )

    assert.ok(frequencySuggestion)
    assert.equal(frequencySuggestion?.evidenceSource, 'structured')
    assert.equal(frequencySuggestion?.evidenceSubtype, 'frequency')

    assert.ok(recurrenceSuggestion)
    assert.equal(recurrenceSuggestion?.evidenceSource, 'structured')
    assert.equal(recurrenceSuggestion?.evidenceSubtype, 'recurrence')

    const listSuggestionsResponse = await request(app.server)
      .get(`/menus/imports/${lastImportId}/suggestions`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(listSuggestionsResponse.status, 200)
    assert.equal(listSuggestionsResponse.body.status, 'ok')

    const listedSuggestions = listSuggestionsResponse.body.suggestions as Array<{
      evidenceSource: string
      evidenceSubtype: string | null
      suggestionText: string
    }>

    assert.equal(
      listedSuggestions.find((item) => /fruta citrica 3x por semana/i.test(item.suggestionText))
        ?.evidenceSubtype,
      'frequency',
    )
    assert.equal(
      listedSuggestions.find((item) => /nao repetir peixe em menos de 7 dias/i.test(item.suggestionText))
        ?.evidenceSubtype,
      'recurrence',
    )
  })

  it('menu adjusted version should track applied suggestions and impacts', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const token = loginResponse.body.token as string

    const contractResponse = await request(app.server)
      .post('/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Contrato Versao Ajustada',
        sourceType: 'contract',
        status: 'active',
      })

    if (contractResponse.status === 503) {
      assert.equal(contractResponse.body.status, 'error')
      return
    }

    const ruleResponse = await request(app.server)
      .post('/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractId: contractResponse.body.contract?.id as string,
        title: 'Fruta citrica obrigatoria no almoco',
        description: 'Cardapio de almoco deve conter fruta citrica',
        category: 'fruta',
        status: 'approved',
      })

    assert.equal(ruleResponse.status, 201)

    const importResponse = await request(app.server)
      .post('/menus/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'BROKER2.GENIALNET.COM.BR.pdf',
        unitName: 'Hospital Sao Marcelino Champagnat',
        serviceName: 'Almoco',
        referenceDate: '2026-06-08',
        mealType: 'Almoco',
        financialGoal: 11,
        mealCost: 13,
        recipes: ['Arroz', 'Feijao', 'Frango'],
      })

    assert.equal(importResponse.status, 201)

    const importId = importResponse.body.import?.id as string

    const auditResponse = await request(app.server)
      .post(`/menus/imports/${importId}/audit`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(auditResponse.status, 200)

    const suggestionsResponse = await request(app.server)
      .post(`/menus/imports/${importId}/suggestions`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(suggestionsResponse.status, 200)

    const adjustedVersionResponse = await request(app.server)
      .post(`/menus/imports/${importId}/adjusted-version`)
      .set('Authorization', `Bearer ${token}`)
      .send({ monthsAhead: 0 })

    assert.equal(adjustedVersionResponse.status, 201)
    assert.equal(adjustedVersionResponse.body.status, 'ok')
    assert.equal(typeof adjustedVersionResponse.body.adjustedVersion?.versionLabel, 'string')
    assert.equal(adjustedVersionResponse.body.adjustedVersion?.planningMonthsAhead, 0)
    assert.equal(Array.isArray(adjustedVersionResponse.body.adjustedVersion?.appliedSuggestions), true)

    const listAdjustedVersionsResponse = await request(app.server)
      .get(`/menus/imports/${importId}/adjusted-versions`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(listAdjustedVersionsResponse.status, 200)
    assert.equal(listAdjustedVersionsResponse.body.status, 'ok')
    assert.ok((listAdjustedVersionsResponse.body.versions as Array<{ id: string }>).length >= 1)
  })

  it('commemorative dates should influence adjusted version for future months', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const token = loginResponse.body.token as string

    const importResponse = await request(app.server)
      .post('/menus/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'BROKER2.GENIALNET.COM.BR.pdf',
        unitName: 'Hospital Sao Marcelino Champagnat',
        serviceName: 'Almoco',
        referenceDate: '2026-06-08',
        mealType: 'Almoco',
        financialGoal: 11,
        mealCost: 12,
        recipes: ['Arroz', 'Feijao', 'Frango'],
      })

    if (importResponse.status === 503) {
      assert.equal(importResponse.body.status, 'error')
      return
    }

    const importId = importResponse.body.import?.id as string

    const commemResponse = await request(app.server)
      .post('/menus/commemorative-dates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        referenceDate: '2026-08-15',
        title: 'Dia da Gastronomia Hospitalar',
        nobleDishHint: 'Filé mignon ao molho madeira',
      })

    assert.equal(commemResponse.status, 201)
    assert.equal(commemResponse.body.status, 'ok')

    const suggestionsResponse = await request(app.server)
      .post(`/menus/imports/${importId}/suggestions`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(suggestionsResponse.status, 200)

    const adjustedVersionResponse = await request(app.server)
      .post(`/menus/imports/${importId}/adjusted-version`)
      .set('Authorization', `Bearer ${token}`)
      .send({ monthsAhead: 2 })

    assert.equal(adjustedVersionResponse.status, 201)
    assert.equal(adjustedVersionResponse.body.status, 'ok')
    assert.equal(adjustedVersionResponse.body.adjustedVersion?.targetMonth, '2026-08')
    assert.equal(adjustedVersionResponse.body.adjustedVersion?.commemorativeContext?.prioritizeNobleDishes, true)

    const listCommemorativeResponse = await request(app.server)
      .get('/menus/commemorative-dates?year=2026&limit=10')
      .set('Authorization', `Bearer ${token}`)

    assert.equal(listCommemorativeResponse.status, 200)
    assert.equal(listCommemorativeResponse.body.status, 'ok')
    assert.ok((listCommemorativeResponse.body.commemorativeDates as Array<{ id: string }>).length >= 1)
  })

  it('evaluation import and intelligence rebuild should generate combination insights', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const token = loginResponse.body.token as string

    const importMenuResponse = await request(app.server)
      .post('/menus/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'BROKER2.GENIALNET.COM.BR.pdf',
        unitName: 'Hospital Sao Marcelino Champagnat',
        serviceName: 'Almoco',
        referenceDate: '2026-06-08',
        mealType: 'Almoco',
        financialGoal: 12,
        mealCost: 11.5,
        recipes: ['Arroz integral', 'Feijao', 'Frango grelhado'],
      })

    if (importMenuResponse.status === 503) {
      assert.equal(importMenuResponse.body.status, 'error')
      return
    }

    assert.equal(importMenuResponse.status, 201)

    const importEvaluationResponse = await request(app.server)
      .post('/evaluations/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'AVALIACOES-GENIALNET.pdf',
        unitName: 'Hospital Sao Marcelino Champagnat',
        serviceName: 'Almoco',
        referenceDate: '2026-06-08',
        score: 8.6,
        evaluationsCount: 47,
        comments: 'Boa aceitacao geral da combinacao.',
      })

    assert.equal(importEvaluationResponse.status, 201)
    assert.equal(importEvaluationResponse.body.status, 'ok')

    const rebuildResponse = await request(app.server)
      .post('/evaluations/intelligence/rebuild')
      .set('Authorization', `Bearer ${token}`)

    assert.equal(rebuildResponse.status, 200)
    assert.equal(rebuildResponse.body.status, 'ok')
    assert.ok((rebuildResponse.body.summary?.generatedCombinations as number) >= 1)

    const listResponse = await request(app.server)
      .get('/evaluations/intelligence?limit=10')
      .set('Authorization', `Bearer ${token}`)

    assert.equal(listResponse.status, 200)
    assert.equal(listResponse.body.status, 'ok')
    assert.equal(Array.isArray(listResponse.body.combinations), true)
    assert.ok((listResponse.body.combinations as Array<{ id: string }>).length >= 1)
  })

  it('recommendation preview should keep historical layer non-blocking', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const token = loginResponse.body.token as string

    const menuImportResponse = await request(app.server)
      .post('/menus/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'BROKER2.GENIALNET.COM.BR.pdf',
        unitName: 'Hospital Sao Marcelino Champagnat',
        serviceName: 'Almoco',
        referenceDate: '2026-06-08',
        mealType: 'Almoco',
        financialGoal: 12,
        mealCost: 11,
        recipes: ['Arroz integral', 'Feijao', 'Frango grelhado'],
      })

    if (menuImportResponse.status === 503) {
      assert.equal(menuImportResponse.body.status, 'error')
      return
    }

    assert.equal(menuImportResponse.status, 201)

    await request(app.server)
      .post('/evaluations/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'AVALIACOES-GENIALNET.pdf',
        unitName: 'Hospital Sao Marcelino Champagnat',
        serviceName: 'Almoco',
        referenceDate: '2026-06-08',
        score: 8.1,
        evaluationsCount: 32,
      })

    await request(app.server)
      .post('/evaluations/intelligence/rebuild')
      .set('Authorization', `Bearer ${token}`)

    const previewResponse = await request(app.server)
      .get(`/governance/recommendations/${menuImportResponse.body.import?.id as string}`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(previewResponse.status, 200)
    assert.equal(previewResponse.body.status, 'ok')
    assert.equal(previewResponse.body.recommendation?.historicalLayer?.nonBlocking, true)
    assert.equal(Array.isArray(previewResponse.body.recommendation?.historicalLayer?.recommendedCombinations), true)
  })

  it('next menu proposal should use historical layer as recommendation and never as blocker', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const token = loginResponse.body.token as string

    const menuImportResponse = await request(app.server)
      .post('/menus/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'BROKER2.GENIALNET.COM.BR.pdf',
        unitName: 'Hospital Sao Marcelino Champagnat',
        serviceName: 'Almoco',
        referenceDate: '2026-06-09',
        mealType: 'Almoco',
        financialGoal: 12,
        mealCost: 11.8,
        recipes: ['Arroz', 'Feijao', 'Frango grelhado'],
      })

    if (menuImportResponse.status === 503) {
      assert.equal(menuImportResponse.body.status, 'error')
      return
    }

    await request(app.server)
      .post('/evaluations/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'AVALIACOES-GENIALNET.pdf',
        unitName: 'Hospital Sao Marcelino Champagnat',
        serviceName: 'Almoco',
        referenceDate: '2026-06-09',
        score: 9,
        evaluationsCount: 20,
      })

    await request(app.server)
      .post('/evaluations/intelligence/rebuild')
      .set('Authorization', `Bearer ${token}`)

    const proposalResponse = await request(app.server)
      .post(`/governance/recommendations/${menuImportResponse.body.import?.id as string}/next-menu`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(proposalResponse.status, 200)
    assert.equal(proposalResponse.body.status, 'ok')
    assert.equal(proposalResponse.body.nextMenuProposal?.historicalLayer?.nonBlocking, true)
    assert.equal(Array.isArray(proposalResponse.body.nextMenuProposal?.recipes), true)
  })

  it('next menu decision should persist approval workflow with governance enforcement', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const token = loginResponse.body.token as string

    const menuImportResponse = await request(app.server)
      .post('/menus/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'BROKER2.GENIALNET.COM.BR.pdf',
        unitName: 'Hospital Sao Marcelino Champagnat',
        serviceName: 'Jantar',
        referenceDate: '2026-06-10',
        mealType: 'Jantar',
        financialGoal: 14,
        mealCost: 13.5,
        recipes: ['Sopa de legumes', 'File de peixe', 'Pure de batata'],
      })

    if (menuImportResponse.status === 503) {
      assert.equal(menuImportResponse.body.status, 'error')
      return
    }

    const importId = menuImportResponse.body.import?.id as string

    const decisionResponse = await request(app.server)
      .post(`/governance/recommendations/${importId}/next-menu/decision`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        decision: 'approved',
        justification: 'Cardapio aprovado para o proximo ciclo por aderencia contratual e financeira.',
      })

    assert.equal(decisionResponse.status, 201)
    assert.equal(decisionResponse.body.status, 'ok')
    assert.equal(decisionResponse.body.decision?.status, 'approved')
    assert.equal(decisionResponse.body.decision?.nextMenuProposal?.historicalLayer?.nonBlocking, true)

    const listResponse = await request(app.server)
      .get(`/governance/recommendations/${importId}/next-menu/decisions?limit=5`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(listResponse.status, 200)
    assert.equal(listResponse.body.status, 'ok')
    assert.equal(Array.isArray(listResponse.body.decisions), true)
    assert.ok((listResponse.body.decisions as Array<{ id: string }>).length >= 1)
  })

  it('login should return 429 after too many failed attempts', async () => {
    const targetEmail = 'blocked@menucare.local'

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const response = await request(app.server).post('/auth/login').send({
        email: targetEmail,
        password: 'wrong-password',
      })

      assert.equal(response.status, 401)
    }

    const thresholdResponse = await request(app.server).post('/auth/login').send({
      email: targetEmail,
      password: 'wrong-password',
    })

    assert.equal(thresholdResponse.status, 429)
    assert.equal(thresholdResponse.body.status, 'error')

    const blockedResponse = await request(app.server).post('/auth/login').send({
      email: targetEmail,
      password: 'wrong-password',
    })

    assert.equal(blockedResponse.status, 429)
    assert.equal(blockedResponse.body.status, 'error')
  })
})
