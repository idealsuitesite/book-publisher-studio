import type { Book, QualityMetrics } from './Book';
import type { PaginatedBook } from './PaginatedBook';
import type { Theme } from './Theme';

// TRANSITIONAL: Record<string, unknown> is a placeholder, not the final shape.
// Reserved for future per-platform/per-profile rule configuration - no rule
// reads this yet (docs/architecture/diagrams/VALIDATION_ENGINE.md §6). Replace
// with a dedicated interface once a real rule needs specific fields here -
// don't add fields to this type speculatively in the meantime.
export type ValidationProfileConfig = Record<string, unknown>;

// TRANSITIONAL: Record<string, unknown> is a placeholder, not the final shape.
// Reserved for future rules that need to know what the target Renderer
// supports (e.g. embedded fonts, real pagination) - no rule reads this yet.
// Replace with a dedicated interface once a real rule needs specific fields.
export type RendererCapabilities = Record<string, unknown>;

/**
 * Input to ValidationEngine.validate() and every ValidationRule.evaluate().
 * Stabilizes the public API now (additive-only from here) so future
 * per-platform rule variants (`validationProfile`) don't force another
 * signature change - same pattern as StyledBook.blockTypography? (ADR-0022).
 *
 * `configuration`/`locale`/`theme`/`rendererCapabilities`/`validationProfile`
 * are reserved: no rule in Sprint 5 reads them. This is a disclosed, accepted
 * tradeoff (docs/architecture/diagrams/VALIDATION_ENGINE.md §7, risk 1), not
 * an oversight - if they end up unused past Sprint 6/7, that's worth revisiting.
 */
export interface ValidationContext {
  book: Book;
  paginated?: PaginatedBook;
  metrics?: QualityMetrics;
  configuration?: ValidationProfileConfig;
  locale?: string;
  theme?: Theme;
  rendererCapabilities?: RendererCapabilities;
  validationProfile?: 'kdp' | 'kobo' | 'epub' | 'academic' | 'magazine' | 'bible';
}
