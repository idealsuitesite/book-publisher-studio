# Current State - Book Publisher Studio

**Last Updated:** July 17, 2026 (Sprint 4, commits 1-10 complete and verified)
**Sprint:** Sprint 4 ("Typography Engine") in progress on `feature/sprint-4-typography-engine`. Design Review approved (`docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md`, 11-commit plan). Commits 1-10 implemented, tested, and verified against real files. Commit 11 remains (final docs pass with ADR-0022/0023/0024).
**Branch:** `feature/sprint-4-typography-engine` (branched from `main` at `5eb71c4`, rebased once onto `main` after PR #7/#8 merged, pushed to `origin` for the first time 2026-07-17). `main` itself has PR #1-#5 merged plus `fix/pdf-table-without-header` (PR #8) and the server-verification tooling (PR #6/#7) — no other open feature branches.

---

## Summary

**Completed (Sprint 4, commits 1-10):** Domain types (`ResolvedTypography`/`TypeRun`), additive `StyledBook.blockTypography`, `TypographyResolver` (inline run resolution, drop caps, English-only smart quotes, forced quote/scripture italics, heading `staysWithNext`), `LayoutEngine` keep-with-next pagination support, real font embedding (Gelasio/Inter/JetBrains Mono, SIL OFL, 12 `.ttf` files in `backend/assets/fonts/`) with a role-based `PdfFontRegistry` API (`resolveBody`/`resolveHeading`/`resolveMonospace`/`resolveDefault`), full `TypeRun` rendering support in `PDFRenderer`/`DOCXRenderer`/`EPUBRenderer`, `BookMetricsCalculator.calculateQualityMetrics(paginated: PaginatedBook): QualityMetrics` activating all 7 `QualityMetrics` fields with real computed values, and a completed E2E real-file verification pass (commit 10) that found and fixed 3 real content-fidelity bugs in the import pipeline (ADR-0026, see below). 195 tests passing ✅, re-verified before every commit via `npm run build`, `npm run lint`, `npm test`, `npm run verify-server`, and `npm run verify-real-export` (16/16 checks: 4 fixtures × import + export-docx/pdf/epub).
**Next:** Commit 11 (ADR-0022 Typography Resolution Pipeline, ADR-0023 Font Embedding, ADR-0024 Hyphenation/Smart-quotes-deferred, plus final `CURRENT_STATE.md`/`TODO.md`/`VERSIONS.md` pass) before the Sprint 4 PR is opened. **PR only once the whole sprint is done and verified** — no PR yet.

**Design-review gap found and resolved during commit 9:** the Design Review (`docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md`) locked exact formulas for `averageHeadingDepth`/`paragraphDensity`/`lineDensity`/`dropCaps` (CTO Final Decision 4) but left the 3 pre-existing ADR-0008 fields (`widowsAndOrphans`/`inconsistentSpacing`/`emptyHeadings`) with no formula — only "activate them, the resolver already computes the underlying data." Flagged and confirmed before implementation rather than guessed silently: `widowsAndOrphans` = count of blocks where `TypographyResolver` resolved `staysWithNext: true` (currently all headings); `emptyHeadings` = `Heading.text.trim() === ''`; `inconsistentSpacing` = count of `Paragraph` blocks whose explicit `spaceBefore`/`spaceAfter`/`lineHeight` diverges from the theme-resolved value — functional definition deliberately kept general ("a block whose explicit style overrides a theme-resolved value") per the CTO's direction, so future style dimensions (alignment, indentation, color, font) can be folded in later without resemanticizing the field; Sprint 4's implementation checks spacing only. Also confirmed: `calculateQualityMetrics` is a new method operating on `PaginatedBook` (needs `blockTypography` + real page count, both unavailable on a bare `Book`), not wired into `ExportManuscriptUseCase` or any route this commit — that wiring is explicitly `ValidatorEngine` scope, not Sprint 4.

**Real, scope-exception bugs found and fixed during commit 10 (ADR-0026):** exporting the canonical `typography-test.docx` fixture through the real running dev server (not a synthetic fixture) surfaced 3 real bugs in `HtmlNormalizer`/`ASTBuilder` — import-pipeline code that ADR-0025 (one commit earlier, same sprint) had just ruled out of scope. Unlike ADR-0025's underline finding (styling lost, word intact), these three are content-fidelity losses: (1) strikethrough (`<s>`/`<strike>`/`<del>`) silently downgraded to plain text - no case existed in `HtmlNormalizer`'s tag mapping; (2) whitespace between adjacent inline runs silently dropped by an independent `.trim()` per text node, jamming words together (a real DOCX imported "This paragraph mixes bold, italic..." as "...mixesbold,italic..."); (3) `ASTBuilder.convertInlines()` filtered all plain-text inlines out of `Paragraph.inlines` and silently mislabeled any unhandled inline type as bold via a catch-all `default` case - since `TypographyResolver` prefers `.inlines` over `.text` whenever populated, any real formatted paragraph lost all its surrounding prose in every renderer, not just its styling. CTO directed an immediate fix rather than document-and-defer (unlike ADR-0025) because these corrupt or delete real text, not just its emphasis. Fixed: `Normalized.ts` gained a `strikethrough` `InlineNode` type; `HtmlNormalizer.extractInlines()` maps `s`/`strike`/`del` to it and collapses (not trims) inter-node whitespace; `ASTBuilder.convertInlines()` keeps plain-text inlines and uses an exhaustive `never`-checked switch instead of a silent bold fallback. 9 new regression tests; verified against the real fixture (DOCX/EPUB output text-extracted and read - correct spacing, strikethrough renders, no missing sentences). ADR-0025's underline finding is unrelated and still deferred (a mammoth-level fix, not a `HtmlNormalizer`/`ASTBuilder` one). See ADR-0026 for full detail.

**Real bugs found and fixed along the way (Sprint 4):**
1. PDFKit crash (`NaN` from `Infinity * 0`) on headerless tables — root-caused and fixed in dedicated `fix/pdf-table-without-header` branch (PR #8), not folded into Sprint 4 or the tooling PR.
2. Mammoth (DOCX import library) silently drops underline formatting by default — a dependency limitation, not a Sprint 4 pipeline bug. Documented in ADR-0025 with a verified workaround (`styleMap: ["u => u"]`, not applied) and a regression test (`MammothParser.test.ts`) so it's never mistaken for a typography regression. Import pipeline deliberately not modified this sprint (except for ADR-0026's 3 content-fidelity fixes, commit 10); a future "Import Fidelity" sprint remains scoped in `docs/TODO.md` for underline and the other named gaps.
3. Strikethrough downgraded to plain text, inter-run whitespace jamming words together, and `ASTBuilder` silently dropping plain-text inlines / mislabeling unknown inline types as bold — found via commit 10's real-file verification, fixed immediately as an explicit scope exception rather than deferred (ADR-0026).

**Permanent tooling added this sprint (server-verification side-quest, PR #6/#7, merged to `main` before Sprint 4 resumed):** `npm run verify-server` and `npm run verify-real-export` — real-file, real-HTTP-server verification against canonical fixtures in `backend/verification/` (`typography-test.docx`, `large-book.docx`, `images.docx`, `tables.docx`). See `docs/REAL_EXPORT_CHECKLIST.md` and `docs/CLAUDE.md`'s "Server Verification Policy" / "Real Export Policy" sections.

---

## Sprint 1: Import Pipeline ✅ COMPLETE (tagged `v0.2.0-alpha`)

Domain + Infrastructure + Application + Presentation for `POST /api/manuscripts/import`. See `docs/releases/v0.2.0-alpha/ReleaseNotes.md` for full detail — not repeated here.

---

## Sprint 2: Rendering Engine ✅ COMPLETE (merged to `main` via PR #1, `32ac220`)

**Design Review complete and approved** (ADR-0012, 0013, 0014, 0016, 0017 — `docs/architecture/diagrams/RENDERING_PIPELINE.md`). **Implementation built, tested, and merged.**

**Domain (new):**
- ✅ `Theme`, `ResolvedBlockStyle`, `StyledBook` types (`domain/models/Theme.ts`)
- ✅ `PageLayout` type (`domain/models/PageLayout.ts`)
- ✅ `PaginatedBook`/`Page` types (`domain/models/PaginatedBook.ts`) — a real type wrapping `StyledBook` + `Page[]`, not a bare array, to leave room for headers/footers/running titles/page numbers/bleed/crop marks later
- ✅ `ThemeEngine.applyTheme(book, theme): StyledBook` — concrete class, not a port (same reasoning as `ASTBuilder`/`BookValidator`: one correct implementation for our Book model, no swappable-adapter case)
- ✅ `ClassicTheme` — first built-in theme, `getTheme(name)` registry (throws typed `UnknownThemeError` for unknown names)
- ✅ `LayoutEngine.paginate(styled, layout): PaginatedBook` — concrete class, heuristic pagination (word-count-based height estimate for text, actual height for images, row count for tables); chapters start new pages
- ✅ `Renderer<TOutput>` port (`domain/ports/Renderer.ts`) — the one piece of this pipeline that IS a port, since PDF/EPUB/DOCX/HTML/Kindle are genuinely swappable implementations
- ✅ `LetterPageLayout` — shared default `PageLayout` (`domain/layouts/`)

**Infrastructure:**
- ✅ `DOCXRenderer` (implements `Renderer<Buffer>`) — uses the `docx` npm package (ADR-0018). Renders headings/paragraphs/quotes/scripture/tables/lists/footnotes with resolved theme styles, inserts page breaks at `LayoutEngine`'s estimated boundaries. Images without embedded base64 data fall back to a text placeholder (no network fetch inside a renderer). Ordered lists use a manual "N. " prefix rather than `docx`'s numbering-config machinery.

**Application:**
- ✅ `ExportManuscriptUseCase` — same `UseCase<TRequest,TResponse>` shape as `ImportManuscriptUseCase`. Chains the *existing* import pipeline (Parser → Normalizer → ASTBuilder) into the new export pipeline (ThemeEngine → LayoutEngine → Renderer) in one round trip — no persistence layer exists, so export is DOCX-in/DOCX-out, not a lookup by id

**Presentation:**
- ✅ `ExportController`, `POST /api/manuscripts/export` route (multipart DOCX + optional `theme` field, defaults to `classic`), wired additively into `presentation/app.ts`
- ✅ `UnknownThemeError` (typed, matching `DocumentParseError`'s precedent) maps unknown theme names to 400, not the generic 500 fallback

**Verified with a real file:** a real DOCX from `backend/uploads/` was exported via the running dev server — valid zip structure, correct Word parts (`word/document.xml`, `styles.xml`, `numbering.xml`), page breaks present, Classic theme's Georgia font applied.

## Quality Sprint ✅ COMPLETE (merged to `main` via PR #2, `c507f5d`)

All 37 `@typescript-eslint/no-explicit-any` warnings eliminated — no behavior change, 118/118 tests unchanged, coverage unchanged. `HtmlNormalizer.ts` now uses real cheerio/domhandler types (`Element`, `AnyNode`, `isTag`/`isText` guards) instead of `any`; two test files use proper Domain type casts instead of `as any`; two `catch` blocks narrow via `instanceof Error`. ESLint now reports **0 errors, 0 warnings**.

**Nothing outstanding from Sprint 2 or the Quality Sprint** — both fully merged and verified on `main`.

## Sprint 3A: PDF Export ✅ COMPLETE (merged to `main` via PR #3, `820f1ef`; tagged `v0.4.0-alpha`)

**PDFKit spike + ADR-0019 completed before any renderer code was written** (`backend/spikes/pdfkit-spike.ts`, gitignored output in `spikes/output/`) — fonts, Unicode, images, tables, page breaks, headers/footers, bleed, and crop marks all verified against real PDFKit output first.

**Infrastructure:**
- ✅ `PDFRenderer` (implements `Renderer<Buffer>`) — uses the `pdfkit` npm package (ADR-0014). Mirrors `DOCXRenderer`'s block coverage (headings/paragraphs/quotes/scripture/tables/lists/footnotes/images), inserts page breaks at `LayoutEngine`'s estimated boundaries. Theme font families map onto PDFKit's standard-14 fonts by name heuristic (no redistributable font asset shipped yet — open item, see Known Issues). Built on `bufferPages: true`: content renders once with zero header/footer interference, then a second pass stamps every page's header/footer using the real page count from `doc.bufferedPageRange()`.

**Application/Presentation:**
- ✅ No new Use Case class — `ExportManuscriptUseCase` was already renderer-agnostic (ADR-0012), so PDF support is a second instance configured with `PDFRenderer` instead of `DOCXRenderer`
- ✅ `POST /api/manuscripts/export` gained a `format` field (`docx` default, `pdf`) rather than a new route; `ExportController` now holds one use case per format and picks Content-Type/filename accordingly

**Real bugs found and fixed during implementation** (not just the spike — documented in ADR-0019, finding 6):
1. Stack overflow: writing footer text below the page's bottom margin triggered PDFKit's own auto-pagination *from inside* the `pageAdded` handler drawing it, recursing until the stack overflowed.
2. Silent page-count blowup: `doc.text(x, y, ...)` left PDFKit's cursor stranded near the bottom of the page, so every subsequent content call without explicit coordinates overflowed onto a new page almost immediately — a 9-page test document rendered as 212 pages before this was caught.
3. Wrong "Page N of TOTAL": caught only by exporting a **real** DOCX from `backend/uploads/` through the running dev server, not a synthetic fixture — the footer showed "Page 6 of 4" because `LayoutEngine`'s word-count estimate undershot the actual rendered page count.

All three were fixed by the `bufferPages` redesign above.

**Testing:**
- ✅ `src/test-utils/extractPdfText.ts` — hex-token text extraction + `/MediaBox`-count page counting, hand-rolled after confirming the popular `pdf-parse` package couldn't be used (current major depends on a native canvas binding; the classic 1.x bundles a pdf.js too old for PDFKit's current xref format)
- ✅ 6 new `PDFRenderer.test.ts` cases + 1 E2E `format=pdf` case in `export.test.ts`

**Verified with a real file:** the same real DOCX from `backend/uploads/` used to verify Sprint 2's DOCX export was exported to both `.docx` and `.pdf` via the running dev server on merged `main` — both HTTP 200, correct Content-Type, valid output.

**Nothing outstanding from Sprint 3A** — fully merged and verified on `main`.

## Sprint 3B: EPUB Export ✅ COMPLETE (merged to `main` via PR #4, `a7a38a0`)

**EPUB library spike + ADR-0020 completed before any renderer code was written** (`backend/spikes/epub-library-spike.ts`) — resolves ADR-0015 with real evidence, not a guess. `epub-gen-memory` (a maintained TypeScript fork) chosen over the ADR-0015 example candidate `epub-gen` itself, which was rejected on hard evidence: last published to npm in 2022, never left `0.1.0`, no detected license on GitHub despite `package.json` claiming MIT, and a dependency tree full of genuinely legacy packages (`q`, `rimraf@2`, a second major of `cheerio` alongside this project's own).

**Infrastructure:**
- ✅ `EPUBRenderer` (implements `Renderer<Buffer>`) — uses `epub-gen-memory` (ADR-0020). Serializes the same block types `DOCXRenderer`/`PDFRenderer` already handle (headings, paragraphs, quotes/scripture, lists, tables, footnotes, images) into HTML per chapter. No pagination consulted (ADR-0013, unchanged — EPUB is reflowable). Images with embedded base64 data are written to a scoped temp directory per render and referenced via `file://`, since `epub-gen-memory` unconditionally fetches every `<img src>` with no bypass for already-available bytes (ADR-0020, finding 5) — this keeps the same no-hidden-network-I/O rule the other two renderers already follow.

**Application/Presentation:**
- ✅ No new Use Case class — `ExportManuscriptUseCase` was already renderer-agnostic (ADR-0012), so EPUB support is a third instance configured with `EPUBRenderer`
- ✅ `POST /api/manuscripts/export`'s `format` field now also accepts `epub` (alongside `docx` default, `pdf`) — no new route

**Real bugs found and fixed during implementation** (not just the spike — documented in ADR-0020's addendum):
1. Double-wrapped CJS/ESM interop: `epub-gen-memory`'s exported render function arrives two `.default` levels deep under this project's ESM toolchain — confirmed identically under both `tsx` and plain `node`, so not a dev-only quirk. Unwrapped defensively rather than hardcoding the depth.
2. Empty-book bug, caught only by exporting a **real** DOCX from `backend/uploads/` through the running dev server, not a synthetic fixture: `EPUBRenderer` filtered top-level content to `Chapter` only, but `ASTBuilder` falls back to a top-level `Section` ("preamble") when the source document has no Heading-1-level break at all — exactly this real file's shape. Produced a structurally valid but completely empty EPUB (correct `mimetype`/OPF, zero chapter files). Fixed by walking all of `mainContent` regardless of type, matching `DOCXRenderer`/`PDFRenderer`'s existing generic walk.

**Testing:**
- ✅ 7 new `EPUBRenderer.test.ts` cases, including a regression test reproducing the exact top-level-`Section`-with-no-`Chapter` shape that caused bug 2 above
- ✅ 1 new E2E `format=epub` case in `export.test.ts`

**Verified with a real file:** the same real DOCX from `backend/uploads/` used to verify Sprints 2 and 3A was exported to `.epub` via the running dev server on merged `main` — HTTP 200, correct Content-Type, `mimetype` correctly first/uncompressed, real chapter content present (not the empty shell bug 2 above produced before the fix).

**Nothing outstanding from Sprint 3B** — fully merged and verified on `main`.

## Sprint 4: Typography Engine 🟡 IN PROGRESS (commits 1-10 of 11, branch `feature/sprint-4-typography-engine`, not yet pushed as a PR)

**Design Review completed and approved before any implementation code** (`docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md`) — iterated through multiple rounds with the CTO; rejected an initial `TypesetBook`/`LayoutEngine`-signature-change proposal in favor of an additive `StyledBook.blockTypography` field, keeping `LayoutEngine.paginate()`'s signature unchanged. Final pipeline: `ThemeEngine → TypographyResolver → LayoutEngine → Renderer`.

**Domain (new):**
- ✅ `ResolvedTypography`/`TypeRun` types (`domain/models/ResolvedTypography.ts`) — per-run bold/italic/underline/strikethrough/superscript/subscript/smallCaps/linkUrl, plus block-level `dropCap`/`staysWithNext`
- ✅ `StyledBook.blockTypography?: Record<string, ResolvedTypography>` — additive field on `Theme.ts`, no breaking change to existing `StyledBook` consumers
- ✅ `TypographyResolver.resolve(styled, options?)` (concrete class, same reasoning as `ThemeEngine`/`LayoutEngine` — one correct implementation, not a swappable adapter) — resolves inline runs per block, applies drop caps, English-only smart quotes, forces italic on quote/scripture blocks, sets `staysWithNext: true` on headings only
- ✅ `LayoutEngine.paginate()` — signature unchanged; internally carries a `staysWithNext` block onto the next page on overflow-triggered breaks (not `forceNewPage` breaks)
- ✅ Composite key convention (`shared/utils/typographyKeys.ts`): `blockTypographyKey(id)` vs `listItemTypographyKey(id, index)` for per-list-item runs; `::cell-R-C` reserved for future table support
- ✅ Shared fallback helpers (`shared/utils/typographyRuns.ts`): `plainTypeRun`, `runsOrPlainFallback` — used identically by all 3 renderers

**Infrastructure:**
- ✅ Real font embedding: Gelasio (serif), Inter (sans-serif), JetBrains Mono (monospace) — all SIL OFL 1.1, 12 `.ttf` files (4 styles × 3 families) in `backend/assets/fonts/` with license files and a sourcing README. No network dependency at build/test/export time (files committed to the repo).
- ✅ `PdfFontRegistry` (`infrastructure/fonts/PdfFontRegistry.ts`) — role-based API (`resolveBody`/`resolveHeading`/`resolveMonospace`/`resolveDefault`, plus `registerAll(doc)`), audited to confirm zero PDF-rendering logic (only `doc.registerFont()` calls)
- ✅ `PDFRenderer` — threads `theme` through `render→renderContent→renderBlock`, uses a `FontResolver` closure per run for full `TypeRun` support; `renderTitle()` fixed to use `resolveHeading()` (was incorrectly using `resolveDefault()`); drop cap v1 approximation; superscript/subscript/smallCaps documented as unrendered (no PDFKit primitive)
- ✅ `DOCXRenderer` — overrides `styles.default.heading1-6` at the Document level from `theme`; full native `TypeRun` support via `docx`'s `TextRun` properties + `ExternalHyperlink`
- ✅ `EPUBRenderer` — every `TypeRun` flag maps to real HTML (`<strong>/<em>/<u>/<s>/<sup>/<sub>/<a href>`, smallCaps via inline style); real CSS drop cap (`float: left`, no approximation needed — EPUB is reflowable HTML/CSS)

**Application:**
- ✅ `ExportManuscriptUseCase` gained a `typographyResolver: TypographyResolver` constructor param; calls `resolve()` between `applyTheme()` and `paginate()`
- ✅ `presentation/app.ts` — one shared `TypographyResolver` instance wired across the docx/pdf/epub use cases

**Domain (commit 9 addition):**
- ✅ `BookMetricsCalculator.calculateQualityMetrics(paginated: PaginatedBook): QualityMetrics` — new additive method (existing `calculate(book: Book): Book` untouched); activates all 7 `QualityMetrics` fields with real values. `Book.ts`'s `QualityMetrics` interface gained the 4 new Sprint 4 fields (`averageHeadingDepth`/`paragraphDensity`/`lineDensity`/`dropCaps`) plus a doc comment generalizing `inconsistentSpacing`'s functional definition beyond spacing (see Summary's "Design-review gap" note above)

**Commit 10 (E2E real-file verification pass):**
- ✅ New real-fixture regression tests (`typography-test.docx`, not a synthetic fixture): `export.test.ts` (+3, DOCX/EPUB formatting + all-3-formats-no-crash), `ExportManuscriptUseCase.test.ts` (+1, PDF embedded-font-weight check via direct pipeline composition with `compress: false` — the real HTTP route's production `compress: true` output can't be text/font-extracted, see that test's comment)
- ✅ **3 real content-fidelity bugs found in `HtmlNormalizer`/`ASTBuilder` and fixed as an explicit scope exception (ADR-0026)** — see Summary above for full detail: strikethrough tag recognition added; inter-run whitespace preservation fixed (was jamming words together); `ASTBuilder.convertInlines()` no longer drops plain-text inlines or silently mislabels unknown types as bold. `Normalized.ts`'s `InlineNode.type` gained `'strikethrough'`. 4 new `HtmlNormalizer.test.ts` cases, 1 new + 1 extended `ASTBuilder.test.ts` case
- ✅ Real DOCX/EPUB output text-extracted and read directly (not just asserted via `npm test`) — confirmed correct word spacing, strikethrough rendering, and no missing sentences on the actual exported files in `backend/verification/output/typography-test/`

**Real bugs found and fixed during implementation** (documented above in Summary): PDFKit headerless-table crash (fixed in dedicated PR #8, not this sprint's branch); `renderTitle()` heading-font inconsistency (found as a side effect of the `PdfFontRegistry` refactor, fixed and disclosed in the commit message); 3 import-pipeline content-fidelity bugs found and fixed in commit 10 (ADR-0026).

**Dependency limitation found and documented, not fixed this sprint:** Mammoth silently drops DOCX underline formatting (ADR-0025) — regression test added (`MammothParser.test.ts`), requires a mammoth-level `styleMap` fix, scoped for a future Import Fidelity sprint.

**Verified with real files before every commit:** `npm run verify-server` + `npm run verify-real-export` (16/16 checks — 4 canonical fixtures × import + export-docx/pdf/epub) run against the actual running dev server, not just unit tests, per the project's Real Export Policy.

**Remaining (commit 11):**
- [ ] Commit 11: ADR-0022 (Typography Resolution Pipeline), ADR-0023 (Font Embedding), ADR-0024 (Hyphenation/Smart quotes deferred to v2) + final `CURRENT_STATE.md`/`TODO.md`/`VERSIONS.md` pass
- [ ] Open the Sprint 4 PR only once commit 11 is done and re-verified

---

## Test Summary

| Component | Tests |
|-----------|-------|
| Book domain model | 10 |
| ASTBuilder | 22 |
| BookValidator | 6 |
| BookMetricsCalculator | 10 (up from 6 — added `calculateQualityMetrics` coverage this sprint) |
| HtmlNormalizer | 17 |
| MammothParser | 3 |
| BookMapper | 6 |
| ImportManuscriptUseCase | 13 |
| Manuscript import route (E2E) | 5 |
| ThemeEngine | 4 |
| getTheme | 2 |
| LayoutEngine | 8 |
| DOCXRenderer | 5 |
| ExportManuscriptUseCase | 6 |
| Manuscript export route (E2E) | 7 (up from 6 — added a `format=epub` case this sprint) |
| PDFRenderer | 6 |
| EPUBRenderer | 7 |
| **TypographyResolver** | **~15** |
| **PdfFontRegistry** | **~8** |
| **extractPdfText (font-aware rewrite)** | **~6** |
| **DOCXRenderer (TypeRun coverage)** | **+~5** |
| **PDFRenderer (TypeRun coverage)** | **+~5** |
| **EPUBRenderer (TypeRun coverage)** | **+~5** |
| **MammothParser (ADR-0025 regression)** | **+1** |
| **BookMetricsCalculator (calculateQualityMetrics, commit 9)** | **+4** |
| **HtmlNormalizer (strikethrough + whitespace fix, commit 10 / ADR-0026)** | **+4 (17 → 21)** |
| **ASTBuilder (plain-text-inline preservation, commit 10 / ADR-0026)** | **+1 (22 → 23)** |
| **export.test.ts real-fixture E2E (commit 10)** | **+3** |
| **ExportManuscriptUseCase (PDF real-fixture font-weight, commit 10)** | **+1 (6 → 7)** |
| **Total** | **195** |

(Bold rows are new or grown this sprint — Sprint 4, commits 1-10. Exact per-file counts to be reconciled in commit 11's docs pass; 195 is the verified total from the last full `npm test` run. Note the `HtmlNormalizer`/`ASTBuilder`/`ExportManuscriptUseCase` row counts above are deltas against the non-bold rows earlier in this table, not additional separate components.)

---

## Architecture Compliance

| Rule | Status |
|------|--------|
| Domain has zero external dependencies | ✅ |
| Application depends only on interfaces (ports live in Domain) | ✅ |
| No Domain objects in DTOs | ✅ |
| Dependency Inversion enforced (constructor injection throughout) | ✅ |
| All tests passing | ✅ (195/195) |
| No circular dependencies | ✅ |
| TypeScript strict mode | ✅ |
| Controller contains no business logic | ✅ |
| Domain coverage >90% | ✅ (verified >90% before every commit via `npm run test:coverage`; exact percentage to be reconciled and recorded in commit 11's docs pass) |
| Global coverage >80% | ✅ (verified >80% before every commit via `npm run test:coverage`; exact percentage to be reconciled and recorded in commit 11's docs pass) |
| Renderer is a port; ThemeEngine/LayoutEngine are concrete classes | ✅ (Design Review decision, ADR-0012 addendum) |
| Zero ESLint warnings | ✅ (0 errors, 0 warnings — held since Quality Sprint, PR #2) |

---

## Known Issues

- `backend/uploads/` history: files are untracked going forward, decided to keep past git history as-is, no purge planned (ADR-0021, closes the open decision).
- **Font asset resolved this sprint (ADR-0021 → Sprint 4 commit 6):** Gelasio (serif), Inter (sans-serif), JetBrains Mono (monospace) — all SIL OFL 1.1, real `.ttf` files embedded via `PdfFontRegistry`. No longer an open item.
- Mammoth (DOCX import) silently drops underline formatting by default — documented dependency limitation, not a pipeline bug (ADR-0025, Sprint 4). A verified workaround exists (`styleMap: ["u => u"]`) but requires a mammoth-level fix; scoped for a future "Import Fidelity" sprint. (Note: 3 related but distinct `HtmlNormalizer`/`ASTBuilder` bugs — strikethrough, inter-run whitespace, plain-text-inline dropping — were found alongside this and fixed immediately in commit 10, ADR-0026, not deferred like underline.)
- PDFKit has no native primitive for superscript/subscript/small-caps — `PDFRenderer` documents these as unrendered `TypeRun` flags (DOCX and EPUB both render them correctly; this is a PDFKit-specific gap, not a pipeline gap).
- No RTL / multi-script text support yet (ADR-0019, confirmed out of scope for Sprint 4 by explicit Design Review decision): verified no single embedded font covers every script (Arabic renders as blank boxes with the font tested), and PDFKit does no bidi reordering or Arabic contextual glyph shaping. Real, separate work — flagged, not scheduled.
- `epub-gen-memory` (ADR-0020) is a smaller-community fork (58 GitHub stars) of a more popular but unmaintained parent (`epub-gen`, 458 stars) — worth watching at upgrade time, not a reason to avoid it now.

---

## Technical Debt

- `QualityMetrics` is now computable via `BookMetricsCalculator.calculateQualityMetrics(paginated)` (Sprint 4 commit 9) but isn't surfaced through any HTTP route/DTO yet — deliberately out of commit 9's scope; wiring it into a response is `ValidatorEngine` work (Sprint 4+ priority #2).
- `DOCXRenderer`'s footnote rendering is simplified (inline `[n] content` paragraph, not real Word footnotes) and ordered lists use a manual prefix instead of `docx`'s numbering config — both documented, deliberate simplifications, not silent gaps.
- `PDFRenderer`'s table rendering does not split a table across a forced page break (matches `LayoutEngine`'s own treatment of a table as one non-splitting unit, ADR-0013 — not an inconsistency, but a real large-table edge case that could visually overflow a page if it ever occurs).
- Hyphenation and non-English smart quotes are deliberately deferred to v2 (Design Review decision, to be recorded formally in ADR-0024 at commit 11).
- ADR-0022 (Typography Resolution Pipeline) and ADR-0023 (Font Embedding) are not yet written — the Design Review doc (`docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md`) exists and was followed, but the formal ADR entries are deferred to commit 11 per the CTO's stated preference (document once the real code state is final, not mid-sprint).
- `EPUBRenderer`'s `page-break` block renders a CSS `page-break-before` hint, not a real page break — EPUB is reflowable (ADR-0013), and reading systems vary in whether they honor the hint at all. Documented, not a silent gap.
- `docs/architecture/diagrams/BASELINE_v0.1.md`'s "86/86 tests" claim was corrected via ADR-0010 (status annotation only, content not rewritten, per the doc's own frozen/ADR-only change rule).

---

## Next Session Preparation

**To resume work:** say "Read docs/SESSION_BOOTSTRAP.md and follow it" — it fixes the reading order (`START_HERE.md` → `CURRENT_STATE.md` → `TODO.md` → `DECISIONS.md` → `VERSIONS.md`) and requires a summary + explicit approval before any code is written.

**Next task is already mid-flight, not a fresh Design Review:** Sprint 4 (Typography Engine) commits 1-10 are done and verified; **commit 11 is next** — ADR-0022/0023/0024 + final `CURRENT_STATE.md`/`TODO.md`/`VERSIONS.md` reconciliation pass, then open the Sprint 4 PR (only once commit 11 is done and re-verified). Continue on `feature/sprint-4-typography-engine` (pushed to `origin`) — do not branch again. Follow the same per-commit discipline used for commits 1-10: one responsibility per commit, build/lint/tests green, no scope drift, `npm run verify-server` + `npm run verify-real-export` before every commit, stop and present any real design/implementation mismatch rather than silently working around it (commit 10 did exactly this for 2 real import-pipeline bugs before fixing them — see ADR-0026), wait for explicit approval.

**Quick Start:**
```bash
cd "D:\Book Publisher Studio\backend"
git checkout feature/sprint-4-typography-engine && git pull
npm test               # Verify all 195 tests pass
npm run build          # Verify TypeScript compilation
npm run lint            # Verify 0 ESLint errors
npm run test:coverage   # Verify coverage thresholds
npm run verify-server        # Verify the real dev server (health, routes, fixtures)
npm run verify-real-export   # Verify real import + export-docx/pdf/epub against canonical fixtures
```

---

## Dependencies

**Runtime:**
- mammoth (DOCX parser)
- cheerio (HTML normalizer)
- **domhandler** (cheerio's node types — `Element`/`AnyNode`/`isTag`/`isText` — explicit dependency added during the Quality Sprint instead of relying on transitive resolution)
- express, multer, cors
- **docx** (DOCX generation — ADR-0018)
- **pdfkit** (PDF generation — ADR-0014)
- **epub-gen-memory** (EPUB generation — ADR-0020)

**Dev:**
- vitest, @vitest/coverage-v8
- typescript
- eslint, typescript-eslint, @eslint/js, prettier
- supertest, @types/supertest
- jszip (test-fixture generation and test-side docx/epub inspection)
- @types/pdfkit

---

## Git Status

**Branch:** `feature/sprint-4-typography-engine` at `c87d72b` (commit 9, "BookMetricsCalculator populates QualityMetrics via calculateQualityMetrics"), on top of `77ab1c2` (commit 8) and `8ab6ffb` (docs consolidation after commits 1-8, adds `SESSION_BOOTSTRAP.md`). Not yet pushed to `origin` (commits 1-8 and the docs consolidation were pushed 2026-07-17; commit 9 is local, pending push).
**Branched from / rebased onto `main` at:** `4f488ad` (PR #8 merge — `fix/pdf-table-without-header`; `main` also has PR #7 `39b173f` and PR #6 `33b9b0f`, the server-verification tooling, both merged before Sprint 4 resumed).
**Sprint 4 commits on this branch (1-9, oldest first):** `ea6df67` → `5b550cf` → `0a1a0c7` → `a045f21` → `d17555e` → `041319e` → `36692a9` → `9be7325` → `0f4a750` → `e2973cc` (ADR-0025) → `77ab1c2` → `8ab6ffb` (docs consolidation) → `c87d72b` (commit 9).
**`main` synced with `origin/main` at:** `4f488ad` (see PR #5 `5eb71c4`, governance commit `e512ee7`, PR #4 `a7a38a0`, PR #3 `820f1ef`, PR #2 `c507f5d`, PR #1 `32ac220` further back in history).
**Remote:** https://github.com/idealsuitesite/book-publisher-studio
**Tags:** `v0.1.0-alpha.1`, `v0.2.0-alpha`, `v0.3.0-alpha`, `v0.4.0-alpha`, **`v0.4.1-alpha`** (EPUB export, cut 2026-07-17 per ADR-0021 — see `docs/VERSIONS.md` and `docs/releases/v0.4.1-alpha/ReleaseNotes.md`)
**Open branches:** none — the 3 stale merged branches found still on `origin` (see prior note) were deleted locally and remotely 2026-07-17.
