import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ManuscriptOptionsDTO } from 'shared-types';
import { FormatSelector } from './FormatSelector';

const options: ManuscriptOptionsDTO = {
  themes: [{ name: 'classic', label: 'Classic' }],
  layouts: [
    { name: 'letter', label: 'US Letter', category: 'standard', widthPt: 612, heightPt: 792 },
    { name: 'a4', label: 'A4', category: 'standard', widthPt: 595.28, heightPt: 841.89 },
    { name: 'kdp-6x9', label: 'KDP 6" x 9"', category: 'kdp', widthPt: 432, heightPt: 648 },
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

  it('marks the selected preset as pressed', () => {
    setup({ selectedLayout: 'a4' });
    const pressed = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(2); // one layout + one theme
  });

  it('reports a layout change to the parent rather than holding state itself', async () => {
    const user = userEvent.setup();
    const { onLayoutChange } = setup();

    await user.click(screen.getByText('KDP 6" x 9"'));

    expect(onLayoutChange).toHaveBeenCalledWith('kdp-6x9');
  });

  it('presets are real buttons with pressed state - visual choice, keyboard operable', () => {
    // The radios died (PRODUCT_EXPERIENCE §4.3: presets, not radios). What replaces them must
    // still be operable: real <button>s with aria-pressed, focusable and Enter-activatable.
    setup();
    const buttons = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'));
    expect(buttons.length).toBeGreaterThan(2);
  });

  it('prints the REAL dimensions on the preset card - measured, never invented', () => {
    setup();
    // 432pt / 72 = 6in = 152.4mm; 648pt = 9in = 228.6mm.
    expect(screen.getByText(/152 × 229 mm · 6″ × 9″/)).toBeInTheDocument();
  });

  it('badges the KDP presets with their platform', () => {
    setup();
    expect(screen.getByText('KDP', { exact: true })).toBeInTheDocument();
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
