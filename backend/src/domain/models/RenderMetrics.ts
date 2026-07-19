import type { PageLayout } from './PageLayout';

/**
 * Facts about one rendered artifact, measured at render time.
 *
 * Exists because the publish pipeline computes real pagination and then discarded it before the
 * components that need it could see it (ADR-0038, resolved by ADR-0042). Three consumers were
 * blocked, not one: KDP's page-count range, its spine width (`spineWidthInPerPage x pages`, so
 * paperback cover dimensions are *derived* from page count) and its gutter margins.
 *
 * Platform-agnostic by construction (ADR-0037): these are facts about a rendition, not about any
 * platform's opinion of it. Nothing here may ever name KDP or assume a target.
 */
export interface RenderMetrics {
  /**
   * The **real** paginated page count — `PaginatedBook.pages.length`, not an estimate.
   *
   * Deliberately optional, and that is load-bearing. A reflowable format (EPUB) genuinely has no
   * page count, so absence is a real answer rather than a missing value, and `PageCountRule`
   * keeps a legitimate reason to report `PAGE_COUNT_UNKNOWN`.
   *
   * **Never confuse this with `Book.pageCount`**, which is an import-time *estimate* derived from
   * word count by `BookMetricsCalculator`. The two will not agree, and consumers must not fall
   * back from one to the other: KDP rejects on the real count, so validating an estimate against
   * a hard platform limit would turn an honest warning into a PASS on a book Amazon will refuse
   * (ADR-0042).
   */
  pageCount?: number;

  /** The geometry pagination actually ran against — not what was requested, what was used. */
  pageLayout: PageLayout;

  /**
   * Pages the RENDERING LIBRARY inserted on its own initiative — never planned by the model
   * (ADR-0051, RENDER_DRIFT.md fix 2, CTO amendment: reconciliation must be observable).
   * 55 of these were silently amplifying 2.4 pages of drift into 57 wasted pages before this
   * field existed; the drift-parity assertion in the real-fixture suite keeps it at 0.
   * Undefined for renderers where the concept does not apply (DOCX reflows, EPUB has no pages).
   */
  unplannedPageBreaks?: number;
}
