import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { join } from 'node:path';
import { MammothParser } from '../infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../domain/services/ASTBuilder';
import { createValidationEngine } from '../domain/services/validation/createValidationEngine';
import { BookMetricsCalculator } from '../domain/services/BookMetricsCalculator';
import { BookMapper } from '../application/mappers/BookMapper';
import { ImportManuscriptUseCase } from '../application/use-cases/ImportManuscriptUseCase';
import { ExportManuscriptUseCase } from '../application/use-cases/ExportManuscriptUseCase';
import { ThemeEngine } from '../domain/services/ThemeEngine';
import { TypographyResolver } from '../domain/services/TypographyResolver';
import { LayoutEngine } from '../domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../infrastructure/fonts/PdfKitTextMeasurer';
import { ManualLayoutSelector } from '../domain/services/ManualLayoutSelector';
import { DOCXRenderer } from '../infrastructure/renderers/DOCXRenderer';
import { PDFRenderer } from '../infrastructure/renderers/PDFRenderer';
import { EPUBRenderer } from '../infrastructure/renderers/EPUBRenderer';
import { ManuscriptController } from './controllers/ManuscriptController';
import { ExportController } from './controllers/ExportController';
import { ManuscriptOptionsController } from './controllers/ManuscriptOptionsController';
import { PublishController } from './controllers/PublishController';
import { manuscriptRoutes } from './routes/manuscripts';
import { exportRoutes } from './routes/export';
import { optionsRoutes } from './routes/options';
import { publishRoutes } from './routes/publish';
import { errorHandler } from './middleware/errorHandler';
import { buildCorsOptions } from './middleware/corsOptions';
import { PublishingUseCase } from '../application/use-cases/PublishingUseCase';
import { PublishingReportMapper } from '../application/mappers/PublishingReportMapper';
import { createKDPTarget } from '../domain/services/publishing/createKDPTarget';
import { SqliteProjectRepository } from '../infrastructure/repositories/SqliteProjectRepository';
import { ProjectService } from '../domain/services/ProjectService';
import { BookEditingService } from '../domain/services/BookEditingService';
import { EditBookUseCase } from '../application/use-cases/EditBookUseCase';
import { ProjectSummaryMapper } from '../application/mappers/ProjectSummaryMapper';
import { ProjectsController } from './controllers/ProjectsController';
import { projectRoutes } from './routes/projects';
import { GetProjectUseCase } from '../application/use-cases/GetProjectUseCase';
import { ExportProjectUseCase } from '../application/use-cases/ExportProjectUseCase';
import { PublishProjectUseCase } from '../application/use-cases/PublishProjectUseCase';

export function createApp(): Express {
  const app: Express = express();

  app.use(cors(buildCorsOptions()));
  app.use(express.json());

  // The Project store — ONE instance for the whole app, because it IS the app's state.
  // Durable since Sprint 11 (PERSISTENCE.md, ADR-0048): SQLite on disk, so a restart is no
  // longer an act of data loss. Route tests get a fresh `:memory:` database per createApp() —
  // the same isolation the in-memory store gave them, from the real implementation.
  const databasePath =
    process.env.DATABASE_PATH ??
    (process.env.NODE_ENV === 'test' ? ':memory:' : join(process.cwd(), 'data', 'studio.db'));
  const projectRepository = new SqliteProjectRepository(databasePath);
  const projectService = new ProjectService();

  // Pagination measures with the renderer's own fonts (LAYOUT_FIDELITY.md Decision 6) - one
  // measurer, one measured LayoutEngine, shared across every export format exactly as
  // ThemeEngine/TypographyResolver already are. DOCX and EPUB reuse the PDF-metric pagination
  // knowingly: Word repaginates on open and EPUB reflows, so PDF is the only format whose
  // pagination is load-bearing (ADR-0045).
  const layoutEngine = new LayoutEngine(new PdfKitTextMeasurer());

  // New Application/Presentation pipeline (Book AST-based import)
  // Sprint 5: ValidationEngine (8 rules, docs/architecture/diagrams/
  // VALIDATION_ENGINE.md) replaces the structural-only BookValidator here -
  // BookValidator itself still exists, now used internally by StructuralRule.
  // Sprint 9 detour: a successful import now creates a Project around the book
  // (PRODUCT_OBJECT_MODEL.md — the project is the unit of work).
  const importManuscriptUseCase = new ImportManuscriptUseCase(
    new MammothParser(),
    new HtmlNormalizer(),
    new ASTBuilder(),
    createValidationEngine(),
    new BookMetricsCalculator(),
    new BookMapper(),
    projectService,
    projectRepository
  );
  const manuscriptController = new ManuscriptController(importManuscriptUseCase);
  app.use('/api/manuscripts', manuscriptRoutes(manuscriptController));

  // Sprint 2: Rendering pipeline (Theme Engine, Layout Engine, DOCX export)
  // Sprint 3A: PDF export reuses the same renderer-agnostic use case with PDFRenderer instead
  // Sprint 3B: EPUB export reuses it again with EPUBRenderer
  // Sprint 4: TypographyResolver runs between ThemeEngine and LayoutEngine (inline runs,
  // drop caps, smart quotes, heading keep-with-next) - same instance reused across all
  // three formats, matching ThemeEngine/LayoutEngine's own reuse
  const exportDocxUseCase = new ExportManuscriptUseCase(
    new MammothParser(),
    new HtmlNormalizer(),
    new ASTBuilder(),
    new ThemeEngine(),
    new TypographyResolver(),
    layoutEngine,
    new DOCXRenderer()
  );
  const exportPdfUseCase = new ExportManuscriptUseCase(
    new MammothParser(),
    new HtmlNormalizer(),
    new ASTBuilder(),
    new ThemeEngine(),
    new TypographyResolver(),
    layoutEngine,
    new PDFRenderer()
  );
  const exportEpubUseCase = new ExportManuscriptUseCase(
    new MammothParser(),
    new HtmlNormalizer(),
    new ASTBuilder(),
    new ThemeEngine(),
    new TypographyResolver(),
    layoutEngine,
    new EPUBRenderer()
  );
  // Sprint 6: ExportController resolves page layout via LayoutSelector instead of a
  // hardcoded LetterPageLayout constant (ADR-0029 Decision 5). ManualLayoutSelector is the
  // only implementation - wraps today's caller-by-name behavior, defaulting to Letter.
  const exportController = new ExportController(
    {
      docx: exportDocxUseCase,
      pdf: exportPdfUseCase,
      epub: exportEpubUseCase,
    },
    new ManualLayoutSelector()
  );
  app.use('/api/manuscripts', exportRoutes(exportController));

  // Sprint 8 (PUBLISHING_ENGINE.md Decision 4): a new route, never a field on /export -
  // PublishingUseCase reuses the same pipeline dependencies as exportPdfUseCase, plus KDPTarget
  // (createKDPTarget(), Commit 4) as the only PublishingTarget implementation this sprint.
  const publishUseCase = new PublishingUseCase(
    new MammothParser(),
    new HtmlNormalizer(),
    new ASTBuilder(),
    new ThemeEngine(),
    new TypographyResolver(),
    layoutEngine,
    new PDFRenderer(),
    createKDPTarget()
  );
  const publishController = new PublishController(publishUseCase, new ManualLayoutSelector(), new PublishingReportMapper());
  app.use('/api/manuscripts', publishRoutes(publishController));

  // The author's library and the Workspace's project operations (HOME_WORKSPACE.md section 0).
  // Export/publish here run from the STORED project source (Decision 6) through the SAME
  // pipeline instances the manuscript routes use - one pipeline, two entry points, no drift.
  const projectsController = new ProjectsController(
    projectRepository,
    new ProjectSummaryMapper(),
    new GetProjectUseCase(projectRepository, createValidationEngine(), new BookMetricsCalculator(), new BookMapper()),
    projectService,
    new ExportProjectUseCase(
      projectRepository,
      { docx: exportDocxUseCase, pdf: exportPdfUseCase, epub: exportEpubUseCase },
      new ManualLayoutSelector()
    ),
    new PublishProjectUseCase(projectRepository, projectService, publishUseCase, new ManualLayoutSelector()),
    new PublishingReportMapper(),
    new EditBookUseCase(projectRepository, projectService, new BookEditingService())
  );
  app.use('/api/projects', projectRoutes(projectsController));

  // Sprint 7 commit 2 (Decision 5): a real discovery endpoint, additive to Presentation only -
  // no Domain/Application change beyond the two additive, read-only list functions the
  // registries themselves now expose (getTheme.ts/ManualLayoutSelector.ts).
  const manuscriptOptionsController = new ManuscriptOptionsController();
  app.use('/api/manuscripts', optionsRoutes(manuscriptOptionsController));

  // Dev-only: resets the project store so the visual-baseline capture starts every viewport
  // run from a deterministic empty library. Imports create projects (ADR-0047), so without
  // this each capture run would see the accumulated state of every run before it and no two
  // baselines could ever match. ADR-0047's comment here predicted this route's death when
  // SQLite landed; PERSISTENCE.md §5 amended that — it survives, repointed at the durable
  // store, because the capture still needs its determinism. Never registered in production.
  if (process.env.NODE_ENV !== 'production') {
    app.post('/api/dev/reset-projects', (req: Request, res: Response) => {
      projectRepository.clear();
      res.json({ ok: true });
    });
  }

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'OK', message: 'Backend is running!' });
  });

  // Error handler must be registered last, after all routes
  app.use(errorHandler);

  return app;
}
