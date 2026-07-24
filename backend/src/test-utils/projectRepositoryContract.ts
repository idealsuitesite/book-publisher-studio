import { describe, it, expect, beforeEach } from 'vitest';
import type { ProjectRepository } from '../domain/ports/ProjectRepository';
import { ProjectService } from '../domain/services/ProjectService';
import { createBook } from '../domain/models/Book';
import type { PublishingReport } from '../domain/models/PublishingReport';

/**
 * The `ProjectRepository` behavioural contract, run against EVERY implementation
 * (PERSISTENCE.md §6). Sprint 8 proved a port against a fake before the real implementation
 * existed; this graduates that discipline: one behaviour, N implementations, forever. A future
 * cloud store (S15) starts by passing this suite.
 *
 * Includes the exact `.equals()` Buffer round trip that caught the `structuredClone`
 * downgrade (ADR-0047) — the scar, institutionalized.
 */
export function describeProjectRepositoryContract(
  label: string,
  makeRepository: () => ProjectRepository & { clear(): void }
): void {
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

  describe(`${label} — whole-aggregate round trip`, () => {
    let repo: ReturnType<typeof makeRepository>;
    let service: ProjectService;

    beforeEach(() => {
      repo = makeRepository();
      let n = 0;
      service = new ProjectService(() => `id-${++n}`);
    });

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
      expect(loaded?.versions[0].label).toBe('first draft');
      expect(loaded?.versions[0].book.metadata.title).toBe('Le Guide');
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
      expect(loaded?.publications).toEqual([]);
    });

    it('preserves non-ASCII exactly', async () => {
      const project = service.create(book('红楼梦'), settings, 'Édition Spéciale');
      await repo.save(project);
      const loaded = await repo.findById(project.id);
      expect(loaded?.name).toBe('Édition Spéciale');
      expect(loaded?.book.metadata.title).toBe('红楼梦');
    });

    it('a source asset comes back as a real Buffer, byte for byte (the ADR-0047 scar)', async () => {
      const bytes = Buffer.from('real docx bytes, not a stand-in');
      let project = service.create(book('Le Guide'), settings);
      project = service.attachSource(project, 'g.docx', 'application/octet-stream', bytes);
      await repo.save(project);

      const loaded = await repo.findById(project.id);
      const source = loaded?.assets.find((a) => a.id === loaded.sourceAssetId);

      expect(Buffer.isBuffer(source?.data)).toBe(true);
      expect(source?.data?.equals(bytes)).toBe(true);
    });

    it('replaces an existing project rather than duplicating it', async () => {
      const project = service.create(book('Original'), settings);
      await repo.save(project);
      await repo.save(service.rename(project, 'Renamed'));

      expect((await repo.findById(project.id))?.name).toBe('Renamed');
      expect(await repo.list()).toHaveLength(1);
    });

    it('deletes a project entirely', async () => {
      const project = service.create(book('Le Guide'), settings);
      await repo.save(project);
      await repo.delete(project.id);
      expect(await repo.findById(project.id)).toBeUndefined();
      expect(await repo.list()).toEqual([]);
    });
  });

  // APPEND_ONLY_PERSISTENCE (option B) — the on-demand read companion and the explicit append seam.
  describe(`${label} — getVersion + appendVersion (APPEND_ONLY_PERSISTENCE)`, () => {
    let repo: ReturnType<typeof makeRepository>;
    let service: ProjectService;

    beforeEach(() => {
      repo = makeRepository();
      let n = 0;
      service = new ProjectService(() => `id-${++n}`);
    });

    it('getVersion returns ONE version\'s full payload (book + settings), undefined for an unknown id', async () => {
      let project = service.create(book('Le Guide'), settings);
      project = service.snapshot(project, 'first draft');
      await repo.save(project);
      const [v1] = (await repo.findById(project.id))!.versions;

      const fetched = await repo.getVersion(project.id, v1.id);
      expect(fetched?.label).toBe('first draft');
      expect(fetched?.book.metadata.title).toBe('Le Guide');
      expect(fetched?.settings.layoutName).toBe('kdp-6x9');
      expect(await repo.getVersion(project.id, 'no-such-version')).toBeUndefined();
    });

    it('appendVersion adds ONE new version and updates the head, without rewriting existing versions', async () => {
      let project = service.create(book('Le Guide'), settings);
      project = service.snapshot(project, 'v1');
      await repo.save(project);

      project = service.snapshot(service.rename(project, 'Renamed'), 'v2');
      const v2 = project.versions[project.versions.length - 1];
      await repo.appendVersion(project, v2);

      const loaded = (await repo.findById(project.id))!;
      expect(loaded.name).toBe('Renamed'); // head updated
      expect(loaded.versions.map((v) => v.label)).toEqual(['v1', 'v2']); // append, not rewrite
    });

    it('appendVersion is IDEMPOTENT on the version id — a retry yields exactly one version (CTO amendment 1)', async () => {
      let project = service.create(book('Le Guide'), settings);
      project = service.snapshot(project, 'v1');
      await repo.save(project);
      const v1 = project.versions[0];

      // Re-appending the same version (the retry-after-lost-ack path) must not duplicate it.
      await repo.appendVersion(project, v1);
      await repo.appendVersion(project, v1);

      const loaded = (await repo.findById(project.id))!;
      expect(loaded.versions.filter((v) => v.id === v1.id)).toHaveLength(1);
      expect(loaded.versions).toHaveLength(1);
    });
  });

  describe(`${label} — stored state is isolated from callers`, () => {
    it('a caller mutating what it saved or loaded does not corrupt the store', async () => {
      const repo = makeRepository();
      const service = new ProjectService(() => 'id-1');
      const project = service.create(book('Le Guide'), settings);
      await repo.save(project);

      (project as { name: string }).name = 'Mutated after save';
      expect((await repo.findById(project.id))?.name).toBe('Le Guide');

      const loaded = await repo.findById(project.id);
      (loaded as { name: string }).name = 'Mutated after load';
      expect((await repo.findById(project.id))?.name).toBe('Le Guide');
    });
  });

  describe(`${label} — library listing`, () => {
    let repo: ReturnType<typeof makeRepository>;
    let service: ProjectService;

    beforeEach(() => {
      repo = makeRepository();
      let n = 0;
      service = new ProjectService(() => `id-${++n}`);
    });

    it('returns summaries, never aggregates', async () => {
      let project = service.create(book('Le Guide'), settings);
      project = service.snapshot(project);
      await repo.save(project);

      const [summary] = await repo.list();

      expect(summary.bookTitle).toBe('Le Guide');
      expect(summary.versionCount).toBe(1);
      expect(summary).not.toHaveProperty('book');
      expect(summary).not.toHaveProperty('versions');
      expect(summary.updatedAt).toBeInstanceOf(Date);
    });

    it('derives published targets from the event log, successes only, no repeats', async () => {
      let project = service.create(book('Le Guide'), settings);
      project = service.recordPublication(project, report('kdp', 'PASS'));
      project = service.recordPublication(project, report('kdp', 'PASS'));
      project = service.recordPublication(project, report('kobo', 'FAIL'));
      await repo.save(project);

      expect((await repo.list())[0].publishedTargets).toEqual(['kdp']);
    });

    it('lists newest first', async () => {
      const older = service.create(book('Older'), settings);
      await repo.save({ ...older, updatedAt: new Date('2026-01-01') });
      const newer = service.create(book('Newer'), settings);
      await repo.save({ ...newer, updatedAt: new Date('2026-06-01') });

      expect((await repo.list()).map((s) => s.bookTitle)).toEqual(['Newer', 'Older']);
    });

    it('excludes archived projects by default and returns them on request (ADR-0044)', async () => {
      await repo.save(service.create(book('Active'), settings));
      await repo.save(service.archive(service.create(book('Archived'), settings)));

      expect((await repo.list()).map((s) => s.bookTitle)).toEqual(['Active']);
      const all = await repo.list({ includeArchived: true });
      expect(all.map((s) => s.bookTitle).sort()).toEqual(['Active', 'Archived']);
      expect(all.find((s) => s.bookTitle === 'Archived')?.archivedAt).toBeInstanceOf(Date);
    });

    it('a restored project returns to the default listing', async () => {
      const project = service.create(book('Back'), settings);
      await repo.save(service.archive(project));
      const archived = await repo.findById(project.id);
      await repo.save(service.restore(archived!));

      expect((await repo.list()).map((s) => s.bookTitle)).toEqual(['Back']);
    });
  });
}
