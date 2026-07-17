# Current State - Book Publisher Studio

**Last Updated:** July 17, 2026 (Sprint 5 Validation Engine implementation-complete, all 11 commits done — governance closure done, PR pending)
**Sprint:** Sprint 4 ("Typography Engine") **✅ COMPLETE AND RELEASED** (PR #9, merge commit `27a4347`, tag `v0.5.0-alpha`, 195/195 tests at release). Sprint 5 ("Validation Engine") **✅ IMPLEMENTATION COMPLETE**, all 11 commits done and CTO-approved one by one: `ValidationEngine` orchestrating a `RuleRegistry` of 8 pure `ValidationRule`s (`StructuralRule`, `MetadataRule`, `HeadingRule`, `MissingRequiredStyleRule`, `TypographyRule`, `ImageRule`, `HyperlinkRule`, `ComplianceRule`), wired into `ImportManuscriptUseCase`. Two-level Design Review (`docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` + `VALIDATION_ENGINE.md`) approved before any code; a "Document Intelligence Engine" sixth candidate was proposed and explicitly withdrawn. ADR-0027 (read-only) and ADR-0028 (rule design principles) written. `docs/releases/v0.6.0-alpha/SPRINT_5_FINAL_REPORT.md` records the full retrospective. 282/282 tests, 91.77% global / 93.06% domain coverage, `npm run verify-real-export` 16/16. **PR not yet opened — pending explicit go-ahead.**
**Branch:** `feature/sprint-5-validation-engine` at `8c5c695` (commit 11, final implementation commit), pushed to `origin`. Not yet merged.

---

## Summary

**Completed (Sprint 4, all 11 commits):** Domain types (`ResolvedTypography`/`TypeRun`), additive `StyledBook.blockTypography`, `TypographyResolver` (inline run resolution, drop caps, English-only smart quotes, forced quote/scripture italics, heading `staysWithNext`), `LayoutEngine` keep-with-next pagination support, real font embedding (Gelasio/Inter/JetBrains Mono, SIL OFL, 12 `.ttf` files in `backend/assets/fonts/`) with a role-based `PdfFontRegistry` API (`resolveBody`/`resolveHeading`/`resolveMonospace`/`resolveDefault`), full `TypeRun` rendering support in `PDFRenderer`/`DOCXRenderer`/`EPUBRenderer`, `BookMetricsCalculator.calculateQualityMetrics(paginated: PaginatedBook): QualityMetrics` activating all 7 `QualityMetrics` fields with real computed values, a completed E2E real-file verification pass (commit 10) that found and fixed 3 real content-fidelity bugs in the import pipeline (ADR-0026), and a final docs/ADR pass (commit 11: ADR-0022/0023/0024, `docs/releases/v0.5.0-alpha/SPRINT_4_FINAL_REPORT.md`). 195 tests passing ✅, 90.49% global / 92.57% domain coverage, 0 ESLint warnings, re-verified before every commit via `npm run build`, `npm run lint`, `npm test`, `npm run verify-server`, and `npm run verify-real-export` (16/16 checks: 4 fixtures × import + export-docx/pdf/epub).
**Next:** Sprint 4 is merged (PR #9, `27a4347`) and tagged `v0.5.0-alpha`. Sprint 5 (Validation Engine) is now **implementation-complete** on `feature/sprint-5-validation-engine` (11/11 commits, 282/282 tests) — see the dedicated Sprint 5 section below and `docs/releases/v0.6.0-alpha/SPRINT_5_FINAL_REPORT.md`. **PR not yet opened**, pending explicit go-ahead (same gate used for Sprint 4).

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

## Sprint 5: Validation Engine ✅ IMPLEMENTATION COMPLETE (branch `feature/sprint-5-validation-engine`, target tag `v0.6.0-alpha`, PR not yet opened)

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
- [ ] Open the Sprint 5 PR — pending explicit go-ahead (not yet requested)

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
| LayoutEngine | 10 | |
| DOCXRenderer | 9 | |
| ExportManuscriptUseCase | 7 | |
| Manuscript export route (E2E) | 10 | |
| PDFRenderer | 16 | |
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
| **Total** | **282** | up from 195 at Sprint 5 start (+87) |

---

## Architecture Compliance

| Rule | Status |
|------|--------|
| Domain has zero external dependencies | ✅ |
| Application depends only on interfaces (ports live in Domain) | ✅ |
| No Domain objects in DTOs | ✅ |
| Dependency Inversion enforced (constructor injection throughout) | ✅ |
| All tests passing | ✅ (282/282) |
| No circular dependencies | ✅ |
| TypeScript strict mode | ✅ |
| Controller contains no business logic | ✅ |
| Domain coverage >90% | ✅ 93.06% statements (`domain/services`, `npm run test:coverage`, final Sprint 5 run) |
| Global coverage >80% | ✅ 91.77% statements (`npm run test:coverage`, final Sprint 5 run) |
| Renderer is a port; ThemeEngine/LayoutEngine are concrete classes | ✅ (Design Review decision, ADR-0012 addendum) |
| ValidationEngine is a concrete class; ValidationRule is the swappable unit (RuleRegistry holds instances, not classes) | ✅ (Sprint 5 Design Review decision, ADR-0027/0028) |
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

---

## Next Session Preparation

**To resume work:** say "Read docs/SESSION_BOOTSTRAP.md and follow it" — it fixes the reading order (`START_HERE.md` → `CURRENT_STATE.md` → `TODO.md` → `DECISIONS.md` → `VERSIONS.md`) and requires a summary + explicit approval before any code is written.

**Sprint 4 is complete, merged, and tagged.** PR #9 merged (`27a4347`), `v0.5.0-alpha` tagged and pushed, `feature/sprint-4-typography-engine` deleted (local + remote).

**Sprint 5 (Validation Engine) is implementation-complete but not yet merged.** All 11 commits done and CTO-approved on `feature/sprint-5-validation-engine`, pushed to `origin`. Governance closure (this pass) done: `docs/releases/v0.6.0-alpha/SPRINT_5_FINAL_REPORT.md`, ADR-0028, `CURRENT_STATE.md`/`TODO.md`/`VERSIONS.md` reconciled. **Next action: open the Sprint 5 PR** (`feature/sprint-5-validation-engine` → `main`) — this needs explicit user go-ahead in-session (PR creation is a shared-state action), not something to do automatically on session resume. If a new session starts before that PR is opened, check `git log origin/main..feature/sprint-5-validation-engine` first to see whether it happened in the meantime.

**After the PR merges:** tag `v0.6.0-alpha`, write `docs/releases/v0.6.0-alpha/ReleaseNotes.md`, flip `VERSIONS.md`'s row to Released, delete the feature branch — same close-out sequence used for Sprint 4. Then Sprint 6's scope is **not yet decided** — Editorial AI Engine, Plugin System, Professional Layout Engine, and Publishing Engine are all mapped at Level 1 (`docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md`) with real dependencies fixed (Editorial AI Engine depends on Validation Engine's output) but no relative ordering or Sprint assignment decided — resolve that with a dedicated Design Review per engine, one at a time, not by assumption.

**Quick Start (on the Sprint 5 branch, until merged):**
```bash
cd "D:\Book Publisher Studio\backend"
git checkout feature/sprint-5-validation-engine && git pull
npm test               # Verify all 282 tests pass
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

**`main`:** at `599e297` ("docs(sprint-5): add Sprint 5 Kickoff charter") — all Sprint 5 Design Review/Kickoff docs live on `main` (committed directly, matching the docs-only exception to ADR-0017 already used for Sprint 4's post-merge release docs). No code on `main` beyond what PR #9 merged.
**`feature/sprint-5-validation-engine`:** at `8c5c695` (commit 11, final implementation commit), branched from `main` at `599e297`, pushed to `origin`. **Not yet merged** — this is the active work branch. 11 implementation commits (oldest first): `0280ae0` → `6c4d2df` (docs touch-up) → `fe41025` → `0b6bd2f` → `4eba321` → `132ad93` → `e183cf8` → `8a41f4c` → `c8182c6` → `1f3ea5c` → `f9115cd` → `8c5c695`.
**Remote:** https://github.com/idealsuitesite/book-publisher-studio
**Tags:** `v0.1.0-alpha.1`, `v0.2.0-alpha`, `v0.3.0-alpha`, `v0.4.0-alpha`, `v0.4.1-alpha` (EPUB export — see `docs/releases/v0.4.1-alpha/ReleaseNotes.md`), `v0.5.0-alpha` (Typography Engine, PR #9 — see `docs/VERSIONS.md` and `docs/releases/v0.5.0-alpha/ReleaseNotes.md`). **`v0.6.0-alpha` (Validation Engine) not yet cut** — tags only after merge, per this file's own established rule.
**Open branches:** `feature/sprint-5-validation-engine` (active, pending PR).
