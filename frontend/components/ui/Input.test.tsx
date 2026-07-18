import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

describe('Input', () => {
  it('is reachable by its label — the association exists, not just the text', () => {
    render(<Input label="ISBN" />);
    expect(screen.getByLabelText('ISBN')).toBeInTheDocument();
  });

  it('keeps the label available to assistive technology when visually hidden', () => {
    render(<Input label="Search" labelHidden />);
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('accepts typed input', async () => {
    const user = userEvent.setup();
    render(<Input label="Title" />);

    await user.type(screen.getByLabelText('Title'), 'My Book');

    expect(screen.getByLabelText('Title')).toHaveValue('My Book');
  });

  it('describes itself with a hint rather than leaving it visually adjacent but unlinked', () => {
    render(<Input label="ISBN" hint="13 digits, no dashes" />);
    expect(screen.getByLabelText('ISBN')).toHaveAccessibleDescription('13 digits, no dashes');
  });

  it('marks itself invalid and announces the error', () => {
    render(<Input label="ISBN" error="Not a valid ISBN" />);
    const input = screen.getByLabelText('ISBN');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Not a valid ISBN');
    expect(screen.getByRole('alert')).toHaveTextContent('Not a valid ISBN');
  });

  it('is not marked invalid when there is no error', () => {
    render(<Input label="Title" />);
    expect(screen.getByLabelText('Title')).not.toHaveAttribute('aria-invalid');
  });

  it('links both hint and error at once', () => {
    render(<Input label="ISBN" hint="13 digits" error="Too short" />);
    expect(screen.getByLabelText('ISBN')).toHaveAccessibleDescription('13 digits Too short');
  });

  it('generates unique ids so two fields on one page never collide', () => {
    render(
      <>
        <Input label="First" />
        <Input label="Second" />
      </>
    );
    const first = screen.getByLabelText('First');
    const second = screen.getByLabelText('Second');
    expect(first.id).not.toBe(second.id);
  });

  it('does not accept input while disabled', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Input label="Locked" disabled onChange={onChange} />);

    await user.type(screen.getByLabelText('Locked'), 'nope');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Locked')).toBeDisabled();
  });

  it('forwards arbitrary input attributes', () => {
    render(<Input label="Email" type="email" placeholder="you@example.com" required />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toBeRequired();
  });
});
