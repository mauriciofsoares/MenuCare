import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';

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

type PageDiag = {
  page: number;
  chars: number;
  usefulLines: number;
  bulletCount: number;
  bulletRatio: number;
  bulletLevel: 'low' | 'medium' | 'high';
  detectedTerms: string[];
  quality: 'GOOD' | 'PARTIAL' | 'LOW';
  reasons: string[];
  preview: string;
  altChars: number | null;
  tableLike: boolean;
};

const KEYWORDS = [
  'proteina',
  'incidencia',
  'buffet',
  'carne',
  'frango',
  'peixe',
  'quantidade',
  'corte',
] as const;

const normalizeText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const parseArgs = (argv: string[]) => {
  const args = [...argv];
  const pdfPath = args.shift();

  if (!pdfPath) {
    throw new Error('Informe o caminho do PDF. Ex.: tsx scripts/diagnose-pdf-extraction.ts docs/arquivo.pdf --pages 20,21');
  }

  let pages: number[] | null = null;
  let outPath: string | null = null;
  let previewChars = 1200;

  for (let i = 0; i < args.length; i += 1) {
    const current = args[i];
    const next = args[i + 1];

    if (current === '--pages' && next) {
      pages = next
        .split(',')
        .map((item) => Number.parseInt(item.trim(), 10))
        .filter((page) => Number.isInteger(page) && page > 0);
      i += 1;
      continue;
    }

    if (current === '--out' && next) {
      outPath = next;
      i += 1;
      continue;
    }

    if (current === '--preview' && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isInteger(parsed) && parsed >= 200 && parsed <= 5000) {
        previewChars = parsed;
      }
      i += 1;
    }
  }

  return {
    pdfPath,
    pages,
    outPath,
    previewChars,
  };
};

const buildPagesFromParser = (parsed: PdfTextResult): Array<{ page: number; text: string }> => {
  const parsedPages = Array.isArray(parsed.pages) ? parsed.pages : [];
  const pages = parsedPages
    .map((item, index) => ({
      page: item.num ?? item.pageNumber ?? item.page ?? index + 1,
      text: (item.text ?? '').trim(),
    }))
    .filter((item) => Number.isInteger(item.page) && item.page > 0)
    .sort((a, b) => a.page - b.page);

  if (pages.length > 0) {
    return pages;
  }

  const fullText = parsed.text ?? '';
  return splitByPageMarkers(fullText);
};

const splitByPageMarkers = (fullText: string): Array<{ page: number; text: string }> => {
  const markerRegex = /(?:^|\n)\s*--\s*(\d+)\s+of\s+\d+\s*--\s*(?:\n|$)/g;
  const matches = Array.from(fullText.matchAll(markerRegex));

  if (!matches.length) {
    return [];
  }

  const pages: Array<{ page: number; text: string }> = [];
  for (let index = 0; index < matches.length; index += 1) {
    const start = (matches[index].index ?? 0) + matches[index][0].length;
    const end = index + 1 < matches.length
      ? (matches[index + 1].index ?? fullText.length)
      : fullText.length;

    const pageNumber = Number.parseInt(matches[index][1], 10);
    const text = fullText.slice(start, end).trim();
    pages.push({ page: pageNumber, text });
  }

  return pages;
};

const countUsefulLines = (text: string) => text
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => {
    if (!line) {
      return false;
    }

    const normalized = normalizeText(line);
    if (normalized === '•' || normalized === '-' || normalized === 'o') {
      return false;
    }

    return /[a-zA-Z0-9]/.test(line);
  }).length;

const detectTerms = (text: string) => {
  const normalized = normalizeText(text);
  return KEYWORDS.filter((keyword) => normalized.includes(keyword));
};

const buildQuality = (input: {
  chars: number;
  usefulLines: number;
  bulletRatio: number;
  detectedTerms: string[];
  tableLike: boolean;
}) => {
  const reasons: string[] = [];
  let quality: 'GOOD' | 'PARTIAL' | 'LOW' = 'GOOD';

  if (input.chars < 220) {
    quality = 'LOW';
    reasons.push('poucos caracteres extraidos');
  } else if (input.chars < 900) {
    quality = 'PARTIAL';
    reasons.push('volume de texto limitado para pagina de contrato');
  }

  if (input.usefulLines <= 2) {
    quality = 'LOW';
    reasons.push('quase sem linhas uteis');
  }

  if (input.bulletRatio >= 0.18) {
    quality = 'LOW';
    reasons.push('proporcao alta de bullets');
  } else if (input.bulletRatio >= 0.08 && quality === 'GOOD') {
    quality = 'PARTIAL';
    reasons.push('proporcao moderada de bullets');
  }

  if (input.tableLike && input.detectedTerms.length >= 2 && input.usefulLines <= 3) {
    quality = 'LOW';
    reasons.push('titulo de tabela detectado sem conteudo tabular util');
  }

  if (input.detectedTerms.length === 0 && quality === 'GOOD') {
    quality = 'PARTIAL';
    reasons.push('pagina sem termos-alvo de incidencia/proteina');
  }

  if (reasons.length === 0) {
    reasons.push('texto consistente para analise de regras');
  }

  return { quality, reasons };
};

const diagnosePage = (
  page: { page: number; text: string },
  altByPage: Map<number, string>,
  previewChars: number,
): PageDiag => {
  const text = page.text.trim();
  const normalized = normalizeText(text);
  const chars = text.length;
  const usefulLines = countUsefulLines(text);
  const bulletCount = (text.match(/•/g) ?? []).length;
  const bulletRatio = chars > 0 ? bulletCount / chars : 0;
  const bulletLevel: PageDiag['bulletLevel'] = bulletRatio >= 0.18
    ? 'high'
    : bulletRatio >= 0.08
      ? 'medium'
      : 'low';
  const detectedTerms = detectTerms(text);
  const tableLike = normalized.includes('tabela') || normalized.includes('incidencia');

  const qualityResult = buildQuality({
    chars,
    usefulLines,
    bulletRatio,
    detectedTerms,
    tableLike,
  });

  const altChars = altByPage.has(page.page) ? (altByPage.get(page.page) ?? '').trim().length : null;

  return {
    page: page.page,
    chars,
    usefulLines,
    bulletCount,
    bulletRatio,
    bulletLevel,
    detectedTerms,
    quality: qualityResult.quality,
    reasons: qualityResult.reasons,
    preview: text.slice(0, previewChars),
    altChars,
    tableLike,
  };
};

const renderReport = (diagnostics: PageDiag[], sourcePath: string) => {
  const lines: string[] = [];
  lines.push(`# PDF Extraction Diagnostic`);
  lines.push(`Source: ${sourcePath}`);
  lines.push(`Pages analyzed: ${diagnostics.length}`);
  lines.push('');

  for (const diag of diagnostics) {
    lines.push(`Page ${diag.page}`);
    lines.push(`Chars: ${diag.chars}`);
    lines.push(`Useful lines: ${diag.usefulLines}`);
    lines.push(`Bullet ratio: ${diag.bulletLevel} (${diag.bulletCount} bullets)`);
    lines.push(`Detected terms: ${diag.detectedTerms.length ? diag.detectedTerms.join(', ') : 'none'}`);
    lines.push(`Quality: ${diag.quality}`);
    lines.push(`Reason: ${diag.reasons.join('; ')}`);
    if (diag.altChars !== null) {
      lines.push(`Alt strategy chars (split by -- N of M --): ${diag.altChars}`);
    }
    lines.push('Preview:');
    lines.push(diag.preview || '[empty]');
    lines.push('');
  }

  return lines.join('\n');
};

async function main() {
  const { pdfPath, pages, outPath, previewChars } = parseArgs(process.argv.slice(2));
  const absolutePdfPath = path.resolve(pdfPath);
  const pdfBuffer = await readFile(absolutePdfPath);

  const parser = new PDFParse({ data: pdfBuffer });
  let parsed: PdfTextResult = {};

  try {
    parsed = await parser.getText();
  } finally {
    await parser.destroy();
  }

  const strategyA = buildPagesFromParser(parsed);
  const strategyB = splitByPageMarkers(parsed.text ?? '');
  const altByPage = new Map(strategyB.map((item) => [item.page, item.text]));

  const selected = pages && pages.length > 0
    ? strategyA.filter((item) => pages.includes(item.page))
    : strategyA;

  if (selected.length === 0) {
    throw new Error('Nenhuma pagina encontrada para os filtros informados.');
  }

  const diagnostics = selected
    .map((page) => diagnosePage(page, altByPage, previewChars))
    .sort((a, b) => a.page - b.page);

  const report = renderReport(diagnostics, absolutePdfPath);
  console.log(report);

  const keywordPages = diagnostics
    .filter((item) => item.detectedTerms.length > 0)
    .map((item) => item.page);
  console.log(`Keyword pages in selection: ${keywordPages.length ? keywordPages.join(', ') : 'none'}`);

  if (outPath) {
    const absoluteOut = path.resolve(outPath);
    await mkdir(path.dirname(absoluteOut), { recursive: true });
    await writeFile(absoluteOut, report, 'utf-8');
    console.log(`Report written to: ${absoluteOut}`);
  }
}

main().catch((error) => {
  console.error('[diagnose-pdf-extraction] erro:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
