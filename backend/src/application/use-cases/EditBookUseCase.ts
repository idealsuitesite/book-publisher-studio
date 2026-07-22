import type { ProjectRepository } from '../../domain/ports/ProjectRepository';
import type { ProjectService } from '../../domain/services/ProjectService';
import type { BookEditingService } from '../../domain/services/BookEditingService';
import type { Project } from '../../domain/models/Project';
// STRUCTURE_EDITING.md Q4's command, now shared (ADR-0033): Phase 3's frontend issues the same
// union. Moved to shared-types as the Level-1 review pre-committed ("when the frontend needs it").
import type { StructureMutation } from 'shared-types';

/**
 * Applies a manual structure edit to a project's manuscript, durably (STRUCTURE_EDITING.md, Level-1
 * phase 2). The write path the read-only Explorer never had.
 *
 * Every edit is **snapshot-before-edit** (`snapshot()` then `replaceBook()`), so **undo is a
 * restore of the prior version** — the append-only version log loses nothing (ProjectService
 * comments). Granularity is coarse (Q2): one *validated* command is one version, never one
 * keystroke — the 45MB/50-versions finding (ADR-0046) is why per-keystroke snapshots are refused.
 *
 * Validation stays read-only (ADR-0027): this never routes through the validator; the next read
 * (`GetProjectUseCase`) recomputes it against the edited book.
 */
export class EditBookUseCase {
  constructor(
    private repository: ProjectRepository,
    private projectService: ProjectService,
    private editingService: BookEditingService
  ) {}

  /**
   * Returns `true` if the project existed and the edit was applied and saved, `false` if there is
   * no such project (the caller maps that to 404). Throws on a bad target inside a real project
   * (unknown content id / version) — the caller maps those to 400/404.
   */
  async execute(id: string, mutation: StructureMutation): Promise<boolean> {
    const project = await this.repository.findById(id);
    if (!project) return false;

    const updated = this.apply(project, mutation);
    await this.repository.save(updated);
    return true;
  }

  private apply(project: Project, mutation: StructureMutation): Project {
    switch (mutation.type) {
      case 'reorderChapters': {
        const snapped = this.projectService.snapshot(project, 'before reorder');
        const book = this.editingService.reorderChapters(this.projectService.currentBook(project), mutation.fromIndex, mutation.toIndex);
        return this.projectService.replaceBook(snapped, book);
      }
      case 'rename': {
        const snapped = this.projectService.snapshot(project, 'before rename');
        const book = this.editingService.rename(this.projectService.currentBook(project), mutation.id, mutation.title);
        return this.projectService.replaceBook(snapped, book);
      }
      case 'promoteToChapter': {
        const snapped = this.projectService.snapshot(project, 'before promote to chapter');
        const book = this.editingService.promoteToChapter(this.projectService.currentBook(project), mutation.blockId);
        return this.projectService.replaceBook(snapped, book);
      }
      case 'mergeChapterIntoPrevious': {
        const snapped = this.projectService.snapshot(project, 'before merge chapter');
        const book = this.editingService.mergeChapterIntoPrevious(this.projectService.currentBook(project), mutation.chapterId);
        return this.projectService.replaceBook(snapped, book);
      }
      case 'setPartRole': {
        const snapped = this.projectService.snapshot(project, 'before set part role');
        const book = this.editingService.setPartRole(this.projectService.currentBook(project), mutation.id, mutation.role);
        return this.projectService.replaceBook(snapped, book);
      }
      case 'insertPartOpener': {
        const snapped = this.projectService.snapshot(project, 'before insert part');
        const book = this.editingService.insertPartOpener(this.projectService.currentBook(project), mutation.index, mutation.title);
        return this.projectService.replaceBook(snapped, book);
      }
      case 'removePartOpener': {
        const snapped = this.projectService.snapshot(project, 'before remove part');
        const book = this.editingService.removePartOpener(this.projectService.currentBook(project), mutation.id);
        return this.projectService.replaceBook(snapped, book);
      }
      case 'setCallout': {
        const snapped = this.projectService.snapshot(project, mutation.on ? 'before callout mark' : 'before callout unmark');
        const book = this.editingService.setCallout(this.projectService.currentBook(project), mutation.blockId, mutation.on);
        return this.projectService.replaceBook(snapped, book);
      }
      case 'markAsSubtitle': {
        const snapped = this.projectService.snapshot(project, 'before subtitle mark');
        const book = this.editingService.markAsSubtitle(this.projectService.currentBook(project), mutation.blockId);
        return this.projectService.replaceBook(snapped, book);
      }
      case 'clearSubtitle': {
        const snapped = this.projectService.snapshot(project, 'before subtitle clear');
        const book = this.editingService.clearSubtitle(this.projectService.currentBook(project), mutation.chapterId);
        return this.projectService.replaceBook(snapped, book);
      }
      case 'editFrontMatter': {
        const snapped = this.projectService.snapshot(project, 'before front matter edit');
        const book = this.editingService.editFrontMatter(this.projectService.currentBook(project), {
          titlePage: mutation.titlePage,
          copyrightPage: mutation.copyrightPage,
        });
        return this.projectService.replaceBook(snapped, book);
      }
      case 'restoreVersion':
        // Undo: no new snapshot — restoreVersion sets book+settings from the version and keeps the
        // whole log (nothing after it is deleted). ProjectService owns that invariant.
        return this.projectService.restoreVersion(project, mutation.versionId);
      default: {
        const _exhaustive: never = mutation;
        throw new Error(`Unknown structure mutation: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
}
