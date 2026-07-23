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

  it('sets, persists and clears a typography override; rejects unknown enums (MINI_DR_TYPOGRAPHY_TUNING)', async () => {
    const app = createApp();
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello.'] });
    const imported = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', buffer, { filename: 't.docx', contentType: DOCX_MIME });
    const id = imported.body.projectId;

    // Set: a preset + a pairing role are stored and returned.
    const set = await request(app)
      .patch(`/api/projects/${id}/settings`)
      .send({ typographyOverride: { preset: 'comfort', bodyFont: 'sans' } });
    expect(set.status).toBe(200);
    expect(set.body.settings.typographyOverride).toEqual({ preset: 'comfort', bodyFont: 'sans' });
    expect((await request(app).get(`/api/projects/${id}`)).body.settings.typographyOverride).toEqual({ preset: 'comfort', bodyFont: 'sans' });

    // Reject: unknown preset, unknown role, or an object that touches nothing — stored value untouched.
    for (const bad of [{ preset: 'huge' }, { bodyFont: 'gothic' }, {}]) {
      const res = await request(app).patch(`/api/projects/${id}/settings`).send({ typographyOverride: bad });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_SETTINGS');
    }
    expect((await request(app).get(`/api/projects/${id}`)).body.settings.typographyOverride).toEqual({ preset: 'comfort', bodyFont: 'sans' });

    // Clear: null removes it.
    const cleared = await request(app).patch(`/api/projects/${id}/settings`).send({ typographyOverride: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.settings.typographyOverride).toBeUndefined();
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

  // BATCH_CONFIRM_LATENCY correctif A — the batch mutation carried end to end by the generic route.
  async function seedTwoPromotable(): Promise<{ app: ReturnType<typeof createApp>; id: string; ids: string[] }> {
    const app = createApp();
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Alpha.', 'Beta.', 'Gamma.'] });
    const imported = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', buffer, { filename: 'b.docx', contentType: DOCX_MIME });
    const id = imported.body.projectId as string;
    const got = await request(app).get(`/api/projects/${id}`);
    const content = got.body.book.mainContent[0].content as { id: string }[];
    return { app, id, ids: [content[1].id, content[2].id] }; // Beta, Gamma
  }

  it('batchApply: promotes N blocks in ONE gesture — 200, N chapters, ONE snapshot', async () => {
    const { app, id, ids } = await seedTwoPromotable();
    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'batchApply', op: 'promoteToChapter', ids });
    expect(res.status).toBe(200);
    const chapters = res.body.book.mainContent.filter((c: { type: string }) => c.type === 'chapter');
    expect(chapters.length).toBe(3); // Chapter One + the two promoted
    expect(res.body.versions).toHaveLength(1); // ONE version for the whole batch, not N
  });

  it('400 INVALID_MUTATION on batchApply with an unrecognised op', async () => {
    const { app, id, ids } = await seedTwoPromotable();
    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'batchApply', op: 'rename', ids });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_MUTATION');
  });

  it('400 INVALID_MUTATION on batchApply with an empty id list', async () => {
    const { app, id } = await seedTwoPromotable();
    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'batchApply', op: 'promoteToChapter', ids: [] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_MUTATION');
  });

  it('400 INVALID_MUTATION on batchApply with a non-string id in the list', async () => {
    const { app, id } = await seedTwoPromotable();
    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'batchApply', op: 'promoteToChapter', ids: ['ok', 123] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_MUTATION');
  });

  it('400 CONTENT_NOT_FOUND on batchApply with an unknown id — atomic, nothing persisted', async () => {
    const { app, id, ids } = await seedTwoPromotable();
    const res = await request(app)
      .post(`/api/projects/${id}/structure`)
      .send({ type: 'batchApply', op: 'promoteToChapter', ids: [ids[0], 'ghost'] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CONTENT_NOT_FOUND');
    // the whole gesture failed → no snapshot, book unchanged (still one chapter, zero versions)
    const after = await request(app).get(`/api/projects/${id}`);
    expect(after.body.book.mainContent.filter((c: { type: string }) => c.type === 'chapter').length).toBe(1);
    expect(after.body.versions).toHaveLength(0);
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

  // MINI_DR_CALLOUTS commit 1 — whitelisted WITH route tests in the same commit (the standing
  // setPartRole lesson): the untrusted-body boundary is where the live gap shipped last time.
  it('setCallout: marks a paragraph, 200 + flag persisted + snapshot; unmark removes it', async () => {
    const { app, id } = await seedProject();
    const got = await request(app).get(`/api/projects/${id}`);
    const paragraphId = got.body.book.mainContent[0].content[0].id as string;

    const marked = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'setCallout', blockId: paragraphId, on: true });
    expect(marked.status).toBe(200);
    expect(marked.body.book.mainContent[0].content[0].callout).toBe(true);
    expect(marked.body.versions).toHaveLength(1); // snapshot-before-edit

    const unmarked = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'setCallout', blockId: paragraphId, on: false });
    expect(unmarked.status).toBe(200);
    expect(unmarked.body.book.mainContent[0].content[0].callout).toBeUndefined();
  });

  it('400 INVALID_MUTATION on a setCallout missing blockId or with a non-boolean on', async () => {
    const { app, id } = await seedProject();
    const noId = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'setCallout', on: true });
    expect(noId.status).toBe(400);
    expect(noId.body.code).toBe('INVALID_MUTATION');
    const badOn = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'setCallout', blockId: 'p1', on: 'yes' });
    expect(badOn.status).toBe(400);
    expect(badOn.body.code).toBe('INVALID_MUTATION');
  });

  it('400 CONTENT_NOT_FOUND on a setCallout no-op toggle (marking the already-unmarked off)', async () => {
    const { app, id } = await seedProject();
    const got = await request(app).get(`/api/projects/${id}`);
    const paragraphId = got.body.book.mainContent[0].content[0].id as string;
    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'setCallout', blockId: paragraphId, on: false });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CONTENT_NOT_FOUND');
  });

  // MINI_DR_SUBTITLE_FIELD commit 1 — whitelisted WITH route tests in the same commit (the
  // standing lesson, applied d'office). A3: the refusals surface a NAMED ApiErrorCode in BOTH
  // directions — a screen may only show an error it can name, defense-in-depth included.
  it('markAsSubtitle: moves the paragraph into chapter.subtitle, 200 + snapshot; clearSubtitle restores it first', async () => {
    const { app, id } = await seedProject();
    const got = await request(app).get(`/api/projects/${id}`);
    const chapterId = got.body.book.mainContent[0].id as string;
    const paragraphId = got.body.book.mainContent[0].content[0].id as string;
    const paragraphText = got.body.book.mainContent[0].content[0].text as string;

    const marked = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'markAsSubtitle', blockId: paragraphId });
    expect(marked.status).toBe(200);
    expect(marked.body.book.mainContent[0].subtitle).toBe(paragraphText);
    expect(marked.body.book.mainContent[0].content.some((b: { id: string }) => b.id === paragraphId)).toBe(false);
    expect(marked.body.versions).toHaveLength(1); // snapshot-before-edit

    const cleared = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'clearSubtitle', chapterId });
    expect(cleared.status).toBe(200);
    expect(cleared.body.book.mainContent[0].subtitle).toBeUndefined();
    expect(cleared.body.book.mainContent[0].content[0].text).toBe(paragraphText);
  });

  it('A3 both directions: mark-on-populated and clear-on-empty each surface the named code, never a 500', async () => {
    // Own two-paragraph seed: the mark-on-populated direction needs a second target paragraph.
    const app = createApp();
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['A subtitle-looking line.', 'Real prose follows.'] });
    const imported = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', buffer, { filename: 'b.docx', contentType: DOCX_MIME });
    const id = imported.body.projectId as string;
    const got = await request(app).get(`/api/projects/${id}`);
    const chapterId = got.body.book.mainContent[0].id as string;
    const paragraphId = got.body.book.mainContent[0].content[0].id as string;

    // clear on empty — refused, named
    const clearEmpty = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'clearSubtitle', chapterId });
    expect(clearEmpty.status).toBe(400);
    expect(clearEmpty.body.code).toBe('CONTENT_NOT_FOUND');

    // mark on populated — refused, named
    await request(app).post(`/api/projects/${id}/structure`).send({ type: 'markAsSubtitle', blockId: paragraphId });
    const fresh = await request(app).get(`/api/projects/${id}`);
    const remainingParagraphId = fresh.body.book.mainContent[0].content[0].id as string;
    const markPopulated = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'markAsSubtitle', blockId: remainingParagraphId });
    expect(markPopulated.status).toBe(400);
    expect(markPopulated.body.code).toBe('CONTENT_NOT_FOUND');
  });

  it('400 INVALID_MUTATION on malformed subtitle mutations (missing ids)', async () => {
    const { app, id } = await seedProject();
    const noBlock = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'markAsSubtitle' });
    expect(noBlock.status).toBe(400);
    expect(noBlock.body.code).toBe('INVALID_MUTATION');
    const noChapter = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'clearSubtitle' });
    expect(noChapter.status).toBe(400);
    expect(noChapter.body.code).toBe('INVALID_MUTATION');
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

  // MINI_DR_EDIT_FRONT_MATTER (Phase 3b) — the untrusted-body boundary tested with the dispatch.
  it('editFrontMatter: replaces the title page, 200 + the DTO carries it + snapshot', async () => {
    const { app, id } = await seedProject();

    const res = await request(app)
      .post(`/api/projects/${id}/structure`)
      .send({ type: 'editFrontMatter', titlePage: { title: 'A Better Title', author: 'The Author', tagline: 'A tagline' } });

    expect(res.status).toBe(200);
    expect(res.body.book.frontMatter.titlePage).toEqual({ title: 'A Better Title', author: 'The Author', tagline: 'A tagline' });
    expect(res.body.versions).toHaveLength(1); // snapshot-before-edit
  });

  it('editFrontMatter: null CLEARS the copyright page — gone from the DTO, undoable via versions', async () => {
    const { app, id } = await seedProject();
    // The import seeded a built copyright page (Q3: FrontMatterBuilder at import); clear it.
    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'editFrontMatter', copyrightPage: null });

    expect(res.status).toBe(200);
    expect(res.body.book.frontMatter?.copyrightPage).toBeUndefined();
    expect(res.body.versions).toHaveLength(1);
  });

  it('400 INVALID_MUTATION on malformed editFrontMatter bodies (empty title, empty text, touches nothing)', async () => {
    const { app, id } = await seedProject();
    for (const body of [
      { type: 'editFrontMatter', titlePage: { title: '  ', author: 'A' } },
      { type: 'editFrontMatter', titlePage: { title: 'T' } }, // author missing
      { type: 'editFrontMatter', copyrightPage: { text: '' } },
      { type: 'editFrontMatter' }, // touches nothing — malformed, not a no-op to snapshot
    ]) {
      const res = await request(app).post(`/api/projects/${id}/structure`).send(body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_MUTATION');
    }
  });

  // STRUCTURE_CLEANUP commit 2 — the collapseMarker mutation carried end to end through the
  // untrusted-body boundary (whitelisted WITH these route tests, the standing setPartRole lesson).
  async function seedOverStructured(): Promise<{ app: ReturnType<typeof createApp>; id: string }> {
    const app = createApp();
    // An empty `CHAPTER 1` marker heading immediately followed by a real title + its prose — the
    // founder's over-structured shape (STRUCTURE_CLEANUP_SCOPE Constat 1).
    const buffer = await buildTestDocxBuffer({
      blocks: [
        { type: 'heading', text: 'CHAPTER 1', level: 1 },
        { type: 'heading', text: 'The Holiness Of God', level: 1 },
        { type: 'paragraph', text: 'The holiness of God is the ground of everything that follows.' },
      ],
    });
    const imported = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', buffer, { filename: 'over.docx', contentType: DOCX_MIME });
    return { app, id: imported.body.projectId as string };
  }

  it('collapseMarker: removes the empty CHAPTER n marker, the real chapter survives, 200 + snapshot', async () => {
    const { app, id } = await seedOverStructured();
    const got = await request(app).get(`/api/projects/${id}`);
    const marker = got.body.book.mainContent.find((c: { title: string }) => c.title === 'CHAPTER 1');
    expect(marker).toBeDefined();

    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'collapseMarker', markerId: marker.id });

    expect(res.status).toBe(200);
    const titles = res.body.book.mainContent.map((c: { title: string }) => c.title);
    expect(titles).not.toContain('CHAPTER 1');
    expect(titles).toContain('The Holiness Of God');
    expect(res.body.versions).toHaveLength(1); // snapshot-before-edit
  });

  it('400 CONTENT_NOT_FOUND when collapseMarker targets a non-empty chapter (the strict guard, named at the boundary)', async () => {
    const { app, id } = await seedOverStructured();
    const got = await request(app).get(`/api/projects/${id}`);
    const real = got.body.book.mainContent.find((c: { title: string }) => c.title === 'The Holiness Of God');

    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'collapseMarker', markerId: real.id });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CONTENT_NOT_FOUND');
  });

  it('400 INVALID_MUTATION on a collapseMarker with no markerId', async () => {
    const { app, id } = await seedProject();
    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'collapseMarker' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_MUTATION');
  });

  // SUBCHAPTER_PROMOTION (B5) — the promoteToSubsection mutation carried end to end, whitelisted WITH
  // these route tests (the standing setPartRole lesson).
  async function seedWithConclusion(): Promise<{ app: ReturnType<typeof createApp>; id: string }> {
    const app = createApp();
    // A chapter whose own body ends with a "Conclusion" sub-heading typed as text (book-3 shape).
    const buffer = await buildTestDocxBuffer({
      blocks: [
        { type: 'heading', text: 'Chapter One', level: 1 },
        { type: 'paragraph', text: 'The chapter body.' },
        { type: 'paragraph', text: 'Conclusion' },
        { type: 'paragraph', text: 'The concluding thoughts.' },
      ],
    });
    const imported = await request(app).post('/api/manuscripts/import').attach('file', buffer, { filename: 'ch.docx', contentType: DOCX_MIME });
    return { app, id: imported.body.projectId as string };
  }

  it('promoteToSubsection: demotes an in-chapter marker to a section, 200 + snapshot', async () => {
    const { app, id } = await seedWithConclusion();
    const got = await request(app).get(`/api/projects/${id}`);
    const chapter = got.body.book.mainContent.find((c: { type: string }) => c.type === 'chapter');
    const conclusionBlock = chapter.content.find((b: { text?: string }) => b.text === 'Conclusion');

    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'promoteToSubsection', blockId: conclusionBlock.id });

    expect(res.status).toBe(200);
    const ch = res.body.book.mainContent.find((c: { type: string }) => c.type === 'chapter');
    expect(ch.sections).toHaveLength(1);
    expect(ch.sections[0].title).toBe('Conclusion');
    expect(res.body.book.mainContent.filter((c: { type: string }) => c.type === 'chapter')).toHaveLength(1); // chapter count unchanged
    expect(res.body.versions).toHaveLength(1);
  });

  it('400 CONTENT_NOT_FOUND when promoteToSubsection targets a block not in a chapter\'s own body', async () => {
    const { app, id } = await seedWithConclusion();
    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'promoteToSubsection', blockId: 'ghost' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CONTENT_NOT_FOUND');
  });

  it('400 INVALID_MUTATION on a promoteToSubsection with no blockId', async () => {
    const { app, id } = await seedProject();
    const res = await request(app).post(`/api/projects/${id}/structure`).send({ type: 'promoteToSubsection' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_MUTATION');
  });
});

describe('GET /api/projects/:id/subchapter-suggestions — SUBCHAPTER_PROMOTION read-only surface', () => {
  it('proposes each recurring editorial marker as a section of its chapter', async () => {
    const app = createApp();
    const buffer = await buildTestDocxBuffer({
      blocks: [
        { type: 'heading', text: 'Chapter One', level: 1 }, { type: 'paragraph', text: 'Body one.' }, { type: 'paragraph', text: 'Conclusion' }, { type: 'paragraph', text: 'End one.' },
        { type: 'heading', text: 'Chapter Two', level: 1 }, { type: 'paragraph', text: 'Body two.' }, { type: 'paragraph', text: 'Conclusion' }, { type: 'paragraph', text: 'End two.' },
      ],
    });
    const imported = await request(app).post('/api/manuscripts/import').attach('file', buffer, { filename: 'recurring.docx', contentType: DOCX_MIME });
    const res = await request(app).get(`/api/projects/${imported.body.projectId}/subchapter-suggestions`);
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toHaveLength(2); // one per chapter
    expect(res.body.suggestions.every((s: { proposedTitle: string }) => s.proposedTitle === 'Conclusion')).toBe(true);
  });

  it('stays SILENT (the third silence pole) when no editorial marker recurs', async () => {
    const app = createApp();
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Just prose, no recurring marker.'] });
    const imported = await request(app).post('/api/manuscripts/import').attach('file', buffer, { filename: 'plain.docx', contentType: DOCX_MIME });
    const res = await request(app).get(`/api/projects/${imported.body.projectId}/subchapter-suggestions`);
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toEqual([]);
  });

  it('404 PROJECT_NOT_FOUND on an unknown project', async () => {
    const res = await request(createApp()).get('/api/projects/nope/subchapter-suggestions');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PROJECT_NOT_FOUND');
  });
});

describe('GET /api/projects/:id/cleanup-suggestions — STRUCTURE_CLEANUP read-only surface', () => {
  it('proposes a collapse for the empty marker, naming its following real title', async () => {
    const app = createApp();
    const buffer = await buildTestDocxBuffer({
      blocks: [
        { type: 'heading', text: 'CHAPTER 1', level: 1 },
        { type: 'heading', text: 'The Holiness Of God', level: 1 },
        { type: 'paragraph', text: 'Prose.' },
      ],
    });
    const imported = await request(app).post('/api/manuscripts/import').attach('file', buffer, { filename: 'over.docx', contentType: DOCX_MIME });
    const id = imported.body.projectId as string;

    const res = await request(app).get(`/api/projects/${id}/cleanup-suggestions`);
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toHaveLength(1);
    expect(res.body.suggestions[0].markerText).toBe('CHAPTER 1');
    expect(res.body.suggestions[0].targetTitle).toBe('The Holiness Of God');
    expect(res.body.suggestions[0].kind).toBe('numbered');
  });

  it('stays SILENT (no suggestions) on a normally-structured manuscript', async () => {
    const app = createApp();
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello.'] });
    const imported = await request(app).post('/api/manuscripts/import').attach('file', buffer, { filename: 'ok.docx', contentType: DOCX_MIME });
    const res = await request(app).get(`/api/projects/${imported.body.projectId}/cleanup-suggestions`);
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toEqual([]);
  });

  it('404 PROJECT_NOT_FOUND on an unknown project', async () => {
    const res = await request(createApp()).get('/api/projects/nope/cleanup-suggestions');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PROJECT_NOT_FOUND');
  });
});
