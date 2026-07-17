import type { Content, Block, InlineElement, Link } from '../../models/Book';
import type { ValidationRule } from './ValidationRule';
import type { ValidationContext } from '../../models/ValidationContext';
import type { ValidationIssue } from '../../models/Book';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isLink(inline: InlineElement): inline is Link {
  return inline.type === 'link';
}

/**
 * Syntactic hyperlink validation only - no network I/O, ever (ADR-0002,
 * Domain has zero infrastructure dependencies; CTO Decision 3, docs/
 * architecture/diagrams/VALIDATION_ENGINE.md §3). Real reachability
 * checking (HTTP HEAD/GET) is out of scope for this rule and would need a
 * new Infrastructure port if ever built.
 *
 * `URL` is a JS/Node runtime built-in, not an Infrastructure dependency in
 * the ADR-0002 sense (no I/O, no external system) - the same reasoning that
 * already lets Domain code use `Date`/`Math`/`JSON` freely elsewhere in this
 * codebase (e.g. Book.ts's generateId(), ASTBuilder's timestamps).
 *
 * Accepted as valid: http(s):// URLs, mailto: addresses, non-empty internal
 * anchors (#fragment). Rejected (ERROR - a broken link is a real, blocking
 * defect, not just a style nit): anything else, including an empty href.
 */
export class HyperlinkRule implements ValidationRule {
  readonly name = 'HyperlinkRule';

  evaluate(context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const checkBlock = (block: Block, location: string): void => {
      for (const link of this.collectLinks(block)) {
        if (!this.isValidLink(link.url)) {
          issues.push({
            code: 'BROKEN_HYPERLINK',
            message: `Link "${link.text}" has an invalid or empty URL: "${link.url}"`,
            location,
            severity: 'ERROR',
          });
        }
      }
    };

    const walkBlocks = (blocks: Block[], locationPrefix: string): void => {
      for (const block of blocks) {
        checkBlock(block, `${locationPrefix} > ${block.type} "${block.id}"`);
      }
    };
    const walkContent = (contents: Content[]): void => {
      for (const content of contents) {
        const label = content.type === 'chapter' ? `Chapter ${content.number}` : `Section "${content.title}"`;
        walkBlocks(content.content, label);
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

  private collectLinks(block: Block): Link[] {
    switch (block.type) {
      case 'heading':
      case 'paragraph':
      case 'quote':
      case 'scripture':
      case 'footnote':
        return (block.inlines ?? []).filter(isLink);
      case 'list':
        return (block.inlines ?? []).flatMap((itemInlines: InlineElement[]) => itemInlines.filter(isLink));
      default:
        return [];
    }
  }

  private isValidLink(url: string): boolean {
    const trimmed = url.trim();
    if (trimmed.length === 0) return false;

    if (trimmed.startsWith('#')) return trimmed.length > 1;
    if (trimmed.startsWith('mailto:')) return EMAIL_RE.test(trimmed.slice('mailto:'.length));

    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
