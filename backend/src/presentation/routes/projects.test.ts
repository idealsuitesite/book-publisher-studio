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

  it('opens a project for the Workspace: book, settings, and validation computed on read', async () => {
    const app = createApp();
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello.'] });
    const imported = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', buffer, { filename: 'Guide.docx', contentType: DOCX_MIME });

    const res = await request(app).get(`/api/projects/${imported.body.projectId}`);

    expect(res.status).toBe(200);
    expect(res.body.book.mainContent[0].type).toBe('chapter');
    expect(res.body.settings).toEqual({ layoutName: 'letter', themeName: 'classic' });
    expect(res.body.report.score.overall).toBeGreaterThan(0);
    expect(res.body.sourceFilename).toBe('Guide.docx');
    expect(res.body.versions).toEqual([]);
    expect(res.body.publications).toEqual([]);
  });

  it('404s for a project that does not exist', async () => {
    const res = await request(createApp()).get('/api/projects/nope');
    expect(res.status).toBe(404);
  });

  it('changes settings as PROJECT properties - remembered, not per-request arguments', async () => {
    const app = createApp();
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello.'] });
    const imported = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', buffer, { filename: 'g.docx', contentType: DOCX_MIME });
    const id = imported.body.projectId;

    const patched = await request(app)
      .patch(`/api/projects/${id}/settings`)
      .send({ layoutName: 'kdp-6x9' });

    expect(patched.status).toBe(200);
    expect(patched.body.settings).toEqual({ layoutName: 'kdp-6x9', themeName: 'classic' });
    // Remembered: a fresh read returns the stored settings.
    const reread = await request(app).get(`/api/projects/${id}`);
    expect(reread.body.settings.layoutName).toBe('kdp-6x9');
  });

  it('exports from the STORED source - no re-upload, the whole point of Decision 6', async () => {
    const app = createApp();
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello.'] });
    const imported = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', buffer, { filename: 'g.docx', contentType: DOCX_MIME });

    const res = await request(app)
      .post(`/api/projects/${imported.body.projectId}/export?format=pdf`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('publish writes history: a version is snapshotted and the attempt recorded on the project', async () => {
    const app = createApp();
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello.'] });
    const imported = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', buffer, { filename: 'g.docx', contentType: DOCX_MIME });
    const id = imported.body.projectId;

    const published = await request(app).post(`/api/projects/${id}/publish`);
    expect(published.status).toBe(200);
    expect(published.body.target).toBe('kdp');

    // The loop this product could never answer before: "when did I last publish this book?"
    const reread = await request(app).get(`/api/projects/${id}`);
    expect(reread.body.versions).toHaveLength(1);
    expect(reread.body.versions[0].label).toBe('publication');
    expect(reread.body.publications).toHaveLength(1);
    expect(reread.body.publications[0].target).toBe('kdp');
    expect(reread.body.publications[0].versionNumber).toBe(1);
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
