import type { Request, Response, NextFunction } from 'express';
import type { ExportManuscriptUseCase } from '../../application/use-cases/ExportManuscriptUseCase';
import { LetterPageLayout } from '../../domain/layouts/LetterPageLayout';

// ExportManuscriptUseCase is already renderer-agnostic (constructor-injected Renderer<Buffer>,
// per ADR-0012) - PDF support needed no new Use Case class, just a second instance configured
// with PDFRenderer instead of DOCXRenderer. The controller picks between them by format.
export type ExportFormat = 'docx' | 'pdf';

export interface ExportUseCasesByFormat {
  docx: ExportManuscriptUseCase;
  pdf: ExportManuscriptUseCase;
}

const CONTENT_TYPE: Record<ExportFormat, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
};

function resolveFormat(value: unknown): ExportFormat {
  return typeof value === 'string' && value.toLowerCase() === 'pdf' ? 'pdf' : 'docx';
}

export class ExportController {
  constructor(private useCases: ExportUseCasesByFormat) {}

  exportManuscript = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const themeName = typeof req.body.theme === 'string' && req.body.theme.length > 0 ? req.body.theme : 'classic';
    const format = resolveFormat(req.body.format);

    try {
      const buffer = await this.useCases[format].execute({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        themeName,
        pageLayout: LetterPageLayout,
      });

      res.setHeader('Content-Type', CONTENT_TYPE[format]);
      res.setHeader('Content-Disposition', `attachment; filename="export.${format}"`);
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };
}
