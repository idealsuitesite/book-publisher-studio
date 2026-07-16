import type { PaginatedBook } from '../models/PaginatedBook';

export interface RenderContext {
  metadata?: {
    title?: string;
    author?: string;
    language?: string;
  };
  outputPath?: string;
  embedFonts?: boolean;
  optimizeImages?: boolean;
  compress?: boolean;
  language?: string;
  pageNumberOffset?: number;
}

export interface Renderer<TOutput> {
  render(book: PaginatedBook, context: RenderContext): Promise<TOutput>;
}
