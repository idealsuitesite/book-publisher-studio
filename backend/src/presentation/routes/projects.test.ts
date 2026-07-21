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

  it('404s with the PROJECT_NOT_FOUND code for a project that does not exist (ADR-0049)', async () => {
    const res = await request(createApp()).get('/api/projects/nope');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PROJECT_NOT_FOUND');
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

  it('sets, persists and clears a per-project accent override; rejects a non-hex (MINI_DR_PER_THEME_ACCENT)', async () => {
    const app = createApp();
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello.'] });
    const imported = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', buffer, { filename: 'g.docx', contentType: DOCX_MIME });
    const id = imported.body.projectId;

    // Set: a valid hex is stored and returned.
    const set = await request(app).patch(`/api/projects/${id}/settings`).send({ accentOverride: '#1D4E68' });
    expect(set.status).toBe(200);
    expect(set.body.settings.accentOverride).toBe('#1D4E68');
    expect((await request(app).get(`/api/projects/${id}`)).body.settings.accentOverride).toBe('#1D4E68');

    // Reject: a non-hex value is a 400 and does not change the stored override.
    const bad = await request(app).patch(`/api/projects/${id}/settings`).send({ accentOverride: 'blue' });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('INVALID_SETTINGS');
    expect((await request(app).get(`/api/projects/${id}`)).body.settings.accentOverride).toBe('#1D4E68');

    // Clear: null removes it.
    const cleared = await request(app).patch(`/api/projects/${id}/settings`).send({ accentOverride: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.settings.accentOverride).toBeUndefined();
    expect((await request(app).get(`/api/projects/${id}`)).body.settings.accentOverride).toBeUndefined();
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

describe('POST /api/projects/:id/structure — manual structure editing (STRUCTURE_EDITING.md phase 2)', () => {
  async function seedProject(): Promise<{ app: ReturnType<typeof createApp>; id: string }> {
    const app = createApp();
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello.'] });
    const imported = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', buffer, { filename: 'b.docx', contentType: DOCX_MIME });
    return { app, id: imported.body.projectId as string };
  }

  it('renames a chapter, persists a snapshot, and returns the updated project', async () => {
    const { app, id } = await seedProject();
    const got = await request(app).get(`/api/projects/${id}`);
    const chapterId = got.body.book.mainContent[0].id;

    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'rename', id: chapterId, title: 'Renamed' });

    expect(res.status).toBe(200);
    expect(res.body.book.mainContent[0].title).toBe('Renamed');
    expect(res.body.versions).toHaveLength(1); // snapshot-before-edit
  });

  it('400 INVALID_MUTATION on a malformed command', async () => {
    const { app, id } = await seedProject();
    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'bogus' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_MUTATION');
  });

  it('404 PROJECT_NOT_FOUND on an unknown project', async () => {
    const res = await request(createApp()).post('/api/projects/nope/structure').send({ type: 'rename', id: 'c1', title: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PROJECT_NOT_FOUND');
  });

  it('400 CONTENT_NOT_FOUND on an unknown chapter id inside a real project', async () => {
    const { app, id } = await seedProject();
    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'rename', id: 'ghost', title: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CONTENT_NOT_FOUND');
  });

  // CREATE_CHAPTER.md — the generic route carries the new create mutations end to end.
  it('promoteToChapter: turns a paragraph into a new chapter, 200 + snapshot', async () => {
    const app = createApp();
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Alpha.', 'Beta.', 'Gamma.'] });
    const imported = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', buffer, { filename: 'b.docx', contentType: DOCX_MIME });
    const id = imported.body.projectId as string;

    const got = await request(app).get(`/api/projects/${id}`);
    // The 2nd block in the chapter's own content — promoting it splits the chapter.
    const blockId = got.body.book.mainContent[0].content[1].id as string;

    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'promoteToChapter', blockId });

    expect(res.status).toBe(200);
    const chapters = res.body.book.mainContent.filter((c: { type: string }) => c.type === 'chapter');
    expect(chapters.length).toBe(2); // the original chapter + the promoted one
    expect(res.body.versions).toHaveLength(1); // snapshot-before-edit
  });

  it('400 INVALID_MUTATION on a promoteToChapter with no blockId', async () => {
    const { app, id } = await seedProject();
    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'promoteToChapter' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_MUTATION');
  });

  it('400 CONTENT_NOT_FOUND on promoteToChapter with an unknown blockId', async () => {
    const { app, id } = await seedProject();
    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'promoteToChapter', blockId: 'ghost' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CONTENT_NOT_FOUND');
  });

  // MINI_DR_EDITORIAL_PLACEMENT — the generic route must carry setPartRole through parseMutation
  // (the untrusted-body boundary). This closes the gap that shipped a 400 in live testing: the
  // dispatch was wired but the route validator did not whitelist the new variant.
  it('setPartRole: tags a top-level part front, 200 + role persisted + snapshot', async () => {
    const { app, id } = await seedProject();
    const got = await request(app).get(`/api/projects/${id}`);
    const partId = got.body.book.mainContent[0].id as string;

    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'setPartRole', id: partId, role: 'front' });
    expect(res.status).toBe(200);
    expect(res.body.book.mainContent[0].role).toBe('front');
    expect(res.body.versions).toHaveLength(1); // snapshot-before-edit
  });

  it('400 INVALID_MUTATION on a setPartRole with an unrecognised role', async () => {
    const { app, id } = await seedProject();
    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'setPartRole', id: 'c1', role: 'sideways' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_MUTATION');
  });

  // PART_LEVEL_STRUCTURE — the untrusted-body boundary tested WITH the dispatch, not after it
  // (the setPartRole lesson above: a unit-tested handler behind an unwhitelisted route is a 400).
  it('insertPartOpener: inserts a flagged divider, 200 + snapshot + numbering untouched', async () => {
    const { app, id } = await seedProject();

    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'insertPartOpener', index: 0, title: 'Part I: Beginnings' });

    expect(res.status).toBe(200);
    expect(res.body.book.mainContent[0].partOpener).toBe(true);
    expect(res.body.book.mainContent[0].title).toBe('Part I: Beginnings');
    expect(res.body.book.mainContent[0].content).toEqual([]);
    // Continuous numbering: the real chapter after the divider is still Chapter 1.
    expect(res.body.book.mainContent[1].number).toBe(1);
    expect(res.body.versions).toHaveLength(1); // snapshot-before-edit
  });

  it('removePartOpener: removes the divider, the chapters flow back, undoable via versions', async () => {
    const { app, id } = await seedProject();
    const inserted = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'insertPartOpener', index: 0, title: 'Part I' });
    const openerId = inserted.body.book.mainContent[0].id as string;

    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'removePartOpener', id: openerId });

    expect(res.status).toBe(200);
    expect(res.body.book.mainContent).toHaveLength(1);
    expect(res.body.book.mainContent[0].partOpener).toBeUndefined();
    expect(res.body.versions).toHaveLength(2); // one snapshot per edit
  });

  it('400 CONTENT_NOT_FOUND when removePartOpener targets a REAL chapter (never deletable this way)', async () => {
    const { app, id } = await seedProject();
    const got = await request(app).get(`/api/projects/${id}`);
    const chapterId = got.body.book.mainContent[0].id as string;

    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'removePartOpener', id: chapterId });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CONTENT_NOT_FOUND');
  });

  it('400 INVALID_MUTATION on malformed part-opener bodies (missing title, non-integer index, missing id)', async () => {
    const { app, id } = await seedProject();
    for (const body of [
      { type: 'insertPartOpener', index: 0 },
      { type: 'insertPartOpener', index: 0, title: '   ' },
      { type: 'insertPartOpener', index: 1.5, title: 'Part I' },
      { type: 'removePartOpener' },
    ]) {
      const res = await request(app).post(`/api/projects/${id}/structure`).send(body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_MUTATION');
    }
  });

  it('400 CONTENT_NOT_FOUND on insertPartOpener with an out-of-range index', async () => {
    const { app, id } = await seedProject();
    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'insertPartOpener', index: 99, title: 'Part I' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CONTENT_NOT_FOUND');
  });
});
