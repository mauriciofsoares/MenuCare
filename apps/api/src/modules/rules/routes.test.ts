import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import Fastify from 'fastify';
import { z } from 'zod';
import { contractMemory } from '../contracts/service.js';
import { registerRulesRoutes } from './routes.js';
import { ruleMemory, type Deps } from './service.js';

const fixedDate = new Date('2026-06-13T00:00:00.000Z');

const buildDeps = (): Deps => ({
  apiMessage: {
    auth: { invalidCredentials: 'Entrada invalida.' },
    health: { dbUnavailable: 'Banco indisponivel.' },
  },
  authenticate: async () => undefined,
  ruleSchema: z.object({
    contractId: z.string(),
    title: z.string(),
    description: z.string(),
    category: z.string(),
    sourceExcerpt: z.string().optional(),
    sourcePage: z.number().optional(),
    evidenceConfidence: z.number().optional(),
    status: z.string(),
  }),
  ruleParamsSchema: z.object({ ruleId: z.string() }),
  ruleStatusUpdateSchema: z.object({ status: z.string(), note: z.string().nullable().optional() }),
  prisma: null,
  getCompanyFromJwt: () => 'OneSubSea',
  getTenantIdFromJwt: () => 'tenant-1',
  getUserFromJwt: () => ({ id: 'user-1', name: 'Tester' }),
  resolveAuthorizedSite: async (_request, siteId) => ({
    allowed: true,
    site: {
      id: siteId,
      tenantId: 'tenant-1',
      name: 'Sao Jose dos Pinhais',
      city: null,
      state: null,
      role: 'nutritionist',
    },
  }),
  listAuthorizedSites: async () => [
    {
      id: 'site-sjp',
      tenantId: 'tenant-1',
      name: 'Sao Jose dos Pinhais',
      city: null,
      state: null,
      role: 'nutritionist',
    },
  ],
  randomUUID: () => 'id-1',
  ensureDomainTables: async () => undefined,
  recordAiPreparationEvent: async () => undefined,
  buildRulePreparationContext: (payload) => payload,
  z,
});

const seedRule = (id: string, contractId: string, category = 'PROTEIN') => {
  ruleMemory.set(id, {
    id,
    tenantId: 'tenant-1',
    siteId: 'site-sjp',
    companyName: 'OneSubSea',
    contractId,
    title: `Regra ${id}`,
    description: `Descricao ${id}`,
    category,
    ruleType: null,
    periodicity: 'MONTHLY',
    quantity: null,
    unitMeasure: null,
    calculationBasis: null,
    applicability: null,
    sourceExcerpt: 'Trecho literal de evidencia.',
    sourceItem: '1',
    sourcePage: 1,
    sourceBlockId: null,
    evidenceConfidence: 0.9,
    status: 'pending',
    createdAt: fixedDate,
    updatedAt: fixedDate,
  });
};

describe('rules routes', () => {
  afterEach(() => {
    ruleMemory.clear();
    contractMemory.clear();
  });

  it('keeps contractId filter when limit is above the public maximum', async () => {
    const app = Fastify();
    registerRulesRoutes(app, buildDeps());

    contractMemory.set('contract-a', {
      id: 'contract-a',
      tenantId: 'tenant-1',
      siteId: 'site-sjp',
      siteName: 'Sao Jose dos Pinhais',
      companyName: 'OneSubSea',
      title: 'Contrato A',
      sourceType: 'contract',
      status: 'rules_extracted',
      extractedText: null,
      inactivationReason: null,
      inactivatedAt: null,
      createdAt: fixedDate,
      createdBy: 'Tester',
    });
    contractMemory.set('contract-b', {
      id: 'contract-b',
      tenantId: 'tenant-1',
      siteId: 'site-sjp',
      siteName: 'Sao Jose dos Pinhais',
      companyName: 'OneSubSea',
      title: 'Contrato B',
      sourceType: 'contract',
      status: 'rules_extracted',
      extractedText: null,
      inactivationReason: null,
      inactivatedAt: null,
      createdAt: fixedDate,
      createdBy: 'Tester',
    });
    seedRule('rule-a', 'contract-a', 'PROTEIN');
    seedRule('rule-b', 'contract-b', 'SALAD');

    const response = await app.inject({
      method: 'GET',
      url: '/rules?contractId=contract-a&limit=200',
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as { rules: Array<{ id: string; contractId: string }> };
    assert.deepEqual(body.rules.map((rule) => rule.id), ['rule-a']);
    assert.ok(body.rules.every((rule) => rule.contractId === 'contract-a'));

    await app.close();
  });
});
