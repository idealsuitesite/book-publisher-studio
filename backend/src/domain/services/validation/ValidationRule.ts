import type { ValidationContext } from '../../models/ValidationContext';
import type { ValidationIssue } from '../../models/Book';

/**
 * Contract every Validation Engine rule implements (Sprint 5,
 * docs/architecture/diagrams/VALIDATION_ENGINE.md). `evaluate()` must be pure -
 * ADR-0027 (Validation Engine Is Read-Only): a rule reads `context` and
 * returns findings, it never mutates `context.book`/`context.paginated` or
 * anything reachable from them. Every rule's own test suite asserts this by
 * deep-equality of the input before/after `evaluate()` (VALIDATION_ENGINE.md §9)
 * - the interface itself can't enforce purity at the type level, only by
 * convention plus that test discipline.
 */
export interface ValidationRule {
  readonly name: string;
  evaluate(context: ValidationContext): ValidationIssue[];
}
