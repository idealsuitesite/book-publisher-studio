import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { SEVERITY_BORDER, SEVERITY_TEXT, type Severity } from './severity';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  severity?: Severity;
  /** Short heading. Optional — an alert is often a single sentence. */
  title?: string;
  children: ReactNode;
}

/**
 * `error` and `warning` announce assertively because they report something that already went
 * wrong; `info` and `success` announce politely so they never interrupt what a screen-reader
 * user is currently reading. Both are `role="alert"`-adjacent live regions rather than silent
 * text, which is the difference between a sighted user seeing a failure and everyone seeing it.
 */
const LIVE: Record<Severity, 'assertive' | 'polite'> = {
  error: 'assertive',
  warning: 'assertive',
  info: 'polite',
  success: 'polite',
};

export function Alert({ severity = 'info', title, className, children, ...rest }: AlertProps) {
  return (
    <div
      role={LIVE[severity] === 'assertive' ? 'alert' : 'status'}
      aria-live={LIVE[severity]}
      className={cx('rounded-lg border-2 p-4 text-sm', SEVERITY_BORDER[severity], className)}
      {...rest}
    >
      {title && <p className={cx('mb-1 font-medium', SEVERITY_TEXT[severity])}>{title}</p>}
      <div className="text-app-text">{children}</div>
    </div>
  );
}
