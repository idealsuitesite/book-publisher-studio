import type { Request, Response, NextFunction } from 'express';
import type { ProjectRepository } from '../../domain/ports/ProjectRepository';
import type { ProjectService } from '../../domain/services/ProjectService';
import type { ProjectSummaryMapper } from '../../application/mappers/ProjectSummaryMapper';
import type { GetProjectUseCase } from '../../application/use-cases/GetProjectUseCase';
import type { ExportProjectUseCase, ProjectExportFormat } from '../../application/use-cases/ExportProjectUseCase';
import type { PublishProjectUseCase } from '../../application/use-cases/PublishProjectUseCase';
import type { PublishingReportMapper } from '../../application/mappers/PublishingReportMapper';
import type { EditBookUseCase } from '../../application/use-cases/EditBookUseCase';
import type { SuggestStructureUseCase } from '../../application/use-cases/SuggestStructureUseCase';
import type { SuggestCleanupUseCase } from '../../application/use-cases/SuggestCleanupUseCase';
import type { ProjectListResponseDTO, UpdateProjectSettingsDTO, StructureMutation, TitlePageDTO, CopyrightPageDTO, TypographyOverrideDTO } from 'shared-types';
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
  if (m.type === 'promoteToChapter' && typeof m.blockId === 'string' && m.blockId) {
    return { type: 'promoteToChapter', blockId: m.blockId };
  }
  if (m.type === 'mergeChapterIntoPrevious' && typeof m.chapterId === 'string' && m.chapterId) {
    return { type: 'mergeChapterIntoPrevious', chapterId: m.chapterId };
  }
  if (m.type === 'setPartRole' && typeof m.id === 'string' && m.id && (m.role === 'front' || m.role === 'back' || m.role === 'main')) {
    return { type: 'setPartRole', id: m.id, role: m.role };
  }
  // PART_LEVEL_STRUCTURE: whitelisted HERE, with route tests, at the same time as the dispatch —
  // the untrusted-body boundary is where setPartRole shipped its live-found gap (a unit-tested
  // handler behind an unwhitelisted route, MINI_DR_EDITORIAL_PLACEMENT); not repeated.
  if (m.type === 'insertPartOpener' && typeof m.index === 'number' && Number.isInteger(m.index) && typeof m.title === 'string' && m.title.trim()) {
    return { type: 'insertPartOpener', index: m.index, title: m.title };
  }
  if (m.type === 'removePartOpener' && typeof m.id === 'string' && m.id) {
    return { type: 'removePartOpener', id: m.id };
  }
  // STRUCTURE_CLEANUP commit 2: whitelisted here, with route tests, in the same commit as the
  // dispatch (the standing setPartRole lesson — the untrusted-body boundary is where the last live
  // gap shipped). The op's strict guard surfaces as the named CONTENT_NOT_FOUND at this boundary.
  if (m.type === 'collapseMarker' && typeof m.markerId === 'string' && m.markerId) {
    return { type: 'collapseMarker', markerId: m.markerId };
  }
  // MINI_DR_CALLOUTS commit 1: whitelisted here, with route tests, in the same commit as the
  // dispatch — the standing setPartRole lesson (the untrusted-body boundary is where the last
  // live gap shipped).
  if (m.type === 'setCallout' && typeof m.blockId === 'string' && m.blockId && typeof m.on === 'boolean') {
    return { type: 'setCallout', blockId: m.blockId, on: m.on };
  }
  // MINI_DR_SUBTITLE_FIELD commit 1: whitelisted here, with route tests, in the same commit as
  // the dispatch (the standing lesson, applied d'office). A3: the ops' refusals surface as the
  // named CONTENT_NOT_FOUND at this boundary — typed at both levels, never a 500 path.
  if (m.type === 'markAsSubtitle' && typeof m.blockId === 'string' && m.blockId) {
    return { type: 'markAsSubtitle', blockId: m.blockId };
  }
  if (m.type === 'clearSubtitle' && typeof m.chapterId === 'string' && m.chapterId) {
    return { type: 'clearSubtitle', chapterId: m.chapterId };
  }
  // MINI_DR_EDIT_FRONT_MATTER (Phase 3b): whitelisted with route tests in the same commit (the
  // standing setPartRole lesson). The route enforces the SHAPE and the non-emptiness the pure op
  // also requires — so the op's own throw stays defense-in-depth, never a 500 path.
  if (m.type === 'editFrontMatter') {
    const isTitlePatch = (v: unknown): v is TitlePageDTO | null | undefined => {
      if (v === undefined || v === null) return true;
      if (typeof v !== 'object') return false;
      // The WRITE path still requires a non-empty author (the product rule), even though the
      // transport type now allows an authorless page for READING (FOUNDER_TRAVERSAL defect 2).
      const { title, author } = v as TitlePageDTO;
      return typeof title === 'string' && title.trim() !== '' && typeof author === 'string' && author.trim() !== '';
    };
    const isCopyrightPatch = (v: unknown): v is CopyrightPageDTO | null | undefined =>
      v === undefined ||
      v === null ||
      (typeof v === 'object' && typeof (v as CopyrightPageDTO).text === 'string' && (v as CopyrightPageDTO).text.trim() !== '');

    // An edit that touches nothing is a malformed request, not a no-op to snapshot.
    if (isTitlePatch(m.titlePage) && isCopyrightPatch(m.copyrightPage) && !(m.titlePage === undefined && m.copyrightPage === undefined)) {
      return { type: 'editFrontMatter', titlePage: m.titlePage, copyrightPage: m.copyrightPage };
    }
    return null;
  }
  return null;
}

/** Validates an untrusted typographyOverride body: known enums only, at least one field set. */
function isValidTypographyOverride(v: unknown): v is TypographyOverrideDTO {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  const presetOk = o.preset === undefined || o.preset === 'compact' || o.preset === 'standard' || o.preset === 'comfort' || o.preset === 'large';
  const roleOk = (r: unknown) => r === undefined || r === 'serif' || r === 'sans';
  const hasAny = o.preset !== undefined || o.bodyFont !== undefined || o.headingFont !== undefined;
  return presetOk && roleOk(o.bodyFont) && roleOk(o.headingFont) && hasAny;
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
    private editBook: EditBookUseCase,
    private suggestStructureUseCase: SuggestStructureUseCase,
    private suggestCleanupUseCase: SuggestCleanupUseCase
  ) {}

  /**
   * STRUCTURE_CLEANUP — the READ-ONLY cleanup surface (STRUCTURE_CLEANUP_DR.md §6). A GET that
   * returns candidate marker collapses for an OVER-structured manuscript (empty `CHAPTER n` /
   * `INTRODUCTION` headings the author styled by hand). It NEVER mutates — applying a suggestion is
   * the separate `collapseMarker` mutation through `POST /:id/structure`. The invariant (§3) is
   * proven in the Domain suite: running the suggester leaves the book byte-identical.
   */
  suggestCleanup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const suggestions = await this.suggestCleanupUseCase.execute(req.params.id);
      if (!suggestions) {
        res.status(404).json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' });
        return;
      }
      res.json({ suggestions });
    } catch (error) {
      next(error);
    }
  };

  /**
   * STRUCTURE_ASSIST — the READ-ONLY suggestion surface (STRUCTURE_ASSIST_DR.md §6). A GET that
   * returns candidate chapter boundaries for a manuscript whose structure the author typed as
   * plain text. It NEVER mutates — applying a suggestion is the separate `promoteToChapter`
   * mutation through `POST /:id/structure` (already whitelisted in parseMutation). The invariant
   * (§3) is proven in the Domain suite: running the suggester leaves the book byte-identical.
   */
  suggestStructure = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const suggestions = await this.suggestStructureUseCase.execute(req.params.id);
      if (!suggestions) {
        res.status(404).json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' });
        return;
      }
      res.json({ suggestions });
    } catch (error) {
      next(error);
    }
  };

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
      const patch: Partial<{
        layoutName: string;
        themeName: string;
        accentOverride: string | undefined;
        typographyOverride: TypographyOverrideDTO | undefined;
      }> = {};
      if (typeof body.layoutName === 'string' && body.layoutName) patch.layoutName = body.layoutName;
      if (typeof body.themeName === 'string' && body.themeName) patch.themeName = body.themeName;
      // Accent override (MINI_DR_PER_THEME_ACCENT): a hex string SETS it, null/'' CLEARS it, omitted
      // leaves it. Only a FORMAT guard here (a valid hex) — the printability/contrast guard is a
      // deliberately deferred, named gap (TODO.md `ACCENT_CONTRAST_UNGUARDED`), since the author sees
      // the shade live in the Proof and fixes a too-light choice themselves.
      if (body.accentOverride !== undefined) {
        if (body.accentOverride === null || body.accentOverride === '') {
          patch.accentOverride = undefined;
        } else if (typeof body.accentOverride === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(body.accentOverride)) {
          patch.accentOverride = body.accentOverride;
        } else {
          res.status(400).json({ error: 'accentOverride must be a hex colour like #1D4E68', code: 'INVALID_SETTINGS' });
          return;
        }
      }

      // Typography override (MINI_DR_TYPOGRAPHY_TUNING): an object SETS it (enums validated —
      // preset name, logical font roles), null CLEARS it, omitted leaves it. Geometry-moving,
      // unlike the accent — the Proof's live re-ink is the CTO-chosen disclosure of the cost.
      if (body.typographyOverride !== undefined) {
        if (body.typographyOverride === null) {
          patch.typographyOverride = undefined;
        } else if (isValidTypographyOverride(body.typographyOverride)) {
          patch.typographyOverride = body.typographyOverride;
        } else {
          res.status(400).json({
            error: 'typographyOverride must carry a known preset (compact|standard|comfort|large) and/or serif|sans font roles',
            code: 'INVALID_SETTINGS',
          });
          return;
        }
      }

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
