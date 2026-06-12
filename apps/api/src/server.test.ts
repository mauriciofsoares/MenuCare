import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import { app } from './server.js'

const getFirstSetCookie = (header: string | string[] | undefined) => {
  if (!header) {
    return ''
  }

  if (Array.isArray(header)) {
    return header[0] ?? ''
  }

  return header
}

const buildUniqueLabel = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const loginToken = async () => {
  const response = await request(app.server).post('/auth/login').send({
    email: 'admin@menucare.local',
    password: 'Admin@123',
  })

  assert.equal(response.status, 200)
  assert.equal(typeof response.body.token, 'string')

  return response.body.token as string
}

const getAuthorizedSites = async (token: string) => {
  const response = await request(app.server)
    .get('/auth/me')
    .set('Authorization', `Bearer ${token}`)

  assert.equal(response.status, 200)
  assert.equal(Array.isArray(response.body.authorizedSites), true)

  const sites = response.body.authorizedSites as Array<{ id: string; name: string }>
  assert.ok(sites.length > 0)
  return sites
}

const getDefaultSiteId = async (token: string) => {
  const sites = await getAuthorizedSites(token)
  return sites[0]?.id as string
}

const ruleEvidence = (label: string) => ({
  sourceExcerpt: `Clausula contratual validada para ${label}.`,
  sourcePage: 1,
  evidenceConfidence: 0.95,
})

const approveRule = async (token: string, ruleId: string) => {
  const response = await request(app.server)
    .patch(`/rules/${ruleId}/status`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      status: 'approved',
      note: 'Aprovacao humana registrada para fixture de teste.',
    })

  assert.equal(response.status, 200)
  assert.equal(response.body.status, 'ok')
}

const createOperationalControl = async (token: string, controlStatus: 'DRAFT' | 'ACTIVE' = 'DRAFT') => {
  const suffix = buildUniqueLabel('controle-operacional')

  const contractResponse = await request(app.server)
    .post('/contracts')
    .set('Authorization', `Bearer ${token}`)
    .field('title', `Contrato ${suffix}`)
    .field('sourceType', 'contract')
    .field('siteId', await getDefaultSiteId(token))

  assert.equal(contractResponse.status, 201)

  const ruleResponse = await request(app.server)
    .post('/rules')
    .set('Authorization', `Bearer ${token}`)
    .send({
      contractId: contractResponse.body.contract?.id as string,
      title: `Regra ${suffix}`,
      description: 'Garantia operacional com evidência documental rastreável.',
      category: 'operations',
      sourceExcerpt: 'Cláusula operacional com trecho validado do contrato.',
      sourcePage: 1,
      evidenceConfidence: 0.952,
      status: 'approved',
    })

  assert.equal(ruleResponse.status, 201)
  await approveRule(token, ruleResponse.body.rule?.id as string)

  const promoteResponse = await request(app.server)
    .post(`/rules/${ruleResponse.body.rule?.id as string}/promote-control`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: `Controle ${suffix}`,
      operationalDescription: 'Verificar o cumprimento operacional dentro da janela definida.',
      frequency: 'daily',
      responsible: 'Supervisao operacional',
      expectedEvidence: 'Checklist assinado com referencia documental.',
      status: controlStatus,
    })

  assert.equal(promoteResponse.status, 201)

  return {
    contractId: contractResponse.body.contract?.id as string,
    ruleId: ruleResponse.body.rule?.id as string,
    controlId: promoteResponse.body.control?.id as string,
    contractTitle: contractResponse.body.contract?.title as string,
    ruleTitle: ruleResponse.body.rule?.title as string,
  }
}

const getControlDetail = async (token: string, controlId: string) => {
  const response = await request(app.server)
    .get(`/compliance-controls/${encodeURIComponent(controlId)}`)
    .set('Authorization', `Bearer ${token}`)

  assert.equal(response.status, 200)
  return response.body as {
    control: { id: string; status: string; origin?: { contractTitle?: string | null; ruleTitle?: string | null; page?: number | null; excerpt?: string | null } };
    events: Array<{ id: string; previousStatus: string; nextStatus: string; description: string; justification?: string | null; evidenceReference?: string | null; actorName: string; createdAt: string }>;
    findings: Array<{ id: string; status: string; severity: string; description: string; detectedAt: string; resolvedAt?: string | null; resolvedBy?: string | null; createdBy: string }>;
    findingEvents: Array<{ id: string; findingId: string; previousStatus: string; nextStatus: string; description: string; evidenceReference?: string | null; actorName: string; createdAt: string }>;
    evidenceReferences: Array<{ id: string; sourceType: string; page?: number | null; section?: string | null; excerpt?: string | null; createdAt: string }>;
    timeline: Array<{ id: string; type: 'event' | 'execution' | 'finding'; title: string; description: string; actorName: string; createdAt: string }>;
  }
}

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
    assert.match(getFirstSetCookie(response.headers['set-cookie'] as string | string[] | undefined), /menucare_refresh_token=/i)
  })

  it('/auth/me should return authorized sites', async () => {
    const token = await loginToken()

    const response = await request(app.server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)

    assert.equal(response.status, 200)
    assert.equal(response.body.status, 'ok')
    assert.equal(Array.isArray(response.body.authorizedSites), true)
    assert.ok(response.body.authorizedSites.length > 0)
    assert.equal(typeof response.body.authorizedSites[0].id, 'string')
    assert.equal(typeof response.body.authorizedSites[0].name, 'string')
  })

  it('authorized unit user should create and list contracts scoped to selected site', async () => {
    const token = await loginToken()
    const siteId = await getDefaultSiteId(token)
    const suffix = buildUniqueLabel('contrato-unidade-autorizada')

    const createResponse = await request(app.server)
      .post('/contracts')
      .set('Authorization', `Bearer ${token}`)
      .field('title', `Contrato ${suffix}`)
      .field('sourceType', 'contract')
      .field('siteId', siteId)

    assert.equal(createResponse.status, 201)
    assert.equal(createResponse.body.contract?.siteId, siteId)

    const listResponse = await request(app.server)
      .get(`/contracts?siteId=${encodeURIComponent(siteId)}`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(listResponse.status, 200)
    assert.equal(listResponse.body.status, 'ok')
    assert.ok(
      (listResponse.body.contracts as Array<{ id: string; siteId: string }>).some(
        (contract) => contract.id === createResponse.body.contract?.id && contract.siteId === siteId,
      ),
    )
  })

  it('manual rules should inherit contract site and require evidence before approval', async () => {
    const token = await loginToken()
    const siteId = await getDefaultSiteId(token)
    const suffix = buildUniqueLabel('regra-manual-site')

    const contractResponse = await request(app.server)
      .post('/contracts')
      .set('Authorization', `Bearer ${token}`)
      .field('title', `Contrato ${suffix}`)
      .field('sourceType', 'contract')
      .field('siteId', siteId)

    assert.equal(contractResponse.status, 201)

    const missingEvidenceResponse = await request(app.server)
      .post('/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractId: contractResponse.body.contract?.id as string,
        title: `Regra sem evidencia ${suffix}`,
        description: 'Regra manual sem evidencia nao pode entrar no fluxo.',
        category: 'operations',
        status: 'approved',
      })

    assert.equal(missingEvidenceResponse.status, 400)

    const createRuleResponse = await request(app.server)
      .post('/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractId: contractResponse.body.contract?.id as string,
        title: `Regra com evidencia ${suffix}`,
        description: 'Regra operacional de cardapio com evidencia contratual.',
        category: 'operations',
        ...ruleEvidence(suffix),
        status: 'approved',
      })

    assert.equal(createRuleResponse.status, 201)
    assert.equal(createRuleResponse.body.rule?.status, 'pending')

    const approveResponse = await request(app.server)
      .patch(`/rules/${createRuleResponse.body.rule?.id as string}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'approved',
        note: 'Aprovacao humana com evidencia validada.',
      })

    assert.equal(approveResponse.status, 200)

    const listRulesResponse = await request(app.server)
      .get(`/rules?contractId=${encodeURIComponent(contractResponse.body.contract?.id as string)}&siteId=${encodeURIComponent(siteId)}`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(listRulesResponse.status, 200)
    assert.ok(
      (listRulesResponse.body.rules as Array<{ id: string; siteId: string; status: string }>).some(
        (rule) =>
          rule.id === createRuleResponse.body.rule?.id &&
          rule.siteId === siteId &&
          rule.status === 'approved',
      ),
    )
  })

  it('refresh endpoint should rotate refresh token and reject old cookie', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    const initialCookie = getFirstSetCookie(loginResponse.headers['set-cookie'] as string | string[] | undefined)
    assert.ok(initialCookie)

    const refreshResponse = await request(app.server)
      .post('/auth/refresh')
      .set('Cookie', initialCookie)

    assert.equal(refreshResponse.status, 200)
    assert.equal(refreshResponse.body.status, 'ok')
    assert.equal(typeof refreshResponse.body.token, 'string')
    assert.match(getFirstSetCookie(refreshResponse.headers['set-cookie'] as string | string[] | undefined), /menucare_refresh_token=/i)

    const reusedOldCookieResponse = await request(app.server)
      .post('/auth/refresh')
      .set('Cookie', initialCookie)

    assert.equal(reusedOldCookieResponse.status, 401)
    assert.equal(reusedOldCookieResponse.body.status, 'error')
  })

  it('auth flow id should remain consistent across login refresh and logout', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    const flowId = loginResponse.headers['x-auth-flow-id'] as string | undefined
    assert.equal(typeof flowId, 'string')
    assert.ok((flowId ?? '').length >= 10)

    const refreshCookie = getFirstSetCookie(loginResponse.headers['set-cookie'] as string | string[] | undefined)
    assert.ok(refreshCookie)

    const refreshResponse = await request(app.server)
      .post('/auth/refresh')
      .set('Cookie', refreshCookie)

    assert.equal(refreshResponse.status, 200)
    assert.equal(refreshResponse.headers['x-auth-flow-id'], flowId)

    const rotatedCookie = getFirstSetCookie(refreshResponse.headers['set-cookie'] as string | string[] | undefined)
    assert.ok(rotatedCookie)

    const logoutResponse = await request(app.server)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${refreshResponse.body.token as string}`)
      .set('Cookie', rotatedCookie)

    assert.equal(logoutResponse.status, 200)
    assert.equal(logoutResponse.headers['x-auth-flow-id'], flowId)
  })

  it('login should revoke previous refresh session on same device', async () => {
    const firstLoginResponse = await request(app.server)
      .post('/auth/login')
      .set('User-Agent', 'MenuCare-Test-Device-Same')
      .send({
        email: 'admin@menucare.local',
        password: 'Admin@123',
      })

    assert.equal(firstLoginResponse.status, 200)
    const firstCookie = getFirstSetCookie(firstLoginResponse.headers['set-cookie'] as string | string[] | undefined)
    assert.ok(firstCookie)

    const secondLoginResponse = await request(app.server)
      .post('/auth/login')
      .set('User-Agent', 'MenuCare-Test-Device-Same')
      .send({
        email: 'admin@menucare.local',
        password: 'Admin@123',
      })

    assert.equal(secondLoginResponse.status, 200)
    const secondCookie = getFirstSetCookie(secondLoginResponse.headers['set-cookie'] as string | string[] | undefined)
    assert.ok(secondCookie)

    const firstDeviceRefreshResponse = await request(app.server)
      .post('/auth/refresh')
      .set('User-Agent', 'MenuCare-Test-Device-Same')
      .set('Cookie', firstCookie)

    assert.equal(firstDeviceRefreshResponse.status, 401)
    assert.equal(firstDeviceRefreshResponse.body.status, 'error')

    const secondDeviceRefreshResponse = await request(app.server)
      .post('/auth/refresh')
      .set('User-Agent', 'MenuCare-Test-Device-Same')
      .set('Cookie', secondCookie)

    assert.equal(secondDeviceRefreshResponse.status, 200)
    assert.equal(secondDeviceRefreshResponse.body.status, 'ok')
  })

  it('login should enforce maximum active refresh sessions per user', async () => {
    const cookiesByDevice = new Map<string, string>()
    const devices = ['MenuCare-Device-A', 'MenuCare-Device-B', 'MenuCare-Device-C', 'MenuCare-Device-D']

    for (const device of devices) {
      const loginResponse = await request(app.server)
        .post('/auth/login')
        .set('User-Agent', device)
        .send({
          email: 'admin@menucare.local',
          password: 'Admin@123',
        })

      assert.equal(loginResponse.status, 200)
      const cookie = getFirstSetCookie(loginResponse.headers['set-cookie'] as string | string[] | undefined)
      assert.ok(cookie)
      cookiesByDevice.set(device, cookie)
    }

    const oldestDeviceRefreshResponse = await request(app.server)
      .post('/auth/refresh')
      .set('User-Agent', 'MenuCare-Device-A')
      .set('Cookie', cookiesByDevice.get('MenuCare-Device-A') ?? '')

    assert.equal(oldestDeviceRefreshResponse.status, 401)
    assert.equal(oldestDeviceRefreshResponse.body.status, 'error')

    const newestDeviceRefreshResponse = await request(app.server)
      .post('/auth/refresh')
      .set('User-Agent', 'MenuCare-Device-D')
      .set('Cookie', cookiesByDevice.get('MenuCare-Device-D') ?? '')

    assert.equal(newestDeviceRefreshResponse.status, 200)
    assert.equal(newestDeviceRefreshResponse.body.status, 'ok')
  })

  it('protected endpoint should require authentication', async () => {
    const response = await request(app.server).get('/compliance/exports/audit')

    assert.equal(response.status, 401)
    assert.equal(response.body.status, 'error')
  })

  it('operational onboarding profile should return default and allow update', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const token = loginResponse.body.token as string

    const resetProfileResponse = await request(app.server)
      .post('/onboarding/operational-profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceProfile: 'genial_integrated',
        contractMode: 'with_contract',
        complianceMode: 'contractual',
      })

    assert.equal(resetProfileResponse.status, 201)

    const defaultProfileResponse = await request(app.server)
      .get('/onboarding/operational-profile')
      .set('Authorization', `Bearer ${token}`)

    assert.equal(defaultProfileResponse.status, 200)
    assert.equal(defaultProfileResponse.body.status, 'ok')
    assert.equal(defaultProfileResponse.body.operationalProfile?.sourceProfile, 'genial_integrated')
    assert.equal(defaultProfileResponse.body.operationalProfile?.contractMode, 'with_contract')
    assert.equal(defaultProfileResponse.body.operationalProfile?.complianceMode, 'contractual')

    const updateProfileResponse = await request(app.server)
      .post('/onboarding/operational-profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceProfile: 'manual_only',
        contractMode: 'internal_kitchen',
        complianceMode: 'internal_policy',
      })

    assert.equal(updateProfileResponse.status, 201)
    assert.equal(updateProfileResponse.body.status, 'ok')
    assert.equal(updateProfileResponse.body.operationalProfile?.sourceProfile, 'manual_only')
    assert.equal(updateProfileResponse.body.operationalProfile?.contractMode, 'internal_kitchen')
    assert.equal(updateProfileResponse.body.operationalProfile?.complianceMode, 'internal_policy')

    const persistedProfileResponse = await request(app.server)
      .get('/onboarding/operational-profile')
      .set('Authorization', `Bearer ${token}`)

    assert.equal(persistedProfileResponse.status, 200)
    assert.equal(persistedProfileResponse.body.status, 'ok')
    assert.equal(persistedProfileResponse.body.operationalProfile?.sourceProfile, 'manual_only')
    assert.equal(persistedProfileResponse.body.operationalProfile?.contractMode, 'internal_kitchen')
    assert.equal(persistedProfileResponse.body.operationalProfile?.complianceMode, 'internal_policy')
  })

  it('operational cardapio endpoint should create and list manual menu entries', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const token = loginResponse.body.token as string

    const createResponse = await request(app.server)
      .post('/menus/operational-cardapios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        entryLabel: 'Cardapio manual do dia',
        unitName: 'Unidade Piloto',
        serviceName: 'Almoco',
        referenceDate: '2026-06-10',
        mealType: 'Almoco',
        financialGoal: 15,
        mealCost: 13.75,
        recipes: ['Frango grelhado', 'Arroz integral', 'Salada de folhas'],
      })

    if (createResponse.status === 503) {
      assert.equal(createResponse.body.status, 'error')
      return
    }

    assert.equal(createResponse.status, 201)
    assert.equal(createResponse.body.status, 'ok')
    assert.equal(createResponse.body.operationalCardapio?.entryLabel, 'Cardapio manual do dia')
    assert.equal(createResponse.body.operationalCardapio?.validationStatus, 'within_goal')

    const listResponse = await request(app.server)
      .get('/menus/operational-cardapios?limit=5')
      .set('Authorization', `Bearer ${token}`)

    assert.equal(listResponse.status, 200)
    assert.equal(listResponse.body.status, 'ok')
    assert.ok(Array.isArray(listResponse.body.operationalCardapios))
    assert.ok(
      (listResponse.body.operationalCardapios as Array<{ entryLabel?: string }>).some(
        (item) => item.entryLabel === 'Cardapio manual do dia',
      ),
    )
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

  it('menu import endpoint should calculate meal cost from recipe items and enforce service goal', async () => {
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
        unitName: 'ONESUBSEA - SJP (567)',
        serviceName: 'ALMOCO',
        referenceDate: '2026-06-10',
        mealType: 'Almoco',
        financialGoal: 11.9,
        recipeItems: [
          { name: 'CUPIM ASSADO', cost: 7.35 },
          { name: 'FRICASSE DE FRANGO', cost: 2.17 },
          { name: 'POLENTA FRITA', cost: 0.96 },
          { name: 'SUCO EM POLPA DE MANGA', cost: 0.32 },
        ],
      })

    if (createResponse.status === 503) {
      assert.equal(createResponse.body.status, 'error')
      return
    }

    assert.equal(createResponse.status, 201)
    assert.equal(createResponse.body.status, 'ok')
    assert.equal(createResponse.body.import?.mealCost, 10.8)
    assert.equal(createResponse.body.import?.financialGoal, 11.9)
    assert.equal(createResponse.body.import?.validationStatus, 'within_goal')
    assert.deepEqual(createResponse.body.import?.recipes, [
      'CUPIM ASSADO',
      'FRICASSE DE FRANGO',
      'POLENTA FRITA',
      'SUCO EM POLPA DE MANGA',
    ])
  })

  it('menu import parse-report endpoint should parse raw text into daily payloads', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const rawText = [
      'EXAL MATRIZ SEDE.',
      'Relatorio de Cardapio com Pre-Custo - (5007)',
      'Unidade: ONESUBSEA - SJP (567)',
      'Servico: ALMOCO Meta: 11,90',
      '01/06/2026 - [segunda-feira]',
      'FILE DE FRANGO A MILANE 2,05',
      'ALMONDEGAS COM MOLHO 1,86',
      'SUCO EM POLPA DE LARANJA 0,36',
      '4,27',
      '10/06/2026 - [quarta-feira]',
      'CUPIM ASSADO 7,35',
      'FRICASSE DE FRANGO 2,17',
      'POLENTA FRITA 0,96',
      'SUCO EM POLPA DE MANGA 0,32',
      '10,80',
    ].join('\n')

    const parseResponse = await request(app.server)
      .post('/menus/imports/parse-report')
      .set('Authorization', `Bearer ${loginResponse.body.token as string}`)
      .send({
        rawText,
        fileName: 'BROKER2.GENIALNET.COM.BR.pdf',
      })

    assert.equal(parseResponse.status, 200)
    assert.equal(parseResponse.body.status, 'ok')
    assert.equal(parseResponse.body.parsed?.unitName, 'ONESUBSEA - SJP (567)')
    assert.equal(parseResponse.body.parsed?.serviceName, 'ALMOCO')
    assert.equal(parseResponse.body.parsed?.financialGoal, 11.9)
    assert.equal(Array.isArray(parseResponse.body.parsed?.days), true)
    assert.equal(parseResponse.body.parsed?.days?.length, 2)

    const firstDay = parseResponse.body.parsed?.days?.[0]
    assert.equal(firstDay.referenceDate, '2026-06-01')
    assert.equal(firstDay.computedMealCost, 4.27)
    assert.equal(firstDay.validationStatus, 'within_goal')

    const secondDay = parseResponse.body.parsed?.days?.[1]
    assert.equal(secondDay.referenceDate, '2026-06-10')
    assert.equal(secondDay.computedMealCost, 10.8)
    assert.equal(secondDay.reportedMealCost, 10.8)
    assert.equal(secondDay.validationStatus, 'within_goal')
  })

  it('menu import parse-report-file endpoint should reject non-pdf upload', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const response = await request(app.server)
      .post('/menus/imports/parse-report-file')
      .set('Authorization', `Bearer ${loginResponse.body.token as string}`)
      .attach('file', Buffer.from('nao-pdf'), {
        filename: 'relatorio.txt',
        contentType: 'text/plain',
      })

    assert.equal(response.status, 400)
    assert.equal(response.body.status, 'error')
    assert.equal(response.body.message, 'Envie um arquivo PDF valido.')
  })

  it('menu import monthly-cycle endpoint should reject non-pdf upload', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const response = await request(app.server)
      .post('/menus/imports/monthly-cycle')
      .set('Authorization', `Bearer ${loginResponse.body.token as string}`)
      .attach('file', Buffer.from('nao-pdf'), {
        filename: 'cardapio.txt',
        contentType: 'text/plain',
      })

    assert.equal(response.status, 400)
    assert.equal(response.body.status, 'error')
    assert.equal(response.body.message, 'Envie um arquivo PDF valido.')
  })

  it('menu import monthly-cycle endpoint should process a real monthly pdf or return db fallback', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const pdfBuffer = await readFile(new URL('../../../docs/BROKER2.GENIALNET.COM.BR.pdf', import.meta.url))

    const response = await request(app.server)
      .post('/menus/imports/monthly-cycle')
      .set('Authorization', `Bearer ${loginResponse.body.token as string}`)
      .attach('file', pdfBuffer, {
        filename: 'BROKER2.GENIALNET.COM.BR.pdf',
        contentType: 'application/pdf',
      })

    if (response.status === 503) {
      assert.equal(response.body.status, 'error')
      return
    }

    assert.equal(response.status, 200)
    assert.equal(response.body.status, 'ok')
    assert.equal(typeof response.body.cycle?.importsProcessed, 'number')
    assert.ok((response.body.cycle?.importsProcessed ?? 0) > 0)
    assert.equal(Array.isArray(response.body.imports), true)
    assert.equal(response.body.imports.length, response.body.cycle?.importsProcessed)
  })

  it('menu import monthly-cycle endpoint should expose per-day audit and suggestion summaries', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const pdfBuffer = await readFile(new URL('../../../docs/BROKER2.GENIALNET.COM.BR.pdf', import.meta.url))

    const response = await request(app.server)
      .post('/menus/imports/monthly-cycle')
      .set('Authorization', `Bearer ${loginResponse.body.token as string}`)
      .attach('file', pdfBuffer, {
        filename: 'BROKER2.GENIALNET.COM.BR.pdf',
        contentType: 'application/pdf',
      })

    if (response.status === 503) {
      assert.equal(response.body.status, 'error')
      return
    }

    assert.equal(response.status, 200)
    assert.equal(response.body.status, 'ok')
    assert.equal(Array.isArray(response.body.imports), true)
    assert.ok((response.body.imports as unknown[]).length > 0)

    const first = response.body.imports?.[0] as {
      processingStatus?: string
      failedStage?: string | null
      autoRemediation?: {
        attempted?: boolean
        retriesUsed?: number
        recoveredByRetry?: boolean
        lastErrorMessage?: string | null
      }
      import?: {
        id?: string
        mealCost?: number
        financialGoal?: number
        validationStatus?: string
      }
      audit?: {
        auditedRules?: number
        compliantCount?: number
        nonCompliantCount?: number
      }
      suggestions?: {
        generatedSuggestions?: number
        estimatedTotalFinancialImpact?: number
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
    }

    const cycleCrosscheck = response.body.cycle?.recipeCrosscheck as {
      totalRecipesCrosschecked?: number
      totalRecipesMatched?: number
      totalRecipesUnmatched?: number
      coveragePercent?: number
    }

    assert.equal(typeof first.import?.id, 'string')
    assert.equal(typeof first.import?.mealCost, 'number')
    assert.equal(typeof first.import?.financialGoal, 'number')
    assert.equal(typeof first.import?.validationStatus, 'string')
    assert.ok(['completed', 'completed_with_warnings', 'failed'].includes(first.processingStatus ?? ''))
    assert.ok(first.failedStage === null || ['import', 'audit', 'suggestions'].includes(first.failedStage ?? ''))
    assert.equal(typeof first.autoRemediation?.attempted, 'boolean')
    assert.equal(typeof first.autoRemediation?.retriesUsed, 'number')
    assert.equal(typeof first.autoRemediation?.recoveredByRetry, 'boolean')

    assert.equal(typeof first.audit?.auditedRules, 'number')
    assert.equal(typeof first.audit?.compliantCount, 'number')
    assert.equal(typeof first.audit?.nonCompliantCount, 'number')

    assert.equal(typeof first.suggestions?.generatedSuggestions, 'number')
    assert.equal(typeof first.suggestions?.estimatedTotalFinancialImpact, 'number')
    assert.equal(Array.isArray(first.recipeCrosscheck?.sourceRecipeNames), true)
    assert.equal(typeof first.recipeCrosscheck?.totalRecipes, 'number')
    assert.equal(typeof first.recipeCrosscheck?.matchedRecipes, 'number')
    assert.equal(typeof first.recipeCrosscheck?.unmatchedRecipes, 'number')
    assert.equal(typeof first.recipeCrosscheck?.coveragePercent, 'number')
    assert.equal(Array.isArray(first.recipeCrosscheck?.unresolvedRecipeNames), true)
    assert.equal(Array.isArray(first.recipeCrosscheck?.suggestedRecipeCreations), true)

    assert.equal(typeof cycleCrosscheck?.totalRecipesCrosschecked, 'number')
    assert.equal(typeof cycleCrosscheck?.totalRecipesMatched, 'number')
    assert.equal(typeof cycleCrosscheck?.totalRecipesUnmatched, 'number')
    assert.equal(typeof cycleCrosscheck?.coveragePercent, 'number')
  })

  it('menu import monthly-cycle endpoint should keep aggregate totals consistent with per-day items', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const pdfBuffer = await readFile(new URL('../../../docs/BROKER2.GENIALNET.COM.BR.pdf', import.meta.url))

    const response = await request(app.server)
      .post('/menus/imports/monthly-cycle')
      .set('Authorization', `Bearer ${loginResponse.body.token as string}`)
      .attach('file', pdfBuffer, {
        filename: 'BROKER2.GENIALNET.COM.BR.pdf',
        contentType: 'application/pdf',
      })

    if (response.status === 503) {
      assert.equal(response.body.status, 'error')
      return
    }

    assert.equal(response.status, 200)
    assert.equal(response.body.status, 'ok')

    const imports = response.body.imports as Array<{
      import: {
        mealCost: number
        financialGoal: number
        validationStatus: string
      }
      suggestions: {
        generatedSuggestions: number
        estimatedTotalFinancialImpact: number
        estimatedContractualFinancialImpact: number
        estimatedGoalFinancialImpact: number
      }
    }>

    const totalMealCost = Number(
      imports.reduce((sum, item) => sum + item.import.mealCost, 0).toFixed(2),
    )
    const totalGoal = Number(
      imports.reduce((sum, item) => sum + item.import.financialGoal, 0).toFixed(2),
    )
    const totalSuggestions = imports.reduce(
      (sum, item) => sum + item.suggestions.generatedSuggestions,
      0,
    )
    const totalEstimatedFinancialImpact = Number(
      imports.reduce((sum, item) => sum + item.suggestions.estimatedTotalFinancialImpact, 0).toFixed(2),
    )
    const totalContractualEstimatedFinancialImpact = Number(
      imports.reduce((sum, item) => sum + item.suggestions.estimatedContractualFinancialImpact, 0).toFixed(2),
    )
    const totalGoalEstimatedFinancialImpact = Number(
      imports.reduce((sum, item) => sum + item.suggestions.estimatedGoalFinancialImpact, 0).toFixed(2),
    )
    const aboveGoalDays = imports.filter((item) => item.import.validationStatus === 'above_goal').length
    const withinGoalDays = imports.length - aboveGoalDays

    assert.equal(response.body.cycle?.importsProcessed, imports.length)
    assert.equal(response.body.cycle?.totalMealCost, totalMealCost)
    assert.equal(response.body.cycle?.totalGoal, totalGoal)
    assert.equal(response.body.cycle?.totalSuggestions, totalSuggestions)
    assert.equal(response.body.cycle?.totalEstimatedFinancialImpact, totalEstimatedFinancialImpact)
    assert.equal(
      response.body.cycle?.totalContractualEstimatedFinancialImpact,
      totalContractualEstimatedFinancialImpact,
    )
    assert.equal(
      response.body.cycle?.totalGoalEstimatedFinancialImpact,
      totalGoalEstimatedFinancialImpact,
    )
    assert.equal(response.body.cycle?.aboveGoalDays, aboveGoalDays)
    assert.equal(response.body.cycle?.withinGoalDays, withinGoalDays)
  })

  it('menu import monthly-cycle endpoint should identify days above goal from the real monthly pdf', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const pdfBuffer = await readFile(new URL('../../../docs/BROKER2.GENIALNET.COM.BR.pdf', import.meta.url))

    const response = await request(app.server)
      .post('/menus/imports/monthly-cycle')
      .set('Authorization', `Bearer ${loginResponse.body.token as string}`)
      .attach('file', pdfBuffer, {
        filename: 'BROKER2.GENIALNET.COM.BR.pdf',
        contentType: 'application/pdf',
      })

    if (response.status === 503) {
      assert.equal(response.body.status, 'error')
      return
    }

    assert.equal(response.status, 200)
    assert.equal(response.body.status, 'ok')

    const imports = response.body.imports as Array<{
      import: {
        validationStatus: string
        exceededValue: number
      }
      suggestions: {
        generatedSuggestions: number
        estimatedTotalFinancialImpact: number
        estimatedContractualFinancialImpact: number
        estimatedGoalFinancialImpact: number
      }
    }>

    const aboveGoalItems = imports.filter((item) => item.import.validationStatus === 'above_goal')
    const withinGoalItems = imports.filter((item) => item.import.validationStatus === 'within_goal')

    assert.ok(aboveGoalItems.length > 0)
    assert.ok(withinGoalItems.length > 0)
    assert.equal(response.body.cycle?.aboveGoalDays, aboveGoalItems.length)
    assert.equal(response.body.cycle?.withinGoalDays, withinGoalItems.length)
    assert.ok(aboveGoalItems.every((item) => item.import.exceededValue > 0))
    assert.ok(aboveGoalItems.every((item) => item.suggestions.generatedSuggestions > 0))
    assert.ok(aboveGoalItems.some((item) => item.suggestions.estimatedTotalFinancialImpact < 0))
    assert.ok(aboveGoalItems.some((item) => item.suggestions.estimatedGoalFinancialImpact < 0))
    assert.ok(response.body.cycle?.totalEstimatedFinancialImpact <= 0)
    assert.ok(response.body.cycle?.totalGoalEstimatedFinancialImpact <= 0)
  })

  it('menu import monthly-cycle endpoint should persist monthly summary for later query', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const pdfBuffer = await readFile(new URL('../../../docs/BROKER2.GENIALNET.COM.BR.pdf', import.meta.url))

    const cycleResponse = await request(app.server)
      .post('/menus/imports/monthly-cycle')
      .set('Authorization', `Bearer ${loginResponse.body.token as string}`)
      .attach('file', pdfBuffer, {
        filename: 'BROKER2.GENIALNET.COM.BR.pdf',
        contentType: 'application/pdf',
      })

    if (cycleResponse.status === 503) {
      assert.equal(cycleResponse.body.status, 'error')
      return
    }

    assert.equal(cycleResponse.status, 200)
    assert.equal(cycleResponse.body.status, 'ok')

    const summaryMonth = cycleResponse.body.cycle?.summaryMonth as string
    assert.equal(typeof summaryMonth, 'string')

    const listResponse = await request(app.server)
      .get(`/menus/imports/monthly-summaries?month=${summaryMonth}`)
      .set('Authorization', `Bearer ${loginResponse.body.token as string}`)

    assert.equal(listResponse.status, 200)
    assert.equal(listResponse.body.status, 'ok')
    assert.equal(Array.isArray(listResponse.body.summaries), true)
    assert.ok((listResponse.body.summaries as unknown[]).length > 0)

    const summary = listResponse.body.summaries?.find(
      (item: { summaryMonth?: string; serviceName?: string; unitName?: string }) =>
        item.summaryMonth === summaryMonth &&
        item.serviceName === cycleResponse.body.cycle?.serviceName &&
        item.unitName === cycleResponse.body.cycle?.unitName,
    ) as {
      importsProcessed?: number
      aboveGoalDays?: number
      withinGoalDays?: number
      totalMealCost?: number
      totalGoal?: number
      totalSuggestions?: number
      totalEstimatedFinancialImpact?: number
      totalContractualEstimatedFinancialImpact?: number
      totalGoalEstimatedFinancialImpact?: number
    } | undefined

    assert.ok(summary)
    assert.equal(summary?.importsProcessed, cycleResponse.body.cycle?.importsProcessed)
    assert.equal(summary?.aboveGoalDays, cycleResponse.body.cycle?.aboveGoalDays)
    assert.equal(summary?.withinGoalDays, cycleResponse.body.cycle?.withinGoalDays)
    assert.equal(summary?.totalMealCost, cycleResponse.body.cycle?.totalMealCost)
    assert.equal(summary?.totalGoal, cycleResponse.body.cycle?.totalGoal)
    assert.equal(summary?.totalSuggestions, cycleResponse.body.cycle?.totalSuggestions)
    assert.equal(
      summary?.totalEstimatedFinancialImpact,
      cycleResponse.body.cycle?.totalEstimatedFinancialImpact,
    )
    assert.equal(
      summary?.totalContractualEstimatedFinancialImpact,
      cycleResponse.body.cycle?.totalContractualEstimatedFinancialImpact,
    )
    assert.equal(
      summary?.totalGoalEstimatedFinancialImpact,
      cycleResponse.body.cycle?.totalGoalEstimatedFinancialImpact,
    )
  })

  it('menu import monthly summary should expose persisted per-day processing messages', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const pdfBuffer = await readFile(new URL('../../../docs/BROKER2.GENIALNET.COM.BR.pdf', import.meta.url))

    const cycleResponse = await request(app.server)
      .post('/menus/imports/monthly-cycle')
      .set('Authorization', `Bearer ${loginResponse.body.token as string}`)
      .attach('file', pdfBuffer, {
        filename: 'BROKER2.GENIALNET.COM.BR.pdf',
        contentType: 'application/pdf',
      })

    if (cycleResponse.status === 503) {
      assert.equal(cycleResponse.body.status, 'error')
      return
    }

    const summaryMonth = cycleResponse.body.cycle?.summaryMonth as string

    const listResponse = await request(app.server)
      .get(`/menus/imports/monthly-summaries?month=${summaryMonth}`)
      .set('Authorization', `Bearer ${loginResponse.body.token as string}`)

    assert.equal(listResponse.status, 200)
    assert.equal(listResponse.body.status, 'ok')

    const summary = listResponse.body.summaries?.find(
      (item: { summaryMonth?: string; serviceName?: string; unitName?: string }) =>
        item.summaryMonth === summaryMonth &&
        item.serviceName === cycleResponse.body.cycle?.serviceName &&
        item.unitName === cycleResponse.body.cycle?.unitName,
    ) as {
      processedImports?: Array<{
        processingStatus?: string
        failedStage?: string | null
        autoRemediation?: {
          attempted?: boolean
          retriesUsed?: number
          recoveredByRetry?: boolean
          lastErrorMessage?: string | null
        }
        import?: { id?: string }
        processingMessages?: Array<{ level?: string; code?: string; message?: string }>
      }>
    } | undefined

    assert.ok(summary)
    assert.equal(Array.isArray(summary?.processedImports), true)
    assert.ok((summary?.processedImports?.length ?? 0) > 0)
    assert.ok(summary?.processedImports?.every((item) => typeof item.import?.id === 'string'))
    assert.ok(
      summary?.processedImports?.every((item) =>
        ['completed', 'completed_with_warnings', 'failed'].includes(item.processingStatus ?? ''),
      ),
    )
    assert.ok(
      summary?.processedImports?.every((item) =>
        item.failedStage === null || ['import', 'audit', 'suggestions'].includes(item.failedStage ?? ''),
      ),
    )
    assert.ok(
      summary?.processedImports?.every(
        (item) =>
          typeof item.autoRemediation?.attempted === 'boolean' &&
          typeof item.autoRemediation?.retriesUsed === 'number' &&
          typeof item.autoRemediation?.recoveredByRetry === 'boolean',
      ),
    )
    assert.ok(
      summary?.processedImports?.every(
        (item) => Array.isArray(item.processingMessages) && item.processingMessages.length > 0,
      ),
    )
  })

  it('menu import monthly summary should support selective reprocess for failed items', async () => {
    const loginResponse = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(loginResponse.status, 200)
    assert.equal(typeof loginResponse.body.token, 'string')

    const pdfBuffer = await readFile(new URL('../../../docs/BROKER2.GENIALNET.COM.BR.pdf', import.meta.url))

    const cycleResponse = await request(app.server)
      .post('/menus/imports/monthly-cycle')
      .set('Authorization', `Bearer ${loginResponse.body.token as string}`)
      .attach('file', pdfBuffer, {
        filename: 'BROKER2.GENIALNET.COM.BR.pdf',
        contentType: 'application/pdf',
      })

    if (cycleResponse.status === 503) {
      assert.equal(cycleResponse.body.status, 'error')
      return
    }

    assert.equal(cycleResponse.status, 200)
    assert.equal(cycleResponse.body.status, 'ok')

    const reprocessResponse = await request(app.server)
      .post('/menus/imports/monthly-summaries/reprocess-failed')
      .set('Authorization', `Bearer ${loginResponse.body.token as string}`)
      .send({
        summaryMonth: cycleResponse.body.cycle?.summaryMonth,
        unitName: cycleResponse.body.cycle?.unitName,
        serviceName: cycleResponse.body.cycle?.serviceName,
      })

    assert.equal(reprocessResponse.status, 200)
    assert.equal(reprocessResponse.body.status, 'ok')
    assert.equal(typeof reprocessResponse.body.reprocess?.failedItemsBefore, 'number')
    assert.equal(typeof reprocessResponse.body.reprocess?.failedItemsAfter, 'number')
    assert.equal(typeof reprocessResponse.body.reprocess?.recoveredItems, 'number')
    assert.equal(Array.isArray(reprocessResponse.body.imports), true)
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
      .field('title', 'Contrato Auditoria Cardapio')
      .field('sourceType', 'contract')
      .field('siteId', await getDefaultSiteId(token))

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
        category: 'nutrition',
        ...ruleEvidence('frango grelhado obrigatorio no almoco'),
        status: 'approved',
      })

    assert.equal(ruleResponse.status, 201)
    await approveRule(token, ruleResponse.body.rule?.id as string)

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
        recipes: ['Arroz integral', 'Feijao carioca', 'Frango grelhado ao molho de ervas'],
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
    assert.doesNotMatch(
      auditResponse.body.results?.[0]?.evidence as string,
      /fallback/i,
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
      .field('title', 'Contrato Frequencia e Recorrencia')
      .field('sourceType', 'contract')
      .field('siteId', await getDefaultSiteId(token))

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
        category: 'nutrition',
        ...ruleEvidence('fruta citrica semanal'),
        status: 'approved',
      })

    assert.equal(citrusRuleResponse.status, 201)
    await approveRule(token, citrusRuleResponse.body.rule?.id as string)

    const recurrenceRuleResponse = await request(app.server)
      .post('/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractId,
        title: 'Nao repetir peixe em menos de 7 dias',
        description: 'Peixe nao pode reaparecer em menos de 7 dias no mesmo servico.',
        category: 'nutrition',
        ...ruleEvidence('recorrencia minima de peixe'),
        status: 'approved',
      })

    assert.equal(recurrenceRuleResponse.status, 201)
    await approveRule(token, recurrenceRuleResponse.body.rule?.id as string)

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

  it('menu import audit should map contextual lunch synonyms to structured evidence', async () => {
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
      .field('title', 'Contrato Sinonimos Controlados')
      .field('sourceType', 'contract')
      .field('siteId', await getDefaultSiteId(token))

    if (contractResponse.status === 503) {
      assert.equal(contractResponse.body.status, 'error')
      return
    }

    const contractId = contractResponse.body.contract?.id as string

    const ruleResponse = await request(app.server)
      .post('/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractId,
        title: 'Peixe no almoco',
        description: 'Cardapio deve conter peixe no almoco.',
        category: 'nutrition',
        ...ruleEvidence('peixe no almoco'),
        status: 'approved',
      })

    assert.equal(ruleResponse.status, 201)
    await approveRule(token, ruleResponse.body.rule?.id as string)

    const recipeImportResponse = await request(app.server)
      .post('/recipes/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'FICHAS-TECNICAS-SINONIMOS.pdf',
        sourceReference: 'Genial',
        recipes: [
          {
            name: 'Peixe assado',
            ingredients: ['Peixe', 'Ervas'],
            preparationMethod: 'Assar e servir.',
            group: 'Proteina',
            cost: 3.0,
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
        referenceDate: '2026-06-09',
        mealType: 'Almoco',
        financialGoal: 14,
        mealCost: 13,
        recipes: ['Arroz', 'Feijao', 'Posta assada com ervas'],
      })

    assert.equal(importResponse.status, 201)

    const auditResponse = await request(app.server)
      .post(`/menus/imports/${importResponse.body.import?.id as string}/audit`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(auditResponse.status, 200)
    assert.equal(auditResponse.body.status, 'ok')

    const fishRuleResult = (auditResponse.body.results as Array<{
      ruleTitle: string
      resultStatus: string
      evidence: string
    }>).find((item) => item.ruleTitle === 'Peixe no almoco')

    assert.ok(fishRuleResult)
    assert.equal(fishRuleResult?.resultStatus, 'compliant')
    assert.match(fishRuleResult?.evidence as string, /classificacao estruturada/i)
    assert.doesNotMatch(fishRuleResult?.evidence as string, /fallback textual/i)
  })

  it('menu import audit should map fish commercial aliases to structured evidence', async () => {
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
      .field('title', 'Contrato Alias Comercial Peixe')
      .field('sourceType', 'contract')
      .field('siteId', await getDefaultSiteId(token))

    if (contractResponse.status === 503) {
      assert.equal(contractResponse.body.status, 'error')
      return
    }

    const contractId = contractResponse.body.contract?.id as string

    const ruleResponse = await request(app.server)
      .post('/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractId,
        title: 'Peixe no almoco com alias comercial',
        description: 'Cardapio deve conter peixe no almoco.',
        category: 'nutrition',
        ...ruleEvidence('peixe no almoco com alias comercial'),
        status: 'approved',
      })

    assert.equal(ruleResponse.status, 201)
    await approveRule(token, ruleResponse.body.rule?.id as string)

    const recipeImportResponse = await request(app.server)
      .post('/recipes/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'FICHAS-TECNICAS-ALIAS-COMERCIAL-PEIXE.pdf',
        sourceReference: 'Genial',
        recipes: [
          {
            name: 'Peixe assado',
            ingredients: ['Peixe', 'Ervas'],
            preparationMethod: 'Assar e servir.',
            group: 'Proteina',
            cost: 3.0,
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
        referenceDate: '2026-06-09',
        mealType: 'Almoco',
        financialGoal: 14,
        mealCost: 13,
        recipes: ['Arroz', 'Feijao', 'File de pescado ao forno'],
      })

    assert.equal(importResponse.status, 201)

    const auditResponse = await request(app.server)
      .post(`/menus/imports/${importResponse.body.import?.id as string}/audit`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(auditResponse.status, 200)
    assert.equal(auditResponse.body.status, 'ok')

    const fishRuleResult = (auditResponse.body.results as Array<{
      ruleTitle: string
      resultStatus: string
      evidence: string
    }>).find((item) => item.ruleTitle === 'Peixe no almoco com alias comercial')

    assert.ok(fishRuleResult)
    assert.equal(fishRuleResult?.resultStatus, 'compliant')
    assert.match(fishRuleResult?.evidence as string, /classificacao estruturada/i)
    assert.doesNotMatch(fishRuleResult?.evidence as string, /fallback textual/i)
  })

  it('menu import audit should map breakfast citrus aliases to structured evidence', async () => {
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
      .field('title', 'Contrato Alias Contextual Cafe')
      .field('sourceType', 'contract')
      .field('siteId', await getDefaultSiteId(token))

    if (contractResponse.status === 503) {
      assert.equal(contractResponse.body.status, 'error')
      return
    }

    const contractId = contractResponse.body.contract?.id as string

    const ruleResponse = await request(app.server)
      .post('/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractId,
        title: 'Fruta citrica no cafe da manha',
        description: 'Cardapio deve contemplar fruta citrica no cafe da manha.',
        category: 'nutrition',
        ...ruleEvidence('fruta citrica no cafe da manha'),
        status: 'approved',
      })

    assert.equal(ruleResponse.status, 201)
    await approveRule(token, ruleResponse.body.rule?.id as string)

    const recipeImportResponse = await request(app.server)
      .post('/recipes/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'FICHAS-TECNICAS-CAFE.pdf',
        sourceReference: 'Genial',
        recipes: [
          {
            name: 'Laranja em Gomos',
            ingredients: ['Laranja'],
            preparationMethod: 'Servir gelada.',
            group: 'Fruta',
            cost: 0.7,
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
        serviceName: 'Cafe da Manha',
        referenceDate: '2026-06-09',
        mealType: 'Cafe da Manha',
        financialGoal: 8,
        mealCost: 7,
        recipes: ['Pao integral', 'Suco citrico natural'],
      })

    assert.equal(importResponse.status, 201)

    const auditResponse = await request(app.server)
      .post(`/menus/imports/${importResponse.body.import?.id as string}/audit`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(auditResponse.status, 200)
    assert.equal(auditResponse.body.status, 'ok')

    const citrusRuleResult = (auditResponse.body.results as Array<{
      ruleTitle: string
      resultStatus: string
      evidence: string
    }>).find((item) => item.ruleTitle === 'Fruta citrica no cafe da manha')

    assert.ok(citrusRuleResult)
    assert.equal(citrusRuleResult?.resultStatus, 'compliant')
    assert.match(citrusRuleResult?.evidence as string, /classificacao estruturada/i)
    assert.doesNotMatch(citrusRuleResult?.evidence as string, /fallback textual/i)
  })

  it('menu import audit should map lunch vegetable aliases to structured evidence', async () => {
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
      .field('title', 'Contrato Alias Contextual Vegetais')
      .field('sourceType', 'contract')
      .field('siteId', await getDefaultSiteId(token))

    if (contractResponse.status === 503) {
      assert.equal(contractResponse.body.status, 'error')
      return
    }

    const contractId = contractResponse.body.contract?.id as string

    const ruleResponse = await request(app.server)
      .post('/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractId,
        title: 'Verdura no almoco',
        description: 'Cardapio deve conter verdura no almoco.',
        category: 'nutrition',
        ...ruleEvidence('verdura no almoco'),
        status: 'approved',
      })

    assert.equal(ruleResponse.status, 201)
    await approveRule(token, ruleResponse.body.rule?.id as string)

    const recipeImportResponse = await request(app.server)
      .post('/recipes/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'FICHAS-TECNICAS-VEGETAIS.pdf',
        sourceReference: 'Genial',
        recipes: [
          {
            name: 'Salada de Folhas',
            ingredients: ['Alface', 'Couve'],
            preparationMethod: 'Higienizar e servir.',
            group: 'Verdura',
            cost: 0.9,
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
        referenceDate: '2026-06-09',
        mealType: 'Almoco',
        financialGoal: 14,
        mealCost: 13,
        recipes: ['Arroz', 'Feijao', 'Mix de folhas verdes'],
      })

    assert.equal(importResponse.status, 201)

    const auditResponse = await request(app.server)
      .post(`/menus/imports/${importResponse.body.import?.id as string}/audit`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(auditResponse.status, 200)
    assert.equal(auditResponse.body.status, 'ok')

    const greenRuleResult = (auditResponse.body.results as Array<{
      ruleTitle: string
      resultStatus: string
      evidence: string
    }>).find((item) => item.ruleTitle === 'Verdura no almoco')

    assert.ok(greenRuleResult)
    assert.equal(greenRuleResult?.resultStatus, 'compliant')
    assert.match(greenRuleResult?.evidence as string, /classificacao estruturada/i)
    assert.doesNotMatch(greenRuleResult?.evidence as string, /fallback textual/i)
  })

  it('menu import audit should map commercial vegetable aliases to structured evidence', async () => {
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
      .field('title', 'Contrato Alias Comercial Vegetais')
      .field('sourceType', 'contract')
      .field('siteId', await getDefaultSiteId(token))

    if (contractResponse.status === 503) {
      assert.equal(contractResponse.body.status, 'error')
      return
    }

    const contractId = contractResponse.body.contract?.id as string

    const ruleResponse = await request(app.server)
      .post('/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractId,
        title: 'Verdura no almoco com alias comercial',
        description: 'Cardapio deve conter verdura no almoco.',
        category: 'nutrition',
        ...ruleEvidence('verdura no almoco com alias comercial'),
        status: 'approved',
      })

    assert.equal(ruleResponse.status, 201)
    await approveRule(token, ruleResponse.body.rule?.id as string)

    const recipeImportResponse = await request(app.server)
      .post('/recipes/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'FICHAS-TECNICAS-ALIAS-COMERCIAL-VEGETAIS.pdf',
        sourceReference: 'Genial',
        recipes: [
          {
            name: 'Salada de Folhas',
            ingredients: ['Alface', 'Couve'],
            preparationMethod: 'Higienizar e servir.',
            group: 'Verdura',
            cost: 0.9,
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
        referenceDate: '2026-06-09',
        mealType: 'Almoco',
        financialGoal: 14,
        mealCost: 13,
        recipes: ['Arroz', 'Feijao', 'Salada de hortalicas'],
      })

    assert.equal(importResponse.status, 201)

    const auditResponse = await request(app.server)
      .post(`/menus/imports/${importResponse.body.import?.id as string}/audit`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(auditResponse.status, 200)
    assert.equal(auditResponse.body.status, 'ok')

    const greenRuleResult = (auditResponse.body.results as Array<{
      ruleTitle: string
      resultStatus: string
      evidence: string
    }>).find((item) => item.ruleTitle === 'Verdura no almoco com alias comercial')

    assert.ok(greenRuleResult)
    assert.equal(greenRuleResult?.resultStatus, 'compliant')
    assert.match(greenRuleResult?.evidence as string, /classificacao estruturada/i)
    assert.doesNotMatch(greenRuleResult?.evidence as string, /fallback textual/i)
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
      .field('title', 'Contrato Sugestoes de Ajuste')
      .field('sourceType', 'contract')
      .field('siteId', await getDefaultSiteId(token))

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
        category: 'nutrition',
        ...ruleEvidence('peixe no almoco de sexta'),
        status: 'approved',
      })

    assert.equal(ruleResponse.status, 201)
    await approveRule(token, ruleResponse.body.rule?.id as string)

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

    const evaluationImportResponse = await request(app.server)
      .post('/evaluations/imports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'AVALIACOES-GENIAL.pdf',
        unitName: 'Hospital Sao Marcelino Champagnat',
        serviceName: 'Almoco',
        referenceDate: '2026-06-08',
        score: 8.7,
        evaluationsCount: 120,
        comments: 'Combinacao com alta aceitacao operacional.',
      })

    assert.equal(evaluationImportResponse.status, 201)

    const rebuildIntelligenceResponse = await request(app.server)
      .post('/evaluations/intelligence/rebuild')
      .set('Authorization', `Bearer ${token}`)

    assert.equal(rebuildIntelligenceResponse.status, 200)
    assert.equal(rebuildIntelligenceResponse.body.status, 'ok')

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
      runSuggestionsResponse.body.suggestions?.[0]?.estimatedNutritionalImpact as string,
      /contexto historico operacional/i,
    )
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
      listSuggestionsResponse.body.suggestions?.[0]?.estimatedNutritionalImpact as string,
      /contexto historico operacional/i,
    )
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
      .field('title', 'Contrato Sugestoes Estruturadas R4')
      .field('sourceType', 'contract')
      .field('siteId', await getDefaultSiteId(token))

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
        category: 'nutrition',
        ...ruleEvidence('fruta citrica semanal estruturada'),
        status: 'approved',
      })

    assert.equal(citrusRuleResponse.status, 201)
    await approveRule(token, citrusRuleResponse.body.rule?.id as string)

    const recurrenceRuleResponse = await request(app.server)
      .post('/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contractId,
        title: 'Nao repetir peixe em menos de 7 dias',
        description: 'Peixe nao pode reaparecer em menos de 7 dias no mesmo servico.',
        category: 'nutrition',
        ...ruleEvidence('recorrencia minima estruturada de peixe'),
        status: 'approved',
      })

    assert.equal(recurrenceRuleResponse.status, 201)
    await approveRule(token, recurrenceRuleResponse.body.rule?.id as string)

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
      .field('title', 'Contrato Versao Ajustada')
      .field('sourceType', 'contract')
      .field('siteId', await getDefaultSiteId(token))

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
        category: 'nutrition',
        ...ruleEvidence('fruta citrica obrigatoria no almoco'),
        status: 'approved',
      })

    assert.equal(ruleResponse.status, 201)
    await approveRule(token, ruleResponse.body.rule?.id as string)

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

  it('approved rule should be promoted to compliance control and preserve full traceability', async () => {
    const token = await loginToken()
    const { contractId, controlId, contractTitle, ruleTitle } = await createOperationalControl(token, 'ACTIVE')

    const controlsResponse = await request(app.server)
      .get('/compliance-controls?limit=10')
      .set('Authorization', `Bearer ${token}`)

    assert.equal(controlsResponse.status, 200)
    assert.equal(controlsResponse.body.status, 'ok')
    assert.equal(Array.isArray(controlsResponse.body.controls), true)
    assert.ok((controlsResponse.body.summary?.activeControls as number) >= 1)

    const executionResponse = await request(app.server)
      .post(`/compliance-controls/${controlId}/executions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        executionDate: '2026-06-11',
        status: 'completed',
        evidenceSummary: 'Checklist assinado e registro fotografico do servico.',
        evidenceReference: 'checklist-jantar-2026-06-11.pdf',
      })

    assert.equal(executionResponse.status, 201)
    assert.equal(executionResponse.body.status, 'ok')
    assert.equal(executionResponse.body.execution?.status, 'completed')

    const findingResponse = await request(app.server)
      .post(`/compliance-controls/${controlId}/findings`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        severity: 'HIGH',
        description: 'Desvio operacional identificado no ciclo de execução.',
        status: 'OPEN',
      })

    assert.equal(findingResponse.status, 201)
    assert.equal(findingResponse.body.status, 'ok')

    const findingId = findingResponse.body.finding?.id as string

    const resolveFindingResponse = await request(app.server)
      .patch(`/compliance-controls/${controlId}/findings/${findingId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'RESOLVED',
        description: 'Desvio tratado após rechecagem da evidência operacional.',
        evidenceReference: 'checklist-jantar-2026-06-11.pdf',
      })

    assert.equal(resolveFindingResponse.status, 200)
    assert.equal(resolveFindingResponse.body.status, 'ok')
    assert.equal(resolveFindingResponse.body.finding?.status, 'RESOLVED')

    const detailResponse = await getControlDetail(token, controlId)

    assert.equal(detailResponse.control.origin?.contractTitle, contractTitle)
    assert.equal(detailResponse.control.origin?.ruleTitle, ruleTitle)
    assert.ok((detailResponse.evidenceReferences?.length ?? 0) >= 1)
    assert.ok((detailResponse.events?.length ?? 0) >= 1)
    assert.ok((detailResponse.timeline?.some((item) => item.type === 'execution')) ?? false)
    assert.ok((detailResponse.findings?.some((item) => item.id === findingId && item.status === 'RESOLVED')) ?? false)

    const contractControlsResponse = await request(app.server)
      .get(`/contracts/${contractId}/controls`)
      .set('Authorization', `Bearer ${token}`)

    assert.equal(contractControlsResponse.status, 200)
    assert.equal(contractControlsResponse.body.status, 'ok')
    assert.equal(contractControlsResponse.body.controls?.[0]?.id, controlId)
  })

  it('control state machine should accept valid transitions and reject invalid ones without events', async () => {
    const token = await loginToken()
    const { controlId } = await createOperationalControl(token, 'DRAFT')

    let detail = await getControlDetail(token, controlId)
    const initialEventCount = detail.events.length

    const invalidDraftToCompleted = await request(app.server)
      .patch(`/compliance-controls/${controlId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'COMPLETED',
        justification: 'Tentativa inválida de encerramento direto.',
      })

    assert.equal(invalidDraftToCompleted.status, 409)
    assert.match(invalidDraftToCompleted.body.message, /Transicao de status invalida/i)
    detail = await getControlDetail(token, controlId)
    assert.equal(detail.events.length, initialEventCount)
    assert.equal(detail.control.status, 'DRAFT')

    const toActive = await request(app.server)
      .patch(`/compliance-controls/${controlId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'ACTIVE',
        justification: 'Controle liberado após validação humana.',
        evidenceReference: 'checklist-validacao-ativa.pdf',
      })

    assert.equal(toActive.status, 200)
    detail = await getControlDetail(token, controlId)
    assert.equal(detail.control.status, 'ACTIVE')
    assert.equal(detail.events.length, initialEventCount + 1)
    assert.ok(detail.events.some((item) => item.previousStatus === 'DRAFT' && item.nextStatus === 'ACTIVE' && item.justification?.includes('validação humana')))

    const toPaused = await request(app.server)
      .patch(`/compliance-controls/${controlId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'PAUSED',
        justification: 'Pausa operacional solicitada pela gestão.',
      })

    assert.equal(toPaused.status, 200)
    detail = await getControlDetail(token, controlId)
    assert.equal(detail.control.status, 'PAUSED')
    assert.equal(detail.events.length, initialEventCount + 2)

    const invalidPausedToCompleted = await request(app.server)
      .patch(`/compliance-controls/${controlId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'COMPLETED',
        justification: 'Tentativa inválida a partir de pausado.',
      })

    assert.equal(invalidPausedToCompleted.status, 409)
    detail = await getControlDetail(token, controlId)
    assert.equal(detail.events.length, initialEventCount + 2)
    assert.equal(detail.control.status, 'PAUSED')

    const backToActive = await request(app.server)
      .patch(`/compliance-controls/${controlId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'ACTIVE',
        justification: 'Controle reativado após revisão.',
      })

    assert.equal(backToActive.status, 200)

    const toNonCompliant = await request(app.server)
      .patch(`/compliance-controls/${controlId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'NON_COMPLIANT',
        justification: 'Desvio operacional confirmado na inspeção.',
        evidenceReference: 'relatorio-inspecao-2026-06-11.pdf',
      })

    assert.equal(toNonCompliant.status, 200)

    const toCompleted = await request(app.server)
      .patch(`/compliance-controls/${controlId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'COMPLETED',
        justification: 'Ciclo concluído após tratamento.',
      })

    assert.equal(toCompleted.status, 200)
    detail = await getControlDetail(token, controlId)
    assert.equal(detail.control.status, 'COMPLETED')

    const invalidCompletedToActive = await request(app.server)
      .patch(`/compliance-controls/${controlId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'ACTIVE',
        justification: 'Tentativa de reabertura inválida.',
      })

    assert.equal(invalidCompletedToActive.status, 409)
    detail = await getControlDetail(token, controlId)
    assert.equal(detail.control.status, 'COMPLETED')
    assert.equal(detail.events.length, initialEventCount + 5)
    assert.ok(detail.events.some((item) => item.previousStatus === 'NON_COMPLIANT' && item.nextStatus === 'COMPLETED'))
  })

  it('finding lifecycle should create events and block invalid regressions', async () => {
    const token = await loginToken()
    const { controlId } = await createOperationalControl(token, 'ACTIVE')

    const openFindingResponse = await request(app.server)
      .post(`/compliance-controls/${controlId}/findings`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        severity: 'CRITICAL',
        description: 'Falha severa registrada na execução manual.',
        status: 'OPEN',
      })

    assert.equal(openFindingResponse.status, 201)
    const findingId = openFindingResponse.body.finding?.id as string

    let detail = await getControlDetail(token, controlId)
    const initialFindingEvents = detail.findingEvents.length

    const inAnalysisResponse = await request(app.server)
      .patch(`/compliance-controls/${controlId}/findings/${findingId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'IN_ANALYSIS',
        description: 'Finding encaminhado para análise operacional.',
      })

    assert.equal(inAnalysisResponse.status, 200)
    detail = await getControlDetail(token, controlId)
    assert.equal(detail.findings.find((item) => item.id === findingId)?.status, 'IN_ANALYSIS')
    assert.equal(detail.findingEvents.length, initialFindingEvents + 1)

    const resolvedResponse = await request(app.server)
      .patch(`/compliance-controls/${controlId}/findings/${findingId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'RESOLVED',
        description: 'Falha corrigida após revisão da evidência.',
        evidenceReference: 'evidencia-resolucao-2026-06-11.pdf',
      })

    assert.equal(resolvedResponse.status, 200)
    detail = await getControlDetail(token, controlId)
    assert.equal(detail.findings.find((item) => item.id === findingId)?.status, 'RESOLVED')
    assert.equal(detail.findingEvents.length, initialFindingEvents + 2)

    const invalidResolvedToOpen = await request(app.server)
      .patch(`/compliance-controls/${controlId}/findings/${findingId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'OPEN',
        description: 'Reabertura inválida.',
      })

    assert.equal(invalidResolvedToOpen.status, 409)
    detail = await getControlDetail(token, controlId)
    assert.equal(detail.findings.find((item) => item.id === findingId)?.status, 'RESOLVED')
    assert.equal(detail.findingEvents.length, initialFindingEvents + 2)

    const riskFindingResponse = await request(app.server)
      .post(`/compliance-controls/${controlId}/findings`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        severity: 'MEDIUM',
        description: 'Risco aceito após avaliação humana.',
        status: 'OPEN',
      })

    assert.equal(riskFindingResponse.status, 201)
    const riskFindingId = riskFindingResponse.body.finding?.id as string

    const acceptedRiskResponse = await request(app.server)
      .patch(`/compliance-controls/${controlId}/findings/${riskFindingId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'ACCEPTED_RISK',
        description: 'Risco aceito formalmente pela liderança.',
      })

    assert.equal(acceptedRiskResponse.status, 200)

    const invalidAcceptedRiskToOpen = await request(app.server)
      .patch(`/compliance-controls/${controlId}/findings/${riskFindingId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'OPEN',
        description: 'Reabertura inválida de risco aceito.',
      })

    assert.equal(invalidAcceptedRiskToOpen.status, 409)
    detail = await getControlDetail(token, controlId)
    assert.equal(detail.findingEvents.filter((item) => item.findingId === riskFindingId).length, 2)
  })
})
