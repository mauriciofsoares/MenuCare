import type { FastifyInstance } from 'fastify';
import { createAuthService, type Deps } from './service.js';

export const registerAuthRoutes = (app: FastifyInstance, deps: Deps) => {
  const service = createAuthService(deps);
  const {
    apiMessage,
    authenticate,
    authSchema,
    operationalProfileSchema,
    inviteActivationSchema,
    inviteCreationSchema,
    inviteAuditQuerySchema,
    inviteListQuerySchema,
    inviteTokenParamSchema,
    localeSchema,
  } = service;

  app.post('/auth/login', async (request, reply) => {
    const parsed = authSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        status: 'error',
        message: apiMessage.auth.invalidCredentials,
      });
    }

    const result = await service.login(request, reply, parsed.data, app.log);
    return reply.code(result.statusCode).send(result.body);
  });

  app.post('/auth/refresh', async (request, reply) => {
    const result = await service.refresh(request, reply);
    return reply.code(result.statusCode).send(result.body);
  });

  app.get('/auth/me', { preHandler: authenticate as any }, async (request, reply) => {
    const result = await service.getMe(request);
    return reply.code(result.statusCode).send(result.body);
  });

  app.get('/onboarding/operational-profile', { preHandler: authenticate as any }, async (request, reply) => {
    const result = await service.getOnboardingOperationalProfile(request);
    return reply.code(result.statusCode).send(result.body);
  });

  app.post('/onboarding/operational-profile', { preHandler: authenticate as any }, async (request, reply) => {
    const parsed = operationalProfileSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        status: 'error',
        message: 'Perfil operacional invalido para onboarding.',
      });
    }

    const result = await service.saveOnboardingOperationalProfile(request, parsed.data);
    return reply.code(result.statusCode).send(result.body);
  });

  app.post('/auth/logout', { preHandler: authenticate as any }, async (request, reply) => {
    const result = await service.logout(request, reply);
    return reply.code(result.statusCode).send(result.body);
  });

  app.post('/auth/first-access/activate', async (request, reply) => {
    const parsed = inviteActivationSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        status: 'error',
        message: apiMessage.auth.invalidInvitePayload,
      });
    }

    const result = await service.activateFirstAccess(parsed.data);
    return reply.code(result.statusCode).send(result.body);
  });

  app.post('/auth/invites', { preHandler: authenticate as any }, async (request, reply) => {
    const parsed = inviteCreationSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        status: 'error',
        message: apiMessage.auth.invalidInvitePayload,
      });
    }

    const result = await service.createInvite(request, parsed.data);
    return reply.code(result.statusCode).send(result.body);
  });

  app.get('/auth/invites/audit', { preHandler: authenticate as any }, async (request, reply) => {
    const parsedQuery = inviteAuditQuerySchema.safeParse(request.query);
    const limit = parsedQuery.success ? parsedQuery.data.limit : 40;

    const result = await service.listInviteAudit(request, { limit });
    return reply.code(result.statusCode).send(result.body);
  });

  app.get('/auth/invites', { preHandler: authenticate as any }, async (request, reply) => {
    const parsedQuery = inviteListQuerySchema.safeParse(request.query);
    const status = parsedQuery.success ? parsedQuery.data.status : 'all';
    const limit = parsedQuery.success ? parsedQuery.data.limit : 30;

    const result = await service.listInvites(request, { status, limit });
    return reply.code(result.statusCode).send(result.body);
  });

  app.post('/auth/invites/:token/revoke', { preHandler: authenticate as any }, async (request, reply) => {
    const parsedParams = inviteTokenParamSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({
        status: 'error',
        message: apiMessage.auth.invalidInvitePayload,
      });
    }

    const result = await service.revokeInvite(request, parsedParams.data);
    return reply.code(result.statusCode).send(result.body);
  });

  app.post('/auth/invites/:token/regenerate', { preHandler: authenticate as any }, async (request, reply) => {
    const parsedParams = inviteTokenParamSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({
        status: 'error',
        message: apiMessage.auth.invalidInvitePayload,
      });
    }

    const result = await service.regenerateInvite(request, parsedParams.data);
    return reply.code(result.statusCode).send(result.body);
  });

  app.get('/preferences/locale', { preHandler: authenticate as any }, async (request, reply) => {
    const result = await service.getLocale(request, app.log);
    return reply.code(result.statusCode).send(result.body);
  });

  app.post('/preferences/locale', { preHandler: authenticate as any }, async (request, reply) => {
    const parsed = localeSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        status: 'error',
        message: apiMessage.preferences.invalidLocale,
      });
    }

    const result = await service.saveLocale(request, parsed.data, app.log);
    return reply.code(result.statusCode).send(result.body);
  });
};
