'use client';

import * as RadixPopover from '@radix-ui/react-popover';
import type { ReactNode, Ref } from 'react';
import { cx } from './cx';

/**
 * Non-modal floating panel on Radix (UI_FOUNDATION.md Decision 1). Radix owns what is genuinely
 * hard here: anchored positioning with collision handling, dismissal on outside
 * interaction/Escape, and focus moving into the panel and back to the trigger.
 */
export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;

export interface PopoverContentProps {
  children?: ReactNode;
  className?: string;
  /** Distance from the trigger, in px. Radix's own default is 0, which visually glues panel to trigger. */
  sideOffset?: number;
  ref?: Ref<HTMLDivElement>;
}

export function PopoverContent({ children, className, sideOffset = 8, ...rest }: PopoverContentProps) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        sideOffset={sideOffset}
        className={cx(
          'rounded-lg border-2 border-app-border bg-app-surface p-4 text-sm text-app-text',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-text',
          className
        )}
        {...rest}
      >
        {children}
      </RadixPopover.Content>
    </RadixPopover.Portal>
  );
}
