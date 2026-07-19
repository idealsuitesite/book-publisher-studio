import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'link';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * The variants are not invented — they are the button styles the product already uses:
 * solid (PreviewPanel's "Generate preview"), outlined (ExportPanel's three download buttons),
 * and the underlined text action (BookStructureView's "Import another file", UploadDropzone's
 * "Try again"). No further variant is added until something real needs one.
 *
 * Commit 5 correction, caught by the byte-identical baseline rule: primary originally carried
 * `border-2 border-app-text`, which the product's real solid button does not have — the swap
 * would have grown every solid button by 4px. The primitive is corrected to its own stated
 * spec (the product's styles), not the components to the primitive.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-app-text text-app-text-inverse rounded-lg px-4 py-2',
  secondary: 'bg-transparent text-app-text border-2 border-app-border-strong rounded-lg px-4 py-2',
  // A text action, not a box: no padding, no radius — underline is the whole affordance.
  link: 'text-app-text underline underline-offset-4',
};

const BASE =
  'text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ' +
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
