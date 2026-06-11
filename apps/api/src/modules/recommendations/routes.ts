import type { FastifyInstance } from 'fastify';
import { createRecommendationsService, type Deps } from './service.js';

type NextMenuProposalData = any;

export const registerRecommendationsRoutes = (app: FastifyInstance, deps: Deps) => {
  const service = createRecommendationsService(deps);
  const { apiMessage, authenticate, menuImportParamsSchema, nextMenuDecisionSchema, nextMenuDecisionListQuerySchema } = service;

app.get('/governance/recommendations/:importId', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = menuImportParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Identificador de importacao invalido.',
    });
  }

  const result = await service.getRecommendationPreview(request, parsedParams.data);
  return reply.code(result.statusCode).send(result.body);
});

app.post('/governance/recommendations/:importId/next-menu', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = menuImportParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Identificador de importacao invalido.',
    });
  }

  const result = await service.createNextMenuProposal(request, parsedParams.data);
  return reply.code(result.statusCode).send(result.body);
});

app.post('/governance/recommendations/:importId/next-menu/decision', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = menuImportParamsSchema.safeParse(request.params);
  const parsedBody = nextMenuDecisionSchema.safeParse(request.body);

  if (!parsedParams.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Identificador de importacao invalido.',
    });
  }

  if (!parsedBody.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Payload de decisao invalido. Informe decisao e justificativa.',
    });
  }

  const result = await service.saveDecision(request, parsedParams.data, parsedBody.data);
  return reply.code(result.statusCode).send(result.body);
});

app.get('/governance/recommendations/:importId/next-menu/decisions', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = menuImportParamsSchema.safeParse(request.params);
  const parsedQuery = nextMenuDecisionListQuerySchema.safeParse(request.query);

  if (!parsedParams.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Identificador de importacao invalido.',
    });
  }

  if (!parsedQuery.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Parametros de consulta invalidos.',
    });
  }

  const result = await service.listDecisions(request, parsedParams.data, parsedQuery.data);
  return reply.code(result.statusCode).send(result.body as { status: string; decisions: NextMenuProposalData[] });
});
};