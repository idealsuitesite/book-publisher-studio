import type { SelectHTMLAttributes, Ref } from 'react';
import { useId } from 'react';
import { cx } from './cx';
import { FIELD_BASE, FieldShell } from './field';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  /** Required, for the same structural reason as Input's — see Input.tsx. */
  label: string;
  labelHidden?: boolean;
  hint?: string;
  error?: string;
  options: SelectOption[];
  /** Optional leading placeholder, rendered as a disabled empty-value option. */
  placeholder?: string;
  ref?: Ref<HTMLSelectElement>;
}

/**
 * Wraps a NATIVE <select>, deliberately — this resolves the escalation flagged in ADR-0040
 * Correction 1, which warned that a fully accessible hand-rolled Select is closer in
 * difficulty to the headless group (Dialog, Popover, Menu, Tooltip) than to Button.
 *
 * That warning applies to a custom listbox: implementing roving focus, typeahead, screen
 * reader announcements and touch behaviour by hand is genuinely hard to get right. A native
 * <select> gets all of it from the browser for free, on every platform, including mobile's
 * native picker. The trade-off is that the dropdown list itself cannot be styled — which this
 * product does not currently need.
 *
 * If a future sprint needs a styled or multi-select listbox, that is the point to reach for a
 * headless library, and it should be a deliberate decision rather than an incremental slide
 * into hand-rolling one. Recorded here so the reasoning is not lost.
 */
export function Select({
  label,
  labelHidden = false,
  hint,
  error,
  options,
  placeholder,
  className,
  defaultValue,
  value,
  ...rest
}: SelectProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  // Only default an uncontrolled select to the placeholder; forcing it on a controlled one
  // would fight the caller's own value.
  const uncontrolledDefault =
    value === undefined && defaultValue === undefined && placeholder ? '' : defaultValue;

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
      <select
        id={id}
        value={value}
        defaultValue={uncontrolledDefault}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(hintId, errorId) || undefined}
        className={cx(FIELD_BASE, error && 'border-app-error', className)}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
