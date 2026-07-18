import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ManuscriptOptionsDTO } from 'shared-types';
import { FormatSelector } from './FormatSelector';

const options: ManuscriptOptionsDTO = {
  themes: [{ name: 'classic', label: 'Classic' }],
  layouts: [
    { name: 'letter', label: 'US Letter', category: 'standard' },
    { name: 'a4', label: 'A4', category: 'standard' },
    { name: 'kdp-6x9', label: 'KDP 6" x 9"', category: 'kdp' },
  ],
};

function setup(overrides: Partial<React.ComponentProps<typeof FormatSelector>> = {}) {
  const props = {
    options,
    selectedLayout: 'letter',
    selectedTheme: 'classic',
    onLayoutChange: vi.fn(),
    onThemeChange: vi.fn(),
    ...overrides,
  };
  render(<FormatSelector {...props} />);
  return props;
}

describe('FormatSelector', () => {
  it('renders every layout the backend offers', () => {
    setup();
    expect(screen.getByText('US Letter')).toBeInTheDocument();
    expect(screen.getByText('A4')).toBeInTheDocument();
    expect(screen.getByText('KDP 6" x 9"')).toBeInTheDocument();
  });

  it('groups layouts by category rather than listing them flat', () => {
    setup();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('Amazon KDP')).toBeInTheDocument();
  });

  it('marks the selected layout as checked', () => {
    setup({ selectedLayout: 'a4' });
    const radios = screen.getAllByRole('radio');
    const checked = radios.filter((r) => (r as HTMLInputElement).checked);
    expect(checked).toHaveLength(2); // one layout + one theme
  });

  it('reports a layout change to the parent rather than holding state itself', async () => {
    const user = userEvent.setup();
    const { onLayoutChange } = setup();

    await user.click(screen.getByText('KDP 6" x 9"'));

    expect(onLayoutChange).toHaveBeenCalledWith('kdp-6x9');
  });

  it('exposes real radio semantics, so the group is keyboard navigable', () => {
    setup();
    // Radios grouped by `name` are what give arrow-key navigation; a div-based fake would
    // render identically and be unusable by keyboard.
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBeGreaterThan(1);
    expect(radios.every((r) => r.getAttribute('name'))).toBe(true);
  });

  it('renders themes as well as layouts', () => {
    setup();
    expect(screen.getByText('Classic')).toBeInTheDocument();
  });

  it('survives an options payload with no layouts without crashing', () => {
    setup({ options: { themes: options.themes, layouts: [] } });
    expect(screen.getByText('Classic')).toBeInTheDocument();
  });
});
