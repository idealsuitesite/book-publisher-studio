import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExportManuscriptUseCase } from '../../application/use-cases/ExportManuscriptUseCase';
import { MammothParser } from '../parsers/MammothParser';
import { HtmlNormalizer } from '../normalizers/HtmlNormalizer';
import { ASTBuilder } from '../../domain/services/ASTBuilder';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { PDFRenderer } from './PDFRenderer';
import { DOCXRenderer } from './DOCXRenderer';
import { EPUBRenderer } from './EPUBRenderer';
import { LetterPageLayout } from '../../domain/layouts/LetterPageLayout';
import { extractPdfRuns } from '../../test-utils/extractPdfText';
import type { Renderer } from '../../domain/ports/Renderer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(__dirname, '..', '..', '..', 'verification', 'large-book.docx'));

/**
 * Front matter rendering, verified against real generated files in all three formats.
 *
 * `Book.frontMatter` was fully typed in Sprint 1 and rendered by nothing but `toc`, so every
 * book this software exported opened directly on Chapter 1 — no title page, no copyright page,
 * no ISBN, no rights notice. That is the difference between a converted document and a
 * publishable book.
 *
 * The filename is deliberately accented: front matter is the first place a title is typeset at
 * display size, so an encoding regression would be most visible — and most damaging — exactly
 * here.
 */
const FILENAME = 'Le Guide de Jean — Édition Spéciale.docx';

function useCaseWith(renderer: Renderer<Buffer>) {
  return new ExportManuscriptUseCase(
    new MammothParser(),
    new HtmlNormalizer(),
    new ASTBuilder(),
    new ThemeEngine(),
    new TypographyResolver(),
    new LayoutEngine(),
    renderer
  );
}

const request = {
  buffer: FIXTURE,
  filename: FILENAME,
  themeName: 'classic',
  pageLayout: LetterPageLayout,
};

describe('Front matter — PDF', () => {
  // compress: false so extractPdfRuns can read the content stream (see extractPdfText.ts).
  it('renders a title page carrying the real title, before any chapter', async () => {
    const pdf = await useCaseWith(new PDFRenderer({ compress: false })).execute(request);

    const text = extractPdfRuns(pdf)
      .map((run) => run.text)
      .join(' ');

    expect(text).toContain('Le Guide de Jean');
    // The title must precede the body, not merely appear somewhere in the document.
    expect(text.indexOf('Le Guide de Jean')).toBeLessThan(text.indexOf('Chapter 1'));
  });

  it('preserves accented characters at display size', async () => {
    const pdf = await useCaseWith(new PDFRenderer({ compress: false })).execute(request);
    const text = extractPdfRuns(pdf)
      .map((run) => run.text)
      .join(' ');

    expect(text).toContain('Édition');
    expect(text).not.toContain('Ã');
  });

  it('renders a copyright page', async () => {
    const pdf = await useCaseWith(new PDFRenderer({ compress: false })).execute(request);
    const text = extractPdfRuns(pdf)
      .map((run) => run.text)
      .join(' ');

    expect(text).toMatch(/©/);
  });

  it('strips the source extension — a title page never reads ".docx"', async () => {
    const pdf = await useCaseWith(new PDFRenderer({ compress: false })).execute(request);
    const text = extractPdfRuns(pdf)
      .map((run) => run.text)
      .join(' ');

    expect(text).not.toContain('.docx');
  });
});

describe('Front matter — DOCX', () => {
  async function documentXml(buffer: Buffer): Promise<string> {
    const zip = await JSZip.loadAsync(buffer);
    return zip.file('word/document.xml')!.async('string');
  }

  it('renders a title page carrying the real title', async () => {
    const xml = await documentXml(await useCaseWith(new DOCXRenderer()).execute(request));

    expect(xml).toContain('Le Guide de Jean');
    expect(xml).toContain('Édition Spéciale');
  });

  it('renders a copyright page', async () => {
    const xml = await documentXml(await useCaseWith(new DOCXRenderer()).execute(request));

    expect(xml).toMatch(/©/);
  });

  it('separates title page, copyright page and body with real page breaks', async () => {
    const xml = await documentXml(await useCaseWith(new DOCXRenderer()).execute(request));

    // One after the title page, one after the copyright page.
    expect((xml.match(/<w:br w:type="page"\/>/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe('Front matter — EPUB', () => {
  async function sections(buffer: Buffer): Promise<{ name: string; content: string }[]> {
    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files)
      .filter((name) => name.endsWith('.xhtml'))
      .sort();
    return Promise.all(names.map(async (name) => ({ name, content: await zip.file(name)!.async('string') })));
  }

  it('renders the title page as the first section, ahead of chapter one', async () => {
    const files = await sections(await useCaseWith(new EPUBRenderer()).execute(request));

    const titleIndex = files.findIndex((f) => f.content.includes('Le Guide de Jean'));
    const chapterIndex = files.findIndex((f) => f.content.includes('Chapter 1'));

    expect(titleIndex).toBeGreaterThanOrEqual(0);
    expect(titleIndex).toBeLessThan(chapterIndex);
  });

  it('renders a copyright section', async () => {
    const files = await sections(await useCaseWith(new EPUBRenderer()).execute(request));

    // epub-gen-memory serialises © as the numeric entity &#xA9; — valid XHTML, and the reason
    // a naive search for the literal character reports a false negative.
    const all = files.map((f) => f.content).join('\n');
    expect(all).toMatch(/©|&#xA9;/);
  });

  it('preserves accents without mojibake', async () => {
    const files = await sections(await useCaseWith(new EPUBRenderer()).execute(request));
    const all = files.map((f) => f.content).join('\n');

    expect(all).toContain('Édition Spéciale');
    expect(all).not.toContain('Ã');
  });
});
