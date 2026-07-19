import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('is reachable by its label', () => {
    render(<Textarea label="Description" />);
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  it('accepts multi-line input', async () => {
    const user = userEvent.setup();
    render(<Textarea label="Notes" />);

    await user.type(screen.getByLabelText('Notes'), 'line one{Enter}line two');

    expect(screen.getByLabelText('Notes')).toHaveValue('line one\nline two');
  });

  it('defaults to a usable height rather than a single row', () => {
    render(<Textarea label="Notes" />);
    expect(screen.getByLabelText('Notes')).toHaveAttribute('rows', '4');
  });

  it('honours an explicit row count', () => {
    render(<Textarea label="Notes" rows={10} />);
    expect(screen.getByLabelText('Notes')).toHaveAttribute('rows', '10');
  });

  it('describes itself with a hint', () => {
    render(<Textarea label="Description" hint="Shown on the book's detail page" />);
    expect(screen.getByLabelText('Description')).toHaveAccessibleDescription(
      "Shown on the book's detail page"
    );
  });

  it('marks itself invalid and announces the error', () => {
    render(<Textarea label="Description" error="Too long" />);
    expect(screen.getByLabelText('Description')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Too long');
  });

  it('keeps the label available when visually hidden', () => {
    render(<Textarea label="Notes" labelHidden />);
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('generates unique ids so two fields never collide', () => {
    render(
      <>
        <Textarea label="One" />
        <Textarea label="Two" />
      </>
    );
    expect(screen.getByLabelText('One').id).not.toBe(screen.getByLabelText('Two').id);
  });
});
