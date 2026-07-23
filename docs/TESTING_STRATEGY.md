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

**`SOLO_RENDER_VERIFICATION` — a standing caveat on whole-document text extraction (precedent set 2026-07-23, STRUCTURE_CLEANUP).** `extractPdfRuns`/`extractPdfText` concatenate the text of **every page in document order**. On a real book with **repeated phrases** that whole-document concat *lies* about whether a specific string was rendered: a contiguous substring match can (a) FALSE-POSITIVE — a fragment appears to be present because the same words occur elsewhere in the book, and (b) FALSE-NEGATIVE — a target string that IS rendered fails to match because a running head / page number / another page's text interleaves between its wrap-lines in the concat. Proven: verifying a long A2 subtitle on the founder's book (which repeats "JESUS CHRIST, OUR PASSOVER…" across many chapters) first read "27/56 chars present" — a real-looking failure that was neither: fragment probes gave two reassuring hits (later unmasked as other occurrences), separator-normalisation then showed a real absence, but rendering the **same subtitle in isolation** proved the renderer emits all 67 characters. **The rule: verify a specific rendered string in a SOLO render — the one chapter/element under test as its own one-item book — with the confounders removed; never trust (or distrust) a whole-document contiguous match on a book with repeated content.** This is the instrument-liar doctrine (`docs/REAL_FIXTURE_POLICY.md`, the honest-property principle below) applied to a render probe: the instrument you just wrote can be the thing that's wrong. The discipline that resolved it — do not stop at the first reassuring signal (a found fragment) nor the first alarming one (a normalised absence); push until the cause is *proven* — is the precedent, not just the solo-render fix. Home instrument: `backend/spikes/structure-cleanup-a2-render-verify.ts` (solo render).

**Why the split matters:** a Level 1 failure means `LayoutEngine`'s own logic is wrong and both renderers will inherit the mistake identically. A Level 2 failure localized to one renderer means the *decision* was right and one specific renderer's drawing code is wrong. Without the split, a single failing "PDF has wrong page count" test doesn't tell you which layer to look at first; a passing Level 1 test plus a failing Level 2 test does.

## Principle — a test is only as honest as the property it measures

> A green suite proves the tests' assertions hold, never that they assert the *right* thing. A verified fix stays blind to a defect the test never measured.

Named as a standing principle (CTO direction, 2026-07-21) after the pattern recurred a third time — it is the through-line of the real-fixture bug lineage (`docs/REAL_FIXTURE_POLICY.md`), not a coincidence:

- **Structure scored 100/100 over 0 chapters** (ADR-0049): every validation test passed; none asserted that a book-length manuscript with no chapters cannot score full marks. The suite measured "does scoring run", never "does the score tell the truth".
- **The renderer inserted 55 silent pages, then a stuck footer counter** (ADR-0051 / TABLE_DUPLICATION Défaut B): the parity test asserted the *count* of unplanned breaks; it never asserted the drawn page numbers form a strictly increasing sequence. Measuring the wrong property let our own verified fix ship a regression.
- **Tables/blockquotes/nested lists rendered their content twice** (TABLE_DUPLICATION Défaut A): `verify-real-export` asserted "valid, non-trivial output"; it never asserted "each cell's text appears exactly once". Valid ≠ faithful.

**The operational rule this yields:** when a real defect is found, the fix is not done until a test asserts the *property that was actually violated* — not a proxy for it, not an adjacent property that happens to correlate. "Close the class, not the symptom" (the CTO's standing phrase) is this principle applied: the class IS the property; the symptom is one observation of its violation. Every entry in the lineage was invisible precisely because a real capability, or a real measurement, exercised a property no assertion named — which is also why `docs/REAL_FIXTURE_POLICY.md` (real files) and real measurement (the calibration spikes) keep catching what synthetic coverage cannot.

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
- `docs/REAL_FIXTURE_POLICY.md` — the eleven-bug lineage the "honest property" principle above is drawn from
