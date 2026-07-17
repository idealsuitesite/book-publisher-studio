import { describe, it, expect } from 'vitest';
import { RuleRegistry } from './RuleRegistry';
import type { ValidationRule } from './ValidationRule';
import type { ValidationContext } from '../../models/ValidationContext';
import type { ValidationIssue } from '../../models/Book';

function stubRule(name: string, issues: ValidationIssue[] = []): ValidationRule {
  return {
    name,
    evaluate(_context: ValidationContext): ValidationIssue[] {
      return issues;
    },
  };
}

describe('RuleRegistry', () => {
  it('returns an empty array when nothing is registered', () => {
    const registry = new RuleRegistry();

    expect(registry.getAll()).toEqual([]);
  });

  it('returns a registered rule', () => {
    const registry = new RuleRegistry();
    const rule = stubRule('StubRule');

    registry.register(rule);

    expect(registry.getAll()).toEqual([rule]);
  });

  it('preserves registration order across multiple rules', () => {
    const registry = new RuleRegistry();
    const first = stubRule('First');
    const second = stubRule('Second');
    const third = stubRule('Third');

    registry.register(first);
    registry.register(second);
    registry.register(third);

    expect(registry.getAll().map((r) => r.name)).toEqual(['First', 'Second', 'Third']);
  });

  it('returns a defensive copy, not the internal array', () => {
    const registry = new RuleRegistry();
    registry.register(stubRule('First'));

    const snapshot = registry.getAll();
    snapshot.push(stubRule('Injected'));

    expect(registry.getAll()).toHaveLength(1);
  });
});
