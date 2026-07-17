import { describe, it, expect } from 'vitest';
import request from 'supertest';
import type { Response } from 'superagent';
import JSZip from 'jszip';
import { createApp } from '../app';
import { buildTestDocxBuffer } from '../../test-utils/buildTestDocx';

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
});
