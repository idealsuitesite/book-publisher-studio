import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders its children', () => {
    render(<Card>panel body</Card>);
    expect(screen.getByText('panel body')).toBeInTheDocument();
  });

  it('is a plain container with no landmark when given no title', () => {
    render(<Card>anonymous</Card>);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('becomes a named landmark when given a title — the region violations Commit 0 measured', () => {
    render(<Card title="Validation">findings</Card>);
    expect(screen.getByRole('region', { name: 'Validation' })).toBeInTheDocument();
  });

  it('renders the title visibly by default', () => {
    render(<Card title="Structure">body</Card>);
    expect(screen.getByRole('heading', { name: 'Structure' })).toBeInTheDocument();
  });

  it('can hide the title visually while keeping the landmark name', () => {
    render(
      <Card title="Preview" titleHidden>
        body
      </Card>
    );
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Preview' })).toBeInTheDocument();
  });

  it('merges caller className rather than discarding it', () => {
    render(<Card className="max-w-xl">body</Card>);
    expect(screen.getByText('body')).toHaveClass('max-w-xl', 'rounded-2xl');
  });

  it('forwards arbitrary attributes', () => {
    render(<Card data-testid="card">body</Card>);
    expect(screen.getByTestId('card')).toBeInTheDocument();
  });
});
