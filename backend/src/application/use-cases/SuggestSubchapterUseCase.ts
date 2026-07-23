import type { ProjectRepository } from '../../domain/ports/ProjectRepository';
import { SubchapterSuggester } from '../../domain/services/structureSubchapter/SubchapterSuggester';
import type { SubchapterSuggestionDTO } from 'shared-types';

/**
 * SUBCHAPTER_PROMOTION — the READ-ONLY suggestion surface (SUBCHAPTER_PROMOTION_DR §5). Loads the
 * project's STORED book and runs the pure `SubchapterSuggester`, returning candidate sub-sections
 * (recurring editorial markers). It NEVER mutates: applying a suggestion is a SEPARATE author action
 * through the `promoteToSubsection` mutation route. Returns `undefined` when the project does not
 * exist (the controller maps that to 404). The third member of the assist/cleanup surface family.
 */
export class SuggestSubchapterUseCase {
  private readonly suggester = new SubchapterSuggester();

  constructor(private readonly repository: ProjectRepository) {}

  async execute(id: string): Promise<SubchapterSuggestionDTO[] | undefined> {
    const project = await this.repository.findById(id);
    if (!project) return undefined;
    return this.suggester.suggest(project.book).map((s) => ({
      blockId: s.blockId,
      proposedTitle: s.proposedTitle,
      key: s.key,
      chapterId: s.chapterId,
      chapterTitle: s.chapterTitle,
    }));
  }
}
