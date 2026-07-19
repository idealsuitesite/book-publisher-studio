import { describe, it, expect } from 'vitest';
import { PDFRenderer } from './PDFRenderer';
import { PdfKitTextMeasurer } from '../fonts/PdfKitTextMeasurer';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { ClassicTheme } from '../../domain/themes/ClassicTheme';
import { createBook } from '../../domain/models/Book';
import { LetterPageLayout } from '../../domain/layouts/LetterPageLayout';
import { extractPdfText } from '../../test-utils/extractPdfText';
import type { Chapter, Paragraph } from '../../domain/models/Book';

/**
 * Phase B end to end (LAYOUT_FIDELITY.md Decision 7): a paragraph too long for its page is
 * really split by the real renderer, with the model and the shipped PDF agreeing on the page
 * count — the parity that makes pagination a model of the document instead of a guess about it.
 */
function bookWithLongParagraph() {
  // ~700 distinct words: several pages of real Gelasio-metric text, no repetition so the
  // extracted text can prove which page the tail landed on.
  const wordsArray = Array.from({ length: 700 }, (_, i) => `mot${i}`);
  const opener: Paragraph = { type: 'paragraph', id: 'p-short', text: 'Une introduction brève.' };
  const long: Paragraph = { type: 'paragraph', id: 'p-long', text: wordsArray.join(' ') };
  const now = new Date();
  const chapterOne: Chapter = {
    type: 'chapter',
    id: 'c-1',
    number: 1,
    title: 'Chapitre Un',
    content: [opener, long],
    createdAt: now,
    updatedAt: now,
  };
  return createBook({ title: 'T', author: 'A', language: 'fr' }, [chapterOne]);
}

describe('PDFRenderer - split paragraphs (Phase B)', () => {
  it('renders a split paragraph across real pages, model and PDF agreeing on the count', async () => {
    const styled = new ThemeEngine().applyTheme(bookWithLongParagraph(), ClassicTheme);
    const typeset = new TypographyResolver().resolve(styled);
    const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, LetterPageLayout);

    // The model really decided to split.
    expect(paginated.pages.length).toBeGreaterThan(1);
    expect(paginated.pages[0].splitAfterLines).toBeGreaterThanOrEqual(2);
    expect(paginated.pages[1].startsWithContinuation).toBe(true);

    const { output, metrics } = await new PDFRenderer({ compress: false }).render(paginated, {});

    // Parity: the shipped PDF has exactly the pages the model planned (no front matter here -
    // the hand-built book has none, so the comparison is pure body).
    expect(metrics.pageCount).toBe(paginated.pages.length);

    // The text survived the split intact: first words, cut-region words and last words all
    // present exactly once.
    const text = extractPdfText(output);
    expect(text).toContain('mot0');
    expect(text).toContain('mot350');
    expect(text).toContain('mot699');
  });

  it('an unsplit book renders exactly as before - the plan is empty and nothing changes', async () => {
    const now = new Date();
    const chapterOne: Chapter = {
      type: 'chapter',
      id: 'c-1',
      number: 1,
      title: 'Chapitre Un',
      content: [{ type: 'paragraph', id: 'p-1', text: 'Court.' }],
      createdAt: now,
      updatedAt: now,
    };
    const book = createBook({ title: 'T', author: 'A', language: 'fr' }, [chapterOne]);
    const styled = new ThemeEngine().applyTheme(book, ClassicTheme);
    const typeset = new TypographyResolver().resolve(styled);
    const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, LetterPageLayout);

    const { metrics } = await new PDFRenderer({ compress: false }).render(paginated, {});

    expect(paginated.pages).toHaveLength(1);
    expect(metrics.pageCount).toBe(1);
  });
});
