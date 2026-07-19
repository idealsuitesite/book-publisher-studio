import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { DocumentParseError } from '../../shared/errors/DocumentParseError';
import { UnknownThemeError } from '../../shared/errors/UnknownThemeError';
import { UnknownLayoutError } from '../../shared/errors/UnknownLayoutError';

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  // Every branch names its error with a code (ADR-0049 / IMPORT_FIDELITY §3): a screen may
  // only show an error it can name. `error` stays the human string existing consumers read.
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 25MB)' : err.message;
    res.status(400).json({ error: message, code: 'UPLOAD_REJECTED' });
    return;
  }

  if (err instanceof Error && err.message === 'Only DOCX files are allowed') {
    res.status(400).json({ error: err.message, code: 'UPLOAD_REJECTED' });
    return;
  }

  if (err instanceof DocumentParseError) {
    // 422, not 400: the transport was fine — the FILE is the problem, and the UI's recovery
    // action is "fix your file and re-import" (IMPORT_FIDELITY §3).
    res.status(422).json({ error: 'This file could not be read as a manuscript', code: 'IMPORT_PARSE_FAILED' });
    return;
  }

  if (err instanceof UnknownThemeError) {
    res.status(400).json({ error: err.message, code: 'UNKNOWN_OPTION' });
    return;
  }

  if (err instanceof UnknownLayoutError) {
    res.status(400).json({ error: err.message, code: 'UNKNOWN_OPTION' });
    return;
  }

  console.error('Unhandled error in request:', err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' });
}
