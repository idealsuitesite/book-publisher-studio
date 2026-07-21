import { createHash } from 'node:crypto';
import type { UseCase } from '../contracts/UseCase';
import type { DocumentParser } from '../../domain/ports/DocumentParser';
import type { DocumentNormalizer } from '../../domain/ports/DocumentNormalizer';
import type { Renderer } from '../../domain/ports/Renderer';
import type { ASTBuilder } from '../../domain/services/ASTBuilder';
import type { ThemeEngine } from '../../domain/services/ThemeEngine';
import type { TypographyResolver } from '../../domain/services/TypographyResolver';
import type { LayoutEngine } from '../../domain/services/LayoutEngine';
import { FrontMatterBuilder } from '../../domain/services/FrontMatterBuilder';
import type { PageLayout } from '../../domain/models/PageLayout';
import type { PaginatedBook } from '../../domain/models/PaginatedBook';
import type { Book } from '../../domain/models/Book';
import type { PaginationCache } from '../../domain/ports/PaginationCache';
import { resolveTheme } from '../../domain/themes/getTheme';
import { orderByRole } from '../../domain/services/orderByRole';

export interface ExportRequest {
  buffer: Buffer;
  filename: string;
  themeName: string;
  pageLayout: PageLayout;
}

export class ExportManuscriptUseCase implements UseCase<ExportRequest, Buffer> {
  constructor(
    private parser: DocumentParser,
    private normalizer: DocumentNormalizer,
    private builder: ASTBuilder,
    private themeEngine: ThemeEngine,
    private typographyResolver: TypographyResolver,
    private layoutEngine: LayoutEngine,
    private renderer: Renderer<Buffer>,
    private frontMatterBuilder: FrontMatterBuilder = new FrontMatterBuilder()
  ) {}

  async execute(request: ExportRequest): Promise<Buffer> {
    const raw = await this.parser.parse(request.buffer);
    const normalized = this.normalizer.normalize(raw.html, { fileName: request.filename });
    const built = this.builder.build(normalized);

    // The raw-bytes route (/api/manuscripts/export) has no stored book, so front matter is
    // synthesised HERE, at the boundary — never inside renderBook. Since Q3, the project path
    // populates front matter at import instead and renders stored content untouched; keeping
    // synthesis out of the shared render tail is what lets those two facts coexist.
    const book = { ...built, frontMatter: this.frontMatterBuilder.build(built) };
    return this.renderBook(book, request.themeName, request.pageLayout);
  }

  /**
   * Renders an already-built `Book` through the theme -> typography -> layout -> renderer tail.
   * **Renders the book's front matter exactly as given — no synthesis.**
   *
   * Two entry points share this: `execute()` above (raw upload bytes, front matter synthesised at
   * the boundary before calling in) and the project export path (`ExportProjectUseCase`, which
   * passes the project's STORED book — front matter populated at import, structure edits included).
   * Before the render tail existed, the project path re-parsed the original source bytes and
   * silently discarded every stored edit — the Structure station and the export were two different
   * books (STRUCTURE_EDITING.md §5/§9; ADR-0052).
   */
  async renderBook(
    book: Book,
    themeName: string,
    pageLayout: PageLayout,
    accentOverride?: string,
    paginationCache?: PaginationCache
  ): Promise<Buffer> {
    // resolveTheme applies the optional per-project accent over the named theme, in the ONE shared
    // seam (MINI_DR_PER_THEME_ACCENT). No override -> the named theme, unchanged.
    const theme = resolveTheme(themeName, accentOverride);
    // Editorial-part placement (MINI_DR_EDITORIAL_PLACEMENT): front/back-tagged parts are ordered
    // before/after the chapters here, in the shared tail, before pagination — so pagination, TOC and
    // running heads all follow. A book with no tagged part is returned untouched (byte-identical).
    const styled = this.themeEngine.applyTheme(orderByRole(book), theme);
    const typeset = this.typographyResolver.resolve(styled);

    // Pagination reuse on a colour-only refresh (MINI_DR_PAGINATION_REUSE). The pages are pure
    // geometry — accent moves no glyph width, line height or spacing (proven both ways,
    // MINI_DR_PER_THEME_ACCENT) — so an accent-only change reuses the cached pages and re-inks them
    // by pairing them with the freshly-typeset (new-accent) book. The key deliberately EXCLUDES the
    // accent (only book content, theme and layout move geometry); reusing the cached geometry with
    // the fresh `typeset` is what applies the new colour without re-flowing. Absent cache (the
    // raw-bytes /export route) -> paginate every time, unchanged.
    const paginated: PaginatedBook = paginationCache
      ? this.paginateCached(paginationCache, book, themeName, pageLayout, typeset)
      : this.layoutEngine.paginate(typeset, pageLayout);

    // Metrics are discarded here on purpose: the export path has no validator to feed, and an
    // unused field is what the handbook's port-vs-class rule exists to prevent (ADR-0045).
    return (await this.renderer.render(paginated, { language: book.metadata.language })).output;
  }

  private paginateCached(
    cache: PaginationCache,
    book: Book,
    themeName: string,
    pageLayout: PageLayout,
    typeset: PaginatedBook['styledBook']
  ): PaginatedBook {
    const key = paginationKey(book, themeName, pageLayout);
    const cached = cache.get(key);
    if (cached) {
      // Reuse the accent-invariant geometry with the fresh (new-accent) typeset. The pages carry
      // only block-ids, so they are valid for any typeset of the same book/theme/layout; the fresh
      // typeset supplies the new colour (block styles + theme). This is the §3 recolour-not-restale.
      return { styledBook: typeset, pages: cached.pages, pageLayout, tableOfContents: cached.tableOfContents };
    }
    const paginated = this.layoutEngine.paginate(typeset, pageLayout);
    cache.set(key, { pages: paginated.pages, tableOfContents: paginated.tableOfContents });
    return paginated;
  }
}

/**
 * The pagination-cache key: the geometry-affecting inputs ONLY. `accentOverride` is deliberately
 * absent — it is colour-only (MINI_DR_PER_THEME_ACCENT), so a change to it must REUSE, not
 * invalidate. `Book` has no usable version stamp (`Project.updatedAt` is bumped by every settings
 * change including accent, and the book is re-deserialised per request so object identity does not
 * survive), so the book contributes a content hash. Any structure/content edit yields a new book →
 * a new hash → a miss; theme or layout change → a different key → a miss. A future geometry-affecting
 * setting MUST be added here (MINI_DR_PAGINATION_REUSE §2.3 — the key completeness IS the R2 guard).
 */
export function paginationKey(book: Book, themeName: string, pageLayout: PageLayout): string {
  const bookHash = createHash('md5').update(JSON.stringify(book)).digest('hex');
  return `${bookHash}|${themeName}|${JSON.stringify(pageLayout)}`;
}
