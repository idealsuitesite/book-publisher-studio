import { Router } from 'express';
import express from 'express';
import type { ProjectsController } from '../controllers/ProjectsController';

export function projectRoutes(controller: ProjectsController): Router {
  const router = Router();

  router.get('/', controller.list);
  router.get('/:id', controller.get);
  // STRUCTURE_ASSIST: read-only suggestion surface — never mutates (applying a suggestion is the
  // separate promoteToChapter mutation via POST /:id/structure).
  router.get('/:id/structure-suggestions', controller.suggestStructure);
  // STRUCTURE_CLEANUP: read-only cleanup surface — never mutates (applying a suggestion is the
  // separate collapseMarker mutation via POST /:id/structure).
  router.get('/:id/cleanup-suggestions', controller.suggestCleanup);
  // SUBCHAPTER_PROMOTION: read-only sub-section surface — never mutates (applying is the separate
  // promoteToSubsection mutation via POST /:id/structure).
  router.get('/:id/subchapter-suggestions', controller.suggestSubchapter);
  router.patch('/:id/settings', express.json(), controller.patchSettings);
  // POST rather than GET for export: it renders on the server (real work, ADR-0041's measured
  // 598ms) and mirrors the existing manuscript export route's verb.
  router.post('/:id/export', controller.export);
  // INCREMENTAL_RENDER (P1): render only the visible page range for the living Proof — GET (a read of
  // the stored book, no mutation), the range in the query string. See ProjectsController.renderRegion.
  router.get('/:id/region', controller.renderRegion);
  router.post('/:id/publish', controller.publish);
  // One generic, typed mutation command (STRUCTURE_EDITING.md Q4) — not a route per verb.
  router.post('/:id/structure', express.json(), controller.editStructure);

  return router;
}
