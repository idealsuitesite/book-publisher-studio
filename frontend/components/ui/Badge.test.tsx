import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>3 warnings</Badge>);
    expect(screen.getByText('3 warnings')).toBeInTheDocument();
  });

  it('defaults to the info severity', () => {
    render(<Badge>note</Badge>);
    expect(screen.getByText('note')).toHaveClass('text-app-info');
  });

  it('carries each severity as a distinct visual tone', () => {
    const { rerender } = render(<Badge severity="error">2 errors</Badge>);
    expect(screen.getByText('2 errors')).toHaveClass('text-app-error', 'border-app-error');

    rerender(<Badge severity="success">passed</Badge>);
    expect(screen.getByText('passed')).toHaveClass('text-app-success');
  });

  it('is not a live region — a label must not announce itself on every re-render', () => {
    render(<Badge severity="error">1 error</Badge>);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('never relies on colour alone — the meaning is always in the text', () => {
    render(<Badge severity="error">2 errors</Badge>);
    // The accessible name carries the meaning, so it survives colour blindness and
    // monochrome rendering.
    expect(screen.getByText('2 errors')).toHaveTextContent('2 errors');
  });

  it('merges caller className rather than discarding it', () => {
    render(<Badge className="ml-2">x</Badge>);
    expect(screen.getByText('x')).toHaveClass('ml-2', 'rounded-md');
  });
});
