import type { InputHTMLAttributes, Ref } from 'react';
import { useId } from 'react';
import { cx } from './cx';
import { FIELD_BASE, FieldShell } from './field';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /**
   * Required, not optional. An unlabelled input is the most common accessibility defect in
   * web forms, and Commit 0 found this application already had zero accessibility affordances
   * of any kind. Making the label part of the type means a caller cannot ship an unlabelled
   * field without the compiler stopping them — a structural guarantee rather than a review
   * convention.
   */
  label: string;
  /** Visually hides the label while keeping it available to assistive technology. */
  labelHidden?: boolean;
  /** Help text tied to the field via aria-describedby. */
  hint?: string;
  /** Error text. Sets aria-invalid and is announced. */
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

export function Input({
  label,
  labelHidden = false,
  hint,
  error,
  className,
  type = 'text',
  ...rest
}: InputProps) {
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
      <input
        id={id}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(hintId, errorId) || undefined}
        className={cx(FIELD_BASE, error && 'border-app-error', className)}
        {...rest}
      />
    </FieldShell>
  );
}
