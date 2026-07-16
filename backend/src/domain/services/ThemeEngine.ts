import type { Book, Content, Block } from '../models/Book';
import type { Theme, ResolvedBlockStyle, StyledBook } from '../models/Theme';

const HEADING_SIZE_BY_LEVEL: Record<number, keyof Theme['fontSizes']> = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
};

export class ThemeEngine {
  applyTheme(book: Book, theme: Theme): StyledBook {
    const blockStyles: Record<string, ResolvedBlockStyle> = {};

    const walkBlocks = (blocks: Block[]): void => {
      for (const block of blocks) {
        blockStyles[block.id] = this.resolveBlockStyle(block, theme);
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

    return { book, theme, blockStyles };
  }

  private resolveBlockStyle(block: Block, theme: Theme): ResolvedBlockStyle {
    if (block.type === 'heading') {
      const sizeKey = HEADING_SIZE_BY_LEVEL[block.level] ?? 'h6';
      return {
        fontFamily: theme.fonts.heading,
        fontSize: theme.fontSizes[sizeKey],
        color: theme.colors.text,
        spaceBefore: theme.spacing.headingSpacing,
        spaceAfter: theme.spacing.headingSpacing,
      };
    }

    return {
      fontFamily: theme.fonts.body,
      fontSize: theme.fontSizes.body,
      color: theme.colors.text,
      spaceBefore: theme.spacing.paragraphSpacing,
      spaceAfter: theme.spacing.paragraphSpacing,
    };
  }
}
