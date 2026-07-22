import { describe, it, expect } from 'vitest';
import { getTheme, resolveTheme } from './getTheme';
import { ClassicTheme } from './ClassicTheme';
import { ModernTheme } from './ModernTheme';

describe('resolveTheme typography override (MINI_DR_TYPOGRAPHY_TUNING)', () => {
  it('no overrides returns the theme IDENTICAL (the raw-bytes non-regression, extended)', () => {
    expect(resolveTheme('classic')).toBe(getTheme('classic'));
    expect(resolveTheme('classic', undefined, undefined)).toBe(getTheme('classic'));
  });

  it('"standard" is the theme\'s own designed default — untouched by construction (offset 0)', () => {
    const resolved = resolveTheme('classic', undefined, { preset: 'standard' });
    expect(resolved.fontSizes).toEqual(ClassicTheme.fontSizes);
    expect(resolved.fonts).toEqual(ClassicTheme.fonts);
  });

  it('presets map to the CTO\'s 10/11/12/13 window on every current theme (both ship body 11)', () => {
    expect(resolveTheme('classic', undefined, { preset: 'compact' }).fontSizes.body).toBe(10);
    expect(resolveTheme('classic', undefined, { preset: 'comfort' }).fontSizes.body).toBe(12);
    expect(resolveTheme('classic', undefined, { preset: 'large' }).fontSizes.body).toBe(13);
    expect(resolveTheme('modern', undefined, { preset: 'large' }).fontSizes.body).toBe(13);
  });

  it('heading and small sizes scale PROPORTIONALLY — the body/heading ratio is constant across presets', () => {
    const baseRatio = ClassicTheme.fontSizes.h1 / ClassicTheme.fontSizes.body;
    for (const preset of ['compact', 'standard', 'comfort', 'large'] as const) {
      const t = resolveTheme('classic', undefined, { preset });
      expect(t.fontSizes.h1 / t.fontSizes.body).toBeCloseTo(baseRatio, 10);
      expect(t.fontSizes.small / t.fontSizes.body).toBeCloseTo(ClassicTheme.fontSizes.small / ClassicTheme.fontSizes.body, 10);
    }
  });

  it('scaled sizes stay FRACTIONAL — rounding would drift the locked ratios (do not "clean up")', () => {
    const comfort = resolveTheme('classic', undefined, { preset: 'comfort' });
    expect(comfort.fontSizes.h1).toBeCloseTo((28 * 12) / 11, 10); // 30.545..., not 30 or 31
    expect(Number.isInteger(comfort.fontSizes.h1)).toBe(false);
  });

  it('font roles resolve to the themes\' own real font vocabulary, never the literal role word', () => {
    const paired = resolveTheme('classic', undefined, { bodyFont: 'sans', headingFont: 'serif' });
    expect(paired.fonts.body).toBe('Helvetica'); // → embedded Inter via the registry
    expect(paired.fonts.heading).toBe('Georgia'); // → embedded Gelasio
    // One role set leaves the other side the theme's own.
    const bodyOnly = resolveTheme('modern', undefined, { bodyFont: 'sans' });
    expect(bodyOnly.fonts.heading).toBe(ModernTheme.fonts.heading);
  });

  it('typography, accent and pairing compose — one seam, all overrides applied', () => {
    const t = resolveTheme('classic', '#1D4E68', { preset: 'large', bodyFont: 'sans' });
    expect(t.fontSizes.body).toBe(13);
    expect(t.fonts.body).toBe('Helvetica');
    expect(t.colors.accent).toBe('#1D4E68');
    // Non-overridden surfaces untouched.
    expect(t.spacing).toEqual(ClassicTheme.spacing);
    expect(t.fonts.heading).toBe(ClassicTheme.fonts.heading);
  });
});
