import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from './Tooltip';
import { Button } from './Button';

describe('Tooltip', () => {
  it('shows on keyboard focus, not only hover - the half hand-rolled tooltips always miss', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Validates against KDP's real rules" delayDuration={0}>
        <Button variant="secondary">Validate</Button>
      </Tooltip>
    );

    await user.tab();

    expect(screen.getByRole('button', { name: /Validate/ })).toHaveFocus();
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument());
  });

  it('hides on Escape without disturbing focus', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Hint" delayDuration={0}>
        <Button variant="secondary">Target</Button>
      </Tooltip>
    );

    await user.tab();
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument());
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Target/ })).toHaveFocus();
  });
});
