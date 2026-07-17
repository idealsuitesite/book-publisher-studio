import type { Content, Chapter, Block } from '../../models/Book';
import { isChapter } from '../../models/Book';
import type { ValidationRule } from './ValidationRule';
import type { ValidationContext } from '../../models/ValidationContext';
import type { ValidationIssue } from '../../models/Book';

/**
 * Flags a chapter that reads as "only epigraph" - it contains at least one
 * Quote/Scripture block but never a Paragraph anywhere in its content
 * (including nested sections/subsections). INFO severity: this is a
 * stylistic observation, not necessarily wrong - some chapters are
 * legitimately all-epigraph (docs/architecture/diagrams/VALIDATION_ENGINE.md
 * §5 item 4).
 *
 * Scope locked to this one pattern for Sprint 5 (CTO direction, 2026-07-17;
 * reconfirmed on commit 6's approval, "strictly limit implementation to the
 * validated case"). Two other patterns the CTO named during the Design
 * Review are deliberately NOT implemented here - named and explained, not
 * silently dropped:
 *
 *   - TOC-without-H1 (a TableOfContents with no Heading level 1 anywhere to
 *     populate it) - feasible against today's Book model (FrontMatter.toc +
 *     Heading blocks both already exist), deferred only for scope/time.
 *
 *   - FootnoteReference-without-Footnote - NOT feasible today: no
 *     FootnoteReference inline element exists in Book.ts's InlineElement
 *     union, distinct from a Footnote block. Implementing this needs a
 *     Domain-model addition, out of a validation-rule commit's scope.
 *
 * Neither is registered as a stub rule that always returns []: a rule that
 * always passes is indistinguishable from "this was checked and is fine,"
 * which would misrepresent real coverage. This class and its doc comment are
 * the deliberate, discoverable record instead - see also VALIDATION_ENGINE.md
 * §3 Decision 1 and §7 risk 2.
 */
export class MissingRequiredStyleRule implements ValidationRule {
  readonly name = 'MissingRequiredStyleRule';

  evaluate(context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const content of context.book.mainContent) {
      if (!isChapter(content)) continue;

      const blocks = this.collectBlocks(content);
      const hasQuoteOrScripture = blocks.some((block) => block.type === 'quote' || block.type === 'scripture');
      const hasParagraph = blocks.some((block) => block.type === 'paragraph');

      if (hasQuoteOrScripture && !hasParagraph) {
        issues.push({
          code: 'CHAPTER_MISSING_BODY_TEXT',
          message: `Chapter "${content.title}" contains only quote/scripture blocks and no body text`,
          location: `Chapter ${content.number}`,
          severity: 'INFO',
        });
      }
    }

    return issues;
  }

  private collectBlocks(chapter: Chapter): Block[] {
    const blocks: Block[] = [...chapter.content];

    const walkSections = (sections?: Content[]): void => {
      for (const section of sections ?? []) {
        if (section.type !== 'section') continue;
        blocks.push(...section.content);
        walkSections(section.subsections as unknown as Content[]);
      }
    };
    walkSections(chapter.sections as unknown as Content[]);

    return blocks;
  }
}
