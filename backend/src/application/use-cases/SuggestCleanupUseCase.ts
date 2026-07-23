import type { ProjectRepository } from '../../domain/ports/ProjectRepository';
import { CleanupSuggester } from '../../domain/services/structureCleanup/CleanupSuggester';
import type { CleanupSuggestionDTO } from 'shared-types';

/**
 * STRUCTURE_CLEANUP — the READ-ONLY cleanup surface (STRUCTURE_CLEANUP_DR.md §6.1). Loads the
 * project's STORED book and runs the pure `CleanupSuggester` over it, returning candidate marker
 * collapses. It NEVER mutates: applying a suggestion is a SEPARATE author action through the
 * `collapseMarker` mutation route (`POST /:id/structure`). Returns `undefined` when the project
 * does not exist (the controller maps that to 404). The over-structured mirror of
 * `SuggestStructureUseCase`.
 */
export class SuggestCleanupUseCase {
  private readonly suggester = new CleanupSuggester();

  constructor(private readonly repository: ProjectRepository) {}

  async execute(id: string): Promise<CleanupSuggestionDTO[] | undefined> {
    const project = await this.repository.findById(id);
    if (!project) return undefined;
    // The suggester is pure — it reads the book and returns an array; the invariant test proves the
    // book is byte-identical after this call (no mutation, no persistence).
    return this.suggester.suggest(project.book).map((s) => ({
      markerId: s.markerId,
      markerText: s.markerText,
      kind: s.kind,
      targetChapterId: s.targetChapterId,
      targetTitle: s.targetTitle,
      canonicalLabel: s.canonicalLabel,
    }));
  }
}
