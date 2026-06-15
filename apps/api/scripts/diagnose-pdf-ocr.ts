import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PDFParse } from 'pdf-parse';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import { createWorker } from 'tesseract.js';

const require = createRequire(import.meta.url);
const engLangData = require('@tesseract.js-data/eng') as { langPath: string };

type PdfTextPage = {
  text?: string;
  num?: number;
  pageNumber?: number;
  page?: number;
};

type PdfTextResult = {
  pages?: PdfTextPage[];
  text?: string;
};

type TextQuality = 'GOOD_TEXT' | 'PARTIAL_TEXT' | 'LOW_TEXT';
type PageClassification = TextQuality | 'VISUAL_TABLE_REQUIRES_OCR' | 'IGNORE';

type CompareMetrics = {
  chars: number;
  usefulLines: number;
  detectedTerms: string[];
  quality: TextQuality;
  preview: string;
  bulletCount: number;
  bulletLevel: 'low' | 'medium' | 'high';
  hasCutTerms: boolean;
  hasNumbers: boolean;
  numberCount: number;
  titleLikeLines: string[];
};

type TextVariant = {
  text: string;
  metrics: CompareMetrics;
};

type TextAnalysis = {
  raw: TextVariant;
  cleaned: TextVariant;
};

type CropRatio = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CropMode = 'none' | 'table' | 'ratio';

type CropConfig = {
  mode: CropMode;
  ratio: CropRatio | null;
};

type CropComparison = {
  usefulLinesDelta: number;
  numberDelta: number;
  cutTermsDelta: number;
  orderedSignalsDelta: number;
  noiseDelta: number;
  improvedTableReadability: boolean;
  notes: string[];
};

type ExtractionConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

type StructuredTableRow = {
  proteinType: string;
  totalIncidence: number | null;
  quantity: number | null;
  cut: string;
  confidence: ExtractionConfidence;
  sourceLine: string;
};

type TableStructureQuality = {
  hasHeader: boolean;
  hasTotalIncidence: boolean;
  hasCuts: boolean;
  hasQuantities: boolean;
  isReliableForAutomaticRule: boolean;
};

type TableStructureDiagnostic = {
  sourcePage: number;
  sourceItem: string;
  tableType: 'protein_monthly_incidence';
  rows: StructuredTableRow[];
  ambiguousLines: string[];
  inconsistencies: string[];
  incidenceValidation: string[];
  quality: TableStructureQuality;
};

type PageDiagnostic = {
  page: number;
  parser: TextAnalysis;
  ocr: TextAnalysis;
  ocrRegion: TextAnalysis | null;
  cropMode: CropMode;
  cropRect: CropRatio | null;
  cropComparison: CropComparison | null;
  tableStructure: TableStructureDiagnostic | null;
  classification: PageClassification;
  detectedTerms: string[];
  recoveredTerms: string[];
  sectionTitle: string | null;
  isContextPage: boolean;
  isVisualTablePage: boolean;
  requiresOcr: boolean;
  ocrImprovedContent: boolean;
  recoveredCutsOrQuantities: boolean;
  stillNeedsRegionCropping: boolean;
  reason: string;
  recommendedPipelineAction: string;
};

type TargetWindowAssessment = {
  targetPage: number;
  windowPages: number[];
  contextPages: number[];
  degradedTablePages: number[];
  relatedBlocks: ComposedBlockCandidate[];
};

type ComposedBlockCandidate = {
  section: string;
  pages: number[];
  contextPages: number[];
  tablePages: number[];
  evidence: string[];
  whyGrouped: string;
  reason: string;
  score: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  requiresOcr: boolean;
  needsRegionCropping: boolean;
  recommendedPipelineAction: 'run_selective_ocr_with_table_region_detection' | 'run_selective_ocr_for_table_page' | 'no_action';
};

const IMPORTANT_TERMS = [
  'cardapio',
  'proteina',
  'proteinas',
  'incidencia',
  'incidencia total',
  'buffet',
  'carne bovina',
  'frango',
  'suinos',
  'pescados',
  'corte',
  'cortes',
  'quantidade',
  'qtdade',
  '22 dias uteis',
  'dias uteis',
  'kg',
  'gramas',
  'menu',
  'ciclo',
  'peixe',
  'carne',
  'acem',
  'paleta',
  'coxao',
  'patinho',
  'salmao',
  'merluza',
] as const;

const CUT_TERMS = [
  'acem',
  'paleta',
  'coxao',
  'patinho',
  'contra file',
  'costela',
  'musculo',
  'parmegiana',
  'maminha',
  'fraldinha',
  'lagarto',
  'salmao',
  'merluza',
  'tilapia',
];

const PROTECTED_TERMS = ['item', 'cardapio', 'proteina', 'incidencia', 'buffet', 'quantidade', 'corte', 'kg', 'g'];
const BLOCK_THEME_TERMS = ['incidencia', 'proteina', 'proteinas', 'buffet', 'corte', 'cortes', 'quantidade', 'cardapio', 'frango', 'carne', 'pescados', 'peixe', '22 dias uteis', 'dias uteis'] as const;
const TABLE_ORDER_SIGNALS = ['carne bovina', 'frango', 'suinos', 'pescados', 'outros', 'total'] as const;
const NOISE_TERMS = ['facilities', 'proposta', 'contratada', 'comercio por confianca', 'desconto em folha'];
const PROTEIN_TYPE_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
  { canonical: 'Carne Bovina', aliases: ['carne bovina', 'bovina', 'boi', 'carnes bovinas'] },
  { canonical: 'Frango', aliases: ['frango', 'aves'] },
  { canonical: 'Suinos', aliases: ['suinos', 'suino', 'suina', 'suinas', 'porco'] },
  { canonical: 'Pescados', aliases: ['pescados', 'peixe', 'peixes'] },
  { canonical: 'Outros', aliases: ['outros', 'outras'] },
];
const CUT_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
  { canonical: 'Acem', aliases: ['acem'] },
  { canonical: 'Paleta', aliases: ['paleta'] },
  { canonical: 'Musculo', aliases: ['musculo'] },
  { canonical: 'Coxao Duro', aliases: ['coxao duro'] },
  { canonical: 'Coxao Mole', aliases: ['coxao mole'] },
  { canonical: 'Patinho', aliases: ['patinho'] },
  { canonical: 'Patinho Moido', aliases: ['patinho moido'] },
  { canonical: 'Contra File', aliases: ['contra file'] },
  { canonical: 'Costela', aliases: ['costela'] },
  { canonical: 'Parmegiana/Patinho', aliases: ['parmegiana', 'parmegiana patinho'] },
  { canonical: 'File', aliases: ['file', 'filé'] },
  { canonical: 'Sobrecoxa', aliases: ['sobrecoxa'] },
  { canonical: 'Coxa', aliases: ['coxa'] },
];

const normalizeText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const uniqueNumbers = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);

const parseArgs = (argv: string[]) => {
  const args = [...argv];
  const pdfPath = args.shift();

  if (!pdfPath) {
    throw new Error('Uso: tsx scripts/diagnose-pdf-ocr.ts "caminho.pdf" --pages 20,21 [--context 1] [--out tmp/pdf-ocr-diagnostics]');
  }

  let pages: number[] = [];
  let outPath: string | null = null;
  let previewChars = 1500;
  let context = 0;
  let cropMode: CropMode = 'none';
  let cropRatio: CropRatio | null = null;
  let extractTableStructure = false;

  for (let i = 0; i < args.length; i += 1) {
    const current = args[i];
    const next = args[i + 1];

    if (current === '--pages' && next) {
      pages = next
        .split(',')
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isInteger(value) && value > 0);
      i += 1;
      continue;
    }

    if (current === '--context' && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 3) {
        context = parsed;
      }
      i += 1;
      continue;
    }

    if (current === '--out' && next) {
      outPath = next;
      i += 1;
      continue;
    }

    if (current === '--crop' && next) {
      const normalized = next.trim().toLowerCase();
      if (normalized === 'table') {
        cropMode = 'table';
      }
      i += 1;
      continue;
    }

    if (current === '--crop-ratio' && next) {
      const values = next.split(',').map((value) => Number.parseFloat(value.trim()));
      if (values.length === 4 && values.every((value) => Number.isFinite(value))) {
        const [x, y, width, height] = values;
        cropRatio = {
          x: Math.min(1, Math.max(0, x)),
          y: Math.min(1, Math.max(0, y)),
          width: Math.min(1, Math.max(0.05, width)),
          height: Math.min(1, Math.max(0.05, height)),
        };
        cropMode = 'ratio';
      }
      i += 1;
      continue;
    }

    if (current === '--preview' && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isInteger(parsed) && parsed >= 500 && parsed <= 4000) {
        previewChars = parsed;
      }
      i += 1;
      continue;
    }

    if (current === '--extract-table-structure') {
      extractTableStructure = true;
      continue;
    }
  }

  return {
    pdfPath,
    pages,
    outPath,
    previewChars,
    context,
    crop: {
      mode: cropMode,
      ratio: cropRatio,
    } satisfies CropConfig,
    extractTableStructure,
  };
};

const toLines = (text: string) => text
  .split(/\r?\n/)
  .map((line) => line.replace(/\s+/g, ' ').trim());

const countUsefulLines = (text: string) => toLines(text)
  .filter((line) => {
    if (!line) {
      return false;
    }

    if (/^[•\-o\s]+$/.test(line)) {
      return false;
    }

    return /[a-zA-Z0-9]/.test(line);
  }).length;

const detectTerms = (text: string) => {
  const normalized = normalizeText(text);
  return IMPORTANT_TERMS.filter((term) => normalized.includes(term));
};

const detectTitleLikeLines = (text: string) => toLines(text)
  .filter((line) => {
    if (!line) {
      return false;
    }

    return /^item\s+\d+/i.test(line)
      || /(incidencia|proteinas|buffet|cardapio|ciclo)/i.test(line);
  })
  .slice(0, 4);

const inferTextQuality = (
  chars: number,
  usefulLines: number,
  bulletCount: number,
  detectedTerms: string[],
  numberCount: number,
) => {
  const bulletRatio = chars > 0 ? bulletCount / chars : 0;

  if (chars < 90 || usefulLines <= 1) {
    return 'LOW_TEXT' as const;
  }

  if (chars < 220 || usefulLines <= 3 || bulletRatio >= 0.12) {
    return 'LOW_TEXT' as const;
  }

  if (chars < 900 || usefulLines < 8 || bulletRatio >= 0.05 || (detectedTerms.length < 2 && numberCount < 3)) {
    return 'PARTIAL_TEXT' as const;
  }

  return 'GOOD_TEXT' as const;
};

const buildMetrics = (text: string, previewChars: number): CompareMetrics => {
  const safeText = text.trim();
  const normalized = normalizeText(safeText);
  const chars = safeText.length;
  const usefulLines = countUsefulLines(safeText);
  const bulletCount = (safeText.match(/[•]/g) ?? []).length + (safeText.match(/^[-*]\s+/gm) ?? []).length;
  const bulletRatio = chars > 0 ? bulletCount / chars : 0;
  const bulletLevel: CompareMetrics['bulletLevel'] = bulletRatio >= 0.12
    ? 'high'
    : bulletRatio >= 0.05
      ? 'medium'
      : 'low';
  const detectedTerms = detectTerms(safeText);
  const numberCount = normalized.match(/\b\d+(?:[.,]\d+)?\b/g)?.length ?? 0;

  return {
    chars,
    usefulLines,
    detectedTerms,
    quality: inferTextQuality(chars, usefulLines, bulletCount, detectedTerms, numberCount),
    preview: safeText.slice(0, previewChars),
    bulletCount,
    bulletLevel,
    hasCutTerms: CUT_TERMS.some((term) => normalized.includes(term)),
    hasNumbers: numberCount > 0,
    numberCount,
    titleLikeLines: detectTitleLikeLines(safeText),
  };
};

const getParserTextByPage = (parsed: PdfTextResult) => {
  const pageMap = new Map<number, string>();
  const pages = Array.isArray(parsed.pages) ? parsed.pages : [];

  for (const [index, page] of pages.entries()) {
    const pageNumber = page.num ?? page.pageNumber ?? page.page ?? index + 1;
    if (!Number.isInteger(pageNumber) || pageNumber <= 0) {
      continue;
    }

    pageMap.set(pageNumber, (page.text ?? '').trim());
  }

  return pageMap;
};

const hasProtectedSignal = (line: string) => {
  const normalized = normalizeText(line);
  return /^item\s+\d+/i.test(line)
    || PROTECTED_TERMS.some((term) => normalized.includes(term))
    || /\b(kg|g|grama|gramas|unidade|unidades)\b/i.test(line);
};

const collectRepeatedLines = (texts: string[]) => {
  const counts = new Map<string, number>();

  for (const text of texts) {
    for (const line of toLines(text)) {
      if (!line) {
        continue;
      }

      const normalized = normalizeText(line);
      if (normalized.length < 4 || normalized.length > 80 || hasProtectedSignal(line)) {
        continue;
      }

      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([line]) => line),
  );
};

const isNoiseLine = (line: string, repeatedLines: Set<string>) => {
  const normalized = normalizeText(line);

  if (!line) {
    return true;
  }

  if (/slb-private/i.test(line)) {
    return true;
  }

  if (/^(page\s+)?\d+(\s*(of|de)\s*\d+)?$/i.test(line)) {
    return true;
  }

  if (/^[•\-_*\s]+$/.test(line)) {
    return true;
  }

  if (/^(confidential|private|internal|copyright)$/i.test(line)) {
    return true;
  }

  if (!hasProtectedSignal(line) && repeatedLines.has(normalized)) {
    return true;
  }

  return false;
};

const cleanText = (text: string, repeatedLines: Set<string>) => {
  const cleanedLines: string[] = [];
  let previousNormalized = '';

  for (const line of toLines(text)) {
    if (isNoiseLine(line, repeatedLines)) {
      continue;
    }

    const collapsed = line.replace(/\s{2,}/g, ' ').trim();
    const normalized = normalizeText(collapsed);

    if (!collapsed) {
      continue;
    }

    if (normalized === previousNormalized && normalized.length > 0) {
      continue;
    }

    cleanedLines.push(collapsed);
    previousNormalized = normalized;
  }

  return cleanedLines.join('\n');
};

const computeOrderedSignalsScore = (text: string) => {
  const normalized = normalizeText(text);
  let score = 0;
  let cursor = -1;

  for (const signal of TABLE_ORDER_SIGNALS) {
    const index = normalized.indexOf(signal, cursor + 1);
    if (index > cursor) {
      score += 1;
      cursor = index;
    }
  }

  return score;
};

const computeNoiseScore = (text: string) => {
  const normalized = normalizeText(text);
  return NOISE_TERMS.reduce((acc, term) => acc + (normalized.includes(term) ? 1 : 0), 0);
};

const renderPageToPng = async (pdfBuffer: Buffer, pageNumber: number) => {
  const loadingTask = getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 2.3 });

  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');

  await page.render({
    canvasContext: context as never,
    viewport,
  }).promise;

  const pngBuffer = canvas.toBuffer('image/png');
  await pdf.destroy();
  return {
    pngBuffer,
    width: Math.ceil(viewport.width),
    height: Math.ceil(viewport.height),
    canvas,
  };
};

const resolveTableCropRatio = (pageNumber: number): CropRatio => {
  if (pageNumber >= 20 && pageNumber <= 22) {
    return { x: 0.08, y: 0.40, width: 0.84, height: 0.50 };
  }

  return { x: 0.10, y: 0.42, width: 0.82, height: 0.48 };
};

const toPixelRect = (imageWidth: number, imageHeight: number, ratio: CropRatio) => {
  const x = Math.max(0, Math.floor(imageWidth * ratio.x));
  const y = Math.max(0, Math.floor(imageHeight * ratio.y));
  const width = Math.max(1, Math.floor(imageWidth * ratio.width));
  const height = Math.max(1, Math.floor(imageHeight * ratio.height));

  return {
    x,
    y,
    width: Math.min(width, imageWidth - x),
    height: Math.min(height, imageHeight - y),
  };
};

const cropPngFromCanvas = (
  sourceCanvas: ReturnType<typeof createCanvas>,
  imageWidth: number,
  imageHeight: number,
  ratio: CropRatio,
) => {
  const rect = toPixelRect(imageWidth, imageHeight, ratio);
  const croppedCanvas = createCanvas(rect.width, rect.height);
  const croppedContext = croppedCanvas.getContext('2d');
  croppedContext.drawImage(
    sourceCanvas as unknown as CanvasImageSource,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height,
  );

  return {
    pngBuffer: croppedCanvas.toBuffer('image/png'),
    ratio,
  };
};

const runOcr = async (imageBuffer: Buffer) => {
  const worker = await createWorker('eng', 1, {
    langPath: engLangData.langPath,
    gzip: true,
    cacheMethod: 'none',
  });
  try {
    const result = await worker.recognize(imageBuffer);
    return (result.data.text ?? '').trim();
  } finally {
    await worker.terminate();
  }
};

const compareCropAgainstFull = (full: CompareMetrics, cropped: CompareMetrics): CropComparison => {
  const usefulLinesDelta = cropped.usefulLines - full.usefulLines;
  const numberDelta = cropped.numberCount - full.numberCount;
  const cutTermsDelta = Number(cropped.hasCutTerms) - Number(full.hasCutTerms);
  const orderedSignalsDelta = computeOrderedSignalsScore(cropped.preview) - computeOrderedSignalsScore(full.preview);
  const noiseDelta = computeNoiseScore(full.preview) - computeNoiseScore(cropped.preview);

  const improvedTableReadability = (
    usefulLinesDelta >= -2
    && numberDelta >= 0
    && (orderedSignalsDelta >= 0 || cutTermsDelta >= 0)
    && noiseDelta >= 0
  ) || (usefulLinesDelta > 0 && noiseDelta >= 0);

  const notes: string[] = [];
  if (usefulLinesDelta > 0) {
    notes.push(`crop ganhou ${usefulLinesDelta} linhas uteis`);
  }
  if (numberDelta > 0) {
    notes.push(`crop ganhou ${numberDelta} numeros detectados`);
  }
  if (noiseDelta > 0) {
    notes.push('crop reduziu mistura de conteudo de outras regioes');
  }
  if (orderedSignalsDelta > 0) {
    notes.push('crop melhorou preservacao de ordem dos sinais tabulares');
  }
  if (notes.length === 0) {
    notes.push('crop nao trouxe ganho estrutural relevante');
  }

  return {
    usefulLinesDelta,
    numberDelta,
    cutTermsDelta,
    orderedSignalsDelta,
    noiseDelta,
    improvedTableReadability,
    notes,
  };
};

const extractNumbers = (line: string) => {
  const matches = normalizeText(line).match(/\b\d+\b/g) ?? [];
  return matches.map((value) => Number.parseInt(value, 10)).filter((value) => Number.isInteger(value));
};

const findProteinType = (normalizedLine: string) => {
  for (const candidate of PROTEIN_TYPE_ALIASES) {
    if (candidate.aliases.some((alias) => normalizedLine.includes(alias))) {
      return candidate.canonical;
    }
  }

  return null;
};

const findCutName = (normalizedLine: string) => {
  for (const candidate of CUT_ALIASES) {
    if (candidate.aliases.some((alias) => normalizedLine.includes(alias))) {
      return candidate.canonical;
    }
  }

  return null;
};

const extractTableStructureFromPage = (page: PageDiagnostic): TableStructureDiagnostic | null => {
  const cropText = page.ocrRegion?.cleaned.text ?? '';
  const fullText = page.ocr.cleaned.text;
  const cropHasSignal = /(incidencia|incidencias|proteina|tipos|frango|pescados|suinos|bovina)/i.test(normalizeText(cropText));
  const sourceText = cropHasSignal ? cropText : fullText;

  if (!sourceText.trim()) {
    return null;
  }

  const lines = toLines(sourceText).filter(Boolean);
  const normalizedAll = normalizeText(sourceText);
  const hasIncidenceSignal = normalizedAll.includes('incidencia')
    || normalizedAll.includes('proteina')
    || normalizedAll.includes('tipos')
    || normalizedAll.includes('frango')
    || normalizedAll.includes('pescados')
    || normalizedAll.includes('suinos')
    || normalizedAll.includes('bovina');
  if (!hasIncidenceSignal) {
    return null;
  }

  const rows: StructuredTableRow[] = [];
  const ambiguousLines: string[] = [];
  const inconsistencies: string[] = [];
  const incidenceValidation: string[] = [];
  const incidenceByProtein = new Map<string, number>();
  let currentProtein: string | null = null;
  let hasHeader = false;

  for (const line of lines) {
    const normalized = normalizeText(line);
    if (!normalized) {
      continue;
    }

    if ((normalized.includes('tipos') || normalized.includes('incidencia') || normalized.includes('qtd') || normalized.includes('corte')) && normalized.length <= 100) {
      hasHeader = true;
    }

    const protein = findProteinType(normalized);
    const cut = findCutName(normalized);
    const numbers = extractNumbers(line);

    if (protein) {
      currentProtein = protein;
      const incidenceCandidate = numbers.find((value) => value >= 1 && value <= 31) ?? null;
      if (incidenceCandidate !== null) {
        incidenceByProtein.set(protein, incidenceCandidate);
      }

      if (numbers.length >= 1) {
        rows.push({
          proteinType: protein,
          totalIncidence: incidenceCandidate,
          quantity: numbers.length >= 2 ? numbers[numbers.length - 1] : null,
          cut: cut ?? 'Unknown',
          confidence: cut
            ? (numbers.length >= 2 ? 'MEDIUM' : 'LOW')
            : 'LOW',
          sourceLine: line,
        });
      }

      if (!cut && numbers.length === 0 && normalized.length > 6) {
        ambiguousLines.push(line);
      }
    }

    if (cut) {
      const quantity = numbers.length > 0
        ? numbers[numbers.length - 1]
        : null;
      const incidenceHint = currentProtein ? (incidenceByProtein.get(currentProtein) ?? null) : null;
      const confidence: ExtractionConfidence = currentProtein && quantity !== null
        ? incidenceHint !== null
          ? 'HIGH'
          : 'MEDIUM'
        : 'LOW';

      rows.push({
        proteinType: currentProtein ?? 'Unknown',
        totalIncidence: incidenceHint,
        quantity,
        cut,
        confidence,
        sourceLine: line,
      });

      if (!currentProtein || quantity === null) {
        ambiguousLines.push(line);
      }
      continue;
    }

    if (protein && numbers.length >= 2 && !normalized.includes('total')) {
      const quantity = numbers[numbers.length - 1];
      const totalIncidence = numbers[0];
      rows.push({
        proteinType: protein,
        totalIncidence,
        quantity,
        cut: 'Unknown',
        confidence: 'LOW',
        sourceLine: line,
      });
      ambiguousLines.push(line);
    }

    if (!protein && !cut && numbers.length > 0 && /(corte|tipo|incidencia)/i.test(normalized) === false && normalized.length > 8) {
      ambiguousLines.push(line);
    }
  }

  const groupedByProtein = new Map<string, { sum: number; incidence: number | null }>();
  for (const row of rows) {
    if (row.quantity === null) {
      continue;
    }

    const current = groupedByProtein.get(row.proteinType) ?? { sum: 0, incidence: row.totalIncidence };
    current.sum += row.quantity;
    if (current.incidence === null && row.totalIncidence !== null) {
      current.incidence = row.totalIncidence;
    }
    groupedByProtein.set(row.proteinType, current);
  }

  for (const [proteinType, values] of groupedByProtein.entries()) {
    if (values.incidence === null) {
      incidenceValidation.push(`${proteinType}: sem incidencia total detectada; soma parcial de cortes ${values.sum}`);
      continue;
    }

    if (values.sum === values.incidence) {
      incidenceValidation.push(`${proteinType}: soma de cortes ${values.sum} confere com incidencia ${values.incidence}`);
    } else {
      incidenceValidation.push(`${proteinType}: soma de cortes ${values.sum} difere da incidencia ${values.incidence}`);
      inconsistencies.push(`${proteinType} com divergencia entre incidencia total e soma de cortes`);
    }
  }

  const bovinaIncidence = incidenceByProtein.get('Carne Bovina') ?? null;
  const bovinaRows = rows.filter((row) => row.proteinType === 'Carne Bovina' && row.quantity !== null);
  const bovinaSum = bovinaRows.reduce((acc, row) => acc + (row.quantity ?? 0), 0);
  if (bovinaIncidence === 14) {
    if (bovinaSum === 14) {
      incidenceValidation.push('Carne Bovina: validacao esperada 14/14 atendida no OCR extraido');
    } else {
      inconsistencies.push(`Carne Bovina esperada 14, mas soma de cortes extraida foi ${bovinaSum}`);
    }
  }

  const hasTotalIncidence = incidenceByProtein.size > 0;
  const hasCuts = rows.some((row) => row.cut !== 'Unknown');
  const hasQuantities = rows.some((row) => row.quantity !== null);
  const hasStrongAmbiguity = ambiguousLines.length > 0 || inconsistencies.length > 0 || rows.length < 2;

  return {
    sourcePage: page.page,
    sourceItem: page.sectionTitle ?? 'Item 20 - Tabela de incidencia de Proteinas - Buffet oferta livre',
    tableType: 'protein_monthly_incidence',
    rows,
    ambiguousLines: [...new Set(ambiguousLines)].slice(0, 20),
    inconsistencies,
    incidenceValidation,
    quality: {
      hasHeader,
      hasTotalIncidence,
      hasCuts,
      hasQuantities,
      // Conservador por definicao: em caso de duvida, nao promover para regra automatica.
      isReliableForAutomaticRule: false && !hasStrongAmbiguity,
    },
  };
};

const unionTerms = (...sources: string[][]) => [...new Set(sources.flat())].sort();

const pickSectionTitle = (page: PageDiagnostic, previous?: PageDiagnostic, next?: PageDiagnostic) => {
  const candidates = [
    ...page.parser.cleaned.metrics.titleLikeLines,
    ...page.ocr.cleaned.metrics.titleLikeLines,
    ...(previous?.parser.cleaned.metrics.titleLikeLines ?? []),
    ...(next?.parser.cleaned.metrics.titleLikeLines ?? []),
  ].filter(Boolean);

  return candidates.find((line) => /^item\s+\d+/i.test(line))
    ?? candidates.find((line) => /(incidencia|proteinas|buffet|cardapio|ciclo)/i.test(line))
    ?? null;
};

const getItemNumber = (value: string | null) => {
  if (!value) {
    return null;
  }

  const match = normalizeText(value).match(/\bitem\s*(\d+)\b|\b(\d+)\./);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1] ?? match[2] ?? '', 10) || null;
};

const pageHasStrongAnchor = (page: PageDiagnostic) => {
  const lines = [...page.parser.cleaned.metrics.titleLikeLines, ...page.ocr.cleaned.metrics.titleLikeLines];
  if (lines.some((line) => /\bitem\s*\d+\b/i.test(line) || /^\d+\./.test(line.trim()))) {
    return true;
  }

  const terms = page.detectedTerms;
  const strongThemeTerms = terms.filter((term) => BLOCK_THEME_TERMS.includes(term as (typeof BLOCK_THEME_TERMS)[number]));
  return strongThemeTerms.length >= 3;
};

const getThemeSignals = (page: PageDiagnostic) => page.detectedTerms
  .filter((term) => BLOCK_THEME_TERMS.includes(term as (typeof BLOCK_THEME_TERMS)[number]));

const chooseSectionForBlock = (first: PageDiagnostic, second: PageDiagnostic) => {
  const byPriority = [
    first.sectionTitle,
    second.sectionTitle,
    ...first.parser.cleaned.metrics.titleLikeLines,
    ...second.parser.cleaned.metrics.titleLikeLines,
    ...first.ocr.cleaned.metrics.titleLikeLines,
    ...second.ocr.cleaned.metrics.titleLikeLines,
  ].filter((line): line is string => Boolean(line));

  return byPriority.find((line) => /\bitem\s*\d+\b/i.test(line) || /^\d+\./.test(line.trim()))
    ?? byPriority.find((line) => /(incidencia|proteinas|buffet|cardapio|corte)/i.test(line))
    ?? `Pages ${first.page}-${second.page}`;
};

const hasStrongSectionAnchor = (value: string | null) => {
  if (!value) {
    return false;
  }

  const normalized = normalizeText(value);
  return /\bitem\s*\d+\b/.test(normalized)
    || /\b\d+\.\s*tabela/.test(normalized)
    || (normalized.includes('tabela') && normalized.includes('incidencia') && normalized.includes('proteina'));
};

const hasIncidenceTableSignal = (page: PageDiagnostic) => {
  const terms = getThemeSignals(page);
  const hasCore = terms.includes('incidencia') || terms.includes('proteina') || terms.includes('proteinas');
  const hasTableLike = page.isVisualTablePage || page.requiresOcr || terms.includes('corte') || terms.includes('quantidade');
  return hasCore && hasTableLike;
};

const scoreComposedBlock = (
  first: PageDiagnostic,
  second: PageDiagnostic,
  section: string,
  sharedSignals: string[],
  sameItem: boolean,
  hasAnchor: boolean,
  targetPageSet: Set<number>,
) => {
  let score = 0;

  if (hasStrongSectionAnchor(section) || hasStrongSectionAnchor(first.sectionTitle) || hasStrongSectionAnchor(second.sectionTitle)) {
    score += 30;
  }

  if (sameItem) {
    score += 20;
  }

  if (sharedSignals.length >= 3) {
    score += 20;
  } else if (sharedSignals.length === 2) {
    score += 12;
  } else if (sharedSignals.length === 1) {
    score += 5;
  }

  if (hasAnchor && (first.isVisualTablePage || second.isVisualTablePage || first.requiresOcr || second.requiresOcr)) {
    score += 15;
  }

  const pagesInTarget = [first.page, second.page].filter((page) => targetPageSet.has(page)).length;
  if (pagesInTarget === 2) {
    score += 20;
  } else if (pagesInTarget === 1) {
    score += 8;
  } else {
    score -= 12;
  }

  const improvedCount = [first.ocrImprovedContent, second.ocrImprovedContent].filter(Boolean).length;
  score += improvedCount * 5;

  const numbersCount = [first.ocr.cleaned.metrics.hasNumbers, second.ocr.cleaned.metrics.hasNumbers].filter(Boolean).length;
  score += numbersCount * 4;

  if (!hasAnchor) {
    score -= 10;
  }

  if (!hasIncidenceTableSignal(first) || !hasIncidenceTableSignal(second)) {
    score -= 8;
  }

  if (score < 0) {
    score = 0;
  }
  if (score > 100) {
    score = 100;
  }

  const confidence: ComposedBlockCandidate['confidence'] = score >= 75
    ? 'HIGH'
    : score >= 50
      ? 'MEDIUM'
      : 'LOW';

  return { score, confidence };
};

const classifyPage = (parser: TextAnalysis, ocr: TextAnalysis): Omit<PageDiagnostic, 'page' | 'sectionTitle'> => {
  const parserClean = parser.cleaned.metrics;
  const ocrClean = ocr.cleaned.metrics;
  const detectedTerms = unionTerms(parserClean.detectedTerms, ocrClean.detectedTerms);
  const recoveredTerms = ocrClean.detectedTerms.filter((term) => !parserClean.detectedTerms.includes(term));
  const ocrImprovedContent = ocrClean.chars > parserClean.chars * 1.4
    || ocrClean.usefulLines >= parserClean.usefulLines + 5
    || recoveredTerms.length >= 2;
  const recoveredCutsOrQuantities = (!parserClean.hasCutTerms && ocrClean.hasCutTerms)
    || (!parserClean.hasNumbers && ocrClean.hasNumbers)
    || ocrClean.numberCount >= parserClean.numberCount + 4;
  const parserTitleOnly = parserClean.detectedTerms.length >= 2
    && parserClean.chars < 260
    && parserClean.usefulLines <= 3
    && (parserClean.bulletLevel === 'high' || parserClean.titleLikeLines.length > 0)
    && !parserClean.hasCutTerms;
  const looksLikeVisualTable = (parserTitleOnly || parserClean.quality === 'LOW_TEXT')
    && ocrImprovedContent
    && (ocrClean.hasNumbers || ocrClean.hasCutTerms || ocrClean.usefulLines >= 10);
  const stillNeedsRegionCropping = looksLikeVisualTable
    && (ocrClean.quality === 'LOW_TEXT' || (!ocrClean.hasCutTerms && ocrClean.numberCount < 4));

  let classification: PageClassification;
  if (Math.max(parserClean.chars, ocrClean.chars) < 60 && detectedTerms.length === 0) {
    classification = 'IGNORE';
  } else if (looksLikeVisualTable) {
    classification = 'VISUAL_TABLE_REQUIRES_OCR';
  } else if (ocrClean.quality === 'GOOD_TEXT' || parserClean.quality === 'GOOD_TEXT') {
    classification = 'GOOD_TEXT';
  } else if (ocrClean.quality === 'PARTIAL_TEXT' || parserClean.quality === 'PARTIAL_TEXT') {
    classification = 'PARTIAL_TEXT';
  } else {
    classification = 'LOW_TEXT';
  }

  const isContextPage = classification !== 'VISUAL_TABLE_REQUIRES_OCR'
    && classification !== 'IGNORE'
    && detectedTerms.some((term) => ['cardapio', 'buffet', 'incidencia', 'proteina', 'menu', 'ciclo'].includes(term))
    && (ocrClean.usefulLines >= 6 || parserClean.usefulLines >= 6 || parser.cleaned.metrics.titleLikeLines.length > 0);
  const isVisualTablePage = classification === 'VISUAL_TABLE_REQUIRES_OCR';
  const requiresOcr = isVisualTablePage || (classification === 'LOW_TEXT' && ocrImprovedContent);

  const reasonParts = [
    isContextPage ? 'pagina com contexto textual contratual/menu' : null,
    isVisualTablePage ? 'pagina com tabela visual/degradada' : null,
    ocrImprovedContent ? 'OCR agregou conteudo util' : 'OCR sem ganho relevante',
    recoveredCutsOrQuantities ? 'OCR recuperou cortes/quantidades' : null,
    stillNeedsRegionCropping ? 'OCR de pagina inteira ainda insuficiente; recorte/regiao parece necessario' : null,
  ].filter(Boolean);

  const recommendedPipelineAction = stillNeedsRegionCropping
    ? 'review_with_region_cropping'
    : requiresOcr
      ? 'run_selective_ocr_for_table_page'
      : 'no_action';

  return {
    parser,
    ocr,
    classification,
    detectedTerms,
    recoveredTerms,
    isContextPage,
    isVisualTablePage,
    requiresOcr,
    ocrImprovedContent,
    recoveredCutsOrQuantities,
    stillNeedsRegionCropping,
    reason: reasonParts.join('; ') || 'sem sinais fortes para acao adicional',
    recommendedPipelineAction,
  };
};

const analyzeWindows = (
  targetPages: number[],
  context: number,
  diagnosticsByPage: Map<number, PageDiagnostic>,
) => targetPages.map((targetPage) => {
  const windowPages = uniqueNumbers(
    Array.from({ length: context * 2 + 1 }, (_, index) => targetPage - context + index)
      .filter((page) => diagnosticsByPage.has(page)),
  );
  const pages = windowPages
    .map((page) => diagnosticsByPage.get(page))
    .filter((value): value is PageDiagnostic => Boolean(value));
  const contextPages = pages.filter((page) => page.isContextPage).map((page) => page.page);
  const degradedTablePages = pages.filter((page) => page.isVisualTablePage).map((page) => page.page);

  return {
    targetPage,
    windowPages,
    contextPages,
    degradedTablePages,
    relatedBlocks: [],
  } satisfies TargetWindowAssessment;
});

const buildComposedBlocks = (
  diagnostics: PageDiagnostic[],
  windows: TargetWindowAssessment[],
  targetPageSet: Set<number>,
) => {
  const diagnosticsByPage = new Map(diagnostics.map((item) => [item.page, item]));
  const candidates: ComposedBlockCandidate[] = [];
  const seen = new Set<string>();
  const ordered = [...diagnostics].sort((a, b) => a.page - b.page);

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const current = ordered[index];
    const next = ordered[index + 1];

    if (next.page !== current.page + 1) {
      continue;
    }

    const currentItem = getItemNumber(current.sectionTitle);
    const nextItem = getItemNumber(next.sectionTitle);
    const sameItem = Boolean(currentItem && nextItem && currentItem === nextItem);
    const currentSignals = getThemeSignals(current);
    const nextSignals = getThemeSignals(next);
    const sharedSignals = currentSignals.filter((term) => nextSignals.includes(term));
    const consecutiveTableContinuation = (current.isVisualTablePage || current.requiresOcr)
      && (next.isVisualTablePage || next.requiresOcr);
    const hasAnchor = pageHasStrongAnchor(current) || pageHasStrongAnchor(next);
    const shouldGroup = sameItem
      || (hasAnchor && consecutiveTableContinuation)
      || (consecutiveTableContinuation && sharedSignals.length >= 2)
      || (current.sectionTitle && next.sectionTitle && normalizeText(current.sectionTitle) === normalizeText(next.sectionTitle));

    if (!shouldGroup) {
      continue;
    }

    const pages = uniqueNumbers([current.page, next.page]);
    const tablePages = pages.filter((pageNumber) => {
      const page = diagnosticsByPage.get(pageNumber);
      return Boolean(page?.isVisualTablePage || page?.requiresOcr);
    });
    const contextPages = pages.filter((pageNumber) => {
      const page = diagnosticsByPage.get(pageNumber);
      return Boolean(page && (pageHasStrongAnchor(page) || page.isContextPage));
    });
    const key = pages.join(',');

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    const section = chooseSectionForBlock(current, next);
    const requiresOcr = pages.some((pageNumber) => diagnosticsByPage.get(pageNumber)?.requiresOcr);
    const needsRegionCropping = pages.some((pageNumber) => diagnosticsByPage.get(pageNumber)?.stillNeedsRegionCropping);
    const recommendedPipelineAction = needsRegionCropping
      ? 'run_selective_ocr_with_table_region_detection'
      : requiresOcr
        ? 'run_selective_ocr_for_table_page'
        : 'no_action';
    const evidence = [
      `consecutive pages: ${current.page}-${next.page}`,
      `shared signals: ${sharedSignals.length ? sharedSignals.join(', ') : 'none'}`,
      `same item number: ${sameItem ? 'yes' : 'no'}`,
      `anchor page detected: ${hasAnchor ? 'yes' : 'no'}`,
    ];
    const scored = scoreComposedBlock(current, next, section, sharedSignals, sameItem, hasAnchor, targetPageSet);

    candidates.push({
      section,
      pages,
      contextPages,
      tablePages,
      evidence,
      whyGrouped: 'consecutive pages share menu incidence/table signals',
      reason: 'consecutive pages share menu incidence/table signals',
      score: scored.score,
      confidence: scored.confidence,
      requiresOcr,
      needsRegionCropping,
      recommendedPipelineAction,
    });
  }

  for (const window of windows) {
    window.relatedBlocks = candidates.filter((candidate) => {
      const pages = [...candidate.contextPages, ...candidate.tablePages];
      return pages.some((page) => window.windowPages.includes(page));
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
};

const renderVariant = (label: string, variant: TextVariant) => {
  console.log(label);
  console.log(`Chars: ${variant.metrics.chars}`);
  console.log(`Useful lines: ${variant.metrics.usefulLines}`);
  console.log(`Quality: ${variant.metrics.quality}`);
  console.log(`Terms: ${variant.metrics.detectedTerms.length ? variant.metrics.detectedTerms.join(', ') : 'none'}`);
  console.log(`Cuts: ${variant.metrics.hasCutTerms ? 'yes' : 'no'} | Numbers: ${variant.metrics.hasNumbers ? 'yes' : 'no'} (${variant.metrics.numberCount})`);
  console.log(`Bullet density: ${variant.metrics.bulletLevel} (${variant.metrics.bulletCount})`);
  console.log('Preview:');
  console.log(variant.metrics.preview || '[empty]');
  console.log('');
};

const renderPageOutput = (result: PageDiagnostic) => {
  console.log(`Page ${result.page}`);
  console.log(`Classification: ${result.classification}`);
  console.log(`Context page: ${result.isContextPage ? 'yes' : 'no'}`);
  console.log(`Visual/degraded table page: ${result.isVisualTablePage ? 'yes' : 'no'}`);
  console.log(`Requires OCR: ${result.requiresOcr ? 'yes' : 'no'}`);
  console.log(`OCR improved content: ${result.ocrImprovedContent ? 'yes' : 'no'}`);
  console.log(`OCR recovered cuts/quantities: ${result.recoveredCutsOrQuantities ? 'yes' : 'no'}`);
  console.log(`Still needs region cropping: ${result.stillNeedsRegionCropping ? 'yes' : 'no'}`);
  console.log(`Section: ${result.sectionTitle ?? 'n/a'}`);
  console.log(`Reason: ${result.reason}`);
  console.log(`Recommended action: ${result.recommendedPipelineAction}`);
  console.log('');
  renderVariant('Parser raw', result.parser.raw);
  renderVariant('Parser cleaned', result.parser.cleaned);
  renderVariant('OCR raw', result.ocr.raw);
  renderVariant('OCR cleaned', result.ocr.cleaned);
  if (result.ocrRegion) {
    renderVariant('OCR crop raw', result.ocrRegion.raw);
    renderVariant('OCR crop cleaned', result.ocrRegion.cleaned);
    if (result.cropComparison) {
      console.log('Crop comparison (full vs region):');
      console.log(`Useful lines delta: ${result.cropComparison.usefulLinesDelta}`);
      console.log(`Numbers delta: ${result.cropComparison.numberDelta}`);
      console.log(`Cut terms delta: ${result.cropComparison.cutTermsDelta}`);
      console.log(`Order signals delta: ${result.cropComparison.orderedSignalsDelta}`);
      console.log(`Noise delta (positive is better): ${result.cropComparison.noiseDelta}`);
      console.log(`Improved table readability: ${result.cropComparison.improvedTableReadability ? 'yes' : 'no'}`);
      console.log(`Notes: ${result.cropComparison.notes.join('; ')}`);
    }
  }
  if (result.tableStructure) {
    console.log('Structured table extraction (diagnostic):');
    console.log(JSON.stringify(result.tableStructure, null, 2));
  }
  console.log('\n---\n');
};

const pushVariantSection = (lines: string[], title: string, variant: TextVariant) => {
  lines.push(`### ${title}`);
  lines.push(`- Chars: ${variant.metrics.chars}`);
  lines.push(`- Useful lines: ${variant.metrics.usefulLines}`);
  lines.push(`- Quality: ${variant.metrics.quality}`);
  lines.push(`- Terms: ${variant.metrics.detectedTerms.length ? variant.metrics.detectedTerms.join(', ') : 'none'}`);
  lines.push(`- Cuts: ${variant.metrics.hasCutTerms ? 'yes' : 'no'}`);
  lines.push(`- Numbers: ${variant.metrics.hasNumbers ? `yes (${variant.metrics.numberCount})` : 'no'}`);
  lines.push('```text');
  lines.push(variant.metrics.preview || '[empty]');
  lines.push('```');
  lines.push('');
};

const buildMarkdownReport = (
  pdfPath: string,
  targetPages: number[],
  context: number,
  diagnostics: PageDiagnostic[],
  windows: TargetWindowAssessment[],
  composedBlocks: ComposedBlockCandidate[],
) => {
  const lines: string[] = [];
  lines.push('# PDF OCR Diagnostic Report');
  lines.push(`PDF: ${pdfPath}`);
  lines.push(`Target pages: ${targetPages.join(', ')}`);
  lines.push(`Context radius: ${context}`);
  lines.push(`Generated at: ${new Date().toISOString()}`);
  lines.push('');

  for (const window of windows) {
    lines.push(`## Target page ${window.targetPage}`);
    lines.push(`- Window pages: ${window.windowPages.join(', ')}`);
    lines.push(`- Context pages in window: ${window.contextPages.length ? window.contextPages.join(', ') : 'none'}`);
    lines.push(`- Degraded table pages in window: ${window.degradedTablePages.length ? window.degradedTablePages.join(', ') : 'none'}`);
    lines.push(`- Suggested composed block in window: ${window.relatedBlocks.length ? 'yes' : 'no'}`);
    lines.push('');
  }

  for (const item of diagnostics) {
    lines.push(`## Page ${item.page}`);
    pushVariantSection(lines, 'Parser raw', item.parser.raw);
    pushVariantSection(lines, 'Parser cleaned', item.parser.cleaned);
    pushVariantSection(lines, 'OCR raw', item.ocr.raw);
    pushVariantSection(lines, 'OCR cleaned', item.ocr.cleaned);
    if (item.ocrRegion) {
      pushVariantSection(lines, 'OCR crop raw', item.ocrRegion.raw);
      pushVariantSection(lines, 'OCR crop cleaned', item.ocrRegion.cleaned);
      lines.push('### Full page vs crop comparison');
      if (item.cropComparison) {
        lines.push(`- Useful lines delta: ${item.cropComparison.usefulLinesDelta}`);
        lines.push(`- Numbers delta: ${item.cropComparison.numberDelta}`);
        lines.push(`- Cut terms delta: ${item.cropComparison.cutTermsDelta}`);
        lines.push(`- Ordered signals delta: ${item.cropComparison.orderedSignalsDelta}`);
        lines.push(`- Noise delta (positive is better): ${item.cropComparison.noiseDelta}`);
        lines.push(`- Improved table readability: ${item.cropComparison.improvedTableReadability ? 'yes' : 'no'}`);
        lines.push(`- Notes: ${item.cropComparison.notes.join('; ')}`);
      }
      lines.push('');
    }

    if (item.tableStructure) {
      lines.push('### Structured table extraction (diagnostic)');
      lines.push('```json');
      lines.push(JSON.stringify(item.tableStructure, null, 2));
      lines.push('```');
      lines.push('');
    }

    lines.push('### Page classification');
    lines.push(`- Classification: ${item.classification}`);
    lines.push(`- Is context page: ${item.isContextPage ? 'yes' : 'no'}`);
    lines.push(`- Is visual/degraded table page: ${item.isVisualTablePage ? 'yes' : 'no'}`);
    lines.push(`- Requires OCR: ${item.requiresOcr ? 'yes' : 'no'}`);
    lines.push(`- OCR improved content: ${item.ocrImprovedContent ? 'yes' : 'no'}`);
    lines.push(`- OCR recovered cuts/quantities: ${item.recoveredCutsOrQuantities ? 'yes' : 'no'}`);
    lines.push(`- Still needs region cropping: ${item.stillNeedsRegionCropping ? 'yes' : 'no'}`);
    lines.push(`- Section: ${item.sectionTitle ?? 'n/a'}`);
    lines.push(`- Recommendation: ${item.recommendedPipelineAction}`);
    lines.push(`- Reason: ${item.reason}`);
    lines.push('');

    lines.push('### Detected terms');
    lines.push(`- Combined terms: ${item.detectedTerms.length ? item.detectedTerms.join(', ') : 'none'}`);
    lines.push(`- OCR-only recovered terms: ${item.recoveredTerms.length ? item.recoveredTerms.join(', ') : 'none'}`);
    lines.push('');
  }

  lines.push('## Suggested composed blocks');
  lines.push('');
  lines.push('## Composed Block Candidates');
  if (composedBlocks.length === 0) {
    lines.push('- none');
  } else {
    const primary = composedBlocks[0];
    const secondary = composedBlocks.slice(1);

    lines.push('## Primary Composed Block Candidate');
    lines.push(`- Section: ${primary.section}`);
    lines.push(`- Pages: ${primary.pages.join('-')}`);
    lines.push(`- Context pages: ${primary.contextPages.join(', ') || 'none'}`);
    lines.push(`- Table/OCR pages: ${primary.tablePages.join(', ') || 'none'}`);
    lines.push(`- Score: ${primary.confidence} (${primary.score})`);
    lines.push(`- Evidence: ${primary.evidence.join(' | ')}`);
    lines.push(`- Why grouped: ${primary.whyGrouped}`);
    lines.push(`- Requires OCR: ${primary.requiresOcr ? 'yes' : 'no'}`);
    lines.push(`- Needs region cropping: ${primary.needsRegionCropping ? 'yes' : 'no'}`);
    lines.push(`- Recommended pipeline action: ${primary.recommendedPipelineAction}`);
    lines.push('');

    lines.push('## Secondary Composed Block Candidates');
    if (secondary.length === 0) {
      lines.push('- none');
      lines.push('');
    }

    for (const [index, block] of secondary.entries()) {
      lines.push(`### Candidate ${index + 1}`);
      lines.push(`- Section: ${block.section}`);
      lines.push(`- Pages: ${block.pages.join('-')}`);
      lines.push(`- Context pages: ${block.contextPages.join(', ') || 'none'}`);
      lines.push(`- Table/OCR pages: ${block.tablePages.join(', ') || 'none'}`);
      lines.push(`- Score: ${block.confidence} (${block.score})`);
      lines.push(`- Evidence: ${block.evidence.join(' | ')}`);
      lines.push(`- Why grouped: ${block.whyGrouped}`);
      lines.push(`- Requires OCR: ${block.requiresOcr ? 'yes' : 'no'}`);
      lines.push(`- Needs region cropping: ${block.needsRegionCropping ? 'yes' : 'no'}`);
      lines.push(`- Recommended pipeline action: ${block.recommendedPipelineAction}`);
      lines.push('');
    }
  }

  lines.push('## Recommendation');
  if (composedBlocks.length === 0) {
    lines.push('- No composed block was suggested with the current heuristics.');
  } else {
    for (const [index, block] of composedBlocks.entries()) {
      const needsRegion = block.needsRegionCropping;
      lines.push(`- ${index === 0 ? 'Primary' : 'Secondary'} candidate ${block.pages.join('-')} (${block.confidence}/${block.score}): selective OCR ${block.requiresOcr ? 'is recommended' : 'is not required'}${needsRegion ? '; region cropping still looks necessary' : ''}.`);
      if (needsRegion) {
        lines.push('- OCR recovered useful terms, but table structure is not reliable enough for automatic rule extraction.');
      }
    }
  }

  return lines.join('\n');
};

const resolveOutputPath = async (outPath: string | null) => {
  if (!outPath) {
    return null;
  }

  const absolute = path.resolve(outPath);
  const ext = path.extname(absolute).toLowerCase();

  if (ext === '.md' || ext === '.txt') {
    await mkdir(path.dirname(absolute), { recursive: true });
    return absolute;
  }

  await mkdir(absolute, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(absolute, `diagnose-pdf-ocr-${stamp}.md`);
};

async function main() {
  const {
    pdfPath,
    pages,
    outPath,
    previewChars,
    context,
    crop,
    extractTableStructure,
  } = parseArgs(process.argv.slice(2));
  const absolutePdfPath = path.resolve(pdfPath);
  const pdfBuffer = await readFile(absolutePdfPath);

  const parser = new PDFParse({ data: pdfBuffer });
  let parsed: PdfTextResult = {};

  try {
    parsed = await parser.getText();
  } finally {
    await parser.destroy();
  }

  const parserTextByPage = getParserTextByPage(parsed);
  const targetPages = pages.length > 0
    ? uniqueNumbers(pages)
    : [...parserTextByPage.keys()].sort((a, b) => a - b);

  if (targetPages.length === 0) {
    throw new Error('Nenhuma pagina disponivel para diagnostico.');
  }

  const allPagesToAnalyze = uniqueNumbers(
    targetPages.flatMap((page) => Array.from({ length: context * 2 + 1 }, (_, index) => page - context + index))
      .filter((page) => page > 0 && parserTextByPage.has(page)),
  );

  const rawTexts = allPagesToAnalyze.map((page) => parserTextByPage.get(page) ?? '');
  const repeatedLines = collectRepeatedLines(rawTexts);
  const diagnostics: PageDiagnostic[] = [];

  for (const page of allPagesToAnalyze) {
    const parserRawText = parserTextByPage.get(page) ?? '';
    const pageImage = await renderPageToPng(pdfBuffer, page);
    const ocrRawText = await runOcr(pageImage.pngBuffer);

    let ocrRegionRawText: string | null = null;
    let cropRect: CropRatio | null = null;
    if (crop.mode !== 'none') {
      cropRect = crop.mode === 'ratio' && crop.ratio
        ? crop.ratio
        : resolveTableCropRatio(page);
      const croppedImage = cropPngFromCanvas(pageImage.canvas, pageImage.width, pageImage.height, cropRect);
      ocrRegionRawText = await runOcr(croppedImage.pngBuffer);
    }

    const localRepeatedLines = collectRepeatedLines([parserRawText, ocrRawText, ...rawTexts]);

    const parserCleanedText = cleanText(parserRawText, new Set([...repeatedLines, ...localRepeatedLines]));
    const ocrCleanedText = cleanText(ocrRawText, new Set([...repeatedLines, ...localRepeatedLines]));

    const parserAnalysis: TextAnalysis = {
      raw: { text: parserRawText, metrics: buildMetrics(parserRawText, previewChars) },
      cleaned: {
        text: parserCleanedText,
        metrics: buildMetrics(parserCleanedText, previewChars),
      },
    };

    const ocrAnalysis: TextAnalysis = {
      raw: { text: ocrRawText, metrics: buildMetrics(ocrRawText, previewChars) },
      cleaned: {
        text: ocrCleanedText,
        metrics: buildMetrics(ocrCleanedText, previewChars),
      },
    };

    let ocrRegionAnalysis: TextAnalysis | null = null;
    if (ocrRegionRawText !== null) {
      const regionCleanedText = cleanText(ocrRegionRawText, new Set([...repeatedLines, ...localRepeatedLines]));
      ocrRegionAnalysis = {
        raw: { text: ocrRegionRawText, metrics: buildMetrics(ocrRegionRawText, previewChars) },
        cleaned: {
          text: regionCleanedText,
          metrics: buildMetrics(regionCleanedText, previewChars),
        },
      };
    }

    const classified = classifyPage(parserAnalysis, ocrAnalysis);
    diagnostics.push({
      page,
      ...classified,
      ocrRegion: ocrRegionAnalysis,
      cropMode: crop.mode,
      cropRect,
      cropComparison: ocrRegionAnalysis
        ? compareCropAgainstFull(ocrAnalysis.cleaned.metrics, ocrRegionAnalysis.cleaned.metrics)
        : null,
      tableStructure: null,
      sectionTitle: null,
    });
  }

  const diagnosticsByPage = new Map(diagnostics.map((item) => [item.page, item]));
  for (const item of diagnostics) {
    item.sectionTitle = pickSectionTitle(item, diagnosticsByPage.get(item.page - 1), diagnosticsByPage.get(item.page + 1));
    if (extractTableStructure) {
      item.tableStructure = extractTableStructureFromPage(item);
    }
  }

  const windows = analyzeWindows(targetPages, context, diagnosticsByPage);
  const targetPageSet = new Set(targetPages);
  const composedBlocks = buildComposedBlocks(diagnostics, windows, targetPageSet);

  for (const result of diagnostics) {
    renderPageOutput(result);
  }

  const outFile = await resolveOutputPath(outPath);
  if (outFile) {
    const markdown = buildMarkdownReport(absolutePdfPath, targetPages, context, diagnostics, windows, composedBlocks);
    await writeFile(outFile, markdown, 'utf-8');
    console.log(`Markdown report: ${outFile}`);
  }
}

main().catch((error) => {
  console.error('[diagnose-pdf-ocr] erro:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
