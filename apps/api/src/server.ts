import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getApiMessage } from './messages.js';

const app = Fastify({ logger: true });
const apiMessage = getApiMessage(process.env.API_LOCALE);

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const localeSchema = z.object({
  locale: z.enum(['pt-BR', 'en-US']),
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
const localeByCompany = new Map<string, SupportedLocale>();

type PrismaLike = {
  $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
};

let prisma: PrismaLike | null = null;
let localeTableReady = false;

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

app.post('/auth/login', async (request, reply) => {
  const parsed = authSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  const { email, password } = parsed.data;

  if (email !== demoUser.email || password !== demoPassword) {
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
