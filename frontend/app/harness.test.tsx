import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

/**
 * Smoke test for the frontend test harness itself (Sprint 9 Commit 2).
 *
 * Deliberately tests NO product component. The `ui/` primitives arrive at Commit 3 and each
 * ships its own tests; this file only proves the harness works, so that when a real test fails
 * at Commit 3 the cause is the component, not the toolchain.
 *
 * It asserts the four things Decision 6 requires the harness to support - rendering, variants,
 * accessibility queries, and interactions - against throwaway components defined here.
 *
 * Delete this file once real component tests exist, or keep it as the canary that isolates
 * toolchain breakage from component breakage on a dependency upgrade. Either is defensible;
 * it is kept for now because a failing Commit-3 test with no harness canary is ambiguous.
 */

function Swatch({ tone }: { tone: 'default' | 'danger' }) {
  return <span data-testid="swatch" data-tone={tone} />;
}

function Counter() {
  const [n, setN] = useState(0);
  return (
    <button type="button" onClick={() => setN((v) => v + 1)}>
      Clicked {n} times
    </button>
  );
}

describe('frontend test harness', () => {
  it('renders a React component into jsdom', () => {
    render(<p>harness online</p>);
    expect(screen.getByText('harness online')).toBeInTheDocument();
  });

  it('distinguishes variants via props', () => {
    render(<Swatch tone="danger" />);
    expect(screen.getByTestId('swatch')).toHaveAttribute('data-tone', 'danger');
  });

  it('supports accessibility queries - the ones every ui/ primitive will be tested through', () => {
    render(
      <button type="button" aria-label="Close dialog">
        ×
      </button>
    );
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
  });

  it('supports real user interaction, not just synthetic dispatch', async () => {
    const user = userEvent.setup();
    render(<Counter />);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('button'));

    expect(screen.getByRole('button')).toHaveTextContent('Clicked 2 times');
  });

  it('supports keyboard interaction - the gap Commit 0 found across the whole application', async () => {
    const user = userEvent.setup();
    render(<Counter />);

    await user.tab();
    expect(screen.getByRole('button')).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('button')).toHaveTextContent('Clicked 1 times');
  });
});
