import type { Request, Response, NextFunction } from 'express';
import type { PublishingUseCase } from '../../application/use-cases/PublishingUseCase';
import type { LayoutSelector } from '../../domain/ports/LayoutSelector';
import type { PublishingReportMapper } from '../../application/mappers/PublishingReportMapper';

export type PublishTarget = 'kdp';

const VALID_TARGETS = new Set<PublishTarget>(['kdp']);

function resolveTarget(value: unknown): PublishTarget | undefined {
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  return VALID_TARGETS.has(normalized as PublishTarget) ? (normalized as PublishTarget) : undefined;
}

// Presentation only (Decision 4/CTO's Commit 6 requirement): receive the request, call
// PublishingUseCase, map the response, return the DTO. Knows no KDP rule, builds no
// PublishingBundle, calls neither KDPTarget/SubmissionValidator/Packaging directly - those are
// PublishingUseCase's job (Commit 5), reached only through the one execute() call below.
// Unlike ExportController's format defaulting, `target` has no reasonable default - there is no
// "default platform" - so an unknown/missing target is a real 400, not a silent fallback.
export class PublishController {
  constructor(
    private useCase: PublishingUseCase,
    private layoutSelector: LayoutSelector,
    private mapper: PublishingReportMapper
  ) {}

  publishManuscript = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const target = resolveTarget(req.body.target);
    if (!target) {
      res.status(400).json({ error: 'Unknown or missing publishing target' });
      return;
    }

    const themeName = typeof req.body.theme === 'string' && req.body.theme.length > 0 ? req.body.theme : 'classic';
    const requestedLayoutName =
      typeof req.body.layout === 'string' && req.body.layout.length > 0 ? req.body.layout : undefined;

    try {
      const pageLayout = this.layoutSelector.select({ requestedLayoutName });
      const report = await this.useCase.execute({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        themeName,
        pageLayout,
      });

      res.status(200).json(this.mapper.map(report));
    } catch (error) {
      next(error);
    }
  };
}
