import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { extractRulesFromPdf, type Deps } from './service.js';

const originalFetch = globalThis.fetch;
const originalOllamaTimeoutMs = process.env.OLLAMA_TIMEOUT_MS;
const originalOllamaMaxSegments = process.env.OLLAMA_MAX_SEGMENTS;
const originalEvidenceFallbackEnabled = process.env.OLLAMA_EVIDENCE_FALLBACK_ENABLED;

let fakePdfText = '';

class FakePDFParse {
  constructor(_input: { data: Buffer }) {}

  async getText() {
    return { text: fakePdfText };
  }

  async destroy() {}
}

type SqlWrite = {
  sql: string;
  params: unknown[];
};

type Captures = {
  prompts: string[];
  writes: SqlWrite[];
  preparationEvents: Array<{ sourceKind: string; data: unknown }>;
  operations: string[];
  nextId: number;
};

const createCaptures = (): Captures => ({
  prompts: [],
  writes: [],
  preparationEvents: [],
  operations: [],
  nextId: 1,
});

const sqlIncludes = (write: SqlWrite, value: string) => write.sql.replace(/\s+/g, ' ').includes(value);

const ruleWrites = (captures: Captures) => captures.writes
  .filter((write) => sqlIncludes(write, 'INSERT INTO extracted_rules'));

const eventWrites = (captures: Captures) => captures.writes
  .filter((write) => sqlIncludes(write, 'INSERT INTO rule_validation_events'));

const pageWrites = (captures: Captures) => captures.writes
  .filter((write) => sqlIncludes(write, 'INSERT INTO contract_pages'));

const blockWrites = (captures: Captures) => captures.writes
  .filter((write) => sqlIncludes(write, 'INSERT INTO contract_blocks'));

const blockDeleteWrites = (captures: Captures) => captures.writes
  .filter((write) => sqlIncludes(write, 'DELETE FROM contract_blocks'));

const pageDeleteWrites = (captures: Captures) => captures.writes
  .filter((write) => sqlIncludes(write, 'DELETE FROM contract_pages'));

const diagnosticsOf = (captures: Captures) => captures.preparationEvents[0]?.data as {
  discardedBySchema?: number;
  discardedRules?: Array<{ reason: string; title?: string }>;
  rulesWithEvidence?: number;
};

const buildDeps = (captures: Captures): Deps => ({
  apiMessage: {
    auth: { invalidCredentials: 'Credenciais invalidas.' },
    health: { dbUnavailable: 'Banco indisponivel.' },
  },
  authenticate: async () => undefined,
  contractSchema: { safeParse: () => ({ success: true, data: { title: 'Contrato', sourceType: 'contract' } }) },
  prisma: {
    $queryRaw: async <T>() => [{ id: 'contract-1' }] as T,
    $executeRaw: async (query, ...params) => {
      captures.writes.push({ sql: query.join('?'), params });
      captures.operations.push(query.join(' ').replace(/\s+/g, ' ').trim());
      return 1;
    },
    $transaction: async (callback) => callback({
      $queryRaw: async <T>() => [{ id: 'contract-1' }] as T,
      $executeRaw: async (query, ...params) => {
        captures.writes.push({ sql: query.join('?'), params });
        captures.operations.push(query.join(' ').replace(/\s+/g, ' ').trim());
        return 1;
      },
    }),
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
  randomUUID: () => `id-${captures.nextId++}`,
  ensureDomainTables: async () => undefined,
  PDFParse: FakePDFParse,
  recordAiPreparationEvent: async (payload) => {
    captures.preparationEvents.push({ sourceKind: payload.sourceKind, data: payload.data });
  },
  z: {},
});

const runExtraction = async (
  captures: Captures,
  options: {
    pdfText: string;
    rules?: Array<Record<string, unknown>>;
    knownSites?: Array<{ id: string; name: string }>;
  },
) => {
  process.env.OLLAMA_TIMEOUT_MS = '500';
  process.env.OLLAMA_MAX_SEGMENTS = '1';
  process.env.OLLAMA_EVIDENCE_FALLBACK_ENABLED = 'false';
  fakePdfText = options.pdfText;

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(init?.body as string) as { prompt: string };
    captures.prompts.push(body.prompt);
    captures.operations.push('FETCH_OLLAMA');

    return new Response(JSON.stringify({
      response: JSON.stringify({ rules: options.rules ?? [] }),
    }), { status: 200 });
  };

  return extractRulesFromPdf(
    buildDeps(captures),
    'contract-1',
    Buffer.from('fake-pdf'),
    'OneSubSea',
    { id: 'site-sjp', tenantId: 'tenant-1', name: 'Sao Jose dos Pinhais' },
    options.knownSites ?? [
      { id: 'site-sjp', name: 'Sao Jose dos Pinhais' },
      { id: 'site-taubate', name: 'Taubate' },
      { id: 'site-macae', name: 'Macae' },
      { id: 'site-rio', name: 'Rio das Ostras' },
    ],
  );
};

const validRule = (overrides: Partial<Record<string, unknown>> = {}) => ({
  title: 'Incidencia de carne bovina no buffet',
  description: 'Proteina carne bovina deve aparecer no cardapio do buffet livre mensal.',
  rule_type: 'incidencia_cardapio',
  category: 'PROTEIN',
  periodicity: 'MONTHLY',
  quantity: 14,
  unitMeasure: 'incidences',
  calculation_basis: '22 dias uteis',
  applicability: 'site_group',
  detectedUnits: ['Sao Jose dos Pinhais', 'Taubate'],
  originGroupText: 'Sao Jose dos Pinhais e Taubate',
  sourceItem: '19',
  sourcePage: 1,
  sourceExcerpt: 'Sao Jose dos Pinhais e Taubate: carne bovina no buffet livre 14 incidencias mensais.',
  evidenceConfidence: 0.91,
  ...overrides,
});

describe('contract rule extraction', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.OLLAMA_TIMEOUT_MS = originalOllamaTimeoutMs;
    process.env.OLLAMA_MAX_SEGMENTS = originalOllamaMaxSegments;
    process.env.OLLAMA_EVIDENCE_FALLBACK_ENABLED = originalEvidenceFallbackEnabled;
    fakePdfText = '';
  });

  it('ignores COMMERCIAL blocks without calling AI', async () => {
    const captures = createCaptures();

    const result = await runExtraction(captures, {
      pdfText: 'Proposta comercial. Preco mensal, reajuste, faturamento e nota fiscal.',
      rules: [validRule()],
    });

    assert.equal(result.statusCode, 200);
    assert.equal(captures.prompts.length, 0);
    assert.equal(ruleWrites(captures).length, 0);
    assert.equal(pageWrites(captures).length, 1);
    assert.equal(blockWrites(captures).length, 1);
    assert.equal(blockWrites(captures)[0].params[14], false);
    assert.equal(blockWrites(captures)[0].params[15], 'irrelevant_block_type:COMMERCIAL');
  });

  it('ignores ADMINISTRATIVE blocks without calling AI', async () => {
    const captures = createCaptures();

    const result = await runExtraction(captures, {
      pdfText: 'Documentacao administrativa, contrato social, certidao, cadastro e penalidade.',
      rules: [validRule()],
    });

    assert.equal(result.statusCode, 200);
    assert.equal(captures.prompts.length, 0);
    assert.equal(ruleWrites(captures).length, 0);
    assert.equal(blockWrites(captures).length, 1);
    assert.equal(blockWrites(captures)[0].params[14], false);
    assert.equal(blockWrites(captures)[0].params[15], 'irrelevant_block_type:ADMINISTRATIVE');
  });

  it('ignores generic HSE blocks without calling AI', async () => {
    const captures = createCaptures();

    const result = await runExtraction(captures, {
      pdfText: 'HSE e SSMA: uso obrigatorio de EPI, treinamentos de seguranca do trabalho e plano ambiental.',
      rules: [validRule()],
    });

    assert.equal(result.statusCode, 200);
    assert.equal(captures.prompts.length, 0);
    assert.equal(ruleWrites(captures).length, 0);
    assert.equal(blockWrites(captures).length, 1);
    assert.equal(blockWrites(captures)[0].params[14], false);
    assert.equal(blockWrites(captures)[0].params[15], 'irrelevant_block_type:HSE');
  });

  it('ignores generic TABLE_KPI_SLA blocks without calling AI', async () => {
    const captures = createCaptures();

    const result = await runExtraction(captures, {
      pdfText: 'Tabela KPI SLA. Indicador de envio de relatorio mensal e tempo de resposta administrativo.',
      rules: [validRule()],
    });

    assert.equal(result.statusCode, 200);
    assert.equal(captures.prompts.length, 0);
    assert.equal(ruleWrites(captures).length, 0);
    assert.equal(blockWrites(captures).length, 1);
    assert.equal(blockWrites(captures)[0].params[14], false);
    assert.equal(blockWrites(captures)[0].params[15], 'generic_kpi_sla_without_direct_food_service_impact');
  });

  it('allows TABLE_KPI_SLA only with direct food-service impact', async () => {
    const captures = createCaptures();

    const result = await runExtraction(captures, {
      pdfText: 'Tabela KPI SLA. Parada de rampa por atraso de producao na distribuicao de refeicao para Sao Jose dos Pinhais.',
      rules: [validRule({
        title: 'Parada de rampa por atraso de producao',
        description: 'Parada de rampa por atraso de producao impacta a distribuicao de refeicao.',
        category: 'UNIT_SPECIFIC_RULE',
        periodicity: 'PER_SERVICE',
        quantity: null,
        unitMeasure: null,
        applicability: 'direct_site',
        detectedUnits: ['Sao Jose dos Pinhais'],
        originGroupText: null,
        sourceItem: 'KPI SLA',
        sourceExcerpt: 'Parada de rampa por atraso de producao na distribuicao de refeicao para Sao Jose dos Pinhais.',
      })],
    });

    assert.equal(result.statusCode, 201);
    assert.match(captures.prompts[0] ?? '', /Bloco classificado: TABLE_KPI_SLA/);
    assert.equal(ruleWrites(captures).length, 1);
    assert.equal(blockWrites(captures).length, 1);
    assert.equal(blockWrites(captures)[0].params[14], true);
  });

  it('accepts TABLE_MENU_INCIDENCE with literal evidence and persists pending rule', async () => {
    const captures = createCaptures();

    const result = await runExtraction(captures, {
      pdfText: [
        'Item 19 - Tabela de incidencia de Proteinas - Buffet oferta livre.',
        'Sao Jose dos Pinhais e Taubate: carne bovina no buffet livre 14 incidencias mensais.',
        'Rio das Ostras e Macae: peixe 8 incidencias mensais.',
      ].join('\n'),
      rules: [
        validRule(),
        validRule({
          title: 'Incidencia de peixe no buffet',
          description: 'Proteina peixe deve aparecer no cardapio do buffet livre mensal.',
          quantity: 8,
          detectedUnits: ['Rio das Ostras', 'Macae'],
          originGroupText: 'Rio das Ostras e Macae',
          sourceExcerpt: 'Rio das Ostras e Macae: peixe 8 incidencias mensais.',
        }),
      ],
    });

    const rules = ruleWrites(captures);
    const events = eventWrites(captures);

    assert.equal(result.statusCode, 201);
    assert.equal(pageWrites(captures).length, 1);
    assert.equal(pageWrites(captures)[0].params[1], 'tenant-1');
    assert.equal(pageWrites(captures)[0].params[2], 'site-sjp');
    assert.equal(pageWrites(captures)[0].params[3], 'contract-1');
    assert.equal(pageWrites(captures)[0].params[4], 1);
    assert.equal(blockWrites(captures).length, 1);
    assert.equal(blockWrites(captures)[0].params[1], 'tenant-1');
    assert.equal(blockWrites(captures)[0].params[2], 'site-sjp');
    assert.equal(blockWrites(captures)[0].params[3], 'contract-1');
    assert.equal(blockWrites(captures)[0].params[5], 1);
    assert.equal(blockWrites(captures)[0].params[6], 1);
    assert.equal(blockWrites(captures)[0].params[7], 'TABLE_MENU_INCIDENCE');
    assert.equal(blockWrites(captures)[0].params[14], true);
    assert.ok(
      captures.operations.findIndex((operation) => operation.includes('INSERT INTO contract_blocks')) <
        captures.operations.findIndex((operation) => operation === 'FETCH_OLLAMA'),
    );
    assert.match(captures.prompts[0] ?? '', /Cliente: OneSubSea/);
    assert.match(captures.prompts[0] ?? '', /Unidade selecionada: Sao Jose dos Pinhais/);
    assert.match(captures.prompts[0] ?? '', /Bloco classificado: TABLE_MENU_INCIDENCE/);
    assert.doesNotMatch(captures.prompts[0] ?? '', /"incidence"/);
    assert.equal(rules.length, 1);
    assert.equal(events.length, 1);
    assert.equal(rules[0].params[1], 'tenant-1');
    assert.equal(rules[0].params[2], 'site-sjp');
    assert.equal(rules[0].params[4], 'contract-1');
    assert.equal(rules[0].params[9], 'MONTHLY');
    assert.equal(rules[0].params[10], 14);
    assert.equal(rules[0].params[11], 'incidences');
    assert.equal(rules[0].params[13], 'site_group');
    assert.equal(rules[0].params[15], JSON.stringify(['Sao Jose dos Pinhais', 'Taubate']));
    assert.equal(rules[0].params[19], blockWrites(captures)[0].params[0]);
    assert.equal(rules[0].params[21], 'pending');
    assert.equal(events[0].params[5], 'pending');
    assert.equal(events[0].params[6], 'pending');

    const diagnostics = diagnosticsOf(captures);
    assert.ok(diagnostics.discardedRules?.some((rule) => rule.reason === 'not_explicitly_applicable_to_site'));
  });

  it('accepts MENU_COMPOSITION with literal evidence', async () => {
    const captures = createCaptures();

    const result = await runExtraction(captures, {
      pdfText: 'Item 23 - Composicao do cardapio: buffet livre com arroz, feijao, salada, guarnicao e sobremesa para todas as unidades.',
      rules: [validRule({
        title: 'Composicao do buffet livre',
        description: 'Buffet livre deve conter arroz, feijao, salada, guarnicao e sobremesa.',
        category: 'MENU_COMPOSITION',
        periodicity: 'DAILY',
        quantity: null,
        unitMeasure: null,
        applicability: 'general',
        detectedUnits: [],
        originGroupText: 'todas as unidades',
        sourceItem: '23',
        sourceExcerpt: 'buffet livre com arroz, feijao, salada, guarnicao e sobremesa para todas as unidades.',
      })],
    });

    assert.equal(result.statusCode, 201);
    assert.match(captures.prompts[0] ?? '', /Bloco classificado: MENU_COMPOSITION/);
    assert.equal(ruleWrites(captures).length, 1);
    assert.equal(ruleWrites(captures)[0].params[19], blockWrites(captures)[0].params[0]);
  });

  it('cleans previous pages and blocks for the same tenant and contract before reprocessing', async () => {
    const captures = createCaptures();

    await runExtraction(captures, {
      pdfText: 'Item 19 - Sao Jose dos Pinhais: carne bovina no buffet livre 14 incidencias mensais.',
      rules: [validRule({
        detectedUnits: ['Sao Jose dos Pinhais'],
        originGroupText: null,
        sourceExcerpt: 'Sao Jose dos Pinhais: carne bovina no buffet livre 14 incidencias mensais.',
      })],
    });

    await runExtraction(captures, {
      pdfText: 'Item 23 - Composicao do cardapio: buffet livre com arroz e feijao para Sao Jose dos Pinhais.',
      rules: [validRule({
        title: 'Composicao do buffet',
        description: 'Buffet livre deve conter arroz e feijao.',
        category: 'MENU_COMPOSITION',
        periodicity: 'DAILY',
        quantity: null,
        unitMeasure: null,
        applicability: 'direct_site',
        detectedUnits: ['Sao Jose dos Pinhais'],
        originGroupText: null,
        sourceItem: '23',
        sourceExcerpt: 'buffet livre com arroz e feijao para Sao Jose dos Pinhais.',
      })],
    });

    assert.equal(blockDeleteWrites(captures).length, 2);
    assert.equal(pageDeleteWrites(captures).length, 2);
    assert.deepEqual(blockDeleteWrites(captures)[1].params, ['tenant-1', 'contract-1']);
    assert.deepEqual(pageDeleteWrites(captures)[1].params, ['tenant-1', 'contract-1']);
    assert.equal(pageWrites(captures).length, 2);
    assert.equal(blockWrites(captures).length, 2);
  });

  it('does not persist rules without sourceExcerpt', async () => {
    const captures = createCaptures();

    const result = await runExtraction(captures, {
      pdfText: 'Item 19 - Sao Jose dos Pinhais: carne bovina no buffet livre 14 incidencias mensais.',
      rules: [validRule({ sourceExcerpt: undefined })],
    });

    assert.equal(result.statusCode, 200);
    assert.equal(ruleWrites(captures).length, 0);
    assert.equal(blockWrites(captures).length, 1);
    assert.ok(diagnosticsOf(captures).discardedRules?.some((rule) => rule.reason === 'missing_evidence'));
  });

  it('does not persist rules without sourcePage', async () => {
    const captures = createCaptures();

    const result = await runExtraction(captures, {
      pdfText: 'Item 19 - Sao Jose dos Pinhais e Taubate: carne bovina no buffet livre 14 incidencias mensais.',
      rules: [validRule({ sourcePage: undefined })],
    });

    assert.equal(result.statusCode, 200);
    assert.equal(ruleWrites(captures).length, 0);
    assert.ok(diagnosticsOf(captures).discardedRules?.some((rule) => rule.reason === 'missing_page'));
  });

  it('does not persist rules without sourceItem', async () => {
    const captures = createCaptures();

    const result = await runExtraction(captures, {
      pdfText: 'Item 19 - Sao Jose dos Pinhais e Taubate: carne bovina no buffet livre 14 incidencias mensais.',
      rules: [validRule({ sourceItem: undefined })],
    });

    assert.equal(result.statusCode, 200);
    assert.equal(ruleWrites(captures).length, 0);
    assert.ok(diagnosticsOf(captures).discardedRules?.some((rule) => rule.reason === 'missing_section'));
  });

  it('does not persist rules with invented non-literal evidence', async () => {
    const captures = createCaptures();

    const result = await runExtraction(captures, {
      pdfText: 'Item 19 - Sao Jose dos Pinhais: carne bovina no buffet livre 14 incidencias mensais.',
      rules: [validRule({
        detectedUnits: ['Sao Jose dos Pinhais'],
        originGroupText: null,
        sourceExcerpt: 'Sao Jose dos Pinhais: lagosta diaria obrigatoria.',
      })],
    });

    assert.equal(result.statusCode, 200);
    assert.equal(ruleWrites(captures).length, 0);
    assert.ok(diagnosticsOf(captures).discardedRules?.some((rule) => rule.reason === 'non_literal_excerpt'));
  });

  it('does not persist rules from another unit group', async () => {
    const captures = createCaptures();

    const result = await runExtraction(captures, {
      pdfText: 'Item 19 - Rio das Ostras e Macae: peixe 8 incidencias mensais no buffet.',
      rules: [validRule({
        title: 'Incidencia de peixe no buffet',
        description: 'Proteina peixe deve aparecer no cardapio mensal.',
        quantity: 8,
        detectedUnits: ['Rio das Ostras', 'Macae'],
        originGroupText: 'Rio das Ostras e Macae',
        sourceExcerpt: 'Rio das Ostras e Macae: peixe 8 incidencias mensais no buffet.',
      })],
    });

    assert.equal(result.statusCode, 200);
    assert.equal(ruleWrites(captures).length, 0);
    assert.equal(captures.prompts.length, 0);
  });

  it('discards categories outside the allowed list', async () => {
    const captures = createCaptures();

    const result = await runExtraction(captures, {
      pdfText: 'Item 19 - Sao Jose dos Pinhais: carne bovina no buffet livre 14 incidencias mensais.',
      rules: [validRule({ category: 'LEGAL' })],
    });

    assert.equal(result.statusCode, 200);
    assert.equal(ruleWrites(captures).length, 0);
    assert.ok((diagnosticsOf(captures).discardedBySchema ?? 0) >= 1);
  });

  it('discards periodicities outside the allowed list', async () => {
    const captures = createCaptures();

    const result = await runExtraction(captures, {
      pdfText: 'Item 19 - Sao Jose dos Pinhais: carne bovina no buffet livre 14 incidencias mensais.',
      rules: [validRule({ periodicity: 'YEARLY' })],
    });

    assert.equal(result.statusCode, 200);
    assert.equal(ruleWrites(captures).length, 0);
    assert.ok((diagnosticsOf(captures).discardedBySchema ?? 0) >= 1);
  });
});
