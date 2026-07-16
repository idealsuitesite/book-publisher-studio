import type { Book, Content, Block } from '../models/Book';
import { isChapter } from '../models/Book';
import { countWords, estimateReadingTime, estimatePageCount } from '../../shared/utils/textMetrics';

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

  private calculateWordCount(mainContent: Content[]): number {
    let total = 0;
    const walkBlocks = (blocks: Block[]): void => {
      for (const block of blocks) {
        if (block.type === 'paragraph') total += countWords(block.text);
        else if (block.type === 'heading') total += countWords(block.text);
        else if (block.type === 'quote') total += countWords(block.text);
        else if (block.type === 'scripture') total += countWords(block.text);
        else if (block.type === 'list') total += countWords(block.items.join(' '));
        else if (block.type === 'table')
          total += countWords([...block.headers, ...block.rows.flat()].join(' '));
        else if (block.type === 'footnote') total += countWords(block.content);
        else if (block.type === 'image') total += countWords(block.caption ?? '');
      }
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
}
