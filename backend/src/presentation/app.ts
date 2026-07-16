import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { parseDocxFile } from '../services/docxParser';
import { MammothParser } from '../infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../domain/services/ASTBuilder';
import { BookValidator } from '../domain/services/BookValidator';
import { BookMetricsCalculator } from '../domain/services/BookMetricsCalculator';
import { BookMapper } from '../application/mappers/BookMapper';
import { ImportManuscriptUseCase } from '../application/use-cases/ImportManuscriptUseCase';
import { ExportManuscriptUseCase } from '../application/use-cases/ExportManuscriptUseCase';
import { ThemeEngine } from '../domain/services/ThemeEngine';
import { LayoutEngine } from '../domain/services/LayoutEngine';
import { DOCXRenderer } from '../infrastructure/renderers/DOCXRenderer';
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
  const importManuscriptUseCase = new ImportManuscriptUseCase(
    new MammothParser(),
    new HtmlNormalizer(),
    new ASTBuilder(),
    new BookValidator(),
    new BookMetricsCalculator(),
    new BookMapper()
  );
  const manuscriptController = new ManuscriptController(importManuscriptUseCase);
  app.use('/api/manuscripts', manuscriptRoutes(manuscriptController));

  // Sprint 2: Rendering pipeline (Theme Engine, Layout Engine, DOCX export)
  const exportManuscriptUseCase = new ExportManuscriptUseCase(
    new MammothParser(),
    new HtmlNormalizer(),
    new ASTBuilder(),
    new ThemeEngine(),
    new LayoutEngine(),
    new DOCXRenderer()
  );
  const exportController = new ExportController(exportManuscriptUseCase);
  app.use('/api/manuscripts', exportRoutes(exportController));

  // --- Legacy pipeline (kept as-is, unrelated decision pending) ---
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    },
  });

  const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
      if (
        file.mimetype ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.originalname.endsWith('.docx')
      ) {
        cb(null, true);
      } else {
        cb(new Error('Only DOCX files are allowed'));
      }
    },
  });

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'OK', message: 'Backend is running!' });
  });

  /**
   * @deprecated Legacy upload endpoint. Bypasses the Book AST pipeline entirely
   * (no ASTBuilder/HtmlNormalizer, raw paragraph extraction, untested). Superseded
   * by POST /api/manuscripts/import. Scheduled for removal in Sprint 3 — see
   * ADR-0011 in docs/DECISIONS.md.
   */
  app.post('/api/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const filePath = req.file.path;
      console.log('📁 Processing file:', filePath);

      const content = await parseDocxFile(filePath);
      console.log('✅ Parse successful, paragraphs:', content.paragraphs.length);

      fs.unlinkSync(filePath);

      res.json({
        success: true,
        data: content,
      });
    } catch (error: any) {
      console.error('❌ Error processing file:', error);
      res.status(500).json({
        error: error.message || 'Failed to process DOCX file',
      });
    }
  });

  // Error handler must be registered last, after all routes
  app.use(errorHandler);

  return app;
}
