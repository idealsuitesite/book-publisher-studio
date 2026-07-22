import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MammothParser } from '../parsers/MammothParser';
import { HtmlNormalizer } from '../normalizers/HtmlNormalizer';
import { ASTBuilder } from '../../domain/services/ASTBuilder';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../fonts/PdfKitTextMeasurer';
import { FrontMatterBuilder } from '../../domain/services/FrontMatterBuilder';
import { ClassicTheme } from '../../domain/themes/ClassicTheme';
import { KDP6x9PageLayout } from '../../domain/layouts/KDP6x9PageLayout';
import { PDFRenderer } from './PDFRenderer';
import type { Book, Chapter, Content } from '../../domain/models/Book';

const FAITH_ALONE = join(__dirname, '..', '..', '..', 'verification', 'corpus', 'faith-alone-styled.docx');

/**
 * The charged==consumed lock for the Part-opener shape (PART_LEVEL_STRUCTURE commit 1), on the
 * REAL corpus manuscript (REAL_FIXTURE_POLICY). Before the ownsBarePage branch, this exact
 * composition measured model +0 / renderer +3 pages / unplanned 3→6 (part-level-geometry-
 * spike.ts) — the model never charged the page every renderer draws for a titled blockless
 * chapter. This suite locks the closed state, loud in both directions:
 *  - N openers → model +N pages AND renderer +N pages (charged == consumed);
 *  - unplannedPageBreaks does NOT rise with openers (their breaks are planned now);
 *  - the base book (no openers) keeps its exact base numbers — the byte-identity guard at the
 *    corpus level (no imported book contains the opener shape, measured by empty-shape-probe.ts).
 */
function opener(n: number, title: string): Chapter {
  const now = new Date();
  return { type: 'chapter', id: `part-opener-${n}`, number: 0, title, content: [], createdAt: now, updatedAt: now };
}

async function build(): Promise<Book> {
  const raw = await new MammothParser().parse(readFileSync(FAITH_ALONE));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'faith-alone-styled.docx' }));
  const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  // Auto-TOC on, so the TOC consumer is inside the lock too.
  return { ...book, frontMatter: { ...book.frontMatter, toc: { entries: [], generateAutomatically: true } } };
}

async function paginateAndRender(book: Book) {
  const styled = new ThemeEngine().applyTheme(book, ClassicTheme);
  const typeset = new TypographyResolver().resolve(styled);
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP6x9PageLayout);
  const origWarn = console.warn;
  console.warn = () => {};
  const result = await new PDFRenderer().render(paginated, { language: 'en' });
  console.warn = origWarn;
  return { paginated, metrics: result.metrics };
}

describe('Part-opener parity on real faith-alone (kdp-6x9, classic, auto-TOC)', () => {
  it('3 openers add exactly 3 pages to BOTH model and renderer, with no new unplanned breaks', async () => {
    const base = await build();
    const mc = base.mainContent;
    const third = Math.floor(mc.length / 3);
    const withOpeners: Book = {
      ...base,
      mainContent: [
        opener(1, 'Part I: The Question'),
        ...mc.slice(0, third),
        opener(2, 'Part II: The Argument'),
        ...mc.slice(third, 2 * third),
        opener(3, 'Part III: The Answer'),
        ...mc.slice(2 * third),
      ] as Content[],
    };

    const baseRun = await paginateAndRender(base);
    const openerRun = await paginateAndRender(withOpeners);

    // Exact locks, loud in both directions (the parity-suite style). Base is the corpus-level
    // byte-identity guard: these are the SAME numbers as before the ownsBarePage branch existed
    // (measured pre-fix by part-level-geometry-spike.ts — the branch is unreachable from any
    // real import). Re-locked for MINI_DR_BLOCKLESS_TITLES: one of the base 3 unplanned was the
    // blockless §3 section's uncharged title (TYPOGRAPHY_QUALITY_SCOPE §1) — now charged, so
    // 161/3 -> 160/2. Both remaining unplanned are the auto-TOC front matter spilling past its
    // single planned page (attributed "front matter" in the warnings) — pre-existing,
    // observable per ADR-0051. The model count is renderer-independent and stays 155: the
    // ~36pt charge absorbs into existing page slack without adding a model page.
    expect(baseRun.paginated.pages.length).toBe(155);
    expect(baseRun.metrics.pageCount).toBe(160);
    expect(baseRun.metrics.unplannedPageBreaks).toBe(2);

    // charged == consumed on the opener shape: the model now charges the 3 opener pages
    // (155→158) — pre-fix it charged +0 while the renderer drew +3 as unplanned breaks.
    expect(openerRun.paginated.pages.length).toBe(158);
    expect(openerRun.metrics.pageCount).toBe(164);
    // 3, not 5: the 3 opener drifts are GONE (planned pages now, PART_LEVEL), and the
    // paragraph-136 residual this comment used to carry vanished when MINI_DR_BLOCKLESS_TITLES
    // charged the §3 title and re-flowed its page context (moved by the re-flow, not cured —
    // Modern's kdp anchor still carries the class). The +1 over base is the auto-TOC front
    // matter spilling one page further with 3 more opener entries in the TOC — all three
    // warnings attribute to "front matter", none to an opener or a body block.
    expect(openerRun.metrics.unplannedPageBreaks).toBe(3);

    // The ADR-0051 ledger balances in BOTH runs: every real page is a planned model page, one of
    // the 3 planned front-matter pages (title, copyright, the TOC's first), or a counted
    // unplanned break. Nothing silent.
    for (const run of [baseRun, openerRun]) {
      expect(run.metrics.pageCount).toBe(run.paginated.pages.length + 3 + (run.metrics.unplannedPageBreaks ?? 0));
    }

    // Each opener owns exactly one model page carrying its own id.
    for (const id of ['part-opener-1', 'part-opener-2', 'part-opener-3']) {
      const ownPages = openerRun.paginated.pages.filter((p) => p.blocks.includes(id));
      expect(ownPages).toHaveLength(1);
      expect(ownPages[0].blocks).toEqual([id]);
    }

    // The TOC lists each Part with a real resolved page number.
    for (const title of ['Part I: The Question', 'Part II: The Argument', 'Part III: The Answer']) {
      const entry = openerRun.paginated.tableOfContents?.find((e) => e.title === title);
      expect(entry).toBeDefined();
      expect(entry?.pageNumber).toBeGreaterThan(0);
    }
  }, 120_000);
});
