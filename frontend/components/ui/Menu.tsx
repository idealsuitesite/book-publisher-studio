'use client';

import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import type { ComponentProps, ReactNode, Ref } from 'react';
import { cx } from './cx';

/**
 * Dropdown menu on Radix (UI_FOUNDATION.md Decision 1). The hard parts Radix owns: roving
 * tabindex, arrow-key navigation, typeahead, `role="menu"`/`menuitem` relationships, and focus
 * return — the full WAI-ARIA menu pattern, which is the single most intricate widget pattern in
 * the spec and the clearest case for not hand-rolling.
 */
export const Menu = RadixMenu.Root;
export const MenuTrigger = RadixMenu.Trigger;
export const MenuSeparator = (props: ComponentProps<typeof RadixMenu.Separator>) => (
  <RadixMenu.Separator className="my-1 h-px bg-app-border" {...props} />
);

export interface MenuContentProps {
  children?: ReactNode;
  className?: string;
  sideOffset?: number;
  ref?: Ref<HTMLDivElement>;
}

export function MenuContent({ children, className, sideOffset = 8, ...rest }: MenuContentProps) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        sideOffset={sideOffset}
        className={cx(
          'min-w-40 rounded-lg border-2 border-app-border bg-app-surface p-1 text-sm text-app-text',
          className
        )}
        {...rest}
      >
        {children}
      </RadixMenu.Content>
    </RadixMenu.Portal>
  );
}

export interface MenuItemProps extends Omit<ComponentProps<typeof RadixMenu.Item>, 'className'> {
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

export function MenuItem({ className, ...rest }: MenuItemProps) {
  return (
    <RadixMenu.Item
      className={cx(
        'cursor-default select-none rounded-md px-3 py-2 outline-none',
        // Highlight follows Radix's data attribute, which tracks keyboard focus as well as
        // hover - :hover alone would leave arrow-key navigation visually silent.
        'data-highlighted:bg-app-surface-raised',
        'data-disabled:pointer-events-none data-disabled:opacity-50',
        className
      )}
      {...rest}
    />
  );
}
