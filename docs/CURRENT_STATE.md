# Current State - Book Publisher Studio

**Last Updated:** July 18, 2026 (Sprint 6 released as `v0.7.0-alpha`; post-Sprint-6 governance restructuring complete; Sprint 7 "First Demonstrable Product" Kickoff written, CTO go-ahead granted, branch created, Commits 1-6 done — Commit 6 wired the real book structure view)
**Sprint:** Sprint 6 ("Professional Layout Engine") **✅ COMPLETE AND RELEASED**, tagged `v0.7.0-alpha` (merge commit `eb05beb`, PR #11, 328/328 tests, two real bugs found and fixed during real-file verification — ADR-0031/0032; see `docs/releases/v0.7.0-alpha/ReleaseNotes.md` / `SPRINT_6_FINAL_REPORT.md` for full detail). **Post-Sprint-6 governance restructuring (2026-07-18, CTO-directed):** `docs/CLAUDE.md` cut from ~135 to ~55 lines, now a thin entry point pointing to new specialized docs — `DEVELOPMENT_WORKFLOW.md`, `DESIGN_REVIEW_PROCESS.md`, `RELEASE_CHECKLIST.md`, `ADR_INDEX.md`, `DEVELOPER_HANDBOOK.md`, `QUALITY_GATE.md`, `TESTING_STRATEGY.md`, `REAL_FIXTURE_POLICY.md`. ADR-0032 extended with the **Engineering Governance Principle** (no feature is done until validated simultaneously at Code/Product/Documentation levels). **Sprint 7 ("First Demonstrable Product", renamed from "Premium UI/UX") is now IN PROGRESS.** Design Review ✅ APPROVED round 2 (`docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md`) — all 5 open decisions locked by explicit CTO direction (full-re-export preview, stateless backend, minimal-for-demo scope, `packages/shared-types` npm workspace, an extensible `GET /api/manuscripts/options` endpoint). New `docs/product/` documentation layer written (`PERSONAS.md`, `USER_JOURNEYS.md`, `FEATURE_MATRIX.md`, `WIREFRAMES.md`, `PRODUCT_DEMO.md` with the official Demo Script, `PRODUCT_ACCEPTANCE.md`) plus `docs/demo/screenshots/README.md`. **`docs/architecture/diagrams/SPRINT_7_KICKOFF.md` written** (CTO-directed short charter between Design Review and Commit 1, matching the Sprint 6 Kickoff precedent) — also introduced a durable `docs/DEVELOPMENT_WORKFLOW.md` rule: every `frontend/`-touching commit from Sprint 7 onward must ship something visibly working. **CTO go-ahead granted 2026-07-18**; `feature/sprint-7-first-demonstrable-product` branched from `main`. **Commits 1-6 done:** npm workspace + `packages/shared-types` (ADR-0033); `GET /api/manuscripts/options` (Decision 5); 9 DTOs migrated with a "transport contracts only" package rule; the first real UI screen (title + drop zone); a real working upload flow (drop → real import → success/error state); and a real book structure view replacing the minimal success state — see Sprint 7 section below for full detail, including 3 CTO decisions on the timeline doc, screenshot proof, and Turbopack noise, plus a disclosed Browser-pane/preview-session tooling incident recovered mid-Commit-6 verification.
**Branch:** `feature/sprint-7-first-demonstrable-product`, at `b0865b7` (Commit 6: book structure view; this docs-sync commit follows immediately on top), branched from `main` at `31b3139`, tag `v0.7.0-alpha`.

---

## Summary

**Completed (Sprint 4, all 11 commits):** Domain types (`ResolvedTypography`/`TypeRun`), additive `StyledBook.blockTypography`, `TypographyResolver` (inline run resolution, drop caps, English-only smart quotes, forced quote/scripture italics, heading `staysWithNext`), `LayoutEngine` keep-with-next pagination support, real font embedding (Gelasio/Inter/JetBrains Mono, SIL OFL, 12 `.ttf` files in `backend/assets/fonts/`) with a role-based `PdfFontRegistry` API (`resolveBody`/`resolveHeading`/`resolveMonospace`/`resolveDefault`), full `TypeRun` rendering support in `PDFRenderer`/`DOCXRenderer`/`EPUBRenderer`, `BookMetricsCalculator.calculateQualityMetrics(paginated: PaginatedBook): QualityMetrics` activating all 7 `QualityMetrics` fields with real computed values, a completed E2E real-file verification pass (commit 10) that found and fixed 3 real content-fidelity bugs in the import pipeline (ADR-0026), and a final docs/ADR pass (commit 11: ADR-0022/0023/0024, `docs/releases/v0.5.0-alpha/SPRINT_4_FINAL_REPORT.md`). 195 tests passing ✅, 90.49% global / 92.57% domain coverage, 0 ESLint warnings, re-verified before every commit via `npm run build`, `npm run lint`, `npm test`, `npm run verify-server`, and `npm run verify-real-export` (16/16 checks: 4 fixtures × import + export-docx/pdf/epub).
**Next:** Sprint 4 is merged (PR #9, `27a4347`) and tagged `v0.5.0-alpha`. Sprint 5 (Validation Engine) is merged (PR #10, `3032d70`) and tagged `v0.6.0-alpha`. Sprint 6 (Professional Layout Engine) has an **approved Design Review** (`docs/architecture/diagrams/PROFESSIONAL_LAYOUT_ENGINE.md`, ADR-0029) and Kickoff charter (`docs/architecture/diagrams/SPRINT_6_KICKOFF.md`) — no branch created, no code written yet, pending explicit go-ahead.

**Design-review gap found and resolved during commit 9:** the Design Review (`docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md`) locked exact formulas for `averageHeadingDepth`/`paragraphDensity`/`lineDensity`/`dropCaps` (CTO Final Decision 4) but left the 3 pre-existing ADR-0008 fields (`widowsAndOrphans`/`inconsistentSpacing`/`emptyHeadings`) with no formula — only "activate them, the resolver already computes the underlying data." Flagged and confirmed before implementation rather than guessed silently: `widowsAndOrphans` = count of blocks where `TypographyResolver` resolved `staysWithNext: true` (currently all headings); `emptyHeadings` = `Heading.text.trim() === ''`; `inconsistentSpacing` = count of `Paragraph` blocks whose explicit `spaceBefore`/`spaceAfter`/`lineHeight` diverges from the theme-resolved value — functional definition deliberately kept general ("a block whose explicit style overrides a theme-resolved value") per the CTO's direction, so future style dimensions (alignment, indentation, color, font) can be folded in later without resemanticizing the field; Sprint 4's implementation checks spacing only. Also confirmed: `calculateQualityMetrics` is a new method operating on `PaginatedBook` (needs `blockTypography` + real page count, both unavailable on a bare `Book`), not wired into `ExportManuscriptUseCase` or any route this commit — that wiring is explicitly `ValidatorEngine` scope, not Sprint 4.

**Real, scope-exception bugs found and fixed during commit 10 (ADR-0026):** exporting the canonical `typography-test.docx` fixture through the real running dev server (not a synthetic fixture) surfaced 3 real bugs in `HtmlNormalizer`/`ASTBuilder` — import-pipeline code that ADR-0025 (one commit earlier, same sprint) had just ruled out of scope. Unlike ADR-0025's underline finding (styling lost, word intact), these three are content-fidelity losses: (1) strikethrough (`<s>`/`<strike>`/`<del>`) silently downgraded to plain text - no case existed in `HtmlNormalizer`'s tag mapping; (2) whitespace between adjacent inline runs silently dropped by an independent `.trim()` per text node, jamming words together (a real DOCX imported "This paragraph mixes bold, italic..." as "...mixesbold,italic..."); (3) `ASTBuilder.convertInlines()` filtered all plain-text inlines out of `Paragraph.inlines` and silently mislabeled any unhandled inline type as bold via a catch-all `default` case - since `TypographyResolver` prefers `.inlines` over `.text` whenever populated, any real formatted paragraph lost all its surrounding prose in every renderer, not just its styling. CTO directed an immediate fix rather than document-and-defer (unlike ADR-0025) because these corrupt or delete real text, not just its emphasis. Fixed: `Normalized.ts` gained a `strikethrough` `InlineNode` type; `HtmlNormalizer.extractInlines()` maps `s`/`strike`/`del` to it and collapses (not trims) inter-node whitespace; `ASTBuilder.convertInlines()` keeps plain-text inlines and uses an exhaustive `never`-checked switch instead of a silent bold fallback. 9 new regression tests; verified against the real fixture (DOCX/EPUB output text-extracted and read - correct spacing, strikethrough renders, no missing sentences). ADR-0025's underline finding is unrelated and still deferred (a mammoth-level fix, not a `HtmlNormalizer`/`ASTBuilder` one). See ADR-0026 for full detail.

**Real bugs found and fixed along the way (Sprint 4):**
1. PDFKit crash (`NaN` from `Infinity * 0`) on headerless tables — root-caused and fixed in dedicated `fix/pdf-table-without-header` branch (PR #8), not folded into Sprint 4 or the tooling PR.
2. Mammoth (DOCX import library) silently drops underline formatting by default — a dependency limitation, not a Sprint 4 pipeline bug. Documented in ADR-0025 with a verified workaround (`styleMap: ["u => u"]`, not applied) and a regression test (`MammothParser.test.ts`) so it's never mistaken for a typography regression. Import pipeline deliberately not modified this sprint (except for ADR-0026's 3 content-fidelity fixes, commit 10); a future "Import Fidelity" sprint remains scoped in `docs/TODO.md` for underline and the other named gaps.
3. Strikethrough downgraded to plain text, inter-run whitespace jamming words together, and `ASTBuilder` silently dropping plain-text inlines / mislabeling unknown inline types as bold — found via commit 10's real-file verification, fixed immediately as an explicit scope exception rather than deferred (ADR-0026).

**Permanent tooling added this sprint (server-verification side-quest, PR #6/#7, merged to `main` before Sprint 4 resumed):** `npm run verify-server` and `npm run verify-real-export` — real-file, real-HTTP-server verification against canonical fixtures in `backend/verification/` (`typography-test.docx`, `large-book.docx`, `images.docx`, `tables.docx`). See `docs/REAL_EXPORT_CHECKLIST.md` and `docs/DEVELOPMENT_WORKFLOW.md`'s "Server verification" / "Which fixture to use" sections.

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

## Sprint 4: Typography Engine ✅ COMPLETE AND RELEASED (PR #9, merge commit `27a4347`, tagged `v0.5.0-alpha`)

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

**Commit 11 (final docs pass):**
- [x] ADR-0022 (Typography Resolution Pipeline), ADR-0023 (PDF Font Embedding), ADR-0024 (Hyphenation/Locale-Aware Smart Quotes Deferred to v2) — all written with full evidence of what was actually built, not just the original Design Review plan
- [x] `docs/releases/v0.5.0-alpha/SPRINT_4_FINAL_REPORT.md` — objectives, delivered features, ADRs created, historical bugs found/fixed, final metrics, deferred items, residual risks, lessons learned
- [x] Final `CURRENT_STATE.md`/`TODO.md`/`VERSIONS.md` reconciliation pass (this update) — exact per-file test counts, exact coverage percentages
- [x] Open the Sprint 4 PR (#9) — merged, merge commit `27a4347`, re-verified on `main` (195/195)
- [x] Tag `v0.5.0-alpha`, write `docs/releases/v0.5.0-alpha/ReleaseNotes.md`, flip `VERSIONS.md`'s row to Released
- [x] Delete `feature/sprint-4-typography-engine` (local + remote), matching the cleanup pattern used after every prior sprint merge

---

## Sprint 5: Validation Engine ✅ COMPLETE AND RELEASED (PR #10, merge commit `3032d70`, tagged `v0.6.0-alpha`)

**Two-level Design Review completed and approved before any implementation code** (`docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` Level 1 + `VALIDATION_ENGINE.md` Level 2) — mapped all 5 remaining engines (Validation, Editorial AI, Plugin System, Professional Layout, Publishing) and their dependencies before designing any one in depth. A sixth candidate, "Document Intelligence Engine," was proposed and explicitly withdrawn (no prior definition anywhere in the project, overlapped Validation/Editorial AI). Two review rounds resolved 4 open questions plus 2 CTO-requested additions (`ValidationContext`, `ValidationSeverity`).

**Domain (new):**
- ✅ `ValidationContext`/`ValidationSeverity`/`ValidationIssue`/`ValidationReport`/`QualityScore` types (commit 1) — `validate(context: ValidationContext)` replaces the originally-sketched `validate(book, paginated?)` to stabilize the public API against future per-platform rule variants without another signature break
- ✅ `ValidationRule` contract + `RuleRegistry` (commit 2) — a thin, order-preserving container; the engine only knows the interface, never a concrete rule class
- ✅ `ValidationEngine` orchestrator (commit 3) — assembles every registered rule's findings into one `ValidationReport`; never mutates its input (ADR-0027)
- ✅ 8 independent, pure rules, one per commit (3-9): `StructuralRule` (wraps `BookValidator` unchanged), `MetadataRule`, `HeadingRule`, `MissingRequiredStyleRule`, `TypographyRule`, `ImageRule`, `HyperlinkRule`, `ComplianceRule`
- ✅ `QualityScore` composite scoring (commit 10) — severity-weighted penalty formula (ERROR 25/WARNING 10/INFO 3/SUGGESTION 1), per-category subscores via a `RULE_CATEGORY` string-keyed lookup (no rule imports, stays decoupled), strictly an interpretation layer over `issues` — never a substitute for them
- ✅ `createValidationEngine()` factory (`domain/services/validation/`) — single source of truth for "which 8 rules exist," used by both `app.ts` and tests

**Application:**
- ✅ `ImportManuscriptUseCase` (commit 11) — `validator: BookValidator` → `validator: ValidationEngine`; calls `validate({ book })` (no `PaginatedBook`/metrics on the import path, disclosed not guessed — `TypographyRule` is a no-op here as a result, by its own already-documented design)
- ✅ New DTOs: `ValidationIssueDTO`, `QualityScoreDTO`; `ImportReportDTO` gains `issues`/`score` additively — `warnings`/`errors` unchanged for existing consumers

**Real, disclosed behavior change confirmed against the real running server** (not just `npm test`): importing `backend/verification/typography-test.docx` and `large-book.docx` now returns 4 real `WARNING` issues (missing ISBN/description/cover-image/KDP-readiness — `ASTBuilder` never populates these from DOCX content) and a `score.overall` of 60/100. This is the intended effect of Sprint 5, not a regression — the existing `ImportManuscriptUseCase.test.ts` exact-report-equality test was updated from a stale empty-warnings snapshot to assert the new shape's properties.

**Design-review gaps found and resolved mid-sprint, each generalized into ADR-0028:**
1. Commit 6: two CTO-named `MissingRequiredStyleRule` variants (TOC-without-H1, FootnoteReference-without-Footnote) aren't implemented — the second needs a `Book` domain-model addition (no `FootnoteReference` inline element exists). Documented in the rule's own comment, not registered as no-op stubs.
2. Commit 7: `QualityMetrics.widowsAndOrphans` is structurally equal to `headingCount` under Sprint 4's `TypographyResolver` (every `Heading` gets `staysWithNext: true` unconditionally) — a threshold on it would always fire or never fire, no real signal. Not implemented, documented why.
3. Commit 9: `ComplianceRule` deliberately reads the same fields `MetadataRule`/`StructuralRule` already check — confirmed as intentional (different business questions, same data), not duplicated responsibility.

**ADR-0027 (Validation Engine is read-only, written before commit 1) and ADR-0028 (the three principles above, confirmed as official CTO policy across commits 6/7/9, recorded together after the fact).**

**Verified with real files:** `npm run verify-server` + `npm run verify-real-export` (16/16 checks) on commit 11; real import responses for `typography-test.docx`/`large-book.docx` read directly from the running server, not just asserted via `npm test`.

**Full retrospective:** `docs/releases/v0.6.0-alpha/SPRINT_5_FINAL_REPORT.md` (objectives, ADRs, design-review gaps, final metrics, deferred items, residual risks, lessons learned).

**Commit 12 (governance closure, this pass):**
- [x] `docs/releases/v0.6.0-alpha/SPRINT_5_FINAL_REPORT.md` written
- [x] ADR-0028 written
- [x] Final `CURRENT_STATE.md`/`TODO.md`/`VERSIONS.md` reconciliation (this update) — including a stale "🟡 IN PROGRESS" Sprint 4 section header found and fixed during this same pass (found via the CTO-requested final coherence check, not before)
- [x] `VERSIONS.md` renumbered: `v0.6.0-alpha` corrected from a superseded "Premium UI/UX" guess to the actual Validation Engine milestone; every subsequent never-released row shifted down one version accordingly
- [x] Open the Sprint 5 PR (#10) — merged, merge commit `3032d70`, re-verified on `main` (282/282)
- [x] Tag `v0.6.0-alpha`, write `docs/releases/v0.6.0-alpha/ReleaseNotes.md`, flip `VERSIONS.md`'s row to Released
- [x] Delete `feature/sprint-5-validation-engine` (local + remote), matching the cleanup pattern used after every prior sprint merge

---

## Sprint 6: Professional Layout Engine ✅ COMPLETE AND RELEASED (PR #11, merge commit `eb05beb`, tagged `v0.7.0-alpha`)

**Design Review completed and approved before any implementation code** (`docs/architecture/diagrams/PROFESSIONAL_LAYOUT_ENGINE.md`, ADR-0029, `docs/architecture/diagrams/SPRINT_6_KICKOFF.md`) — chosen from the 4 remaining Level-1-mapped engines for its lowest-risk profile (no external vendor, no UI requirement, extends existing `LayoutEngine`). A real KDP/platform trim-size spike (`backend/spikes/kdp-trim-size-spike.ts`, ADR-0030) was completed as commit 0, before any preset code, matching the ADR-0019/0020 precedent.

**Domain (new):**
- ✅ `A4PageLayout`/`A5PageLayout`/`KDP5x8PageLayout`/`KDP5_5x8_5PageLayout`/`KDP6x9PageLayout` (`domain/layouts/`) — real dimensions from the commit-0 spike, not guessed; `PageLayout.pageSize` union extended additively
- ✅ `LayoutSelector` port (`domain/ports/`) + `ManualLayoutSelector` (`domain/services/`) — only implementation this sprint, wraps today's caller-by-name behavior, defaults to Letter; `AutomaticLayoutSelector` named and designed for (ADR-0029 Decision 5) but not built
- ✅ `RunningHead` type on `Theme` (additive) — `show`/`position`/`content`/`pageNumber`/`separator`/`uppercase`/`font`/`size`; `ClassicTheme` gets a real populated value
- ✅ `PaginatedBook.pageLayout` (additive) — the `PageLayout` `paginate()` actually computed pages against; a real gap found and fixed as a direct prerequisite (ADR-0031 bug 1) since neither renderer had ever consumed a `PageLayout` at all before this sprint
- ✅ `Page.headerFooterTitle`/`.blankPagesBefore` (additive) — per-page resolved running-head title and `Chapter.openingPageStyle` blank-page count, both computed during `LayoutEngine.paginate()`
- ✅ `LayoutEngine` honors `Chapter.openingPageStyle` (`'right'`/`'left'` blank-page insertion, standard recto/verso convention) and `Chapter.startPageNumber` (resets the displayed page-number sequence, composes with `openingPageStyle`'s parity check)
- ✅ `PaginatedBook.tableOfContents` (additive) — automatic TOC generation from `Chapter`/`Section` titles (the real-world path, ADR-0031 bug 2) and literal `Heading` blocks (the synthetic/future path), only when `Book.frontMatter.toc.generateAutomatically` is true; Book itself is never mutated (ADR-0001), so a manually-authored `frontMatter.toc.entries` is never touched

**Infrastructure:**
- ✅ `PDFRenderer` — reads `book.pageLayout` for real page geometry (was hardcoded Letter); consumes resolved header/footer, drops the hardcoded `'Book Publisher Studio'` string (ADR-0029 Decision 6); renders real blank pages for `openingPageStyle`; footer numerator uses the resolved (possibly `startPageNumber`-reset) page number, not the raw physical index; renders a real, unnumbered front-matter TOC page
- ✅ `DOCXRenderer` — reads `book.pageLayout` for real `<w:pgSz>`/`<w:pgMar>` (was hardcoded default); gains real header/footer support (new capability, none existed before) using live `PageNumber.CURRENT`/`TOTAL_PAGES` Word fields; renders real blank pages for `openingPageStyle`; renders a real TOC as literal front-matter paragraphs
- ✅ EPUB confirmed unaffected (ADR-0029 Decision 3) — `EPUBRenderer` never references `pageLayout`, `runningHead`, or `tableOfContents`

**Application/Presentation:**
- ✅ `ExportController` calls `LayoutSelector.select()` instead of hardcoding `LetterPageLayout`; `POST /api/manuscripts/export` gains an optional `layout` field (mirrors `theme`); unknown names return 400 via `UnknownLayoutError`

**Two real bugs found and fixed during real-file verification, ADR-0031 (not deferred, matching ADR-0019/0020/0026 precedent):**
1. Neither renderer had ever consumed `PageLayout` at all — every new preset from commit 1 would have had zero effect on real rendered output. Found before any real-file test, while wiring `RunningHead` support.
2. Automatic TOC generation produced a permanently empty TOC on every real import — real DOCX headings become `Chapter`/`Section` boundaries, never content-level `Heading` blocks. Found during commit 11's real-file verification against `large-book.docx` (15 real chapters); fixed and re-verified against the same fixture.

**Verified with real files:** `npm run verify-server` + `npm run verify-real-export` (16/16) green throughout. Real HTTP exports of `typography-test.docx` confirmed A4/KDP-6x9 PDF `/MediaBox` and A5 DOCX `<w:pgSz>` match the selected layout exactly; unknown `layout` returns real HTTP 400. `Chapter.openingPageStyle`/`startPageNumber`/`generateAutomatically` have no DOCX-native signal `ASTBuilder` can set from real content (same category as Sprint 5's `isbn`/`description`/`coverImage` finding) — disclosed, not silently skipped, and verified instead via real-pipeline composition with real fixture content (`large-book.docx`) and only those three fields set programmatically.

**328 total tests passing** (up from 282), 92.78% global / 93.75% domain coverage, 0 ESLint warnings.

**Full retrospective:** `docs/releases/v0.7.0-alpha/SPRINT_6_FINAL_REPORT.md` (objectives, ADRs created, design-review gaps found and fixed, final metrics, deferred items, residual risks, lessons learned).

**Closure pass (this update):**
- [x] ADR-0031 written (the two real-file-verification bugs)
- [x] `docs/releases/v0.7.0-alpha/SPRINT_6_FINAL_REPORT.md` written
- [x] Final `CURRENT_STATE.md`/`TODO.md`/`VERSIONS.md` reconciliation pass (this update)
- [x] `VERSIONS.md` renumbered: `v0.7.0-alpha` corrected from a superseded "Premium UI/UX" placeholder to the actual Professional Layout Engine milestone; every subsequent never-released row shifted down one version accordingly
- [x] Open the Sprint 6 PR (#11) — merged, merge commit `eb05beb`, re-verified on `main` (328/328, `verify-server`/`verify-real-export` both green)
- [x] Tag `v0.7.0-alpha`, write `docs/releases/v0.7.0-alpha/ReleaseNotes.md`, flip `VERSIONS.md`'s row to Released
- [x] Delete `feature/sprint-6-professional-layout-engine` (local + remote), matching the cleanup pattern used after every prior sprint merge

---

## Sprint 7: First Demonstrable Product 🟡 IN PROGRESS

**Design Review completed and approved before any implementation code** (`docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md`, round 2), followed by a short CTO-directed Kickoff charter (`docs/architecture/diagrams/SPRINT_7_KICKOFF.md`) inserted between Design Review approval and Commit 1 — matching the Sprint 6 Kickoff precedent, but requested explicitly this time as its own step rather than bundled with the Design Review commit. Branch: `feature/sprint-7-first-demonstrable-product`.

**Commit 1 (`chore: convert repo to an npm workspace; scaffold packages/shared-types`) — ✅ done, ADR-0033:**
- ✅ Root `package.json` (`"workspaces": ["backend", "frontend", "packages/*"]`), single root `package-lock.json` replacing the two nested `backend/`/`frontend/` lockfiles (deleted — Next.js 16's own Turbopack build warned about the redundant pair until removed)
- ✅ `packages/shared-types/` scaffolded — `package.json`/`tsconfig.json`/`eslint.config.mjs` matching `backend/`'s own conventions, `src/index.ts` a deliberate `export {}` placeholder (real DTO re-exports are Commit 3, not this commit — CTO's explicit Commit 1 scope constraint: workspace mechanics only, no product feature)
- ✅ `.github/workflows/backend-ci.yml` updated to install once from the workspace root and run backend's build/lint/test via `--workspace=backend` — a real regression this commit would otherwise have introduced silently, since CI referenced the now-deleted `backend/package-lock.json` directly with a `backend/`-scoped `working-directory`
- ✅ Verified, not assumed: `backend/` — `npm run build` (0 errors), `npm run lint` (0 errors/warnings), `npm test` (328/328, unchanged from Sprint 6), `npm run test:coverage` (92.78% global / 93.75% domain statements, identical to the pre-workspace baseline). `frontend/` — `npm run lint` and `npm run build` both clean. `packages/shared-types` — build/lint clean. Both `backend/`'s and `frontend/`'s `npm run dev` confirmed booting under the new structure. A full `npm ci` at the root (the exact command CI now runs) reproduced the same clean state from a deleted `node_modules`, re-verified against all of the above afterward.
- **Disclosed, non-blocking:** npm 11's `allow-scripts` gate blocks install scripts for `esbuild`/`sharp`/`unrs-resolver` (frontend toolchain transitive deps) by default — not approved or worked around this commit, since every check above passed with them still blocked; flagged in ADR-0033 in case a later commit needs one (e.g. `sharp` for `next/image`).
- No Domain/Application business logic changed; no product feature introduced — exactly Commit 1's CTO-authorized scope.

**Commit 2 (`feat(backend): GET /api/manuscripts/options`) — ✅ done, Decision 5 implemented:**
- ✅ `ManuscriptOptionsDTO`/`ThemeOptionDTO`/`LayoutOptionDTO` born directly in `packages/shared-types` (the first real export there — a genuinely new type, not a moved one; existing DTOs still move in Commit 3)
- ✅ **CTO-resolved design tension, disclosed rather than silently picked:** the CTO's own two constraints — "must come from the existing registries, no duplicated business logic" and "no Domain/Application changes" — are mutually exclusive as literally stated, since `getTheme.ts`/`ManualLayoutSelector.ts`'s registries were module-private with no enumeration primitive. Flagged via a direct question; CTO chose the recommended resolution: one additive, read-only, zero-behavior-change export per registry (`listThemeNames()`, `listLayoutNames()` — both just `Object.keys(...)` over the existing private const, same additive-pattern precedent as ADR-0022/0027/0029). No new business logic, no change to `getTheme()`/`ManualLayoutSelector.select()`'s existing behavior or tests.
- ✅ `ManuscriptOptionsController` (new, Presentation-only) — calls those two Domain read functions directly, mirroring the already-established `ExportController`/`LayoutSelector` precedent (Presentation → Domain port/read-function directly, no new Use Case, since there is no transformation to orchestrate) rather than introducing a new Application-layer Use Case, which would itself have been the kind of Application-layer addition the CTO's directive excluded. Human-readable `label` and `standard`/`kdp` `category` are Presentation-only display maps, keyed off the real registry names, with a graceful raw-name fallback if a future registry entry has no label yet (disclosed, not a crash) — not a duplicated source of truth for *which* options exist, only for how they're labeled.
- ✅ `GET /api/manuscripts/options` route wired additively into `app.ts`, no existing route touched
- ✅ Verified, not assumed: `backend/` — build (0 errors), lint (0 errors/warnings), tests (336/336, up from 328 — 8 new: 2 `getTheme`, 2 `ManualLayoutSelector`, 4 `options.test.ts`), coverage (92.88% global / 93.76% domain, both still above threshold). Real dev server started on a scratch port and the endpoint curled directly: `{"themes":[{"name":"classic","label":"Classic"}],"layouts":[...6 real presets, correctly split standard/kdp...]}` — not just asserted via `npm test`. `frontend/` and `packages/shared-types` both re-verified clean (unaffected, but re-checked since `shared-types` gained new source).
- **Disclosed dev-workflow note (not a defect):** `packages/shared-types` is consumed as a built `dist/`, not live TS source — a change to its `src/` requires `npm run build` in that package before `backend/`'s `tsx watch` or `frontend/`'s dev server picks up the new types. Not solved this commit (out of scope); a `tsc --build`/project-references or a watch script is real future work if this friction becomes a real problem once Commits 3-9 depend on it more heavily.
- No Domain/Application *business logic* changed; no new Use Case, no existing route/behavior changed — matching the CTO's Commit 2 authorization.

**Commit 3 (`feat(backend): DTOs re-exported from packages/shared-types`) — ✅ done:**
- ✅ All 9 pre-existing DTOs (`BookDTO`, `ChapterDTO`, `SectionDTO`, `BlockDTO` + 8 block-variant types, `InlineDTO`, `MetadataDTO`, `ImportReportDTO`, `ImportResponseDTO`, `ValidationIssueDTO`, `QualityScoreDTO`) moved to `packages/shared-types`, shapes unchanged; `backend/src/application/dto/*.ts` are now thin re-export shims (`export type { X } from 'shared-types';`) — every existing consumer keeps importing from `'../dto/...'` unmodified, matching the Design Review's own "no behavior change" framing for this commit.
- ✅ **New durable rule (CTO direction): `packages/shared-types` is transport contracts only** — interfaces/types/enums, never Mappers/Validators/business rules/Services. Stated in `packages/shared-types/README.md` (one sentence, visible the moment the folder is opened), formalized as an ADR-0033 addendum, and cross-referenced as a 5th Clean Architecture layering rule in `docs/DEVELOPER_HANDBOOK.md` (this package sits outside the Domain/Application/Infrastructure/Presentation layers those existing 4 rules already govern, so it needed its own explicit line).
- ✅ Verified, not assumed: `backend/` build (0 errors), lint (0 errors/warnings), 336/336 tests (identical count — no test needed to change), coverage 92.88%/93.76% (byte-identical to pre-move). A real `typography-test.docx` POSTed to a real running dev server on a scratch port returned the exact same `BookDTO`/`ImportReportDTO` JSON shape as before the migration. `frontend/`/`shared-types` re-verified; `package-lock.json` untouched (no dependency graph changed, source-only move).
- ✅ **Visible Increment Rule scope extended (CTO direction):** the log (`docs/demo/VISIBLE_INCREMENTS.md`) now covers every implementation commit from Commit 3 onward, not just `frontend/`-touching ones — a backend/tooling commit gets a small SVG diagram instead of a screenshot. First real entry written for Commit 3 ("Workspace → Shared DTOs").

**Commit 4 (`feat(frontend): home screen + API client`) — ✅ done, redefined by CTO direction:**
- ✅ **Scope redefined after Commit 3:** the original plan had Commit 4 as headless (`lib/api-client.ts`, no UI) and Commit 5 as the first visible screen. The CTO called Commit 4 a symbolic moment and asked it to ship Book Publisher Studio's actual first screen instead — `<h1>Book Publisher Studio</h1>` + a static `UploadDropzone` ("Drop your DOCX here", visual drag-over state only, no backend call yet). `lib/api-client.ts` (typed against `packages/shared-types`) is bundled into the same commit as quiet plumbing, not shipped separately and headlessly first.
- ✅ `frontend/lib/api-client.ts` — `importManuscript`/`getManuscriptOptions`/`exportManuscript`, typed fetch wrappers against `ImportResponseDTO`/`ManuscriptOptionsDTO` from `packages/shared-types`; written, not yet called from any component (Commit 5's job).
- ✅ `frontend/components/UploadDropzone.tsx` (new, client component) + `frontend/app/page.tsx` rewritten (replaces the untouched `create-next-app` default) + `frontend/app/layout.tsx` metadata title updated to "Book Publisher Studio".
- ✅ `frontend/package.json` gained the `shared-types` workspace dependency (same `"*"` pattern as `backend/`).
- ✅ Verified, not assumed: `frontend/` build (0 errors) and lint (0 errors/warnings). A real `next dev` server was started via this project's Browser tooling (`.claude/launch.json` added, `frontend`/`backend` configurations) — `get_page_text` returned the exact real page content, the browser tab title read "Book Publisher Studio". Backend reachability confirmed separately: `curl http://localhost:5000/api/manuscripts/options` returned the real response the frontend's `NEXT_PUBLIC_API_BASE_URL` default is configured to reach.
- **Directory collision found and reconciled, not silently resolved:** the CTO proposed capturing per-commit screenshots into `docs/demo/screenshots/` with a new `commit-NN-<name>.png` convention — but that directory already exists with its own README defining a *different*, already-reserved convention (`01-home.png`...`06-export.png`, the curated final Demo Script set produced once at Commit 11 from the official script against specific fixtures). Rather than create two colliding naming schemes in one directory, per-commit artifacts continue living in the `docs/demo/VISIBLE_INCREMENTS.md` / `docs/demo/visible-increments/` log already built for exactly this purpose (Commit 3's own entry). `docs/demo/screenshots/` stays untouched, reserved for Commit 11.
- **Disclosed, unresolved:** Commit 4's actual screenshot *file* is not yet committed — the real screen was rendered and visually verified in-session, but no available tool could persist the captured image to disk for `git add`. Recorded as an explicit open item in `docs/demo/VISIBLE_INCREMENTS.md`, not faked or silently dropped.
- **Disclosed:** repeated Next.js 16 Turbopack dev-console `global-error.js` manifest errors observed during verification; page rendered correctly and consistently on every check regardless — treated as a dev-mode console quirk, not a code defect, flagged for recheck once Commit 5 adds real interactivity.

**Three CTO decisions recorded (2026-07-18, after Commit 4):**
1. **Timeline consolidation:** `docs/demo/VISIBLE_INCREMENTS.md` is the single source of truth during the sprint (no separate `docs/demo/timeline/`); compiled into `docs/releases/v0.8.0-alpha/SPRINT_7_TIMELINE.md` at Commit 12, optional PDF derived from that.
2. **Commit 4's in-conversation screenshot accepted as sufficient proof** — not blocking the sprint on a committed PNG; a real capture is integrated at Sprint 7 closure instead.
3. **Turbopack dev-console noise is a tracked watch-point, not worked around** — re-verify before Commit 12, document the result there.

**Commit 5 (`feat(frontend): upload flow`) — ✅ done, the page becomes alive:**
- ✅ `UploadDropzone` now drives a real state machine (idle → uploading → success/error) via a real `POST /api/manuscripts/import` — still no book-structure rendering (Commit 6's job).
- ✅ **Bug found and fixed before ever exercised:** `lib/api-client.ts`'s `importManuscript` (written Commit 4, unused until now) treated any non-2xx response as failure — but `ManuscriptController` returns a real `ImportResponseDTO` on both 200 and 422 (pipeline ran either way). Fixed to parse both, throw only on genuine transport failures.
- ✅ Verified end to end with real fixture bytes: `backend/verification/typography-test.docx` (8964 bytes, read from disk) injected as a real dropped `File` via a synthetic `DataTransfer` — `read_network_requests` showed the real `POST .../import → 200 OK`; `get_page_text` immediately after showed the real "Import complete" / `typography-test.docx` / "Import another file" success state. No screenshot this entry (Browser pane capture tooling failed transiently, unrelated to the app) — DOM/network evidence accepted per decision 2 above.
- **New backlog (CTO direction, planned not built):** a subtitle under the title, and a "Browse Files…" fallback button — both tracked in `docs/TODO.md`.

**Commit 6 (`feat(frontend): book structure view`) — ✅ done:**
- ✅ `frontend/components/BookStructureView.tsx` (new) — renders the real `BookDTO` a successful import returns: `metadata.title`/`.author`, a `wordCount`/`pageCount`/`readingTime` stat row (each field guarded by `!= null` — not every import populates all three), and the real `mainContent` chapter/section outline (chapter number + title, nested section titles). Deliberately no validation findings (`report.issues`/`.score`) yet — Commit 7's job, stated in the component's own comment.
- ✅ `UploadDropzone.tsx` refactored — the old 3-way `useState` (`status`/`filename`/`message`) replaced by one discriminated-union `State` type that carries the full `ImportResponseDTO` through the `success` branch, so `BookStructureView` renders the real typed response rather than re-deriving it.
- ✅ Verified, not assumed: `packages/shared-types` build (`tsc`, 0 errors), `frontend/` `tsc --noEmit` (0 errors), lint (0 errors/warnings), `next build` (Turbopack, compiled successfully, static pages generated) — all re-run after this commit's changes. Both dev servers started, backend health-checked via `curl` (never `navigate`, see below), and a real end-to-end drop of `backend/verification/typography-test.docx`'s actual bytes (fetched same-origin from a temporary `frontend/public/` copy, removed immediately after and confirmed absent via `git status`) produced a real `POST /api/manuscripts/import → 200 OK` and rendered the real response — title, "Unknown · typography-test.docx", Words 81 / Pages 1 / Reading time 1 min, "Chapter 1: Chapter One: A Typography Test" / "A Subsection" — matching a direct `curl` of the same endpoint field for field.
- **Disclosed tooling incident, not a product defect:** mid-verification, the Browser pane's tab entered a broken state (`navigate` denied/failed repeatedly, then `screenshot failed: target closed`) after a JS `fetch()` of the fixture was attempted and one earlier attempt had navigated the tab directly to the `.docx` URL (likely triggering an undismissable native download prompt). `claude-in-chrome` was checked as a fallback and found not connected this session. `preview_list` then showed both dev server processes gone entirely — a full preview-session drop, not just a rendering glitch. Recovered by restarting both servers (`preview_start`) and re-verifying reachability via `curl` before touching `navigate` again; the Browser pane resumed normally on the next call. Real pixel screenshot capture itself then timed out twice more (`computer` action, same transient failure already logged at Commit 5) — accepted per the CTO's standing Commit 4/5 decision that DOM/network evidence suffices when only capture tooling fails, not the app. Full narrative in `docs/demo/VISIBLE_INCREMENTS.md`'s Commit 6 entry.
- No scope expansion — validation findings, format selection, and export preview remain explicitly out of this commit, per the user's own "finish Commit 6 exactly within its current scope" direction.

**Remaining commits (per `SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` §6 / `SPRINT_7_KICKOFF.md`):** 7-9 (validation/format-selector/export-preview UI, each required to produce a real Visible Increment entry), 10 (real-file verification pass, including the Turbopack recheck), 11 (screenshots), 12 (docs/ADR reconciliation, `docs/demo/VISIBLE_INCREMENTS.md` compiled into `SPRINT_7_TIMELINE.md`, Sprint 7 Final Report).

---

## Test Summary

Exact counts (via vitest's own JSON reporter, not hand-counted):

| Component | Tests | Notes |
|-----------|-------|-------|
| Book domain model | 10 | |
| ASTBuilder | 23 | |
| BookValidator | 6 | unchanged since Sprint 4 - still directly tested; also now `StructuralRule`'s internal implementation |
| BookMetricsCalculator | 10 | |
| HtmlNormalizer | 21 | |
| MammothParser | 4 | |
| BookMapper | 6 | |
| ImportManuscriptUseCase | 13 | Sprint 5: `BookValidator` → `ValidationEngine` wiring, one test's exact-report-equality assertion updated for the new `issues`/`score` fields |
| Manuscript import route (E2E) | 5 | |
| ThemeEngine | 4 | |
| getTheme | 2 | |
| LayoutEngine | 29 | Sprint 6: +19 (headerFooterTitle resolution, openingPageStyle, startPageNumber, automatic TOC generation) |
| DOCXRenderer | 17 | Sprint 6: +8 (real PageLayout geometry, header/footer, openingPageStyle blank pages, TOC) |
| ExportManuscriptUseCase | 7 | |
| Manuscript export route (E2E) | 12 | Sprint 6: +2 (unknown layout 400, explicit KDP layout) |
| PDFRenderer | 25 | Sprint 6: +9 (real PageLayout geometry, running head, openingPageStyle blank pages, startPageNumber footer, TOC) |
| EPUBRenderer | 11 | |
| TypographyResolver | 17 | |
| PdfFontRegistry | 7 | |
| extractPdfText | 4 | |
| **ValidationEngine** | **10** | Sprint 5, new |
| **RuleRegistry** | **4** | Sprint 5, new |
| **createValidationEngine** | **3** | Sprint 5, new |
| **StructuralRule** | **7** | Sprint 5, new |
| **MetadataRule** | **8** | Sprint 5, new |
| **HeadingRule** | **8** | Sprint 5, new |
| **MissingRequiredStyleRule** | **10** | Sprint 5, new |
| **TypographyRule** | **9** | Sprint 5, new |
| **ImageRule** | **8** | Sprint 5, new |
| **HyperlinkRule** | **13** | Sprint 5, new (includes an `it.each` over 2 URL cases) |
| **ComplianceRule** | **7** | Sprint 5, new |
| **ManualLayoutSelector** | **8** | Sprint 6, new |
| **Total** | **328** | up from 282 at Sprint 6 start (+46) |

---

## Architecture Compliance

| Rule | Status |
|------|--------|
| Domain has zero external dependencies | ✅ |
| Application depends only on interfaces (ports live in Domain) | ✅ |
| No Domain objects in DTOs | ✅ |
| Dependency Inversion enforced (constructor injection throughout) | ✅ |
| All tests passing | ✅ (328/328) |
| No circular dependencies | ✅ |
| TypeScript strict mode | ✅ |
| Controller contains no business logic | ✅ |
| Domain coverage >90% | ✅ 93.75% statements (`domain/services`, `npm run test:coverage`, final Sprint 6 run) |
| Global coverage >80% | ✅ 92.78% statements (`npm run test:coverage`, final Sprint 6 run) |
| Renderer is a port; ThemeEngine/LayoutEngine are concrete classes | ✅ (Design Review decision, ADR-0012 addendum) |
| ValidationEngine is a concrete class; ValidationRule is the swappable unit (RuleRegistry holds instances, not classes) | ✅ (Sprint 5 Design Review decision, ADR-0027/0028) |
| LayoutSelector is a port; ManualLayoutSelector is its only implementation (AutomaticLayoutSelector named, not built) | ✅ (Sprint 6 Design Review decision, ADR-0029 Decision 5) |
| Zero ESLint warnings | ✅ (0 errors, 0 warnings — held since Quality Sprint, PR #2) |

---

## Known Issues

- `backend/uploads/` history: files are untracked going forward, decided to keep past git history as-is, no purge planned (ADR-0021, closes the open decision).
- **Font asset resolved this sprint (ADR-0021 → Sprint 4 commit 6):** Gelasio (serif), Inter (sans-serif), JetBrains Mono (monospace) — all SIL OFL 1.1, real `.ttf` files embedded via `PdfFontRegistry`. No longer an open item.
- Mammoth (DOCX import) silently drops underline formatting by default — documented dependency limitation, not a pipeline bug (ADR-0025, Sprint 4). A verified workaround exists (`styleMap: ["u => u"]`) but requires a mammoth-level fix; scoped for a future "Import Fidelity" sprint. (Note: 3 related but distinct `HtmlNormalizer`/`ASTBuilder` bugs — strikethrough, inter-run whitespace, plain-text-inline dropping — were found alongside this and fixed immediately in commit 10, ADR-0026, not deferred like underline.)
- PDFKit has no native primitive for superscript/subscript/small-caps — `PDFRenderer` documents these as unrendered `TypeRun` flags (DOCX and EPUB both render them correctly; this is a PDFKit-specific gap, not a pipeline gap).
- No RTL / multi-script text support yet (ADR-0019, confirmed out of scope for Sprint 4 by explicit Design Review decision): verified no single embedded font covers every script (Arabic renders as blank boxes with the font tested), and PDFKit does no bidi reordering or Arabic contextual glyph shaping. Real, separate work — flagged, not scheduled.
- `epub-gen-memory` (ADR-0020) is a smaller-community fork (58 GitHub stars) of a more popular but unmaintained parent (`epub-gen`, 458 stars) — worth watching at upgrade time, not a reason to avoid it now.
- **`TypographyRule` is currently a no-op on every real import** (Sprint 5) — `ValidationContext.metrics` is never populated on the import path (no `PaginatedBook` exists there), so its 3 real checks (empty headings, inconsistent spacing, drop-cap ratio) never fire in production today, only in its own unit tests. Disclosed consequence of Sprint 5's "import path only" wiring scope, not a defect.
- **`MetadataRule`/`ComplianceRule` flag nearly every real DOCX import** (Sprint 5) — `ASTBuilder.buildMetadata()` never sets `isbn`/`description`/`coverImage` from DOCX content, confirmed by reading the code. Accurate, not a false positive, but a UI consuming `ImportReportDTO` should expect this, not be surprised by it.
- **`Chapter.openingPageStyle`/`startPageNumber`/`Book.frontMatter.toc.generateAutomatically` have no DOCX-native signal `ASTBuilder` can set from real content** (Sprint 6) — same category of gap as the `MetadataRule` finding above. A real DOCX uploaded through `POST /api/manuscripts/export` can never trigger blank-page insertion, page-number resets, or automatic TOC generation end-to-end today, since nothing in the import pipeline populates the fields that gate them. All three are fully implemented and verified against real rendering libraries (not mocks) via direct pipeline composition with programmatic field overrides; disclosed in `docs/REAL_EXPORT_CHECKLIST.md`'s Sprint 6 instance, not silently skipped. Natural home to close: the already-scoped future "Import Fidelity" sprint.
- **DOCX header/footer is document-wide, not per-chapter** (Sprint 6) — `RunningHead.content: 'chapterTitle'` and `Chapter.startPageNumber` both need real per-chapter behavior in a `.docx`, which requires splitting the single Word section `DOCXRenderer` builds into one section per top-level `Chapter`/`Section`. Not built this sprint (disclosed in both `DOCXRenderer.ts` and ADR-0029's Related section); doesn't affect `ClassicTheme`, whose `'bookTitle'` content is constant document-wide regardless.

---

## Technical Debt

- `QualityMetrics` is computable via `BookMetricsCalculator.calculateQualityMetrics(paginated)` (Sprint 4 commit 9) and `ImportReportDTO` now has real `issues`/`score` fields ready to carry metrics-derived findings (Sprint 5) — but `ValidationContext.metrics` is never actually populated on the import path, so `TypographyRule` is currently a no-op in every real report (see Known Issues above). Wiring `ValidationEngine` into `ExportManuscriptUseCase` (where a `PaginatedBook` exists) would close this — not scoped for any sprint yet.
- **`ValidationEngine`'s `RULE_CATEGORY` lookup (`ValidationEngine.ts`) is a string-keyed map with no compile-time link to actual rule names** — a future rule added without a matching entry silently contributes to `QualityScore.overall` but no category subscore. Disclosed in the code's own comment (Sprint 5 commit 10).
- **`ValidationContext`'s 5 reserved fields** (`configuration`, `locale`, `theme`, `rendererCapabilities`, `validationProfile`) **carry zero real usage** as of Sprint 5 — a deliberate, disclosed tradeoff to stabilize the public API now (CTO's explicit request, commit 1) rather than break it later; worth revisiting if none of them end up used by Sprint 6/7.
- `DOCXRenderer`'s footnote rendering is simplified (inline `[n] content` paragraph, not real Word footnotes) and ordered lists use a manual prefix instead of `docx`'s numbering config — both documented, deliberate simplifications, not silent gaps.
- `PDFRenderer`'s table rendering does not split a table across a forced page break (matches `LayoutEngine`'s own treatment of a table as one non-splitting unit, ADR-0013 — not an inconsistency, but a real large-table edge case that could visually overflow a page if it ever occurs).
- Hyphenation and non-English smart quotes are deliberately deferred to v2 (ADR-0024, written commit 11).
- `EPUBRenderer`'s `page-break` block renders a CSS `page-break-before` hint, not a real page break — EPUB is reflowable (ADR-0013), and reading systems vary in whether they honor the hint at all. Documented, not a silent gap.
- `docs/architecture/diagrams/BASELINE_v0.1.md`'s "86/86 tests" claim was corrected via ADR-0010 (status annotation only, content not rewritten, per the doc's own frozen/ADR-only change rule).
- **`AutomaticLayoutSelector` is named and designed for but not built** (Sprint 6, ADR-0029 Decision 5) — `ManualLayoutSelector` is the only `LayoutSelector` implementation; a real, accepted risk (same category as `ValidationContext`'s reserved fields) worth revisiting if no second implementation ever materializes.
- **`RunningHead`'s 8 fields have no consumer variety to validate the shape against** (Sprint 6, ADR-0029 Risk 5) — only `ClassicTheme` populates it; `position`/`separator`/`uppercase`/`font`/`size` are exercised by only one real theme so far.
- **A generated TOC's page is deliberately excluded from the body's own page-number sequence** (Sprint 6) — `LayoutEngine` computed body page numbers without reserving room for a TOC page; a very long TOC overflowing its own PDF page falls into the same pagination-estimate-drift bucket as any other PDFKit overflow (ADR-0013), not specially handled.
- **`ManualLayoutSelector`'s registry has no compile-time link to `PageLayout.pageSize`'s union type** (Sprint 6) — a future preset added without updating both would silently 400 via `UnknownLayoutError` rather than fail at compile time. Same category of risk as `ValidationEngine`'s `RULE_CATEGORY` lookup above.

---

## Next Session Preparation

**To resume work:** say "Read docs/SESSION_BOOTSTRAP.md and follow it" — it fixes the reading order (`START_HERE.md` → `CURRENT_STATE.md` → `TODO.md` → `DECISIONS.md` → `VERSIONS.md`) and requires a summary + explicit approval before any code is written.

**Sprint 4 is complete, merged, and tagged.** PR #9 merged (`27a4347`), `v0.5.0-alpha` tagged and pushed, `feature/sprint-4-typography-engine` deleted (local + remote).

**Sprint 5 is complete, merged, and tagged.** PR #10 merged (`3032d70`), `v0.6.0-alpha` tagged and pushed, `feature/sprint-5-validation-engine` deleted (local + remote).

**Sprint 6 is complete, merged, and tagged.** PR #11 merged (`eb05beb`), `v0.7.0-alpha` tagged and pushed, `feature/sprint-6-professional-layout-engine` deleted (local + remote). Two real bugs found and fixed during real-file verification (ADR-0031). Work happens on `main` now — there is no active feature branch.

**Sprint 7 ("First Demonstrable Product") is IN PROGRESS on `feature/sprint-7-first-demonstrable-product`.** Design Review ✅ APPROVED (round 2): `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` (now with a formal Decision Index — cite "Decision 1" through "Decision 5" instead of quoting paragraphs, CTO direction). Kickoff charter written per CTO direction: `docs/architecture/diagrams/SPRINT_7_KICKOFF.md`. A monorepo repository-structure diagram was also added to `docs/DEVELOPER_HANDBOOK.md` (CTO request). CTO go-ahead granted 2026-07-18. **Commits 1-3 done** (npm workspace, `packages/shared-types`, `GET /api/manuscripts/options`, DTO migration — see above). **Commit 4 done — the first real UI screen** (CTO redefined its scope to ship title + static drop zone; found the `docs/demo/screenshots/` naming collision and reconciled it). **Commit 5 done — the page becomes alive** (real drop → real import → success/error state; a real bug in `lib/api-client.ts`'s 422-handling found and fixed before it was ever exercised). **Three CTO decisions recorded after Commit 4** (timeline consolidation, screenshot proof accepted without a committed file, Turbopack noise tracked not worked around — full detail in the Sprint 7 section above and `docs/demo/VISIBLE_INCREMENTS.md`). **Commit 6 done — the real book structure view** (`BookStructureView` renders the real `BookDTO`: title/author, word/page/reading-time stats, chapter/section outline; `UploadDropzone` refactored to a discriminated-union state carrying the full `ImportResponseDTO`). A disclosed Browser-pane/preview-session tooling incident interrupted this commit's verification mid-stream (both dev servers dropped, not just the rendering pane) and was recovered before real verification completed — full narrative in `docs/demo/VISIBLE_INCREMENTS.md`'s Commit 6 entry. **Next action: Commit 7** — validation findings UI (render `report.issues`/`.score` from `ImportReportDTO`, deliberately deferred by both Commit 5 and Commit 6).

**Quick Start:**
```bash
cd "D:\Book Publisher Studio\backend"
git checkout main && git pull
npm test               # Verify all 328 tests pass
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

**Branch:** `feature/sprint-7-first-demonstrable-product`, at `b0865b7` (Commit 6: book structure view; this docs-sync commit follows immediately on top), branched from `main` at `31b3139`. `main` itself is at `31b3139`, tag `v0.7.0-alpha` (on an earlier commit, `eb05beb` — `main` has moved on with docs-only commits since).
**`main` history (most recent first):** `31b3139` (Sprint 7 Kickoff charter + frontend commit-visibility rule) → `7b8d98f` (Sprint 7 Design Review round 2 approval + `docs/product/` layer) → `acc4f9b` (Sprint 7 Design Review round 1 draft) → `ff1fcae` (CLAUDE.md restructuring + ADR-0032 Engineering Governance Principle) → `1d06643` (post-Sprint-6 Quality Gate/Testing Strategy/Real Fixture Policy docs) → `238bf37` (post-merge docs/release commit, Sprint 6) → `eb05beb` (**merge PR #11** — Sprint 6, Professional Layout Engine, tagged `v0.7.0-alpha`) → further back per prior entries.
**`feature/sprint-7-first-demonstrable-product` history (most recent first):** `b0865b7` (Commit 6 — book structure view; this docs-sync commit lands immediately on top, hash not yet known at the time this line was written — see the next docs pass for its own hash) → `a94acac` (docs: record 3 CTO decisions + log Commit 5) → `27e4780` (Commit 5 — upload flow) → `f09347a` (docs: log Commit 4, reconcile screenshots dir) → `e026536` (Commit 4 — home screen + API client) → `eb5e2e3` (docs: sync with Commit 3) → `2046711` (Visible Increment Rule scope extension + Commit 3 diagram) → `5e0e561` (Commit 3 — DTOs re-exported from `packages/shared-types`, ADR-0033 addendum, `DEVELOPER_HANDBOOK.md` rule 5) → `29d3be4`/`e8cf68f` (Visible Increment Rule formalized) → `a1520fb` (hash fix) → `6ded695` (Commit 2 — `GET /api/manuscripts/options`) → `f286a46` (Decision Index + repository structure diagram) → `cb04678` (hash fix) → `583522c` (Commit 1 — npm workspace conversion, `packages/shared-types` scaffold, ADR-0033) → branched from `main` at `31b3139`.
**Remote:** https://github.com/idealsuitesite/book-publisher-studio
**Tags:** `v0.1.0-alpha.1`, `v0.2.0-alpha`, `v0.3.0-alpha`, `v0.4.0-alpha`, `v0.4.1-alpha` (EPUB export — see `docs/releases/v0.4.1-alpha/ReleaseNotes.md`), `v0.5.0-alpha` (Typography Engine — see `docs/releases/v0.5.0-alpha/ReleaseNotes.md`), `v0.6.0-alpha` (Validation Engine, cut 2026-07-17, PR #10 — see `docs/VERSIONS.md` and `docs/releases/v0.6.0-alpha/ReleaseNotes.md`), **`v0.7.0-alpha`** (Professional Layout Engine, cut 2026-07-17, PR #11 — see `docs/VERSIONS.md` and `docs/releases/v0.7.0-alpha/ReleaseNotes.md`).
**Open branches:** none — `feature/sprint-6-professional-layout-engine` deleted (local + remote) after PR #11 merged.
