import { Router } from 'express';
import { uploadManuscript } from '../middleware/validationMiddleware';
import type { ExportController } from '../controllers/ExportController';

export function exportRoutes(controller: ExportController): Router {
  const router = Router();

  router.post('/export', uploadManuscript, controller.exportManuscript);

  return router;
}
