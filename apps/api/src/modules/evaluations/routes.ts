import type { FastifyInstance } from 'fastify';
import { createEvaluationsService, type Deps } from './service.js';

export const registerEvaluationsRoutes = (app: FastifyInstance, deps: Deps) => {
  const service = createEvaluationsService(deps);
  const { apiMessage, authenticate, evaluationImportSchema, evaluationImportListQuerySchema, intelligenceListQuerySchema } = service;

app.post('/evaluations/imports', { preHandler: authenticate }, async (request, reply) => {
  const parsed = evaluationImportSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Payload de importacao de avaliacoes invalido.',
    });
  }

  const result = await service.importEvaluation(request, parsed.data);
  return reply.code(result.statusCode).send(result.body);
});

app.get('/evaluations/imports', { preHandler: authenticate }, async (request, reply) => {
  const parsedQuery = evaluationImportListQuerySchema.safeParse(request.query);
  const limit = parsedQuery.success ? parsedQuery.data.limit : 20;

  const result = await service.listEvaluationImports(request, { limit });
  return reply.code(result.statusCode).send(result.body);
});

app.post('/evaluations/intelligence/rebuild', { preHandler: authenticate }, async (request, reply) => {
  const result = await service.rebuildIntelligence(request);
  return reply.code(result.statusCode).send(result.body);
});

app.get('/evaluations/intelligence', { preHandler: authenticate }, async (request, reply) => {
  const parsedQuery = intelligenceListQuerySchema.safeParse(request.query);
  const limit = parsedQuery.success ? parsedQuery.data.limit : 20;
  const result = await service.listIntelligence(request, { limit });
  return reply.code(result.statusCode).send(result.body);
});
};