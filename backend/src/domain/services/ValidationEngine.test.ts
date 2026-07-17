import { describe, it, expect } from 'vitest';
import { ValidationEngine } from './ValidationEngine';
import { RuleRegistry } from './validation/RuleRegistry';
import type { ValidationRule } from './validation/ValidationRule';
import type { ValidationContext } from '../models/ValidationContext';
import type { ValidationIssue } from '../models/Book';
import { createBook } from '../models/Book';

function stubRule(name: string, issues: ValidationIssue[]): ValidationRule {
  return {
    name,
    evaluate(_context: ValidationContext): ValidationIssue[] {
      return issues;
    },
  };
}

function context(): ValidationContext {
  return { book: createBook({ title: 'My Book', author: 'Jane Doe', language: 'en' }, []) };
}

describe('ValidationEngine', () => {
  it('is valid with a perfect score when no rule is registered', () => {
    const engine = new ValidationEngine(new RuleRegistry());

    const report = engine.validate(context());

    expect(report).toMatchObject({ isValid: true, errors: [], warnings: [], issues: [] });
    expect(report.score.overall).toBe(100);
  });

  it('is invalid when any rule reports an ERROR issue', () => {
    const registry = new RuleRegistry();
    registry.register(
      stubRule('StubError', [{ code: 'STUB_ERROR', message: 'bad', location: 'x', severity: 'ERROR' }])
    );
    const engine = new ValidationEngine(registry);

    const report = engine.validate(context());

    expect(report.isValid).toBe(false);
    expect(report.errors).toEqual([{ code: 'STUB_ERROR', message: 'bad', location: 'x', suggestion: undefined }]);
    expect(report.warnings).toEqual([]);
  });

  it('stays valid when a rule reports only WARNING/INFO/SUGGESTION issues', () => {
    const registry = new RuleRegistry();
    registry.register(
      stubRule('StubSoft', [
        { code: 'STUB_WARNING', message: 'meh', location: 'x', severity: 'WARNING' },
        { code: 'STUB_INFO', message: 'fyi', location: 'x', severity: 'INFO' },
        { code: 'STUB_SUGGESTION', message: 'consider', location: 'x', severity: 'SUGGESTION' },
      ])
    );
    const engine = new ValidationEngine(registry);

    const report = engine.validate(context());

    expect(report.isValid).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([{ code: 'STUB_WARNING', message: 'meh', location: 'x', severity: 'warning' }]);
  });

  it('exposes every issue regardless of severity via the new issues array', () => {
    const registry = new RuleRegistry();
    registry.register(
      stubRule('StubAll', [
        { code: 'E', message: 'e', location: 'x', severity: 'ERROR' },
        { code: 'W', message: 'w', location: 'x', severity: 'WARNING' },
        { code: 'I', message: 'i', location: 'x', severity: 'INFO' },
        { code: 'S', message: 's', location: 'x', severity: 'SUGGESTION' },
      ])
    );
    const engine = new ValidationEngine(registry);

    const report = engine.validate(context());

    expect(report.issues).toHaveLength(4);
    expect(report.issues.map((i) => i.severity)).toEqual(['ERROR', 'WARNING', 'INFO', 'SUGGESTION']);
  });

  it('combines issues from every registered rule', () => {
    const registry = new RuleRegistry();
    registry.register(stubRule('First', [{ code: 'A', message: 'a', location: 'x', severity: 'WARNING' }]));
    registry.register(stubRule('Second', [{ code: 'B', message: 'b', location: 'x', severity: 'WARNING' }]));
    const engine = new ValidationEngine(registry);

    const report = engine.validate(context());

    expect(report.issues.map((i) => i.code)).toEqual(['A', 'B']);
  });

  it('lowers the score as blocking (ERROR/WARNING) issues accumulate, floored at 0', () => {
    const registry = new RuleRegistry();
    const manyIssues: ValidationIssue[] = Array.from({ length: 15 }, (_, i) => ({
      code: `ISSUE_${i}`,
      message: 'x',
      location: 'x',
      severity: 'ERROR' as const,
    }));
    registry.register(stubRule('Many', manyIssues));
    const engine = new ValidationEngine(registry);

    const report = engine.validate(context());

    expect(report.score.overall).toBe(0);
  });
});
