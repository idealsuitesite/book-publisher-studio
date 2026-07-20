import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { MammothParser } from '../parsers/MammothParser';
import { HtmlNormalizer } from '../normalizers/HtmlNormalizer';
import { ASTBuilder } from '../../domain/services/ASTBuilder';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../fonts/PdfKitTextMeasurer';
import { FrontMatterBuilder } from '../../domain/services/FrontMatterBuilder';
import { getTheme } from '../../domain/themes/getTheme';
import { LetterPageLayout } from '../../domain/layouts/LetterPageLayout';
import { PDFRenderer } from './PDFRenderer';
import { DOCXRenderer } from './DOCXRenderer';
import { EPUBRenderer } from './EPUBRenderer';
import type { Book, Image } from '../../domain/models/Book';
import type { PaginatedBook } from '../../domain/models/PaginatedBook';

const FIXTURE = join(__dirname, '..', '..', '..', 'verification', 'images.docx');

/**
 * Phase 2's tri-format proof (BOOK_PRESENTATION.md §4.5, ADR-0050): a REAL DOCX with real
 * embedded images must come out the other end with real images in ALL THREE formats — never
 * the text placeholder. Before this phase, `Block.base64` was consumed by every renderer and
 * populated by nothing: 100% of embedded images silently degraded to "[Image: ...]".
 */
describe('image embedding — tri-format on the real fixture (Phase 2, ADR-0050)', () => {
  let book: Book;
  let paginated: PaginatedBook;
  let images: Image[];

  beforeAll(async () => {
    const buffer = readFileSync(FIXTURE);
    const raw = await new MammothParser().parse(buffer);
    const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: 'images.docx' });
    const built = new ASTBuilder().build(normalized);
    book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
    const styled = new ThemeEngine().applyTheme(book, getTheme('classic'));
    const typeset = new TypographyResolver().resolve(styled);
    paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, LetterPageLayout);

    images = [];
    const walk = (contents: Book['mainContent']): void => {
      for (const c of contents) {
        for (const b of c.content) if (b.type === 'image') images.push(b);
        if (c.type === 'chapter' && c.sections) walk(c.sections as unknown as Book['mainContent']);
        else if (c.type === 'section' && c.subsections) walk(c.subsections as unknown as Book['mainContent']);
      }
    };
    walk(book.mainContent);
  }, 60_000);

  it('import populates base64 AND real probed dimensions on the real fixture', () => {
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image.base64, `image ${image.id} has no embedded data`).toBeTruthy();
      expect(image.width, `image ${image.id} has no probed width`).toBeGreaterThan(0);
      expect(image.height, `image ${image.id} has no probed height`).toBeGreaterThan(0);
    }
  });

  it('PDF embeds a real image XObject, not the text placeholder', async () => {
    const result = await new PDFRenderer().render(paginated, { language: 'en' });
    const pdf = result.output.toString('latin1');
    expect(pdf).toContain('/Subtype /Image');
    expect(pdf).not.toContain('[Image:');
  });

  it('DOCX carries the image bytes in word/media, not the placeholder paragraph', async () => {
    const result = await new DOCXRenderer().render(paginated, { language: 'en' });
    const zip = await JSZip.loadAsync(result.output);
    const media = Object.keys(zip.files).filter((name) => name.startsWith('word/media/'));
    expect(media.length).toBeGreaterThan(0);
    const documentXml = await zip.file('word/document.xml')!.async('string');
    expect(documentXml).not.toContain('[Image:');
  });

  it('EPUB packages the image file, not the placeholder markup', async () => {
    const result = await new EPUBRenderer().render(paginated, { language: 'en' });
    const zip = await JSZip.loadAsync(result.output);
    const packaged = Object.keys(zip.files).filter((name) => /\.(png|jpg|jpeg|gif)$/i.test(name));
    expect(packaged.length).toBeGreaterThan(0);
    const chapterHtml = await Promise.all(
      Object.keys(zip.files)
        .filter((n) => n.endsWith('.xhtml') || n.endsWith('.html'))
        .map((n) => zip.file(n)!.async('string'))
    );
    expect(chapterHtml.join('')).not.toContain('[Image:');
  });
});
