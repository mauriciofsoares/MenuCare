import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from 'fastify';
import { createAuthRepository } from './repository.js';

type SafeParseSuccess<T> = { success: true; data: T };
type SafeParseFailure = { success: false };
type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure;

type SchemaLike<T> = {
  safeParse: (input: unknown) => SafeParseResult<T>;
};

type AccessUser = {
  id: string;
  email: string;
  name: string;
  companyName: string;
  accessProfile: string;
};

type DemoContext = {
  tenantId?: string | null;
  roleKey?: string | null;
};

type RouteResult = {
  statusCode: number;
  body: unknown;
};

type InviteAuditPayload = {
  companyName: string;
  inviteToken: string;
  inviteEmail: string;
  action: string;
  note: string;
  actorId: string;
  actorName: string;
};

type RefreshSessionCreateInput = {
  userId: string;
  email: string;
  companyName: string;
  accessProfile: string;
  tenantId?: string | null;
  roleKey?: string | null;
  userName: string;
  authFlowId: string;
  deviceFingerprint: string;
  deviceLabel: string;
  ipAddress: string;
};

type RefreshSessionRow = {
  id: string;
  user_id: string;
  email: string;
  user_name: string;
  company_name: string;
  access_profile: string;
  tenant_id?: string | null;
  role_key?: string | null;
  token_hash: string;
  auth_flow_id?: string | null;
  revoked_at?: Date | null;
  expires_at: Date;
};

export interface Deps {
  apiMessage: {
    auth: {
      sessionExpired: string;
      invalidCredentials: string;
      wrongEmailOrPassword: string;
      tooManyLoginAttempts: string;
      signedOut: string;
      invalidInvitePayload: string;
      invalidOrExpiredInvite: string;
      inviteActivated: string;
      inviteGenerated: string;
      inviteNotFound: string;
      inviteAlreadyInactive: string;
      inviteRevoked: string;
    };
    health: {
      dbUnavailable: string;
    };
    preferences: {
      invalidLocale: string;
    };
  };
  authenticate: any;
  authSchema: SchemaLike<{ email: string; password: string }>;
  consumeLoginAttempt: (key: string, now: number) => boolean;
  isLoginBlocked: (key: string, now: number) => boolean;
  demoUser: AccessUser;
  demoContext: DemoContext;
  demoPassword: string;
  prisma: {
    $queryRaw: <T>(query: TemplateStringsArray, ...params: unknown[]) => Promise<T>;
    $executeRaw: (query: TemplateStringsArray, ...params: unknown[]) => Promise<unknown>;
  } | null;
  readPasswordOverride: (email: string, companyName: string) => Promise<string | null>;
  verifyPassword: (plainText: string, hash: string) => Promise<boolean>;
  issueAccessToken: (...args: any[]) => Promise<string>;
  getRefreshSessionDeviceContext: (request: FastifyRequest) => {
    deviceFingerprint: string;
    deviceLabel: string;
    ipAddress: string;
  };
  resolveAuthFlowId: (...args: any[]) => string;
  setAuthFlowHeader: (reply: FastifyReply, authFlowId: string) => void;
  createRefreshSession: (...args: any[]) => Promise<{
    sessionId: string;
    refreshToken: string;
    expiresAt: Date;
  }>;
  setRefreshTokenCookie: (reply: FastifyReply, cookieValue: string, expiresAt: Date) => void;
  parseCookieHeader: (cookieHeader?: string) => Record<string, string>;
  refreshCookieName: string;
  readRefreshSession: (sessionId: string) => Promise<RefreshSessionRow | null>;
  revokeRefreshSession: (sessionId: string, replacedBySessionId?: string) => Promise<void>;
  clearRefreshTokenCookie: (reply: FastifyReply) => void;
  touchRefreshSession: (sessionId: string) => Promise<void>;
  getCompanyFromJwt: (request: FastifyRequest) => string;
  readOperationalProfile: (companyName: string) => Promise<unknown>;
  operationalProfileSchema: SchemaLike<Record<string, unknown>>;
  saveOperationalProfile: (companyName: string, profile: Record<string, unknown>) => Promise<void>;
  inviteActivationSchema: SchemaLike<{ token: string; password: string }>;
  ensureAuthTables: () => Promise<void>;
  hashPassword: (value: string) => Promise<string>;
  registerInviteAuditEvent: (payload: InviteAuditPayload) => Promise<void>;
  inviteCreationSchema: SchemaLike<{ email: string }>;
  getUserFromJwt: (request: FastifyRequest) => { id: string; name: string };
  inviteAuditQuerySchema: SchemaLike<{ limit: number }>;
  inviteListQuerySchema: SchemaLike<{ status: 'all' | 'active' | 'inactive'; limit: number }>;
  inviteTokenParamSchema: SchemaLike<{ token: string }>;
  localeByCompany: Map<string, string>;
  loginAttemptByKey: Map<string, unknown>;
  normalizeLocale: (locale?: string) => string;
  readLocaleFromDatabase: (companyName: string) => Promise<string | null>;
  saveLocaleInDatabase: (companyName: string, locale: string) => Promise<void>;
  localeSchema: SchemaLike<{ locale: string }>;
  randomUUID: () => string;
}

export const createAuthService = (deps: Deps) => {
  const repository = createAuthRepository(deps);

  const login = async (
    request: FastifyRequest,
    reply: FastifyReply,
    payload: { email: string; password: string },
    logger: FastifyBaseLogger,
  ): Promise<RouteResult> => {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const loginKey = normalizedEmail;
    const now = Date.now();

    if (deps.isLoginBlocked(loginKey, now)) {
      return {
        statusCode: 429,
        body: {
          status: 'error',
          message: deps.apiMessage.auth.tooManyLoginAttempts,
        },
      };
    }

    if (normalizedEmail !== deps.demoUser.email) {
      const blocked = deps.consumeLoginAttempt(loginKey, now);
      if (blocked) {
        return {
          statusCode: 429,
          body: {
            status: 'error',
            message: deps.apiMessage.auth.tooManyLoginAttempts,
          },
        };
      }

      return {
        statusCode: 401,
        body: {
          status: 'error',
          message: deps.apiMessage.auth.wrongEmailOrPassword,
        },
      };
    }

    let isValidPassword = payload.password === deps.demoPassword;

    if (deps.prisma) {
      try {
        const storedHash = await deps.readPasswordOverride(normalizedEmail, deps.demoUser.companyName);
        if (storedHash) {
          isValidPassword = await deps.verifyPassword(payload.password, storedHash);
        }
      } catch (error) {
        logger.warn({ error }, 'Falha ao validar credencial persistida.');
      }
    }

    if (!isValidPassword) {
      const blocked = deps.consumeLoginAttempt(loginKey, now);
      if (blocked) {
        return {
          statusCode: 429,
          body: {
            status: 'error',
            message: deps.apiMessage.auth.tooManyLoginAttempts,
          },
        };
      }

      return {
        statusCode: 401,
        body: {
          status: 'error',
          message: deps.apiMessage.auth.wrongEmailOrPassword,
        },
      };
    }

    deps.loginAttemptByKey.delete(loginKey);

    const token = await deps.issueAccessToken(reply, {
      id: deps.demoUser.id,
      email: deps.demoUser.email,
      name: deps.demoUser.name,
      companyName: deps.demoUser.companyName,
      accessProfile: deps.demoUser.accessProfile,
      tenantId: deps.demoContext.tenantId,
      roleKey: deps.demoContext.roleKey,
    });

    const deviceContext = deps.getRefreshSessionDeviceContext(request);
    const authFlowId = deps.resolveAuthFlowId(request);
    deps.setAuthFlowHeader(reply, authFlowId);

    try {
      const refreshSession = await deps.createRefreshSession({
        userId: deps.demoUser.id,
        email: deps.demoUser.email,
        companyName: deps.demoUser.companyName,
        accessProfile: deps.demoUser.accessProfile,
        tenantId: deps.demoContext.tenantId,
        roleKey: deps.demoContext.roleKey,
        userName: deps.demoUser.name,
        authFlowId,
        deviceFingerprint: deviceContext.deviceFingerprint,
        deviceLabel: deviceContext.deviceLabel,
        ipAddress: deviceContext.ipAddress,
      });

      deps.setRefreshTokenCookie(
        reply,
        `${refreshSession.sessionId}.${refreshSession.refreshToken}`,
        refreshSession.expiresAt,
      );
    } catch (error) {
      logger.warn({ error }, 'Falha ao criar sessao de refresh token.');
    }

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        token,
        user: deps.demoUser,
      },
    };
  };

  const refresh = async (request: FastifyRequest, reply: FastifyReply): Promise<RouteResult> => {
    const cookieMap = deps.parseCookieHeader(request.headers.cookie);
    const refreshCookieValue = cookieMap[deps.refreshCookieName];

    if (!refreshCookieValue || !refreshCookieValue.includes('.')) {
      return {
        statusCode: 401,
        body: {
          status: 'error',
          message: deps.apiMessage.auth.sessionExpired,
        },
      };
    }

    const [sessionId, refreshToken] = refreshCookieValue.split('.', 2);

    if (!sessionId || !refreshToken) {
      return {
        statusCode: 401,
        body: {
          status: 'error',
          message: deps.apiMessage.auth.sessionExpired,
        },
      };
    }

    const session = await deps.readRefreshSession(sessionId);
    const authFlowId = deps.resolveAuthFlowId(request, session?.auth_flow_id ?? undefined);
    deps.setAuthFlowHeader(reply, authFlowId);

    if (!session || session.revoked_at || session.expires_at.getTime() <= Date.now()) {
      if (session?.id && !session.revoked_at) {
        await deps.revokeRefreshSession(session.id);
      }

      deps.clearRefreshTokenCookie(reply);

      return {
        statusCode: 401,
        body: {
          status: 'error',
          message: deps.apiMessage.auth.sessionExpired,
        },
      };
    }

    const validRefreshToken = await deps.verifyPassword(refreshToken, session.token_hash);

    if (!validRefreshToken) {
      await deps.revokeRefreshSession(session.id);
      deps.clearRefreshTokenCookie(reply);

      return {
        statusCode: 401,
        body: {
          status: 'error',
          message: deps.apiMessage.auth.sessionExpired,
        },
      };
    }

    await deps.touchRefreshSession(session.id);
    const deviceContext = deps.getRefreshSessionDeviceContext(request);

    const nextRefreshSession = await deps.createRefreshSession({
      userId: session.user_id,
      email: session.email,
      companyName: session.company_name,
      accessProfile: session.access_profile,
      tenantId: session.tenant_id,
      roleKey: session.role_key,
      userName: session.user_name,
      authFlowId,
      deviceFingerprint: deviceContext.deviceFingerprint,
      deviceLabel: deviceContext.deviceLabel,
      ipAddress: deviceContext.ipAddress,
    });

    await deps.revokeRefreshSession(session.id, nextRefreshSession.sessionId);
    deps.setRefreshTokenCookie(
      reply,
      `${nextRefreshSession.sessionId}.${nextRefreshSession.refreshToken}`,
      nextRefreshSession.expiresAt,
    );

    const token = await deps.issueAccessToken(reply, {
      id: session.user_id,
      email: session.email,
      name: session.user_name,
      companyName: session.company_name,
      accessProfile: session.access_profile,
      tenantId: session.tenant_id,
      roleKey: session.role_key,
    });

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        token,
        user: {
          id: session.user_id,
          email: session.email,
          name: session.user_name,
          companyName: session.company_name,
          accessProfile: session.access_profile,
        },
      },
    };
  };

  const getMe = async (request: FastifyRequest): Promise<RouteResult> => {
    const payload = request.user as {
      sub?: string;
      email?: string;
      name?: string;
      companyName?: string;
      accessProfile?: string;
    };

    const operationalProfile = await deps.readOperationalProfile(
      payload.companyName ?? deps.demoUser.companyName,
    );

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        user: {
          id: payload.sub ?? deps.demoUser.id,
          email: payload.email ?? deps.demoUser.email,
          name: payload.name ?? deps.demoUser.name,
          companyName: payload.companyName ?? deps.demoUser.companyName,
          accessProfile: payload.accessProfile ?? deps.demoUser.accessProfile,
        },
        operationalProfile,
      },
    };
  };

  const getOnboardingOperationalProfile = async (request: FastifyRequest): Promise<RouteResult> => {
    const companyName = deps.getCompanyFromJwt(request);
    const operationalProfile = await deps.readOperationalProfile(companyName);

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        operationalProfile,
      },
    };
  };

  const saveOnboardingOperationalProfile = async (
    request: FastifyRequest,
    profile: Record<string, unknown>,
  ): Promise<RouteResult> => {
    const companyName = deps.getCompanyFromJwt(request);
    await deps.saveOperationalProfile(companyName, profile);
    const operationalProfile = await deps.readOperationalProfile(companyName);

    return {
      statusCode: 201,
      body: {
        status: 'ok',
        operationalProfile,
      },
    };
  };

  const logout = async (request: FastifyRequest, reply: FastifyReply): Promise<RouteResult> => {
    const cookieMap = deps.parseCookieHeader(request.headers.cookie);
    const refreshCookieValue = cookieMap[deps.refreshCookieName];
    let authFlowId = deps.resolveAuthFlowId(request);

    if (refreshCookieValue && refreshCookieValue.includes('.')) {
      const [sessionId] = refreshCookieValue.split('.', 2);

      if (sessionId) {
        const session = await deps.readRefreshSession(sessionId);
        authFlowId = deps.resolveAuthFlowId(request, session?.auth_flow_id ?? undefined);
        await deps.revokeRefreshSession(sessionId);
      }
    }

    deps.setAuthFlowHeader(reply, authFlowId);
    deps.clearRefreshTokenCookie(reply);

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        message: deps.apiMessage.auth.signedOut,
      },
    };
  };

  const activateFirstAccess = async (
    payload: { token: string; password: string },
  ): Promise<RouteResult> => {
    if (!deps.prisma) {
      return {
        statusCode: 503,
        body: {
          status: 'error',
          message: deps.apiMessage.health.dbUnavailable,
        },
      };
    }

    await deps.ensureAuthTables();

    const normalizedToken = payload.token.trim();
    const inviteRows = await deps.prisma.$queryRaw<Array<{ email: string; company_name: string }>>`
      SELECT email, company_name
      FROM first_access_invites
      WHERE token = ${normalizedToken}
        AND is_active = TRUE
      LIMIT 1
    `;

    const invite = inviteRows[0];

    if (!invite) {
      return {
        statusCode: 400,
        body: {
          status: 'error',
          message: deps.apiMessage.auth.invalidOrExpiredInvite,
        },
      };
    }

    const passwordHash = await deps.hashPassword(payload.password);

    await deps.prisma.$executeRaw`
      INSERT INTO auth_password_overrides (email, company_name, password_hash)
      VALUES (${invite.email}, ${invite.company_name}, ${passwordHash})
      ON CONFLICT (email)
      DO UPDATE SET
        company_name = EXCLUDED.company_name,
        password_hash = EXCLUDED.password_hash,
        updated_at = NOW()
    `;

    await deps.prisma.$executeRaw`
      UPDATE first_access_invites
      SET is_active = FALSE,
          used_at = NOW()
      WHERE token = ${normalizedToken}
    `;

    await deps.registerInviteAuditEvent({
      companyName: invite.company_name,
      inviteToken: normalizedToken,
      inviteEmail: invite.email,
      action: 'activated',
      note: 'Convite utilizado para definir senha inicial.',
      actorId: 'first-access',
      actorName: invite.email,
    });

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        message: deps.apiMessage.auth.inviteActivated,
        email: invite.email,
      },
    };
  };

  const createInvite = async (
    request: FastifyRequest,
    payload: { email: string },
  ): Promise<RouteResult> => {
    if (!deps.prisma) {
      return {
        statusCode: 503,
        body: {
          status: 'error',
          message: deps.apiMessage.health.dbUnavailable,
        },
      };
    }

    await deps.ensureAuthTables();

    const companyName = deps.getCompanyFromJwt(request);
    const actor = deps.getUserFromJwt(request);
    const normalizedEmail = payload.email.trim().toLowerCase();
    const inviteToken = `INV-${deps.randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`;

    await deps.prisma.$executeRaw`
      UPDATE first_access_invites
      SET is_active = FALSE,
          used_at = NOW()
      WHERE email = ${normalizedEmail}
        AND company_name = ${companyName}
        AND is_active = TRUE
    `;

    await deps.prisma.$executeRaw`
      INSERT INTO first_access_invites (token, email, company_name, is_active)
      VALUES (${inviteToken}, ${normalizedEmail}, ${companyName}, TRUE)
    `;

    await deps.registerInviteAuditEvent({
      companyName,
      inviteToken,
      inviteEmail: normalizedEmail,
      action: 'generated',
      note: 'Convite criado no portal administrativo.',
      actorId: actor.id,
      actorName: actor.name,
    });

    return {
      statusCode: 201,
      body: {
        status: 'ok',
        message: deps.apiMessage.auth.inviteGenerated,
        invite: {
          token: inviteToken,
          email: normalizedEmail,
          companyName,
          active: true,
        },
      },
    };
  };

  const listInviteAudit = async (
    request: FastifyRequest,
    query: { limit: number },
  ): Promise<RouteResult> => {
    if (!deps.prisma) {
      return {
        statusCode: 503,
        body: {
          status: 'error',
          message: deps.apiMessage.health.dbUnavailable,
        },
      };
    }

    const companyName = deps.getCompanyFromJwt(request);
    await deps.ensureAuthTables();

    const events = await deps.prisma.$queryRaw<
      Array<{
        id: string;
        invite_token: string;
        invite_email: string;
        action: string;
        note: string | null;
        actor_name: string;
        created_at: Date;
      }>
    >`
      SELECT id, invite_token, invite_email, action, note, actor_name, created_at
      FROM invite_audit_events
      WHERE company_name = ${companyName}
      ORDER BY created_at DESC
      LIMIT ${query.limit}
    `;

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        events: events.map((event) => ({
          id: event.id,
          inviteToken: event.invite_token,
          inviteEmail: event.invite_email,
          action: event.action,
          note: event.note,
          actorName: event.actor_name,
          createdAt: event.created_at.toISOString(),
        })),
      },
    };
  };

  const listInvites = async (
    request: FastifyRequest,
    query: { status: 'all' | 'active' | 'inactive'; limit: number },
  ): Promise<RouteResult> => {
    if (!deps.prisma) {
      return {
        statusCode: 503,
        body: {
          status: 'error',
          message: deps.apiMessage.health.dbUnavailable,
        },
      };
    }

    const companyName = deps.getCompanyFromJwt(request);
    await deps.ensureAuthTables();

    const invites =
      query.status === 'all'
        ? await deps.prisma.$queryRaw<
            Array<{
              token: string;
              email: string;
              is_active: boolean;
              used_at: Date | null;
              created_at: Date;
            }>
          >`
            SELECT token, email, is_active, used_at, created_at
            FROM first_access_invites
            WHERE company_name = ${companyName}
            ORDER BY created_at DESC
            LIMIT ${query.limit}
          `
        : await deps.prisma.$queryRaw<
            Array<{
              token: string;
              email: string;
              is_active: boolean;
              used_at: Date | null;
              created_at: Date;
            }>
          >`
            SELECT token, email, is_active, used_at, created_at
            FROM first_access_invites
            WHERE company_name = ${companyName}
              AND is_active = ${query.status === 'active'}
            ORDER BY created_at DESC
            LIMIT ${query.limit}
          `;

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        invites: invites.map((invite) => ({
          token: invite.token,
          email: invite.email,
          active: invite.is_active,
          usedAt: invite.used_at ? invite.used_at.toISOString() : null,
          createdAt: invite.created_at.toISOString(),
        })),
      },
    };
  };

  const revokeInvite = async (
    request: FastifyRequest,
    payload: { token: string },
  ): Promise<RouteResult> => {
    if (!deps.prisma) {
      return {
        statusCode: 503,
        body: {
          status: 'error',
          message: deps.apiMessage.health.dbUnavailable,
        },
      };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const actor = deps.getUserFromJwt(request);
    const inviteRows = await deps.prisma.$queryRaw<Array<{ token: string; is_active: boolean }>>`
      SELECT token, is_active
      FROM first_access_invites
      WHERE token = ${payload.token}
        AND company_name = ${companyName}
      LIMIT 1
    `;

    const invite = inviteRows[0];

    if (!invite) {
      return {
        statusCode: 404,
        body: {
          status: 'error',
          message: deps.apiMessage.auth.inviteNotFound,
        },
      };
    }

    if (!invite.is_active) {
      return {
        statusCode: 409,
        body: {
          status: 'error',
          message: deps.apiMessage.auth.inviteAlreadyInactive,
        },
      };
    }

    await deps.prisma.$executeRaw`
      UPDATE first_access_invites
      SET is_active = FALSE,
          used_at = NOW()
      WHERE token = ${payload.token}
        AND company_name = ${companyName}
    `;

    const emailRows = await deps.prisma.$queryRaw<Array<{ email: string }>>`
      SELECT email
      FROM first_access_invites
      WHERE token = ${payload.token}
        AND company_name = ${companyName}
      LIMIT 1
    `;

    await deps.registerInviteAuditEvent({
      companyName,
      inviteToken: payload.token,
      inviteEmail: emailRows[0]?.email ?? 'desconhecido',
      action: 'revoked',
      note: 'Convite revogado manualmente no portal.',
      actorId: actor.id,
      actorName: actor.name,
    });

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        message: deps.apiMessage.auth.inviteRevoked,
      },
    };
  };

  const regenerateInvite = async (
    request: FastifyRequest,
    payload: { token: string },
  ): Promise<RouteResult> => {
    if (!deps.prisma) {
      return {
        statusCode: 503,
        body: {
          status: 'error',
          message: deps.apiMessage.health.dbUnavailable,
        },
      };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const actor = deps.getUserFromJwt(request);
    const inviteRows = await deps.prisma.$queryRaw<Array<{ email: string }>>`
      SELECT email
      FROM first_access_invites
      WHERE token = ${payload.token}
        AND company_name = ${companyName}
      LIMIT 1
    `;

    const invite = inviteRows[0];

    if (!invite) {
      return {
        statusCode: 404,
        body: {
          status: 'error',
          message: deps.apiMessage.auth.inviteNotFound,
        },
      };
    }

    await deps.ensureAuthTables();

    const inviteToken = `INV-${deps.randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`;

    await deps.prisma.$executeRaw`
      UPDATE first_access_invites
      SET is_active = FALSE,
          used_at = NOW()
      WHERE email = ${invite.email}
        AND company_name = ${companyName}
        AND is_active = TRUE
    `;

    await deps.prisma.$executeRaw`
      INSERT INTO first_access_invites (token, email, company_name, is_active)
      VALUES (${inviteToken}, ${invite.email}, ${companyName}, TRUE)
    `;

    await deps.registerInviteAuditEvent({
      companyName,
      inviteToken,
      inviteEmail: invite.email,
      action: 'regenerated',
      note: `Regenerado a partir do convite ${payload.token}.`,
      actorId: actor.id,
      actorName: actor.name,
    });

    return {
      statusCode: 201,
      body: {
        status: 'ok',
        message: deps.apiMessage.auth.inviteGenerated,
        invite: {
          token: inviteToken,
          email: invite.email,
          companyName,
          active: true,
        },
      },
    };
  };

  const getLocale = async (
    request: FastifyRequest,
    logger: FastifyBaseLogger,
  ): Promise<RouteResult> => {
    const companyName = deps.getCompanyFromJwt(request);
    const fallbackLocale =
      deps.localeByCompany.get(companyName) ?? deps.normalizeLocale(process.env.API_LOCALE);

    try {
      const persistedLocale = await deps.readLocaleFromDatabase(companyName);

      if (persistedLocale) {
        deps.localeByCompany.set(companyName, persistedLocale);
        return {
          statusCode: 200,
          body: {
            status: 'ok',
            locale: persistedLocale,
          },
        };
      }
    } catch (error) {
      logger.warn({ error }, 'Falha ao carregar preferencia de idioma no PostgreSQL.');
    }

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        locale: fallbackLocale,
      },
    };
  };

  const saveLocale = async (
    request: FastifyRequest,
    payload: { locale: string },
    logger: FastifyBaseLogger,
  ): Promise<RouteResult> => {
    const companyName = deps.getCompanyFromJwt(request);
    const resolvedLocale = deps.normalizeLocale(payload.locale);
    deps.localeByCompany.set(companyName, resolvedLocale);

    try {
      await deps.saveLocaleInDatabase(companyName, resolvedLocale);
    } catch (error) {
      logger.warn({ error }, 'Falha ao salvar preferencia de idioma no PostgreSQL.');
    }

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        locale: resolvedLocale,
      },
    };
  };

  return {
    repository,
    authenticate: deps.authenticate,
    authSchema: deps.authSchema,
    operationalProfileSchema: deps.operationalProfileSchema,
    inviteActivationSchema: deps.inviteActivationSchema,
    inviteCreationSchema: deps.inviteCreationSchema,
    inviteAuditQuerySchema: deps.inviteAuditQuerySchema,
    inviteListQuerySchema: deps.inviteListQuerySchema,
    inviteTokenParamSchema: deps.inviteTokenParamSchema,
    localeSchema: deps.localeSchema,
    apiMessage: deps.apiMessage,
    login,
    refresh,
    getMe,
    getOnboardingOperationalProfile,
    saveOnboardingOperationalProfile,
    logout,
    activateFirstAccess,
    createInvite,
    listInviteAudit,
    listInvites,
    revokeInvite,
    regenerateInvite,
    getLocale,
    saveLocale,
  };
};
