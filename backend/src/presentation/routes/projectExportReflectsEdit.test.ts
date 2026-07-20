/**
 * Real-fixture proof for the "structure edits reach the export" fix (STRUCTURE_EDITING.md §5/§9).
 *
 * Before this fix, project export re-parsed the retained source bytes on every call and silently
 * discarded any stored structure edit: an author who reordered a chapter saw the new order in the
 * Structure station but got the ORIGINAL order in the export — two different books. This suite is
 * the property the fix must hold, on the real 17-chapter corpus manuscript (REAL_FIXTURE_POLICY):
 * reorder a chapter through the real mutation route, re-export, and confirm the OUTPUT changed.
 *
 * DOCX is the export format used to read the result: `word/document.xml` carries the chapter
 * headings in reading order, so a flip in the source order is a flip in the file — a measured
 * equality that fails for the right reason if export ever goes back to re-parsing bytes.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { createApp } from '../app';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const FAITH_ALONE = join(__dirname, '..', '..', '..', 'verification', 'corpus', 'faith-alone-styled.docx');

/** Escapes the three characters an OOXML text node escapes, so a title matches the rendered XML. */
function xmlEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function exportDocumentXml(app: ReturnType<typeof createApp>, id: string): Promise<string> {
  const res = await request(app)
    .post(`/api/projects/${id}/export?format=docx`)
    .buffer(true)
    .parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
  expect(res.status).toBe(200);
  const zip = await JSZip.loadAsync(res.body as Buffer);
  return zip.file('word/document.xml')!.async('string');
}

describe('project export reflects a manual structure edit (real corpus)', () => {
  it('reordering a chapter through the mutation route changes the exported DOCX order', async () => {
    const app = createApp();

    const imported = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', readFileSync(FAITH_ALONE), { filename: 'faith-alone-styled.docx', contentType: DOCX_MIME });
    expect(imported.status).toBe(200);
    const id = imported.body.projectId as string;

    const before = await request(app).get(`/api/projects/${id}`);
    const chapters = (before.body.book.mainContent as Array<{ type: string; title: string }>).filter(
      (c) => c.type === 'chapter'
    );
    expect(chapters.length).toBeGreaterThanOrEqual(2);

    const firstTitle = xmlEscape(chapters[0].title);
    const lastTitle = xmlEscape(chapters[chapters.length - 1].title);
    expect(firstTitle).not.toBe(lastTitle);

    // Baseline: the first chapter's heading precedes the last chapter's heading in the export.
    const baselineXml = await exportDocumentXml(app, id);
    expect(baselineXml.indexOf(firstTitle)).toBeGreaterThanOrEqual(0);
    expect(baselineXml.indexOf(lastTitle)).toBeGreaterThan(baselineXml.indexOf(firstTitle));

    // Move the last chapter to the front through the real, typed mutation route.
    const fromIndex = (before.body.book.mainContent as unknown[]).length - 1;
    const reordered = await request(app)
      .post(`/api/projects/${id}/structure`)
      .send({ type: 'reorderChapters', fromIndex, toIndex: 0 });
    expect(reordered.status).toBe(200);
    // The stored book already shows the new order (the Structure station's source of truth).
    expect(reordered.body.book.mainContent[0].title).toBe(chapters[chapters.length - 1].title);

    // The output now reflects the edit: the last chapter's heading precedes the first chapter's.
    // If export regressed to re-parsing source bytes, this order would be unchanged.
    const editedXml = await exportDocumentXml(app, id);
    expect(editedXml.indexOf(lastTitle)).toBeGreaterThanOrEqual(0);
    expect(editedXml.indexOf(lastTitle)).toBeLessThan(editedXml.indexOf(firstTitle));
  }, 60_000);
});
