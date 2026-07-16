import { describe, it, expect } from 'vitest';
import { getTheme } from './getTheme';
import { ClassicTheme } from './ClassicTheme';

describe('getTheme', () => {
  it('returns the Classic theme by name', () => {
    expect(getTheme('classic')).toBe(ClassicTheme);
  });

  it('throws for an unknown theme name', () => {
    expect(() => getTheme('nonexistent')).toThrow(/Unknown theme/);
  });
});
