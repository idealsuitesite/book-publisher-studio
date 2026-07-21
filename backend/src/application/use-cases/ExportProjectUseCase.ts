import type { ProjectRepository } from '../../domain/ports/ProjectRepository';
import type { LayoutSelector } from '../../domain/ports/LayoutSelector';
import type { ProjectService } from '../../domain/services/ProjectService';
import type { ExportManuscriptUseCase } from './ExportManuscriptUseCase';

export type ProjectExportFormat = 'docx' | 'pdf' | 'epub';

export interface ExportUseCasesByFormat {
  docx: ExportManuscriptUseCase;
  pdf: ExportManuscriptUseCase;
  epub: ExportManuscriptUseCase;
}

/**
 * Exports a project from its STORED book (HOME_WORKSPACE.md Decision 6).
 *
 * Until this existed, Preview/Export re-uploaded a browser-held `File` — which only works in
 * the session that imported it, and would silently break "Continuer un projet". Decision 6
 * moved export server-side; this use case renders the project's own manuscript.
 *
 * **It renders `project.book`, not the retained source bytes.** An earlier version re-parsed the
 * original upload on every export — correct while a book was import-only, but wrong the moment
 * manual structure editing landed: a reordered or renamed chapter is stored on `project.book`
 * (EditBookUseCase), and re-parsing the source silently discarded it, so the Structure station
 * and the export disagreed (STRUCTURE_EDITING.md §5/§9 — the defect and its history are recorded
 * in DECISIONS.md/TODO.md). The retained source still earns its keep for a future re-import at a
 * higher fidelity (`AGGREGATES_AND_PERSISTENCE.md` Q5); it is just no longer what we render.
 *
 * The layout and theme come from the PROJECT's settings — they were made stored properties
 * (ADR-0047) for exactly this moment. Callers change them via the settings endpoint, not by
 * smuggling per-request overrides that the project would then not remember.
 */
export class ExportProjectUseCase {
  constructor(
    private repository: ProjectRepository,
    private exporters: ExportUseCasesByFormat,
    private layoutSelector: LayoutSelector,
    private projectService: ProjectService
  ) {}

  async execute(projectId: string, format: ProjectExportFormat): Promise<Buffer | undefined> {
    const project = await this.repository.findById(projectId);
    if (!project) return undefined;

    const pageLayout = this.layoutSelector.select({ requestedLayoutName: project.settings.layoutName });
    return this.exporters[format].renderBook(
      this.projectService.currentBook(project),
      project.settings.themeName,
      pageLayout,
      project.settings.accentOverride
    );
  }
}
