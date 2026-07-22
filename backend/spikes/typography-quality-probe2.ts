/**
 * Follow-up probe: (a) identify the Modern p40 bottom-heading hit from the MODEL side —
 * which title sits last-on-page, what did the model believe about the lines under it;
 * (b) list-dense reconciliations across layouts (the record says 5 — where?).
 * Run: npx tsx spikes/typography-quality-probe2.ts
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
import { orderByRole } from '../src/domain/services/orderByRole';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import { KDP5x8PageLayout } from '../src/domain/layouts/KDP5x8PageLayout';
import { LetterPageLayout } from '../src/domain/layouts/LetterPageLayout';
import { getTheme } from '../src/domain/themes/getTheme';
import type { Book, Content, Section, Block } from '../src/domain/models/Book';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(__dirname, '..', 'verification', 'corpus');

async function loadBook(file: string): Promise<Book> {
  const raw = await new MammothParser().parse(readFileSync(join(CORPUS_DIR, file)));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: file }));
  return { ...built, frontMatter: new FrontMatterBuilder().build(built) };
}

const silencedWarn = async <T>(fn: () => Promise<T>): Promise<T> => {
  const orig = console.warn;
  console.warn = () => {};
  try { return await fn(); } finally { console.warn = orig; }
};

async function partA() {
  console.log('== A. WHICH title sits at the bottom of Modern p40? (model view) ==');
  const book = await loadBook('faith-alone-styled.docx');
  const theme = getTheme('modern');
  const styled = new ThemeEngine().applyTheme(orderByRole(book), theme);
  const typeset = new TypographyResolver().resolve(styled);
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP6x9PageLayout);

  // Map: first-block-id -> content (title draws right before it)
  const titled = new Map<string, { title: string; kind: string; level: number }>();
  const collect = (c: Content | Section, kind: string, level: number) => {
    const first = (c.content as Block[])[0];
    if (c.title && first) titled.set(first.id, { title: c.title, kind, level });
    if (c.type === 'chapter') for (const s of c.sections ?? []) collect(s, 'section', s.level);
    else for (const s of (c as Section).subsections ?? []) collect(s, 'section', s.level);
  };
  for (const c of typeset.book.mainContent as Content[]) collect(c, c.type, 0);

  paginated.pages.forEach((page, i) => {
    if (i < 33 || i > 41) return;
    const startsHere = page.blocks.filter((id) => titled.has(id));
    const lastId = page.blocks[page.blocks.length - 1];
    const lastIsTitledStart = titled.has(lastId);
    const info = startsHere.map((id) => {
      const t = titled.get(id)!;
      const pos = page.blocks.indexOf(id);
      return `"${t.title.slice(0, 40)}" (${t.kind} L${t.level}) at block ${pos + 1}/${page.blocks.length}${id === lastId ? ' <= LAST ON PAGE' : ''}${page.splitAfterLines !== undefined && id === lastId ? ` splitAfter=${page.splitAfterLines}` : ''}`;
    });
    console.log(`model p${i + 1}: ${page.blocks.length} blocks${lastIsTitledStart ? ' [ends on a titled content start]' : ''}${info.length ? '  ' + info.join(' | ') : ''}`);
  });
}

async function partB() {
  console.log('\n== B. list-dense reconciliations across layouts (record says 5) ==');
  const book = await loadBook('art-of-captivating-list-dense.docx');
  for (const [label, layout] of [['kdp-6x9', KDP6x9PageLayout], ['kdp-5x8', KDP5x8PageLayout], ['letter', LetterPageLayout]] as const) {
    for (const name of ['classic', 'modern', 'novel'] as const) {
      const theme = getTheme(name);
      const styled = new ThemeEngine().applyTheme(orderByRole(book), theme);
      const typeset = new TypographyResolver().resolve(styled);
      const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, layout);
      const result = await silencedWarn(() => new PDFRenderer().render(paginated, { language: 'en' }));
      console.log(`${label.padEnd(8)} ${name.padEnd(8)} model ${String(paginated.pages.length).padStart(3)}  real ${String(result.metrics.pageCount).padStart(3)}  unplanned ${result.metrics.unplannedPageBreaks}`);
    }
  }
}

async function main() {
  await partA();
  await partB();
}

main();
