import type { ProjectRepository } from '../../domain/ports/ProjectRepository';
import { StructureSuggester } from '../../domain/services/structureAssist/StructureSuggester';
import type { StructureSuggestionDTO } from 'shared-types';

/**
 * STRUCTURE_ASSIST — the READ-ONLY suggestion surface (STRUCTURE_ASSIST_DR.md §6.2/§6.3). Loads
 * the project's STORED book and runs the pure `StructureSuggester` over it, returning candidate
 * chapter boundaries. It NEVER mutates: applying a suggestion is a SEPARATE author action through
 * the existing `promoteToChapter` mutation route (`POST /:id/structure`). Returns `undefined` when
 * the project does not exist (the controller maps that to 404).
 */
export class SuggestStructureUseCase {
  private readonly suggester = new StructureSuggester();

  constructor(private readonly repository: ProjectRepository) {}

  async execute(id: string): Promise<StructureSuggestionDTO[] | undefined> {
    const project = await this.repository.findById(id);
    if (!project) return undefined;
    // The suggester is pure — it reads the book and returns an array; the invariant test proves
    // the book is byte-identical after this call (no mutation, no persistence).
    return this.suggester.suggest(project.book).map((s) => ({
      blockId: s.blockId,
      proposedTitle: s.proposedTitle,
      kind: s.kind,
      key: s.key,
      evidence: s.evidence,
    }));
  }
}
