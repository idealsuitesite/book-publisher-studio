/**
 * PART_LEVEL_STRUCTURE scope spike — geometry only, read-only, no production code.
 * Run: npx tsx spikes/part-level-geometry-spike.ts
 *
 * The question: is a "Part opener" (Part I / Part II divider page) ALREADY expressible with
 * existing primitives — a titled, empty-content top-level Chapter reusing the chapter-starts-
 * a-new-page rule — and does charged==consumed (ADR-0051) hold on that shape TODAY?
 *
 * Why this exact probe: a titled chapter with ZERO blocks is the untested inverse of the
 * empty-title drift MINI_DR_SUBTITLE_SPACING closed (an untitled section WITH blocks). If the
 * model paginates it differently than the renderer draws it, a Part chantier inherits a latent
 * drift on day one — better measured now than discovered mid-build.
 *
 * Measures, on real faith-alone (kdp-6x9, classic), base vs +3 synthetic Part openers:
 *   model pages / real pages / unplannedPageBreaks / TOC entries / where openers land.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { FrontMatterBuilder } from '../src/domain/services/FrontMatterBuilder';
import { getTheme } from '../src/domain/themes/getTheme';
import { orderByRole } from '../src/domain/services/orderByRole';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import type { Book, Chapter, Content } from '../src/domain/models/Book';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'verification', 'corpus', 'faith-alone-styled.docx');

function partOpener(n: number, title: string): Chapter {
  const now = new Date();
  return {
    type: 'chapter',
    id: `part-opener-${n}`,
    number: 0, // renumbering is the editing service's job; irrelevant to geometry
    title,
    content: [], // the probe: a titled chapter with ZERO blocks
    createdAt: now,
    updatedAt: now,
  };
}

async function run(label: string, book: Book) {
  const styled = new ThemeEngine().applyTheme(orderByRole(book), getTheme('classic'));
  const typeset = new TypographyResolver().resolve(styled);
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP6x9PageLayout);

  const origWarn = console.warn;
  const warns: string[] = [];
  console.warn = (msg: unknown) => warns.push(String(msg));
  const result = await new PDFRenderer().render(paginated, { language: 'en' });
  console.warn = origWarn;

  const openersInModel = paginated.pages.filter((p) => p.blocks.some((id) => id.startsWith('part-opener-')));
  const openerOwnPages = paginated.pages.filter(
    (p) => p.blocks.length > 0 && p.blocks.every((id) => id.startsWith('part-opener-'))
  );
  const tocTitles = (paginated.tableOfContents ?? []).map((e) => e.title);
  console.log(`${label}:`);
  console.log(`  model pages ${paginated.pages.length}, real pages ${result.metrics.pageCount}, unplanned ${result.metrics.unplannedPageBreaks}`);
  console.log(`  TOC entries: ${tocTitles.length} ${tocTitles.some((t) => t.startsWith('Part ')) ? '(includes Part openers)' : ''}`);
  console.log(`  opener block-ids present on model pages: ${openersInModel.length}; opener-ONLY pages: ${openerOwnPages.length}`);
  if (warns.length) console.log(`  renderer warnings: ${warns.length} (first: ${warns[0]?.slice(0, 100)})`);
  return { model: paginated.pages.length, real: result.metrics.pageCount ?? 0, unplanned: result.metrics.unplannedPageBreaks ?? 0, toc: tocTitles };
}

async function main() {
  const raw = await new MammothParser().parse(readFileSync(FILE));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'f.docx' }));
  const book: Book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  // Auto-TOC on, so the TOC consumer is part of the probe.
  const withToc: Book = { ...book, frontMatter: { ...book.frontMatter, toc: { entries: [], generateAutomatically: true } } };

  console.log('Part-level geometry probe — faith-alone, kdp-6x9, classic\n');
  const base = await run('BASE (no parts)', withToc);

  // Insert 3 Part openers at the start, ~1/3 and ~2/3 of mainContent.
  const mc = withToc.mainContent;
  const third = Math.floor(mc.length / 3);
  const rebuilt: Content[] = [
    partOpener(1, 'Part I: The Question'),
    ...mc.slice(0, third),
    partOpener(2, 'Part II: The Argument'),
    ...mc.slice(third, 2 * third),
    partOpener(3, 'Part III: The Answer'),
    ...mc.slice(2 * third),
  ];
  const withParts: Book = { ...withToc, mainContent: rebuilt };
  const parts = await run('\n+3 PART OPENERS (titled, empty-content chapters)', withParts);

  console.log(`\nDELTA: model +${parts.model - base.model} pages, real +${parts.real - base.real}, unplanned ${base.unplanned} -> ${parts.unplanned}`);
  console.log(`TOC: ${base.toc.length} -> ${parts.toc.length} entries`);
  const verdict =
    parts.real - base.real === parts.model - base.model && parts.unplanned === base.unplanned
      ? 'charged == consumed HOLDS on the empty-titled-chapter shape (model and renderer agree on the added pages)'
      : 'DRIFT: model and renderer DISAGREE on the empty-titled-chapter shape — a Part chantier must fix this seam first';
  console.log(`VERDICT: ${verdict}`);
}

main();
