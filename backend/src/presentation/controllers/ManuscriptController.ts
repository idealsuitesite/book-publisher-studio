import type { Request, Response, NextFunction } from 'express';
import type { ImportManuscriptUseCase } from '../../application/use-cases/ImportManuscriptUseCase';

export class ManuscriptController {
  constructor(private importManuscriptUseCase: ImportManuscriptUseCase) {}

  importManuscript = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    try {
      const response = await this.importManuscriptUseCase.execute({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
      });

      const status = response.report.status === 'success' ? 200 : 422;
      res.status(status).json(response);
    } catch (error) {
      next(error);
    }
  };
}
