/**
 * TYPOGRAPHY-QUALITY cadrage probe (2026-07-22) — measures, on the REAL corpus, what "typography
 * quality" still owes BEYOND the shipped Phase B mechanism (82326f3: line-level splitting,
 * min-2-lines both ends, title keep-with-next; §10.3 value 3 retired the widow/orphan hedge on
 * its basis). Read-only diagnostic, no production code. Run:
 *   npx tsx spikes/typography-quality-probe.ts
 *
 * Sections:
 *  1. ALIGN census — does any real block carry `align`? (positive control first: the census must
 *     SEE an align before its corpus zero counts — the instrument-liar doctrine.)
 *  2. REAL LEADING — what baseline-to-baseline does the PDF actually advance, per theme, vs the
 *     declared theme.spacing.lineHeight (1.4)? Confirmed on the real page bytes, not only via
 *     the measurer.
 *  3. RAGGEDNESS / hyphenation cost — per-line end-of-line slack distribution over the real
 *     book's body paragraphs (greedy break on the real embedded font at the real column width,
 *     PDFKit's own greedy wrapping model). Reads two ways: today (ragged-left) it IS the visible
 *     right-edge raggedness; under justification it becomes inter-word stretch.
 *  4. TITLE-WIDOW census on REAL pages — parse the uncompressed PDF page streams; find
 *     heading-size text near the page bottom and count body lines beneath it on the same page.
 *  5. ATOMICITY census — per fixture × theme: model/real/unplanned + atomic blocks (quote/
 *     scripture/list/table/image/dropcap-opener) taller than a full page or half a page.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { PdfFontRegistry } from '../src/infrastructure/fonts/PdfFontRegistry';
import { FrontMatterBuilder } from '../src/domain/services/FrontMatterBuilder';
import { orderByRole } from '../src/domain/services/orderByRole';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import { getTheme } from '../src/domain/themes/getTheme';
import type { Book, Block, Content, Section, Paragraph } from '../src/domain/models/Book';
import type { Theme } from '../src/domain/models/Theme';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(__dirname, '..', 'verification', 'corpus');
const FILES = [
  'faith-alone-styled.docx',
  'art-of-captivating-list-dense.docx',
  'generated-unstyled-3060w.docx',
  'pm-notes-unstyled-fr.docx',
];
const THEMES = ['classic', 'modern', 'novel'] as const;

// ---------------------------------------------------------------------------- shared plumbing

async function loadBook(file: string): Promise<Book> {
  const raw = await new MammothParser().parse(readFileSync(join(CORPUS_DIR, file)));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: file }));
  return { ...built, frontMatter: new FrontMatterBuilder().build(built) };
}

function* allBlocks(book: Book): Generator<Block> {
  function* fromSection(s: Section): Generator<Block> {
    yield* s.content;
    for (const sub of s.subsections ?? []) yield* fromSection(sub);
  }
  for (const content of book.mainContent as Content[]) {
    yield* content.content;
    if (content.type === 'chapter') for (const s of content.sections ?? []) yield* fromSection(s);
    else yield* (function* () { for (const sub of (content as Section).subsections ?? []) yield* fromSection(sub); })();
  }
}

const silencedWarn = async <T>(fn: () => Promise<T>): Promise<T> => {
  const orig = console.warn;
  console.warn = () => {};
  try { return await fn(); } finally { console.warn = orig; }
};

// ---------------------------------------------------------------------------- 1. align census

function countAligned(book: Book): { total: number; aligned: number; values: Record<string, number> } {
  let total = 0, aligned = 0;
  const values: Record<string, number> = {};
  for (const b of allBlocks(book)) {
    total += 1;
    const align = (b as { align?: string }).align;
    if (align !== undefined) { aligned += 1; values[align] = (values[align] ?? 0) + 1; }
  }
  return { total, aligned, values };
}

async function section1() {
  console.log('\n== 1. ALIGN CENSUS (who produces block.align?) ==');
  // POSITIVE CONTROL: the census must count a present align before any zero is believed.
  const control: Book = {
    metadata: { title: 'c', author: 'c', language: 'en' },
    frontMatter: {},
    mainContent: [{
      type: 'chapter', id: 'c1', number: 1, title: 'C', createdAt: new Date(), updatedAt: new Date(),
      content: [
        { type: 'paragraph', id: 'p1', text: 'justified', align: 'justify' } as Block,
        { type: 'paragraph', id: 'p2', text: 'plain' } as Block,
      ],
    }],
  } as unknown as Book;
  const seen = countAligned(control);
  if (seen.aligned !== 1 || seen.values['justify'] !== 1) throw new Error('POSITIVE CONTROL FAILED — census is blind');
  console.log('positive control: 1 aligned block seen among 2 — instrument sees align. OK');

  for (const file of FILES) {
    const book = await loadBook(file);
    const { total, aligned, values } = countAligned(book);
    console.log(`${file.padEnd(40)} blocks ${String(total).padStart(5)}  with align: ${aligned}  ${JSON.stringify(values)}`);
  }
}

// ---------------------------------------------------------------------------- 2. real leading

function pageStreams(pdf: Buffer): string[] {
  // Uncompressed PDFKit output: object bodies are readable. Map /Type /Page objects to their
  // /Contents streams so font binaries never pollute the census.
  const text = pdf.toString('latin1');
  const objects = new Map<number, string>();
  const objRe = /(\d+) 0 obj([\s\S]*?)endobj/g;
  for (let m = objRe.exec(text); m; m = objRe.exec(text)) objects.set(Number(m[1]), m[2]);
  const streams: string[] = [];
  for (const body of objects.values()) {
    if (!/\/Type\s*\/Page[^s]/.test(body)) continue;
    const contents = /\/Contents\s+(\d+)\s+0\s+R/.exec(body);
    if (!contents) continue;
    const streamBody = objects.get(Number(contents[1]));
    const stream = streamBody && /stream\r?\n([\s\S]*?)\r?\nendstream/.exec(streamBody);
    if (stream) streams.push(stream[1]);
  }
  return streams;
}

interface TextOp { y: number; size: number; }

function textOps(stream: string): TextOp[] {
  // Track Tf size and text-space y through BT/ET blocks; record a point at each Tj/TJ.
  const ops: TextOp[] = [];
  let size = 0, y = 0;
  const tokenRe = /\/\w+\s+([\d.]+)\s+Tf|([-\d.]+)\s+([-\d.]+)\s+Td|([-\d.]+)\s+([-\d.]+)\s+TD|[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+([-\d.]+)\s+([-\d.]+)\s+Tm|(Tj|TJ)/g;
  for (let m = tokenRe.exec(stream); m; m = tokenRe.exec(stream)) {
    if (m[1] !== undefined) size = Number(m[1]);
    else if (m[3] !== undefined) y += Number(m[3]);
    else if (m[5] !== undefined) y += Number(m[5]);
    else if (m[7] !== undefined) y = Number(m[7]);
    else if (m[8] !== undefined) ops.push({ y, size });
  }
  return ops;
}

async function section2() {
  console.log('\n== 2. REAL LEADING — declared 1.4 vs what the PDF advances ==');
  const measurer = new PdfKitTextMeasurer();
  for (const name of THEMES) {
    const theme = getTheme(name);
    const body = theme.fontSizes.body;
    const line = measurer.lineHeight(body, { theme });
    console.log(
      `${name.padEnd(8)} body ${body}pt  declared lineHeight ${theme.spacing.lineHeight}  ` +
      `measurer(real face) ${line.toFixed(2)}pt = ${(line / body).toFixed(3)}em  ` +
      `declared would be ${(body * theme.spacing.lineHeight).toFixed(2)}pt`
    );
  }
  // Confirm on REAL page bytes (faith-alone, Classic, kdp-6x9): modal baseline delta.
  const book = await loadBook(FILES[0]);
  const theme = getTheme('classic');
  const styled = new ThemeEngine().applyTheme(orderByRole(book), theme);
  const typeset = new TypographyResolver().resolve(styled);
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP6x9PageLayout);
  const result = await silencedWarn(() => new PDFRenderer({ compress: false }).render(paginated, { language: 'en' }));
  const pdf = result.output as Buffer;
  const streams = pageStreams(pdf);
  const deltas: Record<string, number> = {};
  for (const s of streams.slice(5, 60)) { // body pages, past front matter/TOC
    const ops = textOps(s).filter((o) => Math.abs(o.size - theme.fontSizes.body) < 0.01);
    for (let i = 1; i < ops.length; i++) {
      const d = (ops[i - 1].y - ops[i].y).toFixed(2);
      if (Number(d) > 0 && Number(d) < 40) deltas[d] = (deltas[d] ?? 0) + 1;
    }
  }
  const top = Object.entries(deltas).sort((a, b) => b[1] - a[1]).slice(0, 4);
  console.log(`real page bytes (faith-alone/classic/kdp-6x9, ${streams.length} pages): baseline deltas ${JSON.stringify(top)}`);
}

// ---------------------------------------------------------------------------- 3. raggedness

async function section3() {
  console.log('\n== 3. RAGGEDNESS / HYPHENATION COST (faith-alone, kdp-6x9 column) ==');
  const doc = new PDFDocument({ autoFirstPage: false });
  new PdfFontRegistry().registerAll(doc);
  const usableWidth = KDP6x9PageLayout.width - KDP6x9PageLayout.marginLeft - KDP6x9PageLayout.marginRight;
  const book = await loadBook(FILES[0]);

  for (const name of THEMES) {
    const theme = getTheme(name);
    const styled = new ThemeEngine().applyTheme(orderByRole(book), theme);
    // Same face resolution as the renderer/measurer.
    const registry = new PdfFontRegistry();
    const face = registry.resolveBody(theme, false, false);
    const size = theme.fontSizes.body;
    doc.font(face).fontSize(size);
    const em = doc.widthOfString('M');
    const spaceW = doc.widthOfString(' ');

    const slacks: number[] = [];
    let lines = 0, paragraphs = 0;
    for (const b of allBlocks(styled.book ?? book)) {
      if (b.type !== 'paragraph') continue;
      const text = (b as Paragraph).text;
      if (!text || !text.trim()) continue;
      paragraphs += 1;
      // Greedy wrap — PDFKit's own model (LineWrapper is greedy over word widths).
      const words = text.split(/\s+/).filter(Boolean);
      let lineW = 0;
      const widths = words.map((w) => doc.widthOfString(w));
      const lineWidths: number[] = [];
      for (const w of widths) {
        if (lineW === 0) lineW = w;
        else if (lineW + spaceW + w <= usableWidth) lineW += spaceW + w;
        else { lineWidths.push(lineW); lineW = w; }
      }
      if (lineW > 0) lineWidths.push(lineW);
      // Slack on every NON-FINAL line (the final line is legitimately short).
      for (let i = 0; i < lineWidths.length - 1; i++) slacks.push(usableWidth - lineWidths[i]);
      lines += lineWidths.length;
    }
    slacks.sort((a, b) => a - b);
    const q = (p: number) => slacks[Math.min(slacks.length - 1, Math.floor(p * slacks.length))];
    const over = (t: number) => slacks.filter((s) => s > t).length;
    console.log(
      `${name.padEnd(8)} ${paragraphs} paragraphs, ${lines} lines (${slacks.length} non-final): ` +
      `slack p50 ${q(0.5).toFixed(1)}pt  p90 ${q(0.9).toFixed(1)}pt  max ${q(1).toFixed(1)}pt  ` +
      `(1em=${em.toFixed(1)}pt)  >1.5em: ${over(1.5 * em)} (${((over(1.5 * em) / slacks.length) * 100).toFixed(1)}%)  ` +
      `>2.5em: ${over(2.5 * em)} (${((over(2.5 * em) / slacks.length) * 100).toFixed(1)}%)`
    );
  }
}

// ---------------------------------------------------------------------------- 4. title widows on real pages

async function section4() {
  console.log('\n== 4. TITLE-WIDOW CENSUS ON REAL PAGES (heading near bottom, <2 body lines under) ==');
  const measurer = new PdfKitTextMeasurer();
  for (const file of [FILES[0], FILES[3]]) {
    for (const name of THEMES) {
      const theme = getTheme(name);
      const book = await loadBook(file);
      const styled = new ThemeEngine().applyTheme(orderByRole(book), theme);
      const typeset = new TypographyResolver().resolve(styled);
      const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP6x9PageLayout);
      const result = await silencedWarn(() => new PDFRenderer({ compress: false }).render(paginated, { language: 'en' }));
      const streams = pageStreams(result.output as Buffer);
      const bodyLine = measurer.lineHeight(theme.fontSizes.body, { theme });
      const bottom = KDP6x9PageLayout.marginBottom;
      let hits = 0, tight = 0;
      const details: string[] = [];
      streams.forEach((s, pageIdx) => {
        const ops = textOps(s);
        // headings: strictly larger than body (+2pt guard against footer/running-head sizes)
        const headings = ops.filter((o) => o.size >= theme.fontSizes.body + 3);
        for (const h of headings) {
          const under = ops.filter((o) => o.y < h.y - 1 && o.size < theme.fontSizes.body + 3 && o.y >= bottom - 20).length;
          const nearBottom = h.y < bottom + 2 * bodyLine + 5;
          if (nearBottom && under < 2) { hits += 1; details.push(`p${pageIdx + 1} y=${h.y.toFixed(0)} size=${h.size} under=${under}`); }
          else if (under > 0 && under < 2) { tight += 1; details.push(`TIGHT p${pageIdx + 1} y=${h.y.toFixed(0)} size=${h.size} under=${under}`); }
        }
      });
      console.log(`${file.slice(0, 22).padEnd(24)} ${name.padEnd(8)} pages ${String(streams.length).padStart(3)}  bottom-widow hits: ${hits}  1-line-under (anywhere): ${tight}${details.length ? '  [' + details.slice(0, 6).join('; ') + ']' : ''}`);
    }
  }
}

// ---------------------------------------------------------------------------- 5. atomicity census

async function section5() {
  console.log('\n== 5. ATOMICITY CENSUS (atomic blocks vs page space; unplanned per fixture × theme) ==');
  const usableWidth = KDP6x9PageLayout.width - KDP6x9PageLayout.marginLeft - KDP6x9PageLayout.marginRight;
  const usableHeight = KDP6x9PageLayout.height - KDP6x9PageLayout.marginTop - KDP6x9PageLayout.marginBottom;
  for (const file of FILES) {
    const book = await loadBook(file);
    const atomicTypes: Record<string, number> = {};
    for (const b of allBlocks(book)) {
      if (['quote', 'scripture', 'list', 'table', 'image'].includes(b.type)) atomicTypes[b.type] = (atomicTypes[b.type] ?? 0) + 1;
    }
    for (const name of THEMES) {
      const theme = getTheme(name);
      const styled = new ThemeEngine().applyTheme(orderByRole(book), theme);
      const typeset = new TypographyResolver().resolve(styled);
      const engine = new LayoutEngine(new PdfKitTextMeasurer());
      const paginated = engine.paginate(typeset, KDP6x9PageLayout);
      const result = await silencedWarn(() => new PDFRenderer().render(paginated, { language: 'en' }));
      // charge every atomic block with the engine's own estimator
      const charge = (b: Block): number =>
        (engine as unknown as { estimateBlockHeight(b: Block, s: unknown, w: number): number })
          .estimateBlockHeight(b, typeset, usableWidth);
      let overFull = 0, overHalf = 0;
      for (const b of allBlocks(book)) {
        if (!['quote', 'scripture', 'list', 'table', 'image'].includes(b.type)) continue;
        const h = charge(b);
        if (h > usableHeight) overFull += 1;
        else if (h > usableHeight / 2) overHalf += 1;
      }
      console.log(
        `${file.slice(0, 22).padEnd(24)} ${name.padEnd(8)} model ${String(paginated.pages.length).padStart(3)}  ` +
        `real ${String(result.metrics.pageCount).padStart(3)}  unplanned ${result.metrics.unplannedPageBreaks}  ` +
        `atomic ${JSON.stringify(atomicTypes)}  >page ${overFull}  >half ${overHalf}`
      );
    }
  }
}

async function main() {
  console.log('TYPOGRAPHY-QUALITY cadrage probe — real corpus, kdp-6x9');
  await section1();
  await section2();
  await section3();
  await section4();
  await section5();
}

main();
