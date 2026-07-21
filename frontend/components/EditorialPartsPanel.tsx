'use client';

import { Card, cx } from '@/components/ui';
import { EDITORIAL_CATEGORIES, type DetectedEditorialPart, type EditorialPlacement } from '@/lib/editorialParts';

/**
 * The Proof as editorial control (MINI_DR_EDITORIAL_PARTS, Option A). A read-only presence/absence
 * panel: for each recognised editorial part, is it in the manuscript or not? Detected by canonical
 * title (bookFacts) — presentation only, ADR-0049 honest: it shows WHICH title each detection came
 * from and never moves, renames, or asserts anything the author can't see. It is the surface that
 * makes the corrected chapter count truthful rather than silent.
 */
interface EditorialPartsPanelProps {
  editorialParts: DetectedEditorialPart[];
}

const GROUPS: { placement: EditorialPlacement; label: string }[] = [
  { placement: 'front', label: 'Front matter' },
  { placement: 'back', label: 'Back matter' },
];

export function EditorialPartsPanel({ editorialParts }: EditorialPartsPanelProps) {
  const detected = new Map(editorialParts.map((part) => [part.key, part]));

  return (
    <Card className="flex max-w-2xl flex-col gap-4 px-8 py-6 text-left">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-lg font-semibold text-app-text">Editorial parts</h3>
        <span className="text-xs tabular-nums text-app-text-muted">{editorialParts.length} present</span>
      </div>
      <p className="text-xs text-app-text-muted">
        Detected from part titles — the manuscript is never moved or renamed.
      </p>

      {GROUPS.map((group) => (
        <div key={group.placement}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-app-text-muted">{group.label}</p>
          <dl className="flex flex-col gap-1">
            {EDITORIAL_CATEGORIES.filter((category) => category.placement === group.placement).map((category) => {
              const part = detected.get(category.key);
              return (
                <div key={category.key} className="flex items-baseline justify-between gap-4 text-sm">
                  <dt className={cx(part ? 'text-app-text' : 'text-app-text-muted')}>{category.label}</dt>
                  <dd
                    className={cx('min-w-0 truncate text-right text-xs', part ? 'font-medium text-app-text' : 'text-app-text-muted')}
                    title={part ? part.detectedTitle : undefined}
                  >
                    {part ? `“${part.detectedTitle}”` : '—'}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ))}
    </Card>
  );
}
