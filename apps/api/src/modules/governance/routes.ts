import type { FastifyInstance } from 'fastify';
import { createGovernanceService, type Deps } from './service.js';

export const registerGovernanceRoutes = (app: FastifyInstance, deps: Deps) => {
  const service = createGovernanceService(deps);
  const { authenticate } = service;

app.get('/governance/recommendation-policy', { preHandler: authenticate }, async () => {
  const result = await service.getRecommendationPolicy();
  return result.body;
});
};