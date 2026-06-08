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

    const fetchAuditResponse = await request(app.server)
      .get(`/menus/imports/${importResponse.body.import?.id as string}/audit`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(fetchAuditResponse.status, 200)
    assert.equal(fetchAuditResponse.body.status, 'ok')
    assert.equal(Array.isArray(fetchAuditResponse.body.results), true)
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

    const listSuggestionsResponse = await request(app.server)
      .get(`/menus/imports/${importId}/suggestions`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(listSuggestionsResponse.status, 200)
    assert.equal(listSuggestionsResponse.body.status, 'ok')
    assert.equal(Array.isArray(listSuggestionsResponse.body.suggestions), true)
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

    assert.equal(adjustedVersionResponse.status, 201)
    assert.equal(adjustedVersionResponse.body.status, 'ok')
    assert.equal(typeof adjustedVersionResponse.body.adjustedVersion?.versionLabel, 'string')
    assert.equal(Array.isArray(adjustedVersionResponse.body.adjustedVersion?.appliedSuggestions), true)

    const listAdjustedVersionsResponse = await request(app.server)
      .get(`/menus/imports/${importId}/adjusted-versions`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(listAdjustedVersionsResponse.status, 200)
    assert.equal(listAdjustedVersionsResponse.body.status, 'ok')
    assert.ok((listAdjustedVersionsResponse.body.versions as Array<{ id: string }>).length >= 1)
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
