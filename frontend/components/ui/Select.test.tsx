import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './Select';

const LAYOUTS = [
  { value: 'letter', label: 'US Letter' },
  { value: 'a4', label: 'A4' },
  { value: 'kdp-6x9', label: 'KDP 6" x 9"' },
];

describe('Select', () => {
  it('is reachable by its label', () => {
    render(<Select label="Page layout" options={LAYOUTS} />);
    expect(screen.getByLabelText('Page layout')).toBeInTheDocument();
  });

  it('renders every option', () => {
    render(<Select label="Page layout" options={LAYOUTS} />);
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('option', { name: 'A4' })).toBeInTheDocument();
  });

  it('lets a user choose an option', async () => {
    const user = userEvent.setup();
    render(<Select label="Page layout" options={LAYOUTS} />);

    await user.selectOptions(screen.getByLabelText('Page layout'), 'a4');

    expect(screen.getByLabelText('Page layout')).toHaveValue('a4');
  });

  it('is operable by keyboard — the native control provides this for free', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Select label="Page layout" options={LAYOUTS} onChange={onChange} />);

    await user.tab();

    expect(screen.getByLabelText('Page layout')).toHaveFocus();
  });

  it('renders a placeholder as a disabled leading option', () => {
    render(<Select label="Page layout" options={LAYOUTS} placeholder="Choose a layout" />);
    const placeholder = screen.getByRole('option', { name: 'Choose a layout' });
    expect(placeholder).toBeDisabled();
    expect(screen.getByLabelText('Page layout')).toHaveValue('');
  });

  it('supports disabled individual options', () => {
    render(
      <Select
        label="Page layout"
        options={[...LAYOUTS, { value: 'a3', label: 'A3', disabled: true }]}
      />
    );
    expect(screen.getByRole('option', { name: 'A3' })).toBeDisabled();
  });

  it('respects a controlled value without being overridden by the placeholder', () => {
    render(
      <Select
        label="Page layout"
        options={LAYOUTS}
        placeholder="Choose"
        value="a4"
        onChange={() => {}}
      />
    );
    expect(screen.getByLabelText('Page layout')).toHaveValue('a4');
  });

  it('marks itself invalid and announces the error', () => {
    render(<Select label="Page layout" options={LAYOUTS} error="Pick a layout" />);
    expect(screen.getByLabelText('Page layout')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a layout');
  });

  it('describes itself with a hint', () => {
    render(<Select label="Page layout" options={LAYOUTS} hint="KDP sizes are print-ready" />);
    expect(screen.getByLabelText('Page layout')).toHaveAccessibleDescription(
      'KDP sizes are print-ready'
    );
  });

  it('does not change while disabled', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Select label="Page layout" options={LAYOUTS} disabled onChange={onChange} />);

    await user.click(screen.getByLabelText('Page layout'));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Page layout')).toBeDisabled();
  });
});
