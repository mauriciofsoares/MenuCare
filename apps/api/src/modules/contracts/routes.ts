import type { FastifyInstance } from 'fastify';
import { createContractsService, type Deps } from './service.js';

export const registerContractsRoutes = (app: FastifyInstance, deps: Deps) => {
  const service = createContractsService(deps);
  const { apiMessage, authenticate, contractSchema, z } = service;

app.post('/contracts', { preHandler: authenticate }, async (request, reply) => {
  const contentType = String(request.headers['content-type'] ?? '');

  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return reply.code(400).send({
      status: 'error',
      message: 'Envie os campos title, sourceType e file em multipart/form-data.',
    });
  }

  const parts = request.parts();
  let title = '';
  let sourceType = '';
  let fileBuffer: Buffer | null = null;

  for await (const part of parts) {
    if (part.type === 'file' && part.fieldname === 'file') {
      if (part.mimetype !== 'application/pdf') {
        return reply.code(400).send({
          status: 'error',
          message: 'Formato invalido. Envie um arquivo PDF.',
        });
      }

      fileBuffer = await part.toBuffer();
      continue;
    }

    if (part.type === 'field') {
      if (part.fieldname === 'title') {
        title = String(part.value ?? '');
      }

      if (part.fieldname === 'sourceType') {
        sourceType = String(part.value ?? '');
      }
    }
  }

  const parsed = contractSchema.safeParse({ title, sourceType });

  if (!parsed.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  const result = await service.createContract(request, {
    title: parsed.data.title,
    sourceType: parsed.data.sourceType,
    fileBuffer,
  });
  return reply.code(result.statusCode).send(result.body);
});

app.get('/contracts', { preHandler: authenticate }, async (request, reply) => {
  const query = z
    .object({ limit: z.coerce.number().int().min(1).max(50).default(20) })
    .safeParse(request.query);

  const limit = query.success ? query.data.limit : 20;

  const result = await service.listContracts(request, limit);
  return reply.code(result.statusCode).send(result.body);
});

app.get('/contracts/:id', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = z.object({ id: z.string().min(1) }).safeParse(request.params);

  if (!parsedParams.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  const result = await service.getContractById(request, parsedParams.data.id);
  return reply.code(result.statusCode).send(result.body);
});

app.patch('/contracts/:id/status', { preHandler: authenticate }, async (request, reply) => {
  const parsedParams = z.object({ id: z.string().min(1) }).safeParse(request.params);
  const parsedBody = z.object({
    status: z.enum(['active', 'inactive']),
    inactivationReason: z.string().trim().min(3).max(500).optional(),
  }).safeParse(request.body);

  if (!parsedParams.success || !parsedBody.success) {
    return reply.code(400).send({
      status: 'error',
      message: apiMessage.auth.invalidCredentials,
    });
  }

  const result = await service.updateContractLifecycleStatus(request, {
    contractId: parsedParams.data.id,
    status: parsedBody.data.status,
    inactivationReason: parsedBody.data.inactivationReason,
  });

  return reply.code(result.statusCode).send(result.body);
});
};