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
    // A publication is an AUTOMATIC milestone (APPEND_ONLY_PERSISTENCE option 3 / DR D5) — kept forever,
    // exempt from any future pruning (D). The migration flags historical publications; this flags new
    // ones at birth, from the one label set both share (`AUTOMATIC_MILESTONE_LABELS`).
    const snapped = withVersion.versions[withVersion.versions.length - 1];
    const version: typeof snapped = { ...snapped, milestone: true };

    // Publishes `project.book`, not the retained source bytes — so a manual structure edit is
    // part of what KDP validates, and so publish and export render the exact same book (see
    // ExportProjectUseCase and STRUCTURE_EDITING.md §5/§9; defect recorded in DECISIONS.md).
    const pageLayout = this.layoutSelector.select({ requestedLayoutName: project.settings.layoutName });
    const report = await this.publisher.publishBook(
      this.projectService.currentBook(project),
      project.settings.themeName,
      pageLayout,
      project.settings.accentOverride,
      project.settings.typographyOverride
    );

    // The publication event rides on the head aggregate; the version is appended atomically with it
    // (DR D3) — save is head-only and never writes version rows.
    const recorded = this.projectService.recordPublication(withVersion, report, version.id);
    await this.repository.appendVersion(recorded, version);

    return report;
  }
}
