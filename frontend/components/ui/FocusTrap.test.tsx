import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FocusTrap } from './FocusTrap';
import { Button } from './Button';

describe('FocusTrap', () => {
  it('keeps Tab cycling inside the trapped region', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Button variant="secondary">Outside before</Button>
        <FocusTrap>
          <Button>First inside</Button>
          <Button>Second inside</Button>
        </FocusTrap>
        <Button variant="secondary">Outside after</Button>
      </>
    );

    // The trap takes focus on mount; cycle past its two elements repeatedly.
    for (let i = 0; i < 5; i++) {
      await user.tab();
      const name = document.activeElement?.textContent;
      expect(['First inside', 'Second inside']).toContain(name);
    }
  });

  it('lets focus move freely when inactive - the trap can be turned off without unmounting', async () => {
    const user = userEvent.setup();
    render(
      <>
        <FocusTrap active={false}>
          <Button>Inside</Button>
        </FocusTrap>
        <Button variant="secondary">Outside</Button>
      </>
    );

    // Start from inside the (inactive) trap, then Tab out. What matters is that focus CAN
    // leave - where it initially lands is FocusScope's mount behaviour, not the contract.
    screen.getByRole('button', { name: 'Inside' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus();
  });
});
