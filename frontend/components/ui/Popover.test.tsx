import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popover, PopoverTrigger, PopoverContent } from './Popover';
import { Button } from './Button';

function popover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary">Page details</Button>
      </PopoverTrigger>
      <PopoverContent>
        <p>Trim 6×9 in, 214 pages</p>
      </PopoverContent>
    </Popover>
  );
}

describe('Popover', () => {
  it('is closed until triggered, and the trigger says so to assistive tech', () => {
    render(popover());
    expect(screen.getByRole('button', { name: 'Page details' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens on click and exposes its content', async () => {
    const user = userEvent.setup();
    render(popover());
    const trigger = screen.getByRole('button', { name: 'Page details' });

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Trim 6×9 in, 214 pages')).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(popover());
    const trigger = screen.getByRole('button', { name: 'Page details' });

    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByText('Trim 6×9 in, 214 pages')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
