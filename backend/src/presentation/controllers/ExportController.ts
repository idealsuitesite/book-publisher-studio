import type { Request, Response, NextFunction } from 'express';
import type { ExportManuscriptUseCase } from '../../application/use-cases/ExportManuscriptUseCase';
import { LetterPageLayout } from '../../domain/layouts/LetterPageLayout';

const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export class ExportController {
  constructor(private exportManuscriptUseCase: ExportManuscriptUseCase) {}

  exportManuscript = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const themeName = typeof req.body.theme === 'string' && req.body.theme.length > 0 ? req.body.theme : 'classic';

    try {
      const buffer = await this.exportManuscriptUseCase.execute({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        themeName,
        pageLayout: LetterPageLayout,
      });

      res.setHeader('Content-Type', DOCX_CONTENT_TYPE);
      res.setHeader('Content-Disposition', 'attachment; filename="export.docx"');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };
}
