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
  /**
   * Border colour meaning. 'success' is BookStructureView's emerald "import complete" state.
   * A prop rather than a className override because `cx` is a plain join — two border-colour
   * utilities in one class list resolve by stylesheet order, which is a coin flip, not an API.
   */
  tone?: 'default' | 'success';
  children: ReactNode;
}

// No padding in the base, deliberately (Commit 5): the real panels use px-8 with py-6 or py-8
// depending on density, and a baked-in p-6 would conflict with every one of them under a
// plain-join cx. Padding is the caller's, like layout always is.
//
// No background either — measured, not assumed: the original draft carried bg-app-surface
// (#ffffff), and the baseline diff lit up 845,581 pixels at exactly delta 5, the gap between
// white and the page's real zinc-50 canvas. The product's panels are transparent; a primitive
// exists to encode what the product does, not what a token diagram wished it did.
const BASE = 'w-full rounded-2xl border-2';

const TONES: Record<NonNullable<CardProps['tone']>, string> = {
  default: 'border-app-border',
  success: 'border-app-success',
};

export function Card({ title, titleHidden = false, tone = 'default', className, children, ...rest }: CardProps) {
  if (!title) {
    return (
      <div className={cx(BASE, TONES[tone], className)} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <section className={cx(BASE, TONES[tone], className)} aria-label={title} {...rest}>
      {!titleHidden && <h2 className="mb-4 text-lg font-medium text-app-text">{title}</h2>}
      {children}
    </section>
  );
}
