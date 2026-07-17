import type { Content, Block, Image } from '../../models/Book';
import { isImage } from '../../models/Book';
import type { ValidationRule } from './ValidationRule';
import type { ValidationContext } from '../../models/ValidationContext';
import type { ValidationIssue } from '../../models/Book';

// Matches the existing doc comment on Image.dpi in Book.ts ("72 for screen,
// 300+ for print") - not a new number invented here.
const MINIMUM_PRINT_DPI = 300;

/**
 * Flags an Image whose dpi is set and below print quality. Images with no
 * dpi set at all are never flagged - absence of data isn't evidence of low
 * resolution (docs/architecture/diagrams/VALIDATION_ENGINE.md §5 item 6).
 * Uses only Image.dpi, already modeled on Book.ts - no new domain-model
 * fields, no Infrastructure dependency (reading actual image bytes/pixels
 * would require one; this rule deliberately doesn't).
 */
export class ImageRule implements ValidationRule {
  readonly name = 'ImageRule';

  evaluate(context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const { book } = context;

    if (book.metadata.coverImage) {
      const issue = this.checkImage(book.metadata.coverImage, 'metadata.coverImage');
      if (issue) issues.push(issue);
    }

    const walkBlocks = (blocks: Block[]): void => {
      for (const block of blocks) {
        if (!isImage(block)) continue;
        const issue = this.checkImage(block, `Image "${block.id}"`);
        if (issue) issues.push(issue);
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
    walkContent(book.mainContent);

    return issues;
  }

  private checkImage(image: Image, location: string): ValidationIssue | undefined {
    if (image.dpi === undefined || image.dpi >= MINIMUM_PRINT_DPI) return undefined;

    return {
      code: 'LOW_RESOLUTION_IMAGE',
      message: `Image resolution is ${image.dpi} DPI, below the ${MINIMUM_PRINT_DPI} DPI print-quality threshold`,
      location,
      severity: 'WARNING',
    };
  }
}
