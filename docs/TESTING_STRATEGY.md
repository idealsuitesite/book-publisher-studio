# Testing Strategy

Two taxonomies, introduced starting Sprint 6, for classifying regression tests as the suite grows past a few hundred cases. Neither retroactively re-tags the existing 328 tests — both apply going forward, and are illustrated below against tests that already exist so the categories aren't abstract.

## Taxonomy 1 — Functional regressions vs. rendering regressions

**Functional regression:** the *decision* is wrong — the system computed the wrong thing, independent of how it's drawn.

Examples already in the suite:
- Wrong running-head title (`LayoutEngine.test.ts`'s `headerFooterTitle resolution` describe block)
- Wrong pagination (`LayoutEngine.test.ts`'s page-break and `startPageNumber` tests)
- Wrong KDP preset selected (`ManualLayoutSelector.test.ts`)
- Wrong page format/size resolved (`LayoutEngine.test.ts`'s `PaginatedBook.pageLayout` — which preset attaches to which name)

**Rendering regression:** the *decision* was right, but what actually got drawn is wrong — a library-level or output-format-level defect.

Examples already in the suite:
- Lost/wrong font (`PdfFontRegistry.test.ts`, the bold/italic font-resolution assertions in `PDFRenderer.test.ts`)
- Wrong margin in the real output bytes (`PDFRenderer.test.ts`'s `/MediaBox`/margin checks, `DOCXRenderer.test.ts`'s `<w:pgMar>` checks)
- Misplaced image (`PDFRenderer.test.ts`'s image-fit-within-margins checks)
- Text overflow (the page-break-count assertions verifying real PDFKit/`docx` output, not just `PaginatedBook.pages.length`)

**Why the split matters:** when a real bug is reported, "the wrong thing happened" and "the right thing happened wrong" point at different layers (`LayoutEngine`'s decision logic vs. a renderer's drawing code) and get diagnosed differently. Tagging new tests by which category they belong to (a `// functional regression` / `// rendering regression` comment near the `it(...)`, or a `describe` block name that says so, matching the pattern `PDFRenderer.test.ts`'s `describe('table of contents (...)')` blocks already use) makes it possible to grep for "every rendering regression test" once the suite is large enough that scanning it by eye stops working.

## Taxonomy 2 — Two levels of rendering test

**Level 1 — Structural tests.** Verify pagination *decisions* without depending on the PDF/DOCX engine at all: page count, page order, page ownership (which `Page` a block landed on), running-head resolution, blank-page insertion. These run entirely against `LayoutEngine`'s own output (`PaginatedBook`) — no `PDFRenderer`/`DOCXRenderer` involved, no PDFKit/`docx` library invoked.

Already in the suite: all of `LayoutEngine.test.ts`. This is Level 1 by construction — every test in that file asserts against `PaginatedBook.pages`/`.tableOfContents`/`.pageLayout`, never against rendered bytes.

**Level 2 — Rendering tests.** Verify what a real renderer actually produced: real blank pages in the real output (not just `blankPagesBefore` on a `Page`), real headers/footers in real bytes, real margins in the real `/MediaBox`/`<w:pgMar>`, real page numbers in extracted text, real graphical elements (images, tables). These necessarily depend on the specific engine (PDFKit for PDF, the `docx` package for DOCX) and inspect its actual output.

Already in the suite: `PDFRenderer.test.ts` and `DOCXRenderer.test.ts`'s real-output assertions — `extractPdfText`/`countPdfPages` against real PDFKit bytes, `<w:pgSz>`/`<w:pageBreakBefore/>` regex matches against real `docx`-generated XML.

**Why the split matters:** a Level 1 failure means `LayoutEngine`'s own logic is wrong and both renderers will inherit the mistake identically. A Level 2 failure localized to one renderer means the *decision* was right and one specific renderer's drawing code is wrong. Without the split, a single failing "PDF has wrong page count" test doesn't tell you which layer to look at first; a passing Level 1 test plus a failing Level 2 test does.

## How this composes with the Quality Gate

`docs/QUALITY_GATE.md`'s "Tests PASS" item assumes both taxonomies exist as a diagnostic tool, not a gate of their own — a test doesn't need to declare its category to count toward "Tests PASS." The categorization is a maintenance aid for triage, most valuable once a regression is reported and someone needs to find "which existing tests cover this" quickly.

## Applying this going forward

- New `LayoutEngine` tests are Level 1 / functional by default (they assert against `PaginatedBook`, not rendered bytes).
- New `PDFRenderer`/`DOCXRenderer` tests that assert against real extracted output (`/MediaBox`, `<w:pgSz>`, extracted text) are Level 2. If a new renderer test only checks that a method was called with the right arguments (no real library output inspected), it doesn't actually earn Level-2 status — see `docs/REAL_FIXTURE_POLICY.md` and this project's existing "verify against real output, not a mock" discipline (ADR-0019/0020 precedent) for why that distinction is load-bearing, not pedantic.
- A `describe` block name is sufficient tagging for now (`describe('table of contents (PaginatedBook.tableOfContents)')` already reads as functional/Level-1 by what it asserts against) — a more formal tag (custom Vitest tag, file-path convention) is worth revisiting once the suite's size actually makes ad hoc `describe`-block scanning too slow, not before.

## Related

- `docs/QUALITY_GATE.md` — the per-commit gate this taxonomy supports
- `docs/REAL_FIXTURE_POLICY.md` — the real-vs-synthetic-fixture policy this taxonomy's Level 2 category depends on
- ADR-0031/ADR-0032 — the real bug (empty TOC on real import) that motivated formalizing both taxonomies now rather than later
