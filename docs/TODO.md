# TODO - Book Publisher Studio

**Last Updated:** July 17, 2026 (Sprint 4, commits 1-10 complete and verified)

---

## 🔴 BLOCKED

None currently.

---

## 🟡 IN PROGRESS

**Sprint 4 (Typography Engine)** — branch `feature/sprint-4-typography-engine`, pushed to `origin` 2026-07-17. Design Review approved (`docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md`, 11-commit plan). **Commits 1-10 done, tested (195/195), and verified against real files** (`npm run verify-server` + `npm run verify-real-export`, 16/16 checks). **Commit 11 is next** (not started).

- [x] Commit 1: `ResolvedTypography`/`TypeRun` domain types + additive `StyledBook.blockTypography`
- [x] Commit 2: `TypographyResolver.resolve()` — inline run parsing
- [x] Commit 3: `TypographyResolver` — drop caps, English-only smart quotes, block-type rules (forced quote/scripture italics)
- [x] Commit 4: `LayoutEngine` reads `staysWithNext` for heading keep-together pagination
- [x] Commit 5: `PDFRenderer` consumes `TypeRun` spans
- [x] Commit 6: real font embedding — Gelasio/Inter/JetBrains Mono (SIL OFL) in `PDFRenderer` (resolves the ADR-0021 font-embedding open item); `PdfFontRegistry` role-based API refactor (`resolveBody`/`resolveHeading`/`resolveMonospace`/`resolveDefault`) folded into this commit, audited to contain zero PDF-rendering logic
- [x] Commit 7: `DOCXRenderer` consumes `TypeRun` spans + theme-driven heading styles
- [x] Commit 8: `EPUBRenderer` consumes `TypeRun` spans + real CSS drop cap; ADR-0025 (Mammoth underline-drop limitation) documented alongside, with a regression test, per explicit CTO direction not to modify the import pipeline this sprint
- [x] Commit 9: `BookMetricsCalculator` populates `QualityMetrics` (widow/orphan/spacing/heading fields + `averageHeadingDepth`/`paragraphDensity`/`lineDensity`/`dropCaps`) — new additive `calculateQualityMetrics(paginated: PaginatedBook): QualityMetrics` method (does not touch the existing `calculate(book: Book): Book`); `widowsAndOrphans`/`inconsistentSpacing`/`emptyHeadings` formulas were not locked by the Design Review, so definitions were proposed and confirmed before implementation (see commit message / session record) — `inconsistentSpacing`'s functional definition is deliberately general ("a block whose explicit style overrides a theme-resolved value"), Sprint 4 checks spacing only. Not wired into `ExportManuscriptUseCase` or any route this commit (out of scope — that's `ValidatorEngine` work); 4 new tests, 186/186 passing, 90.23% global / 92.81% domain coverage, `npm run verify-server` + `npm run verify-real-export` both green (16/16)
- [x] Commit 10: E2E real-file verification pass — found and fixed 2 real content-fidelity bugs in `HtmlNormalizer`/`ASTBuilder` (strikethrough silently downgraded to plain text; whitespace between adjacent inline runs silently dropped, jamming words together — e.g. "mixes bold" imported as "mixesbold") plus a related third bug in `ASTBuilder.convertInlines()` (plain-text inlines filtered out entirely + a silent `default: bold` fallback). All import-pipeline code, explicitly out of Sprint 4 scope per ADR-0025 — CTO directed an immediate fix rather than document-and-defer since these are content losses, not styling losses like ADR-0025's underline finding. See ADR-0026. 9 new tests (4 `HtmlNormalizer.test.ts`, 1 `ASTBuilder.test.ts` + 1 extended, 3 `export.test.ts` real-fixture E2E, 1 `ExportManuscriptUseCase.test.ts` real-fixture PDF font-weight check), 195/195 passing, `npm run verify-server` + `npm run verify-real-export` both green (16/16), real DOCX/EPUB output visually inspected (text reads correctly, strikethrough renders, no jammed words)
- [ ] Commit 11: ADR-0022 (Typography Resolution Pipeline), ADR-0023 (Font Embedding), ADR-0024 (Hyphenation/smart-quotes-v2-deferred) + final `CURRENT_STATE.md`/`TODO.md`/`VERSIONS.md` pass — **next task**
- [ ] Open the Sprint 4 PR — only once commit 11 is done and re-verified (per CTO instruction: PR only once the whole sprint is done and verified)

**Real bugs found and fixed along the way, each in its own dedicated branch/PR (not folded into Sprint 4):**
- PDFKit crash on headerless tables (`fix/pdf-table-without-header`, PR #8, merged) — see ADR/commit `4b40039`
- Server-verification tooling (`chore/server-verification-tooling`, PR #6 + follow-up PR #7 for an orphaned commit) — `npm run verify-server` / `npm run verify-real-export`, both merged to `main` before Sprint 4 resumed

**Dependency limitation documented, not fixed this sprint:** Mammoth (DOCX import) silently drops underline formatting by default (ADR-0025) — regression test added, workaround identified but not applied, import pipeline unchanged. Scoped as a future "Import Fidelity" sprint (see Backlog below).

### Governance pass (ADR-0021, 2026-07-17) — all four resolved

- [x] Tag `v0.4.1-alpha` — created and pushed
- [x] **Remove legacy `/api/upload` route** (`docxParser.ts`, disk-based multer) — removed on `chore/remove-legacy-upload-route`, Sprint 3 having completed satisfies ADR-0011's precondition
- [x] **Font asset for PDF/theme rendering** (surfaced by ADR-0019): **Decided — Gelasio** (SIL OFL, metrically compatible with Georgia), later expanded to Gelasio + Inter + JetBrains Mono per the Sprint 4 Design Review. **Embedded — done, Sprint 4 commit 6.**
- [x] `backend/uploads/` history — **kept as-is, no purge** (untracked going forward is sufficient)

- [ ] **RTL / multi-script text support** (surfaced by ADR-0019): no single embedded font covers every script (verified: Arabic renders as blank boxes, Greek dropped a glyph), and PDFKit does no bidi reordering or Arabic contextual shaping. Real work, not a font swap — flagged, not scheduled.

### Low Priority (Sprint 5+)

- [ ] `ValidatorEngine` (readability/completeness scoring, typography-issue detection — fuller than the current structural-only `BookValidator`)
- [ ] Plugin system
- [ ] Premium UI/UX (Next.js frontend)
- [ ] AI features (explicitly deferred — architecture should stay extensible for these, not build them now)
- [ ] **Editorial AI Engine** (new, 2026-07-17 — see `docs/VISION.md`'s dedicated section) — independent module, own pipeline stage between Normalizer and Theme Engine, entirely separate from rendering so the rendering pipeline stays deterministic. Humanization, grammar/style correction, accept/reject suggestions, readability analysis, manuscript consistency checks, AI writing assistant. Realistically its own Sprint 6/7. **Not scoped, not designed, no code/ADR/Design Review yet** — explicitly deferred until Sprint 4 and the rendering pipeline it stabilizes are fully merged and verified.
- [ ] **Import Fidelity** (new, 2026-07-17 — see ADR-0025, ADR-0026) — a dedicated future sprint to improve or replace what `MammothParser`/mammoth actually preserves from a real DOCX. Confirmed gap still open: underline formatting is silently dropped by mammoth's default behavior (ADR-0025 — a documented, verified workaround exists via mammoth's own `styleMap` option, not applied during Sprint 4; this specifically requires a mammoth-level fix, unlike the 3 findings below). Three related findings already **fixed** during Sprint 4 commit 10 as an explicit scope exception, not deferred (ADR-0026): strikethrough silently downgraded to plain text, inter-run whitespace silently dropped (word-jamming), and `ASTBuilder.convertInlines()` filtering out plain text + a silent bold fallback for unhandled inline types. Remaining candidates to evaluate with real spike evidence, matching ADR-0019/ADR-0020's precedent: highlight, track changes, comments, text boxes, SmartArt, floating images, nested tables, DrawingML — none of these individually verified yet, named from the CTO's proposed backlog only. **Not scoped, not designed** — explicitly deferred until after Sprint 4 (Typography Engine) merges.
- [ ] **Documentation & Learning Platform** (new, 2026-07-17 — proposed by the CTO after Sprint 4 commit 8) — a dedicated future phase covering: (1) a full documentation strategy, (2) user/developer/admin documentation infrastructure, (3) a training academy (guides, tutorials, videos, certification), (4) an in-app Learning Center, (5) a knowledge base to underpin the future AI Assistant. Proposed strategic docs: `PRODUCT_VISION.md`, `PRODUCT_REQUIREMENTS.md`, `DOCUMENTATION_MASTER_PLAN.md`, `TRAINING_MASTER_PLAN.md`, `AI_KNOWLEDGE_BASE.md`, `CERTIFICATION_PROGRAM.md`, `LEARNING_CENTER_SPEC.md`, `VIDEO_PRODUCTION_GUIDE.md`. CTO's own proposed commit breakdown (10 commits): product vision → product requirements → documentation master plan → learning center → video academy → certification → AI knowledge base → documentation templates → example projects → final validation — same per-commit rigor (Design Review, ADR where warranted, docs, verification) as the rendering-pipeline sprints. **Naming conflict to resolve when this is actually scoped:** the CTO referred to this as "Sprint 5," but `docs/VERSIONS.md` already assigns Sprint 5 → `v0.6.0-alpha` (Premium UI/UX); this item does not yet have a version/sprint slot reserved and should not silently claim "Sprint 5" without reconciling that. **Not scoped, not designed, no ADR/Design Review yet** — explicitly deferred until Sprint 4 (Typography Engine) is fully complete (commits 9-11) and merged, per explicit CTO instruction not to mix this with rendering-pipeline work in progress.
- [ ] Licensing/subscription model, observability/telemetry (also explicitly deferred — no DB/auth exists yet)

**CTO priority order for Sprint 4+ (2026-07-17):** 1) Typography Engine (in progress), 2) `ValidatorEngine`, 3) Plugin system, 4) Premium UI, 5) AI features / Editorial AI Engine.

**Typography Engine Design Review — ✅ APPROVED (2026-07-17)** (`docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md`). Final architecture: `ThemeEngine → TypographyResolver → LayoutEngine → Renderer`, `StyledBook` gains an additive `blockTypography` field (no `TypesetBook`, no `LayoutEngine`/`PaginatedBook`/`Renderer` signature changes). Final scope decisions: block-type typography rules (quote italics, etc.) are `TypographyResolver`-internal defaults, not `Theme`-configurable in v1; fonts are Gelasio (serif) + Inter (sans-serif) + JetBrains Mono (monospace), not Gelasio alone; RTL confirmed out of scope; hyphenation confirmed deferred to v2; smart quotes English-only v1; `QualityMetrics` gains `averageHeadingDepth`/`paragraphDensity`/`lineDensity`/`dropCaps` with functional definitions locked. **Implementation in progress on `feature/sprint-4-typography-engine` — commits 1-8 of the 11-commit plan done and verified** (see "IN PROGRESS" section above for per-commit detail).

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

---

## 💡 TECHNICAL DEBT

- `QualityMetrics` is now computable via `BookMetricsCalculator.calculateQualityMetrics(paginated)` (Sprint 4 commit 9) but not yet surfaced through any HTTP route/DTO — deliberately out of commit 9's scope; wiring it into a response is `ValidatorEngine` work (Sprint 4+ priority #2, CTO priority order).
- ADR-0022 (Typography Resolution Pipeline) and ADR-0023 (Font Embedding) not yet formally written — deferred to Sprint 4 commit 11, once the code state is final.
- `docs/architecture/diagrams/BASELINE_v0.1.md` staleness corrected via ADR-0010 (status annotation added, content not rewritten).
- `errorHandler.ts` passes multer's own error message straight to the client for non-size-limit errors (low severity — multer's built-in messages are generic, not stack traces/paths — but not a hardcoded message like the size-limit case).
- No per-module `README.md` files exist yet (Domain/Application/Presentation), despite the "every module must include a README" rule.

---

## 📊 METRICS

- **Test Coverage:** Domain >90% stmts, global >80% stmts (both re-verified via `npm run test:coverage` before every Sprint 4 commit; exact percentages to be reconciled and recorded in commit 11's docs pass)
- **Code Quality:** TypeScript strict mode ✅, ESLint **0 errors / 0 warnings**, Prettier applied
- **Tests:** 195 passing, 0 failing
- **Architecture Debt:** see Technical Debt above (`QualityMetrics` computable but not HTTP-wired pending `ValidatorEngine`, ADR-0022/0023 pending commit 11)
- **Documentation:** Reconciled with actual code as of 2026-07-17 (Sprint 4, commits 1-10)
