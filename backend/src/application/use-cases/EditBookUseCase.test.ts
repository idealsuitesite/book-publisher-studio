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
    // one validated edit == one version (Q2 coarse granularity), and it holds the PRE-edit title.
    // The index carries no payload — the pre-edit book is fetched on demand (APPEND_ONLY_PERSISTENCE B).
    expect(saved.versions).toHaveLength(1);
    const snapshot = (await repo.getVersion(id, saved.versions[0].id))!;
    expect((snapshot.book!.mainContent[1] as Chapter).title).toBe('Two');
  });

  it('setPartRole: tags a part, persists, and snapshots before (undo point) — MINI_DR_EDITORIAL_PLACEMENT', async () => {
    const ok = await useCase.execute(id, { type: 'setPartRole', id: 'c1', role: 'front' });
    expect(ok).toBe(true);

    const saved = (await repo.findById(id))!;
    expect((saved.book.mainContent[0] as Chapter).role).toBe('front');
    expect(saved.versions).toHaveLength(1);
    const snapshot = (await repo.getVersion(id, saved.versions[0].id))!;
    expect((snapshot.book!.mainContent[0] as Chapter).role).toBeUndefined(); // pre-edit: untagged
  });

  it('setPartRole NO-OP: re-applying the same placement creates NO version (M3-C9 — exploration does not tax the log)', async () => {
    // First a real change → one version. Then the SAME placement again → still one version, not two.
    await useCase.execute(id, { type: 'setPartRole', id: 'c1', role: 'front' });
    expect((await repo.findById(id))!.versions).toHaveLength(1);

    const ok = await useCase.execute(id, { type: 'setPartRole', id: 'c1', role: 'front' }); // no-op
    expect(ok).toBe(true); // the gesture "succeeded" — the author is never told it failed
    const saved = (await repo.findById(id))!;
    expect((saved.book.mainContent[0] as Chapter).role).toBe('front'); // unchanged, still front
    expect(saved.versions).toHaveLength(1); // NO second version — the no-op wrote nothing
  });

  it('reorderChapters: applies, persists, renumbers, and snapshots before', async () => {
    await useCase.execute(id, { type: 'reorderChapters', fromIndex: 0, toIndex: 2 });
    const saved = (await repo.findById(id))!;
    expect(saved.book.mainContent.map((c) => c.id)).toEqual(['c2', 'c3', 'c1']);
    expect(saved.book.mainContent.map((c) => (c as Chapter).number)).toEqual([1, 2, 3]);
    const snapshot = (await repo.getVersion(id, saved.versions[0].id))!;
    expect(snapshot.book!.mainContent.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']); // pre-edit
  });

  it('undo: restoreVersion brings back a prior version without deleting later ones', async () => {
    await useCase.execute(id, { type: 'rename', id: 'c1', title: 'Edit-1' }); // version 1 = pre-edit ("One")
    const versionId = (await repo.findById(id))!.versions[0].id;

    await useCase.execute(id, { type: 'restoreVersion', versionId }); // undo -> back to "One"
    const saved = (await repo.findById(id))!;
    expect((saved.book.mainContent[0] as Chapter).title).toBe('One');
    expect(saved.versions).toHaveLength(1); // restore is append-only-safe: nothing deleted
  });

  it('undo with an unknown version id throws (the lookup moved to the Application step, APPEND_ONLY_PERSISTENCE B)', async () => {
    await expect(useCase.execute(id, { type: 'restoreVersion', versionId: 'no-such-version' })).rejects.toThrow(
      /No such version/
    );
    // nothing persisted: still zero versions, book untouched
    const saved = (await repo.findById(id))!;
    expect(saved.versions).toHaveLength(0);
    expect((saved.book.mainContent[0] as Chapter).title).toBe('One');
  });

  it('a bad target inside a real project throws (caller -> 400), and does NOT persist a snapshot', async () => {
    await expect(useCase.execute(id, { type: 'rename', id: 'ghost', title: 'X' })).rejects.toThrow(ContentNotFoundError);
    const saved = (await repo.findById(id))!;
    // the failed rename never reached save(): no version, book unchanged
    expect(saved.versions).toHaveLength(0);
    expect((saved.book.mainContent[0] as Chapter).title).toBe('One');
  });
});

describe('EditBookUseCase — create ops dispatch (CREATE_CHAPTER.md)', () => {
  let repo: InMemoryProjectRepository;
  let projectService: ProjectService;
  let useCase: EditBookUseCase;
  let id: string;

  // A 0-chapter manuscript's shape: one untitled section of paragraph blocks.
  function unstructured(): Book {
    return createBook({ title: 'T', author: 'A', language: 'en' }, [
      {
        type: 'section',
        id: 'sec',
        title: '',
        content: [
          { type: 'paragraph', id: 'b1', text: 'One' },
          { type: 'paragraph', id: 'b2', text: 'Two' },
          { type: 'paragraph', id: 'b3', text: 'Three' },
        ],
        level: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  }

  beforeEach(async () => {
    repo = new InMemoryProjectRepository();
    projectService = new ProjectService();
    useCase = new EditBookUseCase(repo, projectService, new BookEditingService());
    const project = projectService.create(unstructured(), { layoutName: 'letter', themeName: 'classic' });
    id = project.id;
    await repo.save(project);
  });

  it('promoteToChapter: persists a new chapter and snapshots the pre-edit book', async () => {
    const ok = await useCase.execute(id, { type: 'promoteToChapter', blockId: 'b2' });
    expect(ok).toBe(true);

    const saved = (await repo.findById(id))!;
    expect(saved.versions).toHaveLength(1); // pre-edit snapshot (undo point)
    const snapshot = (await repo.getVersion(id, saved.versions[0].id))!;
    expect(snapshot.book!.mainContent).toHaveLength(1); // the snapshot is the unstructured book
    const chapters = saved.book.mainContent.filter((c) => c.type === 'chapter');
    expect(chapters.map((c) => c.title)).toEqual(['Two']);
  });

  it('mergeChapterIntoPrevious: dispatches and reaches the domain op (round-trips the promote)', async () => {
    await useCase.execute(id, { type: 'promoteToChapter', blockId: 'b2' });
    const afterPromote = (await repo.findById(id))!;
    const newChapterId = afterPromote.book.mainContent.find((c) => c.type === 'chapter')!.id;

    const ok = await useCase.execute(id, { type: 'mergeChapterIntoPrevious', chapterId: newChapterId });
    expect(ok).toBe(true);

    const saved = (await repo.findById(id))!;
    expect(saved.book.mainContent.filter((c) => c.type === 'chapter')).toHaveLength(0); // merged back
    expect(saved.versions).toHaveLength(2); // one snapshot per edit
  });
});

// BATCH_CONFIRM_LATENCY correctif A — the persistence property: ONE gesture = ONE snapshot = ONE save.
// Success ⇒ +1 version; failure ⇒ +0 and the stored book byte-identical (CTO amendment 1, at the layer
// where snapshot/save actually happen).
describe('EditBookUseCase — batchApply is ONE snapshot / ONE save (BATCH_CONFIRM_LATENCY)', () => {
  let repo: InMemoryProjectRepository;
  let projectService: ProjectService;
  let useCase: EditBookUseCase;
  let id: string;

  // A preamble carrying two typed markers — the assist's "Make all chapters" input.
  function withMarkers(): Book {
    return createBook({ title: 'T', author: 'A', language: 'en' }, [
      {
        type: 'section', id: 'sec', title: '', level: 1, createdAt: new Date(), updatedAt: new Date(),
        content: [
          { type: 'paragraph', id: 'a', text: 'Intro.' },
          { type: 'paragraph', id: 'm1', text: 'CHAPTER 1' },
          { type: 'paragraph', id: 'b', text: 'Body one.' },
          { type: 'paragraph', id: 'm2', text: 'CHAPTER 2' },
          { type: 'paragraph', id: 'c', text: 'Body two.' },
        ],
      },
    ]);
  }

  beforeEach(async () => {
    repo = new InMemoryProjectRepository();
    projectService = new ProjectService();
    useCase = new EditBookUseCase(repo, projectService, new BookEditingService());
    const project = projectService.create(withMarkers(), { layoutName: 'letter', themeName: 'classic' });
    id = project.id;
    await repo.save(project);
  });

  it('success: N promotions become ONE version with a descriptive label, both chapters created', async () => {
    const ok = await useCase.execute(id, { type: 'batchApply', op: 'promoteToChapter', ids: ['m1', 'm2'] });
    expect(ok).toBe(true);

    const saved = (await repo.findById(id))!;
    expect(saved.versions).toHaveLength(1); // +1, not +N — the ceiling property
    expect(saved.versions[0].label).toBe('Convert all — 2 chapters created'); // V2i: the undo point reads honestly
    expect(saved.book.mainContent.filter((c) => c.type === 'chapter').map((c) => c.title)).toEqual(['CHAPTER 1', 'CHAPTER 2']);
  });

  it('failure: a bad id mid-batch persists NOTHING — +0 versions, stored book byte-identical', async () => {
    const before = (await repo.findById(id))!;
    await expect(
      useCase.execute(id, { type: 'batchApply', op: 'promoteToChapter', ids: ['m1', 'ghost'] })
    ).rejects.toThrow(ContentNotFoundError);

    const saved = (await repo.findById(id))!;
    expect(saved.versions).toHaveLength(0); // +0: the whole gesture failed, no phantom half-version
    expect(saved.book).toEqual(before.book); // byte-identical: no half-transformed book left behind
  });
});
