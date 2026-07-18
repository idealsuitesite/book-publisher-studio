import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { buildTestDocxBuffer } from '../../test-utils/buildTestDocx';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('GET /api/projects', () => {
  it('returns an empty library before anything is imported', async () => {
    const app = createApp();

    const res = await request(app).get('/api/projects');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ projects: [] });
  });

  it('a successful import appears in the library - the full loop, not two isolated endpoints', async () => {
    const app = createApp();
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello.'] });

    const imported = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', buffer, { filename: 'Le Guide de Jean.docx', contentType: DOCX_MIME });
    expect(imported.status).toBe(200);
    expect(imported.body.projectId).toBeDefined();

    const res = await request(app).get('/api/projects');

    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].id).toBe(imported.body.projectId);
    expect(res.body.projects[0].versionCount).toBe(0);
    expect(res.body.projects[0].publishedTargets).toEqual([]);
    // ISO string at the boundary, never a Date object - the mapper's whole job.
    expect(typeof res.body.projects[0].updatedAt).toBe('string');
  });

  it('a rejected import leaves the library empty', async () => {
    const app = createApp();
    const buffer = await buildTestDocxBuffer({}); // empty book -> 422

    const imported = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', buffer, { filename: 'empty.docx', contentType: DOCX_MIME });
    expect(imported.status).toBe(422);

    const res = await request(app).get('/api/projects');

    expect(res.body.projects).toEqual([]);
  });

  it('preserves non-ASCII project names through the whole HTTP loop (Unicode invariant)', async () => {
    const app = createApp();
    const buffer = await buildTestDocxBuffer({ heading: 'Chapitre Un', paragraphs: ['Départ.'] });

    await request(app)
      .post('/api/manuscripts/import')
      .attach('file', buffer, { filename: 'Une recommandation supplémentaire.docx', contentType: DOCX_MIME });

    const res = await request(app).get('/api/projects');

    // The project is named after the book title, which titleFromFileName derived from the
    // filename - the exact path the busboy latin1 bug corrupted before the Unicode fix.
    expect(res.body.projects[0].name).toContain('supplémentaire');
  });
});
