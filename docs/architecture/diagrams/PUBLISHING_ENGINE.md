# Publishing Engine — Level 2 Design Review

**Status:** 🟡 DRAFT — round 1, awaiting CTO review. Not approved. No branch, no code.
**Date:** 2026-07-18
**Sprint:** Sprint 8 (proposed) — confirmed as this sprint's target by explicit CTO direction, following Sprint 7's release (`v0.8.0-alpha`).

---

## 1. Objectives

Close the gap between what this project has always said it would do (`docs/VERSIONS.md`'s own `v0.9.0-alpha`-and-later roadmap has named "Kindle / Kobo / Lulu / IngramSpark / Amazon KDP export targets" since Sprint 4) and what actually exists today: three format renderers (PDF/DOCX/EPUB) that produce generically correct output, and zero platform-specific packaging. Prepare a finished book for distribution to at least one real platform — real metadata requirements, real cover specs, real pre-submission validation — not just "export a PDF and hope it's accepted."

This is genuinely new territory, not an extension of an existing engine (unlike Sprint 6's Professional Layout Engine, which extended `LayoutEngine`). `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` §2.5 mapped this at Level 1 (2026-07-17, approved) without deciding implementation detail — that's this document's job.

**A real tension found while gathering evidence for this review, not silently resolved (see §2):** `docs/VISION.md` (this project's original vision document) and `PLATFORM_ARCHITECTURE_ROADMAP.md` (written 6 months of project-time later, informed by everything actually built since) describe two different mental models for the same problem. This review has to pick one, explicitly, not default to whichever was read most recently.

---

## 2. Current State — Evidence, Not Assumptions

Every claim below was confirmed by reading the actual code or the actual docs, not inferred from a name.

**`docs/VISION.md`'s original framing (confirmed via `grep`, no dedicated "Publishing Engine" section exists in that document at all):**
> "**Later:** Kindle, Apple Books, Kobo, Lulu, IngramSpark, Amazon KDP — each a new `IRenderer` implementation behind the same port, no Domain changes required" (`docs/VISION.md` line 26)

This treats every platform as **just another format**, at the same architectural level as PDF/DOCX/EPUB today — no separate engine, no post-render step, no new port.

**`PLATFORM_ARCHITECTURE_ROADMAP.md`'s later framing (§2.5, written after Sprints 2-6 shipped real renderers and real platform-adjacent work like Sprint 6's KDP trim-size spike):** a `PublishingTarget` port, analogous to `Renderer<TOutput>` but operating **after** rendering — on rendered output (or `Book` + a renderer's output) plus metadata, not on the `Book` AST directly. Cites real evidence for why: `Book.ts`'s `FrontMatter`/`BackMatter` are "already modeled in the Domain layer but not populated or rendered by any renderer today."

**Confirmed by reading `backend/src/domain/models/Book.ts` directly, not assumed:**
- `FrontMatter` (`cover`/`titlePage`/`copyrightPage`/`dedication`/`toc`/`preface`/`foreword`/`introduction`/`acknowledgments`) and `BackMatter` (`bibliography`/`glossary`/`index`) are real, fully-typed interfaces on `Book`.
- `grep`-confirmed: **zero** references to `frontMatter`, `backMatter`, `titlePage`, `copyrightPage`, `bibliography`, or `glossary` in any of `DOCXRenderer.ts`, `PDFRenderer.ts`, `EPUBRenderer.ts`. Only `frontMatter.toc` is consumed anywhere (Sprint 6's automatic TOC generation) — everything else in both interfaces is dead weight in every real export today.
- `BookMetadata` already carries `isbn`/`issn`/`coverImage`/`copyright`/`license`/`publicationDate` — real fields a platform submission would need — but `ASTBuilder` never populates most of them from a real DOCX import (the same gap Sprint 5's `MetadataRule` already flags on every real import: "Book ISBN is not set", etc.). Publishing Engine inherits this gap; it doesn't cause it and can't fix it alone (`ASTBuilder`/Import Fidelity's territory, `docs/TODO.md`).

**Confirmed by reading `ExportManuscriptUseCase.ts` directly:** the current pipeline is `parse → normalize → build → theme → typography → paginate → render(Buffer)`. The use case returns a raw `Buffer` — nothing downstream of `this.renderer.render(...)` exists today. Any Publishing Engine step is a genuinely new stage, not a modification of an existing one.

**Confirmed by reading `ExportController.ts` directly:** `POST /api/manuscripts/export` today takes `theme`/`format`/`layout` and returns the raw rendered bytes with a generic `Content-Disposition: attachment` header. No platform concept exists anywhere in the current HTTP surface.

**A real, already-decided dependency, not new to this review:** `docs/architecture/diagrams/VALIDATION_ENGINE.md`'s own Decision 2 (Sprint 5, approved) explicitly deferred `PostRenderValidation` (real page count, embedded-font validity, EPUB structural validity — anything only checkable from rendered output, not the `Book` AST) to "likely `Publishing Engine`... since that's the engine that owns platform-specific packaging." This review inherits that open commitment; it wasn't invented here.

**A real, unreconciled backlog overlap, confirmed by reading `docs/TODO.md` directly:** the Backlog section independently lists "Kindle / Kobo / Lulu / IngramSpark / Amazon KDP export targets" (line 188) alongside the Level-1-mapped Publishing Engine item (line 52), which itself already says "to be reconciled when this engine gets its own Design Review" — that reconciliation is this document's job, not a new finding.

**No spike has been run yet.** Unlike Sprint 6 (real KDP trim-size spike, `backend/spikes/kdp-trim-size-spike.ts`, ADR-0030, fetched real specs from kdp.amazon.com before any preset code) or Sprint 3A/3B (PDFKit/EPUB library spikes before any renderer code), this review has not yet independently verified any platform's real, current submission requirements — cover pixel dimensions, required metadata fields, file-naming conventions, EPUB validation tooling a platform actually runs. Everything about "what KDP requires" in this document below is a placeholder for that verification, not a locked fact.

---

## 3. Open Questions for CTO Review (Round 1 — nothing below is locked)

**Question 1 — Which of the two architectural framings governs?** Recommend: `PLATFORM_ARCHITECTURE_ROADMAP.md`'s post-Renderer `PublishingTarget` port, not `VISION.md`'s "just another `IRenderer`" framing. Rationale: real platform submission is provably more than format conversion — it needs real metadata validation (ISBN, cover dimensions), file-naming/packaging conventions, and (per Decision 2 above) `PostRenderValidation` that can only run after real output exists. A `Renderer<TOutput>` implementation has no natural place to do any of that — it would either bloat the `Renderer` port's contract for every implementation (including the 3 that don't need it) or silently do platform-specific work inside what's supposed to be a generic format converter. `VISION.md` predates all of Sprints 2-7's actual renderer work; the roadmap's framing is informed by having built and shipped 3 real renderers since. **This is a recommendation, not a decision — needs explicit confirmation before it's locked**, since it reverses this project's own original vision document, not just extends it.

**Question 2 — Which platform ships first, and does this sprint need its own spike (commit 0)?** Recommend: **Amazon KDP**, for the same reason Sprint 6 picked it as the trim-size spike's real-evidence source — KDP publishes its requirements openly and this project already has one real spike's worth of institutional experience reading them (ADR-0030). Recommend a real Commit-0 spike (`backend/spikes/kdp-publishing-spike.ts`) verifying KDP's actual current metadata requirements, cover image spec (real pixel dimensions and DPI, not guessed), and file-naming/format submission rules — matching the ADR-0019/0020/0030 precedent exactly. **Needs confirmation**, including whether Kobo/Apple Books/Google Play Books get named as explicitly out-of-scope for this sprint (recommended) or partially designed-for now.

**Question 3 — Does `PublishingTarget` own `PostRenderValidation`, and if so, does it reuse `ValidationEngine`'s existing shape?** Recommend: yes to owning it (closes Decision 2's open commitment), and recommend a new `PostRenderValidationRule` family mirroring `ValidationRule`'s existing shape (`RuleRegistry`, pure functions, `ValidationIssue[]` output) rather than a new, parallel validation mechanism — same "don't invent a second system for the same job" discipline `docs/DEVELOPER_HANDBOOK.md` already applies elsewhere. **Needs confirmation** — this could alternatively stay entirely separate from `ValidationEngine` if the CTO judges rendered-output checks (byte-level PDF/EPUB inspection) don't fit the existing rule shape well.

**Question 4 — HTTP surface: extend `POST /api/manuscripts/export`, or a new route?** Recommend: a new `POST /api/manuscripts/publish` route, not another field on `/export`. Rationale: `/export` returns raw bytes for the caller to do whatever they want with (matches its current, correctly-generic contract); "publish to KDP" is a materially different operation — real KDP-specific validation results, a real packaged submission bundle (potentially more than one file — book file + cover file + metadata), not just different `Content-Type` bytes. Conflating them risks `/export`'s response shape becoming platform-aware, which the roadmap's own dependency diagram (§3) explicitly places downstream of and separate from the `Renderer` port. **Needs confirmation.**

**Question 5 — Minimal-for-this-sprint scope boundary.** Recommend, matching Sprint 7's own "minimal-for-demo" discipline (Decision 3, `SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md`): this sprint ships **one platform, validation only** — confirm a manuscript's real readiness for KDP submission (metadata complete, cover spec met, rendered PDF/EPUB structurally valid) and return a real pass/fail report, **not** an actual automated submission to Amazon's real KDP platform (which would need real KDP publisher credentials, a real API integration this project has never scoped, and carries real account/business risk this session has no authorization to create). **Needs explicit confirmation** — "Publishing Engine" could otherwise be read as implying real automated submission, which is a materially larger and riskier scope than validation/packaging.

---

## 4. Architecture Impact (provisional, pending Q1-Q4 above)

Updates `PLATFORM_ARCHITECTURE_ROADMAP.md` §3's dependency diagram's final stage from a placeholder box to:

```
                    ┌──────────▼──────────┐
                    │   Renderer port       │  (built: DOCX/PDF/EPUB, Sprints 2-3B)
                    └──────────┬──────────┘
                    ┌──────────▼──────────┐
                    │ PublishingTarget port │  NEW — one method, e.g.
                    │  KDPTarget (Sprint 8) │  validate(book, renderedOutput): PublishingReport
                    └────────────────────┘
```

`Renderer<TOutput>`'s existing contract is unchanged — `PublishingTarget` is a new, additive port consuming a `Renderer`'s output, not a modification to it (same "additive over signature-break" discipline as ADR-0022/ADR-0027/ADR-0029).

---

## 5. Functional / Technical Specifications (placeholder — locks after Q1-Q5 + spike)

Not written yet. Per `docs/DESIGN_REVIEW_PROCESS.md`, locked interfaces are written before implementation but after the open questions above resolve and (if Q2 confirms one is needed) the KDP spike completes — writing them now would guess at exactly the kind of real external behavior a spike exists to verify instead of assume.

---

## 6. Risks (identified so far, real content pending round 2)

1. **Reversing `VISION.md`'s own original architectural framing (Q1) is a bigger call than a typical Level 2 review makes** — every prior engine's Level 2 review has extended or implemented what `VISION.md`/Level 1 already said; this one recommends changing the original document's own model. Flagged explicitly rather than treated as routine.
2. **No real KDP spike exists yet** — every "requirement" a first draft of this engine might assume (cover pixel dimensions, metadata fields, file naming) needs independent, real verification before any decision locks, matching this project's own repeated lesson (ADR-0019/0020/0026/0030/0031) that assumed requirements — about libraries or about this project's own code — have been wrong before.
3. **Scope creep into real automated submission** is a real, named risk (Q5) — "Publishing Engine" as a name invites reading it as "actually publishes," which this review deliberately recommends against for Sprint 8.
4. **`ASTBuilder` still can't populate ISBN/description/cover-image from a real DOCX** — any KDP-readiness check this engine runs against a real imported manuscript will, today, always fail on metadata completeness (same category as Sprint 5/6's own disclosed, unfixed import-pipeline gaps). Real, not a defect this engine introduces — worth stating up front so a real demo doesn't look broken by surprise.

---

## 7. Commit Plan (placeholder — real plan after round 2 approval)

Expected shape, matching this project's own established rhythm, not yet locked commit-by-commit:
- Commit 0: KDP publishing-requirements spike (if Q2 confirms), before any preset/port code
- `PublishingTarget` port + `KDPTarget` (first, only implementation)
- `PostRenderValidation` rule family (if Q3 confirms reusing `ValidationEngine`'s shape)
- `POST /api/manuscripts/publish` route (if Q4 confirms)
- Real-file verification pass against canonical fixtures
- Docs/ADR reconciliation, per every prior sprint's own closure discipline

---

## 8. Acceptance Criteria (placeholder — concrete outcomes after round 2)

Placeholder pending scope lock. Expected shape: "a real DOCX imported, exported to PDF/EPUB, and checked against `KDPTarget` returns a real, itemized pass/fail report — real ISBN-missing/cover-missing findings where the manuscript genuinely lacks them, not a hardcoded success."

---

## Related

- `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` §2.5 — the Level 1 map this Level 2 review implements, and the "not yet decided" items (port shape, first platform) this review resolves
- `docs/VISION.md` line 26 — the original, now-recommended-to-be-superseded framing (Question 1)
- `docs/architecture/diagrams/VALIDATION_ENGINE.md` Decision 2 — the `PostRenderValidation` commitment this engine inherits
- `docs/TODO.md` — the overlapping "Kindle/Kobo/Lulu/IngramSpark/Amazon KDP export targets" Backlog item this review reconciles
- ADR-0012 (`Renderer` is a port, `ThemeEngine`/`LayoutEngine` are concrete classes) — the port-vs-class precedent `PublishingTarget`'s own shape is checked against
- ADR-0019/ADR-0020/ADR-0030 — the spike-before-decide precedent Question 2 follows
- `backend/src/domain/models/Book.ts` — `FrontMatter`/`BackMatter`, the real, currently-unconsumed Domain scaffolding this engine would finally activate
