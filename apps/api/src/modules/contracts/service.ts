import { createContractsRepository } from './repository.js';
import type { FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';

type SafeParseSuccess<T> = { success: true; data: T };
type SafeParseFailure = { success: false };
type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure;

type SchemaLike<T> = {
  safeParse: (input: unknown) => SafeParseResult<T>;
};

type RouteResult = {
  statusCode: number;
  body: unknown;
};

type ExtractedRule = {
  title: string;
  description: string;
  category: string;
  ruleType: string;
  periodicity: string | null;
  quantity: number | null;
  unitMeasure: string | null;
  calculationBasis: string | null;
  applicability: 'general' | 'direct_site' | 'site_group';
  originGroupText: string | null;
  detectedUnits: string[];
  sourceItem: string | null;
  sourceExcerpt: string | null;
  sourcePage: number | null;
  evidenceConfidence: number | null;
};

type RuleWithEvidence = ExtractedRule & {
  sourceExcerpt: string | null;
  sourcePage: number | null;
  evidenceConfidence: number | null;
};

export interface Deps {
  apiMessage: {
    auth: {
      invalidCredentials: string;
    };
    health: {
      dbUnavailable: string;
    };
  };
  authenticate: any;
  contractSchema: SchemaLike<{ title: string; sourceType: string; siteId?: string }>;
  prisma: {
    $queryRaw: <T>(query: TemplateStringsArray, ...params: unknown[]) => Promise<T>;
    $executeRaw: (query: TemplateStringsArray, ...params: unknown[]) => Promise<unknown>;
  } | null;
  getCompanyFromJwt: (request: FastifyRequest) => string;
  getTenantIdFromJwt: (request: FastifyRequest) => string;
  getUserFromJwt: (request: FastifyRequest) => { id: string; name: string };
  resolveAuthorizedSite: (request: FastifyRequest, siteId: string) => Promise<
    | {
        allowed: true;
        site: {
          id: string;
          tenantId: string;
          name: string;
          city: string | null;
          state: string | null;
          role: string;
        };
      }
    | { allowed: false; statusCode: number; body: unknown }
  >;
  listAuthorizedSites: (request: FastifyRequest) => Promise<Array<{
    id: string;
    tenantId: string;
    name: string;
    city: string | null;
    state: string | null;
    role: string;
  }>>;
  randomUUID: () => string;
  ensureDomainTables: () => Promise<void>;
  PDFParse: new (input: { data: Buffer }) => {
    getText: () => Promise<{ text?: string }>;
    destroy: () => Promise<void>;
  };
  recordAiPreparationEvent: (payload: {
    tenantId: string;
    companyName: string;
    moduleKey: 'rules' | 'menus' | 'recipes' | 'contracts';
    sourceKind: string;
    providerKey: string;
    data: unknown;
  }) => Promise<void>;
  z: any;
}

type ExtractionDiagnostics = {
  contractId: string;
  model: string;
  provider: 'ollama';
  providerUrl: string;
  responseHash: string | null;
  responseLength: number;
  rulesDetected: number;
  jsonDetected: boolean;
  schemaValid: boolean;
  parseSuccess: boolean;
  topLevelType: string;
  arrayDetected: boolean;
  candidatesReceived: number;
  discardedBySchema: number;
  rulesWithEvidence: number;
  rulesWithoutEvidence: number;
  pdfTextLength: number;
  excerptLength: number;
  ollamaHttpStatus: number | null;
  promptHash: string;
  segmentation: {
    strategy: 'clauses' | 'pages';
    totalSegments: number;
    averageSegmentChars: number;
  };
  chunks: Array<{
    chunkId: number;
    chunkLabel: string;
    strategy: 'clauses' | 'pages';
    chunkSize: number;
    processingTimeMs: number;
    rulesExtracted: number;
    outcome: 'success' | 'empty' | 'error';
    errorMessage: string | null;
  }>;
  outcome: 'success' | 'empty' | 'error';
  errorMessage: string | null;
  createdAt: string;
};

const cleanJson = (text: string): string => {
  let clean = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '');

  const arrayStart = clean.indexOf('[');
  const objStart = clean.indexOf('{');

  if (arrayStart !== -1 && objStart !== -1) {
    clean = clean.substring(Math.min(arrayStart, objStart));
  } else if (arrayStart !== -1) {
    clean = clean.substring(arrayStart);
  } else if (objStart !== -1) {
    clean = clean.substring(objStart);
  }

  const arrayEnd = clean.lastIndexOf(']');
  const objEnd = clean.lastIndexOf('}');
  const end = Math.max(arrayEnd, objEnd);

  if (end !== -1) {
    clean = clean.substring(0, end + 1);
  }

  return clean.trim();
};

const parseJsonWithArrayFallback = (content: string): unknown[] => {
  const normalized = cleanJson(content);

  try {
    const parsed = JSON.parse(normalized) as unknown;

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (parsed && typeof parsed === 'object') {
      const parsedRecord = parsed as Record<string, unknown>;

      if (Array.isArray(parsedRecord.rules)) {
        return parsedRecord.rules;
      }

      const keys = Object.keys(parsedRecord);
      for (const key of keys) {
        if (Array.isArray(parsedRecord[key])) {
          return parsedRecord[key] as unknown[];
        }
      }
    }

    return [];
  } catch {
    const startIndex = normalized.indexOf('[');
    const endIndex = normalized.lastIndexOf(']');

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      return [];
    }

    const arrayCandidate = normalized.slice(startIndex, endIndex + 1);
    const parsedArray = JSON.parse(arrayCandidate) as unknown;
    return Array.isArray(parsedArray) ? parsedArray : [];
  }
};

const hashString = (value: string) => createHash('sha256').update(value).digest('hex');

const isLikelyJson = (value: string) => {
  const trimmed = value.trim();
  return (
    trimmed.startsWith('{') ||
    trimmed.startsWith('[') ||
    trimmed.startsWith('```')
  );
};

type ContractSegment = {
  chunkId: number;
  chunkLabel: string;
  strategy: 'clauses' | 'pages';
  text: string;
};

export type MemoryContract = {
  id: string;
  tenantId: string;
  siteId: string;
  siteName: string;
  companyName: string;
  title: string;
  sourceType: string;
  status: string;
  extractedText: string | null;
  inactivationReason: string | null;
  inactivatedAt: Date | null;
  createdAt: Date;
  createdBy: string;
};

export const contractMemory = new Map<string, MemoryContract>();

const splitByClauses = (fullText: string): ContractSegment[] => {
  const clauseRegex = /(?:^|\n)\s*cl[aÃƒÂ¡]usula\s+[^\n]*/gim;
  const matches = Array.from(fullText.matchAll(clauseRegex));

  if (!matches.length) {
    return [];
  }

  const segments: ContractSegment[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index]?.index ?? 0;
    const end = index + 1 < matches.length ? (matches[index + 1]?.index ?? fullText.length) : fullText.length;
    const text = fullText.slice(start, end).trim();

    if (!text) {
      continue;
    }

    const heading = text.split('\n')[0]?.trim().slice(0, 80) ?? `Clausula ${index + 1}`;
    segments.push({
      chunkId: segments.length + 1,
      chunkLabel: heading,
      strategy: 'clauses',
      text,
    });
  }

  return segments;
};

const splitByPagesFallback = (fullText: string, pageChunkChars: number): ContractSegment[] => {
  const rawPages = fullText
    .split(/\f+/)
    .map((page) => page.trim())
    .filter((page) => page.length > 0);

  if (rawPages.length > 1) {
    return rawPages.map((text, index) => ({
      chunkId: index + 1,
      chunkLabel: `Pagina ${index + 1}`,
      strategy: 'pages',
      text,
    }));
  }

  const normalized = fullText.trim();
  const segments: ContractSegment[] = [];

  for (let start = 0; start < normalized.length; start += pageChunkChars) {
    const end = Math.min(start + pageChunkChars, normalized.length);
    const text = normalized.slice(start, end).trim();

    if (!text) {
      continue;
    }

    segments.push({
      chunkId: segments.length + 1,
      chunkLabel: `Pagina logica ${segments.length + 1}`,
      strategy: 'pages',
      text,
    });
  }

  return segments;
};

type EvidencePage = {
  page: number;
  text: string;
};

const buildEvidencePages = (fullText: string, pageChunkChars: number): EvidencePage[] => {
  const rawPages = fullText
    .split(/\f+/)
    .map((page) => page.trim())
    .filter((page) => page.length > 0);

  if (rawPages.length > 1) {
    return rawPages.map((text, index) => ({
      page: index + 1,
      text,
    }));
  }

  const normalized = fullText.trim();
  const pages: EvidencePage[] = [];
  for (let start = 0; start < normalized.length; start += pageChunkChars) {
    const end = Math.min(start + pageChunkChars, normalized.length);
    const text = normalized.slice(start, end).trim();
    if (!text) {
      continue;
    }

    pages.push({
      page: pages.length + 1,
      text,
    });
  }

  return pages;
};

const extractExcerptAroundMatch = (text: string, index: number, matchLength: number) => {
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + matchLength + 160);
  return text.slice(start, end).replace(/\s+/g, ' ').trim().slice(0, 500);
};

const tokenizeEvidenceText = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .map((token) => token.trim())
  .filter((token) => token.length >= 4);

const findDeterministicEvidence = (rule: ExtractedRule, pages: EvidencePage[]): RuleWithEvidence => {
  if (rule.sourceExcerpt?.trim()) {
    return {
      ...rule,
      sourceExcerpt: rule.sourceExcerpt.trim().slice(0, 500),
      sourcePage: rule.sourcePage ?? null,
      evidenceConfidence: rule.evidenceConfidence ?? 0.85,
    };
  }

  const evidenceCandidates = [
    rule.title.trim(),
    rule.description.trim().slice(0, 180),
    rule.description.trim(),
  ].filter((value, index, array) => value.length >= 8 && array.indexOf(value) === index);

  for (const candidate of evidenceCandidates) {
    const candidateLower = candidate.toLowerCase();

    for (const page of pages) {
      const pageLower = page.text.toLowerCase();
      const index = pageLower.indexOf(candidateLower);

      if (index === -1) {
        continue;
      }

      return {
        ...rule,
        sourceExcerpt: extractExcerptAroundMatch(page.text, index, candidate.length),
        sourcePage: page.page,
        evidenceConfidence: candidate === rule.title ? 0.95 : 0.9,
      };
    }
  }

  const queryTokens = new Set(tokenizeEvidenceText(`${rule.title} ${rule.description}`));
  if (!queryTokens.size) {
    return {
      ...rule,
      sourceExcerpt: null,
      sourcePage: null,
      evidenceConfidence: null,
    };
  }

  let bestPage: EvidencePage | null = null;
  let bestScore = 0;

  for (const page of pages) {
    const pageTokens = new Set(tokenizeEvidenceText(page.text));
    if (!pageTokens.size) {
      continue;
    }

    let overlap = 0;
    for (const token of queryTokens) {
      if (pageTokens.has(token)) {
        overlap += 1;
      }
    }

    const score = overlap / queryTokens.size;
    if (score > bestScore) {
      bestScore = score;
      bestPage = page;
    }
  }

  if (bestPage && bestScore >= 0.22) {
    const excerpt = bestPage.text.replace(/\s+/g, ' ').trim().slice(0, 500);
    return {
      ...rule,
      sourceExcerpt: excerpt || null,
      sourcePage: bestPage.page,
      evidenceConfidence: Number(bestScore.toFixed(2)),
    };
  }

  return {
    ...rule,
    sourceExcerpt: null,
    sourcePage: null,
    evidenceConfidence: null,
  };
};

const normalizeText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const operationalRuleKeywords = [
  'cardapio',
  'refeicao',
  'buffet',
  'proteina',
  'ovo',
  'salada',
  'guarnicao',
  'arroz',
  'feijao',
  'sobremesa',
  'fruta',
  'suco',
  'bebida',
  'cafe',
  'cha',
  'light',
  'vegana',
  'vegetariana',
  'alergenico',
  'incidencia',
  'periodicidade',
  'frequencia',
  'substituicao',
  'repeticao',
  'prato especial',
  'aprovacao do cardapio',
];

const outOfScopeKeywords = [
  'multa',
  'seguro',
  'trabalhista',
  'documento administrativo',
  'sla',
  'penalidade',
  'dados cadastrais',
  'contato',
  'comercial',
  'faturamento',
  'nota fiscal',
];

const isOperationalMenuRule = (rule: { title: string; description: string; category: string }) => {
  const content = normalizeText(`${rule.title} ${rule.description} ${rule.category}`);

  if (outOfScopeKeywords.some((keyword) => content.includes(keyword))) {
    return false;
  }

  return operationalRuleKeywords.some((keyword) => content.includes(keyword));
};

const readStringField = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const readNumberField = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.replace(',', '.'));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
};

const readStringArrayField = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim());
    }
  }

  return [];
};

const normalizeExtractedRules = (payload: unknown): ExtractedRule[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

  const allowedApplicability = new Set(['general', 'direct_site', 'site_group']);

  return payload
    .filter((rule): rule is Record<string, unknown> => typeof rule === 'object' && rule !== null)
    .map((rule) => {
      const title = readStringField(rule, ['title', 'titulo', 'tipo_regra'])?.slice(0, 120) ?? '';
      const description = readStringField(rule, ['description', 'descricao']) ?? '';
      const category = readStringField(rule, ['category', 'categoria'])?.toLowerCase() ?? 'cardapio';
      const rawApplicability = readStringField(rule, ['applicability', 'aplicabilidade']) ?? 'general';
      const applicability = allowedApplicability.has(rawApplicability)
        ? rawApplicability as ExtractedRule['applicability']
        : 'general';
      const ruleType = readStringField(rule, ['ruleType', 'rule_type', 'tipo_regra']) ?? 'operational_menu_rule';

      if (!title || !description) {
        return null;
      }

      const normalized = { title, description, category };

      if (!isOperationalMenuRule(normalized)) {
        return null;
      }

      return {
        ...normalized,
        ruleType,
        periodicity: readStringField(rule, ['periodicity', 'periodicidade']),
        quantity: readNumberField(rule, ['quantity', 'quantidade', 'incidencia']),
        unitMeasure: readStringField(rule, ['unitMeasure', 'unit_measure', 'unidade_medida']),
        calculationBasis: readStringField(rule, ['calculationBasis', 'calculation_basis', 'base_calculo']),
        applicability,
        originGroupText: readStringField(rule, ['originGroupText', 'origin_group_text', 'grupo_origem_no_contrato']),
        detectedUnits: readStringArrayField(rule, ['detectedUnits', 'detected_units', 'unidades_aplicaveis', 'unidades_detectadas_no_trecho']),
        sourceItem: readStringField(rule, ['sourceItem', 'source_item', 'item', 'fonte_item']),
        sourceExcerpt: readStringField(rule, ['sourceExcerpt', 'source_excerpt', 'trecho_evidencia'])?.slice(0, 500) ?? null,
        sourcePage: readNumberField(rule, ['sourcePage', 'source_page', 'pagina', 'fonte_pagina']),
        evidenceConfidence: readNumberField(rule, ['evidenceConfidence', 'evidence_confidence', 'confianca']),
      };
    })
    .filter((rule): rule is ExtractedRule => rule !== null);
};

const ruleAppliesToSelectedSite = (rule: ExtractedRule, siteName: string) => {
  if (rule.applicability === 'general') {
    return true;
  }

  const selected = normalizeText(siteName);
  const detectedUnits = rule.detectedUnits.map((unit) => normalizeText(unit));
  const originGroup = normalizeText(rule.originGroupText ?? '');

  return (
    detectedUnits.some((unit) => unit === selected || unit.includes(selected) || selected.includes(unit)) ||
    originGroup.includes(selected)
  );
};

export const extractRulesFromPdf = async (
  deps: Deps,
  contractId: string,
  pdfBuffer: Buffer,
  companyName: string,
  site: { id: string; tenantId: string; name: string },
  knownSites: Array<{ id: string; name: string }>,
): Promise<RouteResult> => {
  const nowIso = new Date().toISOString();

  if (!deps.prisma) {
    return {
      statusCode: 503,
      body: {
        status: 'error',
        message: deps.apiMessage.health.dbUnavailable,
      },
    };
  }

  await deps.ensureDomainTables();

  const contractRows = await deps.prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM contracts
    WHERE id = ${contractId}
      AND tenant_id = ${site.tenantId}
      AND company_name = ${companyName}
      AND site_id = ${site.id}
    LIMIT 1
  `;

  if (!contractRows.length) {
    return {
      statusCode: 404,
      body: {
        status: 'error',
        message: 'Contrato nao encontrado.',
      },
    };
  }

  const parser = new deps.PDFParse({ data: pdfBuffer });
  let contractText = '';

  try {
    const parsedPdf = await parser.getText();
    contractText = (parsedPdf.text ?? '').trim();
    console.log('[extractRules] texto extraido:', contractText.substring(0, 200));
  } finally {
    await parser.destroy();
  }

  if (!contractText) {
    return {
      statusCode: 400,
      body: {
        status: 'error',
        message: 'Nao foi possivel extrair texto do PDF enviado.',
      },
    };
  }

  const ollamaModel = process.env.OLLAMA_MODEL?.trim() || 'qwen2.5:7b';
  const ollamaUrl = process.env.OLLAMA_URL?.trim() || 'http://localhost:11434';
  const ollamaTimeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? 110000);
  const pageChunkChars = Number(process.env.OLLAMA_PAGE_CHUNK_CHARS ?? 6000);
  const maxSegments = Number(process.env.OLLAMA_MAX_SEGMENTS ?? 24);

  const clauseSegments = splitByClauses(contractText);
  const baseSegments = clauseSegments.length
    ? clauseSegments
    : splitByPagesFallback(contractText, pageChunkChars);
  const segments = (baseSegments.length
    ? baseSegments
    : [{ chunkId: 1, chunkLabel: 'Documento completo', strategy: 'pages' as const, text: contractText }]
  ).slice(0, maxSegments);

  const knownSiteNames = knownSites.map((knownSite) => knownSite.name).join(', ');
  const promptTemplate = `Voce esta extraindo regras operacionais de cardapio para:

Cliente: ${companyName}
Unidade selecionada: ${site.name}
Contrato: ${contractId}
Unidades conhecidas do cliente: ${knownSiteNames || site.name}

Extraia somente regras que impactem montagem, aprovacao ou validacao de cardapio, alimentacao e conformidade nutricional/contratual.

Inclua regras sobre quantidade de opcoes por dia, frequencia mensal, incidencia de proteinas, tipos de proteina, substituicoes, repeticao, buffet livre, buffet especial, prato especial, salada, guarnicao, arroz, feijao, sobremesa, fruta, suco, bebida, cafe, cha, ovo, opcoes light/vegana/restritivas, alergenicos e aprovacao de cardapio.

Ignore clausulas juridicas gerais, multas, SLA, seguros, documentos administrativos, dados comerciais, obrigacoes trabalhistas, penalidades, cadastro, contato e qualquer clausula sem impacto direto no cardapio.

Criterios de aplicabilidade:
1. Extraia regras gerais quando o texto indicar todas as unidades/localidades/restaurantes/turnos ou todo o contrato.
2. Extraia regras que citem diretamente a unidade selecionada.
3. Extraia regras de grupos somente quando a unidade selecionada estiver explicitamente no grupo citado.
4. Ignore regras de outras unidades.
5. Nao use contratos anteriores.
6. Nao inferir por semelhanca.
7. Toda regra precisa de evidencia textual ou tabela de origem.

Responda apenas JSON no formato:
{"rules":[{"title":"Titulo curto","description":"Descricao operacional","rule_type":"incidencia_cardapio","category":"proteina","periodicity":"mensal","quantity":14,"unit_measure":"incidencias","calculation_basis":"22 dias uteis","applicability":"site_group","detectedUnits":["${site.name}"],"originGroupText":"Grupo literal do contrato","sourceItem":"19","sourcePage":21,"sourceExcerpt":"Trecho literal de evidencia"}]}`;

  const diagnostics: ExtractionDiagnostics = {
    contractId,
    model: ollamaModel,
    provider: 'ollama',
    providerUrl: ollamaUrl,
    responseHash: null,
    responseLength: 0,
    rulesDetected: 0,
    jsonDetected: false,
    schemaValid: false,
    parseSuccess: false,
    topLevelType: 'unknown',
    arrayDetected: false,
    candidatesReceived: 0,
    discardedBySchema: 0,
    rulesWithEvidence: 0,
    rulesWithoutEvidence: 0,
    pdfTextLength: contractText.length,
    excerptLength: segments.reduce((sum, segment) => sum + segment.text.length, 0),
    ollamaHttpStatus: null,
    promptHash: hashString(promptTemplate),
    segmentation: {
      strategy: clauseSegments.length ? 'clauses' : 'pages',
      totalSegments: segments.length,
      averageSegmentChars: segments.length
        ? Math.round(segments.reduce((sum, segment) => sum + segment.text.length, 0) / segments.length)
        : 0,
    },
    chunks: [],
    outcome: 'error',
    errorMessage: null,
    createdAt: nowIso,
  };

  const rawSnapshots: string[] = [];

  const persistDiagnostics = async () => {
    await deps.recordAiPreparationEvent({
      tenantId: site.tenantId,
      companyName,
      moduleKey: 'contracts',
      sourceKind: 'contract-rule-extraction-diagnostic',
      providerKey: 'ollama',
      data: diagnostics,
    });

    if (process.env.NODE_ENV === 'development' && rawSnapshots.length > 0) {
      const sanitizedSample = rawSnapshots[0].replace(/\s+/g, ' ').slice(0, 500);
      console.info('[contracts.extractRules.diagnostic]', {
        contractId,
        model: diagnostics.model,
        responseLength: diagnostics.responseLength,
        responseHash: diagnostics.responseHash,
        sample: sanitizedSample,
      });
    }
  };

  const allRules: ExtractedRule[] = [];
  let timeoutCount = 0;

  for (const segment of segments) {
    const chunkStart = Date.now();
    const chunkInfo: ExtractionDiagnostics['chunks'][number] = {
      chunkId: segment.chunkId,
      chunkLabel: segment.chunkLabel,
      strategy: segment.strategy,
      chunkSize: segment.text.length,
      processingTimeMs: 0,
      rulesExtracted: 0,
      outcome: 'error',
      errorMessage: null,
    };

    const prompt = `${promptTemplate}

Trecho do contrato (${segment.chunkLabel}):
${segment.text}

Responda apenas com JSON:`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ollamaTimeoutMs);

    try {
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: ollamaModel,
          prompt,
          stream: false,
          format: 'json',
          options: {
            temperature: 0.1,
          },
        }),
      });

      diagnostics.ollamaHttpStatus = response.status;

      if (!response.ok) {
        const errorText = await response.text();
        chunkInfo.outcome = 'error';
        chunkInfo.errorMessage = `HTTP ${response.status}`;
        diagnostics.errorMessage = `Falha ao consultar Ollama (${response.status})`;
        rawSnapshots.push(errorText.slice(0, 1000));
        continue;
      }

      const payload = (await response.json()) as { response?: string };
      const responseText = payload.response ?? '';
      const rawContent = responseText.trim();
      const jsonContent = cleanJson(rawContent);
      console.log('[extractRules] resposta bruta Ollama:', responseText.substring(0, 500));
      rawSnapshots.push(rawContent.slice(0, 1000));

      diagnostics.responseLength += rawContent.length;
      diagnostics.jsonDetected = diagnostics.jsonDetected || isLikelyJson(rawContent);

      const extractedPayload = parseJsonWithArrayFallback(jsonContent);
      diagnostics.parseSuccess = extractedPayload.length > 0;

      diagnostics.topLevelType = Array.isArray(extractedPayload) ? 'array' : typeof extractedPayload;
      diagnostics.arrayDetected = diagnostics.arrayDetected || Array.isArray(extractedPayload);

      const candidates = Array.isArray(extractedPayload) ? extractedPayload.length : 0;
      diagnostics.candidatesReceived += candidates;

      const normalizedChunkRules = normalizeExtractedRules(extractedPayload);
      diagnostics.discardedBySchema += Math.max(0, candidates - normalizedChunkRules.length);
      allRules.push(...normalizedChunkRules);

      chunkInfo.rulesExtracted = normalizedChunkRules.length;
      chunkInfo.outcome = normalizedChunkRules.length > 0 ? 'success' : 'empty';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        timeoutCount += 1;
        chunkInfo.errorMessage = `Timeout apos ${Math.floor(ollamaTimeoutMs / 1000)}s`;
      } else {
        chunkInfo.errorMessage = 'Falha de conexao/parsing no segmento';
      }
      chunkInfo.outcome = 'error';
    } finally {
      clearTimeout(timeoutId);
      chunkInfo.processingTimeMs = Date.now() - chunkStart;
      diagnostics.chunks.push(chunkInfo);
    }
  }

  diagnostics.responseHash = rawSnapshots.length
    ? hashString(rawSnapshots.join('\n---\n'))
    : null;

  const dedupedRulesMap = new Map<string, ExtractedRule>();
  for (const rule of allRules) {
    const key = `${rule.category}|${rule.title.toLowerCase()}|${rule.description.toLowerCase()}`;
    if (!dedupedRulesMap.has(key)) {
      dedupedRulesMap.set(key, rule);
    }
  }

  const normalizedRules = Array.from(dedupedRulesMap.values())
    .filter((rule) => ruleAppliesToSelectedSite(rule, site.name));
  const evidencePages = buildEvidencePages(contractText, pageChunkChars);
  let rulesWithEvidence = normalizedRules.map((rule) => findDeterministicEvidence(rule, evidencePages));

  const evidenceFallbackEnabled = process.env.OLLAMA_EVIDENCE_FALLBACK_ENABLED === 'true';
  const evidenceFallbackTimeoutMs = Number(process.env.OLLAMA_EVIDENCE_TIMEOUT_MS ?? 20000);

  if (evidenceFallbackEnabled) {
    for (let index = 0; index < rulesWithEvidence.length; index += 1) {
      const current = rulesWithEvidence[index];
      if (current.sourceExcerpt) {
        continue;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), evidenceFallbackTimeoutMs);

      try {
        const fallbackPrompt = `Localize um trecho literal do contrato que comprove a regra abaixo.
Retorne APENAS JSON com os campos: sourceExcerpt (string) e sourcePage (numero ou null).

REGRA:
title: ${current.title}
description: ${current.description}
category: ${current.category}

CONTRATO:
${contractText.slice(0, 12000)}`;

        const response = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: ollamaModel,
            prompt: fallbackPrompt,
            stream: false,
            format: 'json',
            options: {
              temperature: 0,
              num_predict: 350,
            },
          }),
        });

        if (!response.ok) {
          continue;
        }

        const payload = (await response.json()) as { response?: string };
        const parsed = JSON.parse(cleanJson(payload.response?.trim() ?? '{}')) as {
          sourceExcerpt?: unknown;
          sourcePage?: unknown;
        };

        const sourceExcerpt = typeof parsed.sourceExcerpt === 'string'
          ? parsed.sourceExcerpt.replace(/\s+/g, ' ').trim().slice(0, 500)
          : '';
        const sourcePage = typeof parsed.sourcePage === 'number' && Number.isInteger(parsed.sourcePage)
          ? parsed.sourcePage
          : null;

        if (!sourceExcerpt) {
          continue;
        }

        rulesWithEvidence[index] = {
          ...current,
          sourceExcerpt,
          sourcePage,
          evidenceConfidence: 0.55,
        };
      } catch {
        // Fallback de IA nao deve interromper o fluxo principal.
      } finally {
        clearTimeout(timeoutId);
      }
    }
  }

  diagnostics.rulesDetected = rulesWithEvidence.length;
  diagnostics.schemaValid = rulesWithEvidence.length > 0;
  diagnostics.rulesWithEvidence = rulesWithEvidence.filter((rule) => !!rule.sourceExcerpt).length;
  diagnostics.rulesWithoutEvidence = rulesWithEvidence.length - diagnostics.rulesWithEvidence;

  rulesWithEvidence = rulesWithEvidence.filter((rule) => !!rule.sourceExcerpt);
  diagnostics.rulesDetected = rulesWithEvidence.length;
  diagnostics.schemaValid = rulesWithEvidence.length > 0;
  diagnostics.rulesWithEvidence = rulesWithEvidence.length;
  diagnostics.rulesWithoutEvidence = 0;

  if (!rulesWithEvidence.length) {
    diagnostics.outcome = timeoutCount === segments.length ? 'error' : 'empty';
    diagnostics.errorMessage = timeoutCount === segments.length
      ? `Timeout em todos os ${segments.length} segmentos`
      : diagnostics.chunks.every((chunk) => chunk.outcome === 'error')
        ? 'Falha ao processar todos os segmentos no Ollama'
        : null;
    await persistDiagnostics();

    if (timeoutCount === segments.length) {
      return {
        statusCode: 504,
        body: {
          status: 'error',
          message: `Ollama excedeu o tempo limite de ${Math.floor(ollamaTimeoutMs / 1000)}s em todos os segmentos.`,
        },
      };
    }

    if (diagnostics.chunks.every((chunk) => chunk.outcome === 'error')) {
      return {
        statusCode: 502,
        body: {
          status: 'error',
          message: 'Falha ao processar os segmentos do contrato no Ollama.',
        },
      };
    }

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        rules: [],
        count: 0,
        message: 'Nenhuma regra valida foi extraida pela IA.',
      },
    };
  }

  const createdRules: Array<{
    id: string;
    contractId: string;
    title: string;
    description: string;
    category: string;
    sourceExcerpt: string | null;
    sourcePage: number | null;
    evidenceConfidence: number | null;
    status: string;
    createdAt: string;
  }> = [];

  const rules = rulesWithEvidence;
  console.log(`[extractRules] salvando ${rules.length} regras para contrato ${contractId}`);

  for (const rule of rules) {
    const ruleId = deps.randomUUID();
    const createdAt = new Date();

    await deps.prisma.$executeRaw`
      INSERT INTO extracted_rules (
        id,
        tenant_id,
        site_id,
        company_name,
        contract_id,
        title,
        description,
        category,
        rule_type,
        periodicity,
        quantity,
        unit_measure,
        calculation_basis,
        applicability,
        origin_group_text,
        detected_units_json,
        source_item,
        source_excerpt,
        source_page,
        evidence_confidence,
        status,
        created_at
      )
      VALUES (
        ${ruleId},
        ${site.tenantId},
        ${site.id},
        ${companyName},
        ${contractId},
        ${rule.title},
        ${rule.description},
        ${rule.category},
        ${rule.ruleType},
        ${rule.periodicity},
        ${rule.quantity},
        ${rule.unitMeasure},
        ${rule.calculationBasis},
        ${rule.applicability},
        ${rule.originGroupText},
        ${JSON.stringify(rule.detectedUnits)},
        ${rule.sourceItem},
        ${rule.sourceExcerpt},
        ${rule.sourcePage},
        ${rule.evidenceConfidence},
        ${'pending'},
        ${createdAt}
      )
    `;

    createdRules.push({
      id: ruleId,
      contractId,
      title: rule.title,
      description: rule.description,
      category: rule.category,
      sourceExcerpt: rule.sourceExcerpt,
      sourcePage: rule.sourcePage,
      evidenceConfidence: rule.evidenceConfidence,
      status: 'pending',
      createdAt: createdAt.toISOString(),
    });
  }

  diagnostics.outcome = 'success';
  diagnostics.errorMessage = timeoutCount > 0
    ? `Extracao parcial com ${timeoutCount} segmento(s) em timeout.`
    : null;
  await persistDiagnostics();

  return {
    statusCode: 201,
    body: {
      status: 'ok',
      rules: createdRules,
      count: createdRules.length,
    },
  };
};
export const createContractsService = (deps: Deps) => {
  const repository = createContractsRepository(deps);

  const updateContractStatus = async (
    contractId: string,
    tenantId: string,
    companyName: string,
    status: 'processing' | 'rules_extracted' | 'active' | 'inactive' | 'extraction_failed',
    inactivationReason?: string | null,
  ) => {
    if (!deps.prisma) {
      return;
    }

    if (status === 'inactive') {
      await deps.prisma.$executeRaw`
        UPDATE contracts
        SET status = ${status},
            inactivation_reason = ${inactivationReason ?? null},
            inactivated_at = NOW()
        WHERE id = ${contractId}
          AND tenant_id = ${tenantId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
      `;
      return;
    }

    await deps.prisma.$executeRaw`
      UPDATE contracts
      SET status = ${status},
          inactivation_reason = NULL,
          inactivated_at = NULL
      WHERE id = ${contractId}
        AND tenant_id = ${tenantId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
    `;
  };

  const createContract = async (
    request: FastifyRequest,
    payload: { title: string; sourceType: string; siteId?: string; fileBuffer?: Buffer | null },
  ): Promise<RouteResult> => {
    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = deps.getTenantIdFromJwt(request);
    const actor = deps.getUserFromJwt(request);
    const knownSites = await deps.listAuthorizedSites(request);
    const resolvedSiteId = payload.siteId ?? (knownSites.length === 1 ? knownSites[0]?.id : undefined);

    if (!resolvedSiteId) {
      return {
        statusCode: 400,
        body: {
          status: 'error',
          message: 'Selecione uma unidade ativa para lancar o contrato.',
        },
      };
    }

    const siteAccess = await deps.resolveAuthorizedSite(request, resolvedSiteId);
    if (!siteAccess.allowed) {
      return siteAccess;
    }

    const contractId = deps.randomUUID();
    let extractedText: string | null = null;

    if (payload.fileBuffer) {
      const parser = new deps.PDFParse({ data: payload.fileBuffer });
      try {
        const parsedPdf = await parser.getText();
        extractedText = (parsedPdf.text ?? '').trim();
      } finally {
        await parser.destroy();
      }

      if (!extractedText) {
        return {
          statusCode: 400,
          body: {
            status: 'error',
            message: 'Nao foi possivel extrair texto do PDF enviado.',
          },
        };
      }
    }

    if (!deps.prisma) {
      const createdAt = new Date();
      const contract: MemoryContract = {
        id: contractId,
        tenantId,
        siteId: siteAccess.site.id,
        siteName: siteAccess.site.name,
        companyName,
        title: payload.title,
        sourceType: payload.sourceType,
        status: extractedText ? 'rules_extracted' : 'processing',
        extractedText,
        inactivationReason: null,
        inactivatedAt: null,
        createdAt,
        createdBy: actor.name,
      };
      contractMemory.set(contractId, contract);

      return {
        statusCode: 201,
        body: {
          status: 'ok',
          contract: {
            id: contract.id,
            siteId: contract.siteId,
            siteName: contract.siteName,
            title: contract.title,
            sourceType: contract.sourceType,
            status: contract.status,
            extractedText: contract.extractedText,
            inactivationReason: contract.inactivationReason,
            inactivatedAt: contract.inactivatedAt?.toISOString() ?? null,
            createdAt: contract.createdAt.toISOString(),
            createdBy: contract.createdBy,
          },
        },
      };
    }

    await deps.ensureDomainTables();

    await deps.prisma.$executeRaw`
      INSERT INTO contracts (id, tenant_id, site_id, company_name, title, source_type, status, extracted_text, created_by)
      VALUES (
        ${contractId},
        ${tenantId},
        ${siteAccess.site.id},
        ${companyName},
        ${payload.title},
        ${payload.sourceType},
        ${'processing'},
        ${extractedText},
        ${actor.id}
      )
    `;

    if (extractedText) {
      void (async () => {
        try {
          const ruleResult = await extractRulesFromPdf(
            deps,
            contractId,
            payload.fileBuffer as Buffer,
            companyName,
            siteAccess.site,
            knownSites,
          );

          if (ruleResult.statusCode >= 400) {
            await updateContractStatus(contractId, tenantId, companyName, 'extraction_failed');
            return;
          }

          await updateContractStatus(contractId, tenantId, companyName, 'rules_extracted');
        } catch {
          await updateContractStatus(contractId, tenantId, companyName, 'extraction_failed');
        }
      })();
    }

    const rows = await deps.prisma.$queryRaw<
      Array<{
        id: string;
        site_id: string;
        site_name: string;
        title: string;
        source_type: string;
        status: string;
        extracted_text: string | null;
        inactivation_reason: string | null;
        inactivated_at: Date | null;
        created_at: Date;
      }>
    >`
      SELECT contract.id, contract.site_id, site.name AS site_name, contract.title, contract.source_type,
             contract.status, contract.extracted_text, contract.inactivation_reason,
             contract.inactivated_at, contract.created_at
      FROM contracts contract
      JOIN sites site ON site.id = contract.site_id
      WHERE contract.id = ${contractId}
      LIMIT 1
    `;

    return {
      statusCode: 201,
      body: {
        status: 'ok',
        contract: {
          id: rows[0]?.id ?? contractId,
          siteId: rows[0]?.site_id ?? siteAccess.site.id,
          siteName: rows[0]?.site_name ?? siteAccess.site.name,
          title: rows[0]?.title ?? payload.title,
          sourceType: rows[0]?.source_type ?? payload.sourceType,
          status: rows[0]?.status ?? 'processing',
          extractedText: rows[0]?.extracted_text ?? extractedText,
          inactivationReason: rows[0]?.inactivation_reason ?? null,
          inactivatedAt: rows[0]?.inactivated_at?.toISOString() ?? null,
          createdAt: (rows[0]?.created_at ?? new Date()).toISOString(),
          createdBy: actor.name,
        },
      },
    };
  };

  const getContractById = async (request: FastifyRequest, contractId: string): Promise<RouteResult> => {
    if (!deps.prisma) {
      const companyName = deps.getCompanyFromJwt(request);
      const tenantId = deps.getTenantIdFromJwt(request);
      const contract = contractMemory.get(contractId);

      if (!contract || contract.companyName !== companyName || contract.tenantId !== tenantId) {
        return {
          statusCode: 404,
          body: {
            status: 'error',
            message: 'Contrato nao encontrado para esta empresa.',
          },
        };
      }

      const siteAccess = await deps.resolveAuthorizedSite(request, contract.siteId);
      if (!siteAccess.allowed) {
        return siteAccess;
      }

      return {
        statusCode: 200,
        body: {
          status: 'ok',
          contract: {
            id: contract.id,
            siteId: contract.siteId,
            siteName: contract.siteName,
            title: contract.title,
            sourceType: contract.sourceType,
            status: contract.status,
            extractedText: contract.extractedText,
            inactivationReason: contract.inactivationReason,
            inactivatedAt: contract.inactivatedAt?.toISOString() ?? null,
            createdAt: contract.createdAt.toISOString(),
          },
        },
      };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = deps.getTenantIdFromJwt(request);

    await deps.ensureDomainTables();

    const rows = await deps.prisma.$queryRaw<
      Array<{
        id: string;
        site_id: string;
        site_name: string;
        title: string;
        source_type: string;
        status: string;
        extracted_text: string | null;
        inactivation_reason: string | null;
        inactivated_at: Date | null;
        created_at: Date;
      }>
    >`
      SELECT contract.id, contract.site_id, site.name AS site_name, contract.title, contract.source_type,
             contract.status, contract.extracted_text, contract.inactivation_reason,
             contract.inactivated_at, contract.created_at
      FROM contracts contract
      JOIN sites site ON site.id = contract.site_id
      WHERE contract.id = ${contractId}
 AND contract.tenant_id = ${tenantId}
 AND contract.company_name = ${companyName}
        AND contract.tenant_id = ${tenantId}
      LIMIT 1
    `;

    const contract = rows[0];
    if (!contract) {
      return {
        statusCode: 404,
        body: {
          status: 'error',
          message: 'Contrato nao encontrado para esta empresa.',
        },
      };
    }

    const siteAccess = await deps.resolveAuthorizedSite(request, contract.site_id);
    if (!siteAccess.allowed) {
      return siteAccess;
    }

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        contract: {
          id: contract.id,
          siteId: contract.site_id,
          siteName: contract.site_name,
          title: contract.title,
          sourceType: contract.source_type,
          status: contract.status,
          extractedText: contract.extracted_text,
          inactivationReason: contract.inactivation_reason,
          inactivatedAt: contract.inactivated_at?.toISOString() ?? null,
          createdAt: contract.created_at.toISOString(),
        },
      },
    };
  };

  const listContracts = async (
    request: FastifyRequest,
    query: { limit: number; siteId?: string },
  ): Promise<RouteResult> => {
    if (!deps.prisma) {
      const companyName = deps.getCompanyFromJwt(request);
      const tenantId = deps.getTenantIdFromJwt(request);
      const authorizedSites = query.siteId ? [] : await deps.listAuthorizedSites(request);

      if (query.siteId) {
        const siteAccess = await deps.resolveAuthorizedSite(request, query.siteId);
        if (!siteAccess.allowed) {
          return siteAccess;
        }
      }

      const siteIds = query.siteId ? [query.siteId] : authorizedSites.map((site) => site.id);
      const contracts = Array.from(contractMemory.values())
        .filter((item) => item.companyName === companyName)
        .filter((item) => item.tenantId === tenantId)
        .filter((item) => siteIds.length === 0 || siteIds.includes(item.siteId))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, query.limit);

      return {
        statusCode: 200,
        body: {
          status: 'ok',
          contracts: contracts.map((item) => ({
            id: item.id,
            siteId: item.siteId,
            siteName: item.siteName,
            title: item.title,
            sourceType: item.sourceType,
            status: item.status,
            extractedText: item.extractedText,
            inactivationReason: item.inactivationReason,
            inactivatedAt: item.inactivatedAt?.toISOString() ?? null,
            createdAt: item.createdAt.toISOString(),
          })),
        },
      };
    }

    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = deps.getTenantIdFromJwt(request);

    await deps.ensureDomainTables();

    const authorizedSites = query.siteId
      ? []
      : await deps.listAuthorizedSites(request);

    if (!query.siteId && authorizedSites.length === 0) {
      return {
        statusCode: 200,
        body: { status: 'ok', contracts: [] },
      };
    }

    if (query.siteId) {
      const siteAccess = await deps.resolveAuthorizedSite(request, query.siteId);
      if (!siteAccess.allowed) {
        return siteAccess;
      }
    }

    const siteIds = query.siteId ? [query.siteId] : authorizedSites.map((site) => site.id);
    const contracts = await deps.prisma.$queryRaw<
      Array<{
        id: string;
        site_id: string;
        site_name: string;
        title: string;
        source_type: string;
        status: string;
        extracted_text: string | null;
        inactivation_reason: string | null;
        inactivated_at: Date | null;
        created_at: Date;
      }>
    >`
      SELECT contract.id, contract.site_id, site.name AS site_name, contract.title, contract.source_type,
             contract.status, contract.extracted_text, contract.inactivation_reason,
             contract.inactivated_at, contract.created_at
      FROM contracts contract
      JOIN sites site ON site.id = contract.site_id
 AND contract.tenant_id = ${tenantId}
        AND contract.company_name = ${companyName}
        AND contract.tenant_id = ${tenantId}
        AND contract.site_id = ANY(${siteIds}::text[])
      ORDER BY contract.created_at DESC
      LIMIT ${query.limit}
    `;

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        contracts: contracts.map((item) => ({
          id: item.id,
          siteId: item.site_id,
          siteName: item.site_name,
          title: item.title,
          sourceType: item.source_type,
          status: item.status,
          extractedText: item.extracted_text,
          inactivationReason: item.inactivation_reason,
          inactivatedAt: item.inactivated_at?.toISOString() ?? null,
          createdAt: item.created_at.toISOString(),
        })),
      },
    };
  };

  const updateContractLifecycleStatus = async (
    request: FastifyRequest,
    payload: { contractId: string; status: 'active' | 'inactive'; inactivationReason?: string | null },
  ): Promise<RouteResult> => {
    const companyName = deps.getCompanyFromJwt(request);
    const tenantId = deps.getTenantIdFromJwt(request);

    if (!deps.prisma) {
      const contract = contractMemory.get(payload.contractId);
      if (!contract || contract.companyName !== companyName || contract.tenantId !== tenantId) {
        return {
          statusCode: 404,
          body: {
            status: 'error',
            message: 'Contrato nao encontrado para esta empresa.',
          },
        };
      }

      const siteAccess = await deps.resolveAuthorizedSite(request, contract.siteId);
      if (!siteAccess.allowed) {
        return siteAccess;
      }

      if (payload.status === 'inactive' && !payload.inactivationReason?.trim()) {
        return {
          statusCode: 400,
          body: {
            status: 'error',
            message: 'Motivo de inativacao e obrigatorio.',
          },
        };
      }

      contract.status = payload.status;
      contract.inactivationReason = payload.status === 'inactive' ? payload.inactivationReason?.trim() ?? null : null;
      contract.inactivatedAt = payload.status === 'inactive' ? new Date() : null;
      contractMemory.set(contract.id, contract);
      return getContractById(request, payload.contractId);
    }

    await deps.ensureDomainTables();

    const existing = await deps.prisma.$queryRaw<Array<{ id: string; site_id: string }>>`
      SELECT id, site_id
      FROM contracts
      WHERE id = ${payload.contractId}
 AND tenant_id = ${tenantId}
 AND company_name = ${companyName}
        AND tenant_id = ${tenantId}
      LIMIT 1
    `;

    if (!existing.length) {
      return {
        statusCode: 404,
        body: {
          status: 'error',
          message: 'Contrato nao encontrado para esta empresa.',
        },
      };
    }

    const siteAccess = await deps.resolveAuthorizedSite(request, existing[0].site_id);
    if (!siteAccess.allowed) {
      return siteAccess;
    }

    if (payload.status === 'inactive' && !payload.inactivationReason?.trim()) {
      return {
        statusCode: 400,
        body: {
          status: 'error',
          message: 'Motivo de inativacao e obrigatorio.',
        },
      };
    }

    await updateContractStatus(
      payload.contractId,
      tenantId,
      companyName,
      payload.status,
      payload.status === 'inactive' ? payload.inactivationReason?.trim() ?? null : null,
    );

    return getContractById(request, payload.contractId);
  };

  return {
    repository,
    authenticate: deps.authenticate,
    contractSchema: deps.contractSchema,
    z: deps.z,
    apiMessage: deps.apiMessage,
    createContract,
    getContractById,
    listContracts,
    updateContractLifecycleStatus,
  };
};

