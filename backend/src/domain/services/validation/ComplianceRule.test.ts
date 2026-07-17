import { describe, it, expect } from 'vitest';
import { ComplianceRule } from './ComplianceRule';
import { createBook } from '../../models/Book';
import type { ValidationContext } from '../../models/ValidationContext';

describe('ComplianceRule', () => {
  const rule = new ComplianceRule();

  it('reports no issues when ISBN, title, and author are all set', () => {
    const book = createBook({ title: 'My Book', author: 'Jane Doe', language: 'en', isbn: '978-3-16-148410-0' }, []);

    expect(rule.evaluate({ book })).toEqual([]);
  });

  it('flags a missing ISBN as a WARNING referencing KDP', () => {
    const book = createBook({ title: 'My Book', author: 'Jane Doe', language: 'en' }, []);

    const issues = rule.evaluate({ book });

    expect(issues).toEqual([
      {
        code: 'COMPLIANCE_MISSING_ISBN',
        message: 'Amazon KDP requires an ISBN before a book can be published',
        location: 'metadata',
        severity: 'WARNING',
      },
    ]);
  });

  it('flags a missing title', () => {
    const book = createBook({ title: '', author: 'Jane Doe', language: 'en', isbn: '978-3-16-148410-0' }, []);

    expect(rule.evaluate({ book }).map((i) => i.code)).toEqual(['COMPLIANCE_MISSING_TITLE']);
  });

  it('flags a missing author', () => {
    const book = createBook({ title: 'My Book', author: '', language: 'en', isbn: '978-3-16-148410-0' }, []);

    expect(rule.evaluate({ book }).map((i) => i.code)).toEqual(['COMPLIANCE_MISSING_AUTHOR']);
  });

  it('treats a blank ISBN the same as a missing one', () => {
    const book = createBook({ title: 'My Book', author: 'Jane Doe', language: 'en', isbn: '   ' }, []);

    expect(rule.evaluate({ book }).some((i) => i.code === 'COMPLIANCE_MISSING_ISBN')).toBe(true);
  });

  it('reports all three issues when everything is missing', () => {
    const book = createBook({ title: '', author: '', language: 'en' }, []);

    const issues = rule.evaluate({ book });

    expect(issues.map((i) => i.code).sort()).toEqual([
      'COMPLIANCE_MISSING_AUTHOR',
      'COMPLIANCE_MISSING_ISBN',
      'COMPLIANCE_MISSING_TITLE',
    ]);
  });

  it('does not mutate its input context or book', () => {
    const book = createBook({ title: '', author: '', language: 'en' }, []);
    const context: ValidationContext = { book };
    const snapshotBefore = structuredClone(context);

    rule.evaluate(context);

    expect(context).toEqual(snapshotBefore);
  });
});
