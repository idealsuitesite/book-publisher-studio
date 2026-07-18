import express, { Express, Request, Response } from 'express';
import cors from 'cors';
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
import { InMemoryProjectRepository } from '../infrastructure/repositories/InMemoryProjectRepository';
import { ProjectService } from '../domain/services/ProjectService';
import { ProjectSummaryMapper } from '../application/mappers/ProjectSummaryMapper';
import { ProjectsController } from './controllers/ProjectsController';
import { projectRoutes } from './routes/projects';

export function createApp(): Express {
  const app: Express = express();

  app.use(cors(buildCorsOptions()));
  app.use(express.json());

  // The Project store — ONE instance for the whole app, because it IS the app's state.
  // This is the first place the backend deliberately holds state between requests, by explicit
  // CTO direction (ADR-0047): Sprint 7 Decision 2 (stateless) is now amended in code, not just
  // in principle. In-memory means nothing survives a restart — disclosed in the class itself —
  // and the durable store (SQLite, ADR-0046) stays gated behind Sprint 11's review.
  const projectRepository = new InMemoryProjectRepository();
  const projectService = new ProjectService();

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

  // The author's library — read-only this sprint (see ProjectsController for what is
  // deliberately absent and why).
  const projectsController = new ProjectsController(projectRepository, new ProjectSummaryMapper());
  app.use('/api/projects', projectRoutes(projectsController));

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
    new LayoutEngine(),
    new DOCXRenderer()
  );
  const exportPdfUseCase = new ExportManuscriptUseCase(
    new MammothParser(),
    new HtmlNormalizer(),
    new ASTBuilder(),
    new ThemeEngine(),
    new TypographyResolver(),
    new LayoutEngine(),
    new PDFRenderer()
  );
  const exportEpubUseCase = new ExportManuscriptUseCase(
    new MammothParser(),
    new HtmlNormalizer(),
    new ASTBuilder(),
    new ThemeEngine(),
    new TypographyResolver(),
    new LayoutEngine(),
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
    new LayoutEngine(),
    new PDFRenderer(),
    createKDPTarget()
  );
  const publishController = new PublishController(publishUseCase, new ManualLayoutSelector(), new PublishingReportMapper());
  app.use('/api/manuscripts', publishRoutes(publishController));

  // Sprint 7 commit 2 (Decision 5): a real discovery endpoint, additive to Presentation only -
  // no Domain/Application change beyond the two additive, read-only list functions the
  // registries themselves now expose (getTheme.ts/ManualLayoutSelector.ts).
  const manuscriptOptionsController = new ManuscriptOptionsController();
  app.use('/api/manuscripts', optionsRoutes(manuscriptOptionsController));

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'OK', message: 'Backend is running!' });
  });

  // Error handler must be registered last, after all routes
  app.use(errorHandler);

  return app;
}
