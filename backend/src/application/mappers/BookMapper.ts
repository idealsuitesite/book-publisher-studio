import type { Book, Content } from '../../domain/models/Book';
import { isChapter } from '../../domain/models/Book';
import type { BookDTO, ContentDTO } from '../dto/BookDTO';
import type { MetadataDTO } from '../dto/MetadataDTO';
import type { FrontMatterDTO } from 'shared-types';
import { ChapterMapper } from './ChapterMapper';
import { SectionMapper } from './SectionMapper';

export class BookMapper {
  constructor(
    private chapterMapper: ChapterMapper = new ChapterMapper(),
    private sectionMapper: SectionMapper = new SectionMapper()
  ) {}

  map(book: Book): BookDTO {
    return {
      id: book.id,
      metadata: this.mapMetadata(book),
      mainContent: book.mainContent.map((content) => this.mapContent(content)),
      frontMatter: this.mapFrontMatter(book),
      wordCount: book.wordCount,
      pageCount: book.pageCount,
      readingTime: book.readingTime,
    };
  }

  /** The rendered sections only (Phase 3b, FrontMatterDTO's own scope boundary); absent when
   * neither exists so an empty front matter stays honestly empty in the DTO. */
  private mapFrontMatter(book: Book): FrontMatterDTO | undefined {
    const { titlePage, copyrightPage } = book.frontMatter;
    if (!titlePage && !copyrightPage) return undefined;
    return {
      titlePage: titlePage
        ? { title: titlePage.title, subtitle: titlePage.subtitle, author: titlePage.author, tagline: titlePage.tagline }
        : undefined,
      copyrightPage: copyrightPage
        ? {
            text: copyrightPage.text,
            isbn: copyrightPage.isbn,
            copyrightText: copyrightPage.copyrightText,
            legalNotice: copyrightPage.legalNotice,
            printingInfo: copyrightPage.printingInfo,
          }
        : undefined,
    };
  }

  private mapContent(content: Content): ContentDTO {
    return isChapter(content) ? this.chapterMapper.map(content) : this.sectionMapper.map(content);
  }

  private mapMetadata(book: Book): MetadataDTO {
    const metadata = book.metadata;
    return {
      title: metadata.title,
      subtitle: metadata.subtitle,
      author: metadata.author,
      publisher: metadata.publisher,
      isbn: metadata.isbn,
      language: metadata.language,
      description: metadata.description,
      keywords: metadata.keywords,
      copyright: metadata.copyright,
      publicationDate: metadata.publicationDate?.toISOString(),
    };
  }
}
