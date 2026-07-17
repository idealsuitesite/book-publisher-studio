import type { PageLayout } from '../models/PageLayout';
import type { LayoutSelectionCriteria, LayoutSelector } from '../ports/LayoutSelector';
import { LetterPageLayout } from '../layouts/LetterPageLayout';
import { A4PageLayout } from '../layouts/A4PageLayout';
import { A5PageLayout } from '../layouts/A5PageLayout';
import { KDP5x8PageLayout } from '../layouts/KDP5x8PageLayout';
import { KDP5_5x8_5PageLayout } from '../layouts/KDP5_5x8_5PageLayout';
import { KDP6x9PageLayout } from '../layouts/KDP6x9PageLayout';
import { UnknownLayoutError } from '../../shared/errors/UnknownLayoutError';

const LAYOUTS: Record<string, PageLayout> = {
  letter: LetterPageLayout,
  a4: A4PageLayout,
  a5: A5PageLayout,
  'kdp-5x8': KDP5x8PageLayout,
  'kdp-5.5x8.5': KDP5_5x8_5PageLayout,
  'kdp-6x9': KDP6x9PageLayout,
};

// Wraps today's existing caller-supplied-by-name behavior (ADR-0029 Decision 5) - the only
// LayoutSelector implementation this sprint. No requestedLayoutName reproduces ExportController's
// pre-Sprint-6 unconditional LetterPageLayout default exactly (no regression for existing callers).
// AutomaticLayoutSelector (content-driven selection) is a documented future adapter, not built.
export class ManualLayoutSelector implements LayoutSelector {
  select(criteria: LayoutSelectionCriteria): PageLayout {
    const name = criteria.requestedLayoutName ?? 'letter';
    const layout = LAYOUTS[name];
    if (!layout) {
      throw new UnknownLayoutError(`Unknown page layout: ${name}`);
    }
    return layout;
  }
}
