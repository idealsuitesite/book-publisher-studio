# TODO - Book Publisher Studio

**Last Updated:** July 17, 2026 (Sprint 4 complete — all 11 commits, PR pending)

---

## 🔴 BLOCKED

None currently.

---

## 🟡 IN PROGRESS

None currently. Sprint 4 (Typography Engine) is **complete** — all 11 commits done, tested (195/195), verified against real files (`npm run verify-server` + `npm run verify-real-export`, 16/16 checks). See the COMPLETED section below for the summary and `docs/releases/v0.5.0-alpha/SPRINT_4_FINAL_REPORT.md` for the full sprint retrospective (objectives, ADRs, bugs found/fixed, metrics, deferred items, risks, lessons learned). **Next action: open the Sprint 4 PR** (`feature/sprint-4-typography-engine` → `main`) — pending explicit go-ahead, not yet done.

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

### Low Priority (Sprint 5+)

- [ ] `ValidatorEngine` (readability/completeness scoring, typography-issue detection — fuller than the current structural-only `BookValidator`)
- [ ] Plugin system
- [ ] Premium UI/UX (Next.js frontend)
- [ ] AI features (explicitly deferred — architecture should stay extensible for these, not build them now)
- [ ] **Editorial AI Engine** (new, 2026-07-17 — see `docs/VISION.md`'s dedicated section) — independent module, own pipeline stage between Normalizer and Theme Engine, entirely separate from rendering so the rendering pipeline stays deterministic. Humanization, grammar/style correction, accept/reject suggestions, readability analysis, manuscript consistency checks, AI writing assistant. Realistically its own Sprint 6/7. **Not scoped, not designed, no code/ADR/Design Review yet** — explicitly deferred until Sprint 4 and the rendering pipeline it stabilizes are fully merged and verified.
- [ ] **Import Fidelity** (new, 2026-07-17 — see ADR-0025, ADR-0026) — a dedicated future sprint to improve or replace what `MammothParser`/mammoth actually preserves from a real DOCX. Confirmed gap still open: underline formatting is silently dropped by mammoth's default behavior (ADR-0025 — a documented, verified workaround exists via mammoth's own `styleMap` option, not applied during Sprint 4; this specifically requires a mammoth-level fix, unlike the 3 findings below). Three related findings already **fixed** during Sprint 4 commit 10 as an explicit scope exception, not deferred (ADR-0026): strikethrough silently downgraded to plain text, inter-run whitespace silently dropped (word-jamming), and `ASTBuilder.convertInlines()` filtering out plain text + a silent bold fallback for unhandled inline types. Remaining candidates to evaluate with real spike evidence, matching ADR-0019/ADR-0020's precedent: highlight, track changes, comments, text boxes, SmartArt, floating images, nested tables, DrawingML — none of these individually verified yet, named from the CTO's proposed backlog only. **Not scoped, not designed** — explicitly deferred until after Sprint 4 (Typography Engine) merges.
- [ ] **Documentation & Learning Platform** (new, 2026-07-17 — proposed by the CTO after Sprint 4 commit 8) — a dedicated future phase covering: (1) a full documentation strategy, (2) user/developer/admin documentation infrastructure, (3) a training academy (guides, tutorials, videos, certification), (4) an in-app Learning Center, (5) a knowledge base to underpin the future AI Assistant. Proposed strategic docs: `PRODUCT_VISION.md`, `PRODUCT_REQUIREMENTS.md`, `DOCUMENTATION_MASTER_PLAN.md`, `TRAINING_MASTER_PLAN.md`, `AI_KNOWLEDGE_BASE.md`, `CERTIFICATION_PROGRAM.md`, `LEARNING_CENTER_SPEC.md`, `VIDEO_PRODUCTION_GUIDE.md`. CTO's own proposed commit breakdown (10 commits): product vision → product requirements → documentation master plan → learning center → video academy → certification → AI knowledge base → documentation templates → example projects → final validation — same per-commit rigor (Design Review, ADR where warranted, docs, verification) as the rendering-pipeline sprints. **Naming conflict to resolve when this is actually scoped:** the CTO referred to this as "Sprint 5," but `docs/VERSIONS.md` already assigns Sprint 5 → `v0.6.0-alpha` (Premium UI/UX); this item does not yet have a version/sprint slot reserved and should not silently claim "Sprint 5" without reconciling that. **Not scoped, not designed, no ADR/Design Review yet** — explicitly deferred until Sprint 4 (Typography Engine) is fully complete (commits 9-11) and merged, per explicit CTO instruction not to mix this with rendering-pipeline work in progress.
- [ ] Licensing/subscription model, observability/telemetry (also explicitly deferred — no DB/auth exists yet)

**CTO priority order for Sprint 4+ (2026-07-17):** 1) Typography Engine (✅ complete — see `docs/releases/v0.5.0-alpha/SPRINT_4_FINAL_REPORT.md`), 2) `ValidatorEngine`, 3) Plugin system, 4) Premium UI, 5) AI features / Editorial AI Engine.

**Competing Sprint 5 priority proposal (2026-07-17, after Sprint 4 commit 10) — not adopted, not decided, recorded for the actual Sprint 5 Design Review to resolve:** a different 4-item ordering was proposed — 1) Editorial AI Engine, 2) Professional Layout Engine (new name, not previously scoped anywhere in this doc — automatic layout selection, fuller editorial styles, advanced book management), 3) Validation Engine (same as `ValidatorEngine` above), 4) Publishing Engine (new name — metadata prep, front/back matter generation, KDP/Kobo/Apple Books export readiness, overlaps the existing "Kindle / Kobo / Lulu / IngramSpark / Amazon KDP export targets" Backlog item below). Explicitly **not** adopted in place of the CTO priority order above — the user's own instruction was to leave that order unchanged until a real Design Review happens. Both orderings agree Editorial AI Engine matters; they disagree on whether it or `ValidatorEngine`/Plugin/UI comes first. Resolve this conflict as part of Sprint 5's own Design Review, not by assumption in a future session.

**Typography Engine Design Review — ✅ APPROVED (2026-07-17)** (`docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md`). Final architecture: `ThemeEngine → TypographyResolver → LayoutEngine → Renderer`, `StyledBook` gains an additive `blockTypography` field (no `TypesetBook`, no `LayoutEngine`/`PaginatedBook`/`Renderer` signature changes). Final scope decisions: block-type typography rules (quote italics, etc.) are `TypographyResolver`-internal defaults, not `Theme`-configurable in v1; fonts are Gelasio (serif) + Inter (sans-serif) + JetBrains Mono (monospace), not Gelasio alone; RTL confirmed out of scope; hyphenation confirmed deferred to v2; smart quotes English-only v1; `QualityMetrics` gains `averageHeadingDepth`/`paragraphDensity`/`lineDensity`/`dropCaps` with functional definitions locked. **Fully implemented on `feature/sprint-4-typography-engine` — all 11 commits done and verified** (see the COMPLETED section below and `docs/releases/v0.5.0-alpha/SPRINT_4_FINAL_REPORT.md` for full detail).

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

### Sprint 4 - Typography Engine (all 11 commits done on `feature/sprint-4-typography-engine`; PR not yet opened, target tag `v0.5.0-alpha`)

- ✅ `TypographyResolver` (new concrete Domain service) — inline run resolution (`Block.inlines` → `TypeRun[]`), drop caps, English-only smart quotes, forced quote/scripture italics, heading `staysWithNext` keep-with-next signal (ADR-0022)
- ✅ `StyledBook.blockTypography?` — additive field, no signature change to `LayoutEngine.paginate()`, `PaginatedBook`, or `Renderer<TOutput>` (the larger `TypesetBook` proposal was reviewed and rejected for blast radius before any code was written)
- ✅ Real PDF font embedding — Gelasio/Inter/JetBrains Mono, 12 `.ttf` files, role-based `PdfFontRegistry` API (ADR-0023)
- ✅ Full `TypeRun` rendering (bold/italic/underline/strikethrough/superscript/subscript/small-caps/links) in `PDFRenderer`/`DOCXRenderer`/`EPUBRenderer` — closes a real gap where none of the three renderers rendered inline formatting at all before this sprint
- ✅ `BookMetricsCalculator.calculateQualityMetrics(paginated)` — activates all 7 `QualityMetrics` fields (3 from ADR-0008, 4 new) with real computed values, resolving ADR-0008's deferred item
- ✅ E2E real-file verification pass (commit 10) found and fixed 3 real content-fidelity bugs in the import pipeline as an explicit scope exception (ADR-0026) — strikethrough silently downgraded to plain text, inter-run whitespace silently dropped (word-jamming), `ASTBuilder` silently dropping plain-text inlines / mislabeling unknown types as bold
- ✅ Hyphenation and locale-aware (non-English) smart quotes formally confirmed deferred to v2 (ADR-0024)
- ✅ **195 total tests passing** (up from 133), 90.49% global / 92.57% domain coverage, 0 ESLint warnings; `npm run verify-server` + `npm run verify-real-export` both green (16/16) on every commit; real DOCX/EPUB output text-extracted and read directly, not just asserted via `npm test`
- ✅ Full retrospective: `docs/releases/v0.5.0-alpha/SPRINT_4_FINAL_REPORT.md` (objectives, ADRs created, historical bugs, final metrics, deferred items, residual risks, lessons learned)

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
- `docs/architecture/diagrams/BASELINE_v0.1.md` staleness corrected via ADR-0010 (status annotation added, content not rewritten).
- `errorHandler.ts` passes multer's own error message straight to the client for non-size-limit errors (low severity — multer's built-in messages are generic, not stack traces/paths — but not a hardcoded message like the size-limit case).
- No per-module `README.md` files exist yet (Domain/Application/Presentation), despite the "every module must include a README" rule.

---

## 📊 METRICS

- **Test Coverage:** Domain 92.57% stmts, global 90.49% stmts (`npm run test:coverage`, final Sprint 4 run, commit 11)
- **Code Quality:** TypeScript strict mode ✅, ESLint **0 errors / 0 warnings**, Prettier applied
- **Tests:** 195 passing, 0 failing
- **Architecture Debt:** see Technical Debt above (`QualityMetrics` computable but not HTTP-wired pending `ValidatorEngine`)
- **Documentation:** Reconciled with actual code as of 2026-07-17 (Sprint 4 complete, all 11 commits; ADR-0022/0023/0024/0025/0026 written)
