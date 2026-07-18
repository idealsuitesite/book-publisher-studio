import type { MetadataDTO } from './MetadataDTO';
import type { ChapterDTO } from './ChapterDTO';
import type { SectionDTO } from './SectionDTO';

export type ContentDTO = ChapterDTO | SectionDTO;

export interface BookDTO {
  id: string;
  metadata: MetadataDTO;
  mainContent: ContentDTO[];
  wordCount?: number;
  pageCount?: number;
  readingTime?: number;
}
