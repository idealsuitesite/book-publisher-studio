import { Router } from 'express';
import type { ManuscriptOptionsController } from '../controllers/ManuscriptOptionsController';

export function optionsRoutes(controller: ManuscriptOptionsController): Router {
  const router = Router();

  router.get('/options', controller.getOptions);

  return router;
}
