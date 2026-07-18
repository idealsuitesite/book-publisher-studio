import { describe, it, expect } from 'vitest';
import { getTheme, listThemeNames } from './getTheme';
import { ClassicTheme } from './ClassicTheme';

describe('getTheme', () => {
  it('returns the Classic theme by name', () => {
    expect(getTheme('classic')).toBe(ClassicTheme);
  });

  it('throws for an unknown theme name', () => {
    expect(() => getTheme('nonexistent')).toThrow(/Unknown theme/);
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
