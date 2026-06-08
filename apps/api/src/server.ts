import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { getApiMessage } from './messages.js';

const app = Fastify({ logger: true });
const apiMessage = getApiMessage(process.env.API_LOCALE);

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const inviteActivationSchema = z.object({
  token: z.string().min(6),
  password: z.string().min(6),
});

const inviteCreationSchema = z.object({
  email: z.string().email(),
});

const inviteListQuerySchema = z.object({
  status: z.enum(['all', 'active', 'used']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const inviteAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

const inviteTokenParamSchema = z.object({
  token: z.string().min(6),
});

const localeSchema = z.object({
  locale: z.enum(['pt-BR', 'en-US']),
});

const contractSchema = z.object({
  title: z.string().min(3),
  sourceType: z.enum(['contract', 'bid_notice', 'reference_term', 'regulation']),
  status: z.enum(['draft', 'processing', 'active', 'archived']).default('processing'),
});

const ruleSchema = z.object({
  contractId: z.string().min(1),
  title: z.string().min(3),
  description: z.string().min(3),
  category: z.string().min(2),
  status: z
    .enum(['identified', 'under_review', 'approved', 'rejected', 'archived'])
    .default('identified'),
});

const ruleStatusUpdateSchema = z.object({
  status: z.enum(['identified', 'under_review', 'approved', 'rejected', 'archived']),
  note: z.string().min(3).max(300).optional(),
});

const ruleParamsSchema = z.object({
  ruleId: z.string().min(1),
});

const nonConformitySchema = z.object({
  title: z.string().min(3),
  description: z.string().min(3),
  origin: z.string().min(2),
  impact: z.string().min(2),
  owner: z.string().min(2),
  dueDate: z.string().min(8),
  status: z.enum(['open', 'in_progress', 'resolved', 'cancelled']).default('open'),
});

const nonConformityStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'cancelled']),
});

const nonConformityParamsSchema = z.object({
  nonConformityId: z.string().min(1),
});

const actionPlanSchema = z.object({
  description: z.string().min(3),
  owner: z.string().min(2),
  dueDate: z.string().min(8),
  status: z.enum(['pending', 'in_progress', 'done']).default('pending'),
});

const actionPlanStatusSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'done']),
});

const actionPlanParamsSchema = z.object({
  nonConformityId: z.string().min(1),
  actionId: z.string().min(1),
});

type SupportedLocale = z.infer<typeof localeSchema>['locale'];

const normalizeLocale = (locale?: string): SupportedLocale => {
  if (!locale) {
    return 'pt-BR';
  }

  const canonical = locale.trim();

  if (canonical === 'pt-BR' || canonical === 'en-US') {
    return canonical;
  }

  if (canonical.toLowerCase().startsWith('en')) {
    return 'en-US';
  }

  return 'pt-BR';
};

const demoUser = {
  id: 'demo-admin',
  name: 'Administrador MenuCare',
  email: 'admin@menucare.local',
  companyName: 'Hospital Sao Marcelino Champagnat',
  accessProfile: 'Administrador MenuCare',
} as const;

const demoContext = {
  tenantId: 'demo-tenant',
  roleKey: 'menucare_admin',
} as const;

const demoPassword = process.env.DEMO_PASSWORD ?? 'Admin@123';
const demoInviteToken = process.env.DEMO_INVITE_TOKEN ?? 'MENUCARE-PRIMEIRO-ACESSO';
const localeByCompany = new Map<string, SupportedLocale>();
const scryptAsync = promisify(scrypt);

type PrismaLike = {
  $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
};

let prisma: PrismaLike | null = null;
let localeTableReady = false;
let domainTablesReady = false;
let authTablesReady = false;

try {
  const prismaModule = (await import('@prisma/client')) as {
    PrismaClient?: new () => PrismaLike;
  };

  if (prismaModule.PrismaClient) {
    prisma = new prismaModule.PrismaClient();
  }
} catch {
  app.log.warn('Prisma Client indisponivel. Rode `npm run prisma:generate --workspace apps/api`.');
}

await app.register(cors, {
  origin: true,
  credentials: true,
});

await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? 'menucare-dev-secret',
});

const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({
      status: 'error',
      message: apiMessage.auth.sessionExpired,
    });
  }
};

const getCompanyFromJwt = (request: FastifyRequest): string => {
  const payload = request.user as { companyName?: string };
  return payload.companyName ?? demoUser.companyName;
};

const ensureLocalePreferencesTable = async () => {
  if (!prisma || localeTableReady) {
    return;
  }

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS company_locale_preferences (
      company_name TEXT PRIMARY KEY,
      locale TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  localeTableReady = true;
};

const ensureDomainTables = async () => {
  if (!prisma || domainTablesReady) {
    return;
  }

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      title TEXT NOT NULL,
      source_type TEXT NOT NULL,
      status TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS extracted_rules (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS rule_validation_events (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      previous_status TEXT NOT NULL,
      next_status TEXT NOT NULL,
      note TEXT,
      actor_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS non_conformities (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      origin TEXT NOT NULL,
      impact TEXT NOT NULL,
      owner TEXT NOT NULL,
      due_date DATE NOT NULL,
      status TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS non_conformity_action_plans (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      non_conformity_id TEXT NOT NULL,
      description TEXT NOT NULL,
      owner TEXT NOT NULL,
      due_date DATE NOT NULL,
      status TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_contracts_company_created_at
    ON contracts (company_name, created_at DESC)
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_rules_company_status
    ON extracted_rules (company_name, status)
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_rule_validation_events_rule_created_at
    ON rule_validation_events (rule_id, created_at DESC)
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_non_conformities_company_status
    ON non_conformities (company_name, status)
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_non_conformity_action_plans_non_conformity
    ON non_conformity_action_plans (non_conformity_id, created_at DESC)
  `;

  domainTablesReady = true;
};

const ensureAuthTables = async () => {
  if (!prisma || authTablesReady) {
    return;
  }

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS first_access_invites (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      company_name TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS auth_password_overrides (
      email TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS invite_audit_events (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      invite_token TEXT NOT NULL,
      invite_email TEXT NOT NULL,
      action TEXT NOT NULL,
      note TEXT,
      actor_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_first_access_invites_company
    ON first_access_invites (company_name, is_active)
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_invite_audit_company_created_at
    ON invite_audit_events (company_name, created_at DESC)
  `;

  await prisma.$executeRaw`
    INSERT INTO first_access_invites (token, email, company_name, is_active)
    VALUES (${demoInviteToken}, ${demoUser.email}, ${demoUser.companyName}, TRUE)
    ON CONFLICT (token)
    DO NOTHING
  `;

  authTablesReady = true;
};

const hashPassword = async (password: string): Promise<string> => {
  const salt = randomUUID();
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
};

const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  const [salt, keyHex] = storedHash.split(':');

  if (!salt || !keyHex) {
    return false;
  }

  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  const expectedKey = Buffer.from(keyHex, 'hex');

  if (derivedKey.length !== expectedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedKey);
};

const readPasswordOverride = async (email: string, companyName: string): Promise<string | null> => {
  if (!prisma) {
    return null;
  }

  await ensureAuthTables();

  const rows = await prisma.$queryRaw<Array<{ password_hash: string }>>`
    SELECT password_hash
    FROM auth_password_overrides
    WHERE email = ${email}
      AND company_name = ${companyName}
    LIMIT 1
  `;

  return rows[0]?.password_hash ?? null;
};

const readLocaleFromDatabase = async (companyName: string): Promise<SupportedLocale | null> => {
  if (!prisma) {
    return null;
  }

  await ensureLocalePreferencesTable();

  const rows = await prisma.$queryRaw<Array<{ locale: string }>>`
    SELECT locale
    FROM company_locale_preferences
    WHERE company_name = ${companyName}
    LIMIT 1
  `;

  if (!rows.length) {
    return null;
  }

  return normalizeLocale(rows[0].locale);
};

const saveLocaleInDatabase = async (companyName: string, locale: SupportedLocale) => {
  if (!prisma) {
    return;
  }

  await ensureLocalePreferencesTable();

  await prisma.$executeRaw`
    INSERT INTO company_locale_preferences (company_name, locale)
    VALUES (${companyName}, ${locale})
    ON CONFLICT (company_name)
    DO UPDATE SET
      locale = EXCLUDED.locale,
      updated_at = NOW()
  `;
};

const getUserFromJwt = (request: FastifyRequest) => {
  const payload = request.user as { sub?: string; name?: string };

  return {
    id: payload.sub ?? demoUser.id,
    name: payload.name ?? demoUser.name,
  };
};

const registerInviteAuditEvent = async (payload: {
  companyName: string;
  inviteToken: string;
  inviteEmail: string;
  action: 'generated' | 'revoked' | 'regenerated' | 'activated';
  note?: string;
  actorId: string;
  actorName: string;
}) => {
  if (!prisma) {
    return;
  }

  await ensureAuthTables();

  const eventId = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO invite_audit_events (
      id,
      company_name,
      invite_token,
      invite_email,
      action,
      note,
      actor_id,
      actor_name
    )
    VALUES (
      ${eventId},
      ${payload.companyName},
      ${payload.inviteToken},
      ${payload.inviteEmail},
      ${payload.action},
      ${payload.note ?? null},
      ${payload.actorId},
      ${payload.actorName}
    )
  `;
};

app.post('/auth/login', async (request, reply) => {
  const parsed = authSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  const { email, password } = parsed.data;

  if (email !== demoUser.email) {
    return reply.code(401).send({
      status: 'error',
      message: apiMessage.auth.wrongEmailOrPassword,
    });
  }

  let isValidPassword = password === demoPassword;

  if (prisma) {
    try {
      const storedHash = await readPasswordOverride(email, demoUser.companyName);

      if (storedHash) {
        isValidPassword = await verifyPassword(password, storedHash);
      }
    } catch (error) {
      app.log.warn({ error }, 'Falha ao validar credencial persistida.');
    }
  }

  if (!isValidPassword) {
    return reply.code(401).send({
      status: 'error',
      message: apiMessage.auth.wrongEmailOrPassword,
    });
  }

  const token = await reply.jwtSign(
    {
      sub: demoUser.id,
      tenantId: demoContext.tenantId,
      email: demoUser.email,
      name: demoUser.name,
      companyName: demoUser.companyName,
      accessProfile: demoUser.accessProfile,
      roleKey: demoContext.roleKey,
    },
    {
      expiresIn: '8h',
    },
  );

  return {
    status: 'ok',
    token,
    user: demoUser,
  };
});

app.get('/auth/me', { preHandler: authenticate }, async (request) => {
  const payload = request.user as {
    sub?: string;
    email?: string;
    name?: string;
    companyName?: string;
    accessProfile?: string;
  };

  return {
    status: 'ok',
    user: {
      id: payload.sub ?? demoUser.id,
      email: payload.email ?? demoUser.email,
      name: payload.name ?? demoUser.name,
      companyName: payload.companyName ?? demoUser.companyName,
      accessProfile: payload.accessProfile ?? demoUser.accessProfile,
    },
  };
});

app.post('/auth/logout', { preHandler: authenticate }, async () => ({
  status: 'ok',
  message: apiMessage.auth.signedOut,
}));

app.post('/auth/first-access/activate', async (request, reply) => {
  const parsed = inviteActivationSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidInvitePayload,
    });
  }

  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  await ensureAuthTables();

  const normalizedToken = parsed.data.token.trim();
  const inviteRows = await prisma.$queryRaw<Array<{ email: string; company_name: string }>>`
    SELECT email, company_name
    FROM first_access_invites
    WHERE token = ${normalizedToken}
      AND is_active = TRUE
    LIMIT 1
  `;

  const invite = inviteRows[0];

  if (!invite) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidOrExpiredInvite,
    });
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await prisma.$executeRaw`
    INSERT INTO auth_password_overrides (email, company_name, password_hash)
    VALUES (${invite.email}, ${invite.company_name}, ${passwordHash})
    ON CONFLICT (email)
    DO UPDATE SET
      company_name = EXCLUDED.company_name,
      password_hash = EXCLUDED.password_hash,
      updated_at = NOW()
  `;

  await prisma.$executeRaw`
    UPDATE first_access_invites
    SET is_active = FALSE,
        used_at = NOW()
    WHERE token = ${normalizedToken}
  `;

  await registerInviteAuditEvent({
    companyName: invite.company_name,
    inviteToken: normalizedToken,
    inviteEmail: invite.email,
    action: 'activated',
    note: 'Convite utilizado para definir senha inicial.',
    actorId: 'first-access',
    actorName: invite.email,
  });

  return {
    status: 'ok',
    message: apiMessage.auth.inviteActivated,
    email: invite.email,
  };
});

app.post('/auth/invites', { preHandler: authenticate }, async (request, reply) => {
  const parsed = inviteCreationSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidInvitePayload,
    });
  }

  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  await ensureAuthTables();

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);
  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const inviteToken = `INV-${randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`;

  await prisma.$executeRaw`
    UPDATE first_access_invites
    SET is_active = FALSE,
        used_at = NOW()
    WHERE email = ${normalizedEmail}
      AND company_name = ${companyName}
      AND is_active = TRUE
  `;

  await prisma.$executeRaw`
    INSERT INTO first_access_invites (token, email, company_name, is_active)
    VALUES (${inviteToken}, ${normalizedEmail}, ${companyName}, TRUE)
  `;

  await registerInviteAuditEvent({
    companyName,
    inviteToken,
    inviteEmail: normalizedEmail,
    action: 'generated',
    note: 'Convite criado no portal administrativo.',
    actorId: actor.id,
    actorName: actor.name,
  });

  return reply.code(201).send({
    status: 'ok',
    message: apiMessage.auth.inviteGenerated,
    invite: {
      token: inviteToken,
      email: normalizedEmail,
      companyName,
      active: true,
    },
  });
});

app.get('/auth/invites/audit', { preHandler: authenticate }, async (request, reply) => {
  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const parsedQuery = inviteAuditQuerySchema.safeParse(request.query);
  const limit = parsedQuery.success ? parsedQuery.data.limit : 40;
  const companyName = getCompanyFromJwt(request);

  await ensureAuthTables();

  const events = await prisma.$queryRaw<
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
    LIMIT ${limit}
  `;

  return {
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
  };
});

app.get('/auth/invites', { preHandler: authenticate }, async (request, reply) => {
  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const parsedQuery = inviteListQuerySchema.safeParse(request.query);
  const status = parsedQuery.success ? parsedQuery.data.status : 'all';
  const limit = parsedQuery.success ? parsedQuery.data.limit : 30;
  const companyName = getCompanyFromJwt(request);

  await ensureAuthTables();

  const invites =
    status === 'all'
      ? await prisma.$queryRaw<
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
          LIMIT ${limit}
        `
      : await prisma.$queryRaw<
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
            AND is_active = ${status === 'active'}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `;

  return {
    status: 'ok',
    invites: invites.map((invite) => ({
      token: invite.token,
      email: invite.email,
      active: invite.is_active,
      usedAt: invite.used_at ? invite.used_at.toISOString() : null,
      createdAt: invite.created_at.toISOString(),
    })),
  };
});

app.post('/auth/invites/:token/revoke', { preHandler: authenticate }, async (request, reply) => {
  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const parsedParams = inviteTokenParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidInvitePayload,
    });
  }

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);
  const inviteRows = await prisma.$queryRaw<Array<{ token: string; is_active: boolean }>>`
    SELECT token, is_active
    FROM first_access_invites
    WHERE token = ${parsedParams.data.token}
      AND company_name = ${companyName}
    LIMIT 1
  `;

  const invite = inviteRows[0];

  if (!invite) {
    return reply.code(404).send({
      status: 'error',
      message: apiMessage.auth.inviteNotFound,
    });
  }

  if (!invite.is_active) {
    return reply.code(409).send({
      status: 'error',
      message: apiMessage.auth.inviteAlreadyInactive,
    });
  }

  await prisma.$executeRaw`
    UPDATE first_access_invites
    SET is_active = FALSE,
        used_at = NOW()
    WHERE token = ${parsedParams.data.token}
      AND company_name = ${companyName}
  `;

  const emailRows = await prisma.$queryRaw<Array<{ email: string }>>`
    SELECT email
    FROM first_access_invites
    WHERE token = ${parsedParams.data.token}
      AND company_name = ${companyName}
    LIMIT 1
  `;

  await registerInviteAuditEvent({
    companyName,
    inviteToken: parsedParams.data.token,
    inviteEmail: emailRows[0]?.email ?? 'desconhecido',
    action: 'revoked',
    note: 'Convite revogado manualmente no portal.',
    actorId: actor.id,
    actorName: actor.name,
  });

  return {
    status: 'ok',
    message: apiMessage.auth.inviteRevoked,
  };
});

app.post('/auth/invites/:token/regenerate', { preHandler: authenticate }, async (request, reply) => {
  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const parsedParams = inviteTokenParamSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidInvitePayload,
    });
  }

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);
  const inviteRows = await prisma.$queryRaw<Array<{ email: string }>>`
    SELECT email
    FROM first_access_invites
    WHERE token = ${parsedParams.data.token}
      AND company_name = ${companyName}
    LIMIT 1
  `;

  const invite = inviteRows[0];

  if (!invite) {
    return reply.code(404).send({
      status: 'error',
      message: apiMessage.auth.inviteNotFound,
    });
  }

  await ensureAuthTables();

  const inviteToken = `INV-${randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`;

  await prisma.$executeRaw`
    UPDATE first_access_invites
    SET is_active = FALSE,
        used_at = NOW()
    WHERE email = ${invite.email}
      AND company_name = ${companyName}
      AND is_active = TRUE
  `;

  await prisma.$executeRaw`
    INSERT INTO first_access_invites (token, email, company_name, is_active)
    VALUES (${inviteToken}, ${invite.email}, ${companyName}, TRUE)
  `;

  await registerInviteAuditEvent({
    companyName,
    inviteToken,
    inviteEmail: invite.email,
    action: 'regenerated',
    note: `Regenerado a partir do convite ${parsedParams.data.token}.`,
    actorId: actor.id,
    actorName: actor.name,
  });

  return reply.code(201).send({
    status: 'ok',
    message: apiMessage.auth.inviteGenerated,
    invite: {
      token: inviteToken,
      email: invite.email,
      companyName,
      active: true,
    },
  });
});

app.get('/preferences/locale', { preHandler: authenticate }, async (request) => {
  const companyName = getCompanyFromJwt(request);
  const fallbackLocale =
    localeByCompany.get(companyName) ?? normalizeLocale(process.env.API_LOCALE);

  try {
    const persistedLocale = await readLocaleFromDatabase(companyName);

    if (persistedLocale) {
      localeByCompany.set(companyName, persistedLocale);

      return {
        status: 'ok',
        locale: persistedLocale,
      };
    }
  } catch (error) {
    app.log.warn({ error }, 'Falha ao carregar preferencia de idioma no PostgreSQL.');
  }

  return {
    status: 'ok',
    locale: fallbackLocale,
  };
});

app.post('/preferences/locale', { preHandler: authenticate }, async (request, reply) => {
  const parsed = localeSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.preferences.invalidLocale,
    });
  }

  const companyName = getCompanyFromJwt(request);
  const resolvedLocale = normalizeLocale(parsed.data.locale);
  localeByCompany.set(companyName, resolvedLocale);

  try {
    await saveLocaleInDatabase(companyName, resolvedLocale);
  } catch (error) {
    app.log.warn({ error }, 'Falha ao salvar preferencia de idioma no PostgreSQL.');
  }

  return {
    status: 'ok',
    locale: resolvedLocale,
  };
});

app.post('/contracts', { preHandler: authenticate }, async (request, reply) => {
  const parsed = contractSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);
  const payload = parsed.data;
  const contractId = randomUUID();

  await ensureDomainTables();

  await prisma.$executeRaw`
    INSERT INTO contracts (id, company_name, title, source_type, status, created_by)
    VALUES (${contractId}, ${companyName}, ${payload.title}, ${payload.sourceType}, ${payload.status}, ${actor.id})
  `;

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    source_type: string;
    status: string;
    created_at: Date;
  }>>`
    SELECT id, title, source_type, status, created_at
    FROM contracts
    WHERE id = ${contractId}
    LIMIT 1
  `;

  return reply.code(201).send({
    status: 'ok',
    contract: {
      id: rows[0]?.id ?? contractId,
      title: rows[0]?.title ?? payload.title,
      sourceType: rows[0]?.source_type ?? payload.sourceType,
      status: rows[0]?.status ?? payload.status,
      createdAt: (rows[0]?.created_at ?? new Date()).toISOString(),
      createdBy: actor.name,
    },
  });
});

app.get('/contracts', { preHandler: authenticate }, async (request, reply) => {
  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const query = z
    .object({ limit: z.coerce.number().int().min(1).max(50).default(20) })
    .safeParse(request.query);

  const limit = query.success ? query.data.limit : 20;
  const companyName = getCompanyFromJwt(request);

  await ensureDomainTables();

  const contracts = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    source_type: string;
    status: string;
    created_at: Date;
  }>>`
    SELECT id, title, source_type, status, created_at
    FROM contracts
    WHERE company_name = ${companyName}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return {
    status: 'ok',
    contracts: contracts.map((item) => ({
      id: item.id,
      title: item.title,
      sourceType: item.source_type,
      status: item.status,
      createdAt: item.created_at.toISOString(),
    })),
  };
});

app.post('/rules', { preHandler: authenticate }, async (request, reply) => {
  const parsed = ruleSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);
  const payload = parsed.data;
  const ruleId = randomUUID();

  await ensureDomainTables();

  const contractExists = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM contracts
    WHERE id = ${payload.contractId}
      AND company_name = ${companyName}
    LIMIT 1
  `;

  if (!contractExists.length) {
    return reply.code(404).send({
      status: 'error',
      message: 'Contrato nao encontrado para esta empresa.',
    });
  }

  await prisma.$executeRaw`
    INSERT INTO extracted_rules (id, company_name, contract_id, title, description, category, status)
    VALUES (
      ${ruleId},
      ${companyName},
      ${payload.contractId},
      ${payload.title},
      ${payload.description},
      ${payload.category},
      ${payload.status}
    )
  `;

  const creationEventId = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO rule_validation_events (
      id,
      company_name,
      rule_id,
      previous_status,
      next_status,
      note,
      actor_id,
      actor_name
    )
    VALUES (
      ${creationEventId},
      ${companyName},
      ${ruleId},
      ${payload.status},
      ${payload.status},
      ${'Regra cadastrada no fluxo operacional.'},
      ${actor.id},
      ${actor.name}
    )
  `;

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    contract_id: string;
    title: string;
    description: string;
    category: string;
    status: string;
    created_at: Date;
  }>>`
    SELECT id, contract_id, title, description, category, status, created_at
    FROM extracted_rules
    WHERE id = ${ruleId}
    LIMIT 1
  `;

  return reply.code(201).send({
    status: 'ok',
    rule: {
      id: rows[0]?.id ?? ruleId,
      contractId: rows[0]?.contract_id ?? payload.contractId,
      title: rows[0]?.title ?? payload.title,
      description: rows[0]?.description ?? payload.description,
      category: rows[0]?.category ?? payload.category,
      status: rows[0]?.status ?? payload.status,
      createdAt: (rows[0]?.created_at ?? new Date()).toISOString(),
    },
  });
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

  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);

  await ensureDomainTables();

  const existingRows = await prisma.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT id, status
    FROM extracted_rules
    WHERE id = ${parsedParams.data.ruleId}
      AND company_name = ${companyName}
    LIMIT 1
  `;

  const existingRule = existingRows[0];

  if (!existingRule) {
    return reply.code(404).send({
      status: 'error',
      message: 'Regra nao encontrada para esta empresa.',
    });
  }

  const previousStatus = existingRule.status;
  const nextStatus = parsedBody.data.status;

  await prisma.$executeRaw`
    UPDATE extracted_rules
    SET status = ${nextStatus}
    WHERE id = ${parsedParams.data.ruleId}
      AND company_name = ${companyName}
  `;

  const eventId = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO rule_validation_events (
      id,
      company_name,
      rule_id,
      previous_status,
      next_status,
      note,
      actor_id,
      actor_name
    )
    VALUES (
      ${eventId},
      ${companyName},
      ${parsedParams.data.ruleId},
      ${previousStatus},
      ${nextStatus},
      ${parsedBody.data.note ?? null},
      ${actor.id},
      ${actor.name}
    )
  `;

  return {
    status: 'ok',
    message: 'Status da regra atualizado com rastreabilidade.',
  };
});

app.get('/rules/:ruleId/history', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = ruleParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const companyName = getCompanyFromJwt(request);

  await ensureDomainTables();

  const events = await prisma.$queryRaw<
    Array<{
      id: string;
      previous_status: string;
      next_status: string;
      note: string | null;
      actor_name: string;
      created_at: Date;
    }>
  >`
    SELECT id, previous_status, next_status, note, actor_name, created_at
    FROM rule_validation_events
    WHERE company_name = ${companyName}
      AND rule_id = ${parsedParams.data.ruleId}
    ORDER BY created_at DESC
    LIMIT 50
  `;

  return {
    status: 'ok',
    events: events.map((event) => ({
      id: event.id,
      previousStatus: event.previous_status,
      nextStatus: event.next_status,
      note: event.note,
      actorName: event.actor_name,
      createdAt: event.created_at.toISOString(),
    })),
  };
});

app.post('/non-conformities', { preHandler: authenticate }, async (request, reply) => {
  const parsed = nonConformitySchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({ status: 'error', message: apiMessage.auth.invalidCredentials });
  }

  if (!prisma) {
    return reply.code(503).send({ status: 'error', message: apiMessage.health.dbUnavailable });
  }

  await ensureDomainTables();

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);
  const itemId = randomUUID();
  const payload = parsed.data;

  await prisma.$executeRaw`
    INSERT INTO non_conformities (
      id,
      company_name,
      title,
      description,
      origin,
      impact,
      owner,
      due_date,
      status,
      created_by
    )
    VALUES (
      ${itemId},
      ${companyName},
      ${payload.title},
      ${payload.description},
      ${payload.origin},
      ${payload.impact},
      ${payload.owner},
      ${payload.dueDate},
      ${payload.status},
      ${actor.id}
    )
  `;

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    description: string;
    origin: string;
    impact: string;
    owner: string;
    due_date: Date;
    status: string;
    created_at: Date;
  }>>`
    SELECT id, title, description, origin, impact, owner, due_date, status, created_at
    FROM non_conformities
    WHERE id = ${itemId}
    LIMIT 1
  `;

  return reply.code(201).send({
    status: 'ok',
    nonConformity: {
      id: rows[0]?.id ?? itemId,
      title: rows[0]?.title ?? payload.title,
      description: rows[0]?.description ?? payload.description,
      origin: rows[0]?.origin ?? payload.origin,
      impact: rows[0]?.impact ?? payload.impact,
      owner: rows[0]?.owner ?? payload.owner,
      dueDate: (rows[0]?.due_date ?? new Date(payload.dueDate)).toISOString(),
      status: rows[0]?.status ?? payload.status,
      createdAt: (rows[0]?.created_at ?? new Date()).toISOString(),
    },
  });
});

app.get('/non-conformities', { preHandler: authenticate }, async (request, reply) => {
  if (!prisma) {
    return reply.code(503).send({ status: 'error', message: apiMessage.health.dbUnavailable });
  }

  const query = z
    .object({
      status: z.enum(['open', 'in_progress', 'resolved', 'cancelled']).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(30),
    })
    .safeParse(request.query);

  await ensureDomainTables();

  const companyName = getCompanyFromJwt(request);
  const limit = query.success ? query.data.limit : 30;
  const selectedStatus = query.success ? query.data.status : undefined;

  const rows = selectedStatus
    ? await prisma.$queryRaw<Array<{
        id: string;
        title: string;
        description: string;
        origin: string;
        impact: string;
        owner: string;
        due_date: Date;
        status: string;
        created_at: Date;
      }>>`
        SELECT id, title, description, origin, impact, owner, due_date, status, created_at
        FROM non_conformities
        WHERE company_name = ${companyName}
          AND status = ${selectedStatus}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await prisma.$queryRaw<Array<{
        id: string;
        title: string;
        description: string;
        origin: string;
        impact: string;
        owner: string;
        due_date: Date;
        status: string;
        created_at: Date;
      }>>`
        SELECT id, title, description, origin, impact, owner, due_date, status, created_at
        FROM non_conformities
        WHERE company_name = ${companyName}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

  return {
    status: 'ok',
    nonConformities: rows.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      origin: item.origin,
      impact: item.impact,
      owner: item.owner,
      dueDate: item.due_date.toISOString(),
      status: item.status,
      createdAt: item.created_at.toISOString(),
    })),
  };
});

app.patch('/non-conformities/:nonConformityId/status', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = nonConformityParamsSchema.safeParse(request.params);
  const parsedBody = nonConformityStatusSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return reply.code(400).send({ status: 'error', message: apiMessage.auth.invalidCredentials });
  }

  if (!prisma) {
    return reply.code(503).send({ status: 'error', message: apiMessage.health.dbUnavailable });
  }

  const companyName = getCompanyFromJwt(request);

  await ensureDomainTables();

  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM non_conformities
    WHERE id = ${parsedParams.data.nonConformityId}
      AND company_name = ${companyName}
    LIMIT 1
  `;

  if (!existing.length) {
    return reply.code(404).send({ status: 'error', message: 'Nao conformidade nao encontrada.' });
  }

  await prisma.$executeRaw`
    UPDATE non_conformities
    SET status = ${parsedBody.data.status},
        updated_at = NOW()
    WHERE id = ${parsedParams.data.nonConformityId}
      AND company_name = ${companyName}
  `;

  return { status: 'ok' };
});

app.post('/non-conformities/:nonConformityId/actions', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = nonConformityParamsSchema.safeParse(request.params);
  const parsedBody = actionPlanSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return reply.code(400).send({ status: 'error', message: apiMessage.auth.invalidCredentials });
  }

  if (!prisma) {
    return reply.code(503).send({ status: 'error', message: apiMessage.health.dbUnavailable });
  }

  const companyName = getCompanyFromJwt(request);
  const actor = getUserFromJwt(request);
  const actionId = randomUUID();

  await ensureDomainTables();

  await prisma.$executeRaw`
    INSERT INTO non_conformity_action_plans (
      id,
      company_name,
      non_conformity_id,
      description,
      owner,
      due_date,
      status,
      created_by
    )
    VALUES (
      ${actionId},
      ${companyName},
      ${parsedParams.data.nonConformityId},
      ${parsedBody.data.description},
      ${parsedBody.data.owner},
      ${parsedBody.data.dueDate},
      ${parsedBody.data.status},
      ${actor.id}
    )
  `;

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    non_conformity_id: string;
    description: string;
    owner: string;
    due_date: Date;
    status: string;
    created_at: Date;
  }>>`
    SELECT id, non_conformity_id, description, owner, due_date, status, created_at
    FROM non_conformity_action_plans
    WHERE id = ${actionId}
    LIMIT 1
  `;

  return reply.code(201).send({
    status: 'ok',
    action: {
      id: rows[0]?.id ?? actionId,
      nonConformityId: rows[0]?.non_conformity_id ?? parsedParams.data.nonConformityId,
      description: rows[0]?.description ?? parsedBody.data.description,
      owner: rows[0]?.owner ?? parsedBody.data.owner,
      dueDate: (rows[0]?.due_date ?? new Date(parsedBody.data.dueDate)).toISOString(),
      status: rows[0]?.status ?? parsedBody.data.status,
      createdAt: (rows[0]?.created_at ?? new Date()).toISOString(),
    },
  });
});

app.patch('/non-conformities/:nonConformityId/actions/:actionId/status', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = actionPlanParamsSchema.safeParse(request.params);
  const parsedBody = actionPlanStatusSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return reply.code(400).send({ status: 'error', message: apiMessage.auth.invalidCredentials });
  }

  if (!prisma) {
    return reply.code(503).send({ status: 'error', message: apiMessage.health.dbUnavailable });
  }

  const companyName = getCompanyFromJwt(request);

  await ensureDomainTables();

  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM non_conformity_action_plans
    WHERE id = ${parsedParams.data.actionId}
      AND non_conformity_id = ${parsedParams.data.nonConformityId}
      AND company_name = ${companyName}
    LIMIT 1
  `;

  if (!existing.length) {
    return reply.code(404).send({ status: 'error', message: 'Acao nao encontrada.' });
  }

  await prisma.$executeRaw`
    UPDATE non_conformity_action_plans
    SET status = ${parsedBody.data.status}
    WHERE id = ${parsedParams.data.actionId}
      AND non_conformity_id = ${parsedParams.data.nonConformityId}
      AND company_name = ${companyName}
  `;

  return { status: 'ok' };
});

app.get('/non-conformities/:nonConformityId/actions', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = nonConformityParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    return reply.code(400).send({ status: 'error', message: apiMessage.auth.invalidCredentials });
  }

  if (!prisma) {
    return reply.code(503).send({ status: 'error', message: apiMessage.health.dbUnavailable });
  }

  const companyName = getCompanyFromJwt(request);

  await ensureDomainTables();

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    non_conformity_id: string;
    description: string;
    owner: string;
    due_date: Date;
    status: string;
    created_at: Date;
  }>>`
    SELECT id, non_conformity_id, description, owner, due_date, status, created_at
    FROM non_conformity_action_plans
    WHERE non_conformity_id = ${parsedParams.data.nonConformityId}
      AND company_name = ${companyName}
    ORDER BY created_at DESC
    LIMIT 50
  `;

  return {
    status: 'ok',
    actions: rows.map((action) => ({
      id: action.id,
      nonConformityId: action.non_conformity_id,
      description: action.description,
      owner: action.owner,
      dueDate: action.due_date.toISOString(),
      status: action.status,
      createdAt: action.created_at.toISOString(),
    })),
  };
});

app.get('/rules', { preHandler: authenticate }, async (request, reply) => {
  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const query = z
    .object({
      status: z
        .enum(['identified', 'under_review', 'approved', 'rejected', 'archived'])
        .optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    })
    .safeParse(request.query);

  const companyName = getCompanyFromJwt(request);
  const limit = query.success ? query.data.limit : 50;
  const status = query.success ? query.data.status : undefined;

  await ensureDomainTables();

  const rules = status
    ? await prisma.$queryRaw<Array<{
        id: string;
        contract_id: string;
        title: string;
        description: string;
        category: string;
        status: string;
        created_at: Date;
      }>>`
        SELECT id, contract_id, title, description, category, status, created_at
        FROM extracted_rules
        WHERE company_name = ${companyName}
          AND status = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await prisma.$queryRaw<Array<{
        id: string;
        contract_id: string;
        title: string;
        description: string;
        category: string;
        status: string;
        created_at: Date;
      }>>`
        SELECT id, contract_id, title, description, category, status, created_at
        FROM extracted_rules
        WHERE company_name = ${companyName}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

  return {
    status: 'ok',
    rules: rules.map((item) => ({
      id: item.id,
      contractId: item.contract_id,
      title: item.title,
      description: item.description,
      category: item.category,
      status: item.status,
      createdAt: item.created_at.toISOString(),
    })),
  };
});

app.get('/dashboard/summary', { preHandler: authenticate }, async (request, reply) => {
  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const companyName = getCompanyFromJwt(request);

  await ensureDomainTables();

  const [contractsCount] = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*)::int AS total
    FROM contracts
    WHERE company_name = ${companyName}
  `;

  const [rulesApprovedCount] = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*)::int AS total
    FROM extracted_rules
    WHERE company_name = ${companyName}
      AND status = 'approved'
  `;

  const [rulesPendingCount] = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*)::int AS total
    FROM extracted_rules
    WHERE company_name = ${companyName}
      AND status IN ('identified', 'under_review')
  `;

  const recentContracts = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    status: string;
    created_at: Date;
  }>>`
    SELECT id, title, status, created_at
    FROM contracts
    WHERE company_name = ${companyName}
    ORDER BY created_at DESC
    LIMIT 5
  `;

  return {
    status: 'ok',
    summary: {
      contractsCount: contractsCount?.total ?? 0,
      rulesApprovedCount: rulesApprovedCount?.total ?? 0,
      rulesPendingCount: rulesPendingCount?.total ?? 0,
      recentContracts: recentContracts.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        createdAt: item.created_at.toISOString(),
      })),
    },
  };
});

app.get('/health', async () => {
  return {
    status: 'ok',
    service: 'menucare-api',
    message: apiMessage.health.serviceOk,
    timestamp: new Date().toISOString(),
  };
});

app.get('/health/db', async (_request, reply) => {
  if (!prisma) {
    return reply.code(503).send({
      status: 'warning',
      database: 'prisma-client-not-generated',
      message: apiMessage.health.dbUnavailable,
    });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      database: 'connected',
      message: apiMessage.health.dbConnected,
    };
  } catch {
    return reply.code(500).send({
      status: 'error',
      database: 'disconnected',
      message: apiMessage.health.dbDisconnected,
    });
  }
});

const port = Number(process.env.API_PORT ?? 3001);
const host = process.env.API_HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
