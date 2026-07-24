import type { ProjectRepository } from '../../domain/ports/ProjectRepository';
import type { ValidationEngine } from '../../domain/services/ValidationEngine';
import type { BookMetricsCalculator } from '../../domain/services/BookMetricsCalculator';
import type { BookMapper } from '../mappers/BookMapper';
import type { ProjectDTO } from 'shared-types';
import { buildImportReport } from '../mappers/ImportReportMapper';
import { mapEditorialSkeleton } from '../mappers/EditorialSkeletonMapper';

/**
 * Opens a project for the Workspace (HOME_WORKSPACE.md §0: `GET /api/projects/:id`).
 *
 * Validation is computed on read from the STORED book, never stored: a stored report could be
 * stale relative to the manuscript, and the Validation station's whole value is telling the
 * truth about the book as it is now. Recomputing is cheap (the same engine import runs) and
 * makes staleness structurally impossible.
 *
 * Returns a summary-shaped DTO, never the aggregate: versions carry no book snapshots and
 * assets carry no bytes — ADR-0046 measured what an aggregate weighs (45MB at 50 versions),
 * and that must never walk onto the wire.
 */
export class GetProjectUseCase {
  constructor(
    private repository: ProjectRepository,
    private validator: ValidationEngine,
    private metrics: BookMetricsCalculator,
    private bookMapper: BookMapper
  ) {}

  async execute(id: string): Promise<ProjectDTO | undefined> {
    const project = await this.repository.findById(id);
    if (!project) return undefined;

    const validation = this.validator.validate({ book: project.book });
    const versionNumbers = new Map(project.versions.map((v) => [v.id, v.number]));
    const source = project.sourceAssetId
      ? project.assets.find((asset) => asset.id === project.sourceAssetId)
      : undefined;

    return {
      id: project.id,
      name: project.name,
      book: this.bookMapper.map(project.book),
      skeleton: mapEditorialSkeleton(project.book),
      settings: { ...project.settings },
      report: buildImportReport(project.book, validation, this.metrics),
      sourceFilename: source?.filename,
      versions: project.versions.map((version) => ({
        id: version.id,
        number: version.number,
        label: version.label,
        createdAt: version.createdAt.toISOString(),
      })),
      publications: project.publications.map((event) => ({
        target: event.target,
        status: event.report.status,
        versionNumber: event.versionId ? versionNumbers.get(event.versionId) : undefined,
        occurredAt: event.occurredAt.toISOString(),
      })),
      updatedAt: project.updatedAt.toISOString(),
    };
  }
}
