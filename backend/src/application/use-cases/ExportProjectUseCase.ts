import type { ProjectRepository } from '../../domain/ports/ProjectRepository';
import type { LayoutSelector } from '../../domain/ports/LayoutSelector';
import type { ExportManuscriptUseCase } from './ExportManuscriptUseCase';

export type ProjectExportFormat = 'docx' | 'pdf' | 'epub';

export interface ExportUseCasesByFormat {
  docx: ExportManuscriptUseCase;
  pdf: ExportManuscriptUseCase;
  epub: ExportManuscriptUseCase;
}

/**
 * Exports a project from its STORED source (HOME_WORKSPACE.md Decision 6).
 *
 * Until this existed, Preview/Export re-uploaded a browser-held `File` — which only works in
 * the session that imported it, and would silently break "Continuer un projet". The source
 * asset was retained precisely so work can resume (`AGGREGATES_AND_PERSISTENCE.md` Q5); this
 * is that retention earning its keep: the browser holds an id, the system holds the book.
 *
 * The layout and theme come from the PROJECT's settings — they were made stored properties
 * (ADR-0047) for exactly this moment. Callers change them via the settings endpoint, not by
 * smuggling per-request overrides that the project would then not remember.
 */
export class ExportProjectUseCase {
  constructor(
    private repository: ProjectRepository,
    private exporters: ExportUseCasesByFormat,
    private layoutSelector: LayoutSelector
  ) {}

  async execute(projectId: string, format: ProjectExportFormat): Promise<Buffer | undefined> {
    const project = await this.repository.findById(projectId);
    if (!project) return undefined;

    const source = project.sourceAssetId
      ? project.assets.find((asset) => asset.id === project.sourceAssetId)
      : undefined;
    if (!source?.data) {
      throw new Error(`Project ${projectId} has no retained source to export from`);
    }

    const pageLayout = this.layoutSelector.select({ requestedLayoutName: project.settings.layoutName });
    return this.exporters[format].execute({
      buffer: source.data,
      filename: source.filename,
      themeName: project.settings.themeName,
      pageLayout,
    });
  }
}
