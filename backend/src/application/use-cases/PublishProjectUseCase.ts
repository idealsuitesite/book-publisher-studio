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

    const source = project.sourceAssetId
      ? project.assets.find((asset) => asset.id === project.sourceAssetId)
      : undefined;
    if (!source?.data) {
      throw new Error(`Project ${projectId} has no retained source to publish from`);
    }

    const withVersion = this.projectService.snapshot(project, 'publication');
    const version = withVersion.versions[withVersion.versions.length - 1];

    const pageLayout = this.layoutSelector.select({ requestedLayoutName: project.settings.layoutName });
    const report = await this.publisher.execute({
      buffer: source.data,
      filename: source.filename,
      themeName: project.settings.themeName,
      pageLayout,
    });

    const recorded = this.projectService.recordPublication(withVersion, report, version.id);
    await this.repository.save(recorded);

    return report;
  }
}
