import { describe, it, expect } from 'vitest';
import { ProjectService } from './ProjectService';
import { createBook } from '../models/Book';
import { latestPublicationFor, isPublishedTo, latestVersion } from '../models/Project';
import type { PublishingReport } from '../models/PublishingReport';

/** Deterministic ids so assertions never depend on timing or randomness. */
function serviceWithSequentialIds() {
  let n = 0;
  return new ProjectService(() => `id-${++n}`);
}

const book = (title = 'Le Guide de Jean') =>
  createBook({ title, author: 'Jean Dupont', language: 'fr' });

const settings = { layoutName: 'kdp-6x9', themeName: 'classic' };

const report = (target: string, status: 'PASS' | 'FAIL', at: Date): PublishingReport => ({
  status,
  target,
  issues: [],
  warnings: [],
  artifacts: ['pdf'],
  generatedAt: at,
  duration: 12,
  summary: `${status} - 0 errors, 0 warnings`,
});

describe('ProjectService — creation', () => {
  it('creates a project around an imported book', () => {
    const service = serviceWithSequentialIds();

    const project = service.create(book(), settings);

    expect(project.book.metadata.title).toBe('Le Guide de Jean');
    expect(project.settings).toEqual(settings);
    expect(project.versions).toEqual([]);
    expect(project.publications).toEqual([]);
  });

  it('names the project after the book when no name is given', () => {
    const project = serviceWithSequentialIds().create(book(), settings);

    expect(project.name).toBe('Le Guide de Jean');
  });

  it('prefers an explicit name — a working title is not the published title', () => {
    const project = serviceWithSequentialIds().create(book(), settings, "Jean's guide, 2nd pass");

    expect(project.name).toBe("Jean's guide, 2nd pass");
    expect(project.book.metadata.title).toBe('Le Guide de Jean');
  });

  it('falls back to a placeholder rather than an empty name', () => {
    const project = serviceWithSequentialIds().create(book(''), settings);

    expect(project.name).toBe('Untitled project');
  });

  it('preserves non-ASCII names exactly', () => {
    const project = serviceWithSequentialIds().create(book('红楼梦'), settings);

    expect(project.name).toBe('红楼梦');
  });
});

describe('ProjectService — identity and settings', () => {
  it('renames without retitling the book', () => {
    const service = serviceWithSequentialIds();
    const project = service.create(book(), settings);

    const renamed = service.rename(project, 'Working draft');

    expect(renamed.name).toBe('Working draft');
    expect(renamed.book.metadata.title).toBe('Le Guide de Jean');
  });

  it('rejects an empty rename rather than silently accepting it', () => {
    const service = serviceWithSequentialIds();
    const project = service.create(book(), settings);

    expect(() => service.rename(project, '   ')).toThrow(/cannot be empty/);
  });

  it('updates layout and theme as project properties, not pipeline arguments', () => {
    const service = serviceWithSequentialIds();
    const project = service.create(book(), settings);

    const updated = service.updateSettings(project, { layoutName: 'a4' });

    expect(updated.settings).toEqual({ layoutName: 'a4', themeName: 'classic' });
  });
});

describe('ProjectService — archiving (ADR-0044)', () => {
  it('archives without losing anything — the whole point of the split', () => {
    const service = serviceWithSequentialIds();
    let project = service.create(book(), settings);
    project = service.snapshot(project, 'first draft');
    project = service.recordPublication(project, report('kdp', 'PASS', new Date('2026-01-01')));
    project = service.addAsset(project, {
      kind: 'cover',
      filename: 'c.png',
      mimeType: 'image/png',
      byteSize: 1,
    });

    const archived = service.archive(project);

    expect(archived.archivedAt).toBeInstanceOf(Date);
    expect(archived.versions).toHaveLength(1);
    expect(archived.publications).toHaveLength(1);
    expect(archived.assets).toHaveLength(1);
    expect(archived.book).toBe(project.book);
  });

  it('restores an archived project', () => {
    const service = serviceWithSequentialIds();
    const project = service.create(book(), settings);

    const restored = service.restore(service.archive(project));

    expect(restored.archivedAt).toBeUndefined();
  });

  it('keeps the publication record through archive and restore — the case that motivated it', () => {
    const service = serviceWithSequentialIds();
    let project = service.create(book(), settings);
    project = service.recordPublication(project, report('kdp', 'PASS', new Date('2026-01-01')));

    const roundTripped = service.restore(service.archive(project));

    expect(isPublishedTo(roundTripped, 'kdp')).toBe(true);
    expect(latestPublicationFor(roundTripped, 'kdp')?.occurredAt).toEqual(new Date('2026-01-01'));
  });

  it('archiving twice does not rewrite when it was archived', () => {
    const service = serviceWithSequentialIds();
    const archived = service.archive(service.create(book(), settings));

    expect(service.archive(archived)).toBe(archived);
  });

  it('restoring a project that was never archived is a no-op', () => {
    const service = serviceWithSequentialIds();
    const project = service.create(book(), settings);

    expect(service.restore(project)).toBe(project);
  });

  it('never mutates the project it archives (ADR-0001)', () => {
    const service = serviceWithSequentialIds();
    const project = service.create(book(), settings);
    const snapshot = structuredClone(project);

    service.archive(project);

    expect(project).toEqual(snapshot);
    expect(project.archivedAt).toBeUndefined();
  });

  it('a new project is not archived', () => {
    expect(serviceWithSequentialIds().create(book(), settings).archivedAt).toBeUndefined();
  });
});

describe('ProjectService — versions', () => {
  it('numbers versions sequentially from 1', () => {
    const service = serviceWithSequentialIds();
    let project = service.create(book(), settings);

    project = service.snapshot(project);
    project = service.snapshot(project);

    expect(project.versions.map((v) => v.number)).toEqual([1, 2]);
  });

  it('captures the settings in force, so a version can reproduce its own output', () => {
    const service = serviceWithSequentialIds();
    let project = service.create(book(), settings);
    project = service.snapshot(project);

    project = service.updateSettings(project, { layoutName: 'a4' });

    expect(project.versions[0].settings!.layoutName).toBe('kdp-6x9');
    expect(project.settings.layoutName).toBe('a4');
  });

  it('keeps a snapshot frozen when the working manuscript later changes', () => {
    const service = serviceWithSequentialIds();
    let project = service.create(book('First title'), settings);
    project = service.snapshot(project);

    project = service.replaceBook(project, book('Revised title'));

    expect(project.versions[0].book!.metadata.title).toBe('First title');
    expect(project.book.metadata.title).toBe('Revised title');
  });

  it('carries an optional label', () => {
    const service = serviceWithSequentialIds();
    let project = service.create(book(), settings);

    project = service.snapshot(project, "before the editor's cuts");

    expect(project.versions[0].label).toBe("before the editor's cuts");
  });

  it('restores a past version (already loaded) as the working manuscript', () => {
    const service = serviceWithSequentialIds();
    let project = service.create(book('Original'), settings);
    project = service.snapshot(project);
    const first = project.versions[0]; // a full version (the Application layer loads it via getVersion)
    project = service.replaceBook(project, book('Rewritten'));

    project = service.restoreToVersion(project, first);

    expect(project.book.metadata.title).toBe('Original');
  });

  it('does not delete later versions when restoring an earlier one', () => {
    const service = serviceWithSequentialIds();
    let project = service.create(book('v1'), settings);
    project = service.snapshot(project);
    project = service.replaceBook(project, book('v2'));
    project = service.snapshot(project);

    project = service.restoreToVersion(project, project.versions[0]);

    expect(project.versions).toHaveLength(2);
  });

  it('refuses to restore a version whose payload was not loaded (an index entry)', () => {
    const service = serviceWithSequentialIds();
    const project = service.create(book(), settings);
    // The version INDEX carries no book/settings — restoring one is a programming error, not a silent no-op.
    const indexEntry = { id: 'v-idx', number: 1, createdAt: new Date() };

    expect(() => service.restoreToVersion(project, indexEntry)).toThrow(/no loaded payload/);
  });

  it('latestVersion returns undefined for a project never versioned', () => {
    const project = serviceWithSequentialIds().create(book(), settings);

    expect(latestVersion(project)).toBeUndefined();
  });
});

describe('ProjectService — publications as events', () => {
  it('records a publication attempt', () => {
    const service = serviceWithSequentialIds();
    let project = service.create(book(), settings);

    project = service.recordPublication(project, report('kdp', 'PASS', new Date('2026-01-01')));

    expect(project.publications).toHaveLength(1);
    expect(project.publications[0].target).toBe('kdp');
  });

  it('records failures too — a rejection is exactly the history an author needs', () => {
    const service = serviceWithSequentialIds();
    let project = service.create(book(), settings);

    project = service.recordPublication(project, report('kdp', 'FAIL', new Date('2026-01-01')));

    expect(project.publications[0].report.status).toBe('FAIL');
    expect(isPublishedTo(project, 'kdp')).toBe(false);
  });

  it('keeps every attempt rather than overwriting a status', () => {
    const service = serviceWithSequentialIds();
    let project = service.create(book(), settings);

    project = service.recordPublication(project, report('kdp', 'FAIL', new Date('2026-01-01')));
    project = service.recordPublication(project, report('kdp', 'PASS', new Date('2026-02-01')));

    expect(project.publications).toHaveLength(2);
    expect(isPublishedTo(project, 'kdp')).toBe(true);
  });

  it('answers "when did I last publish to KDP" from the log', () => {
    const service = serviceWithSequentialIds();
    let project = service.create(book(), settings);
    project = service.recordPublication(project, report('kdp', 'PASS', new Date('2026-01-01')));
    project = service.recordPublication(project, report('kdp', 'PASS', new Date('2026-03-01')));

    expect(latestPublicationFor(project, 'kdp')?.occurredAt).toEqual(new Date('2026-03-01'));
  });

  it('tracks platforms independently — one status field could not', () => {
    const service = serviceWithSequentialIds();
    let project = service.create(book(), settings);
    project = service.recordPublication(project, report('kdp', 'PASS', new Date('2026-01-01')));
    project = service.recordPublication(project, report('kobo', 'FAIL', new Date('2026-01-02')));

    expect(isPublishedTo(project, 'kdp')).toBe(true);
    expect(isPublishedTo(project, 'kobo')).toBe(false);
    expect(latestPublicationFor(project, 'apple')).toBeUndefined();
  });

  it('links a publication to the version that produced it', () => {
    const service = serviceWithSequentialIds();
    let project = service.create(book(), settings);
    project = service.snapshot(project);
    const versionId = project.versions[0].id;

    project = service.recordPublication(project, report('kdp', 'PASS', new Date()), versionId);

    expect(project.publications[0].versionId).toBe(versionId);
  });
});

describe('ProjectService — manuscript access and source retention', () => {
  it('exposes the current manuscript through the service, not by reaching into the project', () => {
    const service = serviceWithSequentialIds();
    const project = service.create(book(), settings);

    // The indirection that makes inserting `Manuscript` later a one-layer change rather than a
    // rewrite of every call site (AGGREGATES_AND_PERSISTENCE.md Question 3).
    expect(service.currentBook(project).metadata.title).toBe('Le Guide de Jean');
  });

  it('keeps the original upload, because import is lossy today', () => {
    const service = serviceWithSequentialIds();
    let project = service.create(book(), settings);
    const bytes = Buffer.from('fake docx bytes');

    project = service.attachSource(project, 'Le Guide de Jean.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes);

    const source = project.assets.find((asset) => asset.id === project.sourceAssetId);
    expect(source?.kind).toBe('source');
    expect(source?.filename).toBe('Le Guide de Jean.docx');
    expect(source?.byteSize).toBe(bytes.byteLength);
  });

  it('records the source by reference, so versions do not each carry a copy', () => {
    const service = serviceWithSequentialIds();
    let project = service.create(book(), settings);
    project = service.attachSource(project, 'x.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', Buffer.from('x'));

    expect(typeof project.sourceAssetId).toBe('string');
    expect(project.assets).toHaveLength(1);
  });
});

describe('ProjectService — assets', () => {
  it('adds an asset by reference, with its real size', () => {
    const service = serviceWithSequentialIds();
    let project = service.create(book(), settings);

    project = service.addAsset(project, {
      kind: 'cover',
      filename: 'couverture.png',
      mimeType: 'image/png',
      byteSize: 2_400_000,
    });

    expect(project.assets[0].kind).toBe('cover');
    expect(project.assets[0].byteSize).toBe(2_400_000);
  });

  it('removes an asset', () => {
    const service = serviceWithSequentialIds();
    let project = service.create(book(), settings);
    project = service.addAsset(project, {
      kind: 'cover',
      filename: 'c.png',
      mimeType: 'image/png',
      byteSize: 1,
    });

    project = service.removeAsset(project, project.assets[0].id);

    expect(project.assets).toEqual([]);
  });

  it('throws on removing an asset that is not there', () => {
    const service = serviceWithSequentialIds();
    const project = service.create(book(), settings);

    expect(() => service.removeAsset(project, 'nope')).toThrow(/No such asset/);
  });
});

describe('ProjectService — immutability (ADR-0001)', () => {
  it('never mutates the project it is given', () => {
    const service = serviceWithSequentialIds();
    const project = service.create(book(), settings);
    const snapshot = structuredClone(project);

    service.rename(project, 'Renamed');
    service.snapshot(project);
    service.updateSettings(project, { themeName: 'other' });
    service.addAsset(project, { kind: 'font', filename: 'f.ttf', mimeType: 'font/ttf', byteSize: 1 });
    service.recordPublication(project, report('kdp', 'PASS', new Date()));

    expect(project).toEqual(snapshot);
  });

  it('a snapshot is immune to later edits of the working manuscript', () => {
    const service = serviceWithSequentialIds();
    let project = service.create(book('Frozen'), settings);
    project = service.snapshot(project);
    const version = project.versions[0];

    const edited = service.replaceBook(project, book('Changed'));
    service.updateSettings(edited, { layoutName: 'a5' });

    expect(version.book!.metadata.title).toBe('Frozen');
    expect(version.settings!.layoutName).toBe('kdp-6x9');
  });
});
