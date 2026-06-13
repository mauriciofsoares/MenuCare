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
  sourceBlockId?: string | null;
  evidenceConfidence: number | null;
};

type RuleWithEvidence = ExtractedRule & {
  sourceExcerpt: string | null;
  sourcePage: number | null;
  sourceBlockId?: string | null;
  evidenceConfidence: number | null;
};

type PdfTextPage = {
  text?: string;
  num?: number;
  pageNumber?: number;
  page?: number;
};

type PdfTextResult = {
  text?: string;
  total?: number;
  pages?: PdfTextPage[];
};

type SqlClient = {
  $queryRaw: <T>(query: TemplateStringsArray, ...params: unknown[]) => Promise<T>;
  $executeRaw: (query: TemplateStringsArray, ...params: unknown[]) => Promise<unknown>;
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
  prisma: (SqlClient & {
    $transaction?: <T>(callback: (tx: SqlClient) => Promise<T>) => Promise<T>;
  }) | null;
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
    getText: (params?: unknown) => Promise<PdfTextResult>;
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
  discardedRules: Array<{
    reason: string;
    title: string;
    category: string;
    periodicity: string | null;
    sourcePage: number | null;
    sourceBlockId: string | null;
    blockPageNumber: number | null;
    sourceItem: string | null;
    detectedUnits: string[];
    originGroupText: string | null;
  }>;
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

type ContractBlockType =
  | 'TEXT_SECTION'
  | 'TABLE_MENU_INCIDENCE'
  | 'MENU_COMPOSITION'
  | 'TABLE_HOURS'
  | 'TABLE_VOLUME'
  | 'TABLE_KPI_SLA'
  | 'ADMINISTRATIVE'
  | 'COMMERCIAL'
  | 'HSE'
  | 'IGNORE';

type ContractBlock = ContractSegment & {
  id: string;
  blockType: ContractBlockType;
  pageNumber: number;
  blockIndex: number;
  contractPageId: string;
  sourceItem: string;
  normalizedText: string;
  normalizedTableMarkdown: string | null;
  normalizedTableJson: string | null;
  detectedUnitsJson: string;
  isRelevantForExtraction: boolean;
  discardReason: string | null;
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

const buildEvidencePagesFromPdf = (parsedPdf: PdfTextResult, pageChunkChars: number): EvidencePage[] => {
  const parsedPages = Array.isArray(parsedPdf.pages) ? parsedPdf.pages : [];
  const pages = parsedPages
    .map((page, index): EvidencePage => ({
      page: page.num ?? page.pageNumber ?? page.page ?? index + 1,
      text: (page.text ?? '').trim(),
    }))
    .filter((page) => Number.isInteger(page.page) && page.page > 0)
    .sort((a, b) => a.page - b.page);

  if (pages.length > 0) {
    const total = Number.isInteger(parsedPdf.total) && parsedPdf.total ? parsedPdf.total : pages.length;
    const byPageNumber = new Map(pages.map((page) => [page.page, page.text]));

    return Array.from({ length: total }, (_, index) => {
      const page = index + 1;
      return {
        page,
        text: byPageNumber.get(page) ?? '',
      };
    });
  }

  return buildEvidencePages(parsedPdf.text ?? '', pageChunkChars);
};

const buildPageSegments = (pages: EvidencePage[]): ContractSegment[] => pages.map((page) => ({
  chunkId: page.page,
  chunkLabel: `Pagina ${page.page}`,
  strategy: 'pages',
  text: page.text,
}));

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const inferTextQuality = (text: string) => {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return 'LOW';
  }

  if (normalized.length < 120) {
    return 'PARTIAL';
  }

  const alphaNumericChars = normalized.match(/[A-Za-z0-9]/g)?.length ?? 0;
  const ratio = alphaNumericChars / normalized.length;

  if (ratio < 0.45) {
    return 'LOW';
  }

  return ratio < 0.65 ? 'PARTIAL' : 'GOOD';
};

const isTableBlockType = (blockType: ContractBlockType) => blockType.startsWith('TABLE_');

const normalizeTableFromText = (text: string, blockType: ContractBlockType) => {
  if (!isTableBlockType(blockType)) {
    return { markdown: null, json: null };
  }

  const rows = text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length > 0)
    .slice(0, 80);

  if (!rows.length) {
    return { markdown: null, json: null };
  }

  const markdown = [
    '| Linha |',
    '| --- |',
    ...rows.map((row) => `| ${row.replace(/\|/g, '\\|')} |`),
  ].join('\n');

  return {
    markdown,
    json: JSON.stringify({ rows: rows.map((text, index) => ({ index: index + 1, text })) }),
  };
};

const detectKnownUnitsInText = (
  text: string,
  knownSites: Array<{ id: string; name: string }>,
) => {
  const content = normalizeText(text);
  return knownSites
    .filter((site) => content.includes(normalizeText(site.name)))
    .map((site) => ({ id: site.id, name: site.name }));
};

const findPageNumberForSegment = (segment: ContractSegment, pages: EvidencePage[]) => {
  if (segment.strategy === 'pages') {
    return segment.chunkId;
  }

  const normalizedSegment = normalizeWhitespace(segment.text).slice(0, 240);
  if (!normalizedSegment) {
    return 1;
  }

  const match = pages.find((page) => normalizeWhitespace(page.text).includes(normalizedSegment));
  return match?.page ?? 1;
};

const getBlockDiscardReason = (
  block: Pick<ContractBlock, 'blockType' | 'text'>,
  siteName: string,
  knownSites: Array<{ id: string; name: string }>,
) => {
  if (['COMMERCIAL', 'ADMINISTRATIVE', 'HSE', 'IGNORE'].includes(block.blockType)) {
    return `irrelevant_block_type:${block.blockType}`;
  }

  if (!mentionsSelectedSiteOrGeneralScope(block.text, siteName, knownSites)) {
    return 'not_applicable_to_selected_site';
  }

  if (block.blockType === 'TABLE_KPI_SLA' && !containsAnyNormalized(block.text, directFoodServiceImpactKeywords)) {
    return 'generic_kpi_sla_without_direct_food_service_impact';
  }

  if (block.blockType === 'TEXT_SECTION' && !containsAnyNormalized(block.text, strongMenuBlockKeywords)) {
    return 'text_section_without_strong_menu_signal';
  }

  return null;
};

const buildContractBlocks = (
  segments: ContractSegment[],
  pages: EvidencePage[],
  siteName: string,
  knownSites: Array<{ id: string; name: string }>,
  randomUUID: () => string,
) => segments.map((segment, index): ContractBlock => {
  const blockType = classifyContractBlock(segment.text);
  const pageNumber = findPageNumberForSegment(segment, pages);
  const table = normalizeTableFromText(segment.text, blockType);
  const preliminaryBlock = { ...segment, blockType };
  const discardReason = getBlockDiscardReason(preliminaryBlock, siteName, knownSites);

  return {
    ...segment,
    id: randomUUID(),
    blockType,
    pageNumber,
    blockIndex: index + 1,
    contractPageId: '',
    sourceItem: segment.chunkLabel,
    normalizedText: normalizeWhitespace(segment.text),
    normalizedTableMarkdown: table.markdown,
    normalizedTableJson: table.json,
    detectedUnitsJson: JSON.stringify(detectKnownUnitsInText(segment.text, knownSites)),
    isRelevantForExtraction: discardReason === null,
    discardReason,
  };
});

const persistContractPagesAndBlocks = async (
  client: SqlClient,
  params: {
    tenantId: string;
    siteId: string;
    contractId: string;
    pages: EvidencePage[];
    blocks: ContractBlock[];
    randomUUID: () => string;
  },
) => {
  await client.$executeRaw`
    DELETE FROM contract_blocks
    WHERE tenant_id = ${params.tenantId}
      AND contract_id = ${params.contractId}
  `;

  await client.$executeRaw`
    DELETE FROM contract_pages
    WHERE tenant_id = ${params.tenantId}
      AND contract_id = ${params.contractId}
  `;

  const pageIds = new Map<number, string>();

  for (const page of params.pages) {
    const pageId = params.randomUUID();
    pageIds.set(page.page, pageId);

    await client.$executeRaw`
      INSERT INTO contract_pages (
        id,
        tenant_id,
        site_id,
        contract_id,
        page_number,
        raw_text,
        text_quality,
        created_at
      )
      VALUES (
        ${pageId},
        ${params.tenantId},
        ${params.siteId},
        ${params.contractId},
        ${page.page},
        ${page.text},
        ${inferTextQuality(page.text)},
        ${new Date()}
      )
    `;
  }

  for (const block of params.blocks) {
    const contractPageId = pageIds.get(block.pageNumber) ?? pageIds.get(1);
    if (!contractPageId) {
      continue;
    }

    block.contractPageId = contractPageId;

    await client.$executeRaw`
      INSERT INTO contract_blocks (
        id,
        tenant_id,
        site_id,
        contract_id,
        contract_page_id,
        page_number,
        block_index,
        block_type,
        source_item,
        raw_text,
        normalized_text,
        normalized_table_markdown,
        normalized_table_json,
        detected_units_json,
        is_relevant_for_extraction,
        discard_reason,
        created_at
      )
      VALUES (
        ${block.id},
        ${params.tenantId},
        ${params.siteId},
        ${params.contractId},
        ${contractPageId},
        ${block.pageNumber},
        ${block.blockIndex},
        ${block.blockType},
        ${block.sourceItem},
        ${block.text},
        ${block.normalizedText},
        ${block.normalizedTableMarkdown},
        ${block.normalizedTableJson},
        ${block.detectedUnitsJson},
        ${block.isRelevantForExtraction},
        ${block.discardReason},
        ${new Date()}
      )
    `;
  }

  return params.blocks;
};

const findDeterministicEvidence = (rule: ExtractedRule, pages: EvidencePage[]): RuleWithEvidence => {
  if (rule.sourceExcerpt?.trim()) {
    return {
      ...rule,
      sourceExcerpt: rule.sourceExcerpt.trim().slice(0, 500),
      sourcePage: rule.sourcePage ?? null,
      evidenceConfidence: rule.evidenceConfidence ?? 0.85,
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

const allowedRuleCategories = new Set([
  'PROTEIN',
  'SALAD',
  'SIDE_DISH',
  'RICE',
  'BEAN',
  'JUICE',
  'BEVERAGE',
  'DESSERT',
  'FRUIT',
  'EGG_REPLACEMENT',
  'BUFFET_FREE',
  'BUFFET_SPECIAL',
  'SPECIAL_DISH',
  'LIGHT_VEGAN_OPTION',
  'MONTHLY_INCIDENCE',
  'WEEKLY_PERIODICITY',
  'UNIT_SPECIFIC_RULE',
  'MEAL_TIME',
  'MEAL_VOLUME',
  'MENU_COMPOSITION',
]);

const categoryAliases = new Map<string, string>([
  ['proteina', 'PROTEIN'],
  ['protein', 'PROTEIN'],
  ['salada', 'SALAD'],
  ['salad', 'SALAD'],
  ['guarnicao', 'SIDE_DISH'],
  ['side_dish', 'SIDE_DISH'],
  ['arroz', 'RICE'],
  ['rice', 'RICE'],
  ['feijao', 'BEAN'],
  ['bean', 'BEAN'],
  ['suco', 'JUICE'],
  ['juice', 'JUICE'],
  ['bebida', 'BEVERAGE'],
  ['beverage', 'BEVERAGE'],
  ['sobremesa', 'DESSERT'],
  ['dessert', 'DESSERT'],
  ['fruta', 'FRUIT'],
  ['fruit', 'FRUIT'],
  ['ovo', 'EGG_REPLACEMENT'],
  ['egg_replacement', 'EGG_REPLACEMENT'],
  ['buffet_livre', 'BUFFET_FREE'],
  ['buffet_free', 'BUFFET_FREE'],
  ['buffet_especial', 'BUFFET_SPECIAL'],
  ['buffet_special', 'BUFFET_SPECIAL'],
  ['prato_especial', 'SPECIAL_DISH'],
  ['special_dish', 'SPECIAL_DISH'],
  ['light_vegana', 'LIGHT_VEGAN_OPTION'],
  ['light_vegan_option', 'LIGHT_VEGAN_OPTION'],
  ['incidencia_mensal', 'MONTHLY_INCIDENCE'],
  ['monthly_incidence', 'MONTHLY_INCIDENCE'],
  ['periodicidade_semanal', 'WEEKLY_PERIODICITY'],
  ['weekly_periodicity', 'WEEKLY_PERIODICITY'],
  ['regra_unidade', 'UNIT_SPECIFIC_RULE'],
  ['unit_specific_rule', 'UNIT_SPECIFIC_RULE'],
  ['horario_refeicao', 'MEAL_TIME'],
  ['meal_time', 'MEAL_TIME'],
  ['volume_refeicao', 'MEAL_VOLUME'],
  ['meal_volume', 'MEAL_VOLUME'],
  ['composicao_cardapio', 'MENU_COMPOSITION'],
  ['menu_composition', 'MENU_COMPOSITION'],
]);

const allowedPeriodicities = new Set(['DAILY', 'WEEKLY', 'MONTHLY', 'PER_SERVICE', 'PER_MENU_CYCLE']);

const periodicityAliases = new Map<string, string>([
  ['diaria', 'DAILY'],
  ['diario', 'DAILY'],
  ['daily', 'DAILY'],
  ['semanal', 'WEEKLY'],
  ['weekly', 'WEEKLY'],
  ['mensal', 'MONTHLY'],
  ['monthly', 'MONTHLY'],
  ['por_servico', 'PER_SERVICE'],
  ['per_service', 'PER_SERVICE'],
  ['por_ciclo', 'PER_MENU_CYCLE'],
  ['per_menu_cycle', 'PER_MENU_CYCLE'],
]);

const normalizeEnumToken = (value: string) => normalizeText(value)
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const normalizeRuleCategory = (value: string | null) => {
  if (!value) {
    return null;
  }

  const upper = value.trim().toUpperCase();
  if (allowedRuleCategories.has(upper)) {
    return upper;
  }

  return categoryAliases.get(normalizeEnumToken(value)) ?? null;
};

const normalizePeriodicity = (value: string | null) => {
  if (!value) {
    return null;
  }

  const upper = value.trim().toUpperCase();
  if (allowedPeriodicities.has(upper)) {
    return upper;
  }

  return periodicityAliases.get(normalizeEnumToken(value)) ?? null;
};

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
  'equipamento',
  'hse',
  'seguranca do trabalho',
  'epi',
  'recurso humano',
  'rh',
];

const blockTypeLabels: Record<ContractBlockType, string> = {
  TEXT_SECTION: 'TEXT_SECTION',
  TABLE_MENU_INCIDENCE: 'TABLE_MENU_INCIDENCE',
  MENU_COMPOSITION: 'MENU_COMPOSITION',
  TABLE_HOURS: 'TABLE_HOURS',
  TABLE_VOLUME: 'TABLE_VOLUME',
  TABLE_KPI_SLA: 'TABLE_KPI_SLA',
  ADMINISTRATIVE: 'ADMINISTRATIVE',
  COMMERCIAL: 'COMMERCIAL',
  HSE: 'HSE',
  IGNORE: 'IGNORE',
};

const strongMenuBlockKeywords = [
  'cardapio',
  'refeicao',
  'buffet',
  'proteina',
  'salada',
  'guarnicao',
  'sobremesa',
  'fruta',
  'incidencia',
  'composicao',
  'horario',
  'volume',
];

const directFoodServiceImpactKeywords = [
  'alteracao de cardapio',
  'apresentacao dos pratos',
  'limpeza de buffet',
  'limpeza do buffet',
  'limpeza de salao',
  'limpeza do salao',
  'parada de rampa',
  'atraso de producao',
  'atraso na producao',
  'distribuicao de refeicao',
  'servico de refeicao',
  'rampa por atraso',
];

const containsAnyNormalized = (text: string, keywords: string[]) => {
  const content = normalizeText(text);
  return keywords.some((keyword) => content.includes(normalizeText(keyword)));
};

const mentionsSelectedSiteOrGeneralScope = (
  text: string,
  siteName: string,
  knownSites: Array<{ id: string; name: string }>,
) => {
  const content = normalizeText(text);
  const selected = normalizeText(siteName);
  const mentionedKnownSites = knownSites
    .map((site) => normalizeText(site.name))
    .filter((name) => name.length > 0 && content.includes(name));

  if (!mentionedKnownSites.length) {
    return true;
  }

  return (
    content.includes(selected) ||
    allUnitsMarkers.some((marker) => content.includes(marker))
  );
};

const classifyContractBlock = (text: string): ContractBlockType => {
  const content = normalizeText(text);

  const hasMenuSignal = operationalRuleKeywords.some((keyword) => content.includes(normalizeText(keyword)));
  const hasOutOfScopeSignal = outOfScopeKeywords.some((keyword) => content.includes(normalizeText(keyword)));

  if (/\b(kpi|sla|indicador|nivel de servico|acordo de nivel)\b/.test(content)) {
    return 'TABLE_KPI_SLA';
  }

  if (/\b(hse|ssma|seguranca do trabalho|epi|acidente|ambiental)\b/.test(content)) {
    return hasMenuSignal ? 'TEXT_SECTION' : 'HSE';
  }

  if (/\b(preco|valor|faturamento|nota fiscal|pagamento|reajuste|proposta comercial)\b/.test(content)) {
    return hasMenuSignal ? 'TEXT_SECTION' : 'COMMERCIAL';
  }

  if (/\b(documentacao|cadastro|certidao|seguro|multa|penalidade|trabalhista|recurso humano|rh)\b/.test(content)) {
    return hasMenuSignal ? 'TEXT_SECTION' : 'ADMINISTRATIVE';
  }

  if (!hasMenuSignal || hasOutOfScopeSignal) {
    return hasMenuSignal ? 'TEXT_SECTION' : 'IGNORE';
  }

  if (/\b(incidencia|frequencia|periodicidade|mensal|semanal)\b/.test(content)) {
    return 'TABLE_MENU_INCIDENCE';
  }

  if (/\b(composicao|cardapio|buffet|salada|guarnicao|arroz|feijao|sobremesa|fruta|suco|bebida)\b/.test(content)) {
    return 'MENU_COMPOSITION';
  }

  if (/\b(horario|desjejum|almoco|jantar|ceia|lanche)\b/.test(content)) {
    return 'TABLE_HOURS';
  }

  if (/\b(volume|quantidade de refeicoes|refeicoes diarias|numero de refeicoes)\b/.test(content)) {
    return 'TABLE_VOLUME';
  }

  return 'TEXT_SECTION';
};

const shouldSendBlockToAi = (
  block: ContractBlock,
  siteName: string,
  knownSites: Array<{ id: string; name: string }>,
) => {
  if (['COMMERCIAL', 'ADMINISTRATIVE', 'HSE', 'IGNORE'].includes(block.blockType)) {
    return false;
  }

  if (!mentionsSelectedSiteOrGeneralScope(block.text, siteName, knownSites)) {
    return false;
  }

  if (block.blockType === 'TABLE_KPI_SLA') {
    return containsAnyNormalized(block.text, directFoodServiceImpactKeywords);
  }

  if (block.blockType === 'TEXT_SECTION') {
    return containsAnyNormalized(block.text, strongMenuBlockKeywords);
  }

  return ['TABLE_MENU_INCIDENCE', 'MENU_COMPOSITION', 'TABLE_HOURS', 'TABLE_VOLUME'].includes(block.blockType);
};

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
    .map((rule): ExtractedRule | null => {
      const title = readStringField(rule, ['title', 'titulo', 'tipo_regra'])?.slice(0, 120) ?? '';
      const description = readStringField(rule, ['description', 'descricao']) ?? '';
      const category = normalizeRuleCategory(readStringField(rule, ['category', 'categoria']));
      const periodicity = normalizePeriodicity(readStringField(rule, ['periodicity', 'periodicidade']));
      const rawApplicability = readStringField(rule, ['applicability', 'aplicabilidade']) ?? 'general';
      const applicability = allowedApplicability.has(rawApplicability)
        ? rawApplicability as ExtractedRule['applicability']
        : 'general';
      const ruleType = readStringField(rule, ['ruleType', 'rule_type', 'tipo_regra']) ?? 'operational_menu_rule';
      const quantity = readNumberField(rule, ['quantity', 'quantidade']);

      if (!title || !description || !category || !periodicity) {
        return null;
      }

      const normalized = { title, description, category };

      if (!isOperationalMenuRule(normalized)) {
        return null;
      }

      return {
        ...normalized,
        ruleType,
        periodicity,
        quantity,
        unitMeasure: readStringField(rule, ['unitMeasure', 'unit_measure', 'unidade_medida']),
        calculationBasis: readStringField(rule, ['calculationBasis', 'calculation_basis', 'base_calculo']),
        applicability,
        originGroupText: readStringField(rule, ['originGroupText', 'origin_group_text', 'grupo_origem_no_contrato']),
        detectedUnits: readStringArrayField(rule, ['detectedUnits', 'detected_units', 'unidades_aplicaveis', 'unidades_detectadas_no_trecho']),
        sourceItem: readStringField(rule, ['sourceSection', 'source_section', 'sourceItem', 'source_item', 'item', 'fonte_item']),
        sourceExcerpt: readStringField(rule, ['sourceExcerpt', 'source_excerpt', 'trecho_evidencia'])?.slice(0, 500) ?? null,
        sourcePage: readNumberField(rule, ['sourcePage', 'source_page', 'pagina', 'fonte_pagina']),
        evidenceConfidence: readNumberField(rule, ['evidenceConfidence', 'evidence_confidence', 'confianca']),
      };
    })
    .filter((rule): rule is ExtractedRule => rule !== null);
};

const allUnitsMarkers = [
  'todas as unidades',
  'todas unidades',
  'todos os restaurantes',
  'todos restaurantes',
  'todo o contrato',
  'unidades do contrato',
];

const ruleAppliesToSelectedSite = (rule: ExtractedRule, siteName: string) => {
  const selected = normalizeText(siteName);
  const detectedUnits = rule.detectedUnits.map((unit) => normalizeText(unit));
  const originGroup = normalizeText(rule.originGroupText ?? '');
  const evidence = normalizeText(rule.sourceExcerpt ?? '');
  const description = normalizeText(rule.description);

  return (
    detectedUnits.some((unit) => unit === selected || unit.includes(selected) || selected.includes(unit)) ||
    originGroup.includes(selected) ||
    evidence.includes(selected) ||
    description.includes(selected) ||
    allUnitsMarkers.some((marker) => evidence.includes(marker) || originGroup.includes(marker) || description.includes(marker))
  );
};

type RuleDiscardReason =
  | 'missing_contract'
  | 'missing_site'
  | 'invalid_category'
  | 'invalid_periodicity'
  | 'missing_description'
  | 'missing_evidence'
  | 'missing_page'
  | 'missing_section'
  | 'non_literal_excerpt'
  | 'not_explicitly_applicable_to_site'
  | 'out_of_scope';

type RuleValidationResult =
  | { valid: true; rule: RuleWithEvidence & { sourceItem: string; category: string; periodicity: string } }
  | { valid: false; reason: RuleDiscardReason; rule: RuleWithEvidence };

const normalizeEvidenceForComparison = (value: string) => normalizeText(value).replace(/\s+/g, ' ').trim();

const hasLiteralEvidence = (rule: RuleWithEvidence, pages: EvidencePage[]) => {
  if (!rule.sourceExcerpt?.trim() || !rule.sourcePage) {
    return false;
  }

  const page = pages.find((item) => item.page === rule.sourcePage);
  const normalizedExcerpt = normalizeEvidenceForComparison(rule.sourceExcerpt);

  if (!page || !normalizedExcerpt) {
    return false;
  }

  return normalizeEvidenceForComparison(page.text).includes(normalizedExcerpt);
};

const validateExtractedRule = (
  rule: RuleWithEvidence,
  site: { id: string; tenantId: string; name: string },
  contractId: string,
  pages: EvidencePage[],
): RuleValidationResult => {
  if (!contractId) {
    return { valid: false, reason: 'missing_contract', rule };
  }

  if (!site.id) {
    return { valid: false, reason: 'missing_site', rule };
  }

  if (!allowedRuleCategories.has(rule.category)) {
    return { valid: false, reason: 'invalid_category', rule };
  }

  if (!rule.periodicity || !allowedPeriodicities.has(rule.periodicity)) {
    return { valid: false, reason: 'invalid_periodicity', rule };
  }

  if (!rule.description.trim()) {
    return { valid: false, reason: 'missing_description', rule };
  }

  if (!rule.sourceExcerpt?.trim()) {
    return { valid: false, reason: 'missing_evidence', rule };
  }

  if (!rule.sourcePage) {
    return { valid: false, reason: 'missing_page', rule };
  }

  if (!rule.sourceItem?.trim()) {
    return { valid: false, reason: 'missing_section', rule };
  }

  if (!hasLiteralEvidence(rule, pages)) {
    return { valid: false, reason: 'non_literal_excerpt', rule };
  }

  if (!ruleAppliesToSelectedSite(rule, site.name)) {
    return { valid: false, reason: 'not_explicitly_applicable_to_site', rule };
  }

  if (!isOperationalMenuRule(rule)) {
    return { valid: false, reason: 'out_of_scope', rule };
  }

  return {
    valid: true,
    rule: {
      ...rule,
      sourceItem: rule.sourceItem.trim(),
      category: rule.category,
      periodicity: rule.periodicity,
    },
  };
};

export const extractRulesFromPdf = async (
  deps: Deps,
  contractId: string,
  pdfBuffer: Buffer,
  companyName: string,
  site: { id: string; tenantId: string; name: string },
  knownSites: Array<{ id: string; name: string }>,
  actor: { id: string; name: string } = { id: 'system', name: 'Processamento documental' },
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
  let parsedPdf: PdfTextResult = {};

  try {
    parsedPdf = await parser.getText();
    contractText = (parsedPdf.text ?? '').trim();
    if (!contractText && Array.isArray(parsedPdf.pages)) {
      contractText = parsedPdf.pages
        .map((page) => page.text ?? '')
        .join('\n\n')
        .trim();
    }
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

  const evidencePages = buildEvidencePagesFromPdf(parsedPdf, pageChunkChars);
  const hasParserPages = Array.isArray(parsedPdf.pages) && parsedPdf.pages.length > 0;
  const clauseSegments = hasParserPages ? [] : splitByClauses(contractText);
  const baseSegments = hasParserPages
    ? buildPageSegments(evidencePages)
    : clauseSegments.length
      ? clauseSegments
      : splitByPagesFallback(contractText, pageChunkChars);
  const candidateSegments = baseSegments.length
    ? baseSegments
    : [{ chunkId: 1, chunkLabel: 'Documento completo', strategy: 'pages' as const, text: contractText }];
  const classifiedBlocks = buildContractBlocks(candidateSegments, evidencePages, site.name, knownSites, deps.randomUUID);
  const persistedBlocks = await (deps.prisma.$transaction
    ? deps.prisma.$transaction((tx) => persistContractPagesAndBlocks(tx, {
      tenantId: site.tenantId,
      siteId: site.id,
      contractId,
      pages: evidencePages,
      blocks: classifiedBlocks,
      randomUUID: deps.randomUUID,
    }))
    : persistContractPagesAndBlocks(deps.prisma, {
      tenantId: site.tenantId,
      siteId: site.id,
      contractId,
      pages: evidencePages,
      blocks: classifiedBlocks,
      randomUUID: deps.randomUUID,
    })
  );
  const segments = persistedBlocks.filter((block) => (
    block.isRelevantForExtraction && shouldSendBlockToAi(block, site.name, knownSites)
  )).slice(0, maxSegments);

  const knownSiteNames = knownSites.map((knownSite) => knownSite.name).join(', ');
  const promptTemplate = `Voce esta extraindo regras operacionais de cardapio para:

Cliente: ${companyName}
Unidade selecionada: ${site.name}
Contrato: ${contractId}
Unidades conhecidas do cliente: ${knownSiteNames || site.name}

Extraia somente regras que impactem montagem, aprovacao ou validacao de cardapio, alimentacao e conformidade nutricional/contratual.

Inclua regras sobre quantidade de opcoes por dia, frequencia mensal, incidencia de proteinas, tipos de proteina, substituicoes, repeticao, buffet livre, buffet especial, prato especial, salada, guarnicao, arroz, feijao, sobremesa, fruta, suco, bebida, cafe, cha, ovo, opcoes light/vegana/restritivas, alergenicos, horarios/volumes de refeicao e composicao de cardapio.

Ignore clausulas juridicas gerais, multas, SLA, seguros, HSE, RH, equipamentos, documentos administrativos, dados comerciais, proposta comercial, obrigacoes trabalhistas, penalidades, cadastro, contato e qualquer clausula sem impacto direto no cardapio.

Criterios de aplicabilidade:
1. Extraia regras gerais quando o texto indicar todas as unidades/localidades/restaurantes/turnos ou todo o contrato.
2. Extraia regras que citem diretamente a unidade selecionada.
3. Extraia regras de grupos somente quando a unidade selecionada estiver explicitamente no grupo citado.
4. Ignore regras de outras unidades.
5. Nao use contratos anteriores.
6. Nao inferir por semelhanca.
7. Toda regra precisa de evidencia textual literal ou tabela de origem.
8. Nao crie regras sem pagina, item/secao e trecho literal.
9. Use somente estas categorias: PROTEIN, SALAD, SIDE_DISH, RICE, BEAN, JUICE, BEVERAGE, DESSERT, FRUIT, EGG_REPLACEMENT, BUFFET_FREE, BUFFET_SPECIAL, SPECIAL_DISH, LIGHT_VEGAN_OPTION, MONTHLY_INCIDENCE, WEEKLY_PERIODICITY, UNIT_SPECIFIC_RULE, MEAL_TIME, MEAL_VOLUME, MENU_COMPOSITION.
10. Use somente estas periodicidades: DAILY, WEEKLY, MONTHLY, PER_SERVICE, PER_MENU_CYCLE.

Responda apenas JSON no formato:
{"rules":[{"title":"Titulo curto","description":"Descricao operacional","rule_type":"incidencia_cardapio","category":"PROTEIN","periodicity":"MONTHLY","quantity":14,"unitMeasure":"incidences","calculation_basis":"22 dias uteis","applicability":"site_group","detectedUnits":["${site.name}"],"originGroupText":"Grupo literal do contrato","sourceItem":"19","sourcePage":21,"sourceExcerpt":"Trecho literal de evidencia"}]}`;

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
    discardedRules: [],
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

Bloco classificado: ${blockTypeLabels[segment.blockType]}
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

      const normalizedChunkRules = normalizeExtractedRules(extractedPayload)
        .map((rule) => ({ ...rule, sourceBlockId: segment.id }));
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

  const normalizedRules = Array.from(dedupedRulesMap.values());
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

  const validationResults = rulesWithEvidence.map((rule) => validateExtractedRule(rule, site, contractId, evidencePages));
  const blockById = new Map(persistedBlocks.map((block) => [block.id, block]));
  const discardedRules = validationResults
    .filter((result): result is Extract<RuleValidationResult, { valid: false }> => !result.valid)
    .map((result) => {
      const block = result.rule.sourceBlockId ? blockById.get(result.rule.sourceBlockId) : null;

      return {
        reason: result.reason,
        title: result.rule.title,
        category: result.rule.category,
        periodicity: result.rule.periodicity,
        sourcePage: result.rule.sourcePage,
        sourceBlockId: result.rule.sourceBlockId ?? null,
        blockPageNumber: block?.pageNumber ?? null,
        sourceItem: result.rule.sourceItem,
        detectedUnits: result.rule.detectedUnits,
        originGroupText: result.rule.originGroupText,
      };
    });

  for (const rule of discardedRules) {
    console.info('[contracts.extractRules.discardedRule]', {
      contractId,
      page: rule.sourcePage,
      blockPage: rule.blockPageNumber,
      sourceBlockId: rule.sourceBlockId,
      sourceItem: rule.sourceItem,
      category: rule.category,
      periodicity: rule.periodicity,
      reason: rule.reason,
      missingFields: [
        !rule.category ? 'category' : null,
        !rule.periodicity ? 'periodicity' : null,
        !rule.sourcePage ? 'sourcePage' : null,
        !rule.sourceItem ? 'sourceItem' : null,
      ].filter(Boolean),
      evidenceNotLiteral: rule.reason === 'non_literal_excerpt',
      unitNotApplicable: rule.reason === 'not_explicitly_applicable_to_site',
    });
  }

  rulesWithEvidence = validationResults
    .filter((result): result is Extract<RuleValidationResult, { valid: true }> => result.valid)
    .map((result) => result.rule);

  diagnostics.rulesDetected = rulesWithEvidence.length;
  diagnostics.schemaValid = rulesWithEvidence.length > 0;
  diagnostics.rulesWithEvidence = rulesWithEvidence.length;
  diagnostics.rulesWithoutEvidence = discardedRules.filter((rule) => rule.reason === 'missing_evidence' || rule.reason === 'missing_page' || rule.reason === 'non_literal_excerpt').length;
  diagnostics.discardedBySchema += discardedRules.length;
  diagnostics.discardedRules = discardedRules;

  if (!rulesWithEvidence.length) {
    diagnostics.outcome = segments.length > 0 && timeoutCount === segments.length ? 'error' : 'empty';
    diagnostics.errorMessage = segments.length > 0 && timeoutCount === segments.length
      ? `Timeout em todos os ${segments.length} segmentos`
      : segments.length > 0 && diagnostics.chunks.every((chunk) => chunk.outcome === 'error')
        ? 'Falha ao processar todos os segmentos no Ollama'
        : null;
    await persistDiagnostics();

    if (segments.length > 0 && timeoutCount === segments.length) {
      return {
        statusCode: 504,
        body: {
          status: 'error',
          message: `Ollama excedeu o tempo limite de ${Math.floor(ollamaTimeoutMs / 1000)}s em todos os segmentos.`,
        },
      };
    }

    if (segments.length > 0 && diagnostics.chunks.every((chunk) => chunk.outcome === 'error')) {
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
    sourceItem: string | null;
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
        source_block_id,
        evidence_confidence,
        status,
        created_at,
        updated_at
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
        ${rule.sourceBlockId ?? null},
        ${rule.evidenceConfidence},
        ${'pending'},
        ${createdAt},
        ${createdAt}
      )
    `;

    const eventId = deps.randomUUID();
    await deps.prisma.$executeRaw`
      INSERT INTO rule_validation_events (
        id,
        tenant_id,
        site_id,
        company_name,
        rule_id,
        previous_status,
        next_status,
        note,
        actor_id,
        actor_name,
        created_at,
        updated_at
      )
      VALUES (
        ${eventId},
        ${site.tenantId},
        ${site.id},
        ${companyName},
        ${ruleId},
        ${'pending'},
        ${'pending'},
        ${'Regra identificada com evidencia e enviada para aprovacao humana.'},
        ${actor.id},
        ${actor.name},
        ${createdAt},
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
      sourceItem: rule.sourceItem,
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
            updated_at = NOW()
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
          updated_at = NOW()
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
      INSERT INTO contracts (id, tenant_id, site_id, company_name, title, source_type, status, created_by, created_at, updated_at)
      VALUES (
        ${contractId},
        ${tenantId},
        ${siteAccess.site.id},
        ${companyName},
        ${payload.title},
        ${payload.sourceType},
        ${'processing'},
        ${actor.id},
        NOW(),
        NOW()
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
            actor,
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
        created_at: Date;
      }>
    >`
      SELECT contract.id, contract.site_id, site.name AS site_name, contract.title, contract.source_type,
             contract.status, contract.created_at
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
          extractedText,
          inactivationReason: null,
          inactivatedAt: null,
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
        created_at: Date;
      }>
    >`
      SELECT contract.id, contract.site_id, site.name AS site_name, contract.title, contract.source_type,
             contract.status, contract.created_at
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
          extractedText: null,
          inactivationReason: null,
          inactivatedAt: null,
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
        created_at: Date;
      }>
    >`
      SELECT contract.id, contract.site_id, site.name AS site_name, contract.title, contract.source_type,
             contract.status, contract.created_at
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
          extractedText: null,
          inactivationReason: null,
          inactivatedAt: null,
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

