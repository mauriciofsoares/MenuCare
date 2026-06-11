import type { FastifyInstance } from 'fastify';
import { createComplianceService, type Deps } from './service.js';

export const registerComplianceRoutes = (app: FastifyInstance, deps: Deps) => {
  const service = createComplianceService(deps);
  service.registerRoutes(app);
};
