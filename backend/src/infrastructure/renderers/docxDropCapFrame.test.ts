import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { DOCXRenderer } from './DOCXRenderer';
import { PdfKitTextMeasurer } from '../fonts/PdfKitTextMeasurer';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { ClassicTheme } from '../../domain/themes/ClassicTheme';
import { createBook } from '../../domain/models/Book';
import { DROP_CAP_SCALE, dropCapLetterSizePt } from '../../domain/services/dropCapMetrics';
import type { Book, Chapter, Paragraph as DomainParagraph } from '../../domain/models/Book';
import type { PaginatedBook } from '../../domain/models/PaginatedBook';
import type { ResolvedTypography } from '../../domain/models/ResolvedTypography';

/**
 * Commit 1 of MINI_DR_DROP_CAPS §6: the Word-NATIVE drop cap. These tests assert the EMITTED
 * XML against the ground truth Word itself writes (the spike's native reference) — which also
 * guards the one deliberate seam: `withNativeDropCapFrame` reaches ParagraphProperties.push
 * through a TS-private cast, and a docx upgrade that moves it fails HERE, loudly, never silently.
 */
const now = new Date();

function bookWithDropCapParagraph(): { book: Book; blockTypography: Record<string, ResolvedTypography> } {
  const para: DomainParagraph = { type: 'paragraph', id: 'p1', text: 'Every word here is real content for the drop cap.' };
  const chapter: Chapter = { type: 'chapter', id: 'c1', number: 1, title: 'One', content: [para], createdAt: now, updatedAt: now };
  const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter]);
  const blockTypography: Record<string, ResolvedTypography> = {
    p1: { runs: [{ text: para.text, bold: false, italic: false, superscript: false, subscript: false, smallCaps: false }], dropCap: true },
  };
  return { book, blockTypography };
}

function paginatedFor(book: Book, blockTypography: Record<string, ResolvedTypography>): PaginatedBook {
  const styled = new ThemeEngine().applyTheme(book, ClassicTheme);
  return {
    styledBook: { ...styled, blockTypography },
    pages: [{ number: 1, blocks: ['p1'] }],
    pageLayout: { pageSize: 'letter', width: 612, height: 792, marginTop: 72, marginBottom: 72, marginLeft: 72, marginRight: 72 },
  };
}

async function documentXml(output: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(output);
  return zip.file('word/document.xml')!.async('string');
}

describe('DOCX native drop cap (MINI_DR_DROP_CAPS §6 commit 1)', () => {
  it('emits the attribute-free framePr Word itself writes — never the type-forced zeros', async () => {
    const { book, blockTypography } = bookWithDropCapParagraph();
    const renderer = new DOCXRenderer({ measurer: new PdfKitTextMeasurer() });
    const xml = await documentXml((await renderer.render(paginatedFor(book, blockTypography), { language: 'en' })).output);

    const framePr = xml.match(/<w:framePr[^>]*\/>/g) ?? [];
    expect(framePr).toHaveLength(1);
    // The native shape (the spike's ground truth), attribute-for-attribute:
    expect(framePr[0]).toContain('w:dropCap="drop"');
    expect(framePr[0]).toContain('w:wrap="around"');
    expect(framePr[0]).toContain('w:vAnchor="text"');
    expect(framePr[0]).toContain('w:hAnchor="text"');
    expect(framePr[0]).toMatch(/w:lines="\d+"/);
    // The poisoned attrs native Word omits must be ABSENT (spike Finding A):
    expect(framePr[0]).not.toMatch(/w:(w|h|x|y)=/);
  });

  it('sizes the letter by the SHARED arithmetic — its ink filling the same band the PDF prices', async () => {
    const { book, blockTypography } = bookWithDropCapParagraph();
    const measurer = new PdfKitTextMeasurer();
    const renderer = new DOCXRenderer({ measurer });
    const xml = await documentXml((await renderer.render(paginatedFor(book, blockTypography), { language: 'en' })).output);

    // Recompute the expected size from the same measured inputs the renderer used.
    const bodyPt = ClassicTheme.fontSizes.body;
    const bodyLinePt = measurer.lineHeight(bodyPt, { theme: ClassicTheme });
    const capHeightEm = measurer.capHeight(100, { theme: ClassicTheme }) / 100;
    const bandLines = Math.max(1, Math.ceil((capHeightEm * DROP_CAP_SCALE * bodyPt) / bodyLinePt));
    const expectedHalfPoints = Math.round(dropCapLetterSizePt({ lines: bandLines, bodyLinePt, capHeightEm }) * 2);

    expect(xml).toContain(`w:lines="${bandLines}"`);
    // The letter paragraph's run carries the computed size.
    expect(xml).toContain(`<w:sz w:val="${expectedHalfPoints}"/>`);
    // Sanity on the arithmetic itself: the letter must dwarf the body size, in band proportion.
    expect(expectedHalfPoints).toBeGreaterThan(bodyPt * 2 * DROP_CAP_SCALE * 0.9);
  });

  it('splits letter + body into TWO paragraphs — the structure Word DropCap.Enable() produces', async () => {
    const { book, blockTypography } = bookWithDropCapParagraph();
    const renderer = new DOCXRenderer({ measurer: new PdfKitTextMeasurer() });
    const xml = await documentXml((await renderer.render(paginatedFor(book, blockTypography), { language: 'en' })).output);

    // The letter 'E' alone in the framed paragraph; the body text starts 'very word here...'.
    const frameParaMatch = xml.match(/<w:p\b[^>]*>(?:(?!<\/w:p>).)*w:framePr(?:(?!<\/w:p>).)*<\/w:p>/s);
    expect(frameParaMatch).not.toBeNull();
    expect(frameParaMatch![0]).toContain('>E<');
    expect(frameParaMatch![0]).not.toContain('very word here');
    expect(xml).toContain('very word here is real content for the drop cap.');
  });

  it('without a measurer, drop caps fall back to the inline approximation (no framePr) — the documented degradation', async () => {
    const { book, blockTypography } = bookWithDropCapParagraph();
    const renderer = new DOCXRenderer(); // no measurer
    const xml = await documentXml((await renderer.render(paginatedFor(book, blockTypography), { language: 'en' })).output);

    expect(xml).not.toContain('w:framePr');
    // The inline strategy's enlarged letter is still there (degraded, lossless).
    expect(xml).toContain(`w:val="${Math.round(ClassicTheme.fontSizes.body * 2 * DROP_CAP_SCALE)}"`);
  });

  it('a book with NO drop caps emits no frame at all — the capability cannot leak (parity guard)', async () => {
    const { book, blockTypography } = bookWithDropCapParagraph();
    blockTypography.p1 = { ...blockTypography.p1, dropCap: false };
    const renderer = new DOCXRenderer({ measurer: new PdfKitTextMeasurer() });
    const xml = await documentXml((await renderer.render(paginatedFor(book, blockTypography), { language: 'en' })).output);

    expect(xml).not.toContain('w:framePr');
    expect(xml).not.toContain('w:dropCap');
  });
});
