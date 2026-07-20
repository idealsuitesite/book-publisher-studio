import type { Request, Response, NextFunction } from 'express';
import type { ProjectRepository } from '../../domain/ports/ProjectRepository';
import type { ProjectService } from '../../domain/services/ProjectService';
import type { ProjectSummaryMapper } from '../../application/mappers/ProjectSummaryMapper';
import type { GetProjectUseCase } from '../../application/use-cases/GetProjectUseCase';
import type { ExportProjectUseCase, ProjectExportFormat } from '../../application/use-cases/ExportProjectUseCase';
import type { PublishProjectUseCase } from '../../application/use-cases/PublishProjectUseCase';
import type { PublishingReportMapper } from '../../application/mappers/PublishingReportMapper';
import type { EditBookUseCase, StructureMutation } from '../../application/use-cases/EditBookUseCase';
import type { ProjectListResponseDTO, UpdateProjectSettingsDTO } from 'shared-types';
import { UnknownThemeError } from '../../shared/errors/UnknownThemeError';
import { UnknownLayoutError } from '../../shared/errors/UnknownLayoutError';
import { ContentNotFoundError } from '../../shared/errors/ContentNotFoundError';

/** Validates an untrusted request body into a StructureMutation, or returns null. */
function parseMutation(body: unknown): StructureMutation | null {
  if (typeof body !== 'object' || body === null) return null;
  const m = body as Record<string, unknown>;
  if (m.type === 'reorderChapters' && typeof m.fromIndex === 'number' && typeof m.toIndex === 'number') {
    return { type: 'reorderChapters', fromIndex: m.fromIndex, toIndex: m.toIndex };
  }
  if (m.type === 'rename' && typeof m.id === 'string' && typeof m.title === 'string' && m.title.trim()) {
    return { type: 'rename', id: m.id, title: m.title };
  }
  if (m.type === 'restoreVersion' && typeof m.versionId === 'string' && m.versionId) {
    return { type: 'restoreVersion', versionId: m.versionId };
  }
  return null;
}

const EXPORT_CONTENT_TYPE: Record<ProjectExportFormat, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  epub: 'application/epub+zip',
};

const VALID_FORMATS = new Set<ProjectExportFormat>(['docx', 'pdf', 'epub']);

/**
 * The author's library and the Workspace's project operations (HOME_WORKSPACE.md §0).
 *
 * Still deliberately absent: delete (ADR-0044's CTO decision — no UI caller until persistence
 * is real) and archive (the control ships with the library UI that offers it).
 */
export class ProjectsController {
  constructor(
    private repository: ProjectRepository,
    private mapper: ProjectSummaryMapper,
    private getProject: GetProjectUseCase,
    private projectService: ProjectService,
    private exportProject: ExportProjectUseCase,
    private publishProject: PublishProjectUseCase,
    private publishingReportMapper: PublishingReportMapper,
    private editBook: EditBookUseCase
  ) {}

  /**
   * Applies a typed structure mutation (STRUCTURE_EDITING.md Q4: one generic command route).
   * Returns the fresh project DTO — re-fetched via GetProjectUseCase so validation recomputes
   * against the edited book (ADR-0027: validation stays read-only, never through the edit).
   */
  editStructure = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const mutation = parseMutation(req.body);
    if (!mutation) {
      res.status(400).json({ error: 'Invalid structure mutation', code: 'INVALID_MUTATION' });
      return;
    }
    try {
      const found = await this.editBook.execute(req.params.id, mutation);
      if (!found) {
        res.status(404).json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' });
        return;
      }
      res.json(await this.getProject.execute(req.params.id));
    } catch (error) {
      // A bad target INSIDE a real project (unknown chapter/section id, or unknown version) is a
      // client error, not a server fault — nameable, not a 500.
      if (error instanceof ContentNotFoundError) {
        res.status(400).json({ error: error.message, code: 'CONTENT_NOT_FOUND' });
        return;
      }
      if (error instanceof Error && error.message.startsWith('No such version')) {
        res.status(400).json({ error: error.message, code: 'VERSION_NOT_FOUND' });
        return;
      }
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const includeArchived = req.query.includeArchived === 'true';
      const summaries = await this.repository.list({ includeArchived });
      const body: ProjectListResponseDTO = { projects: summaries.map((s) => this.mapper.map(s)) };
      res.json(body);
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = await this.getProject.execute(req.params.id);
      if (!dto) {
        res.status(404).json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' });
        return;
      }
      res.json(dto);
    } catch (error) {
      next(error);
    }
  };

  patchSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const project = await this.repository.findById(req.params.id);
      if (!project) {
        res.status(404).json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' });
        return;
      }
      const body = req.body as UpdateProjectSettingsDTO;
      const patch: Partial<{ layoutName: string; themeName: string }> = {};
      if (typeof body.layoutName === 'string' && body.layoutName) patch.layoutName = body.layoutName;
      if (typeof body.themeName === 'string' && body.themeName) patch.themeName = body.themeName;

      const updated = this.projectService.updateSettings(project, patch);
      await this.repository.save(updated);
      res.json({ settings: { ...updated.settings } });
    } catch (error) {
      next(error);
    }
  };

  export = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const format = String(req.query.format ?? 'pdf').toLowerCase() as ProjectExportFormat;
    if (!VALID_FORMATS.has(format)) {
      res.status(400).json({ error: `Unknown format: ${format}`, code: 'UNKNOWN_FORMAT' });
      return;
    }
    try {
      const buffer = await this.exportProject.execute(req.params.id, format);
      if (!buffer) {
        res.status(404).json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' });
        return;
      }
      res.setHeader('Content-Type', EXPORT_CONTENT_TYPE[format]);
      res.setHeader('Content-Disposition', `attachment; filename="export.${format}"`);
      res.status(200).send(buffer);
    } catch (error) {
      if (error instanceof UnknownThemeError || error instanceof UnknownLayoutError) {
        next(error);
        return;
      }
      // ADR-0049 §3: the screen gets a nameable code; the REAL cause goes to the server log,
      // never swallowed into a generic string the user cannot act on.
      console.error(`Export failed for project ${req.params.id}:`, error);
      res.status(500).json({ error: 'The document could not be generated', code: 'RENDER_FAILED' });
    }
  };

  publish = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = await this.publishProject.execute(req.params.id);
      if (!report) {
        res.status(404).json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' });
        return;
      }
      res.status(200).json(this.publishingReportMapper.map(report));
    } catch (error) {
      if (error instanceof UnknownThemeError || error instanceof UnknownLayoutError) {
        next(error);
        return;
      }
      console.error(`Publish failed for project ${req.params.id}:`, error);
      res.status(500).json({ error: 'The publication could not be prepared', code: 'RENDER_FAILED' });
    }
  };
}
