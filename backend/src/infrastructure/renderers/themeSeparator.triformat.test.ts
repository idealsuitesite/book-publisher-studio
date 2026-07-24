import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { getTheme } from '../../domain/themes/getTheme';
import { LetterPageLayout } from '../../domain/layouts/LetterPageLayout';
import { PDFRenderer } from './PDFRenderer';
import { DOCXRenderer } from './DOCXRenderer';
import { EPUBRenderer } from './EPUBRenderer';
import { extractPdfRuns } from '../../test-utils/extractPdfText';
import { createBook } from '../../domain/models/Book';
import type { Chapter } from '../../domain/models/Book';
import type { PaginatedBook } from '../../domain/models/PaginatedBook';

// A chapter carrying a scene-break Divider (no per-block style, so the THEME decides).
function bookWithDivider(themeName: string): PaginatedBook {
  const now = new Date();
  const chapter: Chapter = {
    type: 'chapter', id: 'c1', number: 1, title: 'Chapter 1',
    content: [
      { type: 'paragraph', id: 'p1', text: 'Before the break.' },
      { type: 'divider', id: 'd1' },
      { type: 'paragraph', id: 'p2', text: 'After the break.' },
    ],
    createdAt: now, updatedAt: now,
  };
  const book = createBook({ title: 'Sep', author: 'A', language: 'en' }, [chapter]);
  const styled = new ThemeEngine().applyTheme(book, getTheme(themeName));
  const typeset = new TypographyResolver().resolve(styled);
  return new LayoutEngine().paginate(typeset, LetterPageLayout);
}

/**
 * AUTHOR_EXPERIENCE D5 (M3-C8): the scene-break separator is a THEME value, rendered consistently in all
 * three formats. Before this the renderers hardcoded AND disagreed (PDF/DOCX `* * *`, EPUB always `<hr>`)
 * and the typed `Divider.style` was dead. Classic = rule, Modern = asterisks (each theme's graphic language).
 */
describe('Theme-driven scene-break separator (D5, M3-C8) — tri-format', () => {
  it('PDF: Modern draws `* * *`; Classic does NOT (it draws a rule instead)', async () => {
    const modern = extractPdfRuns((await new PDFRenderer({ compress: false }).render(bookWithDivider('modern'), { language: 'en' })).output)
      .map((r) => r.text).join(' ');
    const classic = extractPdfRuns((await new PDFRenderer({ compress: false }).render(bookWithDivider('classic'), { language: 'en' })).output)
      .map((r) => r.text).join(' ');
    expect(modern).toContain('* * *');
    expect(classic).not.toContain('* * *'); // Classic's separator is a drawn rule, not asterisks
  });

  it('DOCX: Modern writes `* * *`; Classic writes a bottom-border rule (no asterisks)', async () => {
    const xml = async (b: PaginatedBook) => {
      const zip = await JSZip.loadAsync((await new DOCXRenderer().render(b, { language: 'en' })).output);
      return zip.file('word/document.xml')!.async('string');
    };
    const modern = await xml(bookWithDivider('modern'));
    const classic = await xml(bookWithDivider('classic'));
    expect(modern).toContain('* * *');
    expect(classic).not.toContain('* * *');
    expect(classic).toContain('w:pBdr'); // the horizontal-rule paragraph border
  });

  it('EPUB: Classic is a rule (<hr>), Modern is `* * *` and NOT <hr> — the divergence is fixed', async () => {
    const xhtml = async (b: PaginatedBook) => {
      const zip = await JSZip.loadAsync((await new EPUBRenderer().render(b, { language: 'en' })).output);
      const names = Object.keys(zip.files).filter((n) => n.endsWith('.xhtml'));
      return (await Promise.all(names.map((n) => zip.file(n)!.async('string')))).join('\n');
    };
    const classic = await xhtml(bookWithDivider('classic'));
    const modern = await xhtml(bookWithDivider('modern'));
    expect(classic).toContain('<hr');
    expect(modern).toContain('* * *');
    expect(modern).not.toContain('<hr'); // Modern no longer draws the EPUB-only <hr> — consistent with PDF/DOCX
  });
});
