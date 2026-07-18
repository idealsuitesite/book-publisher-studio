import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * The two variants are not invented — they are the two button styles the product already
 * uses: solid (PreviewPanel's "Generate preview") and outlined (ExportPanel's three download
 * buttons). No third variant is added until something real needs one.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-app-text text-app-surface border-2 border-app-text',
  secondary: 'bg-transparent text-app-text border-2 border-app-border-strong',
};

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-50 ' +
  // Focus must be visible: Commit 0 measured zero accessibility affordances across the whole
  // application, and an invisible focus ring is the defect keyboard users hit first.
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-text';

export function Button({ variant = 'primary', className, type, children, ...rest }: ButtonProps) {
  return (
    <button
      // Defaults to "button", not "submit": an unspecified type inside a form submits it,
      // which is the single most common accidental-form-submission bug.
      type={type ?? 'button'}
      className={cx(BASE, VARIANTS[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
}
