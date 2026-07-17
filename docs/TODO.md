# TODO - Book Publisher Studio

**Last Updated:** July 17, 2026 (Sprint 6 Professional Layout Engine implementation complete on its feature branch, real-file verified; PR not yet opened)

---

## 🔴 BLOCKED

None currently.

---

## 🟡 IN PROGRESS

**Sprint 6 (Professional Layout Engine)** — Design Review ✅ APPROVED (`docs/architecture/diagrams/PROFESSIONAL_LAYOUT_ENGINE.md`, ADR-0029, `docs/architecture/diagrams/SPRINT_6_KICKOFF.md`), **implementation ✅ COMPLETE** on `feature/sprint-6-professional-layout-engine` (commit 0 spike + 10 numbered commits + 2 disclosed fix commits, 328/328 tests, `npm run verify-server`/`verify-real-export` both green). Two real bugs found and fixed during real-file verification, ADR-0031. See the COMPLETED section below and `docs/releases/v0.7.0-alpha/SPRINT_6_FINAL_REPORT.md` for full detail. **PR not yet opened** — awaiting explicit go-ahead to push the branch and open it.

Sprint 5 (Validation Engine) is **complete, merged, and released** — all 11 commits done, tested (282/282), verified against real files (`npm run verify-server` + `npm run verify-real-export`, 16/16 checks), merged via PR #10 (`3032d70`), tagged `v0.6.0-alpha`. See the COMPLETED section below and `docs/releases/v0.6.0-alpha/SPRINT_5_FINAL_REPORT.md` / `ReleaseNotes.md` for full detail. `feature/sprint-5-validation-engine` deleted (local + remote).

Sprint 4 (Typography Engine) is **complete, merged, and released** — all 11 commits done, tested (195/195 at the time), verified against real files, merged via PR #9 (`27a4347`), tagged `v0.5.0-alpha`. See the COMPLETED section below for the summary and `docs/releases/v0.5.0-alpha/SPRINT_4_FINAL_REPORT.md` / `ReleaseNotes.md` for full detail. `feature/sprint-4-typography-engine` deleted (local + remote).

**Reference notes carried over from Sprint 4 (still live, not sprint-specific status):**

**Real bugs found and fixed along the way, each in its own dedicated branch/PR (not folded into Sprint 4):**
- PDFKit crash on headerless tables (`fix/pdf-table-without-header`, PR #8, merged) — see ADR/commit `4b40039`
- Server-verification tooling (`chore/server-verification-tooling`, PR #6 + follow-up PR #7 for an orphaned commit) — `npm run verify-server` / `npm run verify-real-export`, both merged to `main` before Sprint 4 resumed

**Dependency limitation documented, not fixed this sprint:** Mammoth (DOCX import) silently drops underline formatting by default (ADR-0025) — regression test added, workaround identified but not applied; requires a mammoth-level `styleMap` fix, scoped for a future "Import Fidelity" sprint (see Backlog below). (3 related but distinct `HtmlNormalizer`/`ASTBuilder` bugs found alongside this — strikethrough, inter-run whitespace, plain-text-inline dropping — were fixed immediately as an explicit scope exception, ADR-0026, not left open like this one.)

### Governance pass (ADR-0021, 2026-07-17) — all four resolved

- [x] Tag `v0.4.1-alpha` — created and pushed
- [x] **Remove legacy `/api/upload` route** (`docxParser.ts`, disk-based multer) — removed on `chore/remove-legacy-upload-route`, Sprint 3 having completed satisfies ADR-0011's precondition
- [x] **Font asset for PDF/theme rendering** (surfaced by ADR-0019): **Decided — Gelasio** (SIL OFL, metrically compatible with Georgia), later expanded to Gelasio + Inter + JetBrains Mono per the Sprint 4 Design Review. **Embedded — done, Sprint 4 commit 6.**
- [x] `backend/uploads/` history — **kept as-is, no purge** (untracked going forward is sufficient)

- [ ] **RTL / multi-script text support** (surfaced by ADR-0019): no single embedded font covers every script (verified: Arabic renders as blank boxes, Greek dropped a glyph), and PDFKit does no bidi reordering or Arabic contextual shaping. Real work, not a font swap — flagged, not scheduled.

### Low Priority (Sprint 7+)

- [x] ~~`ValidatorEngine`~~ — now **Validation Engine**, Sprint 5, **implemented** (`ValidationEngine` + `RuleRegistry` + 8 rules, wired into `ImportManuscriptUseCase`). See the COMPLETED section below.
- [ ] Plugin system — **narrowed scope decided** (2026-07-17, `PLATFORM_ARCHITECTURE_ROADMAP.md` §2.3): AI-provider abstraction (OpenAI/Claude/Gemini/Mistral/DeepSeek/local models), reconciled with `docs/VISION.md`'s broader existing plugin scope as a mechanism inside it, not a competing system. Still no Design Review, no Sprint assignment.
- [ ] Premium UI/UX (Next.js frontend)
- [ ] AI features (explicitly deferred — architecture should stay extensible for these, not build them now)
- [ ] **Editorial AI Engine** (see `docs/VISION.md`'s dedicated section, and `PLATFORM_ARCHITECTURE_ROADMAP.md` §2.2 for its fixed dependency on Validation Engine's output) — independent module, own pipeline stage between Normalizer and Theme Engine, entirely separate from rendering so the rendering pipeline stays deterministic. Humanization, grammar/style correction, accept/reject suggestions, readability analysis, manuscript consistency checks, AI writing assistant. Realistically its own Sprint 6/7. **Not scoped in detail, no code/ADR/Level-2-Design-Review yet.** Validation Engine (its dependency) is now merged and released (`v0.6.0-alpha`), so this is unblocked whenever it's prioritized — not automatically next.
- [x] ~~`Professional Layout Engine`~~ — now **Sprint 6**, **implemented** (`LayoutEngine` extended, not a new class, ADR-0029; real `PageLayout` presets, `LayoutSelector`, `RunningHead`, `openingPageStyle`/`startPageNumber`, automatic TOC generation). See IN PROGRESS above and the COMPLETED section below.
- [ ] **Publishing Engine** (see `PLATFORM_ARCHITECTURE_ROADMAP.md` §2.5) — KDP/Kobo/Apple Books/Google Play Books packaging, sits after the `Renderer` port; owns `PostRenderValidation` per `VALIDATION_ENGINE.md`'s Sprint 5 scope decision. No Design Review, no Sprint assignment. Overlaps the "Kindle / Kobo / Lulu / IngramSpark / Amazon KDP export targets" Backlog item below — to be reconciled when this engine gets its own Design Review.
- [ ] **Import Fidelity** (new, 2026-07-17 — see ADR-0025, ADR-0026) — a dedicated future sprint to improve or replace what `MammothParser`/`ASTBuilder` actually preserves or exposes from a real DOCX. Confirmed gap still open: underline formatting is silently dropped by mammoth's default behavior (ADR-0025 — a documented, verified workaround exists via mammoth's own `styleMap` option, not applied during Sprint 4; this specifically requires a mammoth-level fix, unlike the 3 findings below). Three related findings already **fixed** during Sprint 4 commit 10 as an explicit scope exception, not deferred (ADR-0026): strikethrough silently downgraded to plain text, inter-run whitespace silently dropped (word-jamming), and `ASTBuilder.convertInlines()` filtering out plain text + a silent bold fallback for unhandled inline types. **New gap added Sprint 6 (ADR-0031):** `Chapter.openingPageStyle`/`startPageNumber` and `Book.frontMatter.toc.generateAutomatically` have no DOCX-native signal `ASTBuilder` can set from real content — same category as the pre-existing `isbn`/`description`/`coverImage` gap (Sprint 5). All three Sprint 6 fields are fully implemented and real-file verified via direct pipeline composition, just never reachable through a real DOCX upload today. Remaining candidates to evaluate with real spike evidence, matching ADR-0019/ADR-0020's precedent: highlight, track changes, comments, text boxes, SmartArt, floating images, nested tables, DrawingML — none of these individually verified yet, named from the CTO's proposed backlog only. **Not scoped, not designed** — explicitly deferred until prioritized.
- [ ] **Documentation & Learning Platform** (new, 2026-07-17 — proposed by the CTO after Sprint 4 commit 8) — a dedicated future phase covering: (1) a full documentation strategy, (2) user/developer/admin documentation infrastructure, (3) a training academy (guides, tutorials, videos, certification), (4) an in-app Learning Center, (5) a knowledge base to underpin the future AI Assistant. Proposed strategic docs: `PRODUCT_VISION.md`, `PRODUCT_REQUIREMENTS.md`, `DOCUMENTATION_MASTER_PLAN.md`, `TRAINING_MASTER_PLAN.md`, `AI_KNOWLEDGE_BASE.md`, `CERTIFICATION_PROGRAM.md`, `LEARNING_CENTER_SPEC.md`, `VIDEO_PRODUCTION_GUIDE.md`. CTO's own proposed commit breakdown (10 commits): product vision → product requirements → documentation master plan → learning center → video academy → certification → AI knowledge base → documentation templates → example projects → final validation — same per-commit rigor (Design Review, ADR where warranted, docs, verification) as the rendering-pipeline sprints. **Naming conflict, now resolved by elimination:** the CTO originally referred to this as "Sprint 5," but Sprint 5 was subsequently defined and fully implemented as **Validation Engine** (`v0.6.0-alpha`) via its own Design Review. This item still has no version/sprint slot reserved — it needs a fresh number once actually scoped, not "Sprint 5" under any interpretation. **Not scoped, not designed, no ADR/Design Review yet.**
- [ ] Licensing/subscription model, observability/telemetry (also explicitly deferred — no DB/auth exists yet)

**Sprint 5+ priority ordering — RESOLVED (2026-07-17) by the actual Sprint 5 Design Review, and now implemented**, superseding both of the two competing proposals recorded here during Sprint 4: **Validation Engine was Sprint 5** (matched the original CTO priority order's #2 slot, "ValidatorEngine" — now shipped, `docs/architecture/diagrams/VALIDATION_ENGINE.md`, `docs/releases/v0.6.0-alpha/SPRINT_5_FINAL_REPORT.md`). **Sprint 6 is Professional Layout Engine**, Design Review approved (`docs/architecture/diagrams/PROFESSIONAL_LAYOUT_ENGINE.md`, ADR-0029) — chosen for its lowest-risk profile among the 3 remaining candidates. Editorial AI Engine, Plugin System, and Publishing Engine remain mapped in `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` §2 with real dependencies fixed (Editorial AI Engine depends on Validation Engine's output) but **no Sprint 7+ assignment or relative ordering among them decided yet** — that's each engine's own future Design Review to resolve, one at a time, same discipline as this one.

**Typography Engine Design Review — ✅ APPROVED (2026-07-17)** (`docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md`). Final architecture: `ThemeEngine → TypographyResolver → LayoutEngine → Renderer`, `StyledBook` gains an additive `blockTypography` field (no `TypesetBook`, no `LayoutEngine`/`PaginatedBook`/`Renderer` signature changes). Final scope decisions: block-type typography rules (quote italics, etc.) are `TypographyResolver`-internal defaults, not `Theme`-configurable in v1; fonts are Gelasio (serif) + Inter (sans-serif) + JetBrains Mono (monospace), not Gelasio alone; RTL confirmed out of scope; hyphenation confirmed deferred to v2; smart quotes English-only v1; `QualityMetrics` gains `averageHeadingDepth`/`paragraphDensity`/`lineDensity`/`dropCaps` with functional definitions locked. **Fully implemented on `feature/sprint-4-typography-engine` — all 11 commits done and verified** (see the COMPLETED section below and `docs/releases/v0.5.0-alpha/SPRINT_4_FINAL_REPORT.md` for full detail).

**Sprint 5 (Validation Engine) — ✅ COMPLETE, MERGED, AND RELEASED (2026-07-17)**, Design Review (two levels, `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` + `docs/architecture/diagrams/VALIDATION_ENGINE.md`) fully implemented across 11 commits. Final architecture: `ValidationEngine` orchestrates a `RuleRegistry` of independent, pure `ValidationRule`s (`StructuralRule`, `MetadataRule`, `HeadingRule`, `MissingRequiredStyleRule`, `TypographyRule`, `ImageRule`, `HyperlinkRule`, `ComplianceRule`); `validate(context: ValidationContext)` replaced the originally-proposed `validate(book, paginated?)`; `ValidationSeverity` (`ERROR`/`WARNING`/`INFO`/`SUGGESTION`) generalizes the old binary error/warning split, with `ValidationReport.errors`/`.warnings` kept as backward-compatible derived views; `QualityScore` composite scoring (severity-weighted, per-category). Wired into `ImportManuscriptUseCase`. **ADR-0027 (read-only) and ADR-0028 (rule design principles) written.** Merged via PR #10 (`3032d70`), tagged `v0.6.0-alpha`. See `docs/releases/v0.6.0-alpha/SPRINT_5_FINAL_REPORT.md` and `ReleaseNotes.md` for full detail.

**New permanent governance policy (2026-07-17):** `docs/REAL_EXPORT_CHECKLIST.md` created — mandatory for any change touching the rendering pipeline (renderers, `ThemeEngine`, `LayoutEngine`, future `TypographyResolver`, `Renderer` port, `ExportManuscriptUseCase`). Enforced via a new gate in `docs/MERGE_CHECKLIST.md` and referenced in `docs/CLAUDE.md` so it applies automatically in future sessions without being re-requested.

---

## ✅ COMPLETED

### Sprint 1 - Phase 1: Domain + Infrastructure

- ✅ Book domain model
- ✅ ASTBuilder service
- ✅ HtmlNormalizer
- ✅ Block types
- ✅ 43 tests passing originally (Book: 7, ASTBuilder: 19, HtmlNormalizer: 17); 6 more added during Phase 2's coverage push (Book: +3, ASTBuilder: +3) for previously-untested type guards and block/inline conversion branches

### Sprint 1 - Phase 2: Application + Presentation

- ✅ `BookValidator`, `BookMetricsCalculator` (Domain — moved out of `ASTBuilder`)
- ✅ `UseCase<TRequest,TResponse>` contract
- ✅ 8 DTOs (Metadata, Inline, Block, Chapter, Section, Book, ImportReport, ImportResponse)
- ✅ 4 Mappers (Block, Section, Chapter, Book) — pure conversion
- ✅ `ImportManuscriptUseCase` (Dependency Inversion via constructor injection)
- ✅ `MammothParser` (Infrastructure, implements `DocumentParser`)
- ✅ `ManuscriptController` + `POST /api/manuscripts/import` route + error handling middleware
- ✅ ESLint, Prettier, vitest coverage, GitHub Actions CI — none of which existed before this phase
- ✅ **88 total tests passing**, verified against a real DOCX POSTed to a running server

### Sprint 2 - Rendering Engine (merged via PR #1, `32ac220`)

- ✅ `ThemeEngine` (concrete class) + Classic built-in theme + `getTheme(name)` registry
- ✅ `LayoutEngine` (concrete class) — heuristic pagination, returns `PaginatedBook`
- ✅ `Renderer<TOutput>` port + `DOCXRenderer` (uses the `docx` npm package, ADR-0018)
- ✅ `ExportManuscriptUseCase` + `POST /api/manuscripts/export` + `ExportController`
- ✅ `UnknownThemeError` (typed, maps unknown theme names to 400)
- ✅ **118 total tests passing**, re-verified on merged `main` (not just the feature branch), plus a real DOCX exported end-to-end
- ✅ Design Review completed and approved *before* any implementation code (ADR-0012 through ADR-0018)

### Quality Sprint (merged via PR #2, `c507f5d`)

- ✅ All 37 `@typescript-eslint/no-explicit-any` warnings eliminated (14 in `HtmlNormalizer.ts` with real cheerio/domhandler types, 21 across two test files with proper Domain type casts, 2 `catch` blocks narrowed via `instanceof Error`)
- ✅ No behavior change — 118/118 tests unchanged, coverage unchanged
- ✅ ESLint now reports **0 errors, 0 warnings**

### Sprint 3A - PDF Export (merged via PR #3, `820f1ef`; tagged `v0.4.0-alpha`)

- ✅ PDFKit spike + ADR-0019 completed before any renderer code (fonts, Unicode, images, tables, page breaks, headers/footers, bleed, crop marks all verified against real output)
- ✅ `PDFRenderer` (uses `pdfkit`, ADR-0014) — mirrors `DOCXRenderer`'s block coverage; built on `bufferPages: true` after three real bugs were found and fixed (ADR-0019 finding 6: stack overflow, cursor-strand page blowup, wrong "Page N of TOTAL" caught against a real DOCX from `backend/uploads/`)
- ✅ PDF export reuses `ExportManuscriptUseCase` as-is (no new Use Case class) + `POST /api/manuscripts/export` gains a `format` field
- ✅ **125 total tests passing** (up from 118), 84.47% global coverage, re-verified on merged `main` (not just the feature branch), plus a real DOCX exported to both `.docx` and `.pdf` end-to-end

### Sprint 3B - EPUB Export (merged via PR #4, `a7a38a0`; tagged `v0.4.1-alpha`)

- ✅ EPUB library spike + ADR-0020 resolves ADR-0015 (`backend/spikes/epub-library-spike.ts`) — `epub-gen-memory` chosen over the unmaintained `epub-gen` and over hand-rolling OCF/OPF/XHTML
- ✅ `EPUBRenderer` (uses `epub-gen-memory`, ADR-0020) — serializes the same block types the other two renderers handle into HTML per chapter; images with embedded data written to a scoped temp dir and referenced via `file://` (ADR-0020 finding 5)
- ✅ EPUB export reuses `ExportManuscriptUseCase` as-is + `POST /api/manuscripts/export`'s `format` field gains `epub`
- ✅ **133 total tests passing** (up from 125), 84.01% global coverage; a real DOCX from `backend/uploads/` exported to `.epub` end-to-end caught and fixed a real empty-output bug (ADR-0020 addendum)

### Post-Sprint-3 Governance Pass (ADR-0021)

- ✅ `v0.4.1-alpha` tagged
- ✅ Legacy `/api/upload` route + `docxParser.ts` + disk-based multer config removed (`chore/remove-legacy-upload-route`)
- ✅ Font policy decided: Gelasio (SIL OFL) — decision only, embedding deferred to Sprint 4
- ✅ `backend/uploads/` git history: kept as-is, no purge

### Sprint 4 - Typography Engine (merged via PR #9, `27a4347`; tagged `v0.5.0-alpha`)

- ✅ `TypographyResolver` (new concrete Domain service) — inline run resolution (`Block.inlines` → `TypeRun[]`), drop caps, English-only smart quotes, forced quote/scripture italics, heading `staysWithNext` keep-with-next signal (ADR-0022)
- ✅ `StyledBook.blockTypography?` — additive field, no signature change to `LayoutEngine.paginate()`, `PaginatedBook`, or `Renderer<TOutput>` (the larger `TypesetBook` proposal was reviewed and rejected for blast radius before any code was written)
- ✅ Real PDF font embedding — Gelasio/Inter/JetBrains Mono, 12 `.ttf` files, role-based `PdfFontRegistry` API (ADR-0023)
- ✅ Full `TypeRun` rendering (bold/italic/underline/strikethrough/superscript/subscript/small-caps/links) in `PDFRenderer`/`DOCXRenderer`/`EPUBRenderer` — closes a real gap where none of the three renderers rendered inline formatting at all before this sprint
- ✅ `BookMetricsCalculator.calculateQualityMetrics(paginated)` — activates all 7 `QualityMetrics` fields (3 from ADR-0008, 4 new) with real computed values, resolving ADR-0008's deferred item
- ✅ E2E real-file verification pass (commit 10) found and fixed 3 real content-fidelity bugs in the import pipeline as an explicit scope exception (ADR-0026) — strikethrough silently downgraded to plain text, inter-run whitespace silently dropped (word-jamming), `ASTBuilder` silently dropping plain-text inlines / mislabeling unknown types as bold
- ✅ Hyphenation and locale-aware (non-English) smart quotes formally confirmed deferred to v2 (ADR-0024)
- ✅ **195 total tests passing** (up from 133), 90.49% global / 92.57% domain coverage, 0 ESLint warnings; `npm run verify-server` + `npm run verify-real-export` both green (16/16) on every commit; real DOCX/EPUB output text-extracted and read directly, not just asserted via `npm test`
- ✅ Full retrospective: `docs/releases/v0.5.0-alpha/SPRINT_4_FINAL_REPORT.md` (objectives, ADRs created, historical bugs, final metrics, deferred items, residual risks, lessons learned)

### Sprint 5 - Validation Engine (merged via PR #10, `3032d70`; tagged `v0.6.0-alpha`)

- ✅ Two-level Design Review (`docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` + `VALIDATION_ENGINE.md`) — mapped all 5 remaining engines (Validation, Editorial AI, Plugin System, Professional Layout, Publishing) before designing any one in depth; a sixth candidate ("Document Intelligence Engine") was proposed and explicitly withdrawn for responsibility overlap
- ✅ `ValidationEngine` orchestrating a `RuleRegistry` of 8 independent, pure rules (`StructuralRule`, `MetadataRule`, `HeadingRule`, `MissingRequiredStyleRule`, `TypographyRule`, `ImageRule`, `HyperlinkRule`, `ComplianceRule`) — replaces the structural-only `BookValidator` (still alive, now `StructuralRule`'s internal implementation)
- ✅ `ValidationContext`/`ValidationSeverity` (`ERROR`/`WARNING`/`INFO`/`SUGGESTION`)/`ValidationIssue`/`ValidationReport`/`QualityScore` — new additive types; `validate(context)` replaces the originally-sketched `validate(book, paginated?)` to stabilize the public API against future per-platform rule variants
- ✅ `QualityScore` composite scoring — severity-weighted penalty formula, per-category subscores, strictly an interpretation layer over `ValidationIssue[]`, never a substitute for them
- ✅ Activates `QualityMetrics` (built Sprint 4 commit 9, zero consumers until now) as real rule input via `TypographyRule`
- ✅ Wired into `ImportManuscriptUseCase` + new DTOs (`ValidationIssueDTO`, `QualityScoreDTO`); confirmed against the real running server importing `typography-test.docx`/`large-book.docx` — real, non-hardcoded warnings and scores
- ✅ ADR-0027 (Validation Engine is read-only, written before commit 1) and ADR-0028 (3 rule-design principles confirmed as official policy across commits 6/7/9: no always-firing or always-passing rules, only diagnose from reliable modeled data, rule identity is business intent not exclusive field access)
- ✅ **282 total tests passing** (up from 195), 91.77% global / 93.06% domain coverage, 0 ESLint warnings; every one of the 8 rules has its own test file including an ADR-0027 immutability check; `npm run verify-server` + `npm run verify-real-export` both green (16/16)
- ✅ Full retrospective: `docs/releases/v0.6.0-alpha/SPRINT_5_FINAL_REPORT.md` (objectives, ADRs created, design-review gaps found mid-sprint, final metrics, deferred items, residual risks, lessons learned)

### Sprint 6 - Professional Layout Engine (implementation complete on `feature/sprint-6-professional-layout-engine`; PR not yet opened)

- ✅ KDP/platform trim-size spike (`backend/spikes/kdp-trim-size-spike.ts`, ADR-0030) completed before any preset code, matching the ADR-0019/0020 precedent — A4/A5 verified against PDFKit's own real runtime output, KDP sizes fetched directly from kdp.amazon.com
- ✅ `LayoutEngine` extended, not replaced (ADR-0029 Decision 1) — real `PageLayout` presets (A4/A5/KDP 5x8/5.5x8.5/6x9), `LayoutSelector` port + `ManualLayoutSelector` (`AutomaticLayoutSelector` named, not built), `Theme.runningHead` (`ClassicTheme` populated), per-page header/footer resolution, `Chapter.openingPageStyle`/`startPageNumber` honored, automatic Table of Contents generation
- ✅ `ExportController` calls `LayoutSelector.select()` instead of hardcoding `LetterPageLayout`; `POST /api/manuscripts/export` gains an optional `layout` field
- ✅ `PDFRenderer`/`DOCXRenderer` both render real headers/footers, drop the hardcoded `'Book Publisher Studio'` string, render real blank pages for `openingPageStyle`, and render a real generated TOC as front-matter content; EPUB confirmed unaffected (ADR-0029 Decision 3)
- ✅ **Two real bugs found and fixed during real-file verification (ADR-0031), not deferred:** neither renderer had ever consumed `PageLayout` at all (every new preset would have had zero effect on real output); automatic TOC generation originally walked only `Heading` blocks, which real DOCX imports never produce (real headings become `Chapter`/`Section` titles instead) — found against `large-book.docx`'s 15 real chapters, fixed, re-verified against the same fixture
- ✅ **328 total tests passing** (up from 282), 92.78% global / 93.75% domain coverage, 0 ESLint warnings; `npm run verify-server` + `npm run verify-real-export` both green (16/16); real HTTP exports confirmed A4/KDP-6x9 PDF and A5 DOCX geometry match the selected layout exactly
- ✅ Full retrospective: `docs/releases/v0.7.0-alpha/SPRINT_6_FINAL_REPORT.md` (objectives, ADRs created, real bugs found and fixed, final metrics, deferred items, residual risks, lessons learned)
- [ ] PR not yet opened — awaiting explicit go-ahead; tag/`ReleaseNotes.md`/`main` merge all deferred until after

---

## 📋 BACKLOG (Future)

- [ ] Collaborative editing
- [ ] Version control / history
- [ ] Cloud sync (AWS S3)
- [ ] Analytics dashboard
- [ ] Mobile apps
- [ ] Advanced search
- [ ] Spell check
- [ ] Translation assistance
- [ ] Custom plugins system
- [ ] Kindle / Kobo / Lulu / IngramSpark / Amazon KDP export targets

---

## 🐛 KNOWN ISSUES

- Legacy `/api/upload` route removed (ADR-0021, PR #5, 2026-07-17) — `POST /api/manuscripts/import` is now the only import route.
- `backend/uploads/` no longer tracked going forward (`.gitignore` + `git rm --cached`), but still present in past commit history — decided to keep as-is, no purge (ADR-0021).
- Mammoth (DOCX import) silently drops underline formatting by default — documented dependency limitation, not a pipeline bug (ADR-0025, Sprint 4). Verified workaround exists, not applied; requires a mammoth-level `styleMap` fix, scoped for Import Fidelity.
- PDFKit has no native primitive for superscript/subscript/small-caps — `PDFRenderer` documents these `TypeRun` flags as unrendered (DOCX/EPUB render them correctly).
- ~~Strikethrough silently downgraded to plain text on import; inter-run whitespace silently dropped (word-jamming); `ASTBuilder.convertInlines()` dropped plain text + silently mislabeled unknown inline types as bold~~ — found and **fixed** in Sprint 4 commit 10 as an explicit scope exception (ADR-0026), not left open.
- `Chapter.openingPageStyle`/`startPageNumber`/`Book.frontMatter.toc.generateAutomatically` have no DOCX-native signal `ASTBuilder` can set from real content (Sprint 6, ADR-0031) — same category as the `isbn`/`description`/`coverImage` gap below. Fully implemented, real-file verified via direct pipeline composition; not reachable through a real DOCX upload today. Scoped for a future Import Fidelity sprint.
- DOCX `RunningHead.content:'chapterTitle'` and `Chapter.startPageNumber` have no real per-chapter effect in `.docx` output (Sprint 6) — `DOCXRenderer` builds one Word section for the whole document; true per-chapter behavior needs splitting into multiple sections, not built this sprint. Doesn't affect `ClassicTheme`, whose `'bookTitle'` content is constant document-wide regardless.

---

## 💡 TECHNICAL DEBT

- `QualityMetrics` is computable via `BookMetricsCalculator.calculateQualityMetrics(paginated)` (Sprint 4 commit 9) and `ImportReportDTO` now has real `issues`/`score` fields ready to carry metrics-derived findings (Sprint 5) — but `ValidationContext.metrics` is never actually populated on the import path (no `PaginatedBook` exists there, only `ExportManuscriptUseCase`'s pipeline produces one), so `TypographyRule` is currently a no-op in every real report. The plumbing exists; the population doesn't yet. Wiring `ValidationEngine` into `ExportManuscriptUseCase` (where a `PaginatedBook` does exist) would close this gap — not scoped for any sprint yet.
- `docs/architecture/diagrams/BASELINE_v0.1.md` staleness corrected via ADR-0010 (status annotation added, content not rewritten).
- `errorHandler.ts` passes multer's own error message straight to the client for non-size-limit errors (low severity — multer's built-in messages are generic, not stack traces/paths — but not a hardcoded message like the size-limit case).
- No per-module `README.md` files exist yet (Domain/Application/Presentation), despite the "every module must include a README" rule.
- **`AutomaticLayoutSelector` is named and designed for but not built** (Sprint 6, ADR-0029 Decision 5) — `ManualLayoutSelector` is the only `LayoutSelector` implementation; a real, accepted risk worth revisiting if no second implementation ever materializes.
- A generated Table of Contents' own PDF page is deliberately excluded from the body's own page-number sequence (Sprint 6) — `LayoutEngine` computed body page numbers without reserving room for a TOC page; a very long TOC overflowing its own page falls into the same pagination-estimate-drift bucket as any other PDFKit overflow (ADR-0013), not specially handled.

---

## 📊 METRICS

- **Test Coverage:** Domain 93.75% stmts, global 92.78% stmts (`npm run test:coverage`, final Sprint 6 run)
- **Code Quality:** TypeScript strict mode ✅, ESLint **0 errors / 0 warnings**, Prettier applied
- **Tests:** 328 passing, 0 failing
- **Architecture Debt:** see Technical Debt above (`QualityMetrics`/`ValidationContext.metrics` gap from Sprint 5, unchanged; `AutomaticLayoutSelector` not built, TOC page excluded from body page-number sequence, both Sprint 6)
- **Documentation:** Reconciled with actual code as of 2026-07-17 (Sprint 6 implementation-complete on its feature branch, all commits + 2 disclosed fix commits; ADR-0029/0030/0031 written; PR not yet opened)
