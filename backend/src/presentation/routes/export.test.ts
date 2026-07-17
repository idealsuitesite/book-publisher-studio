import { describe, it, expect } from 'vitest';
import request from 'supertest';
import type { Response } from 'superagent';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../app';
import { buildTestDocxBuffer } from '../../test-utils/buildTestDocx';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function extractDocumentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const doc = zip.file('word/document.xml');
  if (!doc) throw new Error('word/document.xml missing from generated docx');
  return doc.async('string');
}

// supertest/superagent doesn't recognize the docx mimetype and won't auto-buffer
// it into response.body by default - collect raw bytes explicitly instead.
function binaryParser(res: Response, callback: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('POST /api/manuscripts/export', () => {
  const app = createApp();

  it('returns 200 with a valid .docx for a valid DOCX input', async () => {
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello world.'] });

    const response = await request(app)
      .post('/api/manuscripts/export')
      .field('theme', 'classic')
      .attach('file', buffer, 'manuscript.docx')
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    const xml = await extractDocumentXml(response.body as Buffer);
    expect(xml).toContain('Hello world.');
  });

  it('defaults to the classic theme when none is specified', async () => {
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Body.'] });

    const response = await request(app).post('/api/manuscripts/export').attach('file', buffer, 'manuscript.docx');

    expect(response.status).toBe(200);
  });

  it('returns 400 when no file is attached', async () => {
    const response = await request(app).post('/api/manuscripts/export').field('theme', 'classic');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('No file uploaded');
  });

  it('returns 400 for an unknown theme', async () => {
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Body.'] });

    const response = await request(app)
      .post('/api/manuscripts/export')
      .field('theme', 'nonexistent')
      .attach('file', buffer, 'manuscript.docx');

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Unknown theme/);
  });

  it('returns 400 for a corrupted DOCX', async () => {
    const response = await request(app)
      .post('/api/manuscripts/export')
      .field('theme', 'classic')
      .attach('file', Buffer.from('not a docx'), 'bad.docx');

    expect(response.status).toBe(400);
  });

  it('returns 200 with a valid PDF when format=pdf', async () => {
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello world.'] });

    const response = await request(app)
      .post('/api/manuscripts/export')
      .field('theme', 'classic')
      .field('format', 'pdf')
      .attach('file', buffer, 'manuscript.docx')
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    const pdf = response.body as Buffer;
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('returns 200 with a valid EPUB when format=epub', async () => {
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello world.'] });

    const response = await request(app)
      .post('/api/manuscripts/export')
      .field('theme', 'classic')
      .field('format', 'epub')
      .attach('file', buffer, 'manuscript.docx')
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/epub+zip');
    const epubBuffer = response.body as Buffer;
    const zip = await JSZip.loadAsync(epubBuffer);
    const entryOrder = Object.keys(zip.files);
    expect(entryOrder[0]).toBe('mimetype');
    expect(await zip.file('mimetype')!.async('string')).toBe('application/epub+zip');
  });

  // Sprint 4 commit 10 (docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md §8) - E2E regression
  // using the canonical, permanent verification fixture (docs/CLAUDE.md's Real Export Policy),
  // not a synthetic buildTestDocxBuffer() fixture like every test above. Closes a real gap:
  // until this commit, nothing in the automated suite ever exercised bold/italic/underline/
  // strikethrough survival through the real import -> TypographyResolver -> render pipeline
  // for all 3 formats at once - each renderer's own unit tests cover this with hand-built
  // Block fixtures, but never via a real DOCX round trip end to end.
  describe('Real fixture regression (typography-test.docx, docs/REAL_EXPORT_CHECKLIST.md)', () => {
    const fixture = readFileSync(join(__dirname, '..', '..', '..', 'verification', 'typography-test.docx'));

    async function extractChapterHtml(buffer: Buffer): Promise<string> {
      const zip = await JSZip.loadAsync(buffer);
      const xhtmlFiles = Object.keys(zip.files).filter((f) => f.endsWith('.xhtml') && !f.includes('toc'));
      const texts = await Promise.all(xhtmlFiles.map((f) => zip.file(f)!.async('string')));
      return texts.join('\n');
    }

    // A run's actual XML block, so "does <w:b/> appear near the word bold" is precise
    // instead of just checking both substrings exist anywhere in the whole document.
    function docxRunContaining(xml: string, word: string): string | undefined {
      const runs = xml.match(/<w:r>[\s\S]*?<\/w:r>/g) ?? [];
      return runs.find((run) => run.includes(`>${word}`));
    }

    // "underlined" is deliberately not asserted as formatted here: mammoth drops <u> by
    // default before HtmlNormalizer ever sees it (ADR-0025, regression-tested in
    // MammothParser.test.ts) - a separate, already-documented, deliberately-deferred
    // import-pipeline limitation, not something this commit's fixes touch.
    it('renders bold/italic/strikethrough as real DOCX run formatting, not flattened text', async () => {
      const response = await request(app)
        .post('/api/manuscripts/export')
        .field('theme', 'classic')
        .attach('file', fixture, 'typography-test.docx')
        .buffer(true)
        .parse(binaryParser);

      expect(response.status).toBe(200);
      const xml = await extractDocumentXml(response.body as Buffer);

      expect(docxRunContaining(xml, 'bold')).toContain('<w:b/>');
      expect(docxRunContaining(xml, 'italic')).toContain('<w:i/>');
      expect(docxRunContaining(xml, 'strikethrough')).toContain('<w:strike/>');
      // The plain prose connecting the formatted runs must survive too (ASTBuilder no
      // longer filters plain-text inline elements out of Paragraph.inlines - see commit
      // message) - a flattened/broken paragraph would be missing this entirely.
      expect(xml).toContain('runs, plus a');
    });

    it('renders bold/italic/strikethrough as real HTML tags in EPUB, not flattened text', async () => {
      const response = await request(app)
        .post('/api/manuscripts/export')
        .field('theme', 'classic')
        .field('format', 'epub')
        .attach('file', fixture, 'typography-test.docx')
        .buffer(true)
        .parse(binaryParser);

      expect(response.status).toBe(200);
      const html = await extractChapterHtml(response.body as Buffer);

      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<em>italic</em>');
      expect(html).toContain('<s>strikethrough</s>');
      expect(html).toContain('runs, plus a');
    });

    it('exports all 3 formats from the same real fixture without error (no completely empty output)', async () => {
      for (const format of ['docx', 'pdf', 'epub'] as const) {
        const response = await request(app)
          .post('/api/manuscripts/export')
          .field('theme', 'classic')
          .field('format', format)
          .attach('file', fixture, 'typography-test.docx')
          .buffer(true)
          .parse(binaryParser);

        expect(response.status).toBe(200);
        expect((response.body as Buffer).length).toBeGreaterThan(0);
      }
    });

    // No PDF bold/italic font-weight assertion here (unlike the DOCX/EPUB cases above):
    // the real HTTP route renders with PDFKit's default compress: true (correct for real
    // output - smaller files), and extractPdfRuns() can only decode an uncompressed content
    // stream (see extractPdfText.ts's own doc comment). That check lives in
    // ExportManuscriptUseCase.test.ts instead, composing the same real fixture through the
    // same real pipeline with compress: false - it's not weaker verification, just a
    // different entry point forced by what's actually inspectable.
  });
});
