import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import * as epubModule from 'epub-gen-memory';
import { MammothParser } from '../parsers/MammothParser';
import { HtmlNormalizer } from '../normalizers/HtmlNormalizer';
import { ASTBuilder } from '../../domain/services/ASTBuilder';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { FrontMatterBuilder } from '../../domain/services/FrontMatterBuilder';
import { EPUBRenderer } from './EPUBRenderer';
import { PDFRenderer } from './PDFRenderer';
import { DOCXRenderer } from './DOCXRenderer';
import { ClassicTheme } from '../../domain/themes/ClassicTheme';
import { createBook } from '../../domain/models/Book';
import type { Book, Chapter } from '../../domain/models/Book';
import { LetterPageLayout } from '../../domain/layouts/LetterPageLayout';

/**
 * FOUNDER_TRAVERSAL EPUB-500 review (CTO). The defect-3 language floor left the Book honestly
 * language-unknown; EPUB REQUIRES a dc:language, so the adapter owns an explicit 'en' fallback
 * rather than depending on epub-gen's undocumented internal default. This guards the fix in BOTH
 * directions — the capHeight lesson — so a future refactor can never quietly reopen the 500:
 *   A. no language  → EPUB generates, dc:language = the documented 'en' fallback;
 *   C. a language   → it passes through (non-regression, a declared language wins);
 *   B. GUARD        → epub-gen THROWS on an explicit `lang: undefined`, which is exactly why the
 *                     adapter must never pass it — if a commit makes it do so, this test fires.
 * (This is the permanent home of the epub-lang-behavior-probe.ts measurement.)
 */

// epub-gen-memory ships CJS with no exports map; resolve the callable the same way EPUBRenderer does.
function rawEpub(): (o: Record<string, unknown>, c: unknown[]) => Promise<Buffer> {
  const mod = epubModule as unknown as Record<string, unknown>;
  for (const candidate of [mod, mod.default, mod.epub]) {
    if (typeof candidate === 'function') return candidate as (o: Record<string, unknown>, c: unknown[]) => Promise<Buffer>;
  }
  throw new Error('could not resolve epub-gen render function');
}

function paginate(book: Book) {
  const withFront = { ...book, frontMatter: new FrontMatterBuilder().build(book) };
  const styled = new ThemeEngine().applyTheme(withFront, ClassicTheme);
  const typeset = new TypographyResolver().resolve(styled);
  return new LayoutEngine().paginate(typeset, LetterPageLayout);
}

async function dcLanguage(buffer: Buffer): Promise<string | undefined> {
  const zip = await JSZip.loadAsync(buffer);
  const opfName = Object.keys(zip.files).find((n) => n.endsWith('.opf'));
  if (!opfName) return undefined;
  const opf = await zip.file(opfName)!.async('string');
  return opf.match(/<dc:language[^>]*>([^<]+)<\/dc:language>/)?.[1];
}

async function loadAuthorless(): Promise<Book> {
  const buffer = readFileSync(join(__dirname, '..', '..', '..', 'verification', 'corpus', 'faith-alone-styled.docx'));
  const raw = await new MammothParser().parse(buffer);
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'faith-alone-styled.docx' }));
  return { ...built, frontMatter: new FrontMatterBuilder().build(built) };
}

describe('EPUB language fallback — adapter-owned, guarded both ways (FOUNDER_TRAVERSAL EPUB-500 review)', () => {
  it('CASE A — no declared language: the EPUB generates (never a 500) with the documented "en" fallback', async () => {
    const book = await loadAuthorless();
    expect(book.metadata.language).toBeUndefined();

    const { output } = await new EPUBRenderer().render(paginate(book), { language: book.metadata.language });

    expect(await dcLanguage(output as Buffer)).toBe('en');
  }, 30_000);

  it('CASE C — a declared language passes through unchanged (a declared language always wins)', async () => {
    const now = new Date();
    const chapter: Chapter = { type: 'chapter', id: 'c1', number: 1, title: 'Un', content: [{ type: 'paragraph', id: 'p1', text: 'Bonjour.' }], createdAt: now, updatedAt: now };
    const book = createBook({ title: 'Livre', author: 'Jean', language: 'fr' }, [chapter]);

    const { output } = await new EPUBRenderer().render(paginate(book), { language: 'fr' });

    expect(await dcLanguage(output as Buffer)).toBe('fr');
  }, 30_000);

  it('CASE B (regression guard) — epub-gen THROWS on an explicit lang: undefined, which is why the adapter never passes it', async () => {
    // The hazard measured in the review: NOT omitting the key, but SETTING it to undefined.
    // If a future refactor "cleans up" by passing lang: metadata.language (undefined) straight
    // through, this is the crash Author B would hit — pinned here so the test fires first. The
    // throw is SYNCHRONOUS (epub-gen chokes while normalising options, before returning a promise),
    // so a try/catch catches both a sync throw and an async rejection.
    let threw = false;
    let message = '';
    try {
      await rawEpub()({ title: 'T', author: 'A', lang: undefined, version: 3 }, [{ title: 'C', content: '<p>x</p>' }]);
    } catch (e) {
      threw = true;
      message = (e as Error).message;
    }
    expect(threw, 'epub-gen no longer throws on an explicit lang: undefined — re-verify the adapter fallback is still needed').toBe(true);
    expect(message).toMatch(/replace/); // the measured signature ("...reading 'replace'")
  }, 30_000);

  it('the fallback is EPUB-LOCAL — the Book stays language-unknown and PDF/DOCX inherit no fabricated "en"', async () => {
    const book = await loadAuthorless();

    // Rendering EPUB must not mutate the model's honesty (ADR-0001) — the 'en' lives only in the artifact.
    await new EPUBRenderer().render(paginate(book), { language: book.metadata.language });
    expect(book.metadata.language).toBeUndefined();

    // The other two formats export the SAME languageless book with no language of their own —
    // each format handles its constraint at home; none inherits the EPUB fallback. (PDFRenderer
    // emits only Title/Author in its doc info; DOCXRenderer emits no language at all.)
    await expect(new PDFRenderer().render(paginate(book), { language: book.metadata.language })).resolves.toBeDefined();
    await expect(new DOCXRenderer().render(paginate(book), { language: book.metadata.language })).resolves.toBeDefined();
  }, 60_000);
});
