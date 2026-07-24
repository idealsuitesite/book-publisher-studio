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

    // Undo (APPEND_ONLY_PERSISTENCE B, DR D2): the version index findById returned carries no book, so
    // load the target version's payload on demand — undo pays ONE version's load, not N — set it as the
    // new head, and save head-only (no new version; the log is untouched, nothing after it deleted).
    if (mutation.type === 'restoreVersion') {
      const version = await this.repository.getVersion(id, mutation.versionId);
      if (!version) throw new Error(`No such version: ${mutation.versionId}`);
      const restored = this.projectService.restoreToVersion(project, version);
      await this.repository.save(restored);
      return true;
    }

    // Every other mutation is snapshot-before-edit → ONE new version, appended atomically with the head
    // (DR D3). If `apply` throws on a bad target, appendVersion is never reached: nothing is persisted.
    const updated = this.apply(project, mutation);
    const newVersion = updated.versions[updated.versions.length - 1];
    await this.repository.appendVersion(updated, newVersion);
    return true;
  }

  private apply(project: Project, mutation: Exclude<StructureMutation, { type: 'restoreVersion' }>): Project {
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
      case 'collapseMarker': {
        const snapped = this.projectService.snapshot(project, 'before collapse marker');
        const book = this.editingService.collapseMarker(this.projectService.currentBook(project), mutation.markerId);
        return this.projectService.replaceBook(snapped, book);
      }
      case 'promoteToSubsection': {
        const snapped = this.projectService.snapshot(project, 'before promote to subsection');
        const book = this.editingService.promoteToSubsection(this.projectService.currentBook(project), mutation.blockId);
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
      case 'batchApply': {
        // BATCH_CONFIRM_LATENCY correctif A: ONE gesture → ONE snapshot → ONE save (execute() saves
        // once). This is the whole win over the old N-round-trip loop. The label is DESCRIPTIVE (CTO
        // amendment V2i) so the single undo point reads honestly in history, never a generic string.
        const snapped = this.projectService.snapshot(project, batchLabel(mutation.op, mutation.ids.length));
        const book = this.editingService.applyBatch(this.projectService.currentBook(snapped), mutation.op, mutation.ids);
        return this.projectService.replaceBook(snapped, book);
      }
      default: {
        const _exhaustive: never = mutation;
        throw new Error(`Unknown structure mutation: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
}

/**
 * The version label for a batch "…all" gesture (BATCH_CONFIRM_LATENCY correctif A, CTO amendment
 * V2i). "Make all" is ONE undo point (Q2-coherent) — so the label must say WHAT it was, with the
 * count, never a generic string, or the coarse undo point is unreadable in the history.
 */
function batchLabel(op: 'promoteToChapter' | 'collapseMarker' | 'promoteToSubsection', n: number): string {
  const s = n === 1 ? '' : 's';
  switch (op) {
    case 'promoteToChapter':
      return `Convert all — ${n} chapter${s} created`;
    case 'collapseMarker':
      return `Collapse all — ${n} marker${s} removed`;
    case 'promoteToSubsection':
      return `Make all sections — ${n} section${s} created`;
  }
}
