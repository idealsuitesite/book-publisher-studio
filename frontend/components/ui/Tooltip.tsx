'use client';

import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { cx } from './cx';

export interface TooltipProps {
  /** The tooltip text. Required: a tooltip with nothing to say should not exist. */
  content: string;
  /** The element the tooltip describes. Must be focusable for keyboard users to ever see it. */
  children: ReactNode;
  className?: string;
  /** ms before showing. Radix's default (700) reads as "broken" during a demo; 300 tracks common practice. */
  delayDuration?: number;
}

/**
 * Tooltip on Radix (UI_FOUNDATION.md Decision 1). Deliberately the simplest API of the four:
 * one component, no compound parts, because every use is "this control needs a hint". Radix
 * owns hover/focus/touch semantics and aria-describedby wiring — and shows on keyboard focus,
 * not only hover, which is the half hand-rolled tooltips always miss.
 */
export function Tooltip({ content, children, className, delayDuration = 300 }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            sideOffset={6}
            className={cx(
              'rounded-md border border-app-border bg-app-surface px-2 py-1 text-xs text-app-text',
              className
            )}
          >
            {content}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
