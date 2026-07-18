import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert } from './Alert';

describe('Alert', () => {
  it('renders its children', () => {
    render(<Alert>Import failed</Alert>);
    expect(screen.getByText('Import failed')).toBeInTheDocument();
  });

  it('defaults to the info severity', () => {
    render(<Alert>Heads up</Alert>);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('announces errors assertively — a failure should interrupt', () => {
    render(<Alert severity="error">Upload failed</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveClass('border-app-error');
  });

  it('announces warnings assertively too', () => {
    render(<Alert severity="warning">No cover image</Alert>);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('announces success politely — it should never interrupt', () => {
    render(<Alert severity="success">Export complete</Alert>);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveClass('border-app-success');
  });

  it('renders an optional title alongside the body', () => {
    render(
      <Alert severity="error" title="Import failed">
        The file could not be read.
      </Alert>
    );
    expect(screen.getByText('Import failed')).toBeInTheDocument();
    expect(screen.getByText('The file could not be read.')).toBeInTheDocument();
  });

  it('carries each severity as a distinct visual tone', () => {
    const { rerender } = render(<Alert severity="info">x</Alert>);
    expect(screen.getByRole('status')).toHaveClass('border-app-info');

    rerender(<Alert severity="warning">x</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('border-app-warning');
  });

  it('merges caller className rather than discarding it', () => {
    render(<Alert className="mt-4">x</Alert>);
    expect(screen.getByRole('status')).toHaveClass('mt-4', 'rounded-lg');
  });
});
