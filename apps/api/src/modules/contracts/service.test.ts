import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { extractRulesFromPdf, type Deps } from './service.js';

const originalFetch = globalThis.fetch;
const originalOllamaTimeoutMs = process.env.OLLAMA_TIMEOUT_MS;
const originalOllamaMaxSegments = process.env.OLLAMA_MAX_SEGMENTS;
const originalEvidenceFallbackEnabled = process.env.OLLAMA_EVIDENCE_FALLBACK_ENABLED;

class FakePDFParse {
  constructor(_input: { data: Buffer }) {}

  async getText() {
    return {
      text: [
        'Item 19 - Tabela de incidencia de Proteinas - Buffet oferta livre.',
        'Sao Jose dos Pinhais e Taubate: carne bovina no buffet livre 14 incidencias mensais.',
        'Rio das Ostras e Macae: peixe 8 incidencias mensais.',
      ].join('\n'),
    };
  }

  async destroy() {}
}

const buildDeps = (captures: { prompts: string[]; inserts: unknown[][] }): Deps => ({
  apiMessage: {
    auth: { invalidCredentials: 'Credenciais invalidas.' },
    health: { dbUnavailable: 'Banco indisponivel.' },
  },
  authenticate: async () => undefined,
  contractSchema: { safeParse: () => ({ success: true, data: { title: 'Contrato', sourceType: 'contract' } }) },
  prisma: {
    $queryRaw: async <T>() => [{ id: 'contract-1' }] as T,
    $executeRaw: async (_query, ...params) => {
      captures.inserts.push(params);
      return 1;
    },
  },
  getCompanyFromJwt: () => 'OneSubSea',
  getTenantIdFromJwt: () => 'tenant-1',
  getUserFromJwt: () => ({ id: 'user-1', name: 'Tester' }),
  resolveAuthorizedSite: async () => ({
    allowed: true,
    site: {
      id: 'site-sjp',
      tenantId: 'tenant-1',
      name: 'Sao Jose dos Pinhais',
      city: null,
      state: null,
      role: 'nutritionist',
    },
  }),
  listAuthorizedSites: async () => [],
  randomUUID: () => `rule-${captures.inserts.length + 1}`,
  ensureDomainTables: async () => undefined,
  PDFParse: FakePDFParse,
  recordAiPreparationEvent: async () => undefined,
  z: {},
});

describe('contract rule extraction', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.OLLAMA_TIMEOUT_MS = originalOllamaTimeoutMs;
    process.env.OLLAMA_MAX_SEGMENTS = originalOllamaMaxSegments;
    process.env.OLLAMA_EVIDENCE_FALLBACK_ENABLED = originalEvidenceFallbackEnabled;
  });

  it('sends selected unit context to AI and persists only explicitly applicable group rules', async () => {
    process.env.OLLAMA_TIMEOUT_MS = '500';
    process.env.OLLAMA_MAX_SEGMENTS = '1';
    process.env.OLLAMA_EVIDENCE_FALLBACK_ENABLED = 'false';

    const captures: { prompts: string[]; inserts: unknown[][] } = { prompts: [], inserts: [] };

    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(init?.body as string) as { prompt: string };
      captures.prompts.push(body.prompt);

      return new Response(JSON.stringify({
        response: JSON.stringify({
          rules: [
            {
              title: 'Incidencia de carne bovina no buffet',
              description: 'Proteina carne bovina deve aparecer no buffet livre mensal.',
              rule_type: 'incidencia_cardapio',
              category: 'proteina',
              periodicity: 'mensal',
              quantity: 14,
              unit_measure: 'incidencias',
              calculation_basis: '22 dias uteis',
              applicability: 'site_group',
              detectedUnits: ['Sao Jose dos Pinhais', 'Taubate'],
              originGroupText: 'Sao Jose dos Pinhais e Taubate',
              sourceItem: '19',
              sourcePage: 21,
              sourceExcerpt: 'Sao Jose dos Pinhais e Taubate: carne bovina no buffet livre 14 incidencias mensais.',
            },
            {
              title: 'Incidencia de peixe no buffet',
              description: 'Proteina peixe deve aparecer no buffet livre mensal.',
              rule_type: 'incidencia_cardapio',
              category: 'proteina',
              periodicity: 'mensal',
              quantity: 8,
              unit_measure: 'incidencias',
              calculation_basis: '22 dias uteis',
              applicability: 'site_group',
              detectedUnits: ['Rio das Ostras', 'Macae'],
              originGroupText: 'Rio das Ostras e Macae',
              sourceItem: '19',
              sourcePage: 21,
              sourceExcerpt: 'Rio das Ostras e Macae: peixe 8 incidencias mensais.',
            },
          ],
        }),
      }), { status: 200 });
    };

    const result = await extractRulesFromPdf(
      buildDeps(captures),
      'contract-1',
      Buffer.from('fake-pdf'),
      'OneSubSea',
      { id: 'site-sjp', tenantId: 'tenant-1', name: 'Sao Jose dos Pinhais' },
      [
        { id: 'site-sjp', name: 'Sao Jose dos Pinhais' },
        { id: 'site-macae', name: 'Macae' },
      ],
    );

    assert.equal(result.statusCode, 201);
    assert.equal(captures.inserts.length, 1);
    assert.match(captures.prompts[0] ?? '', /Cliente: OneSubSea/);
    assert.match(captures.prompts[0] ?? '', /Unidade selecionada: Sao Jose dos Pinhais/);
    assert.match(captures.prompts[0] ?? '', /Ignore clausulas juridicas gerais/);
    assert.equal(captures.inserts[0]?.[0], 'rule-1');
    assert.equal(captures.inserts[0]?.[1], 'tenant-1');
    assert.equal(captures.inserts[0]?.[2], 'site-sjp');
    assert.equal(captures.inserts[0]?.[13], 'site_group');
    assert.equal(captures.inserts[0]?.[15], JSON.stringify(['Sao Jose dos Pinhais', 'Taubate']));
  });
});
