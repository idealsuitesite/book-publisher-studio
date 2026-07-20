# Real Fixture Policy

## Why this exists

This project's Permanent Verification Policy (originally written directly in `docs/CLAUDE.md`, now formalized as this document) already mandated real-file verification for the rendering pipeline (`DOCXRenderer`, `PDFRenderer`, `EPUBRenderer`, `ThemeEngine`, `LayoutEngine`, `TypographyResolver`, the `Renderer` port, `ExportManuscriptUseCase`) — written after this project missed three real bugs (ADR-0019 findings 6B/6C, ADR-0020 addendum) that synthetic fixtures alone never caught. Sprint 6 added a fourth: automatic TOC generation shipped against synthetic fixtures alone, passed 328/328 tests, and would have produced a permanently empty TOC on every real DOCX import — caught only when real-file verification was actually run against `large-book.docx` (ADR-0031 bug 2, formalized as a standing rule in ADR-0032). The fidelity era (2026-07-20/21) added three more, each invisible to a fully green suite: **fifth** — `StructurePresenceRule` read `book.wordCount`, which the publish path never enriches, so the KDP structure gate silently saw 0 words and never fired; unit tests that hand-set the field passed (IMPORT_FIDELITY commit 3; fixed at the source with `countBookWords()` from the AST). **Sixth** — the renderer consumed more than the pagination model charged (+2.25pt/block) and PDFKit silently inserted 55 unplanned pages per real book, misattributing running heads for the rest of the book (RENDER_DRIFT.md, ADR-0051). **Seventh** — a JS evaluation-order trap in the title keep-with-next flush produced a ghost near-full page at every section boundary; found by the PUBLICATION_QUALITY_BAR calibration measurement, not by 556 passing tests (ADR-0051 annex). Phase 2 of the Book Presentation System (2026-07-21) added two more the moment real decoding/embedding began: **eighth** — `verification/images.docx` had carried a MALFORMED PNG (bad IDAT length) since its creation; browsers tolerate it, PDFKit's strict decoder does not, and nothing ever decoded those bytes until import began populating `Block.base64` — the capability exposed the corruption it had been masking (generator fixed, fixture regenerated). **Ninth** — `DOCXRenderer` declared `type: 'png'` hardcoded for EVERY image with fixed 300×200 dimensions, regardless of real format or size: a silent format lottery on every JPEG, unobservable for as long as no image bytes ever reached it (now sniffed and proportionally sized from probed dimensions). The table-duplication investigation (2026-07-21) added two more, both invisible to 574 green tests: **tenth** — `HtmlNormalizer`'s descendant `.find` selector emitted the content of tables, blockquotes AND nested lists TWICE (once inside the container, once as a stray top-level block); every table/blockquote/nested-list in every export had rendered its own text twice since the normalizer existed — a direct ADR-0050 violation, invisible because `verify-real-export` checked "valid output", never "each cell/item once" (`TABLE_DUPLICATION.md` Défaut A). **Eleventh** — the ADR-0051 reconciliation copied the previous page's owner on an unplanned break, so every inserted PDF page redrew the SAME footer number: a stuck page counter our OWN prior fix introduced, invisible because the parity test counted breaks and never checked the drawn numbers form an increasing sequence (`TABLE_DUPLICATION.md` Défaut B). Eleven for eleven: every one was caught by real files or real measurement, never by synthetic coverage — and the tenth's fix was itself caught tightening the count when the corpus word-count assertion flagged a nested list being de-duplicated.

Four misses in one project, all with the same shape: a synthetic fixture built directly as domain objects doesn't reproduce a real quirk of how the import pipeline actually shapes real content. This policy generalizes the trigger condition beyond "rendering pipeline only" to close that gap.

## The policy

**Any feature or change touching import, pagination, Table of Contents, a renderer, or publishing/packaging must, where applicable, be validated against at least one real fixture from `backend/verification/`** — not only against objects constructed by hand in a test file.

"Where applicable" excludes changes with no real-file-observable effect: a pure type-signature change, a comment, a test-only refactor with no behavior change. It does **not** exclude "I'm confident this is correct" — ADR-0031 and ADR-0032 both happened to code that was fully covered by synthetic-fixture unit tests and still shipped broken.

**In scope (broader than the existing rendering-pipeline trigger list in `docs/CLAUDE.md`):**

- The rendering pipeline (unchanged from the existing policy): `DOCXRenderer`, `PDFRenderer`, `EPUBRenderer`, `ThemeEngine`, `LayoutEngine`, `TypographyResolver`, the `Renderer` port, `ExportManuscriptUseCase`
- The import pipeline: `MammothParser`, `HtmlNormalizer`, `ASTBuilder`, the `DocumentParser`/`DocumentNormalizer` ports, `ImportManuscriptUseCase`
- Table of Contents generation and consumption, specifically (its own line item — this is exactly where ADR-0031 bug 2 lived, and it cuts across both import and layout)
- Any future Publishing Engine work (platform packaging, KDP/Kobo/Apple Books/Google Play Books targets)

**Not in scope:** Validation Engine's rules (already governed by ADR-0027's read-only boundary and its own per-rule test discipline), pure Domain types with no I/O or rendering surface, presentation-layer DTOs/mappers with no format-specific behavior.

## Real Fixture Verification as a Definition-of-Done criterion

`docs/REAL_EXPORT_CHECKLIST.md` remains the canonical *process* for a real-file pass (which fixture, which port-verification steps, which checklist template). This policy makes completing it — or an equivalent real-pipeline-composition check where the full HTTP round trip can't reach the changed code (see below) — an explicit, named Definition-of-Done item, not just a merge-time gate:

```
□ Build PASS
□ Lint PASS
□ Tests PASS
□ Coverage PASS
□ Real Fixture Verification PASS (where applicable)
□ verify-server PASS
□ verify-real-export PASS
□ Documentation synchronized
□ ADRs synchronized
```

## When the real HTTP round trip can't reach the changed field

Some fields have no real-world way to be set from an actual DOCX upload — `Chapter.openingPageStyle`/`startPageNumber`, `Book.frontMatter.toc.generateAutomatically` (Sprint 6), and `BookMetadata.isbn`/`description`/`coverImage` (Sprint 5) are all confirmed examples: `ASTBuilder` has no DOCX-native signal for any of them. In that case, "Real Fixture Verification" means composing the real pipeline directly (same components `ExportManuscriptUseCase`/`ImportManuscriptUseCase` wire together, same real fixture content) with only the unreachable field(s) set programmatically — not skipping the check, and not silently claiming full HTTP-round-trip coverage the check doesn't actually have. Disclose the gap explicitly in the completed `docs/REAL_EXPORT_CHECKLIST.md` instance, matching the precedent set in Sprint 6's PR (#11).

## Worked examples

- ADR-0032 (TOC generation must use `Chapter`/`Section` titles, not `Heading` blocks) is a direct product of this policy already having caught one real bug — any future TOC-adjacent change should be re-verified against `backend/verification/large-book.docx` (a real multi-chapter fixture), not synthetic fixtures alone.
- A future change to `MammothParser`'s heading-detection logic, or to how `ASTBuilder` decides `Chapter` vs `Section` boundaries, is import-pipeline scope under this policy even though it touches neither a renderer nor `LayoutEngine` directly.

## Related

- `docs/DEVELOPMENT_WORKFLOW.md` — "Server verification," "Which fixture to use" (the port-verification and fixture-selection mechanics this policy's trigger scope builds on, unchanged)
- `docs/REAL_EXPORT_CHECKLIST.md` — the checklist template and process this policy makes mandatory for a broader set of changes
- `docs/QUALITY_GATE.md` — the per-commit gate this policy's checklist item feeds into
- ADR-0019/ADR-0020 (the first three real bugs this project's real-file discipline was built to catch), ADR-0031/ADR-0032 (the fourth, and the reason this policy's scope was broadened beyond rendering), ADR-0049/IMPORT_FIDELITY commit 3 (the fifth), RENDER_DRIFT.md/ADR-0051 (the sixth), the ADR-0051 annex (the seventh — found by measurement, PUBLICATION_QUALITY_BAR §10.1), the ADR-0050 annex (the eighth and ninth — exposed by Phase 2's real image embedding, BOOK_PRESENTATION.md), TABLE_DUPLICATION.md (the tenth — content duplication, and the eleventh — the stuck footer our own ADR-0051 fix introduced)
