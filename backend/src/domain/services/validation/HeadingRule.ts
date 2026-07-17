import type { Content, Block } from '../../models/Book';
import { isHeading } from '../../models/Book';
import type { ValidationRule } from './ValidationRule';
import type { ValidationContext } from '../../models/ValidationContext';
import type { ValidationIssue } from '../../models/Book';

/**
 * Flags a heading level that skips one or more levels from the previous
 * heading in document order (H1 -> H3 with no H2 in between). Owns this
 * pattern exclusively - MissingRequiredStyleRule (commit 6) is scoped to
 * different structural patterns, per docs/architecture/diagrams/
 * VALIDATION_ENGINE.md §3 Decision 1.
 *
 * Headings are tracked as one continuous sequence across the whole book, not
 * reset per chapter/section - the simplest reading of the CTO's own example
 * ("Heading 1, Heading 3, but never Heading 2"), disclosed here rather than
 * silently choosing a per-chapter reset that isn't what was specified. The
 * very first heading in the book has nothing to compare against and is never
 * flagged, regardless of its level. A level *decreasing* (H3 back to H1) is
 * normal document structure, never flagged - only an *increase* of more than
 * one level triggers this rule.
 */
export class HeadingRule implements ValidationRule {
  readonly name = 'HeadingRule';

  evaluate(context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    let previousLevel: number | undefined;

    const walkBlocks = (blocks: Block[]): void => {
      for (const block of blocks) {
        if (!isHeading(block)) continue;

        if (previousLevel !== undefined && block.level > previousLevel + 1) {
          issues.push({
            code: 'HEADING_LEVEL_SKIP',
            message: `Heading level jumps from H${previousLevel} to H${block.level} ("${block.text}") without an intermediate level`,
            location: `Heading "${block.text}"`,
            severity: 'WARNING',
          });
        }

        previousLevel = block.level;
      }
    };

    const walkContent = (contents: Content[]): void => {
      for (const content of contents) {
        walkBlocks(content.content);
        if (content.type === 'chapter' && content.sections) {
          walkContent(content.sections as unknown as Content[]);
        } else if (content.type === 'section' && content.subsections) {
          walkContent(content.subsections as unknown as Content[]);
        }
      }
    };
    walkContent(context.book.mainContent);

    return issues;
  }
}
