import { describe, it, expect } from 'vitest';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../fonts/PdfKitTextMeasurer';
import { PDFRenderer } from './PDFRenderer';
import { getTheme } from '../../domain/themes/getTheme';
import { KDP5x8PageLayout } from '../../domain/layouts/KDP5x8PageLayout';
import { createBook } from '../../domain/models/Book';
import type { Block, Chapter, Content, Section } from '../../domain/models/Book';
import type { PaginatedBook } from '../../domain/models/PaginatedBook';

/**
 * MINI_DR_SUBTITLE_SPACING — the fix asserted on the two properties the design locks:
 *  §6.1 LOCK-STEP: the renderer consumes exactly the flat titleSpaceBefore/titleSpaceAfter the
 *       theme declares — the same values LayoutEngine.titleHeightOf charges — so charged==consumed
 *       (ADR-0051) holds at the title. Measured on the renderer's REAL doc.y advances, not constants.
 *  §6.2 CONVENTION: a subtitle now has MORE space above it than below it (above > below), so it binds
 *       to the text it introduces. The pre-fix defect was the exact inverse (below ~3× above), so
 *       this assertion fails on the old moveDown()-below-only behaviour.
 *
 * Geometry, not a proxy: like dropCapOverlap.test.ts, the title-spacing change barely moves the page
 * count (+1 on the corpus), so a page-count test alone could pass before and after. The convention is
 * therefore asserted on where the cursor really is on the page. The page-count property is proven
 * separately below, as the charged==consumed guard.
 */

const now = new Date();
const para = (id: string, text: string): Block => ({ type: 'paragraph', id, text, inlines: [] });

function paginate(mainContent: Content[]): PaginatedBook {
  const book = createBook({ title: 'Subtitle Spacing', author: 'Test', language: 'en' }, mainContent);
  const typeset = new TypographyResolver().resolve(new ThemeEngine().applyTheme(book, getTheme('classic')));
  return new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP5x8PageLayout);
}

/**
 * Render `paginated`, wrapping the private renderTitle to record, per title, the actual doc.y the
 * renderer spends BEFORE the title text (space above) and AFTER it (space below). doc.y is the live
 * PDFKit cursor; spendSpaceAfter advances it by exact points, so these are the real consumed gaps.
 */
async function measureTitleGaps(paginated: PaginatedBook): Promise<Array<{ size: number; above: number; below: number }>> {
  const renderer = new PDFRenderer({ compress: false });
  const proto = Object.getPrototypeOf(renderer) as Record<string, unknown>;
  const orig = proto.renderTitle as (doc: PDFKit.PDFDocument, content: Content, theme: unknown) => void;
  const records: Array<{ size: number; above: number; below: number }> = [];

  proto.renderTitle = function (this: unknown, doc: PDFKit.PDFDocument, content: Content, theme: unknown) {
    const yEntry = doc.y;
    let yTextStart = NaN;
    let yTextEnd = NaN;
    const before = doc.text.bind(doc);
    (doc as unknown as { text: (...a: unknown[]) => unknown }).text = (t: unknown, ...args: unknown[]) => {
      yTextStart = doc.y;
      const r = before(t as string, ...(args as [number, number, PDFKit.Mixins.TextOptions]));
      yTextEnd = doc.y;
      return r;
    };
    orig.call(this, doc, content, theme);
    (doc as unknown as { text: unknown }).text = before;
    const size = content.type === 'chapter' ? 24 : Math.max(12, 22 - content.level * 2);
    records.push({ size, above: yTextStart - yEntry, below: doc.y - yTextEnd });
  };

  try {
    await renderer.render(paginated, { language: 'en' });
  } finally {
    proto.renderTitle = orig;
  }
  return records;
}

describe('MINI_DR_SUBTITLE_SPACING — title spacing as a theme value', () => {
  it('consumes exactly the theme titleSpaceBefore/titleSpaceAfter it charges (lock-step, ADR-0051)', async () => {
    const section: Section = {
      type: 'section', id: 's1', title: 'A Short Section', level: 2,
      content: [para('sp', 'Body text under the section, short enough to stay on the page.')],
      createdAt: now, updatedAt: now,
    };
    const chapter: Chapter = {
      type: 'chapter', id: 'c1', number: 1, title: 'Chapter One', sections: [section],
      content: [para('cp', 'Body text under the chapter, short enough to stay on the page.')],
      createdAt: now, updatedAt: now,
    };
    const { titleSpaceBefore, titleSpaceAfter } = getTheme('classic').spacing;

    const gaps = await measureTitleGaps(paginate([chapter]));

    // Both titles rendered (chapter 24pt + section 18pt), and each consumed the theme's exact,
    // flat, size-INDEPENDENT pair — the values titleHeightOf uses to charge. If the renderer and
    // the model ever diverge here, this breaks before the corpus reconciliations rise.
    expect(gaps.map((g) => g.size).sort((a, b) => a - b)).toEqual([18, 24]);
    for (const g of gaps) {
      expect(g.above).toBeCloseTo(titleSpaceBefore, 3);
      expect(g.below).toBeCloseTo(titleSpaceAfter, 3);
    }
  }, 60_000);

  it('places MORE space above a subtitle than below it (convention: above > below)', async () => {
    // A section subtitle mid-page: the paragraph before it leaves the cursor mid-column, so the
    // "above" gap is a real, in-flow measurement (not a page top). Pre-fix, below was ~3× above.
    const section: Section = {
      type: 'section', id: 's1', title: 'The Section Heading', level: 2,
      content: [para('sp', 'A short body paragraph beneath the section heading.')],
      createdAt: now, updatedAt: now,
    };
    const chapter: Chapter = {
      type: 'chapter', id: 'c1', number: 1, title: 'Opening Chapter', sections: [section],
      content: [para('cp', 'A paragraph of chapter body text that precedes the section heading.')],
      createdAt: now, updatedAt: now,
    };

    const gaps = await measureTitleGaps(paginate([chapter]));
    const subtitle = gaps.find((g) => g.size === 18);
    expect(subtitle, 'section subtitle was not rendered').toBeDefined();
    expect(subtitle!.above).toBeGreaterThan(subtitle!.below);
  }, 60_000);

  it('charged equals consumed: the model plans no page the renderer does not honour', async () => {
    // The page-level guard on the lock-step change: build several chapters and sections spanning
    // multiple pages of plain text (no emphasis runs, so no disclosed ±1-line residual). If
    // titleHeightOf mischarged relative to renderTitle, a title would land where the model did not
    // plan it and PDFKit would break a page on its own initiative -> unplannedPageBreaks > 0.
    const chapters: Content[] = Array.from({ length: 4 }, (_, ci): Chapter => ({
      type: 'chapter', id: `c${ci}`, number: ci + 1, title: `Chapter ${ci + 1}`,
      content: Array.from({ length: 6 }, (_unused, pi) =>
        para(`c${ci}p${pi}`, 'A plain paragraph of body text with no emphasis runs, long enough to occupy a couple of lines in the column so pages fill at a realistic rate.')),
      sections: Array.from({ length: 2 }, (_unused, si): Section => ({
        type: 'section', id: `c${ci}s${si}`, title: `Section ${ci + 1}.${si + 1}`, level: 2,
        content: Array.from({ length: 4 }, (_u, pi) =>
          para(`c${ci}s${si}p${pi}`, 'A plain paragraph of body text under a section heading, again with no emphasis runs so measurement matches rendering exactly.')),
        createdAt: now, updatedAt: now,
      })),
      createdAt: now, updatedAt: now,
    }));

    const paginated = paginate(chapters);
    const rendered = await new PDFRenderer().render(paginated, { language: 'en' });

    expect(rendered.metrics.unplannedPageBreaks).toBe(0);
    expect(rendered.metrics.pageCount).toBe(paginated.pages.length);
  }, 120_000);
});
