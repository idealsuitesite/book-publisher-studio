import type { Request, Response, NextFunction } from 'express';
import type { ExportManuscriptUseCase } from '../../application/use-cases/ExportManuscriptUseCase';
import type { LayoutSelector } from '../../domain/ports/LayoutSelector';

// ExportManuscriptUseCase is already renderer-agnostic (constructor-injected Renderer<Buffer>,
// per ADR-0012) - PDF and EPUB support needed no new Use Case classes, just additional instances
// configured with PDFRenderer/EPUBRenderer instead of DOCXRenderer. The controller picks between
// them by format.
export type ExportFormat = 'docx' | 'pdf' | 'epub';

export interface ExportUseCasesByFormat {
  docx: ExportManuscriptUseCase;
  pdf: ExportManuscriptUseCase;
  epub: ExportManuscriptUseCase;
}

const CONTENT_TYPE: Record<ExportFormat, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  epub: 'application/epub+zip',
};

const VALID_FORMATS = new Set<ExportFormat>(['docx', 'pdf', 'epub']);

function resolveFormat(value: unknown): ExportFormat {
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  return VALID_FORMATS.has(normalized as ExportFormat) ? (normalized as ExportFormat) : 'docx';
}

export class ExportController {
  constructor(
    private useCases: ExportUseCasesByFormat,
    private layoutSelector: LayoutSelector
  ) {}

  exportManuscript = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const themeName = typeof req.body.theme === 'string' && req.body.theme.length > 0 ? req.body.theme : 'classic';
    const format = resolveFormat(req.body.format);
    const requestedLayoutName =
      typeof req.body.layout === 'string' && req.body.layout.length > 0 ? req.body.layout : undefined;

    try {
      const pageLayout = this.layoutSelector.select({ requestedLayoutName });
      const buffer = await this.useCases[format].execute({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        themeName,
        pageLayout,
      });

      res.setHeader('Content-Type', CONTENT_TYPE[format]);
      res.setHeader('Content-Disposition', `attachment; filename="export.${format}"`);
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };
}
