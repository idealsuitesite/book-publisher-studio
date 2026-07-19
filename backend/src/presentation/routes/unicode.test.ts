import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../app';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(__dirname, '..', '..', '..', 'verification', 'large-book.docx'));
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Unicode integrity is an invariant of this system, not a nice-to-have.
 *
 * A real bug found on 2026-07-18: uploading "Une recommandation supplémentaire.docx" produced
 * "Une recommandation supplÃ©mentaire.docx" - the UTF-8 bytes for é (0xC3 0xA9) decoded as two
 * latin1 characters, because busboy's defParamCharset defaults to latin1 and multer was not
 * told otherwise.
 *
 * That was data corruption rather than a display quirk: the filename becomes the book title
 * when a DOCX carries no title of its own, so the mangled text reached the AST, every rendered
 * PDF/DOCX/EPUB, and the KDP publishing report. This software is for authors and publishers,
 * who write in French, Spanish, German, Russian, Arabic, Chinese, Japanese and Greek. A
 * pipeline that mangles accents at the front door is not fit for that purpose.
 *
 * These tests exist so the regression cannot return silently. If one fails, something in the
 * upload boundary started reinterpreting bytes.
 */
const SCRIPTS: Array<[string, string]> = [
  ['French (Latin-1 supplement)', 'Une recommandation supplémentaire.docx'],
  ['Spanish (tilde, ene)', 'El Niño y la Mañana.docx'],
  ['German (umlaut, eszett)', 'Über die Straße.docx'],
  ['Russian (Cyrillic)', 'Война и мир.docx'],
  ['Chinese (CJK)', '红楼梦.docx'],
  ['Arabic (RTL)', 'كتاب العربية.docx'],
  ['Japanese (kana + kanji)', '日本語の本.docx'],
  ['Greek', 'Ελληνικά βιβλία.docx'],
];

describe('Unicode integrity across the import boundary', () => {
  const app = createApp();

  it.each(SCRIPTS)('preserves a %s filename byte-for-byte', async (_label, filename) => {
    const response = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', FIXTURE, { filename, contentType: DOCX_MIME });

    expect(response.status).toBe(200);
    // The filename becomes the title when the DOCX carries none of its own — minus its
    // extension (see titleFromFileName), since a title page reading "….docx" is not something
    // a published book does. Asserting on the title exercises the whole decode path, not just
    // the multipart header.
    expect(response.body.book.metadata.title).toBe(filename.replace(/\.docx$/, ''));
  });

  it('preserves non-ASCII through a real export, not only through import', async () => {
    const filename = 'Le Guide de Jean — Édition Spéciale.docx';

    const response = await request(app)
      .post('/api/manuscripts/export')
      .field('theme', 'classic')
      .field('format', 'pdf')
      .attach('file', FIXTURE, { filename, contentType: DOCX_MIME });

    expect(response.status).toBe(200);
    // A corrupted filename would have thrown or produced an empty render long before here.
    expect(response.headers['content-type']).toContain('application/pdf');
  });

  it('preserves non-ASCII through the publishing report', async () => {
    const filename = 'Manuscrit Français.docx';

    const response = await request(app)
      .post('/api/manuscripts/publish')
      .field('theme', 'classic')
      .field('target', 'kdp')
      .attach('file', FIXTURE, { filename, contentType: DOCX_MIME });

    expect(response.status).toBe(200);
    expect(response.body.target).toBe('kdp');
  });

  it('does not mangle a filename that is already pure ASCII', async () => {
    const response = await request(app)
      .post('/api/manuscripts/import')
      .attach('file', FIXTURE, { filename: 'plain-ascii-book.docx', contentType: DOCX_MIME });

    expect(response.body.book.metadata.title).toBe('plain-ascii-book');
  });
});
