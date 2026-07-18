import { Router } from 'express';
import { uploadManuscript } from '../middleware/validationMiddleware';
import type { PublishController } from '../controllers/PublishController';

export function publishRoutes(controller: PublishController): Router {
  const router = Router();

  router.post('/publish', uploadManuscript, controller.publishManuscript);

  return router;
}
