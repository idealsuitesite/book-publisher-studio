import type { TextareaHTMLAttributes, Ref } from 'react';
import { useId } from 'react';
import { cx } from './cx';
import { FIELD_BASE, FieldShell } from './field';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  /** Required, for the same structural reason as Input's — see Input.tsx. */
  label: string;
  labelHidden?: boolean;
  hint?: string;
  error?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({
  label,
  labelHidden = false,
  hint,
  error,
  className,
  rows = 4,
  ...rest
}: TextareaProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <FieldShell
      id={id}
      label={label}
      labelHidden={labelHidden}
      hint={hint}
      hintId={hintId}
      error={error}
      errorId={errorId}
    >
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(hintId, errorId) || undefined}
        className={cx(FIELD_BASE, error && 'border-app-error', className)}
        {...rest}
      />
    </FieldShell>
  );
}
