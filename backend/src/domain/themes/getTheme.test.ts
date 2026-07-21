import { describe, it, expect } from 'vitest';
import { getTheme, listThemeNames, resolveTheme } from './getTheme';
import { ClassicTheme } from './ClassicTheme';

describe('getTheme', () => {
  it('returns the Classic theme by name', () => {
    expect(getTheme('classic')).toBe(ClassicTheme);
  });

  it('throws for an unknown theme name', () => {
    expect(() => getTheme('nonexistent')).toThrow(/Unknown theme/);
  });
});

describe('resolveTheme — per-project accent override (MINI_DR_PER_THEME_ACCENT)', () => {
  it('applies the override to ANY theme, including Classic (an explicit author choice)', () => {
    expect(resolveTheme('modern', '#AABBCC').colors.accent).toBe('#AABBCC');
    // Classic ships accent === text; an explicit override wins for it too (CTO point 1).
    expect(resolveTheme('classic', '#AABBCC').colors.accent).toBe('#AABBCC');
    expect(getTheme('classic').colors.accent).toBe('#000000'); // the registry theme is untouched
  });

  it('with no override returns the named theme unchanged — resolveTheme(name) === getTheme(name)', () => {
    // The raw-bytes routes pass no override; this identity is what keeps their behaviour untouched.
    expect(resolveTheme('classic')).toBe(getTheme('classic'));
    expect(resolveTheme('modern', undefined)).toBe(getTheme('modern'));
  });

  it('changes ONLY the accent — every geometry-bearing value is identical (R2-free)', () => {
    const base = getTheme('modern');
    const overridden = resolveTheme('modern', '#AABBCC');
    expect(overridden.fonts).toEqual(base.fonts);
    expect(overridden.fontSizes).toEqual(base.fontSizes);
    expect(overridden.spacing).toEqual(base.spacing); // spacing drives pagination — must not move
    expect(overridden.colors.text).toBe(base.colors.text);
  });

  it('still rejects an unknown theme name', () => {
    expect(() => resolveTheme('nonexistent', '#AABBCC')).toThrow(/Unknown theme/);
  });
});

describe('listThemeNames', () => {
  it('returns every name getTheme() itself recognizes, and nothing it does not', () => {
    const names = listThemeNames();
    for (const name of names) {
      expect(() => getTheme(name)).not.toThrow();
    }
    expect(() => getTheme('nonexistent')).toThrow(/Unknown theme/);
  });

  it('includes classic', () => {
    expect(listThemeNames()).toContain('classic');
  });
});
