import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { buildTestDocxBuffer } from '../../test-utils/buildTestDocx';

describe('POST /api/manuscripts/import', () => {
  const app = createApp();

  it('returns 200 with book and report for a valid DOCX', async () => {
    const buffer = await buildTestDocxBuffer({
      heading: 'Chapter One',
      paragraphs: ['Hello world.'],
    });

    const response = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', buffer, 'manuscript.docx');

    expect(response.status).toBe(200);
    expect(response.body.report.status).toBe('success');
    expect(response.body.book.mainContent[0].type).toBe('chapter');
  });

  it('returns 400 when no file is attached', async () => {
    const response = await request(app).post('/api/manuscripts/import');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('No file uploaded');
  });

  it('returns 400 for a non-DOCX file', async () => {
    const response = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', Buffer.from('plain text'), 'notes.txt');

    expect(response.status).toBe(400);
  });

  it('returns 422 with an error report for an empty DOCX', async () => {
    const buffer = await buildTestDocxBuffer({});

    const response = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', buffer, 'empty.docx');

    expect(response.status).toBe(422);
    expect(response.body.report.status).toBe('error');
  });

  it('returns 422 IMPORT_PARSE_FAILED for a corrupted DOCX (ADR-0049: the file is the problem, not the transport)', async () => {
    const response = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', Buffer.from('not a docx'), 'bad.docx');

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('IMPORT_PARSE_FAILED');
  });
});
