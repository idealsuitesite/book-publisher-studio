import type { StyledBook } from './Theme';

export interface Page {
  number: number;
  blocks: string[];
}

export interface PaginatedBook {
  styledBook: StyledBook;
  pages: Page[];
}
