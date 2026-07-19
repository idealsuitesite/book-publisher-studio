import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders its children and is reachable by role and name', () => {
    render(<Button>Generate preview</Button>);
    expect(screen.getByRole('button', { name: 'Generate preview' })).toBeInTheDocument();
  });

  it('applies the primary variant by default', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-app-text');
  });

  it('applies the secondary variant when asked', () => {
    render(<Button variant="secondary">Download</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-transparent');
    expect(button).not.toHaveClass('bg-app-text');
  });

  it('defaults to type="button" so it cannot accidentally submit a surrounding form', () => {
    render(<Button>Safe</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('still allows an explicit submit type', () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Click me</Button>);

    await user.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is operable by keyboard, not only by mouse', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Keyboard</Button>);

    await user.tab();
    expect(screen.getByRole('button')).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick while disabled', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button onClick={onClick} disabled>
        Busy
      </Button>
    );

    await user.click(screen.getByRole('button'));

    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('forwards arbitrary button attributes, so callers are never blocked by this wrapper', () => {
    render(
      <Button aria-label="Close" data-testid="x">
        ×
      </Button>
    );
    expect(screen.getByTestId('x')).toHaveAccessibleName('Close');
  });

  it('merges caller className rather than discarding it', () => {
    render(<Button className="w-full">Wide</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('w-full');
    expect(button).toHaveClass('rounded-lg');
  });
});
