import { describe, it, expect } from 'vitest';
import { createValidationEngine } from './createValidationEngine';
import { createBook } from '../../models/Book';
import type { Chapter, Heading, Paragraph } from '../../models/Book';

function heading(level: 1 | 2 | 3 | 4 | 5 | 6, id: string, text = 'Heading'): Heading {
  return { type: 'heading', id, level, text };
}

function paragraph(id = 'p-1'): Paragraph {
  return { type: 'paragraph', id, text: 'Body text.' };
}

function chapter(content: (Heading | Paragraph)[]): Chapter {
  const now = new Date();
  return {
    type: 'chapter',
    id: 'c-1',
    number: 1,
    title: 'Chapter One',
    content,
    createdAt: now,
    updatedAt: now,
  };
}

describe('createValidationEngine', () => {
  it('wires all 8 Sprint 5 rules into a single ValidationEngine', () => {
    const engine = createValidationEngine();
    const book = createBook({ title: 'My Book', author: 'Jane Doe', language: 'en' }, [
      chapter([heading(1, 'h-1'), heading(3, 'h-2'), paragraph()]),
    ]);

    const report = engine.validate({ book });

    // StructuralRule: no error (title/author present, chapter has a title).
    // HeadingRule: H1 -> H3 skip.
    // MetadataRule + ComplianceRule: missing ISBN/description/cover.
    const codes = report.issues.map((i) => i.code);
    expect(codes).toContain('HEADING_LEVEL_SKIP');
    expect(codes).toContain('MISSING_ISBN');
    expect(codes).toContain('COMPLIANCE_MISSING_ISBN');
    expect(codes).toContain('MISSING_DESCRIPTION');
    expect(codes).toContain('MISSING_COVER_IMAGE');
    expect(report.isValid).toBe(true); // only WARNINGs above, no ERROR
  });

  it('produces a fully-passing report for a complete, well-formed book', () => {
    const engine = createValidationEngine();
    const book = createBook(
      {
        title: 'My Book',
        author: 'Jane Doe',
        language: 'en',
        isbn: '978-3-16-148410-0',
        description: 'A complete book.',
        coverImage: { type: 'image', id: 'cover', url: 'https://example.com/cover.png' },
      },
      [chapter([heading(1, 'h-1'), paragraph()])]
    );

    const report = engine.validate({ book });

    expect(report).toMatchObject({ isValid: true, errors: [], issues: [] });
    expect(report.score.overall).toBe(100);
  });

  it('flags a structural ERROR through StructuralRule and marks the report invalid', () => {
    const engine = createValidationEngine();
    const book = createBook({ title: '', author: 'Jane Doe', language: 'en' }, [chapter([paragraph()])]);

    const report = engine.validate({ book });

    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.code === 'MISSING_TITLE')).toBe(true);
  });
});
