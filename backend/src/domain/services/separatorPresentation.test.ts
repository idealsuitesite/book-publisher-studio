import { describe, it, expect } from 'vitest';
import { resolveSeparatorStyle } from './separatorPresentation';
import type { Divider } from '../models/Book';
import type { Theme } from '../models/Theme';

const divider = (style?: Divider['style']): Divider => ({ type: 'divider', id: 'd1', ...(style ? { style } : {}) });
const themeWith = (sep?: 'rule' | 'asterisks' | 'space'): Theme =>
  ({ presentation: sep ? { separator: { style: sep } } : {} }) as unknown as Theme;

describe('resolveSeparatorStyle — the ONE separator resolution (D5, M3-C8)', () => {
  it('uses the THEME separator when the block has no explicit style', () => {
    expect(resolveSeparatorStyle(divider(), themeWith('rule'))).toBe('rule');
    expect(resolveSeparatorStyle(divider(), themeWith('asterisks'))).toBe('asterisks');
    expect(resolveSeparatorStyle(divider(), themeWith('space'))).toBe('space');
  });

  it('an explicit per-block Divider.style OVERRIDES the theme (author intent)', () => {
    expect(resolveSeparatorStyle(divider('asterisks'), themeWith('rule'))).toBe('asterisks');
    expect(resolveSeparatorStyle(divider('space'), themeWith('rule'))).toBe('space');
  });

  it("maps the block's legacy 'line' name to the theme vocabulary 'rule'", () => {
    expect(resolveSeparatorStyle(divider('line'), themeWith('asterisks'))).toBe('rule');
  });

  it("falls back to 'asterisks' for a theme that declares no separator (the prior PDF/DOCX default)", () => {
    expect(resolveSeparatorStyle(divider(), themeWith())).toBe('asterisks');
  });
});
