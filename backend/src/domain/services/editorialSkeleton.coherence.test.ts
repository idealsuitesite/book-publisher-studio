import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MammothParser } from '../../infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../../infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from './ASTBuilder';
import { ProjectService } from './ProjectService';
import { BookEditingService } from './BookEditingService';
import { EditBookUseCase } from '../../application/use-cases/EditBookUseCase';
import { InMemoryProjectRepository } from '../../infrastructure/repositories/InMemoryProjectRepository';
import { projectEditorialSkeleton, type EditorialSkeleton } from './editorialSkeleton';
import type { Book, Chapter } from '../models/Book';
import type { StructureMutation } from 'shared-types';

/**
 * D1 projection-coherence (AUTHOR_EXPERIENCE_DR §3 D1 / §8 M0-C1, test (ii) of two). The single
 * write path is a UNIFICATION only if the projection always MIRRORS the model it derives from. This
 * proves the read follows the write for EVERY mutation type: the real gesture path (gesture → op →
 * `EditBookUseCase` → saved `Book`) is driven on the real `faith-alone` corpus, then
 * `projectEditorialSkeleton` is re-derived from the SAVED book and asserted to reflect the change.
 * Complement of the setter-lock (`editorialSkeleton.setterLock.test.ts`, nothing writes in).
 *
 * The skeleton's grain is the TOP-LEVEL editorial spine (§8 note). So the mutation types split:
 *  - GRAIN ops (title/order/place/presence of a top-level object) → the projection reflects them;
 *  - BELOW-GRAIN ops (a subsection, a subtitle, a callout, a front-matter CONTENT edit) → the
 *    top-level projection is correctly UNCHANGED — itself a coherence property, asserted here.
 * All 15 `StructureMutation` variants are exercised, none skipped.
 */

const CORPUS = (file: string): string => join(__dirname, '..', '..', '..', 'verification', 'corpus', file);
const SETTINGS = { layoutName: 'letter', themeName: 'classic' } as const;

async function importCorpus(file: string): Promise<Book> {
  const raw = await new MammothParser().parse(readFileSync(CORPUS(file)));
  const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: file });
  return new ASTBuilder().build(normalized);
}

/** Drive one mutation through the REAL write path and return the projection of the saved book. */
async function applyAndProject(book: Book, ...mutations: StructureMutation[]): Promise<{ saved: Book; skeleton: EditorialSkeleton }> {
  const repo = new InMemoryProjectRepository();
  const projectService = new ProjectService();
  const useCase = new EditBookUseCase(repo, projectService, new BookEditingService());
  const project = projectService.create(book, SETTINGS);
  await repo.save(project);
  for (const mutation of mutations) {
    const ok = await useCase.execute(project.id, mutation);
    expect(ok).toBe(true);
  }
  const saved = (await repo.findById(project.id))!.book;
  return { saved, skeleton: projectEditorialSkeleton(saved) };
}

const bodyChapters = (sk: EditorialSkeleton) => sk.objects.filter((o) => o.type === 'chapter');
const titles = (sk: EditorialSkeleton) => sk.objects.map((o) => o.title);
const numbers = (sk: EditorialSkeleton) => bodyChapters(sk).map((o) => o.number);
const indexInMain = (book: Book, id: string) => book.mainContent.findIndex((c) => c.id === id);

/** A non-first promotable text block per chapter, distinct chapters — the round-trippable case. */
function promotableBlockIds(book: Book, count: number): string[] {
  const ids: string[] = [];
  for (const c of book.mainContent) {
    if (c.type !== 'chapter') continue;
    const idx = c.content.findIndex((b, i) => i > 0 && (b.type === 'paragraph' || b.type === 'heading'));
    if (idx > 0) ids.push(c.content[idx].id);
    if (ids.length >= count) return ids;
  }
  throw new Error(`need ${count} promotable blocks in distinct chapters, found ${ids.length}`);
}

describe('editorialSkeleton — projection-coherence: the read follows the write, every mutation type', () => {
  let faithAlone: Book;
  let baseline: EditorialSkeleton;

  beforeAll(async () => {
    faithAlone = await importCorpus('faith-alone-styled.docx');
    baseline = projectEditorialSkeleton(faithAlone);
    // Sanity: faith-alone projects into a real spine with more than one body chapter to move around.
    expect(bodyChapters(baseline).length).toBeGreaterThan(1);
  }, 30_000);

  // ── GRAIN ops — the projection must reflect the change ─────────────────────────────────────────

  it('rename → the object shows the new title', async () => {
    const target = bodyChapters(baseline)[1];
    const { skeleton } = await applyAndProject(faithAlone, { type: 'rename', id: refId(target.sourceRef), title: 'A Brand New Title' });
    expect(titles(skeleton)).toContain('A Brand New Title');
    expect(titles(skeleton)).not.toContain(target.title);
  }, 30_000);

  it('reorderChapters → the object order (and the computed numbers) follow', async () => {
    const first = bodyChapters(baseline)[0];
    const second = bodyChapters(baseline)[1];
    const from = indexInMain(faithAlone, refId(second.sourceRef));
    const to = indexInMain(faithAlone, refId(first.sourceRef));
    const { skeleton } = await applyAndProject(faithAlone, { type: 'reorderChapters', fromIndex: from, toIndex: to });
    const chapters = bodyChapters(skeleton);
    // The second chapter now leads; numbering is re-derived to the new reading order (1..n contiguous).
    expect(chapters[0].title).toBe(second.title);
    expect(chapters[1].title).toBe(first.title);
    expect(numbers(skeleton)).toEqual(chapters.map((_, i) => i + 1));
  }, 30_000);

  it('setPartRole → the object moves to the tagged place and leaves the body numbering', async () => {
    const target = bodyChapters(baseline)[0];
    const { skeleton } = await applyAndProject(faithAlone, { type: 'setPartRole', id: refId(target.sourceRef), role: 'front' });
    const moved = skeleton.objects.find((o) => refId(o.sourceRef) === refId(target.sourceRef))!;
    expect(moved.place).toBe('front');
    expect(moved.type).toBe('front-matter');
    expect(moved.number).toBeUndefined();
    // One fewer body chapter, and the survivors renumber 1..n-1.
    expect(bodyChapters(skeleton).length).toBe(bodyChapters(baseline).length - 1);
    expect(numbers(skeleton)).toEqual(bodyChapters(skeleton).map((_, i) => i + 1));
  }, 30_000);

  it('promoteToChapter → a new body chapter object appears', async () => {
    const [blockId] = promotableBlockIds(faithAlone, 1);
    const { skeleton } = await applyAndProject(faithAlone, { type: 'promoteToChapter', blockId });
    expect(bodyChapters(skeleton).length).toBe(bodyChapters(baseline).length + 1);
  }, 30_000);

  it('mergeChapterIntoPrevious → a body chapter object disappears', async () => {
    const last = bodyChapters(baseline).at(-1)!;
    const { skeleton } = await applyAndProject(faithAlone, { type: 'mergeChapterIntoPrevious', chapterId: refId(last.sourceRef) });
    expect(bodyChapters(skeleton).length).toBe(bodyChapters(baseline).length - 1);
    expect(titles(skeleton)).not.toContain(last.title);
  }, 30_000);

  it('insertPartOpener → a part-opener object appears at the position', async () => {
    const at = indexInMain(faithAlone, refId(bodyChapters(baseline)[1].sourceRef));
    const { skeleton } = await applyAndProject(faithAlone, { type: 'insertPartOpener', index: at, title: 'Part I' });
    const opener = skeleton.objects.find((o) => o.type === 'part-opener');
    expect(opener?.title).toBe('Part I');
  }, 30_000);

  it('removePartOpener → the opener object disappears (insert then remove)', async () => {
    const at = indexInMain(faithAlone, refId(bodyChapters(baseline)[1].sourceRef));
    const inserted = await applyAndProject(faithAlone, { type: 'insertPartOpener', index: at, title: 'Part I' });
    const opener = inserted.skeleton.objects.find((o) => o.type === 'part-opener')!;
    const { skeleton } = await applyAndProject(inserted.saved, { type: 'removePartOpener', id: refId(opener.sourceRef) });
    expect(skeleton.objects.some((o) => o.type === 'part-opener')).toBe(false);
  }, 30_000);

  it('collapseMarker → the empty marker object is removed (real base + one injected CHAPTER marker)', async () => {
    // faith-alone carries no empty numbered marker; inject one before a real chapter (the base stays
    // the real book). collapseMarker removes it and the follower flows up and renumbers.
    const targetIndex = indexInMain(faithAlone, refId(bodyChapters(baseline)[1].sourceRef));
    const marker: Chapter = {
      type: 'chapter', id: 'injected-marker', number: 0, title: 'CHAPTER 99',
      content: [], createdAt: new Date(), updatedAt: new Date(),
    };
    const withMarker: Book = {
      ...faithAlone,
      mainContent: [...faithAlone.mainContent.slice(0, targetIndex), marker, ...faithAlone.mainContent.slice(targetIndex)],
    };
    const before = projectEditorialSkeleton(withMarker);
    expect(titles(before)).toContain('CHAPTER 99');
    const { skeleton } = await applyAndProject(withMarker, { type: 'collapseMarker', markerId: 'injected-marker' });
    expect(titles(skeleton)).not.toContain('CHAPTER 99');
  }, 30_000);

  it('batchApply (promoteToChapter ×2) → both new chapter objects appear', async () => {
    const ids = promotableBlockIds(faithAlone, 2);
    const { skeleton } = await applyAndProject(faithAlone, { type: 'batchApply', op: 'promoteToChapter', ids });
    expect(bodyChapters(skeleton).length).toBe(bodyChapters(baseline).length + 2);
  }, 30_000);

  it('editFrontMatter → a Title Page front object appears (presence reflected)', async () => {
    expect(titles(baseline)).not.toContain('Title Page'); // faith-alone imports with an empty frontMatter
    const { skeleton } = await applyAndProject(faithAlone, {
      type: 'editFrontMatter',
      titlePage: { title: 'Faith Alone', author: 'A. Writer' },
    });
    const titlePage = skeleton.objects.find((o) => o.sourceRef.kind === 'front-matter' && o.sourceRef.slot === 'titlePage');
    expect(titlePage).toBeDefined();
    expect(titlePage!.place).toBe('front');
  }, 30_000);

  it('restoreVersion → the projection reverts to the pre-edit spine', async () => {
    const target = bodyChapters(baseline)[0];
    const repo = new InMemoryProjectRepository();
    const projectService = new ProjectService();
    const useCase = new EditBookUseCase(repo, projectService, new BookEditingService());
    const project = projectService.create(faithAlone, SETTINGS);
    await repo.save(project);
    await useCase.execute(project.id, { type: 'rename', id: refId(target.sourceRef), title: 'Temporary Rename' });
    const afterRename = (await repo.findById(project.id))!;
    expect(titles(projectEditorialSkeleton(afterRename.book))).toContain('Temporary Rename');
    // Undo: restore the pre-rename snapshot; the skeleton returns to the original title.
    await useCase.execute(project.id, { type: 'restoreVersion', versionId: afterRename.versions[0].id });
    const restored = (await repo.findById(project.id))!;
    const skeleton = projectEditorialSkeleton(restored.book);
    expect(titles(skeleton)).toContain(target.title);
    expect(titles(skeleton)).not.toContain('Temporary Rename');
  }, 30_000);

  // ── BELOW-GRAIN ops — the top-level projection is correctly UNCHANGED ───────────────────────────

  it('promoteToSubsection → the top-level skeleton is unchanged (the subsection is below the grain)', async () => {
    const [blockId] = promotableBlockIds(faithAlone, 1);
    const { skeleton } = await applyAndProject(faithAlone, { type: 'promoteToSubsection', blockId });
    expect(skeleton).toEqual(baseline);
  }, 30_000);

  it('setCallout → the top-level skeleton is unchanged', async () => {
    const paragraph = firstParagraph(faithAlone);
    const { skeleton } = await applyAndProject(faithAlone, { type: 'setCallout', blockId: paragraph.blockId, on: true });
    expect(skeleton).toEqual(baseline);
  }, 30_000);

  it('markAsSubtitle then clearSubtitle → the top-level skeleton is unchanged (subtitle is not a skeleton datum)', async () => {
    const paragraph = firstParagraph(faithAlone);
    const marked = await applyAndProject(faithAlone, { type: 'markAsSubtitle', blockId: paragraph.blockId });
    expect(marked.skeleton).toEqual(baseline);
    const { skeleton } = await applyAndProject(marked.saved, { type: 'clearSubtitle', chapterId: paragraph.chapterId });
    expect(skeleton).toEqual(baseline);
  }, 30_000);
});

/** A `content` sourceRef's id (the coherence tests only ever target mainContent objects). */
function refId(ref: EditorialSkeleton['objects'][number]['sourceRef']): string {
  if (ref.kind !== 'content') throw new Error(`expected a content ref, got ${ref.kind}`);
  return ref.id;
}

/** The first body paragraph directly inside a top-level chapter, with its chapter id. */
function firstParagraph(book: Book): { blockId: string; chapterId: string } {
  for (const c of book.mainContent) {
    if (c.type !== 'chapter') continue;
    const p = c.content.find((b) => b.type === 'paragraph' && b.text.trim().length > 0);
    if (p) return { blockId: p.id, chapterId: c.id };
  }
  throw new Error('no top-level chapter paragraph found');
}
