import type { ValidationRule } from './ValidationRule';

/**
 * Holds the set of rules ValidationEngine orchestrates. A thin, deliberately
 * dumb container - registration order is preserved (getAll() returns rules in
 * the order they were registered, so ValidationReport.issues reads in a
 * stable, predictable order) but the registry itself has no validation logic
 * and no knowledge of any specific rule (docs/architecture/diagrams/
 * VALIDATION_ENGINE.md §6).
 */
export class RuleRegistry {
  private rules: ValidationRule[] = [];

  register(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  getAll(): ValidationRule[] {
    return [...this.rules];
  }
}
