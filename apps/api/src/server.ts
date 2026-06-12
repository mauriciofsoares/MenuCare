import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { PDFParse } from 'pdf-parse';
import { z } from 'zod';
import { getApiMessage } from './messages.js';
import {
  buildMenuPreparationContext,
  buildRecipeImportContext,
  buildRulePreparationContext,
  classifyRecipeFromText,
} from './ai-prep.js';
import { registerAuthRoutes } from './modules/auth/routes.js';
import { registerContractsRoutes } from './modules/contracts/routes.js';
import { registerRulesRoutes } from './modules/rules/routes.js';
import { registerMenusRoutes } from './modules/menus/routes.js';
import { registerRecipesRoutes } from './modules/recipes/routes.js';
import { registerComplianceRoutes } from './modules/compliance/routes.js';
import { registerEvaluationsRoutes } from './modules/evaluations/routes.js';
import { registerRecommendationsRoutes } from './modules/recommendations/routes.js';
import { registerGovernanceRoutes } from './modules/governance/routes.js';

export const app = Fastify({
  logger: process.env.NODE_ENV !== 'test' || process.env.MENUCARE_TEST_LOGGER === '1',
});
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

const sourceProfileSchema = z.enum(['genial_integrated', 'external_non_genial', 'manual_only']);
const contractModeSchema = z.enum(['with_contract', 'internal_kitchen']);
const complianceModeSchema = z.enum(['contractual', 'internal_policy']);

const operationalProfileSchema = z.object({
  sourceProfile: sourceProfileSchema,
  contractMode: contractModeSchema,
  complianceMode: complianceModeSchema,
}).superRefine((value, ctx) => {
  if (value.contractMode === 'internal_kitchen' && value.complianceMode === 'contractual') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cozinha interna deve operar com compliance interno.',
      path: ['complianceMode'],
    });
  }
});

const contractSchema = z.object({
  title: z.string().min(3),
  sourceType: z.enum(['contract', 'bid_notice', 'reference_term', 'regulation']),
  siteId: z.string().trim().min(1).optional(),
});

const recipeImportSchema = z.object({
  fileName: z.string().min(5).max(240).regex(/\.pdf$/i),
  sourceReference: z.string().min(2).max(180).optional(),
  recipes: z.array(
    z.object({
      name: z.string().min(2).max(180),
      ingredients: z.array(z.string().min(1).max(180)).max(60).default([]),
      preparationMethod: z.string().max(2000).optional(),
      perCapita: z.coerce.number().positive().optional(),
      yield: z.coerce.number().positive().optional(),
      group: z.string().max(120).optional(),
      nutritionalInfo: z.record(z.string(), z.unknown()).optional(),
      compatibleDiets: z.array(z.string().min(1).max(80)).max(20).default([]),
      allergens: z.array(z.string().min(1).max(80)).max(20).default([]),
      cost: z.coerce.number().nonnegative().optional(),
    }),
  ).min(1),
});

const recipeImportListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const recipeParamsSchema = z.object({
  recipeId: z.string().min(1),
});

const recipeClassificationUpdateSchema = z.object({
  category: z.string().trim().min(2).max(80),
  subcategory: z.string().trim().min(2).max(80),
  foodGroup: z.string().trim().min(2).max(80),
  confidence: z.coerce.number().min(0).max(1).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  reason: z.string().trim().min(3).max(500).optional(),
});

const menuImportSchema = z.object({
  fileName: z.string().min(5).max(240).regex(/\.pdf$/i),
  unitName: z.string().min(2).max(120),
  serviceName: z.string().min(2).max(120),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: z.string().min(2).max(60),
  financialGoal: z.coerce.number().positive(),
  mealCost: z.coerce.number().nonnegative().optional(),
  recipes: z.array(z.string().min(1).max(180)).max(60).default([]),
  recipeItems: z.array(
    z.object({
      name: z.string().trim().min(1).max(180),
      cost: z.coerce.number().nonnegative(),
    }),
  ).max(120).optional(),
}).superRefine((value, ctx) => {
  if (typeof value.mealCost !== 'number' && (!value.recipeItems || value.recipeItems.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe mealCost ou recipeItems com custos por receita.',
      path: ['mealCost'],
    })
  }
});

const operationalMenuCardapioSchema = z.object({
  entryLabel: z.string().trim().min(2).max(120),
  unitName: z.string().trim().min(2).max(120),
  serviceName: z.string().trim().min(2).max(120),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: z.string().trim().min(2).max(60),
  financialGoal: z.coerce.number().positive(),
  mealCost: z.coerce.number().nonnegative(),
  recipes: z.array(z.string().trim().min(1).max(180)).max(60).default([]),
});

const menuImportParseReportSchema = z.object({
  rawText: z.string().min(20),
  fileName: z.string().min(5).max(240).regex(/\.pdf$/i).optional(),
  unitName: z.string().min(2).max(120).optional(),
  serviceName: z.string().min(2).max(120).optional(),
  mealType: z.string().min(2).max(60).optional(),
  financialGoal: z.coerce.number().positive().optional(),
});

const menuImportListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const menuMonthlySummaryListQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  unitName: z.string().trim().min(2).max(120).optional(),
  serviceName: z.string().trim().min(2).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(24).default(12),
});

const menuMonthlySummaryReprocessSchema = z.object({
  summaryMonth: z.string().regex(/^\d{4}-\d{2}$/),
  unitName: z.string().trim().min(2).max(120),
  serviceName: z.string().trim().min(2).max(120),
  maxAutoRetries: z.coerce.number().int().min(0).max(2).default(1),
  continueOnItemError: z.coerce.boolean().default(true),
});

const menuMonthlyCycleQuerySchema = z.object({
  continueOnItemError: z.coerce.boolean().default(true),
  maxAutoRetries: z.coerce.number().int().min(0).max(2).default(1),
});

const menuImportParamsSchema = z.object({
  importId: z.string().min(1),
});

const adjustedVersionGenerationSchema = z.object({
  monthsAhead: z.coerce.number().int().min(0).max(3).default(0),
});

const commemorativeDateSchema = z.object({
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(2).max(140),
  nobleDishHint: z.string().max(240).optional(),
});

const commemorativeDateListQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(new Date().getUTCFullYear()),
  limit: z.coerce.number().int().min(1).max(400).default(200),
});

const nextMenuDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  justification: z.string().trim().min(3).max(500),
});

const nextMenuDecisionListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const evaluationImportSchema = z.object({
  fileName: z.string().min(5).max(240).regex(/\.pdf$/i),
  unitName: z.string().min(2).max(120),
  serviceName: z.string().min(2).max(120),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  score: z.coerce.number().min(0).max(10),
  evaluationsCount: z.coerce.number().int().min(1).max(100000),
  comments: z.string().max(800).optional(),
});

const evaluationImportListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const intelligenceListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const ruleSchema = z.object({
  contractId: z.string().min(1),
  title: z.string().min(3),
  description: z.string().min(3).optional().default('Sem descricao.'),
  category: z.enum(['nutrition', 'management', 'legal', 'compliance', 'operations']),
  sourceExcerpt: z.string().trim().min(3).max(500).optional(),
  sourcePage: z.coerce.number().int().positive().optional(),
  evidenceConfidence: z.coerce.number().min(0).max(1).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
});

const ruleStatusUpdateSchema = z.object({
  status: z.enum(['approved', 'rejected']),
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

const nonConformityHistoryQuerySchema = z
  .object({
    actor: z.string().trim().max(120).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: 'Invalid history date range.',
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

const actionPlanHistoryQuerySchema = z
  .object({
    actor: z.string().trim().max(120).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: 'Invalid history date range.',
  });

const complianceExportAuditQuerySchema = z
  .object({
    exportType: z
      .enum(['all', 'non_conformity_history', 'action_plan_history', 'compliance_export_audit'])
      .default('all'),
    exportId: z.string().trim().max(64).optional(),
    nonConformityId: z.string().trim().max(64).optional(),
    actionPlanId: z.string().trim().max(64).optional(),
    sortOrder: z.enum(['desc', 'asc']).default('desc'),
    exportScope: z.enum(['page', 'all']).default('page'),
    actor: z.string().trim().max(120).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: 'Invalid history date range.',
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

const demoSite = {
  id: 'demo-site',
  name: 'Unidade Demo',
  city: 'Sao Paulo',
  state: 'SP',
} as const;

const recommendationPolicyContract = {
  priorityOrder: [
    'contract_rules',
    'financial_goal',
    'nutritional_restrictions',
    'operational_rules',
    'historical_ratings',
  ] as const,
  levels: [
    {
      key: 'mandatory',
      blocksApproval: true,
    },
    {
      key: 'recommended',
      blocksApproval: false,
    },
    {
      key: 'informational',
      blocksApproval: false,
    },
  ] as const,
  blockingCriteria: [
    'contract_rule_violation',
    'mandatory_nutritional_restriction_violation',
    'financial_goal_exceeded',
    'critical_operational_rule_violation',
  ] as const,
} as const;

const demoPassword = process.env.DEMO_PASSWORD ?? 'Admin@123';
const demoInviteToken = process.env.DEMO_INVITE_TOKEN ?? 'MENUCARE-PRIMEIRO-ACESSO';
const parsedLoginAttemptLimit = Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS ?? 5);
const parsedLoginRateLimitWindowMs = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS ?? 10 * 60 * 1000);
const parsedRefreshTokenTtlMs = Number(process.env.REFRESH_TOKEN_TTL_MS ?? 7 * 24 * 60 * 60 * 1000);
const parsedRefreshMaxActiveSessions = Number(process.env.REFRESH_MAX_ACTIVE_SESSIONS ?? 3);
const loginAttemptLimit = Number.isFinite(parsedLoginAttemptLimit) && parsedLoginAttemptLimit > 0
  ? parsedLoginAttemptLimit
  : 5;
const loginRateLimitWindowMs =
  Number.isFinite(parsedLoginRateLimitWindowMs) && parsedLoginRateLimitWindowMs > 0
    ? parsedLoginRateLimitWindowMs
    : 10 * 60 * 1000;
const refreshTokenTtlMs =
  Number.isFinite(parsedRefreshTokenTtlMs) && parsedRefreshTokenTtlMs > 0
    ? parsedRefreshTokenTtlMs
    : 7 * 24 * 60 * 60 * 1000;
const refreshMaxActiveSessions =
  Number.isFinite(parsedRefreshMaxActiveSessions) && parsedRefreshMaxActiveSessions > 0
    ? Math.floor(parsedRefreshMaxActiveSessions)
    : 3;
const refreshCookieName = 'menucare_refresh_token';
const authFlowHeaderName = 'x-auth-flow-id';
const localeByCompany = new Map<string, SupportedLocale>();
const operationalProfileByCompany = new Map<string, {
  source_profile: z.infer<typeof sourceProfileSchema>;
  contract_mode: z.infer<typeof contractModeSchema>;
  compliance_mode: z.infer<typeof complianceModeSchema>;
  updated_at: Date;
}>();
const scryptAsync = promisify(scrypt);
const loginAttemptByKey = new Map<string, { attempts: number; blockedUntil: number }>();
const refreshSessionMemory = new Map<string, {
  id: string;
  user_id: string;
  email: string;
  company_name: string;
  access_profile: string;
  tenant_id: string;
  role_key: string;
  user_name: string;
  token_hash: string;
  auth_flow_id: string;
  device_fingerprint: string;
  device_label: string;
  ip_address: string | null;
  expires_at: Date;
  created_at: Date;
  last_seen_at: Date;
  revoked_at: Date | null;
  replaced_by_session_id: string | null;
}>();

type PrismaLike = {
  $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
};

type AuthorizedSite = {
  id: string;
  tenantId: string;
  name: string;
  city: string | null;
  state: string | null;
  role: string;
};

type SiteAccessResult =
  | { allowed: true; site: AuthorizedSite }
  | { allowed: false; statusCode: number; body: { status: 'error'; message: string } };

let prisma: PrismaLike | null = null;
let localeTableReady = false;
let operationalProfileTableReady = false;
let domainTablesReady = false;
let authTablesReady = false;

const isTestDatabaseFallbackEnabled = process.env.NODE_ENV === 'test' && !process.env.DATABASE_URL;

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'test') {
  throw new Error('DATABASE_URL e obrigatoria fora do ambiente de teste.');
}

if (process.env.DATABASE_URL) {
  try {
    const prismaModule = (await import('@prisma/client')) as {
      PrismaClient?: new () => PrismaLike;
    };

    if (prismaModule.PrismaClient) {
      prisma = new prismaModule.PrismaClient();
    }
  } catch (error) {
    throw new Error(
      'Prisma Client indisponivel com DATABASE_URL configurada. Rode `npm run prisma:generate --workspace apps/api`.',
      { cause: error },
    );
  }
}

const assertTestDatabaseFallback = () => {
  if (!isTestDatabaseFallbackEnabled) {
    throw new Error('Fallback em memoria indisponivel fora de NODE_ENV=test sem DATABASE_URL.');
  }
};

await app.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

await app.register(jwt, {
  secret: process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? 'menucare-dev-secret',
});

await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
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

const getTenantIdFromJwt = (request: FastifyRequest): string => {
  const payload = request.user as { tenantId?: string };
  return payload.tenantId ?? demoContext.tenantId;
};

const getRoleKeyFromJwt = (request: FastifyRequest): string => {
  const payload = request.user as { roleKey?: string };
  return payload.roleKey ?? demoContext.roleKey;
};

const demoAuthorizedSite: AuthorizedSite = {
  id: demoSite.id,
  tenantId: demoContext.tenantId,
  name: demoSite.name,
  city: demoSite.city,
  state: demoSite.state,
  role: demoContext.roleKey,
};

const listAuthorizedSites = async (request: FastifyRequest): Promise<AuthorizedSite[]> => {
  if (!prisma) {
    assertTestDatabaseFallback();
    return [{ ...demoAuthorizedSite, role: getRoleKeyFromJwt(request) }];
  }

  const tenantId = getTenantIdFromJwt(request);
  const actor = getUserFromJwt(request);
  const roleKey = getRoleKeyFromJwt(request);

  if (roleKey === 'menucare_admin') {
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      tenant_id: string;
      name: string;
      city: string | null;
      state: string | null;
    }>>`
      SELECT id, tenant_id, name, city, state
      FROM sites
      WHERE tenant_id = ${tenantId}
        AND is_active = TRUE
      ORDER BY name ASC
    `;

    return rows.map((site) => ({
      id: site.id,
      tenantId: site.tenant_id,
      name: site.name,
      city: site.city,
      state: site.state,
      role: roleKey,
    }));
  }

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    tenant_id: string;
    name: string;
    city: string | null;
    state: string | null;
    role: string;
  }>>`
    SELECT site.id, site.tenant_id, site.name, site.city, site.state, access.role
    FROM user_site_accesses access
    JOIN sites site ON site.id = access.site_id
    WHERE access.tenant_id = ${tenantId}
      AND access.user_id = ${actor.id}
      AND access.is_active = TRUE
      AND site.is_active = TRUE
    ORDER BY site.name ASC
  `;

  return rows.map((site) => ({
    id: site.id,
    tenantId: site.tenant_id,
    name: site.name,
    city: site.city,
    state: site.state,
    role: site.role,
  }));
};

const resolveAuthorizedSite = async (
  request: FastifyRequest,
  siteId: string,
): Promise<SiteAccessResult> => {
  if (!prisma) {
    assertTestDatabaseFallback();
    if (siteId === demoSite.id) {
      return {
        allowed: true,
        site: { ...demoAuthorizedSite, role: getRoleKeyFromJwt(request) },
      };
    }

    return {
      allowed: false,
      statusCode: 404,
      body: { status: 'error', message: 'Unidade nao encontrada para este cliente.' },
    };
  }

  const tenantId = getTenantIdFromJwt(request);
  const roleKey = getRoleKeyFromJwt(request);
  const actor = getUserFromJwt(request);

  const siteRows = await prisma.$queryRaw<Array<{
    id: string;
    tenant_id: string;
    name: string;
    city: string | null;
    state: string | null;
  }>>`
    SELECT id, tenant_id, name, city, state
    FROM sites
    WHERE id = ${siteId}
      AND tenant_id = ${tenantId}
      AND is_active = TRUE
    LIMIT 1
  `;

  const site = siteRows[0];
  if (!site) {
    return {
      allowed: false,
      statusCode: 404,
      body: { status: 'error', message: 'Unidade nao encontrada para este cliente.' },
    };
  }

  if (roleKey === 'menucare_admin') {
    return {
      allowed: true,
      site: {
        id: site.id,
        tenantId: site.tenant_id,
        name: site.name,
        city: site.city,
        state: site.state,
        role: roleKey,
      },
    };
  }

  const accessRows = await prisma.$queryRaw<Array<{ role: string }>>`
    SELECT role
    FROM user_site_accesses
    WHERE tenant_id = ${tenantId}
      AND user_id = ${actor.id}
      AND site_id = ${siteId}
      AND is_active = TRUE
    LIMIT 1
  `;

  const access = accessRows[0];
  if (!access) {
    return {
      allowed: false,
      statusCode: 403,
      body: { status: 'error', message: 'Acesso negado para esta unidade.' },
    };
  }

  return {
    allowed: true,
    site: {
      id: site.id,
      tenantId: site.tenant_id,
      name: site.name,
      city: site.city,
      state: site.state,
      role: access.role,
    },
  };
};

const ensureLocalePreferencesTable = async () => {
  if (!prisma || localeTableReady) {
    return;
  }

  localeTableReady = true;
};

const ensureOperationalProfileTable = async () => {
  if (!prisma || operationalProfileTableReady) {
    return;
  }

  operationalProfileTableReady = true;
};

const ensureDomainTables = async () => {
  if (!prisma || domainTablesReady) {
    return;
  }

  domainTablesReady = true;
};

const ensureAuthTables = async () => {
  if (!prisma || authTablesReady) {
    return;
  }

  await prisma.$executeRaw`
    INSERT INTO first_access_invites (id, tenant_id, token, email, company_name, is_active)
    VALUES (${randomUUID()}, ${demoContext.tenantId}, ${demoInviteToken}, ${demoUser.email}, ${demoUser.companyName}, TRUE)
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

const readPasswordOverride = async (email: string, companyName: string, tenantId: string): Promise<string | null> => {
  if (!prisma) {
    return null;
  }

  await ensureAuthTables();

  const rows = await prisma.$queryRaw<Array<{ password_hash: string }>>`
    SELECT password_hash
    FROM auth_password_overrides
    WHERE email = ${email}
      AND tenant_id = ${tenantId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
    LIMIT 1
  `;

  return rows[0]?.password_hash ?? null;
};

const readLocaleFromDatabase = async (companyName: string, tenantId: string): Promise<SupportedLocale | null> => {
  if (!prisma) {
    return null;
  }

  await ensureLocalePreferencesTable();

  const rows = await prisma.$queryRaw<Array<{ locale: string }>>`
    SELECT locale
    FROM company_locale_preferences
    WHERE tenant_id = ${tenantId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
    LIMIT 1
  `;

  if (!rows.length) {
    return null;
  }

  return normalizeLocale(rows[0].locale);
};

const saveLocaleInDatabase = async (companyName: string, tenantId: string, locale: SupportedLocale) => {
  if (!prisma) {
    return;
  }

  await ensureLocalePreferencesTable();

  await prisma.$executeRaw`
    INSERT INTO company_locale_preferences (tenant_id, company_name, locale)
    VALUES (${tenantId}, ${companyName}, ${locale})
    ON CONFLICT (tenant_id, company_name)
    DO UPDATE SET
      locale = EXCLUDED.locale,
      updated_at = NOW()
  `;
};

const getDefaultOperationalProfile = () => ({
  sourceProfile: 'genial_integrated' as const,
  contractMode: 'with_contract' as const,
  complianceMode: 'contractual' as const,
});

const readOperationalProfileFromDatabase = async (companyName: string, tenantId: string) => {
  if (!prisma) {
    return null;
  }

  await ensureOperationalProfileTable();

  const rows = await prisma.$queryRaw<Array<{
    source_profile: string;
    contract_mode: string;
    compliance_mode: string;
    updated_at: Date;
  }>>`
    SELECT source_profile, contract_mode, compliance_mode, updated_at
    FROM company_operational_profiles
    WHERE tenant_id = ${tenantId}
      AND company_name = ${companyName}
    ORDER BY updated_at DESC
    LIMIT 1
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  const parsed = operationalProfileSchema.safeParse({
    sourceProfile: row.source_profile,
    contractMode: row.contract_mode,
    complianceMode: row.compliance_mode,
  });

  if (!parsed.success) {
    return null;
  }

  return {
    ...parsed.data,
    updatedAt: row.updated_at.toISOString(),
  };
};

const saveOperationalProfileInDatabase = async (
  companyName: string,
  tenantId: string,
  profile: z.infer<typeof operationalProfileSchema>,
) => {
  if (!prisma) {
    return;
  }

  const profileId = randomUUID();

  await ensureOperationalProfileTable();

  const existingRows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM company_operational_profiles
    WHERE tenant_id = ${tenantId}
      AND company_name = ${companyName}
    LIMIT 1
  `;

  const existingProfileId = existingRows[0]?.id ?? null;

  if (existingProfileId) {
    await prisma.$executeRaw`
      UPDATE company_operational_profiles
      SET source_profile = ${profile.sourceProfile},
          contract_mode = ${profile.contractMode},
          compliance_mode = ${profile.complianceMode},
          updated_at = NOW()
      WHERE id = ${existingProfileId}
    `;
    return;
  }

  await prisma.$executeRaw`
    INSERT INTO company_operational_profiles (
      id,
      tenant_id,
      company_name,
      source_profile,
      contract_mode,
      compliance_mode
    )
    VALUES (
      ${profileId},
      ${tenantId},
      ${companyName},
      ${profile.sourceProfile},
      ${profile.contractMode},
      ${profile.complianceMode}
    )
  `;
};

const readOperationalProfile = async (companyName: string, tenantId: string) => {
  if (prisma) {
    const persisted = await readOperationalProfileFromDatabase(companyName, tenantId);

    if (persisted) {
      return persisted;
    }
  }

  const memoryProfile = operationalProfileByCompany.get(companyName);

  if (memoryProfile) {
    return {
      sourceProfile: memoryProfile.source_profile,
      contractMode: memoryProfile.contract_mode,
      complianceMode: memoryProfile.compliance_mode,
      updatedAt: memoryProfile.updated_at.toISOString(),
    };
  }

  return {
    ...getDefaultOperationalProfile(),
    updatedAt: new Date(0).toISOString(),
  };
};

const saveOperationalProfile = async (
  companyName: string,
  tenantId: string,
  profile: z.infer<typeof operationalProfileSchema>,
) => {
  operationalProfileByCompany.set(companyName, {
    source_profile: profile.sourceProfile,
    contract_mode: profile.contractMode,
    compliance_mode: profile.complianceMode,
    updated_at: new Date(),
  });

  await saveOperationalProfileInDatabase(companyName, tenantId, profile);
};

const getUserFromJwt = (request: FastifyRequest) => {
  const payload = request.user as { sub?: string; name?: string };

  return {
    id: payload.sub ?? demoUser.id,
    name: payload.name ?? demoUser.name,
  };
};

const parseCookieHeader = (cookieHeader?: string | null) => {
  if (!cookieHeader) {
    return {} as Record<string, string>;
  }

  return cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.includes('='))
    .reduce<Record<string, string>>((acc, entry) => {
      const separatorIndex = entry.indexOf('=');
      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();

      if (key) {
        acc[key] = decodeURIComponent(value);
      }

      return acc;
    }, {});
};

const setRefreshTokenCookie = (reply: FastifyReply, token: string, expiresAt: Date) => {
  const maxAgeSeconds = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  const cookieParts = [
    `${refreshCookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];

  if ((process.env.NODE_ENV ?? 'development') !== 'development') {
    cookieParts.push('Secure');
  }

  reply.header('Set-Cookie', cookieParts.join('; '));
};

const clearRefreshTokenCookie = (reply: FastifyReply) => {
  const cookieParts = [
    `${refreshCookieName}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];

  if ((process.env.NODE_ENV ?? 'development') !== 'development') {
    cookieParts.push('Secure');
  }

  reply.header('Set-Cookie', cookieParts.join('; '));
};

const issueAccessToken = async (reply: FastifyReply, user: {
  id: string;
  email: string;
  name: string;
  companyName: string;
  accessProfile: string;
  tenantId: string;
  roleKey: string;
}) =>
  reply.jwtSign(
    {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      companyName: user.companyName,
      accessProfile: user.accessProfile,
      roleKey: user.roleKey,
    },
    {
      expiresIn: '8h',
    },
  );

const buildDeviceFingerprint = (userAgent?: string | null) => {
  const normalized = (userAgent ?? 'unknown').trim().toLowerCase();

  if (!normalized) {
    return 'unknown';
  }

  return createHash('sha256').update(normalized).digest('hex').slice(0, 32);
};

const buildDeviceLabel = (userAgent?: string | null) => {
  const normalized = (userAgent ?? '').trim();

  if (!normalized) {
    return 'unknown';
  }

  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 117)}...`;
};

const getRefreshSessionDeviceContext = (request: FastifyRequest) => {
  const userAgentHeader = request.headers['user-agent'];
  const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;

  return {
    deviceFingerprint: buildDeviceFingerprint(userAgent),
    deviceLabel: buildDeviceLabel(userAgent),
    ipAddress: request.ip ?? null,
  };
};

const getIncomingAuthFlowId = (request: FastifyRequest) => {
  const authFlowHeader = request.headers[authFlowHeaderName];
  const authFlowId = (Array.isArray(authFlowHeader) ? authFlowHeader[0] : authFlowHeader)?.trim();

  if (!authFlowId) {
    return null;
  }

  return authFlowId.slice(0, 64);
};

const resolveAuthFlowId = (request: FastifyRequest, fallback?: string) => {
  return getIncomingAuthFlowId(request) ?? fallback ?? randomUUID();
};

const setAuthFlowHeader = (reply: FastifyReply, authFlowId: string) => {
  reply.header(authFlowHeaderName, authFlowId);
};

const logRefreshSessionSecurityEvent = (
  event: string,
  payload: Record<string, unknown>,
) => {
  app.log.info(
    {
      event,
      ...payload,
    },
    'Evento de seguranca de refresh session.',
  );
};

const cleanupExpiredRefreshSessions = async () => {
  const now = Date.now();
  let removedCount = 0;

  if (!prisma) {
    for (const [sessionId, session] of refreshSessionMemory.entries()) {
      if (session.expires_at.getTime() <= now) {
        refreshSessionMemory.delete(sessionId);
        removedCount += 1;
      }
    }

    if (removedCount > 0) {
      logRefreshSessionSecurityEvent('refresh_sessions_expired_cleanup', {
        source: 'memory',
        removedCount,
      });
    }

    return;
  }

  await ensureAuthTables();

  removedCount = await prisma.$executeRaw`
    DELETE FROM auth_refresh_sessions
    WHERE expires_at <= NOW()
  `;

  if (removedCount > 0) {
    logRefreshSessionSecurityEvent('refresh_sessions_expired_cleanup', {
      source: 'database',
      removedCount,
    });
  }
};

const revokeRefreshSessionsByDevice = async (userId: string, deviceFingerprint: string) => {
  let revokedCount = 0;

  if (!prisma) {
    for (const [sessionId, session] of refreshSessionMemory.entries()) {
      if (
        session.user_id === userId
        && session.device_fingerprint === deviceFingerprint
        && !session.revoked_at
        && session.expires_at.getTime() > Date.now()
      ) {
        session.revoked_at = new Date();
        refreshSessionMemory.set(sessionId, session);
        revokedCount += 1;
      }
    }

    if (revokedCount > 0) {
      logRefreshSessionSecurityEvent('refresh_sessions_device_revoked', {
        source: 'memory',
        userId,
        deviceFingerprint,
        revokedCount,
      });
    }

    return;
  }

  await ensureAuthTables();

  revokedCount = await prisma.$executeRaw`
    UPDATE auth_refresh_sessions
    SET revoked_at = NOW()
    WHERE user_id = ${userId}
      AND device_fingerprint = ${deviceFingerprint}
      AND revoked_at IS NULL
      AND expires_at > NOW()
  `;

  if (revokedCount > 0) {
    logRefreshSessionSecurityEvent('refresh_sessions_device_revoked', {
      source: 'database',
      userId,
      deviceFingerprint,
      revokedCount,
    });
  }
};

const enforceRefreshSessionLimit = async (userId: string, maxActiveSessions: number) => {
  if (maxActiveSessions < 1) {
    return;
  }

  if (!prisma) {
    const activeSessions = Array.from(refreshSessionMemory.values())
      .filter(
        (session) =>
          session.user_id === userId
          && !session.revoked_at
          && session.expires_at.getTime() > Date.now(),
      )
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    const sessionsToRevoke = activeSessions.slice(maxActiveSessions);

    for (const session of sessionsToRevoke) {
      session.revoked_at = new Date();
      refreshSessionMemory.set(session.id, session);
    }

    if (sessionsToRevoke.length > 0) {
      logRefreshSessionSecurityEvent('refresh_sessions_limit_enforced', {
        source: 'memory',
        userId,
        maxActiveSessions,
        revokedCount: sessionsToRevoke.length,
      });
    }

    return;
  }

  await ensureAuthTables();

  const activeSessions = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM auth_refresh_sessions
    WHERE user_id = ${userId}
      AND revoked_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC, id DESC
  `;

  const sessionsToRevoke = activeSessions.slice(maxActiveSessions);

  for (const session of sessionsToRevoke) {
    await revokeRefreshSession(session.id);
  }

  if (sessionsToRevoke.length > 0) {
    logRefreshSessionSecurityEvent('refresh_sessions_limit_enforced', {
      source: 'database',
      userId,
      maxActiveSessions,
      revokedCount: sessionsToRevoke.length,
    });
  }
};

const touchRefreshSession = async (sessionId: string) => {
  if (!prisma) {
    const session = refreshSessionMemory.get(sessionId);

    if (!session) {
      return;
    }

    session.last_seen_at = new Date();
    refreshSessionMemory.set(sessionId, session);
    return;
  }

  await ensureAuthTables();

  await prisma.$executeRaw`
    UPDATE auth_refresh_sessions
    SET last_seen_at = NOW()
    WHERE id = ${sessionId}
  `;
};

const createRefreshSession = async (payload: {
  userId: string;
  email: string;
  companyName: string;
  accessProfile: string;
  tenantId: string;
  roleKey: string;
  userName: string;
  authFlowId: string;
  deviceFingerprint: string;
  deviceLabel: string;
  ipAddress: string | null;
}) => {
  logRefreshSessionSecurityEvent('refresh_session_issuance_started', {
    userId: payload.userId,
    authFlowId: payload.authFlowId,
    deviceFingerprint: payload.deviceFingerprint,
    hasIpAddress: Boolean(payload.ipAddress),
  });

  await cleanupExpiredRefreshSessions();
  await revokeRefreshSessionsByDevice(payload.userId, payload.deviceFingerprint);

  const refreshToken = randomBytes(48).toString('hex');
  const tokenHash = await hashPassword(refreshToken);
  const sessionId = randomUUID();
  const createdAt = new Date();
  const expiresAt = new Date(Date.now() + refreshTokenTtlMs);

  if (!prisma) {
    refreshSessionMemory.set(sessionId, {
      id: sessionId,
      user_id: payload.userId,
      email: payload.email,
      company_name: payload.companyName,
      access_profile: payload.accessProfile,
      tenant_id: payload.tenantId,
      role_key: payload.roleKey,
      user_name: payload.userName,
      token_hash: tokenHash,
      auth_flow_id: payload.authFlowId,
      device_fingerprint: payload.deviceFingerprint,
      device_label: payload.deviceLabel,
      ip_address: payload.ipAddress,
      expires_at: expiresAt,
      created_at: createdAt,
      last_seen_at: createdAt,
      revoked_at: null,
      replaced_by_session_id: null,
    });

    await enforceRefreshSessionLimit(payload.userId, refreshMaxActiveSessions);

    logRefreshSessionSecurityEvent('refresh_session_issued', {
      source: 'memory',
      sessionId,
      userId: payload.userId,
      authFlowId: payload.authFlowId,
      deviceFingerprint: payload.deviceFingerprint,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      sessionId,
      refreshToken,
      expiresAt,
    };
  }

  await ensureAuthTables();

  await prisma.$executeRaw`
    INSERT INTO auth_refresh_sessions (
      id,
      user_id,
      email,
      company_name,
      access_profile,
      tenant_id,
      role_key,
      user_name,
      token_hash,
      auth_flow_id,
      device_fingerprint,
      device_label,
      ip_address,
      expires_at
    )
    VALUES (
      ${sessionId},
      ${payload.userId},
      ${payload.email},
      ${payload.companyName},
      ${payload.accessProfile},
      ${payload.tenantId},
      ${payload.roleKey},
      ${payload.userName},
      ${tokenHash},
      ${payload.authFlowId},
      ${payload.deviceFingerprint},
      ${payload.deviceLabel},
      ${payload.ipAddress},
      ${expiresAt}
    )
  `;

  await enforceRefreshSessionLimit(payload.userId, refreshMaxActiveSessions);

  logRefreshSessionSecurityEvent('refresh_session_issued', {
    source: 'database',
    sessionId,
    userId: payload.userId,
    authFlowId: payload.authFlowId,
    deviceFingerprint: payload.deviceFingerprint,
    expiresAt: expiresAt.toISOString(),
  });

  return {
    sessionId,
    refreshToken,
    expiresAt,
  };
};

const revokeRefreshSession = async (sessionId: string, replacedBySessionId?: string) => {
  if (!prisma) {
    const session = refreshSessionMemory.get(sessionId);

    if (!session || session.revoked_at) {
      return;
    }

    session.revoked_at = new Date();
    session.replaced_by_session_id = replacedBySessionId ?? null;
    refreshSessionMemory.set(sessionId, session);
    return;
  }

  await ensureAuthTables();

  await prisma.$executeRaw`
    UPDATE auth_refresh_sessions
    SET
      revoked_at = NOW(),
      replaced_by_session_id = ${replacedBySessionId ?? null}
    WHERE id = ${sessionId}
      AND revoked_at IS NULL
  `;
};

const readRefreshSession = async (sessionId: string) => {
  await cleanupExpiredRefreshSessions();

  if (!prisma) {
    return refreshSessionMemory.get(sessionId) ?? null;
  }

  await ensureAuthTables();

  const sessions = await prisma.$queryRaw<Array<{
    id: string;
    user_id: string;
    email: string;
    company_name: string;
    access_profile: string;
    tenant_id: string;
    role_key: string;
    user_name: string;
    token_hash: string;
    auth_flow_id: string;
    device_fingerprint: string;
    device_label: string;
    ip_address: string | null;
    expires_at: Date;
    last_seen_at: Date;
    revoked_at: Date | null;
    created_at: Date;
  }>>`
    SELECT
      id,
      user_id,
      email,
      company_name,
      access_profile,
      tenant_id,
      role_key,
      user_name,
      token_hash,
      auth_flow_id,
      device_fingerprint,
      device_label,
      ip_address,
      expires_at,
      last_seen_at,
      revoked_at,
      created_at
    FROM auth_refresh_sessions
    WHERE id = ${sessionId}
    LIMIT 1
  `;

  const session = sessions[0];

  if (!session) {
    return null;
  }

  return {
    ...session,
    replaced_by_session_id: null,
  };
};

const normalizeTerm = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const parseCurrencyPtBr = (value: string) => Number(value.replace(/\./g, '').replace(',', '.'))

const toIsoDateFromPtBr = (value: string) => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)

  if (!match) {
    return null
  }

  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

const parseMenuPreCostReport = (rawText: string) => {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const dayHeaderRegex = /^(\d{2}\/\d{2}\/\d{4})\s*-\s*\[[^\]]+\]$/i
  const itemWithCostRegex = /^(.*\S)\s+(\d{1,3}(?:\.\d{3})*,\d{2})$/
  const totalLineRegex = /^(\d{1,3}(?:\.\d{3})*,\d{2})$/

  let unitName: string | null = null
  let serviceName: string | null = null
  let financialGoal: number | null = null

  type ParsedRecipeItem = { name: string; cost: number }
  type ParsedDay = {
    referenceDate: string
    recipeItems: ParsedRecipeItem[]
    reportedTotal: number | null
  }

  const days: ParsedDay[] = []
  let currentDay: ParsedDay | null = null

  for (const line of lines) {
    const unitMatch = line.match(/^Unidade:\s*(.+)$/i)
    if (unitMatch) {
      unitName = unitMatch[1].trim()
      continue
    }

    const serviceMetaMatch = line.match(/^Servi(?:c|\u00e7|ÃƒÂ§|ÃƒÆ’Ã‚Â§)o:\s*(.+?)\s+Meta:\s*([\d.,]+)$/i)
    if (serviceMetaMatch) {
      serviceName = serviceMetaMatch[1].trim()
      financialGoal = parseCurrencyPtBr(serviceMetaMatch[2])
      continue
    }

    const trailingUnitMatch = line.match(/^(.+?)\s+Unidade:\s*$/i)
    if (trailingUnitMatch) {
      unitName = trailingUnitMatch[1].trim()
      continue
    }

    const leadingServiceMetaMatch = line.match(/^(.+?)\s+Servi(?:c|\u00e7|ÃƒÂ§|ÃƒÆ’Ã‚Â§|ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§)o:\s*Meta:\s*([\d.,]+)$/i)
    if (leadingServiceMetaMatch) {
      serviceName = leadingServiceMetaMatch[1].trim()
      financialGoal = parseCurrencyPtBr(leadingServiceMetaMatch[2])
      continue
    }

    const dayHeaderMatch = line.match(dayHeaderRegex)
    if (dayHeaderMatch) {
      const isoDate = toIsoDateFromPtBr(dayHeaderMatch[1])

      if (!isoDate) {
        continue
      }

      currentDay = {
        referenceDate: isoDate,
        recipeItems: [],
        reportedTotal: null,
      }
      days.push(currentDay)
      continue
    }

    if (!currentDay) {
      continue
    }

    if (/^observa(?:cao|ÃƒÂ§ÃƒÂ£o|c[aÃƒÂ£]o|cÃƒÆ’Ã‚Â§[aÃƒÆ’Ã‚Â£]o):?$/i.test(line)) {
      continue
    }

    const itemMatch = line.match(itemWithCostRegex)
    if (itemMatch) {
      currentDay.recipeItems.push({
        name: itemMatch[1].trim(),
        cost: Number(parseCurrencyPtBr(itemMatch[2]).toFixed(2)),
      })
      continue
    }

    const totalMatch = line.match(totalLineRegex)
    if (totalMatch) {
      currentDay.reportedTotal = Number(parseCurrencyPtBr(totalMatch[1]).toFixed(2))
    }
  }

  return {
    unitName,
    serviceName,
    financialGoal,
    days,
  }
}

type ParsedMenuImportPayload = {
  unitName: string
  serviceName: string
  mealType: string
  financialGoal: number
  fileName: string
  days: Array<{
    referenceDate: string
    recipeItems: Array<{ name: string; cost: number }>
    recipes: string[]
    computedMealCost: number
    reportedMealCost: number | null
    costDelta: number
    financialGoal: number
    exceededValue: number
    exceededPercent: number
    validationStatus: 'above_goal' | 'within_goal'
  }>
  suggestedImports: Array<{
    fileName: string
    unitName: string
    serviceName: string
    referenceDate: string
    mealType: string
    financialGoal: number
    mealCost: number
    recipes: string[]
    recipeItems: Array<{ name: string; cost: number }>
  }>
}

const buildParsedMenuImportPayload = (payload: {
  rawText: string
  fileName?: string
  unitName?: string
  serviceName?: string
  mealType?: string
  financialGoal?: number
}): ParsedMenuImportPayload | null => {
  const report = parseMenuPreCostReport(payload.rawText)
  const fileName = payload.fileName ?? 'RELATORIO-PRE-CUSTO.pdf'
  const unitName = payload.unitName ?? report.unitName
  const serviceName = payload.serviceName ?? report.serviceName
  const mealType = payload.mealType ?? serviceName ?? 'Almoco'
  const financialGoal = payload.financialGoal ?? report.financialGoal

  if (!unitName || !serviceName || !financialGoal) {
    return null
  }

  const days = report.days
    .filter((day) => day.recipeItems.length > 0)
    .map((day) => {
      const computedMealCost = Number(
        day.recipeItems.reduce((sum, item) => sum + item.cost, 0).toFixed(2),
      )
      const exceededValue = Math.max(computedMealCost - financialGoal, 0)
      const exceededPercent = Number(((exceededValue / financialGoal) * 100).toFixed(2))
      const validationStatus: 'above_goal' | 'within_goal' = exceededValue > 0 ? 'above_goal' : 'within_goal'
      const reportedMealCost = day.reportedTotal
      const costDelta = Number(((reportedMealCost ?? computedMealCost) - computedMealCost).toFixed(2))

      return {
        referenceDate: day.referenceDate,
        recipeItems: day.recipeItems,
        recipes: day.recipeItems.map((item) => item.name),
        computedMealCost,
        reportedMealCost,
        costDelta,
        financialGoal: Number(financialGoal.toFixed(2)),
        exceededValue: Number(exceededValue.toFixed(2)),
        exceededPercent,
        validationStatus,
      }
    })

  return {
    unitName,
    serviceName,
    mealType,
    financialGoal: Number(financialGoal.toFixed(2)),
    fileName,
    days,
    suggestedImports: days.map((day) => ({
      fileName,
      unitName,
      serviceName,
      referenceDate: day.referenceDate,
      mealType,
      financialGoal: day.financialGoal,
      mealCost: day.computedMealCost,
      recipes: day.recipes,
      recipeItems: day.recipeItems,
    })),
  }
}

const semanticCategoryAliases: Record<string, string[]> = {
  peixe: ['peixe', 'tilapia', 'salmao', 'atum', 'bacalhau', 'merluza', 'pescada', 'sardinha', 'dourado', 'pescado'],
  frango: ['frango', 'galeto', 'sobrecoxa', 'coxa'],
  bovino: ['carne', 'bovina', 'boi', 'acem', 'patinho', 'musculo'],
  suino: ['suino', 'porco', 'lombo', 'pernil'],
  carboidrato: ['carboidrato', 'arroz', 'massa', 'macarrao', 'batata', 'mandioca', 'pure'],
  fruta: ['fruta', 'laranja', 'banana', 'maca', 'mamao', 'abacaxi', 'melancia', 'uva'],
  legume: ['legume', 'cenoura', 'abobora', 'chuchu', 'beterraba', 'abobrinha'],
  verdura: ['verdura', 'alface', 'couve', 'repolho', 'espinafre', 'agriao', 'hortalica', 'hortalicas'],
}

const semanticAliasByToken = Object.entries(semanticCategoryAliases).reduce<Record<string, string>>(
  (acc, [canonical, aliases]) => {
    for (const alias of aliases) {
      acc[normalizeTerm(alias)] = canonical
    }

    return acc
  },
  {},
)

const buildSemanticAliasByContext = (context: { mealType?: string; serviceName?: string }) => {
  const contextualAliasMap = { ...semanticAliasByToken }
  const normalizedContext = normalizeTerm(`${context.mealType ?? ''} ${context.serviceName ?? ''}`)

  if (/(almoco|jantar)/.test(normalizedContext)) {
    contextualAliasMap[normalizeTerm('posta')] = 'peixe'
    contextualAliasMap[normalizeTerm('file')] = 'peixe'
    contextualAliasMap[normalizeTerm('bife')] = 'bovino'
    contextualAliasMap[normalizeTerm('salada')] = 'verdura'
    contextualAliasMap[normalizeTerm('folhas')] = 'verdura'
    contextualAliasMap[normalizeTerm('folha')] = 'verdura'
    contextualAliasMap[normalizeTerm('refogado')] = 'legume'
    contextualAliasMap[normalizeTerm('grelhados')] = 'legume'
  }

  if (/(cafe|manha)/.test(normalizedContext)) {
    contextualAliasMap[normalizeTerm('suco')] = 'fruta'
    contextualAliasMap[normalizeTerm('citrico')] = 'fruta'
    contextualAliasMap[normalizeTerm('citricos')] = 'fruta'
    contextualAliasMap[normalizeTerm('vitamina')] = 'fruta'
    contextualAliasMap[normalizeTerm('pao')] = 'carboidrato'
    contextualAliasMap[normalizeTerm('tapioca')] = 'carboidrato'
  }

  return contextualAliasMap
}

const normalizeSemanticToken = (token: string, aliasByToken: Record<string, string> = semanticAliasByToken) => {
  const normalizedToken = normalizeTerm(token)

  if (!normalizedToken) {
    return ''
  }

  const aliasToken = aliasByToken[normalizedToken] ?? normalizedToken

  if (aliasToken.length <= 3) {
    return aliasToken
  }

  let stem = aliasToken

  if (stem.endsWith('es') && stem.length > 5) {
    stem = stem.slice(0, -2)
  } else if (stem.endsWith('s') && stem.length > 4) {
    stem = stem.slice(0, -1)
  }

  if ((stem.endsWith('a') || stem.endsWith('o')) && stem.length > 5) {
    stem = stem.slice(0, -1)
  }

  return stem
}

const normalizeSemanticTerm = (value: string, aliasByToken: Record<string, string> = semanticAliasByToken) =>
  normalizeTerm(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0)
    .map((token) => normalizeSemanticToken(token, aliasByToken))
    .filter((token) => token.length > 0)
    .join(' ')

const hasSemanticKeyword = (normalizedContent: string, canonicalKey: keyof typeof semanticCategoryAliases) =>
  semanticCategoryAliases[canonicalKey].some((keyword) => normalizedContent.includes(normalizeTerm(keyword)))

const resolveStructuredRecipeFromImportedName = <T extends { normalized_name: string }>(
  importedRecipeName: string,
  structuredRecipeRows: T[],
  structuredRecipeByNormalizedName: Map<string, T>,
  aliasByToken: Record<string, string> = semanticAliasByToken,
) => {
  const normalizedImportedRecipeName = normalizeTerm(importedRecipeName).trim();
  const semanticImportedRecipeName = normalizeSemanticTerm(importedRecipeName, aliasByToken).trim()

  if (!normalizedImportedRecipeName) {
    return null;
  }

  const exactMatch = structuredRecipeByNormalizedName.get(normalizedImportedRecipeName);

  if (exactMatch) {
    return exactMatch;
  }

  const importedTokens = normalizedImportedRecipeName
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
  const semanticImportedTokens = semanticImportedRecipeName
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)

  let bestMatch: T | null = null;
  let bestScore = 0;

  for (const structuredRecipe of structuredRecipeRows) {
    const candidateNormalizedName = structuredRecipe.normalized_name;
    const candidateSemanticName = normalizeSemanticTerm(candidateNormalizedName, aliasByToken)

    if (!candidateNormalizedName) {
      continue;
    }

    const containmentLength = Math.min(
      normalizedImportedRecipeName.length,
      candidateNormalizedName.length,
    );
    let score = 0;

    if (containmentLength >= 8 && (
      normalizedImportedRecipeName.includes(candidateNormalizedName)
      || candidateNormalizedName.includes(normalizedImportedRecipeName)
      || semanticImportedRecipeName.includes(candidateSemanticName)
      || candidateSemanticName.includes(semanticImportedRecipeName)
    )) {
      score = 100 + containmentLength;
    } else if (importedTokens.length >= 1) {
      const candidateTokens = candidateNormalizedName
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3);
      const overlapCount = importedTokens.filter((token) => candidateTokens.includes(token)).length;
      const candidateSemanticTokens = candidateSemanticName
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3)
      const semanticOverlapCount = semanticImportedTokens.filter((token) => candidateSemanticTokens.includes(token)).length
      const importedPrefix = normalizedImportedRecipeName.slice(0, 12)
      const semanticImportedPrefix = semanticImportedRecipeName.slice(0, 12)
      const hasPrefixMatch = importedPrefix.length >= 8 && candidateNormalizedName.startsWith(importedPrefix)
      const hasSemanticPrefixMatch = semanticImportedPrefix.length >= 8 && candidateSemanticName.startsWith(semanticImportedPrefix)

      if (overlapCount >= 2 || semanticOverlapCount >= 2) {
        score = Math.max(overlapCount, semanticOverlapCount) * 20 + containmentLength;
      } else if (hasPrefixMatch || hasSemanticPrefixMatch) {
        score = 60 + containmentLength
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = structuredRecipe;
    }
  }

  return bestMatch;
}

const inferSuggestionEvidenceSource = (input: {
  sourceType: 'rule' | 'financial_goal';
  suggestionText: string;
  estimatedNutritionalImpact: string;
  sourceReference: string | null;
}) => {
  if (input.sourceType === 'financial_goal') {
    return 'financial_goal' as const;
  }

  if (input.sourceReference === 'preventive_optimization') {
    return 'preventive' as const;
  }

  if (
    /^Substituir\s+/i.test(input.suggestionText) &&
    /grupo\s+.+?\s+com substituicao/i.test(input.estimatedNutritionalImpact)
  ) {
    return 'structured' as const;
  }

  return 'textual_fallback' as const;
}

const inferSuggestionEvidenceSubtype = (input: {
  evidenceSource: 'structured' | 'textual_fallback' | 'financial_goal' | 'preventive';
  suggestionText: string;
  sourceReference: string | null;
}) => {
  if (input.evidenceSource !== 'structured') {
    return null;
  }

  const normalizedContent = normalizeTerm(
    `${input.suggestionText} ${input.sourceReference ?? ''}`,
  );

  if (
    /\b\d+x\s+por\s+semana\b/.test(normalizedContent) ||
    /vez\(es\)\s+na\s+semana/.test(normalizedContent) ||
    /frequencia/.test(normalizedContent)
  ) {
    return 'frequency' as const;
  }

  if (/nao\s+repetir/.test(normalizedContent) || /recorrencia/.test(normalizedContent)) {
    return 'recurrence' as const;
  }

  return 'classification' as const;
}

const extractRuleTarget = (value: string) => {
  const normalized = normalizeTerm(value);

  if (normalized.includes('fruta citrica')) {
    return {
      label: 'Fruta Citrica',
      matches: (item: { category: string; subcategory: string; food_group: string }) =>
        normalizeTerm(item.subcategory).includes('fruta citrica'),
    };
  }

  if (hasSemanticKeyword(normalized, 'peixe')) {
    return {
      label: 'Peixe',
      matches: (item: { category: string; subcategory: string; food_group: string }) =>
        hasSemanticKeyword(normalizeTerm(`${item.category} ${item.subcategory} ${item.food_group}`), 'peixe'),
    };
  }

  if (hasSemanticKeyword(normalized, 'frango')) {
    return {
      label: 'Frango',
      matches: (item: { category: string; subcategory: string; food_group: string }) =>
        hasSemanticKeyword(normalizeTerm(`${item.category} ${item.subcategory} ${item.food_group}`), 'frango'),
    };
  }

  if (normalized.includes('proteina')) {
    return {
      label: 'Proteina',
      matches: (item: { category: string; subcategory: string; food_group: string }) =>
        normalizeTerm(item.category).includes('proteina') || normalizeTerm(item.food_group).includes('proteina'),
    };
  }

  if (normalized.includes('carboidrato')) {
    return {
      label: 'Carboidrato',
      matches: (item: { category: string; subcategory: string; food_group: string }) =>
        normalizeTerm(item.category).includes('carboidrato'),
    };
  }

  if (normalized.includes('legume') || normalized.includes('verdura')) {
    return {
      label: 'Vegetais',
      matches: (item: { category: string; subcategory: string; food_group: string }) =>
        ['legume', 'verdura', 'vegetais', 'hortifruti'].some((term) =>
          [item.category, item.subcategory, item.food_group]
            .map((entry) => normalizeTerm(entry))
            .some((entry) => entry.includes(term)),
        ),
    };
  }

  return null;
};

const getDateOnlyString = (value: Date | string) =>
  typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10)

const parseUtcDate = (value: string) => new Date(`${value}T00:00:00.000Z`)

const addUtcDays = (value: string, days: number) => {
  const nextDate = parseUtcDate(value)
  nextDate.setUTCDate(nextDate.getUTCDate() + days)
  return nextDate.toISOString().slice(0, 10)
}

const startOfIsoWeek = (value: string) => {
  const currentDate = parseUtcDate(value)
  const currentWeekDay = currentDate.getUTCDay()
  const diff = currentWeekDay === 0 ? -6 : 1 - currentWeekDay
  currentDate.setUTCDate(currentDate.getUTCDate() + diff)
  return currentDate.toISOString().slice(0, 10)
}

const diffUtcDays = (from: string, to: string) => {
  const fromDate = parseUtcDate(from)
  const toDate = parseUtcDate(to)
  return Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
}

const getMonthKeyFromDate = (value: string) => value.slice(0, 7)

const extractWeeklyMinimum = (normalizedRuleText: string) => {
  const digitMatch = normalizedRuleText.match(/(\d+)\s*(x|vezes)?\s*(por semana|na semana)/)

  if (digitMatch) {
    return Number(digitMatch[1])
  }

  if (/tres\s+vezes|tres\s+ocorrencias/.test(normalizedRuleText)) {
    return 3
  }

  return null
}

const extractRecurrenceDays = (normalizedRuleText: string) => {
  if (!normalizedRuleText.includes('nao repetir') && !normalizedRuleText.includes('repet')) {
    return null
  }

  const digitMatch = normalizedRuleText.match(/(\d+)\s*dias/)

  if (digitMatch) {
    return Number(digitMatch[1])
  }

  if (normalizedRuleText.includes('sete dias')) {
    return 7
  }

  return null
}

const recordAiPreparationEvent = async (payload: {
  tenantId: string;
  companyName: string;
  moduleKey: 'contracts' | 'rules' | 'menus' | 'recipes';
  sourceKind: string;
  providerKey: string;
  data: unknown;
}) => {
  if (!prisma) {
    return
  }

  await ensureDomainTables()

  await prisma.$executeRaw`
    INSERT INTO ai_preparation_events (
      id,
      tenant_id,
      company_name,
      module_key,
      source_kind,
      payload_json,
      provider_key
    )
    VALUES (
      ${randomUUID()},
      ${payload.tenantId},
      ${payload.companyName},
      ${payload.moduleKey},
      ${payload.sourceKind},
      ${JSON.stringify(payload.data)},
      ${payload.providerKey}
    )
  `
}

type NextMenuProposalData = {
  importId: string;
  unitName: string;
  serviceName: string;
  proposalType: 'historical_recommended' | 'current_baseline';
  recipes: string[];
  estimatedCost: number;
  financialGoal: number;
  historicalLayer: {
    nonBlocking: true;
    sourceCombinationId: string | null;
    sourceAverageRating: number | null;
    sourceEvaluationsCount: number;
    note: string;
  };
  governance: {
    blocksApproval: boolean;
    mandatoryFindings: Array<{
      criterion: 'contract_rule_violation' | 'financial_goal_exceeded';
      status: 'ok' | 'violation';
    }>;
  };
};

const buildNextMenuProposal = async (payload: {
  companyName: string;
  tenantId: string;
  importId: string;
}): Promise<NextMenuProposalData | null> => {
  if (!prisma) {
    return null;
  }

  await ensureDomainTables();

  const importRows = await prisma.$queryRaw<Array<{
    id: string;
    unit_name: string;
    service_name: string;
    financial_goal: number | string;
    meal_cost: number | string;
    recipes_json: string;
  }>>`
    SELECT id, unit_name, service_name, financial_goal, meal_cost, recipes_json
    FROM menu_pdf_imports
    WHERE id = ${payload.importId}
      AND company_name = ${payload.companyName}
      AND tenant_id = ${payload.tenantId}
    LIMIT 1
  `;

  const imported = importRows[0];

  if (!imported) {
    return null;
  }

  const parseNumber = (value: number | string) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number(parsed.toFixed(2));
  };

  const mealCost = parseNumber(imported.meal_cost);
  const financialGoal = parseNumber(imported.financial_goal);

  const ruleAuditRows = await prisma.$queryRaw<Array<{ result_status: 'compliant' | 'non_compliant' }>>`
    SELECT result_status
    FROM menu_import_rule_audits
    WHERE menu_import_id = ${payload.importId}
      AND company_name = ${payload.companyName}
      AND tenant_id = ${payload.tenantId}
  `;

  const hasMandatoryRuleViolation = ruleAuditRows.some((item) => item.result_status === 'non_compliant');
  const hasFinancialViolation = mealCost > financialGoal;
  const mandatoryBlocksApproval = hasMandatoryRuleViolation || hasFinancialViolation;

  const combinationRows = await prisma.$queryRaw<Array<{
    id: string;
    recipes_json: string;
    average_rating: number | string;
    evaluations_count: number;
  }>>`
    SELECT id, recipes_json, average_rating, evaluations_count
    FROM menu_combination_intelligence
    WHERE company_name = ${payload.companyName}
      AND tenant_id = ${payload.tenantId}
      AND unit_name = ${imported.unit_name}
      AND service_name = ${imported.service_name}
    ORDER BY average_rating DESC, evaluations_count DESC
    LIMIT 1
  `;

  const currentRecipes = JSON.parse(imported.recipes_json) as string[];
  const topHistorical = combinationRows[0];
  const recommendedRecipes = topHistorical
    ? (JSON.parse(topHistorical.recipes_json) as string[])
    : currentRecipes;

  const estimatedCost = Number(
    Math.max(
      hasFinancialViolation ? financialGoal : mealCost,
      financialGoal * 0.85,
    ).toFixed(2),
  );

  return {
    importId: payload.importId,
    unitName: imported.unit_name,
    serviceName: imported.service_name,
    proposalType: topHistorical ? 'historical_recommended' : 'current_baseline',
    recipes: recommendedRecipes,
    estimatedCost,
    financialGoal,
    historicalLayer: {
      nonBlocking: true,
      sourceCombinationId: topHistorical?.id ?? null,
      sourceAverageRating: topHistorical ? parseNumber(topHistorical.average_rating) : null,
      sourceEvaluationsCount: topHistorical?.evaluations_count ?? 0,
      note: 'Historico de avaliacoes recomenda combinacoes, mas nunca bloqueia aprovacao.',
    },
    governance: {
      blocksApproval: mandatoryBlocksApproval,
      mandatoryFindings: [
        {
          criterion: 'contract_rule_violation',
          status: hasMandatoryRuleViolation ? 'violation' : 'ok',
        },
        {
          criterion: 'financial_goal_exceeded',
          status: hasFinancialViolation ? 'violation' : 'ok',
        },
      ],
    },
  };
};

const registerInviteAuditEvent = async (payload: {
  tenantId: string;
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
      tenant_id,
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
      ${payload.tenantId},
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

const consumeLoginAttempt = (key: string, now: number) => {
  const state = loginAttemptByKey.get(key);

  if (!state) {
    loginAttemptByKey.set(key, { attempts: 1, blockedUntil: 0 });
    return false;
  }

  if (state.blockedUntil > 0 && now >= state.blockedUntil) {
    loginAttemptByKey.set(key, { attempts: 1, blockedUntil: 0 });
    return false;
  }

  const nextAttempts = state.attempts + 1;

  if (nextAttempts >= loginAttemptLimit) {
    loginAttemptByKey.set(key, { attempts: nextAttempts, blockedUntil: now + loginRateLimitWindowMs });
    return true;
  }

  loginAttemptByKey.set(key, { attempts: nextAttempts, blockedUntil: state.blockedUntil });
  return false;
};

const isLoginBlocked = (key: string, now: number) => {
  const state = loginAttemptByKey.get(key);

  if (!state) {
    return false;
  }

  if (state.blockedUntil > 0 && now >= state.blockedUntil) {
    loginAttemptByKey.delete(key);
    return false;
  }

  return state.blockedUntil > 0 && now < state.blockedUntil;
};

const moduleDeps = {
  z,
  PDFParse,
  apiMessage,
  authenticate,
  authSchema,
  consumeLoginAttempt,
  isLoginBlocked,
  demoUser,
  demoContext,
  demoPassword,
  prisma,
  readPasswordOverride,
  verifyPassword,
  issueAccessToken,
  getRefreshSessionDeviceContext,
  resolveAuthFlowId,
  setAuthFlowHeader,
  createRefreshSession,
  setRefreshTokenCookie,
  parseCookieHeader,
  refreshCookieName,
  readRefreshSession,
  revokeRefreshSession,
  clearRefreshTokenCookie,
  touchRefreshSession,
  getCompanyFromJwt,
  getTenantIdFromJwt,
  listAuthorizedSites,
  resolveAuthorizedSite,
  readOperationalProfile,
  operationalProfileSchema,
  saveOperationalProfile,
  inviteActivationSchema,
  ensureAuthTables,
  hashPassword,
  registerInviteAuditEvent,
  inviteCreationSchema,
  getUserFromJwt,
  inviteAuditQuerySchema,
  inviteListQuerySchema,
  inviteTokenParamSchema,
  localeByCompany,
  loginAttemptByKey,
  normalizeLocale,
  readLocaleFromDatabase,
  saveLocaleInDatabase,
  localeSchema,
  randomUUID,
  contractSchema,
  ensureDomainTables,
  buildRulePreparationContext,
  ruleSchema,
  ruleParamsSchema,
  ruleStatusUpdateSchema,
  recordAiPreparationEvent,
  menuImportSchema,
  menuImportParseReportSchema,
  buildParsedMenuImportPayload,
  operationalMenuCardapioSchema,
  menuMonthlyCycleQuerySchema,
  buildSemanticAliasByContext,
  resolveStructuredRecipeFromImportedName,
  getMonthKeyFromDate,
  getDateOnlyString,
  addUtcDays,
  startOfIsoWeek,
  diffUtcDays,
  extractRuleTarget,
  extractWeeklyMinimum,
  extractRecurrenceDays,
  normalizeTerm,
  inferSuggestionEvidenceSource,
  inferSuggestionEvidenceSubtype,
  adjustedVersionGenerationSchema,
  buildMenuPreparationContext,
  commemorativeDateSchema,
  commemorativeDateListQuerySchema,
  menuImportListQuerySchema,
  menuMonthlySummaryListQuerySchema,
  menuMonthlySummaryReprocessSchema,
  menuImportParamsSchema,
  recipeImportSchema,
  buildRecipeImportContext,
  classifyRecipeFromText,
  recipeParamsSchema,
  recipeClassificationUpdateSchema,
  nonConformitySchema,
  nonConformityParamsSchema,
  nonConformityStatusSchema,
  nonConformityHistoryQuerySchema,
  actionPlanSchema,
  actionPlanParamsSchema,
  actionPlanStatusSchema,
  actionPlanHistoryQuerySchema,
  complianceExportAuditQuerySchema,
  evaluationImportSchema,
  evaluationImportListQuerySchema,
  intelligenceListQuerySchema,
  recommendationPolicyContract,
  buildNextMenuProposal,
  nextMenuDecisionSchema,
  nextMenuDecisionListQuerySchema,
};

registerAuthRoutes(app, moduleDeps as unknown as import('./modules/auth/service.js').Deps);
registerContractsRoutes(app, moduleDeps as unknown as import('./modules/contracts/service.js').Deps);
registerRulesRoutes(app, moduleDeps as unknown as import('./modules/rules/service.js').Deps);
registerMenusRoutes(app, moduleDeps as unknown as import('./modules/menus/service.js').Deps);
registerRecipesRoutes(app, moduleDeps as unknown as import('./modules/recipes/service.js').Deps);
registerComplianceRoutes(app, moduleDeps as unknown as import('./modules/compliance/service.js').Deps);
registerEvaluationsRoutes(app, moduleDeps as unknown as import('./modules/evaluations/service.js').Deps);
registerRecommendationsRoutes(app, moduleDeps as unknown as import('./modules/recommendations/service.js').Deps);
registerGovernanceRoutes(app, moduleDeps as unknown as import('./modules/governance/service.js').Deps);
app.get('/dashboard/cockpit', { preHandler: authenticate }, async (request, reply) => {
  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const companyName = getCompanyFromJwt(request);
  const tenantId = getTenantIdFromJwt(request);

  await ensureDomainTables();

  const controls = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    responsible: string;
    frequency: string;
    status: string;
    last_execution_at: Date | null;
    last_execution_status: string | null;
    open_findings_count: number;
    critical_findings_count: number;
  }>>`
    SELECT
      control.id,
      control.title,
      control.responsible,
      UPPER(control.frequency) AS frequency,
      UPPER(control.status) AS status,
      last_execution.executed_at AS last_execution_at,
      last_execution.status AS last_execution_status,
      COALESCE(open_findings.total, 0)::int AS open_findings_count,
      COALESCE(critical_findings.total, 0)::int AS critical_findings_count
    FROM compliance_controls control
    LEFT JOIN LATERAL (
      SELECT status, executed_at
      FROM compliance_control_executions execution
      WHERE execution.control_id = control.id
        AND execution.tenant_id = control.tenant_id
        AND execution.company_name = control.company_name
      ORDER BY execution.executed_at DESC
      LIMIT 1
    ) AS last_execution ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS total
      FROM compliance_findings finding
      WHERE finding.control_id = control.id
        AND finding.tenant_id = control.tenant_id
        AND finding.company_name = control.company_name
        AND finding.status IN ('OPEN', 'IN_ANALYSIS')
    ) AS open_findings ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS total
      FROM compliance_findings finding
      WHERE finding.control_id = control.id
        AND finding.tenant_id = control.tenant_id
        AND finding.company_name = control.company_name
        AND finding.status IN ('OPEN', 'IN_ANALYSIS')
        AND finding.severity = 'CRITICAL'
    ) AS critical_findings ON TRUE
    WHERE control.tenant_id = ${tenantId}
 AND control.tenant_id = ${tenantId}
 AND control.company_name = ${companyName}
    ORDER BY control.created_at DESC
    LIMIT 160
  `;

  const [findingsSummary] = await prisma.$queryRaw<Array<{ open_total: number; critical_total: number }>>`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('OPEN', 'IN_ANALYSIS'))::int AS open_total,
      COUNT(*) FILTER (WHERE status IN ('OPEN', 'IN_ANALYSIS') AND severity = 'CRITICAL')::int AS critical_total
    FROM compliance_findings
    WHERE tenant_id = ${tenantId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
  `;

  const [pendingRecommendationsRow] = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(DISTINCT suggestion.menu_import_id)::int AS total
    FROM menu_import_adjustment_suggestions suggestion
 AND suggestion.tenant_id = ${tenantId}
      AND suggestion.company_name = ${companyName}
      AND suggestion.tenant_id = ${tenantId}
      AND NOT EXISTS (
        SELECT 1
        FROM menu_next_menu_decisions decision
        WHERE decision.company_name = suggestion.company_name
          AND decision.tenant_id = ${tenantId}
          AND decision.menu_import_id = suggestion.menu_import_id
      )
  `;

  const [pendingMenusRow] = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*)::int AS total
    FROM menu_pdf_imports menu_import
 AND menu_import.tenant_id = ${tenantId}
      AND menu_import.company_name = ${companyName}
      AND menu_import.tenant_id = ${tenantId}
      AND NOT EXISTS (
        SELECT 1
        FROM menu_next_menu_decisions decision
        WHERE decision.company_name = menu_import.company_name
          AND decision.tenant_id = ${tenantId}
          AND decision.menu_import_id = menu_import.id
      )
  `;

  const failedExecutionsRows = await prisma.$queryRaw<Array<{
    id: string;
    control_id: string;
    control_title: string;
    executed_at: Date;
    evidence_summary: string;
  }>>`
    SELECT
      execution.id,
      execution.control_id,
      control.title AS control_title,
      execution.executed_at,
      execution.evidence_summary
    FROM compliance_control_executions execution
    INNER JOIN compliance_controls control
      ON control.id = execution.control_id
     AND control.tenant_id = execution.tenant_id
     AND control.company_name = execution.company_name
    WHERE execution.tenant_id = ${tenantId}
 AND execution.tenant_id = ${tenantId}
 AND execution.company_name = ${companyName}
      AND execution.status = 'failed'
    ORDER BY execution.executed_at DESC
    LIMIT 8
  `;

  const openCriticalFindingsRows = await prisma.$queryRaw<Array<{
    id: string;
    control_id: string;
    control_title: string;
    severity: string;
    description: string;
    detected_at: Date;
  }>>`
    SELECT
      finding.id,
      finding.control_id,
      control.title AS control_title,
      finding.severity,
      finding.description,
      finding.detected_at
    FROM compliance_findings finding
    INNER JOIN compliance_controls control
      ON control.id = finding.control_id
     AND control.tenant_id = finding.tenant_id
     AND control.company_name = finding.company_name
    WHERE finding.tenant_id = ${tenantId}
 AND finding.tenant_id = ${tenantId}
 AND finding.company_name = ${companyName}
      AND finding.status IN ('OPEN', 'IN_ANALYSIS')
      AND finding.severity IN ('CRITICAL', 'HIGH')
    ORDER BY
      CASE finding.severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        ELSE 3
      END,
      finding.detected_at ASC
    LIMIT 10
  `;

  const pendingMenusDetails = await prisma.$queryRaw<Array<{
    id: string;
    file_name: string;
    unit_name: string;
    service_name: string;
    reference_date: Date;
    created_at: Date;
  }>>`
    SELECT
      menu_import.id,
      menu_import.file_name,
      menu_import.unit_name,
      menu_import.service_name,
      menu_import.reference_date,
      menu_import.created_at
    FROM menu_pdf_imports menu_import
 AND menu_import.tenant_id = ${tenantId}
      AND menu_import.company_name = ${companyName}
      AND menu_import.tenant_id = ${tenantId}
      AND NOT EXISTS (
        SELECT 1
        FROM menu_next_menu_decisions decision
        WHERE decision.company_name = menu_import.company_name
          AND decision.tenant_id = ${tenantId}
          AND decision.menu_import_id = menu_import.id
      )
    ORDER BY menu_import.created_at ASC
    LIMIT 8
  `;

  const frequencyThresholdDays = (frequency: string) => {
    if (frequency === 'DAILY' || frequency === 'PER_SHIFT') {
      return 1;
    }

    if (frequency === 'WEEKLY') {
      return 7;
    }

    if (frequency === 'MONTHLY') {
      return 30;
    }

    return 7;
  };

  const now = new Date();

  const pendingControls = controls.filter((item) => item.status === 'DRAFT' || item.status === 'PAUSED').length;

  const overdueControls = controls.filter((item) => {
    if (item.status !== 'ACTIVE' && item.status !== 'NON_COMPLIANT') {
      return false;
    }

    if (!item.last_execution_at) {
      return true;
    }

    const threshold = frequencyThresholdDays(item.frequency);
    const diffDays = Math.floor((now.getTime() - item.last_execution_at.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= threshold;
  });

  const dueTodayControls = controls.filter((item) => {
    if (item.status !== 'ACTIVE' && item.status !== 'NON_COMPLIANT') {
      return false;
    }

    if (!item.last_execution_at) {
      return true;
    }

    const threshold = frequencyThresholdDays(item.frequency);
    const diffDays = Math.floor((now.getTime() - item.last_execution_at.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays === threshold;
  }).slice(0, 8);

  const openFindings = findingsSummary?.open_total ?? 0;
  const criticalFindings = findingsSummary?.critical_total ?? 0;
  const pendingRecommendations = pendingRecommendationsRow?.total ?? 0;
  const pendingMenus = pendingMenusRow?.total ?? 0;
  const overdueExecutions = overdueControls.length;

  const attentionItems = [
    ...openCriticalFindingsRows.map((item) => ({
      id: `finding-${item.id}`,
      type: 'FINDING',
      severity: (String(item.severity).toUpperCase() === 'CRITICAL' ? 'CRITICAL' : 'HIGH') as 'CRITICAL' | 'HIGH',
      title: `${String(item.severity).toUpperCase() === 'CRITICAL' ? 'Finding crÃƒÂ­tico' : 'Finding alto'} em ${item.control_title}`,
      detail: item.description,
      ctaLabel: 'Ver controle',
      ctaPath: `/compliance/${item.control_id}`,
      occurredAt: item.detected_at.toISOString(),
    })),
    ...overdueControls.slice(0, 10).map((item) => ({
      id: `overdue-${item.id}`,
      type: 'OVERDUE_EXECUTION',
      severity: 'HIGH' as const,
      title: `ExecuÃƒÂ§ÃƒÂ£o atrasada: ${item.title}`,
      detail: `ResponsÃƒÂ¡vel ${item.responsible} Ã‚Â· FrequÃƒÂªncia ${String(item.frequency).toLowerCase()}`,
      ctaLabel: 'Registrar execuÃƒÂ§ÃƒÂ£o',
      ctaPath: `/compliance/${item.id}`,
      occurredAt: item.last_execution_at?.toISOString() ?? now.toISOString(),
    })),
    ...pendingMenusDetails.map((item) => ({
      id: `decision-${item.id}`,
      type: 'PENDING_MENU_DECISION',
      severity: 'MEDIUM' as const,
      title: `DecisÃƒÂ£o pendente: ${item.unit_name} / ${item.service_name}`,
      detail: `CardÃƒÂ¡pio ${item.file_name} sem decisÃƒÂ£o registrada.`,
      ctaLabel: 'Ir para cardÃƒÂ¡pios',
      ctaPath: '/menus',
      occurredAt: item.created_at.toISOString(),
    })),
    ...dueTodayControls.map((item) => ({
      id: `due-today-${item.id}`,
      type: 'DUE_TODAY',
      severity: 'MEDIUM' as const,
      title: `Controle vence hoje: ${item.title}`,
      detail: `ResponsÃƒÂ¡vel ${item.responsible} Ã‚Â· FrequÃƒÂªncia ${String(item.frequency).toLowerCase()}`,
      ctaLabel: 'Ver controle',
      ctaPath: `/compliance/${item.id}`,
      occurredAt: item.last_execution_at?.toISOString() ?? now.toISOString(),
    })),
  ];

  const severityRank: Record<string, number> = {
    CRITICAL: 3,
    HIGH: 2,
    MEDIUM: 1,
  };

  const sortedAttentionItems = attentionItems
    .sort((a, b) => {
      const bySeverity = (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0);

      if (bySeverity !== 0) {
        return bySeverity;
      }

      return new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
    })
    .slice(0, 14);

  const todayEvents = await prisma.$queryRaw<Array<{
    id: string;
    event_type: string;
    title: string;
    description: string;
    occurred_at: Date;
    cta_path: string;
  }>>`
    SELECT *
    FROM (
      SELECT
        execution.id,
        'execution_failed' AS event_type,
        CONCAT('Falha de execuÃƒÂ§ÃƒÂ£o: ', control.title) AS title,
        execution.evidence_summary AS description,
        execution.executed_at AS occurred_at,
        CONCAT('/compliance/', execution.control_id) AS cta_path
      FROM compliance_control_executions execution
      INNER JOIN compliance_controls control
        ON control.id = execution.control_id
       AND control.tenant_id = execution.tenant_id
       AND control.company_name = execution.company_name
      WHERE execution.tenant_id = ${tenantId}
 AND execution.tenant_id = ${tenantId}
 AND execution.company_name = ${companyName}
        AND execution.status = 'failed'
        AND execution.executed_at >= date_trunc('day', NOW())

      UNION ALL

      SELECT
        finding_event.id,
        'finding_status' AS event_type,
        CONCAT('Finding ', finding_event.next_status, ': ', control.title) AS title,
        finding_event.description,
        finding_event.created_at AS occurred_at,
        CONCAT('/compliance/', finding.control_id) AS cta_path
      FROM compliance_finding_events finding_event
      INNER JOIN compliance_findings finding
        ON finding.id = finding_event.finding_id
       AND finding.tenant_id = finding_event.tenant_id
       AND finding.company_name = finding_event.company_name
      INNER JOIN compliance_controls control
        ON control.id = finding.control_id
       AND control.tenant_id = finding.tenant_id
       AND control.company_name = finding.company_name
      WHERE finding_event.tenant_id = ${tenantId}
 AND finding_event.tenant_id = ${tenantId}
 AND finding_event.company_name = ${companyName}
        AND finding_event.created_at >= date_trunc('day', NOW())

      UNION ALL

      SELECT
        decision.id,
        'menu_decision' AS event_type,
        CONCAT('DecisÃƒÂ£o registrada: ', decision.decision_status) AS title,
        decision.justification AS description,
        decision.created_at AS occurred_at,
        '/menus' AS cta_path
      FROM menu_next_menu_decisions decision
      WHERE decision.tenant_id = ${tenantId}
 AND decision.tenant_id = ${tenantId}
 AND decision.company_name = ${companyName}
        AND decision.created_at >= date_trunc('day', NOW())
    ) merged
    ORDER BY occurred_at DESC
    LIMIT 12
  `;

  const criticality = criticalFindings > 0
    ? 'CRITICAL'
    : overdueExecutions >= 6 || openFindings >= 10
      ? 'HIGH'
      : overdueExecutions > 0 || pendingMenus > 0 || openFindings > 0
        ? 'MEDIUM'
        : 'LOW';

  return reply.code(200).send({
    status: 'ok',
    criticality,
    pendingControls,
    overdueExecutions,
    openFindings,
    criticalFindings,
    pendingRecommendations,
    pendingMenus,
    attentionItems: sortedAttentionItems,
    todayEvents: todayEvents.map((item) => ({
      id: item.id,
      type: item.event_type,
      title: item.title,
      description: item.description,
      occurredAt: item.occurred_at.toISOString(),
      ctaPath: item.cta_path,
    })),
  });
});

app.get('/dashboard/summary', { preHandler: authenticate }, async (request, reply) => {
  if (!prisma) {
    return reply.code(503).send({
      status: 'error',
      message: apiMessage.health.dbUnavailable,
    });
  }

  const companyName = getCompanyFromJwt(request);
  const tenantId = getTenantIdFromJwt(request);

  await ensureDomainTables();

  const [contractsCount] = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*)::int AS total
    FROM contracts
    WHERE tenant_id = ${tenantId}
      AND company_name = ${companyName}
  `;

  const [rulesApprovedCount] = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*)::int AS total
    FROM extracted_rules
    WHERE tenant_id = ${tenantId}
      AND company_name = ${companyName}
      AND status = 'approved'
  `;

  const [rulesPendingCount] = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*)::int AS total
    FROM extracted_rules
    WHERE tenant_id = ${tenantId}
      AND company_name = ${companyName}
      AND status IN ('identified', 'under_review')
  `;

  const [controlsSummary] = await prisma.$queryRaw<Array<{
    active_total: number;
    pending_total: number;
    paused_total: number;
    non_compliant_total: number;
    completed_total: number;
  }>>`
    SELECT
      COUNT(*) FILTER (WHERE UPPER(status) = 'ACTIVE')::int AS active_total,
      COUNT(*) FILTER (WHERE UPPER(status) IN ('DRAFT', 'PAUSED'))::int AS pending_total,
      COUNT(*) FILTER (WHERE UPPER(status) = 'PAUSED')::int AS paused_total,
      COUNT(*) FILTER (WHERE UPPER(status) = 'NON_COMPLIANT')::int AS non_compliant_total,
      COUNT(*) FILTER (WHERE UPPER(status) = 'COMPLETED')::int AS completed_total
    FROM compliance_controls
    WHERE tenant_id = ${tenantId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
  `;

  const [executionSummary] = await prisma.$queryRaw<Array<{
    completed_total: number;
    failed_total: number;
  }>>`
    SELECT
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_total,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_total
    FROM compliance_control_executions
    WHERE tenant_id = ${tenantId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
  `;

  const completedExecutions = executionSummary?.completed_total ?? 0;
  const failedExecutions = executionSummary?.failed_total ?? 0;
  const totalMeasuredExecutions = completedExecutions + failedExecutions;
  const complianceRate = totalMeasuredExecutions > 0
    ? Number(((completedExecutions / totalMeasuredExecutions) * 100).toFixed(1))
    : null;

  const recentContracts = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    status: string;
    created_at: Date;
  }>>`
    SELECT id, title, status, created_at
    FROM contracts
    WHERE tenant_id = ${tenantId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
    ORDER BY created_at DESC
    LIMIT 5
  `;

  return {
    status: 'ok',
    summary: {
      contractsCount: contractsCount?.total ?? 0,
      rulesApprovedCount: rulesApprovedCount?.total ?? 0,
      rulesPendingCount: rulesPendingCount?.total ?? 0,
      activeControlsCount: controlsSummary?.active_total ?? 0,
      pendingControlsCount: controlsSummary?.pending_total ?? 0,
      pausedControlsCount: controlsSummary?.paused_total ?? 0,
      nonCompliantControlsCount: controlsSummary?.non_compliant_total ?? 0,
      completedControlsCount: controlsSummary?.completed_total ?? 0,
      failedExecutionsCount: failedExecutions,
      complianceRate,
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

if (process.env.NODE_ENV !== 'test' && process.env.MENUCARE_DISABLE_LISTEN !== '1') {
  const port = Number(process.env.API_PORT ?? 3001);
  const host = process.env.API_HOST ?? '0.0.0.0';

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
