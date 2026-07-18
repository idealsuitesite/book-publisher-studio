import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressStepper } from './ProgressStepper';

const STEPS = [
  { label: 'Import', done: true },
  { label: 'Structure', done: true },
  { label: 'Validation', done: false },
];

describe('ProgressStepper', () => {
  it('renders every step label', () => {
    render(<ProgressStepper steps={STEPS} />);
    expect(screen.getByText('Import')).toBeInTheDocument();
    expect(screen.getByText('Validation')).toBeInTheDocument();
  });

  it('distinguishes done from not-done — the state is real, not decorative', () => {
    render(<ProgressStepper steps={STEPS} />);
    // ✓ for completed steps, ○ for pending ones. Two steps are done in this fixture.
    expect(screen.getAllByText('✓')).toHaveLength(2);
    expect(screen.getAllByText('○')).toHaveLength(1);
  });

  it('renders nothing but the container when given no steps', () => {
    render(<ProgressStepper steps={[]} />);
    expect(screen.queryByText('✓')).not.toBeInTheDocument();
  });

  it('reflects a fully completed flow', () => {
    render(<ProgressStepper steps={STEPS.map((s) => ({ ...s, done: true }))} />);
    expect(screen.getAllByText('✓')).toHaveLength(3);
    expect(screen.queryByText('○')).not.toBeInTheDocument();
  });
});
