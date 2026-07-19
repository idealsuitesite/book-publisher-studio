import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog, DialogTrigger, DialogContent, DialogClose } from './Dialog';
import { Button } from './Button';

function dialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open settings</Button>
      </DialogTrigger>
      <DialogContent title="Export settings" description="Choose how the book is produced.">
        <label htmlFor="isbn-field">ISBN</label>
        <input id="isbn-field" />
        <DialogClose asChild>
          <Button variant="secondary">Cancel</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

describe('Dialog', () => {
  it('renders nothing until opened', () => {
    render(dialog());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens from the trigger with a real dialog role and its required accessible name', async () => {
    const user = userEvent.setup();
    render(dialog());

    await user.click(screen.getByRole('button', { name: 'Open settings' }));

    const modal = screen.getByRole('dialog', { name: 'Export settings' });
    expect(modal).toHaveAccessibleDescription('Choose how the book is produced.');
  });

  it('closes on Escape and returns focus to the trigger - the behaviour hand-rolled modals lose', async () => {
    const user = userEvent.setup();
    render(dialog());
    const trigger = screen.getByRole('button', { name: 'Open settings' });

    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes from an explicit close control', async () => {
    const user = userEvent.setup();
    render(dialog());

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('traps Tab inside while open', async () => {
    const user = userEvent.setup();
    render(dialog());
    await user.click(screen.getByRole('button', { name: 'Open settings' }));

    // Cycle far past the dialog's focusable count; focus must still be inside it.
    for (let i = 0; i < 5; i++) await user.tab();

    const modal = screen.getByRole('dialog');
    expect(modal.contains(document.activeElement)).toBe(true);
  });
});
