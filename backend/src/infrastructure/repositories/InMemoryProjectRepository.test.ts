import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryProjectRepository } from './InMemoryProjectRepository';
import { ProjectService } from '../../domain/services/ProjectService';
import { createBook } from '../../domain/models/Book';
import type { PublishingReport } from '../../domain/models/PublishingReport';

const settings = { layoutName: 'kdp-6x9', themeName: 'classic' };
const book = (title: string) => createBook({ title, author: 'Jean Dupont', language: 'fr' });

const report = (target: string, status: 'PASS' | 'FAIL'): PublishingReport => ({
  status,
  target,
  issues: [],
  warnings: [],
  artifacts: ['pdf'],
  generatedAt: new Date('2026-01-01'),
  duration: 10,
  summary: `${status} - 0 errors, 0 warnings`,
});

let repo: InMemoryProjectRepository;
let service: ProjectService;

beforeEach(() => {
  repo = new InMemoryProjectRepository();
  let n = 0;
  service = new ProjectService(() => `id-${++n}`);
});

describe('InMemoryProjectRepository — whole-aggregate round trip', () => {
  it('returns undefined for a project that does not exist', async () => {
    expect(await repo.findById('nope')).toBeUndefined();
  });

  it('saves and reloads a project', async () => {
    const project = service.create(book('Le Guide de Jean'), settings);

    await repo.save(project);

    expect((await repo.findById(project.id))?.name).toBe('Le Guide de Jean');
  });

  it('returns the WHOLE aggregate — versions, assets and publications all present', async () => {
    let project = service.create(book('Le Guide'), settings);
    project = service.snapshot(project, 'first draft');
    project = service.addAsset(project, {
      kind: 'cover',
      filename: 'couverture.png',
      mimeType: 'image/png',
      byteSize: 2_400_000,
    });
    project = service.recordPublication(project, report('kdp', 'PASS'));

    await repo.save(project);
    const loaded = await repo.findById(project.id);

    expect(loaded?.versions).toHaveLength(1);
    expect(loaded?.assets).toHaveLength(1);
    expect(loaded?.publications).toHaveLength(1);
  });

  it('preserves Date types through the round trip, not ISO strings', async () => {
    let project = service.create(book('Le Guide'), settings);
    project = service.snapshot(project);

    await repo.save(project);
    const loaded = await repo.findById(project.id);

    expect(loaded?.createdAt).toBeInstanceOf(Date);
    expect(loaded?.versions[0].createdAt).toBeInstanceOf(Date);
  });

  it('preserves non-ASCII exactly', async () => {
    const project = service.create(book('红楼梦'), settings, 'Édition Spéciale');

    await repo.save(project);
    const loaded = await repo.findById(project.id);

    expect(loaded?.name).toBe('Édition Spéciale');
    expect(loaded?.book.metadata.title).toBe('红楼梦');
  });

  it('replaces an existing project rather than duplicating it', async () => {
    const project = service.create(book('Original'), settings);
    await repo.save(project);

    await repo.save(service.rename(project, 'Renamed'));

    expect((await repo.findById(project.id))?.name).toBe('Renamed');
    expect(await repo.list()).toHaveLength(1);
  });

  it('deletes a project', async () => {
    const project = service.create(book('Le Guide'), settings);
    await repo.save(project);

    await repo.delete(project.id);

    expect(await repo.findById(project.id)).toBeUndefined();
  });
});

describe('InMemoryProjectRepository — asset bytes survive the round trip as real Buffers', () => {
  it('a source asset comes back as a Buffer, byte for byte', async () => {
    // structuredClone alone downgrades Buffer to Uint8Array - the bytes survive, the prototype
    // does not, and the first caller doing .equals() crashes on a value the types call Buffer.
    // Found by ADR-0047's import wiring, locked here at the class that owns the clone.
    const bytes = Buffer.from('real docx bytes, not a stand-in');
    let project = service.create(book('Le Guide'), settings);
    project = service.attachSource(project, 'g.docx', 'application/octet-stream', bytes);
    await repo.save(project);

    const loaded = await repo.findById(project.id);
    const source = loaded?.assets.find((a) => a.id === loaded.sourceAssetId);

    expect(Buffer.isBuffer(source?.data)).toBe(true);
    expect(source?.data?.equals(bytes)).toBe(true);
  });
});

describe('InMemoryProjectRepository — stored state is isolated from callers', () => {
  it('a caller mutating what it saved does not corrupt the store', async () => {
    const project = service.create(book('Le Guide'), settings);
    await repo.save(project);

    // Deliberately reaching through the reference, which a careless caller can do.
    (project as { name: string }).name = 'Mutated after save';

    expect((await repo.findById(project.id))?.name).toBe('Le Guide');
  });

  it('a caller mutating what it loaded does not corrupt the store', async () => {
    const project = service.create(book('Le Guide'), settings);
    await repo.save(project);

    const loaded = await repo.findById(project.id);
    (loaded as { name: string }).name = 'Mutated after load';

    expect((await repo.findById(project.id))?.name).toBe('Le Guide');
  });
});

describe('InMemoryProjectRepository — library listing', () => {
  it('returns summaries, not aggregates — no manuscript AST in a library listing', async () => {
    let project = service.create(book('Le Guide'), settings);
    project = service.snapshot(project);
    await repo.save(project);

    const [summary] = await repo.list();

    expect(summary.bookTitle).toBe('Le Guide');
    expect(summary.versionCount).toBe(1);
    expect(summary).not.toHaveProperty('book');
    expect(summary).not.toHaveProperty('versions');
  });

  it('carries the project name and the book title separately', async () => {
    const project = service.create(book('Le Guide de Jean'), settings, 'Working draft');
    await repo.save(project);

    const [summary] = await repo.list();

    expect(summary.name).toBe('Working draft');
    expect(summary.bookTitle).toBe('Le Guide de Jean');
  });

  it('derives published targets from the event log, counting only successes', async () => {
    let project = service.create(book('Le Guide'), settings);
    project = service.recordPublication(project, report('kdp', 'PASS'));
    project = service.recordPublication(project, report('kobo', 'FAIL'));
    await repo.save(project);

    const [summary] = await repo.list();

    expect(summary.publishedTargets).toEqual(['kdp']);
  });

  it('does not repeat a target published to more than once', async () => {
    let project = service.create(book('Le Guide'), settings);
    project = service.recordPublication(project, report('kdp', 'PASS'));
    project = service.recordPublication(project, report('kdp', 'PASS'));
    await repo.save(project);

    expect((await repo.list())[0].publishedTargets).toEqual(['kdp']);
  });

  it('surfaces the cover asset so a library can render a thumbnail', async () => {
    let project = service.create(book('Le Guide'), settings);
    project = service.addAsset(project, {
      kind: 'cover',
      filename: 'c.png',
      mimeType: 'image/png',
      byteSize: 1,
    });
    await repo.save(project);

    expect((await repo.list())[0].coverAssetId).toBe(project.assets[0].id);
  });

  it('lists newest first — a library is browsed by recency', async () => {
    const older = service.create(book('Older'), settings);
    await repo.save({ ...older, updatedAt: new Date('2026-01-01') });
    const newer = service.create(book('Newer'), settings);
    await repo.save({ ...newer, updatedAt: new Date('2026-06-01') });

    expect((await repo.list()).map((s) => s.bookTitle)).toEqual(['Newer', 'Older']);
  });

  it('returns an empty list rather than throwing when there are no projects', async () => {
    expect(await repo.list()).toEqual([]);
  });
});

describe('InMemoryProjectRepository — archived projects are excluded by default (ADR-0044)', () => {
  // The standing regression test for Risk 1. Sprint 11 (Workspace) and Sprint 14
  // (Collaboration) each add project queries; this is what catches the one that forgets.
  it('does not return an archived project from a default list()', async () => {
    const project = service.create(book('Finished'), settings);
    await repo.save(service.archive(project));

    expect(await repo.list()).toEqual([]);
  });

  it('returns it when explicitly asked for', async () => {
    const project = service.create(book('Finished'), settings);
    await repo.save(service.archive(project));

    const listed = await repo.list({ includeArchived: true });

    expect(listed).toHaveLength(1);
    expect(listed[0].archivedAt).toBeInstanceOf(Date);
  });

  it('lists active projects alongside archived ones only when asked', async () => {
    await repo.save(service.create(book('Active'), settings));
    await repo.save(service.archive(service.create(book('Archived'), settings)));

    expect((await repo.list()).map((s) => s.bookTitle)).toEqual(['Active']);
    expect((await repo.list({ includeArchived: true })).map((s) => s.bookTitle).sort()).toEqual([
      'Active',
      'Archived',
    ]);
  });

  it('archiving loses nothing the repository was holding', async () => {
    let project = service.create(book('Finished'), settings);
    project = service.snapshot(project);
    project = service.recordPublication(project, report('kdp', 'PASS'));
    await repo.save(service.archive(project));

    const loaded = await repo.findById(project.id);

    expect(loaded?.versions).toHaveLength(1);
    expect(loaded?.publications).toHaveLength(1);
    expect(loaded?.archivedAt).toBeInstanceOf(Date);
  });

  it('a restored project comes back to the default listing', async () => {
    const project = service.create(book('Back'), settings);
    await repo.save(service.archive(project));

    const archived = await repo.findById(project.id);
    await repo.save(service.restore(archived!));

    expect((await repo.list()).map((s) => s.bookTitle)).toEqual(['Back']);
  });
});
