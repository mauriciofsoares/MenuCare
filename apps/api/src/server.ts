import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';

const app = Fastify({ logger: true });

type PrismaLike = {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
};

let prisma: PrismaLike | null = null;

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

app.get('/health', async () => {
  return {
    status: 'ok',
    service: 'menucare-api',
    timestamp: new Date().toISOString(),
  };
});

app.get('/health/db', async (_request, reply) => {
  if (!prisma) {
    return reply.code(503).send({
      status: 'warning',
      database: 'prisma-client-not-generated',
      message: 'Rode prisma:generate e configure o PostgreSQL para ativar o check de banco.',
    });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      database: 'connected',
    };
  } catch {
    return reply.code(500).send({
      status: 'error',
      database: 'disconnected',
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
