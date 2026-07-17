import type { Book, Content, Block, QualityMetrics } from '../models/Book';
import { isChapter } from '../models/Book';
import type { PaginatedBook } from '../models/PaginatedBook';
import type { StyledBook } from '../models/Theme';
import { countWords, estimateReadingTime, estimatePageCount } from '../../shared/utils/textMetrics';

// Mirrors LayoutEngine's own WORDS_PER_LINE heuristic (domain/services/LayoutEngine.ts)
// so lineDensity's line estimate agrees with the page count it's measured against.
const WORDS_PER_LINE = 12;

export interface ContentStatistics {
  chapters: number;
  images: number;
  tables: number;
}

export class BookMetricsCalculator {
  calculate(book: Book): Book {
    const wordCount = this.calculateWordCount(book.mainContent);

    return {
      ...book,
      wordCount,
      pageCount: estimatePageCount(wordCount),
      readingTime: estimateReadingTime(wordCount),
    };
  }

  countContent(book: Book): ContentStatistics {
    let images = 0;
    let tables = 0;

    const walkBlocks = (blocks: Block[]): void => {
      for (const block of blocks) {
        if (block.type === 'image') images += 1;
        else if (block.type === 'table') tables += 1;
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

    return {
      chapters: book.mainContent.filter(isChapter).length,
      images,
      tables,
    };
  }

  /**
   * Computes real, book-quality metrics from a paginated, typography-resolved book -
   * the point in the pipeline (after LayoutEngine.paginate()) where per-block typography
   * flags and an actual page count both exist. Resolves ADR-0008's deferred QualityMetrics
   * activation; functional definitions locked in the Sprint 4 Design Review
   * (docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md, CTO Final Decision 4) except where
   * noted below.
   */
  calculateQualityMetrics(paginated: PaginatedBook): QualityMetrics {
    const { styledBook, pages } = paginated;
    const { book } = styledBook;
    const blockTypography = Object.values(styledBook.blockTypography ?? {});

    let paragraphCount = 0;
    let headingCount = 0;
    let imageCount = 0;
    let tableCount = 0;
    let footnoteCount = 0;
    let paragraphWordTotal = 0;
    let estimatedLineTotal = 0;
    let headingLevelTotal = 0;
    let emptyHeadings = 0;
    let inconsistentSpacing = 0;
    const chapterWordTotals: number[] = [];

    const walkBlocks = (blocks: Block[]): number => {
      let words = 0;
      for (const block of blocks) {
        words += this.wordsForBlock(block);

        if (block.type === 'paragraph') {
          paragraphCount += 1;
          const paragraphWords = countWords(block.text);
          paragraphWordTotal += paragraphWords;
          estimatedLineTotal += Math.max(1, Math.ceil(paragraphWords / WORDS_PER_LINE));
          if (this.overridesResolvedSpacing(block, styledBook)) inconsistentSpacing += 1;
        } else if (block.type === 'heading') {
          headingCount += 1;
          headingLevelTotal += block.level;
          if (block.text.trim() === '') emptyHeadings += 1;
        } else if (block.type === 'image') {
          imageCount += 1;
        } else if (block.type === 'table') {
          tableCount += 1;
        } else if (block.type === 'footnote') {
          footnoteCount += 1;
        }
      }
      return words;
    };

    const walkContent = (contents: Content[]): number => {
      let words = 0;
      for (const content of contents) {
        let contentWords = countWords(content.title) + walkBlocks(content.content);
        if (content.type === 'chapter' && content.sections) {
          contentWords += walkContent(content.sections as unknown as Content[]);
        } else if (content.type === 'section' && content.subsections) {
          contentWords += walkContent(content.subsections as unknown as Content[]);
        }
        if (isChapter(content)) chapterWordTotals.push(contentWords);
        words += contentWords;
      }
      return words;
    };
    const wordCount = walkContent(book.mainContent);

    const dropCaps = blockTypography.filter((typography) => typography.dropCap).length;
    // staysWithNext is the resolver's widow/orphan-avoidance signal (see ResolvedTypography.ts) -
    // counting it directly is what CTO Final Decision (§9, "Expand") meant by "the resolver
    // already computes the underlying data".
    const widowsAndOrphans = blockTypography.filter((typography) => typography.staysWithNext).length;

    return {
      wordCount,
      paragraphCount,
      headingCount,
      imageCount,
      tableCount,
      footnoteCount,
      averageParagraphLength: paragraphCount > 0 ? paragraphWordTotal / paragraphCount : 0,
      averageChapterLength:
        chapterWordTotals.length > 0
          ? chapterWordTotals.reduce((sum, n) => sum + n, 0) / chapterWordTotals.length
          : 0,
      readingTimeMinutes: estimateReadingTime(wordCount),
      estimatedPageCount: pages.length,
      widowsAndOrphans,
      inconsistentSpacing,
      emptyHeadings,
      averageHeadingDepth: headingCount > 0 ? headingLevelTotal / headingCount : 0,
      paragraphDensity: pages.length > 0 ? paragraphCount / pages.length : 0,
      lineDensity: paragraphCount > 0 ? estimatedLineTotal / paragraphCount : 0,
      dropCaps,
    };
  }

  private calculateWordCount(mainContent: Content[]): number {
    let total = 0;
    const walkBlocks = (blocks: Block[]): void => {
      for (const block of blocks) total += this.wordsForBlock(block);
    };
    const walkContent = (contents: Content[]): void => {
      for (const content of contents) {
        total += countWords(content.title);
        walkBlocks(content.content);
        if (content.type === 'chapter' && content.sections) {
          walkContent(content.sections as unknown as Content[]);
        } else if (content.type === 'section' && content.subsections) {
          walkContent(content.subsections as unknown as Content[]);
        }
      }
    };
    walkContent(mainContent);
    return total;
  }

  private wordsForBlock(block: Block): number {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
      case 'quote':
      case 'scripture':
        return countWords(block.text);
      case 'list':
        return countWords(block.items.join(' '));
      case 'table':
        return countWords([...block.headers, ...block.rows.flat()].join(' '));
      case 'footnote':
        return countWords(block.content);
      case 'image':
        return countWords(block.caption ?? '');
      case 'page-break':
      case 'divider':
        return 0;
      default: {
        const _exhaustive: never = block;
        throw new Error(`Unsupported block type: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  // Functional definition (Book.ts's QualityMetrics.inconsistentSpacing doc comment) is general -
  // "a block whose explicit style overrides a theme-resolved value" - so this check can grow to
  // cover other style dimensions later without changing the metric's meaning. Sprint 4 checks
  // spacing only: ThemeEngine.resolveBlockStyle() ignores block-level spaceBefore/spaceAfter/
  // lineHeight entirely, so any block that sets one of these explicitly and resolves to a
  // different value is a real, detectable override - not a guess.
  private overridesResolvedSpacing(block: Block, styled: StyledBook): boolean {
    if (block.type !== 'paragraph') return false;
    const resolved = styled.blockStyles[block.id];
    if (!resolved) return false;

    if (block.spaceBefore !== undefined && block.spaceBefore !== resolved.spaceBefore) return true;
    if (block.spaceAfter !== undefined && block.spaceAfter !== resolved.spaceAfter) return true;
    if (block.lineHeight !== undefined && block.lineHeight !== styled.theme.spacing.lineHeight) return true;
    return false;
  }
}
