/**
 * Post-fix relock measurement (MINI_DR_BLOCKLESS_TITLES D6): the exact new numbers for every
 * parity lock the charging change moves, measured with each test's own configuration —
 * modern/novel theme locks (letter + kdp-6x9, no TOC), partOpener config (classic, kdp-6x9,
 * auto-TOC, base + 3 openers). Also captures the unplanned-warning attributions so each delta
 * is EXPLAINED, not just relocked. Run: npx tsx spikes/typography-quality-probe5.ts
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
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { LetterPageLayout } from '../src/domain/layouts/LetterPageLayout';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import { getTheme } from '../src/domain/themes/getTheme';
import type { Book, Chapter, Content } from '../src/domain/models/Book';
import type { PageLayout } from '../src/domain/models/PageLayout';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'verification', 'corpus', 'faith-alone-styled.docx');

async function loadFaith(): Promise<Book> {
  const raw = await new MammothParser().parse(readFileSync(FILE));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'faith-alone-styled.docx' }));
  return { ...built, frontMatter: new FrontMatterBuilder().build(built) };
}

async function run(label: string, book: Book, themeName: string, layout: PageLayout) {
  const styled = new ThemeEngine().applyTheme(book, getTheme(themeName));
  const typeset = new TypographyResolver().resolve(styled);
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, layout);
  const warns: string[] = [];
  const orig = console.warn;
  console.warn = (...a: unknown[]) => { warns.push(a.map(String).join(' ')); };
  const result = await new PDFRenderer().render(paginated, { language: 'en' });
  console.warn = orig;
  console.log(
    `${label.padEnd(34)} model ${String(paginated.pages.length).padStart(3)}  real ${String(result.metrics.pageCount).padStart(3)}  ` +
    `unplanned ${result.metrics.unplannedPageBreaks}  degraded ${result.metrics.degradedDropCaps ?? '-'}`
  );
  for (const w of warns) console.log(`    ${w.slice(14, 150)}`);
}

function opener(n: number, title: string): Chapter {
  const now = new Date();
  return { type: 'chapter', id: `part-opener-${n}`, number: 0, title, content: [], createdAt: now, updatedAt: now };
}

async function main() {
  const faith = await loadFaith();

  console.log('— theme locks (no TOC, the theme tests\' own config) —');
  await run('modern  × letter', faith, 'modern', LetterPageLayout);
  await run('modern  × kdp-6x9', faith, 'modern', KDP6x9PageLayout);
  await run('novel   × letter', faith, 'novel', LetterPageLayout);
  await run('novel   × kdp-6x9', faith, 'novel', KDP6x9PageLayout);
  await run('classic × letter', faith, 'classic', LetterPageLayout);
  await run('classic × kdp-6x9', faith, 'classic', KDP6x9PageLayout);

  console.log('\n— partOpenerParity config (classic, kdp-6x9, auto-TOC) —');
  const tocBook: Book = { ...faith, frontMatter: { ...faith.frontMatter, toc: { entries: [], generateAutomatically: true } } };
  await run('base (auto-TOC)', tocBook, 'classic', KDP6x9PageLayout);
  const mc = tocBook.mainContent;
  const third = Math.floor(mc.length / 3);
  const withOpeners: Book = {
    ...tocBook,
    mainContent: [
      opener(1, 'Part I: The Question'),
      ...mc.slice(0, third),
      opener(2, 'Part II: The Argument'),
      ...mc.slice(third, 2 * third),
      opener(3, 'Part III: The Answer'),
      ...mc.slice(2 * third),
    ] as Content[],
  };
  await run('with 3 openers (auto-TOC)', withOpeners, 'classic', KDP6x9PageLayout);
}

main();
