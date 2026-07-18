import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { SEVERITY_BORDER, SEVERITY_TEXT, type Severity } from './severity';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  severity?: Severity;
  children: ReactNode;
}

/**
 * A small inline label — a count or a status word beside other content.
 *
 * Unlike Alert this is NOT a live region: a badge is a label on something already present,
 * not an announcement, and marking every badge as live would make a screen reader read the
 * whole page aloud on any re-render. Colour alone never carries the meaning — the text inside
 * always states it, so the badge stays legible to anyone who cannot distinguish the tones.
 */
export function Badge({ severity = 'info', className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        SEVERITY_BORDER[severity],
        SEVERITY_TEXT[severity],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
