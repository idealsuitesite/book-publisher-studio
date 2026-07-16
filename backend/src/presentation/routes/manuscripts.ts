import { Router } from 'express';
import { uploadManuscript } from '../middleware/validationMiddleware';
import type { ManuscriptController } from '../controllers/ManuscriptController';

export function manuscriptRoutes(controller: ManuscriptController): Router {
  const router = Router();

  router.post('/import', uploadManuscript, controller.importManuscript);

  return router;
}
