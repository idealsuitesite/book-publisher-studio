'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode, Ref } from 'react';
import { cx } from './cx';

/**
 * Modal dialog on Radix (UI_FOUNDATION.md Decision 1: focus management, Escape handling,
 * aria-modal, focus return to the trigger — exactly the accessibility that silently fails when
 * hand-rolled; Commit 0 measured this codebase at zero ARIA attributes, so none of it can be
 * assumed to appear by accident).
 *
 * `title` is a REQUIRED prop, same discipline as Input's required `label`: Radix only warns at
 * runtime when a dialog has no accessible name, and a warning nobody reads is how the screen
 * reader user ends up in an unnamed modal. The type system is the enforcement that works.
 */
export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export interface DialogContentProps {
  /** The dialog's accessible name, always rendered as a visible heading. */
  title: string;
  /** Optional supporting text, wired to aria-describedby when present. */
  description?: string;
  children?: ReactNode;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

export function DialogContent({ title, description, children, className, ...rest }: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 bg-black/50" />
      <RadixDialog.Content
        className={cx(
          'fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
          'rounded-2xl border-2 border-app-border-strong bg-app-surface p-6 text-app-text',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-text',
          className
        )}
        {...rest}
      >
        <RadixDialog.Title className="text-lg font-semibold">{title}</RadixDialog.Title>
        {description ? (
          <RadixDialog.Description className="mt-1 text-sm text-app-text-muted">
            {description}
          </RadixDialog.Description>
        ) : null}
        <div className="mt-4">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
