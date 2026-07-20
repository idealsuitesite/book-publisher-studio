import type { ProjectRepository } from '../../domain/ports/ProjectRepository';
import type { LayoutSelector } from '../../domain/ports/LayoutSelector';
import type { ProjectService } from '../../domain/services/ProjectService';
import type { PublishingReport } from '../../domain/models/PublishingReport';
import type { PublishingUseCase } from './PublishingUseCase';

/**
 * Publishes a project from its STORED source, and — for the first time in this product — the
 * publication actually enters the project's history.
 *
 * Until now `ProjectService.recordPublication` and `snapshot` had no production caller: the
 * publish route was stateless, so "when did I last publish this book?" was answerable by the
 * Domain model and by nothing the user could reach. This use case closes that loop
 * (HOME_WORKSPACE.md §0, Publish and History stations):
 *
 *   1. snapshot the current manuscript+settings as a version — a publication should point at
 *      the exact content it shipped (`AGGREGATES_AND_PERSISTENCE.md` Q2's reasoning);
 *   2. run the real publishing pipeline from the stored source;
 *   3. record the attempt — PASS or FAIL, both on purpose (a rejection is exactly the history
 *      an author needs) — linked to that version;
 *   4. save the whole aggregate.
 */
export class PublishProjectUseCase {
  constructor(
    private repository: ProjectRepository,
    private projectService: ProjectService,
    private publisher: PublishingUseCase,
    private layoutSelector: LayoutSelector
  ) {}

  async execute(projectId: string): Promise<PublishingReport | undefined> {
    const project = await this.repository.findById(projectId);
    if (!project) return undefined;

    const withVersion = this.projectService.snapshot(project, 'publication');
    const version = withVersion.versions[withVersion.versions.length - 1];

    // Publishes `project.book`, not the retained source bytes — so a manual structure edit is
    // part of what KDP validates, and so publish and export render the exact same book (see
    // ExportProjectUseCase and STRUCTURE_EDITING.md §5/§9; defect recorded in DECISIONS.md).
    const pageLayout = this.layoutSelector.select({ requestedLayoutName: project.settings.layoutName });
    const report = await this.publisher.publishBook(
      this.projectService.currentBook(project),
      project.settings.themeName,
      pageLayout
    );

    const recorded = this.projectService.recordPublication(withVersion, report, version.id);
    await this.repository.save(recorded);

    return report;
  }
}
