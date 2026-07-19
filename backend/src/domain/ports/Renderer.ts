import type { PaginatedBook } from '../models/PaginatedBook';
import type { RenderMetrics } from '../models/RenderMetrics';

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

/**
 * What a renderer produced, and what it measured while producing it.
 *
 * Metrics come from the renderer rather than from the caller (correcting RENDER_METRICS.md
 * Question 1, see ADR-0045) because **only the renderer knows the true page count**.
 * `PaginatedBook.pages.length` is an estimate that ADR-0013 already recorded as drifting from
 * the real rendered count, and front matter compounds it: PDFRenderer emits title and copyright
 * pages that pagination never saw. On the canonical fixture the estimate said 1 and the shipped
 * PDF had 3.
 */
export interface RenderResult<TOutput> {
  output: TOutput;
  metrics: RenderMetrics;
}

export interface Renderer<TOutput> {
  render(book: PaginatedBook, context: RenderContext): Promise<RenderResult<TOutput>>;
}
