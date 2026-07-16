import type { StyledBook } from '../models/Theme';
import type { PageLayout } from '../models/PageLayout';
import type { Page, PaginatedBook } from '../models/PaginatedBook';
import type { Content, Block } from '../models/Book';
import { countWords } from '../../shared/utils/textMetrics';

const WORDS_PER_LINE = 12;
const DEFAULT_IMAGE_HEIGHT = 200;

export class LayoutEngine {
  paginate(styled: StyledBook, layout: PageLayout): PaginatedBook {
    const usableHeight = layout.height - layout.marginTop - layout.marginBottom;
    const pages: Page[] = [];
    let currentPageBlocks: string[] = [];
    let currentHeight = 0;
    let pageNumber = 1;

    const startNewPage = (): void => {
      if (currentPageBlocks.length === 0) return;
      pages.push({ number: pageNumber, blocks: currentPageBlocks });
      pageNumber += 1;
      currentPageBlocks = [];
      currentHeight = 0;
    };

    const addBlock = (block: Block, forceNewPage: boolean): void => {
      const blockHeight = this.estimateBlockHeight(block, styled);

      if (forceNewPage || (currentHeight + blockHeight > usableHeight && currentPageBlocks.length > 0)) {
        startNewPage();
      }

      currentPageBlocks.push(block.id);
      currentHeight += blockHeight;
    };

    // Chapters conventionally start on a new page; sections/subsections flow within their chapter's pages.
    const walkContent = (contents: Content[], isTopLevel: boolean): void => {
      for (const content of contents) {
        const startsChapter = isTopLevel && content.type === 'chapter';
        let isFirstBlock = true;
        for (const block of content.content) {
          addBlock(block, isFirstBlock && startsChapter);
          isFirstBlock = false;
        }
        if (content.type === 'chapter' && content.sections) {
          walkContent(content.sections as unknown as Content[], false);
        } else if (content.type === 'section' && content.subsections) {
          walkContent(content.subsections as unknown as Content[], false);
        }
      }
    };
    walkContent(styled.book.mainContent, true);
    startNewPage();

    return { styledBook: styled, pages };
  }

  private estimateBlockHeight(block: Block, styled: StyledBook): number {
    const style = styled.blockStyles[block.id];
    const fontSize = style?.fontSize ?? styled.theme.fontSizes.body;
    const lineHeight = styled.theme.spacing.lineHeight;
    const linePoints = fontSize * lineHeight;

    switch (block.type) {
      case 'heading':
      case 'paragraph':
      case 'quote':
      case 'scripture':
        return Math.max(1, Math.ceil(countWords(block.text) / WORDS_PER_LINE)) * linePoints;
      case 'list':
        return Math.max(1, block.items.length) * linePoints;
      case 'table':
        return (1 + block.rows.length) * linePoints;
      case 'footnote':
        return linePoints;
      case 'image':
        return block.height ?? DEFAULT_IMAGE_HEIGHT;
      case 'page-break':
      case 'divider':
        // Not yet produced by ASTBuilder (same scope decision already made for BlockMapper/BlockDTO
        // in Phase 2) - minimal placeholder height until something actually generates these.
        return linePoints;
      default: {
        const _exhaustive: never = block;
        throw new Error(`Unsupported block type: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
}
