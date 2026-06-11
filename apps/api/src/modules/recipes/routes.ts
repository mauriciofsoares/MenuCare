import type { FastifyInstance } from 'fastify';
import { createRecipesService, type Deps } from './service.js';

export const registerRecipesRoutes = (app: FastifyInstance, deps: Deps) => {
  const service = createRecipesService(deps);
  const { apiMessage, authenticate, recipeImportSchema, recipeParamsSchema, recipeClassificationUpdateSchema, z } = service;

app.post('/recipes/imports', { preHandler: authenticate }, async (request, reply) => {
  const parsed = recipeImportSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Payload de importacao de receitas invalido.',
    });
  }

  const result = await service.importRecipes(request, parsed.data);
  return reply.code(result.statusCode).send(result.body);
});

app.get('/recipes', { preHandler: authenticate }, async (request, reply) => {
  const query = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    category: z.string().trim().max(80).optional(),
    subcategory: z.string().trim().max(80).optional(),
    foodGroup: z.string().trim().max(80).optional(),
    active: z.enum(['all', 'active', 'inactive']).default('active'),
  }).safeParse(request.query);

  const { limit, category, subcategory, foodGroup, active } = query.success
    ? query.data
    : { limit: 20, category: undefined, subcategory: undefined, foodGroup: undefined, active: 'active' as const };

  const result = await service.listRecipes(request, { limit, category, subcategory, foodGroup, active });
  return reply.code(result.statusCode).send(result.body);
});

app.get('/recipes/coverage', { preHandler: authenticate }, async (request, reply) => {
  const result = await service.getCoverage(request);
  return reply.code(result.statusCode).send(result.body);
});

app.patch('/recipes/:recipeId/classification', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = recipeParamsSchema.safeParse(request.params);
  const parsedBody = recipeClassificationUpdateSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return reply.code(400).send({
      status: 'error',
      message: 'Payload de reclassificacao de receita invalido.',
    });
  }

  const result = await service.updateClassification(request, parsedParams.data, parsedBody.data);
  return reply.code(result.statusCode).send(result.body);
});
};