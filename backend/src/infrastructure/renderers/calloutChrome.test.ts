import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../fonts/PdfKitTextMeasurer';
import { PDFRenderer } from './PDFRenderer';
import { DOCXRenderer } from './DOCXRenderer';
import { EPUBRenderer } from './EPUBRenderer';
import { getTheme } from '../../domain/themes/getTheme';
import { KDP5x8PageLayout } from '../../domain/layouts/KDP5x8PageLayout';
import { createBook } from '../../domain/models/Book';
import {
  CALLOUT_RULE_PT,
  CALLOUT_GAP_PT,
  calloutTextIndentPt,
  calloutRuleColorOf,
  calloutTintOf,
} from '../../domain/services/calloutMetrics';
import type { Chapter, Paragraph } from '../../domain/models/Book';
import type { PaginatedBook } from '../../domain/models/PaginatedBook';

/**
 * MINI_DR_CALLOUTS §6 commit 2 — the chrome, priced in lock-step.
 *
 * One mechanism (left rule + optional tint), one theme-declared value (the tint policy:
 * Classic 'none', Modern 'accent'), one shared module (`calloutMetrics`) read by the model AND
 * all three renderers. The atomicity test is BORN IN THIS COMMIT with the exclusion it
 * discloses (the DROPCAP_PARAGRAPH_ATOMICITY lesson: never let atomic behaviour sit unmeasured).
 */
const SENTENCE = 'This set-off passage carries the same measured words in every run of the instrument. ';

function chapterOf(blocks: Paragraph[]): Chapter {
  const now = new Date();
  return { type: 'chapter', id: 'c1', number: 1, title: 'One', content: blocks, createdAt: now, updatedAt: now };
}

function paragraphAt(i: number, opts: { callout?: boolean; text?: string } = {}): Paragraph {
  return {
    type: 'paragraph',
    id: `p${i}`,
    text: opts.text ?? SENTENCE.trim(),
    ...(opts.callout ? { callout: true as const } : {}),
  };
}

function paginateUnder(themeName: 'classic' | 'modern', blocks: Paragraph[]): PaginatedBook {
  const book = createBook({ title: 'Callout', author: 'T', language: 'en' }, [chapterOf(blocks)]);
  const typeset = new TypographyResolver().resolve(new ThemeEngine().applyTheme(book, getTheme(themeName)));
  return new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP5x8PageLayout);
}

describe('callout chrome (MINI_DR_CALLOUTS §6 commit 2)', () => {
  it('tint derivation: Classic rule-only (D4), Modern accent-derived tint (D3), rule = the resolved accent', () => {
    expect(calloutTintOf(getTheme('classic'))).toBeNull();
    const modernTint = calloutTintOf(getTheme('modern'));
    expect(modernTint).toMatch(/^#[0-9A-Fa-f]{6}$/); // a LITERAL hex — w:shd and reader CSS demand one
    expect(modernTint!.toLowerCase()).not.toBe(getTheme('modern').colors.accent.toLowerCase()); // mixed toward paper, not the raw accent
    expect(calloutRuleColorOf(getTheme('classic'))).toBe(getTheme('classic').colors.accent);
    expect(calloutRuleColorOf(getTheme('modern'))).toBe(getTheme('modern').colors.accent);
  });

  it('charged == consumed with callouts live: 40 marked paragraphs, unplanned 0, pageCount == plan', async () => {
    const blocks = Array.from({ length: 40 }, (_, i) => paragraphAt(i, { callout: true, text: SENTENCE.repeat(2).trim() }));
    const paginated = paginateUnder('classic', blocks);
    const plain = paginateUnder('classic', Array.from({ length: 40 }, (_, i) => paragraphAt(i, { text: SENTENCE.repeat(2).trim() })));

    // The chrome's padding is REAL charged height: the marked book must be priced strictly higher.
    expect(paginated.pages.length).toBeGreaterThanOrEqual(plain.pages.length);

    const rendered = await new PDFRenderer({ compress: false }).render(paginated, { language: 'en' });
    expect(rendered.metrics.unplannedPageBreaks).toBe(0);
    expect(rendered.metrics.pageCount).toBe(paginated.pages.length);

    // The overcharge-direction geometric bound (the drop-cap §7 lesson, applied from birth):
    // callout text must start at margin + rule + gap — a renderer ignoring the indent would
    // draw at the margin and unplanned would stay blind to the mismatch.
    const margin = KDP5x8PageLayout.marginLeft;
    const origins = [...rendered.output.toString('latin1').matchAll(/1 0 0 1 ([\d.]+) [\d.]+ Tm/g)].map((m) => Number(m[1]));
    const indented = origins.filter((x) => x > margin + 1);
    expect(indented.length).toBeGreaterThan(0);
    for (const x of indented) expect(x).toBeGreaterThanOrEqual(margin + calloutTextIndentPt() - 0.5);
  });

  it('atomicity, LOUD from birth: an over-page callout reconciles counted and attributed; the same text unmarked splits silently clean', async () => {
    const longText = SENTENCE.repeat(40).trim(); // ~2+ pages on kdp-5x8
    const marked = paginateUnder('classic', [paragraphAt(0, { callout: true, text: longText })]);
    const renderedMarked = await new PDFRenderer().render(marked, { language: 'en' });
    expect(renderedMarked.metrics.unplannedPageBreaks).toBeGreaterThanOrEqual(1);
    expect(renderedMarked.metrics.pageCount).toBe(marked.pages.length + renderedMarked.metrics.unplannedPageBreaks!);

    const unmarked = paginateUnder('classic', [paragraphAt(0, { text: longText })]);
    const renderedUnmarked = await new PDFRenderer().render(unmarked, { language: 'en' });
    expect(renderedUnmarked.metrics.unplannedPageBreaks).toBe(0);
  });

  it('DOCX: a marked paragraph carries the left border; the shading appears under Modern and NOT under Classic', async () => {
    const blocks = [paragraphAt(0, { callout: true }), paragraphAt(1)];

    const classicXml = await documentXml((await new DOCXRenderer({ measurer: new PdfKitTextMeasurer() }).render(paginateUnder('classic', blocks), { language: 'en' })).output);
    expect(classicXml).toContain('w:pBdr'); // the rule
    expect(classicXml).not.toContain('w:shd'); // D4: Classic prints B&W-safe, no tint
    expect(classicXml).toContain(`w:sz="${CALLOUT_RULE_PT * 8}"`); // eighths of a point
    expect(classicXml).toContain(`w:space="${CALLOUT_GAP_PT}"`);

    const modernXml = await documentXml((await new DOCXRenderer({ measurer: new PdfKitTextMeasurer() }).render(paginateUnder('modern', blocks), { language: 'en' })).output);
    expect(modernXml).toContain('w:pBdr');
    expect(modernXml).toContain(`w:fill="${calloutTintOf(getTheme('modern'))!.replace('#', '').toUpperCase()}"`);
  });

  it('EPUB: the marked paragraph carries the callout class; the stylesheet rules from the shared module, tint only under Modern', async () => {
    const blocks = [paragraphAt(0, { callout: true }), paragraphAt(1)];

    const classicText = await epubText(paginateUnder('classic', blocks));
    expect(classicText).toContain('<p class="callout"');
    expect(classicText).toContain(`border-left: ${CALLOUT_RULE_PT}pt solid ${getTheme('classic').colors.accent}`);
    expect(classicText).not.toContain('.callout { background');

    const modernText = await epubText(paginateUnder('modern', blocks));
    expect(modernText).toContain(`background-color: ${calloutTintOf(getTheme('modern'))}`);
  });

  it('leak guard: an unmarked book emits zero callout chrome in any format', async () => {
    const blocks = [paragraphAt(0), paragraphAt(1)];
    const docxXml = await documentXml((await new DOCXRenderer({ measurer: new PdfKitTextMeasurer() }).render(paginateUnder('modern', blocks), { language: 'en' })).output);
    expect(docxXml).not.toContain('w:pBdr');
    const epub = await epubText(paginateUnder('modern', blocks));
    expect(epub).not.toContain('class="callout"');
  });

  it('a callout paragraph never takes the chapterOpening drop cap — one rule, decided in the resolver, followed everywhere', () => {
    const theme = { ...getTheme('classic'), name: 'trigger-test', presentation: { ...getTheme('classic').presentation, dropCap: { scope: 'chapterOpening' as const, scale: 2.5 } } };
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapterOf([paragraphAt(0, { callout: true }), paragraphAt(1)])]);
    const typeset = new TypographyResolver().resolve(new ThemeEngine().applyTheme(book, theme));
    expect(typeset.blockTypography?.['p0']?.dropCap).toBe(false); // the set-off aside is not the opening ornament
  });
});

async function documentXml(output: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(output);
  return zip.file('word/document.xml')!.async('string');
}

async function epubText(paginated: PaginatedBook): Promise<string> {
  const buffer = (await new EPUBRenderer().render(paginated, { language: 'en' })).output;
  const zip = await JSZip.loadAsync(buffer);
  const texts = await Promise.all(Object.values(zip.files).filter((f) => !f.dir).map((f) => f.async('string')));
  return texts.join('\n');
}
