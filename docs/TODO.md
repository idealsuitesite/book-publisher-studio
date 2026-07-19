# TODO - Book Publisher Studio

**Last Updated:** July 18, 2026 (Sprint 8 "Publishing Engine" released as `v0.9.0-alpha`; Sprint 9 Design Review drafted round 1, not yet approved)

---

## 🔴 BLOCKED

None currently.

---

## 🟡 IN PROGRESS

**S11 persistence — ✅ DONE on `feature/sprint-9-ui-foundation` (2026-07-20).** `PERSISTENCE.md` approved, ADR-0048 (Decision 2 formally amended), `SqliteProjectRepository` behind the shared contract suite, wired via `DATABASE_PATH`, restart survival proven live (import → real restart → project + export both intact). Next per the approved plan: P4 calibration (awaits CTO feelings on `docs/demo/screenshots/atelier/`), `EDITOR_EXPERIENCE.md` review, engine-rendered preset thumbnails. See `docs/CURRENT_STATE.md` for the full handoff.

**Sprint 7 ("First Demonstrable Product") is complete, merged, and released.** PR #12 merged (`f17fd65`), `v0.8.0-alpha` tagged and pushed, `feature/sprint-7-first-demonstrable-product` deleted (local + remote). Full commit-by-commit detail (13 implementation commits, Commit 9 split into 9a/9b at CTO direction, ADR-0034) moved to the COMPLETED section below — see there, `docs/CURRENT_STATE.md`'s Sprint 7 section, and `docs/releases/v0.8.0-alpha/SPRINT_7_FINAL_REPORT.md` for full detail.

**Sprint 8 (Publishing Engine) — ✅ COMPLETE AND RELEASED as `v0.9.0-alpha`** (PR #13, merge commit `4a4deaa`). Design Review approved, 9 commits, 386/386 tests, 4/4 real-fixture publish checks. Full detail in the COMPLETED section below and in `docs/releases/v0.9.0-alpha/SPRINT_8_FINAL_REPORT.md`.

**🔄 ROADMAP REPRIORITIZED (2026-07-18, ADR-0039).** Editorial AI Engine → Sprint 18+, Plugin System → Sprint 19+, both to the strategic backlog. Sprints 9–17 target product completeness first: UI Foundation, UX & Workflow, Workspace & Project Management, Autosave & Recovery, Performance & Scalability, Collaboration, Cloud Sync, Licensing, Telemetry & Observability. `docs/VERSIONS.md` rewritten from `v0.10.0-alpha` onward. **Prerequisite flagged now rather than discovered at Sprint 11:** Workspace, Autosave, Collaboration, Cloud Sync, Licensing, and Telemetry all need a persistence layer that does not exist and is currently forbidden by Sprint 7 Decision 2 — amending it needs its own Design Review.

**Sprint 9 (UI Foundation) — ✅ Design Review APPROVED (round 2, 2026-07-18). No branch, no code yet — awaiting explicit go-ahead per the two-gate discipline.** 6 decisions locked: build primitives in-house (`Button`/`Card`/`Alert`/`Badge`/`Input`/`Textarea`/`Select`) with headless Radix/React Aria only for `Dialog`/`Popover`/`Menu`/`Tooltip`/focus-trap; interface theming named `AppTheme` (light+dark) so it never collides with the Domain's existing `Theme`; **Commits 1–7 introduce no intentional desktop visual change, Commit 8 restyles**, so screenshot diffs isolate refactor defects from design defects; navigation is a shell only (header/logo/title/placeholder — no invented destinations); Sprint 9 builds components, Sprint 10 decides how they are used, with existing wording preserved verbatim; and the **frontend test suite is mandatory and moved to Commit 2**, before the large refactor. CTO added an acceptance criterion: reference screenshots archived before the first commit and compared after every intentional appearance change. Original round-1 detail follows.

**Round-1 detail (preserved):** 🟡 Design Review round 1 drafted (2026-07-18). `docs/architecture/diagrams/UI_FOUNDATION.md`. Design System, components, themes, typography, colours, icons, grid, responsive, accessibility, navigation — **no new business logic, zero backend files changed**. 6 open questions posed with recommendations, none locked: build-versus-adopt a component library (recommend building, with headless primitives only where accessibility is hard), how far interface theming goes (recommend light+dark, and renaming to avoid colliding with the existing Domain `Theme` concept), whether any pixel changes or only how it is built (recommend tokens first, appearance-neutral, restyle after), what navigation means with one page (recommend the shell, not invented destinations), where exactly the UI/UX line falls, and whether the frontend test suite lands here (recommend yes — this sprint refactors every component with no safety net). Real evidence: 694 lines / 7 components total, no design system, duplication counted, **zero accessibility attributes**, and a real shipped defect — Geist fonts downloaded on every load and never rendered. **No branch, no code.** Next: CTO round 2 review of the 6 questions.

**Sprint 18+ (Editorial AI Engine) — ⏸️ DEFERRED, review preserved not withdrawn.** `docs/architecture/diagrams/EDITORIAL_AI_ENGINE.md` keeps its round-1 draft intact: 6 open questions, real code evidence (zero AI references, zero outbound HTTP, no secret management), and one unresolved tension between `VISION.md`'s accept/reject workflow and Sprint 7 Decision 2's stateless backend. A future session should re-verify that evidence before trusting it — Sprints 11/12/16 are expected to change the answers to its Questions 3 and 6.

Also post-Sprint-6 (2026-07-17), independent of the Sprint 7 scope question: new governance docs formalizing practices that had previously lived only in ADRs/session discipline — `docs/QUALITY_GATE.md` (per-commit checklist + 3 validation levels: Development/Product/Release), `docs/TESTING_STRATEGY.md` (functional-vs-rendering and structural(L1)-vs-rendering(L2) test taxonomies), `docs/REAL_FIXTURE_POLICY.md` (broadens real-fixture verification beyond the rendering pipeline to also cover import and TOC generation, formalizing the trigger gap ADR-0031 bug 2 exposed). ADR-0032 written (TOC generation must use `Chapter`/`Section` titles, never `Heading` blocks — formalizes ADR-0031 bug 2 as a standing rule so a future session can't silently reintroduce it; also gained a second, project-wide decision the same day, the **Engineering Governance Principle** — no feature is done until validated simultaneously at Code/Product/Documentation levels, per CTO direction to consolidate it into this ADR rather than open a new one, matching ADR-0028's precedent).

**Second governance pass, same day (2026-07-18), CTO-directed:** `docs/CLAUDE.md` restructured from a ~135-line document mixing architecture/ADRs/review rules/conventions/Git workflow into a thin entry point (~55 lines) that points to specialized documents instead of containing them — matching the CTO's explicit "it must remain an entry point" direction and a 3-category documentation taxonomy (Product/Technical/Governance). New docs: `docs/DEVELOPMENT_WORKFLOW.md` (branching, commits, after-every-task, server verification, fixture selection - moved from CLAUDE.md, nothing dropped), `docs/DESIGN_REVIEW_PROCESS.md` (formalizes the Level 1/Level 2 review pattern already followed 6 times), `docs/RELEASE_CHECKLIST.md` (the exact sprint-closure sequence, including the real Sprint 6 PR/merge-race incident as a named failure mode it accounts for), `docs/ADR_INDEX.md` (searchable table of all 32 ADRs), `docs/DEVELOPER_HANDBOOK.md` (naming/file-structure/SOLID-DDD conventions, moved from CLAUDE.md, plus a new "port vs. concrete class" judgment-call section generalizing a pattern this project has answered the same way every time it came up). Every doc that referenced a since-relocated CLAUDE.md section by name (`docs/CURRENT_STATE.md`, `docs/QUALITY_GATE.md`, `docs/REAL_EXPORT_CHECKLIST.md`, `docs/REAL_FIXTURE_POLICY.md`, 2 backend scripts, 2 `src/` comments) was updated to the new location - no dangling pointers. `docs/ARCHITECTURE.md`'s own staleness (Sprint-1-era file structure, "planned" components that are now built) was found and disclosed in `docs/DEVELOPER_HANDBOOK.md` rather than silently fixed - out of scope for this pass, flagged as a real, separate gap.

Sprint 6 (Professional Layout Engine) is **complete, merged, and released** — commit 0's spike + 10 numbered commits + 2 disclosed fix commits done, tested (328/328), verified against real files (`npm run verify-server` + `npm run verify-real-export`, 16/16 checks), merged via PR #11 (`eb05beb`), tagged `v0.7.0-alpha`. Two real bugs found and fixed during real-file verification (ADR-0031). See the COMPLETED section below and `docs/releases/v0.7.0-alpha/SPRINT_6_FINAL_REPORT.md` / `ReleaseNotes.md` for full detail. `feature/sprint-6-professional-layout-engine` deleted (local + remote).

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
- [x] **Publishing Engine** (see `PLATFORM_ARCHITECTURE_ROADMAP.md` §2.5) — KDP/Kobo/Apple Books/Google Play Books packaging, sits after the `Renderer` port; owns `PostRenderValidation` per `VALIDATION_ENGINE.md`'s Sprint 5 scope decision. **Built as Sprint 8 (2026-07-18). Design Review ✅ APPROVED: `docs/architecture/diagrams/PUBLISHING_ENGINE.md`** (8 locked decisions, ADR-0035/0036/0037/0038). Shipped: `PublishingTarget` port + `KDPTarget`, `Packaging`/`PublishingBundle`, `SubmissionValidator` + 4 `PostRenderValidationRule`s behind a `ValidationRuleProvider` port, `PublishingUseCase`, `POST /api/manuscripts/publish`. **Amazon KDP only, validation and packaging only — no real submission, no Amazon API call, no credentials** (Decision 5). Kobo/Apple Books/Lulu/IngramSpark remain unbuilt (Backlog item below, now narrowed accordingly). Two real gaps disclosed, not hidden: `isbn` unreachable from a real DOCX import (Risk 4) and real pagination metrics unreachable by `PageCountRule` (ADR-0038, deferred).
- [ ] **Import Fidelity** (new, 2026-07-17 — see ADR-0025, ADR-0026) — a dedicated future sprint to improve or replace what `MammothParser`/`ASTBuilder` actually preserves or exposes from a real DOCX. Confirmed gap still open: underline formatting is silently dropped by mammoth's default behavior (ADR-0025 — a documented, verified workaround exists via mammoth's own `styleMap` option, not applied during Sprint 4; this specifically requires a mammoth-level fix, unlike the 3 findings below). Three related findings already **fixed** during Sprint 4 commit 10 as an explicit scope exception, not deferred (ADR-0026): strikethrough silently downgraded to plain text, inter-run whitespace silently dropped (word-jamming), and `ASTBuilder.convertInlines()` filtering out plain text + a silent bold fallback for unhandled inline types. **New gap added Sprint 6 (ADR-0031):** `Chapter.openingPageStyle`/`startPageNumber` and `Book.frontMatter.toc.generateAutomatically` have no DOCX-native signal `ASTBuilder` can set from real content — same category as the pre-existing `isbn`/`description`/`coverImage` gap (Sprint 5). All three Sprint 6 fields are fully implemented and real-file verified via direct pipeline composition, just never reachable through a real DOCX upload today. Remaining candidates to evaluate with real spike evidence, matching ADR-0019/ADR-0020's precedent: highlight, track changes, comments, text boxes, SmartArt, floating images, nested tables, DrawingML — none of these individually verified yet, named from the CTO's proposed backlog only. **Not scoped, not designed** — explicitly deferred until prioritized.
- [ ] **Documentation & Learning Platform** (new, 2026-07-17 — proposed by the CTO after Sprint 4 commit 8) — a dedicated future phase covering: (1) a full documentation strategy, (2) user/developer/admin documentation infrastructure, (3) a training academy (guides, tutorials, videos, certification), (4) an in-app Learning Center, (5) a knowledge base to underpin the future AI Assistant. Proposed strategic docs: `PRODUCT_VISION.md`, `PRODUCT_REQUIREMENTS.md`, `DOCUMENTATION_MASTER_PLAN.md`, `TRAINING_MASTER_PLAN.md`, `AI_KNOWLEDGE_BASE.md`, `CERTIFICATION_PROGRAM.md`, `LEARNING_CENTER_SPEC.md`, `VIDEO_PRODUCTION_GUIDE.md`. CTO's own proposed commit breakdown (10 commits): product vision → product requirements → documentation master plan → learning center → video academy → certification → AI knowledge base → documentation templates → example projects → final validation — same per-commit rigor (Design Review, ADR where warranted, docs, verification) as the rendering-pipeline sprints. **Naming conflict, now resolved by elimination:** the CTO originally referred to this as "Sprint 5," but Sprint 5 was subsequently defined and fully implemented as **Validation Engine** (`v0.6.0-alpha`) via its own Design Review. This item still has no version/sprint slot reserved — it needs a fresh number once actually scoped, not "Sprint 5" under any interpretation. **Not scoped, not designed, no ADR/Design Review yet.**
- [ ] **Licensing/subscription-aware architecture** (new, 2026-07-18 — CTO proposal, raised alongside Sprint 7 Commit 7) — trial (3/7-day) / Standard / Professional / monthly-subscription tiers, plus reusable UI components (license-tier indicator, trial-days-remaining counter, "Upgrade to Pro" locked-feature screens) and a feature-flag mechanism gating business logic by license without modifying it directly — so a future monetization sprint connects a licensing system rather than refactors the app. **Explicitly not started:** flagged as conflicting with Sprint 7 Design Review Decision 3 (minimal-for-demo scope) and this same gap's pre-existing entry immediately below (no DB/auth layer exists yet, a hard blocker for any real license/trial state). Recommended treatment: its own Design Review before implementation, whenever prioritized — not threaded silently through Sprint 7's remaining commits. See `docs/CURRENT_STATE.md`'s Commit 7 section for full detail.
- [ ] Licensing/subscription model, observability/telemetry (also explicitly deferred — no DB/auth exists yet; see the more detailed proposal immediately above)

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

### Sprint 6 - Professional Layout Engine (merged via PR #11, `eb05beb`; tagged `v0.7.0-alpha`)

- ✅ KDP/platform trim-size spike (`backend/spikes/kdp-trim-size-spike.ts`, ADR-0030) completed before any preset code, matching the ADR-0019/0020 precedent — A4/A5 verified against PDFKit's own real runtime output, KDP sizes fetched directly from kdp.amazon.com
- ✅ `LayoutEngine` extended, not replaced (ADR-0029 Decision 1) — real `PageLayout` presets (A4/A5/KDP 5x8/5.5x8.5/6x9), `LayoutSelector` port + `ManualLayoutSelector` (`AutomaticLayoutSelector` named, not built), `Theme.runningHead` (`ClassicTheme` populated), per-page header/footer resolution, `Chapter.openingPageStyle`/`startPageNumber` honored, automatic Table of Contents generation
- ✅ `ExportController` calls `LayoutSelector.select()` instead of hardcoding `LetterPageLayout`; `POST /api/manuscripts/export` gains an optional `layout` field
- ✅ `PDFRenderer`/`DOCXRenderer` both render real headers/footers, drop the hardcoded `'Book Publisher Studio'` string, render real blank pages for `openingPageStyle`, and render a real generated TOC as front-matter content; EPUB confirmed unaffected (ADR-0029 Decision 3)
- ✅ **Two real bugs found and fixed during real-file verification (ADR-0031), not deferred:** neither renderer had ever consumed `PageLayout` at all (every new preset would have had zero effect on real output); automatic TOC generation originally walked only `Heading` blocks, which real DOCX imports never produce (real headings become `Chapter`/`Section` titles instead) — found against `large-book.docx`'s 15 real chapters, fixed, re-verified against the same fixture
- ✅ **328 total tests passing** (up from 282), 92.78% global / 93.75% domain coverage, 0 ESLint warnings; `npm run verify-server` + `npm run verify-real-export` both green (16/16); real HTTP exports confirmed A4/KDP-6x9 PDF and A5 DOCX geometry match the selected layout exactly
- ✅ Full retrospective: `docs/releases/v0.7.0-alpha/SPRINT_6_FINAL_REPORT.md` (objectives, ADRs created, real bugs found and fixed, final metrics, deferred items, residual risks, lessons learned)
- [x] PR #11 merged (`eb05beb`), tagged `v0.7.0-alpha`, `docs/releases/v0.7.0-alpha/ReleaseNotes.md` written, `feature/sprint-6-professional-layout-engine` deleted (local + remote)

### Sprint 7 - First Demonstrable Product (merged via PR #12, `f17fd65`; tagged `v0.8.0-alpha`)

- ✅ `packages/shared-types` npm workspace (ADR-0033) — this project's first monorepo-structural change; 9 DTOs migrated, `GET /api/manuscripts/options` (Decision 5) born there directly
- ✅ A real Next.js frontend, 8 new components (`UploadDropzone`, `BookStructureView`, `ValidationSummary`, `FormatSelector`, `PreviewPanel`, `ExportPanel`, `ProgressStepper`), driving the real stateless backend end to end: import → structure → validation → layout/theme → preview → export — no mocks, no hardcoded state anywhere
- ✅ 13 implementation commits (Commit 9 split into 9a/9b at CTO direction, ADR-0034, for clearer export-pipeline fault isolation)
- ✅ **Commit 10 — the CTO's "Sprint Review Technique":** 7-part real-file verification pass (existing `verify-server`/`verify-real-export` tooling, multi-layout geometric comparison, a cold restart + different-fixture full journey, a real large-document stress test with a disclosed `backend/uploads/` exception, a full clean rebuild reproducing 336/336 backend tests exactly) — no code changed
- ✅ **5 real bugs found and fixed, disclosed not hidden** (full detail in `docs/releases/v0.8.0-alpha/SPRINT_7_FINAL_REPORT.md` §4): a 422-response-handling gap (Commit 5), a radio `name`-prop bug caught by ESLint (Commit 8), a `set-state-in-effect` React anti-pattern caught by ESLint (Commit 9a), a recurring viewport-click verification-methodology gap (Commits 9b, 10), and a CI configuration gap found on this branch's first-ever push to origin — `backend-ci.yml` never built `packages/shared-types` before `backend`, and the lockfile had no resolved cross-platform entry for a `vitest`/`rolldown` optional native binding needed only on the Linux CI runner (both fixed and verified before merge)
- ✅ Sprint closure (Commit 12): the official Demo Script run for real against the real running application (both demo scenarios), ADR-0034 (4 consolidated governance decisions), `SPRINT_7_TIMELINE.md`/`SPRINT_7_FINAL_REPORT.md` written
- ✅ **Disclosed gap, not hidden:** no automated frontend test suite exists — every frontend commit was verified via real build/lint/type-check plus manual real-browser interaction, tracked in Backlog below
- ✅ **Deliberately deferred, each with its own ADR-0034 decision:** a full PDF viewer with page navigation/zoom (needs a new dependency + its own Design Review) and a licensing/monetization-aware architecture (conflicts with this sprint's own locked minimal-scope decision)
- ✅ Full retrospective: `docs/releases/v0.8.0-alpha/SPRINT_7_FINAL_REPORT.md` (objectives, ADRs created, real bugs found and fixed, final metrics, deferred items, residual risks, lessons learned); compiled timeline: `docs/releases/v0.8.0-alpha/SPRINT_7_TIMELINE.md`; full evidence trail: `docs/demo/VISIBLE_INCREMENTS.md`
- [x] PR #12 merged (`f17fd65`), tagged `v0.8.0-alpha`, `docs/releases/v0.8.0-alpha/ReleaseNotes.md` written, `feature/sprint-7-first-demonstrable-product` deleted (local + remote)

### Sprint 8 - Publishing Engine (merged via PR #13, `4a4deaa`; tagged `v0.9.0-alpha`)

- ✅ Design Review approved before any code (`docs/architecture/diagrams/PUBLISHING_ENGINE.md`) — 8 decisions locked across two rounds plus four mid-sprint CTO reviews, each recorded with its reasoning. Approved with one condition (an internal-responsibilities diagram with explicit OWNS/NEVER boundaries), satisfied before the first line of implementation.
- ✅ Commit 0 — KDP requirements spike (ADR-0035), real specs from 5 `kdp.amazon.com` pages. **Caught a wrong interface shape before any code existed:** the paperback cover has *computed* dimensions (trim size + page count + paper type via a spine-width formula), not the fixed pixel size the eBook cover uses.
- ✅ Commit 1 — `PublishingTarget` port + `PublishingReport`/`PublishingIssue`/`RenderedOutputs` (Domain). `PublishingReport` later enriched with `artifacts`/`generatedAt`/`duration`/`summary` at CTO direction.
- ✅ Commit 2 — `Packaging` + `PublishingBundle`/`PublishingBundleManifest`, entirely generic (`{manuscript, cover, metadata, assets, manifest}`), zero KDP knowledge.
- ✅ Commit 3 — `SubmissionValidator` + 4 `PostRenderValidationRule`s + `ValidationRuleProvider` port + `KDPRuleProvider`/`KDPRuleData`. Closes `VALIDATION_ENGINE.md`'s own Sprint 5 Decision 2 commitment.
- ✅ Commit 4 — `KDPTarget` + `createKDPTarget()`, a platform adapter: calls `Packaging.assemble()` and `SubmissionValidator.validate()` exactly once each, never re-validating or re-packaging (proven by 3 spy-collaborator tests).
- ✅ Commit 5 — `PublishingUseCase` (Application), mirroring `ExportManuscriptUseCase` with one added responsibility: delegating to `PublishingTarget`.
- ✅ Commit 6 — `POST /api/manuscripts/publish` + `PublishingResponseDTO` + `PublishingReportMapper` (Presentation). DTO named generically at CTO direction so future platforms need no contract change.
- ✅ Commit 7 — real-fixture verification (`npm run verify-real-publish`), **4/4** canonical fixtures through the real running server. **No engine code changed.** Surfaced ADR-0038's gap.
- ✅ Commit 8 — docs/ADR reconciliation, documentation only.
- ✅ Two standing governance rules locked: **ADR-0036** (platform rules behind a `RuleProvider` port — no `if (platform === 'kdp')` anywhere in the engine) and **ADR-0037** (engine objects are platform-agnostic; platforms depend on the engine, never the inverse).
- ✅ 386/386 tests (up from 336, **+50**), 93.41% statement coverage, 98.91% function coverage, 0 lint warnings, `verify-real-export` 16/16, `verify-real-publish` 4/4 — all re-verified on `main` after merge.
- ✅ Full retrospective: `docs/releases/v0.9.0-alpha/SPRINT_8_FINAL_REPORT.md`; release notes: `docs/releases/v0.9.0-alpha/ReleaseNotes.md`.
- [x] PR #13 merged (`4a4deaa`), tagged `v0.9.0-alpha`, `docs/VERSIONS.md` flipped (Plugin System shifted to `v0.10.0-alpha` and later rows accordingly), `feature/sprint-8-publishing-engine` deleted (local + remote).

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
- [~] Kindle / Kobo / Lulu / IngramSpark / Amazon KDP export targets — **Amazon KDP partially done (Sprint 8):** validation + packaging shipped (`KDPTarget`, `KDPRuleProvider`), but **no real submission** — no account, no API call, no credentials (Decision 5, deliberate). Kobo / Apple Books / Google Play Books / Lulu / IngramSpark not started; each is a future `PublishingTarget` + `ValidationRuleProvider` implementation pair requiring its own KDP-style requirements spike, addable without changing the port or the engine (ADR-0036/0037).
- [ ] **Move rendering off the request thread** (ADR-0041 Constraint 1, **OPEN**) — `PDFRenderer.render()` is `async` but its PDFKit work is synchronous, so the `async` never yields. A real 39,913-word manuscript took 598ms to export, during which the single-threaded server answers *no other request*. Invisible with one user; a live problem with two. Sprint 13 (Performance & Scalability, `v0.14.0-alpha`) must answer it, re-measuring first. Any answer must not force the three `Renderer<TOutput>` implementations to know they run in a worker.
- [ ] **Decide what is persisted, and amend Sprint 7 Decision 2** (ADR-0041 Constraint 2, **OPEN**) — `grep`-confirmed there is no database, repository, session or cache anywhere, and Decision 2 forbids adding one. Workspace (11), Autosave (12), Collaboration (14), Cloud Sync (15), Licensing (16) and Telemetry (17) all require remembering something between requests. **Blocking for Sprint 11.** Reopens more than storage: what a "project" is as a Domain concept, whether manuscripts persist as uploaded bytes or serialised `Book` ASTs, ownership once Licensing exists, and deletion semantics.
- [ ] **Expose `LayoutEngine`'s real pagination metrics to the Publishing Engine** (ADR-0038, **OPEN**, deferred from Sprint 8 by CTO decision) — `PageCountRule` reports `PAGE_COUNT_UNKNOWN` on every real manuscript because `Book.pageCount` is populated only on the import path, while the real page count lives in the `PaginatedBook` that `PublishingUseCase` computes and discards. Closing it is a contract evolution (widening `PublishingTarget.prepare()`'s inputs), not a small fix — needs its own Design Review. ADR-0038 frames the question and lists candidate shapes without endorsing one. Note the two quantities differ: `BookMetricsCalculator` produces a word-count *estimate*, `PaginatedBook.pages` the *real* result.
- [ ] **Professional editorial fixture library** (CTO proposal, 2026-07-17, post-Sprint-6) — a permanent `fixtures/` repository of real-shaped manuscripts (`novels/`, `technical/`, `academic/`, `magazine/`, `bible/`, `children/`, `poetry/`, `cookbook/`), each a standing regression fixture exercised by every renderer (DOCX/PDF/EPUB). **Deliberately deferred until Sprint 7's scope is decided** (see IN PROGRESS above) — not started, no directory created yet, so fixtures aren't built for a sprint whose perimeter isn't fixed.
- [ ] **Frontend automated test suite** (new, 2026-07-18, disclosed in `docs/releases/v0.8.0-alpha/SPRINT_7_FINAL_REPORT.md` §6/§7) — `frontend/package.json` has no `test` script; none of Sprint 7's 8 new components (`UploadDropzone`, `BookStructureView`, `ValidationSummary`, `FormatSelector`, `PreviewPanel`, `ExportPanel`, `ProgressStepper`) have unit or integration tests. Every commit was verified via real build/lint/type-check plus manual real-browser interaction, never a repeatable suite — a real, accepted risk for any future refactor of these components. Not scoped, no tooling choice made (Vitest + Testing Library would match `backend/`'s own Vitest choice, but this is a suggestion, not a decision).
- [ ] **Real committed screenshot files for `docs/demo/screenshots/`** (open since Sprint 7 Commit 4, still open at Commit 12) — this environment's Browser pane has no mechanism to persist a captured screenshot to disk. Six real, correct captures exist only in-conversation (Commit 12). A small, scoped capture tool (e.g. a Playwright script run outside this environment) remains the concrete fix named repeatedly but never built.

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
- **Documentation:** Reconciled with actual code as of 2026-07-17 (Sprint 6 merged and released as `v0.7.0-alpha`, all commits + 2 disclosed fix commits; ADR-0029/0030/0031 written)
