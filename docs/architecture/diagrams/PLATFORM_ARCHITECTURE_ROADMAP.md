# Platform Architecture Roadmap — Level 1 (Post-Sprint-4)

**Status:** ✅ APPROVED (2026-07-17) — round 2 complete. CTO validated the two-level split, the full pipeline ordering, the read-only Validation Engine boundary, the Editorial AI Engine relationship, the Plugin System ≠ AI Provider clarification, and the Professional Layout Engine / Publishing Engine placements, all without changes. Only the Level 2 (`VALIDATION_ENGINE.md`) content had open questions to resolve — this Level 1 document was approved as originally drafted.
**Date:** 2026-07-17
**Scope:** Global map of the 5 engines planned beyond the now-shipped rendering pipeline (Theme → Typography → Layout → Renderer, `v0.5.0-alpha`). **No code, no implementation detail** — that's Level 2, one engine at a time, starting with Validation Engine (`VALIDATION_ENGINE.md`, Sprint 5).

This document is deliberately lighter-weight than a per-engine Design Review. Its only job is to fix responsibilities and dependencies *before* any one engine's detailed design starts, so Sprint 6+'s Editorial AI Engine doesn't get designed in a way that fights Sprint 5's Validation Engine, and so on.

---

## 1. Why this document exists

Two competing Sprint 5 priority proposals were on the table at the end of Sprint 4 (`docs/TODO.md`), each bundling 3-4 different engines without settling how they'd relate to each other. Rather than pick an ordering blind, this document fixes the *shape* of the target architecture first — one Design Review, done once, that every future per-engine Design Review can be checked against instead of re-litigating boundaries each time.

**A sixth candidate — "Document Intelligence Engine" — was proposed and explicitly withdrawn during this review** (2026-07-17), on the CTO's own reconsideration: it had no prior definition anywhere in this project (`VISION.md`, `docs/TODO.md`), and its most plausible scopes all overlapped either Validation Engine (structural/consistency diagnostics) or Editorial AI Engine (content-level analysis). Five well-bounded engines were judged better than six with blurred edges. Not recorded further here except as a rejected alternative, matching how `TYPOGRAPHY_ENGINE.md` records its own rejected `TypesetBook` proposal.

---

## 2. The Five Engines

### 2.1 Validation Engine

**Responsibility:** Determine objectively whether a document is correct and compliant. **Produces diagnostics, never corrections** — this boundary is load-bearing, and is now formalized as **ADR-0027 ("Validation Engine is Read-Only")**, not just a design intent.

**Scope (locked, round 2):** metadata completeness, heading hierarchy, required-style structural consistency (`MissingRequiredStyleRule`), typography issues, low-resolution images, syntactically-broken hyperlinks (no network I/O — domain stays pure), KDP/EPUB **pre-render** readiness. "Missing styles" as originally scoped (a block with no resolved style) was confirmed not to exist as a concept in this architecture and was replaced with the narrower, real `MissingRequiredStyleRule` — full detail in `VALIDATION_ENGINE.md` §3.

**Relationship to what's already built:** extends today's `BookValidator` (structural-only: missing title/author, empty book, empty/duplicate chapter) and activates `QualityMetrics` (`BookMetricsCalculator.calculateQualityMetrics()`, built Sprint 4 commit 9 but not yet consumed by anything) as real input data for scoring. Architecture: `ValidationEngine` orchestrating a `RuleRegistry` of independent `ValidationRule`s (not a flat set of Validator classes, not one large class) — full detail in `VALIDATION_ENGINE.md`.

**Position in the pipeline:** after `ASTBuilder`, same position `BookValidator` already occupies today. **Resolved (round 2):** format-compliance checks are split into `PreRenderValidation` (Sprint 5, checkable from the `Book` AST alone) and `PostRenderValidation` (future, likely `Publishing Engine` scope, since rendered-output correctness like real page count and EPUB structural validity naturally belongs with platform packaging, not manuscript validation).

### 2.2 Editorial AI Engine

**Responsibility:** Turn Validation Engine's diagnostics (and the manuscript content itself) into intelligent recommendations — style improvement, sentence simplification, AI-text humanization, repetition detection, title suggestions, readability improvement, tone harmonization, chapter-restructuring suggestions.

**New dependency fixed by this review:** Editorial AI Engine **consumes Validation Engine's output** (CTO direction, 2026-07-17) — this is a real, new architectural constraint beyond what `VISION.md`'s existing Editorial AI Engine section already specifies. It means Validation Engine must run *before* Editorial AI Engine in the pipeline, not just before rendering.

**Already scoped in detail** (`docs/VISION.md` §"Editorial AI Engine — Future Independent Module"): position between Normalizer and Theme Engine, provider-agnostic, composed of focused services (`GrammarService`, `StyleService`, `HumanizationService`, `ReadabilityService`, `ConsistencyService`, `AIRewriteService`, `CitationService`, `SuggestionsService`), accept/reject workflow (never silently applies a change), realistically its own Sprint 6/7. This review doesn't re-derive that section — it only adds the Validation Engine dependency and confirms the pipeline ordering below.

**Reconciled pipeline position (updates `VISION.md`'s diagram):**
```
Parser → Normalizer → ASTBuilder → Validation Engine → Editorial AI Engine → Theme Engine → Typography Engine → Professional Layout Engine → Renderer → Publishing Engine
```

### 2.3 Plugin System

**Responsibility (narrowed by this review, 2026-07-17):** abstract AI providers (OpenAI, Claude, Gemini, Mistral, DeepSeek, local models) behind one interface so the core never depends on a specific vendor. Primary consumer: Editorial AI Engine.

**Reconciliation needed with the existing, broader Plugin System scope** (`docs/VISION.md` §"Plugin System"): that section already describes a more general mechanism — sandboxed, versioned plugins operating on the Book AST, returning an updated `Book` or a list of validation issues, with named first-party examples (Bible Reference verification, Translation, **AI Proofreading**, Grammar checking, Index Generator, Glossary builder, ISBN validation, QR code generation). **These are not in conflict** — AI-provider abstraction is one *mechanism* the broader plugin system needs (an `AIProofreadingPlugin` has to call some LLM provider through something), not a competing definition. Whichever engine's Design Review implements this first (most likely Editorial AI Engine, since it's the first real consumer) should treat "AI provider abstraction" as a focused port (`AIProvider`-shaped, mirroring the existing `Renderer<TOutput>`/`DocumentParser` port pattern) that the full Plugin System later builds on, not a parallel system.

**Not this sprint or the next** — no Design Review scheduled yet. Recorded here only so Editorial AI Engine's eventual design doesn't quietly hardcode one AI vendor.

### 2.4 Professional Layout Engine

**Responsibility:** Apply composition and layout decisions automatically — fuller than today's `LayoutEngine`.

**Relationship to what's already built:** this is very likely an **evolution of the existing `LayoutEngine`** (ADR-0012's concrete Domain class, `paginate()`), not a new parallel component — `LayoutEngine` already owns pagination, margins, and (as of Sprint 4) keep-with-next nudges. "Automatic layout/style selection" is a real expansion of scope (today's `ThemeEngine`/`LayoutEngine` apply a caller-chosen theme and a fixed `PageLayout`; nothing today *chooses* one), but the Level 2 Design Review for this engine (not yet scheduled) needs to confirm whether it's `LayoutEngine` gaining new responsibility or a genuinely new class — same kind of question Sprint 4's Design Review resolved for `TypographyResolver` vs. folding into `ThemeEngine`.

**Position in the pipeline:** unchanged from today's `LayoutEngine` — after Typography, before the `Renderer` port.

### 2.5 Publishing Engine

**Responsibility:** Prepare the finished book for distribution — Amazon KDP, Kobo, Apple Books, Google Play Books.

**Relationship to what's already built:** this is genuinely new territory, downstream of everything else. `Book.ts`'s `FrontMatter`/`BackMatter` interfaces (`TitlePage`, `CopyrightPage`, `TableOfContents`, `Bibliography`, `Glossary`, `IndexEntry`) are **already modeled in the Domain layer but not populated or rendered by any renderer today** — real, concrete evidence that this engine has a natural landing spot already reserved for it, not a fresh Domain concept. Per-platform requirements (KDP trim sizes/cover specs/metadata fields, EPUB validity for Kobo/Apple Books/Google Play Books, each store's own metadata schema) suggest a port-per-platform shape analogous to `Renderer<TOutput>` — a `PublishingTarget` (or similarly named) port with `KDPTarget`/`KoboTarget`/`AppleBooksTarget`/`GooglePlayBooksTarget` adapters — but this is a Level 2 decision, not fixed here.

**Position in the pipeline:** after the `Renderer` port — it operates on rendered output (or on the `Book` + a chosen `Renderer`'s output) plus metadata, not on the `Book` AST directly.

---

## 3. Dependency Diagram

```
                    ┌────────────────────┐
                    │   Book AST (built)  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Validation Engine   │  produces diagnostics only —
                    │  (Sprint 5)          │  never mutates the Book
                    └──────────┬──────────┘
                               │ diagnostics consumed by
                    ┌──────────▼──────────┐        ┌────────────────┐
                    │ Editorial AI Engine  │───────▶│ Plugin System   │
                    │ (Sprint 6/7)         │  uses  │ (AI providers)  │
                    └──────────┬──────────┘        └────────────────┘
                               │ suggestions, accept/reject by author
                    ┌──────────▼──────────┐
                    │     Theme Engine      │  (built, Sprint 2)
                    └──────────┬──────────┘
                    ┌──────────▼──────────┐
                    │  Typography Engine    │  (built, Sprint 4)
                    └──────────┬──────────┘
                    ┌──────────▼──────────┐
                    │ Professional Layout   │  evolves LayoutEngine (built, Sprint 2)
                    │       Engine           │
                    └──────────┬──────────┘
                    ┌──────────▼──────────┐
                    │   Renderer port       │  (built: DOCX/PDF/EPUB, Sprints 2-3B)
                    └──────────┬──────────┘
                    ┌──────────▼──────────┐
                    │  Publishing Engine    │  platform packaging (KDP/Kobo/
                    │  (not yet scheduled)  │  Apple Books/Google Play Books)
                    └────────────────────┘
```

**Key dependency this review fixes:** Validation Engine → Editorial AI Engine is a real, ordered data dependency, not just a shared pipeline position. Every other arrow above already followed from `docs/VISION.md`, ADR-0012, or Sprint 4's Design Review — this diagram's only new contribution is placing Validation Engine before Editorial AI Engine and confirming Publishing Engine sits after `Renderer`, not before.

---

## 4. What This Review Does Not Decide

Deliberately left to each engine's own Level 2 Design Review, matching this project's "spike/design before code" discipline (ADR-0019/ADR-0020 precedent):

- Whether "Professional Layout Engine" is `LayoutEngine` extended or a new class
- The exact shape of the `AIProvider` port and which vendor(s) get a first adapter
- Publishing Engine's exact port shape and which platform ships first
- Sprint numbering/scheduling for Editorial AI Engine, Professional Layout Engine, Plugin System, and Publishing Engine beyond "Validation Engine is Sprint 5" — no commitment made here about Sprint 6, 7, 8 assignments

## 4a. Proposed Sprint 7 Scope Change — Not Yet Decided

**Status:** PROPOSED (2026-07-17, CTO recommendation, post-Sprint-6). Explicitly not approved — recorded here so it isn't lost before its own Design Review, and so `docs/VERSIONS.md`'s existing sequencing (Plugin System / Editorial AI Engine / Publishing Engine before Premium UI/UX at `v0.8.0-alpha`) isn't silently contradicted by a later session picking a different Sprint 7 without knowing this was floated.

**Design Review ✅ APPROVED (round 2, 2026-07-18):** `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` (renamed from "Premium UI/UX" per CTO direction — the objective is making six sprints of built capability visible, not primarily visual polish). All 5 open decisions from round 1 resolved by explicit CTO direction: full re-export instead of instant preview, a fully stateless backend, only-what-the-demo-needs scope, a real `packages/shared-types` workspace package instead of hand-duplicated types, and a `GET /api/manuscripts/options` endpoint deliberately shaped for future extension. Companion product docs written: `docs/product/PERSONAS.md`, `USER_JOURNEYS.md`, `FEATURE_MATRIX.md`, `WIREFRAMES.md`, `PRODUCT_DEMO.md` (includes the official Demo Script), `PRODUCT_ACCEPTANCE.md`, plus `docs/demo/screenshots/README.md`. **No branch, no code yet** — ready for implementation once the CTO gives final go-ahead to branch, matching every prior sprint's own gate.

**The proposal:** make Sprint 7 the project's first interactive, demonstrable milestone rather than the next backend-only engine. Concretely: launch Book Publisher Studio, import a real DOCX manuscript, see the book's structure, change the export format (A4/A5/KDP 6×9) via `LayoutSelector`, preview the result, and export to PDF/DOCX/EPUB — end to end, through a UI, not just `curl`/Postman against `POST /api/manuscripts/*`. This is substantively the `v0.8.0-alpha` "Premium UI/UX" (Next.js frontend, drag-and-drop import, live preview) milestone already named in `docs/VERSIONS.md`, proposed to move ahead of Plugin System / Editorial AI Engine / Publishing Engine rather than after them.

**Rationale offered:** every engine a demo would need already exists and is real-file-verified (import, theme/typography/layout, PDF/DOCX/EPUB export, layout selection) — the gap is visibility, not capability. A working, showable version unblocks external validation (editors, authors, partners) before investing further in engines nothing outside the API surface can yet exercise.

**What would change if approved:** `docs/VERSIONS.md`'s `v0.8.0-alpha` (Premium UI/UX) row would become Sprint 7, and Plugin System/Editorial AI Engine/Publishing Engine would each shift one slot later — the same renumbering mechanics already used twice (Sprint 5, Sprint 6) when a placeholder milestone got superseded by an actual Design-Review-backed decision.

**Explicitly not done as part of recording this proposal:** no `docs/VERSIONS.md` renumbering, no Sprint 7 branch, no frontend code, no Level 2 Design Review yet — this section exists only so the option is on the record. A dedicated Design Review (matching every prior engine's own process — evidence gathered, options weighed, CTO decision recorded) is the next step before any of this is scheduled or built.

---

## 5. Related

- `docs/VISION.md` — original source for Editorial AI Engine and Plugin System's broader scope
- `docs/TODO.md` — the two competing Sprint 5 priority proposals this review reconciles
- `docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md` — the template this review's format follows (two-round CTO review, evidence before design)
- `docs/architecture/diagrams/VALIDATION_ENGINE.md` — Level 2, Sprint 5's actual Design Review (✅ APPROVED, round 2)
- ADR-0012 (`Renderer` is a port; `ThemeEngine`/`LayoutEngine` are concrete classes) — the precedent `Professional Layout Engine`'s and `Publishing Engine`'s eventual port-or-class question will be checked against
- ADR-0027 (Validation Engine is read-only) — formalizes this document's §2.1 boundary
