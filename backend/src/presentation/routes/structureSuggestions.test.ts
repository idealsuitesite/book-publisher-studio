import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { buildTestDocxBuffer } from '../../test-utils/buildTestDocx';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * STRUCTURE_ASSIST commit 2 — the READ-ONLY suggestion surface at the route level
 * (STRUCTURE_ASSIST_DR.md §6). The endpoint returns candidate boundaries and NEVER mutates; the
 * invariant proven in the Domain suite is re-asserted here through the real HTTP path.
 */
describe('GET /api/projects/:id/structure-suggestions (STRUCTURE_ASSIST)', () => {
  // An UNDER-structured manuscript: no headings, the author's CHAPTER/INTRODUCTION markers sit as
  // ordinary body paragraphs (exactly the founder-1 shape the assist exists for).
  async function importUnderStructured(app: ReturnType<typeof createApp>): Promise<string> {
    const buffer = await buildTestDocxBuffer({
      paragraphs: [
        'INTRODUCTION',
        'Some introductory prose that carries no marker.',
        'CHAPTER 1',
        'The first chapter body.',
        'This ordinary line must never be flagged.',
      ],
    });
    const imported = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', buffer, { filename: 'unstructured.docx', contentType: DOCX_MIME });
    expect(imported.status).toBe(200);
    return imported.body.projectId as string;
  }

  it('returns the suggested boundaries for the typed markers, never the prose', async () => {
    const app = createApp();
    const id = await importUnderStructured(app);

    const res = await request(app).get(`/api/projects/${id}/structure-suggestions`);

    expect(res.status).toBe(200);
    const evidences = (res.body.suggestions as { evidence: string }[]).map((s) => s.evidence);
    expect(evidences).toContain('INTRODUCTION');
    expect(evidences).toContain('CHAPTER 1');
    expect(evidences).not.toContain('This ordinary line must never be flagged.');
    expect(res.body.suggestions[0]).toMatchObject({ blockId: expect.any(String), kind: expect.any(String) });
  });

  it('is READ-ONLY — asking for suggestions never mutates the book (the invariant, at the route)', async () => {
    const app = createApp();
    const id = await importUnderStructured(app);

    const before = (await request(app).get(`/api/projects/${id}`)).body.book;
    await request(app).get(`/api/projects/${id}/structure-suggestions`);
    const after = (await request(app).get(`/api/projects/${id}`)).body.book;

    expect(after).toEqual(before); // byte-identical book — the GET structured nothing
  });

  it('404s on an unknown project', async () => {
    const res = await request(createApp()).get('/api/projects/does-not-exist/structure-suggestions');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PROJECT_NOT_FOUND');
  });
});
