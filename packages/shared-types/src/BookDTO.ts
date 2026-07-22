import type { MetadataDTO } from './MetadataDTO';
import type { ChapterDTO } from './ChapterDTO';
import type { SectionDTO } from './SectionDTO';
import type { FrontMatterDTO } from './FrontMatterDTO';

export type ContentDTO = ChapterDTO | SectionDTO;

export interface BookDTO {
  id: string;
  metadata: MetadataDTO;
  mainContent: ContentDTO[];
  /** The rendered front-matter sections (Phase 3b) — optional and additive; absent on books
   * whose front matter is empty. See FrontMatterDTO for the deliberate scope boundary. */
  frontMatter?: FrontMatterDTO;
  wordCount?: number;
  pageCount?: number;
  readingTime?: number;
}
