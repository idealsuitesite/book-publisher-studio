/**
 * FOUNDER_TRAVERSAL — CTO-ordered measurement before Lot 1 can close. Resolves the contradiction
 * in the defect-3 report: does epub-gen CRASH or generate cleanly when the language is unknown?
 * Distinguishes three cases precisely:
 *   A. lang KEY OMITTED (the shipped code) — does the EPUB generate? what dc:language results?
 *   B. lang: undefined set EXPLICITLY — does it 500 (the case the report conflated with A)?
 *   C. a book WITH a language — the EPUB carries it (regression).
 * Uses the founder's real authorless/languageless bytes for A (Author B's exact manuscript).
 * Read-only. Run: npx tsx spikes/epub-lang-behavior-probe.ts
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import JSZip from 'jszip';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { FrontMatterBuilder } from '../src/domain/services/FrontMatterBuilder';
import { EPUBRenderer } from '../src/infrastructure/renderers/EPUBRenderer';
import { getTheme } from '../src/domain/themes/getTheme';
import { LetterPageLayout } from '../src/domain/layouts/LetterPageLayout';
import { createBook } from '../src/domain/models/Book';
import type { Book, Chapter } from '../src/domain/models/Book';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(__dirname, '..', 'verification', 'corpus', 'faith-alone-styled.docx');
const require = createRequire(import.meta.url);

function paginate(book: Book) {
  const withFront = { ...book, frontMatter: new FrontMatterBuilder().build(book) };
  const styled = new ThemeEngine().applyTheme(withFront, getTheme('classic'));
  const typeset = new TypographyResolver().resolve(styled);
  return new LayoutEngine().paginate(typeset, LetterPageLayout);
}

async function dcLanguage(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const opfName = Object.keys(zip.files).find((n) => n.endsWith('.opf'));
  if (!opfName) return '(no .opf)';
  const opf = await zip.file(opfName)!.async('string');
  const m = opf.match(/<dc:language[^>]*>([^<]*)<\/dc:language>/);
  return m ? m[1] : '(no dc:language)';
}

async function main() {
  // Author B's real manuscript: no author, no language (post defect-3 import).
  const raw = await new MammothParser().parse(readFileSync(CORPUS));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'faith-alone-styled.docx' }));
  const authorlessBook: Book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  console.log(`book.metadata.language = ${JSON.stringify(authorlessBook.metadata.language)} (Author B: no declared language)\n`);

  // CASE A — the SHIPPED code (omit the lang key). Does it generate? what dc:language?
  try {
    const result = await new EPUBRenderer().render(paginate(authorlessBook), { language: authorlessBook.metadata.language });
    const buf = result.output as Buffer;
    console.log(`CASE A (shipped: lang key OMITTED): EPUB GENERATED ok, ${buf.length} bytes`);
    console.log(`  → dc:language in the EPUB = "${await dcLanguage(buf)}"  (epub-gen's own default, our model stays language-unknown)`);
  } catch (e) {
    console.log(`CASE A (shipped: lang key OMITTED): CRASHED — ${(e as Error).message}`);
  }

  // CASE B — set lang: undefined EXPLICITLY, to confirm THAT is what 500s (the report's conflation).
  try {
    const options = require('epub-gen-memory').default ?? require('epub-gen-memory');
    void options;
    // Reproduce via the library directly with an explicit undefined lang.
    const epub = require('epub-gen-memory').default as (o: unknown, c: unknown) => Promise<Buffer>;
    const buf = await epub({ title: 'T', author: 'A', lang: undefined, version: 3 }, [{ title: 'C', content: '<p>x</p>' }]);
    console.log(`\nCASE B (lang: undefined EXPLICIT): generated ${buf.length} bytes (did NOT crash)`);
  } catch (e) {
    console.log(`\nCASE B (lang: undefined EXPLICIT): CRASHED — ${(e as Error).message}`);
  }

  // CASE C — a book WITH a language carries it (regression).
  const now = new Date();
  const chapter: Chapter = { type: 'chapter', id: 'c1', number: 1, title: 'One', content: [{ type: 'paragraph', id: 'p1', text: 'Bonjour.' }], createdAt: now, updatedAt: now };
  const frenchBook = createBook({ title: 'Livre', author: 'Jean', language: 'fr' }, [chapter]);
  const cRes = await new EPUBRenderer().render(paginate(frenchBook), { language: 'fr' });
  console.log(`\nCASE C (language 'fr' present): dc:language = "${await dcLanguage(cRes.output as Buffer)}" (must be fr)`);
}

main();
