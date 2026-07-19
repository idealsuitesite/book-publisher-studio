/**
 * addPage census — decomposes the model-vs-PDF page gap (227 domain pages vs 284 real pages
 * at kdp-5x8 on Faith_Alone). Diagnostic ONLY: monkey-patches pdfkit's addPage in-process to
 * tally every call by its PDFRenderer call site. No src change. Run:
 *   npx tsx spikes/addpage-census-spike.ts
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const callSites = new Map<string, number>();
const orig = (PDFDocument.prototype as { addPage: (...a: unknown[]) => unknown }).addPage;
(PDFDocument.prototype as { addPage: (...a: unknown[]) => unknown }).addPage = function (...args: unknown[]) {
  const stack = (new Error().stack ?? '').split('\n');
  const site = (stack.find((l) => l.includes('PDFRenderer')) ?? stack[2] ?? 'unknown')
    .replace(/.*[\\/]/, '')
    .replace(/:\d+\)?$/, '');
  callSites.set(site, (callSites.get(site) ?? 0) + 1);
  return orig.apply(this, args);
};

import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { FrontMatterBuilder } from '../src/domain/services/FrontMatterBuilder';
import { getTheme } from '../src/domain/themes/getTheme';
import { KDP5x8PageLayout } from '../src/domain/layouts/KDP5x8PageLayout';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'uploads', '1784126236261-Faith_Alone_Professional_KDP_Kobo.docx');

async function main() {
  const buffer = readFileSync(FILE);
  const raw = await new MammothParser().parse(buffer);
  const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: 'faith.docx' });
  const built = new ASTBuilder().build(normalized);
  const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  const styled = new ThemeEngine().applyTheme(book, getTheme('classic'));
  const typeset = new TypographyResolver().resolve(styled);
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP5x8PageLayout);

  console.log(`domain pages: ${paginated.pages.length}`);
  callSites.clear(); // ignore any measurer-construction noise

  const result = await new PDFRenderer().render(paginated, { language: 'en' });
  const metrics = (result as unknown as { metrics?: { pageCount?: number } }).metrics;
  console.log(`renderer metrics.pageCount: ${metrics?.pageCount}`);

  let total = 0;
  console.log('\naddPage() calls by call site:');
  for (const [site, n] of [...callSites.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${site}`);
    total += n;
  }
  console.log(`  total addPage calls: ${total}  (+1 implicit first page = ${total + 1})`);
}

main();
