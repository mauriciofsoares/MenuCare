import type { FastifyInstance } from 'fastify';
import { createRulesService, type Deps } from './service.js';

export const registerRulesRoutes = (app: FastifyInstance, deps: Deps) => {
  const service = createRulesService(deps);
  const { apiMessage, authenticate, ruleSchema, ruleParamsSchema, ruleStatusUpdateSchema, z } = service;

app.post('/rules', { preHandler: authenticate }, async (request, reply) => {
  const parsed = ruleSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  const result = await service.createRule(request, parsed.data);
  return reply.code(result.statusCode).send(result.body);
});

app.patch('/rules/:ruleId/status', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = ruleParamsSchema.safeParse(request.params);
  const parsedBody = ruleStatusUpdateSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  const result = await service.updateRuleStatus(request, parsedParams.data, parsedBody.data);
  return reply.code(result.statusCode).send(result.body);
});

app.patch('/rules/:ruleId', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = ruleParamsSchema.safeParse(request.params);
  const parsedBody = z.object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().min(3).max(1200).optional(),
    category: z.string().trim().min(2).max(80).optional(),
    ruleType: z.string().trim().min(1).max(120).nullable().optional(),
    periodicity: z.string().trim().min(1).max(80).nullable().optional(),
    quantity: z.coerce.number().finite().nullable().optional(),
    unitMeasure: z.string().trim().min(1).max(80).nullable().optional(),
    calculationBasis: z.string().trim().min(1).max(240).nullable().optional(),
    applicability: z.string().trim().min(1).max(120).nullable().optional(),
  }).safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  const result = await service.updateRule(request, parsedParams.data, parsedBody.data);
  return reply.code(result.statusCode).send(result.body);
});

app.post('/rules/:ruleId/promote-control', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = ruleParamsSchema.safeParse(request.params);
  const parsedBody = z.object({
    title: z.string().trim().min(3).max(160).optional(),
    operationalDescription: z.string().trim().min(3).max(800),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'per_shift', 'on_demand']),
    responsible: z.string().trim().min(2).max(120),
    expectedEvidence: z.string().trim().min(3).max(500),
    status: z.enum(['DRAFT', 'ACTIVE']).default('ACTIVE'),
  }).safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  const result = await service.promoteRuleToControl(request, parsedParams.data, parsedBody.data);
  return reply.code(result.statusCode).send(result.body);
});

app.delete('/rules/:ruleId', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = ruleParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  const result = await service.deleteRule(request, parsedParams.data);
  return reply.code(result.statusCode).send(result.body);
});

app.get('/rules/:ruleId/history', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = ruleParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  const result = await service.getRuleHistory(request, parsedParams.data);
  return reply.code(result.statusCode).send(result.body);
});

app.get('/rules/:ruleId/evidence', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = ruleParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  const result = await service.getRuleEvidence(request, parsedParams.data);
  return reply.code(result.statusCode).send(result.body);
});

app.get('/rules', { preHandler: authenticate }, async (request, reply) => {
  const query = z
    .object({
      contractId: z.string().min(1).optional(),
      siteId: z.string().min(1).optional(),
      status: z.enum(['pending', 'approved', 'rejected']).optional(),
      category: z.string().trim().min(1).max(80).optional(),
      limit: z.coerce.number().int().catch(50).default(50),
    })
    .safeParse(request.query);

  if (!query.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  const limit = Math.min(Math.max(query.data.limit, 1), 100);
  const status = query.data.status;
  const category = query.data.category;
  const contractId = query.data.contractId;
  const siteId = query.data.siteId;

  const result = await service.listRules(request, { limit, status, category, contractId, siteId });
  return reply.code(result.statusCode).send(result.body);
});
};
