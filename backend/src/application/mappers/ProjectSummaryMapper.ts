import type { ProjectSummary } from '../../domain/models/Project';
import type { ProjectSummaryDTO } from 'shared-types';

// Domain read model -> transport shape. Dates become ISO strings at this boundary and nowhere
// else, matching every other mapper's discipline (Domain objects never cross into Presentation,
// docs/CLAUDE.md non-negotiable 2).
export class ProjectSummaryMapper {
  map(summary: ProjectSummary): ProjectSummaryDTO {
    return {
      id: summary.id,
      name: summary.name,
      bookTitle: summary.bookTitle,
      author: summary.author,
      coverAssetId: summary.coverAssetId,
      versionCount: summary.versionCount,
      publishedTargets: summary.publishedTargets,
      archivedAt: summary.archivedAt?.toISOString(),
      updatedAt: summary.updatedAt.toISOString(),
    };
  }
}
