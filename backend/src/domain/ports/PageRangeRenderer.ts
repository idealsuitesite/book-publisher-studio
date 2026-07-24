import type { PaginatedBook } from '../models/PaginatedBook';
import type { RenderContext, RenderResult } from './Renderer';

/**
 * INCREMENTAL_RENDER (P1) — the visible-region render capability, kept SEPARATE from the generic
 * `Renderer` port on purpose. Only a paginated format has "pages" to render a range of: PDF does,
 * DOCX (Word repaginates on open) and EPUB (reflows) do not. Folding `renderPageRange` into `Renderer`
 * would force those two to carry a method they cannot honour (an Interface-Segregation violation).
 * So the region use case depends on THIS narrow port; `PDFRenderer` is its one real implementation.
 *
 * The contract is the fidelity invariant (INCREMENTAL_RENDER_DR §1): a page rendered in a region is
 * byte-for-byte identical to that page of the full export, because the region draws from the full
 * `PaginatedBook`'s own `Page` objects — `totalPages` is the full book's REAL physical page count,
 * held by the caller from its initial full render, so the footer reads "of <full total>".
 */
export interface PageRangeRenderer {
  renderPageRange(
    book: PaginatedBook,
    context: RenderContext,
    startPage: number,
    endPage: number,
    totalPages: number
  ): Promise<RenderResult<Buffer>>;
}
