import type { ReactNode } from 'react';
import { cx } from './cx';

/**
 * Shared label/hint/error scaffolding for Input, Textarea and Select.
 *
 * Extracted so the three controls cannot drift apart in how they associate a label, describe
 * themselves, or report an error — the parts that are invisible when correct and only surface
 * as an accessibility defect when they are not.
 */

export const FIELD_BASE =
  'w-full rounded-lg border-2 border-app-border bg-app-surface px-3 py-2 text-sm text-app-text ' +
  'placeholder:text-app-text-muted disabled:cursor-not-allowed disabled:opacity-50 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-text';

export interface FieldShellProps {
  id: string;
  label: string;
  labelHidden: boolean;
  hint?: string;
  hintId?: string;
  error?: string;
  errorId?: string;
  children: ReactNode;
}

export function FieldShell({
  id,
  label,
  labelHidden,
  hint,
  hintId,
  error,
  errorId,
  children,
}: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className={cx(
          'text-sm font-medium text-app-text',
          // Visually hidden but still announced. Not `hidden` or `display:none`, which would
          // remove it from the accessibility tree and defeat the purpose.
          labelHidden && 'sr-only'
        )}
      >
        {label}
      </label>

      {children}

      {hint && (
        <p id={hintId} className="text-xs text-app-text-muted">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-xs text-app-error">
          {error}
        </p>
      )}
    </div>
  );
}
