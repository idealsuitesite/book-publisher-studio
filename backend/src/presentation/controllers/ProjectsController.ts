import type { Request, Response, NextFunction } from 'express';
import type { ProjectRepository } from '../../domain/ports/ProjectRepository';
import type { ProjectSummaryMapper } from '../../application/mappers/ProjectSummaryMapper';
import type { ProjectListResponseDTO } from 'shared-types';

/**
 * The author's library. Read-only this sprint: no create (import IS create), no delete (CTO
 * decision, ADR-0044 — no UI caller until Project persistence is real), no archive endpoint yet
 * (archiving lands with the library UI that offers it, so the control and its consequence ship
 * together rather than an orphaned endpoint first).
 */
export class ProjectsController {
  constructor(
    private repository: ProjectRepository,
    private mapper: ProjectSummaryMapper
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const includeArchived = req.query.includeArchived === 'true';
      const summaries = await this.repository.list({ includeArchived });
      const body: ProjectListResponseDTO = { projects: summaries.map((s) => this.mapper.map(s)) };
      res.json(body);
    } catch (error) {
      next(error);
    }
  };
}
