import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { DocumentParseError } from '../../shared/errors/DocumentParseError';
import { UnknownThemeError } from '../../shared/errors/UnknownThemeError';

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 25MB)' : err.message;
    res.status(400).json({ error: message });
    return;
  }

  if (err instanceof Error && err.message === 'Only DOCX files are allowed') {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err instanceof DocumentParseError) {
    res.status(400).json({ error: 'The uploaded file could not be parsed as a DOCX document' });
    return;
  }

  if (err instanceof UnknownThemeError) {
    res.status(400).json({ error: err.message });
    return;
  }

  console.error('Unhandled error in request:', err);
  res.status(500).json({ error: 'Internal server error' });
}
