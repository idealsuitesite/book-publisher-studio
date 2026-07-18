import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /**
   * Renders the card as a <section> with an accessible name. Commit 0's axe baseline found
   * `region` violations rising from 1 on the landing screen to 10 after import — every panel
   * added to the page was another unlandmarked region. Passing a title makes the card a real
   * landmark instead of another anonymous <div>.
   */
  title?: string;
  /** Visually hides the title while keeping it available to assistive technology. */
  titleHidden?: boolean;
  children: ReactNode;
}

const BASE = 'w-full rounded-2xl border-2 border-app-border bg-app-surface p-6';

export function Card({ title, titleHidden = false, className, children, ...rest }: CardProps) {
  if (!title) {
    return (
      <div className={cx(BASE, className)} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <section className={cx(BASE, className)} aria-label={title} {...rest}>
      {!titleHidden && <h2 className="mb-4 text-lg font-medium text-app-text">{title}</h2>}
      {children}
    </section>
  );
}
