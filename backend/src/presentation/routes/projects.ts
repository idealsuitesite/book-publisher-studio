import { Router } from 'express';
import express from 'express';
import type { ProjectsController } from '../controllers/ProjectsController';

export function projectRoutes(controller: ProjectsController): Router {
  const router = Router();

  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.patch('/:id/settings', express.json(), controller.patchSettings);
  // POST rather than GET for export: it renders on the server (real work, ADR-0041's measured
  // 598ms) and mirrors the existing manuscript export route's verb.
  router.post('/:id/export', controller.export);
  router.post('/:id/publish', controller.publish);
  // One generic, typed mutation command (STRUCTURE_EDITING.md Q4) — not a route per verb.
  router.post('/:id/structure', express.json(), controller.editStructure);

  return router;
}
