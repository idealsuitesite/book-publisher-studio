import { Router } from 'express';
import type { ProjectsController } from '../controllers/ProjectsController';

export function projectRoutes(controller: ProjectsController): Router {
  const router = Router();

  router.get('/', controller.list);

  return router;
}
