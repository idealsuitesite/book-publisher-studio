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
import { DOCXRenderer } from '../infrastructure/renderers/DOCXRenderer';
import { PDFRenderer } from '../infrastructure/renderers/PDFRenderer';
import { EPUBRenderer } from '../infrastructure/renderers/EPUBRenderer';
import { ManuscriptController } from './controllers/ManuscriptController';
import { ExportController } from './controllers/ExportController';
import { manuscriptRoutes } from './routes/manuscripts';
import { exportRoutes } from './routes/export';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Express {
  const app: Express = express();

  app.use(cors());
  app.use(express.json());

  // New Application/Presentation pipeline (Book AST-based import)
  // Sprint 5: ValidationEngine (8 rules, docs/architecture/diagrams/
  // VALIDATION_ENGINE.md) replaces the structural-only BookValidator here -
  // BookValidator itself still exists, now used internally by StructuralRule.
  const importManuscriptUseCase = new ImportManuscriptUseCase(
    new MammothParser(),
    new HtmlNormalizer(),
    new ASTBuilder(),
    createValidationEngine(),
    new BookMetricsCalculator(),
    new BookMapper()
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
  const exportController = new ExportController({
    docx: exportDocxUseCase,
    pdf: exportPdfUseCase,
    epub: exportEpubUseCase,
  });
  app.use('/api/manuscripts', exportRoutes(exportController));

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'OK', message: 'Backend is running!' });
  });

  // Error handler must be registered last, after all routes
  app.use(errorHandler);

  return app;
}
