import { ManualLayoutSelector } from '../../domain/services/ManualLayoutSelector';
import type { Request, Response } from 'express';
import type { ManuscriptOptionsDTO, ThemeOptionDTO, LayoutOptionDTO } from 'shared-types';
import { listThemeNames } from '../../domain/themes/getTheme';
import { listLayoutNames } from '../../domain/services/ManualLayoutSelector';

// Sprint 7 Decision 5 (docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md) -
// a real discovery endpoint, not hardcoded frontend names. The *names* come from the real
// registries (getTheme.ts/ManualLayoutSelector.ts's additive listThemeNames()/listLayoutNames(),
// commit 2) - never hand-duplicated here. Only the human-readable label and standard/kdp
// category are Presentation-layer display concerns, with a graceful fallback (the raw name)
// for any future registry entry this map hasn't been updated for yet - a missing label
// degrades the display, it never removes the option from the response.
const THEME_LABELS: Record<string, string> = {
  classic: 'Classic',
  modern: 'Modern',
  novel: 'Novel',
};

const LAYOUT_LABELS: Record<string, string> = {
  letter: 'US Letter',
  a4: 'A4',
  a5: 'A5',
  'kdp-5x8': 'KDP 5" x 8"',
  'kdp-5.5x8.5': 'KDP 5.5" x 8.5"',
  'kdp-6x9': 'KDP 6" x 9"',
};

function categoryFor(layoutName: string): LayoutOptionDTO['category'] {
  return layoutName.startsWith('kdp-') ? 'kdp' : 'standard';
}

export class ManuscriptOptionsController {
  getOptions = (_req: Request, res: Response): void => {
    const themes: ThemeOptionDTO[] = listThemeNames().map((name) => ({
      name,
      label: THEME_LABELS[name] ?? name,
    }));

    const selector = new ManualLayoutSelector();
    const layouts: LayoutOptionDTO[] = listLayoutNames().map((name) => {
      // Real dimensions from the same registry the export pipeline uses - the preset cards
      // draw true trim proportions from these (PRODUCT_EXPERIENCE §4.3).
      const layout = selector.select({ requestedLayoutName: name });
      return {
        name,
        label: LAYOUT_LABELS[name] ?? name,
        category: categoryFor(name),
        widthPt: layout.width,
        heightPt: layout.height,
      };
    });

    const response: ManuscriptOptionsDTO = { themes, layouts };
    res.status(200).json(response);
  };
}
