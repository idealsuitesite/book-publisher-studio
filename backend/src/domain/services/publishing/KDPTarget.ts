import type { PublishingTarget } from '../../ports/PublishingTarget';
import type { Book } from '../../models/Book';
import type { RenderedOutputs, PublishingReport } from '../../models/PublishingReport';
import { Packaging } from '../Packaging';
import { SubmissionValidator } from '../SubmissionValidator';

// The only PublishingTarget implementation this sprint (Decision 6). A platform adapter, not a
// replacement for its collaborators (CTO requirement, Commit 3->4 review): it calls Packaging
// and SubmissionValidator exactly once each and shapes their combined output into a
// PublishingReport - it never re-validates, never mutates the PublishingBundle, never rebuilds
// metadata, never re-packages. Assembling `target`/`generatedAt`/`duration`/`summary` here (not
// in SubmissionValidator) is the one thing only a platform-aware caller can do -
// SubmissionValidator itself must never know the platform name it validated for (Decision 7).
export class KDPTarget implements PublishingTarget {
  constructor(
    private readonly packaging: Packaging,
    private readonly submissionValidator: SubmissionValidator
  ) {}

  prepare(book: Book, renderedOutputs: RenderedOutputs): PublishingReport {
    const startedAt = Date.now();

    const bundle = this.packaging.assemble(book, renderedOutputs);
    const issues = this.submissionValidator.validate({ book, bundle });

    const errorCount = issues.filter((issue) => issue.severity === 'ERROR').length;
    const warnings = issues.filter((issue) => issue.severity === 'WARNING').map((issue) => issue.message);
    const status = errorCount === 0 ? 'PASS' : 'FAIL';

    return {
      status,
      target: 'kdp',
      issues,
      warnings,
      artifacts: bundle.manifest.formatsIncluded,
      generatedAt: new Date(),
      duration: Date.now() - startedAt,
      summary: `${status} - ${errorCount} error${errorCount === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`,
    };
  }
}
