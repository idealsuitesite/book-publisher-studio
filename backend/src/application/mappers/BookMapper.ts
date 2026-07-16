import type { Book, Content } from '../../domain/models/Book';
import { isChapter } from '../../domain/models/Book';
import type { BookDTO, ContentDTO } from '../dto/BookDTO';
import type { MetadataDTO } from '../dto/MetadataDTO';
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
      wordCount: book.wordCount,
      pageCount: book.pageCount,
      readingTime: book.readingTime,
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
