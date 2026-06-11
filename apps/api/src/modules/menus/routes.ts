import type { FastifyInstance } from 'fastify';
import { createMenusService, type Deps } from './service.js';

export const registerMenusRoutes = (app: FastifyInstance, deps: Deps) => {
  const service = createMenusService(deps);
  service.registerRoutes(app);
};
