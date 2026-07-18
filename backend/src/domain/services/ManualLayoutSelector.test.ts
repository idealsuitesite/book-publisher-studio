import { describe, it, expect } from 'vitest';
import { ManualLayoutSelector, listLayoutNames } from './ManualLayoutSelector';
import { LetterPageLayout } from '../layouts/LetterPageLayout';
import { A4PageLayout } from '../layouts/A4PageLayout';
import { A5PageLayout } from '../layouts/A5PageLayout';
import { KDP5x8PageLayout } from '../layouts/KDP5x8PageLayout';
import { KDP5_5x8_5PageLayout } from '../layouts/KDP5_5x8_5PageLayout';
import { KDP6x9PageLayout } from '../layouts/KDP6x9PageLayout';

describe('ManualLayoutSelector', () => {
  const selector = new ManualLayoutSelector();

  it('defaults to LetterPageLayout when no name is requested, reproducing pre-Sprint-6 behavior', () => {
    expect(selector.select({})).toBe(LetterPageLayout);
  });

  it('selects by name: letter', () => {
    expect(selector.select({ requestedLayoutName: 'letter' })).toBe(LetterPageLayout);
  });

  it('selects by name: a4', () => {
    expect(selector.select({ requestedLayoutName: 'a4' })).toBe(A4PageLayout);
  });

  it('selects by name: a5', () => {
    expect(selector.select({ requestedLayoutName: 'a5' })).toBe(A5PageLayout);
  });

  it('selects by name: kdp-5x8', () => {
    expect(selector.select({ requestedLayoutName: 'kdp-5x8' })).toBe(KDP5x8PageLayout);
  });

  it('selects by name: kdp-5.5x8.5', () => {
    expect(selector.select({ requestedLayoutName: 'kdp-5.5x8.5' })).toBe(KDP5_5x8_5PageLayout);
  });

  it('selects by name: kdp-6x9', () => {
    expect(selector.select({ requestedLayoutName: 'kdp-6x9' })).toBe(KDP6x9PageLayout);
  });

  it('throws UnknownLayoutError for an unrecognized name', () => {
    expect(() => selector.select({ requestedLayoutName: 'nonexistent' })).toThrow(/Unknown page layout/);
  });
});

describe('listLayoutNames', () => {
  const selector = new ManualLayoutSelector();

  it('returns every name select() itself recognizes, and nothing it does not', () => {
    const names = listLayoutNames();
    for (const name of names) {
      expect(() => selector.select({ requestedLayoutName: name })).not.toThrow();
    }
    expect(() => selector.select({ requestedLayoutName: 'nonexistent' })).toThrow(/Unknown page layout/);
  });

  it('includes every Sprint 6 preset', () => {
    expect(listLayoutNames()).toEqual(
      expect.arrayContaining(['letter', 'a4', 'a5', 'kdp-5x8', 'kdp-5.5x8.5', 'kdp-6x9'])
    );
  });
});
