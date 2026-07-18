import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../app';
import { buildTestDocxBuffer } from '../../test-utils/buildTestDocx';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('POST /api/manuscripts/publish', () => {
  const app = createApp();

  it('returns 200 with a real PublishingResponseDTO for a valid DOCX targeting kdp', async () => {
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello world.'] });

    const response = await request(app)
      .post('/api/manuscripts/publish')
      .field('theme', 'classic')
      .field('target', 'kdp')
      .attach('file', buffer, 'manuscript.docx');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body.target).toBe('kdp');
    expect(['PASS', 'FAIL']).toContain(response.body.status);
    expect(Array.isArray(response.body.issues)).toBe(true);
    expect(Array.isArray(response.body.warnings)).toBe(true);
    expect(Array.isArray(response.body.artifacts)).toBe(true);
    expect(typeof response.body.generatedAt).toBe('string');
    expect(typeof response.body.duration).toBe('number');
  });

  it('reports the real, disclosed FAIL outcome (missing ISBN) for a DOCX with no metadata - not a fabricated PASS', async () => {
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello world.'] });

    const response = await request(app)
      .post('/api/manuscripts/publish')
      .field('theme', 'classic')
      .field('target', 'kdp')
      .attach('file', buffer, 'manuscript.docx');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('FAIL');
    expect(response.body.issues.some((i: { code: string }) => i.code === 'MISSING_REQUIRED_METADATA')).toBe(true);
  });

  it('returns 400 when no file is attached', async () => {
    const response = await request(app).post('/api/manuscripts/publish').field('target', 'kdp');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('No file uploaded');
  });

  it('returns 400 when target is missing', async () => {
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Body.'] });

    const response = await request(app).post('/api/manuscripts/publish').attach('file', buffer, 'manuscript.docx');

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/publishing target/);
  });

  it('returns 400 for an unknown target - no silent default, unlike /export\'s format field', async () => {
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Body.'] });

    const response = await request(app)
      .post('/api/manuscripts/publish')
      .field('target', 'kobo')
      .attach('file', buffer, 'manuscript.docx');

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/publishing target/);
  });

  it('returns 400 for a corrupted DOCX', async () => {
    const response = await request(app)
      .post('/api/manuscripts/publish')
      .field('target', 'kdp')
      .attach('file', Buffer.from('not a docx'), 'bad.docx');

    expect(response.status).toBe(400);
  });

  // Real-fixture regression, same discipline as export.test.ts's own typography-test.docx check.
  describe('Real fixture regression (typography-test.docx, docs/REAL_FIXTURE_POLICY.md)', () => {
    const fixture = readFileSync(join(__dirname, '..', '..', '..', 'verification', 'typography-test.docx'));

    it('produces a real PublishingResponseDTO for the canonical verification fixture', async () => {
      const response = await request(app)
        .post('/api/manuscripts/publish')
        .field('theme', 'classic')
        .field('target', 'kdp')
        .attach('file', fixture, 'typography-test.docx');

      expect(response.status).toBe(200);
      expect(response.body.target).toBe('kdp');
      expect(response.body.artifacts).toEqual(['pdf']);
    });
  });
});
