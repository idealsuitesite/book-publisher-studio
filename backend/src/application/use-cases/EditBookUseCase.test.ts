import { describe, it, expect, beforeEach } from 'vitest';
import { EditBookUseCase } from './EditBookUseCase';
import { ProjectService } from '../../domain/services/ProjectService';
import { BookEditingService } from '../../domain/services/BookEditingService';
import { InMemoryProjectRepository } from '../../infrastructure/repositories/InMemoryProjectRepository';
import { createBook, type Book, type Chapter } from '../../domain/models/Book';
import { ContentNotFoundError } from '../../shared/errors/ContentNotFoundError';

function chapter(id: string, number: number, title: string): Chapter {
  return { type: 'chapter', id, number, title, content: [], createdAt: new Date(), updatedAt: new Date() };
}
function bookWith3(): Book {
  return createBook({ title: 'T', author: 'A', language: 'en' }, [
    chapter('c1', 1, 'One'),
    chapter('c2', 2, 'Two'),
    chapter('c3', 3, 'Three'),
  ]);
}

describe('EditBookUseCase — structure editing persists, snapshots, and undoes', () => {
  let repo: InMemoryProjectRepository;
  let projectService: ProjectService;
  let useCase: EditBookUseCase;
  let id: string;

  beforeEach(async () => {
    repo = new InMemoryProjectRepository();
    projectService = new ProjectService();
    useCase = new EditBookUseCase(repo, projectService, new BookEditingService());
    const project = projectService.create(bookWith3(), { layoutName: 'letter', themeName: 'classic' });
    id = project.id;
    await repo.save(project);
  });

  it('returns false for a project that does not exist (caller -> 404)', async () => {
    expect(await useCase.execute('nope', { type: 'rename', id: 'c1', title: 'X' })).toBe(false);
  });

  it('rename: applies, persists, and snapshots the PRE-edit book (undo point)', async () => {
    const ok = await useCase.execute(id, { type: 'rename', id: 'c2', title: 'Renamed' });
    expect(ok).toBe(true);

    const saved = (await repo.findById(id))!;
    expect((saved.book.mainContent[1] as Chapter).title).toBe('Renamed');
    // one validated edit == one version (Q2 coarse granularity), and it holds the PRE-edit title
    expect(saved.versions).toHaveLength(1);
    expect((saved.versions[0].book.mainContent[1] as Chapter).title).toBe('Two');
  });

  it('reorderChapters: applies, persists, renumbers, and snapshots before', async () => {
    await useCase.execute(id, { type: 'reorderChapters', fromIndex: 0, toIndex: 2 });
    const saved = (await repo.findById(id))!;
    expect(saved.book.mainContent.map((c) => c.id)).toEqual(['c2', 'c3', 'c1']);
    expect(saved.book.mainContent.map((c) => (c as Chapter).number)).toEqual([1, 2, 3]);
    expect(saved.versions[0].book.mainContent.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']); // pre-edit
  });

  it('undo: restoreVersion brings back a prior version without deleting later ones', async () => {
    await useCase.execute(id, { type: 'rename', id: 'c1', title: 'Edit-1' }); // version 1 = pre-edit ("One")
    const versionId = (await repo.findById(id))!.versions[0].id;

    await useCase.execute(id, { type: 'restoreVersion', versionId }); // undo -> back to "One"
    const saved = (await repo.findById(id))!;
    expect((saved.book.mainContent[0] as Chapter).title).toBe('One');
    expect(saved.versions).toHaveLength(1); // restore is append-only-safe: nothing deleted
  });

  it('a bad target inside a real project throws (caller -> 400), and does NOT persist a snapshot', async () => {
    await expect(useCase.execute(id, { type: 'rename', id: 'ghost', title: 'X' })).rejects.toThrow(ContentNotFoundError);
    const saved = (await repo.findById(id))!;
    // the failed rename never reached save(): no version, book unchanged
    expect(saved.versions).toHaveLength(0);
    expect((saved.book.mainContent[0] as Chapter).title).toBe('One');
  });
});
