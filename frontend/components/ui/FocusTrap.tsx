'use client';

import { FocusScope } from '@radix-ui/react-focus-scope';
import type { ReactNode, Ref } from 'react';

export interface FocusTrapProps {
  /** Content Tab cycles within. Needs at least one focusable element to be meaningful. */
  children: ReactNode;
  /** Turn the trap off without unmounting - for panels that slide between modal and inline. */
  active?: boolean;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Standalone focus trap (UI_FOUNDATION.md Decision 1's fifth deliverable), on the same Radix
 * FocusScope that Dialog already uses internally — one trapping behaviour in the product, not
 * two subtly different ones.
 *
 * For anything modal, use Dialog: it traps AND restores focus, sets aria-modal, and handles
 * Escape. This exists for the narrower case — a non-modal surface that still must contain Tab
 * while open (a drawer over the canvas, an inline wizard step) — where reaching for Dialog
 * would drag modal semantics along with it.
 */
export function FocusTrap({ children, active = true, ...rest }: FocusTrapProps) {
  return (
    <FocusScope trapped={active} loop={active} {...rest}>
      {children}
    </FocusScope>
  );
}
