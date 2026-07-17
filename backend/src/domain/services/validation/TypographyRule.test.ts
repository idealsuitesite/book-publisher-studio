import { describe, it, expect } from 'vitest';
import { TypographyRule } from './TypographyRule';
import { createBook } from '../../models/Book';
import type { QualityMetrics } from '../../models/Book';
import type { ValidationContext } from '../../models/ValidationContext';

function metrics(overrides: Partial<QualityMetrics> = {}): QualityMetrics {
  return {
    wordCount: 1000,
    paragraphCount: 50,
    headingCount: 5,
    imageCount: 0,
    tableCount: 0,
    footnoteCount: 0,
    averageParagraphLength: 20,
    averageChapterLength: 200,
    readingTimeMinutes: 5,
    estimatedPageCount: 10,
    widowsAndOrphans: 5,
    inconsistentSpacing: 0,
    emptyHeadings: 0,
    averageHeadingDepth: 1.5,
    paragraphDensity: 5,
    lineDensity: 3,
    dropCaps: 0,
    ...overrides,
  };
}

function book() {
  return createBook({ title: 'T', author: 'A', language: 'en' }, []);
}

describe('TypographyRule', () => {
  const rule = new TypographyRule();

  it('reports no issues when the context has no metrics', () => {
    expect(rule.evaluate({ book: book() })).toEqual([]);
  });

  it('reports no issues for healthy metrics', () => {
    const issues = rule.evaluate({ book: book(), metrics: metrics() });

    expect(issues).toEqual([]);
  });

  it('flags empty headings as a WARNING', () => {
    const issues = rule.evaluate({ book: book(), metrics: metrics({ emptyHeadings: 2 }) });

    expect(issues).toEqual([
      { code: 'EMPTY_HEADINGS', message: '2 heading(s) have no text', location: 'book', severity: 'WARNING' },
    ]);
  });

  it('flags inconsistent spacing as a WARNING', () => {
    const issues = rule.evaluate({ book: book(), metrics: metrics({ inconsistentSpacing: 3 }) });

    expect(issues).toEqual([
      {
        code: 'INCONSISTENT_SPACING',
        message: "3 paragraph(s) override the theme's spacing",
        location: 'book',
        severity: 'WARNING',
      },
    ]);
  });

  it('flags an unusually high drop cap ratio as INFO', () => {
    const issues = rule.evaluate({
      book: book(),
      metrics: metrics({ paragraphCount: 20, dropCaps: 5 }), // 25%, above the 10% threshold
    });

    expect(issues).toEqual([
      {
        code: 'UNUSUAL_DROP_CAP_RATIO',
        message: '5 of 20 paragraphs have a drop cap - more than typically expected',
        location: 'book',
        severity: 'INFO',
      },
    ]);
  });

  it('does not flag a normal drop cap ratio (one per chapter-ish)', () => {
    const issues = rule.evaluate({
      book: book(),
      metrics: metrics({ paragraphCount: 100, dropCaps: 5 }), // 5%, below threshold
    });

    expect(issues).toEqual([]);
  });

  it('does not divide by zero when there are no paragraphs', () => {
    const issues = rule.evaluate({
      book: book(),
      metrics: metrics({ paragraphCount: 0, dropCaps: 0 }),
    });

    expect(issues).toEqual([]);
  });

  it('combines multiple issues from a single metrics object', () => {
    const issues = rule.evaluate({
      book: book(),
      metrics: metrics({ emptyHeadings: 1, inconsistentSpacing: 1, paragraphCount: 10, dropCaps: 5 }),
    });

    expect(issues.map((i) => i.code)).toEqual(['EMPTY_HEADINGS', 'INCONSISTENT_SPACING', 'UNUSUAL_DROP_CAP_RATIO']);
  });

  it('does not mutate its input context, book, or metrics', () => {
    const context: ValidationContext = { book: book(), metrics: metrics({ emptyHeadings: 1 }) };
    const snapshotBefore = structuredClone(context);

    rule.evaluate(context);

    expect(context).toEqual(snapshotBefore);
  });
});
