import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from './Menu';
import { Button } from './Button';

function menu(onExport = vi.fn()) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button>Actions</Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem onSelect={onExport}>Export PDF</MenuItem>
        <MenuItem>Export EPUB</MenuItem>
        <MenuSeparator />
        <MenuItem disabled>Delete</MenuItem>
      </MenuContent>
    </Menu>
  );
}

describe('Menu', () => {
  it('opens with real menu semantics - role menu, role menuitem', async () => {
    const user = userEvent.setup();
    render(menu());

    await user.click(screen.getByRole('button', { name: 'Actions' }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  });

  it('navigates by arrow key and activates with Enter - the WAI-ARIA pattern, not hover-only', async () => {
    const onExport = vi.fn();
    const user = userEvent.setup();
    render(menu(onExport));

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(menu());
    const trigger = screen.getByRole('button', { name: 'Actions' });

    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('marks a disabled item as disabled to assistive tech, not just visually', async () => {
    const user = userEvent.setup();
    render(menu());

    await user.click(screen.getByRole('button', { name: 'Actions' }));

    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute('data-disabled');
  });
});
