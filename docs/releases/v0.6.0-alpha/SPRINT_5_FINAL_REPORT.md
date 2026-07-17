# Sprint 5 Final Report — Validation Engine

**Sprint:** Sprint 5 ("Validation Engine")
**Branch:** `feature/sprint-5-validation-engine`
**Date:** 2026-07-17 (single-day sprint, 11 implementation commits)
**Status:** Implementation complete, all 11 commits done and approved. PR not yet opened — this report and the final docs pass are the last governance step before it, per this project's "PR only once the whole sprint is done and verified" rule (established Sprint 4, reused here).
**Target version:** `v0.6.0-alpha` (see `docs/VERSIONS.md` — tag not yet cut; this report precedes the tag, matching `v0.5.0-alpha`'s own precedent).

---

## 1. Initial Objectives

From the two-level Design Review (`docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md`, `docs/architecture/diagrams/VALIDATION_ENGINE.md`) and the CTO's locked scope:

1. Give Book Publisher Studio its first real, objective quality-diagnostics engine — replacing `BookValidator`'s 5 structural-only checks with a fuller set covering metadata, heading hierarchy, typography, images, hyperlinks, and platform-readiness.
2. Activate `QualityMetrics` (built Sprint 4 commit 9) as real input to a validation rule for the first time — it had zero consumers before this sprint.
3. Establish an extensible architecture (`ValidationEngine` + `RuleRegistry` + independent `ValidationRule`s) that later engines (Editorial AI Engine, Sprint 6/7+) can be built the same way.
4. Fix the platform's target architecture beyond this one engine — Level 1 mapped all 5 remaining engines (Validation, Editorial AI, Plugin System, Professional Layout, Publishing) and their dependencies before any one of them was designed in detail.

---

## 2. What Was Delivered

**Architecture:** `ValidationEngine` orchestrates a `RuleRegistry` of 8 independent, pure `ValidationRule`s. `validate(context: ValidationContext)` replaced the originally-sketched `validate(book, paginated?)` to stabilize the public API against future per-platform rule variants (`ValidationContext.validationProfile` and other reserved fields) without another signature break.

| Commit | Delivered |
|---|---|
| 1 | `ValidationContext`, `ValidationSeverity`, `ValidationIssue`, `ValidationReport`, `QualityScore` types |
| 2 | `ValidationRule` contract + `RuleRegistry` |
| 3 | `ValidationEngine` orchestrator; `StructuralRule` wraps `BookValidator` unchanged (migration before evolution) |
| 4 | `MetadataRule` — ISBN/language/description/cover completeness |
| 5 | `HeadingRule` — heading level skip detection |
| 6 | `MissingRequiredStyleRule` — chapter-without-body-text pattern |
| 7 | `TypographyRule` — wraps `QualityMetrics` from `ValidationContext.metrics` |
| 8 | `ImageRule` + `HyperlinkRule` (syntactic only, no network I/O) |
| 9 | `ComplianceRule` — KDP/EPUB pre-render readiness |
| 10 | `QualityScore` composite scoring — final severity-weighted formula |
| 11 | Wired `ValidationEngine` into `ImportManuscriptUseCase`; DTO updates (`ValidationIssueDTO`, `QualityScoreDTO`) |

**8 rules, one responsibility each, zero inter-rule dependencies** — every rule reads the same `ValidationContext` and returns `ValidationIssue[]`; none call another rule or the registry.

**Also delivered, not originally itemized as its own commit:**
- `createValidationEngine()` factory (`domain/services/validation/`) — single source of truth for "which rules exist," used by both `app.ts` and `ImportManuscriptUseCase.test.ts` instead of each hand-rolling the same 8-rule registration list.

---

## 3. ADRs Created or Extended This Sprint

| ADR | Title | Status |
|---|---|---|
| 0027 | Validation Engine Is Read-Only | New — written *before* commit 1, since it constrains every rule from the start |
| 0028 | Validation Engine Rule Design Principles | New — three principles confirmed as official CTO policy during commits 6, 7, and 9, recorded together after the fact |

Two ADRs from an 11-commit sprint — lighter than Sprint 4's five, reflecting that this sprint had one large upfront Design Review (two levels, two review rounds) rather than mid-sprint discoveries requiring their own ADRs. ADR-0028 in particular is unusual in this project's history: it doesn't record a single decision made at a point in time, it consolidates three related rulings the CTO made across three different commits into one coherent policy, once the pattern was clear.

---

## 4. Design-Review Gaps Found and Resolved Mid-Sprint

Not bugs in the traditional sense (no real-file verification found a defect this sprint, unlike Sprint 4's ADR-0026) — but three real implementation questions surfaced and resolved during specific commits, each generalized into ADR-0028:

1. **Commit 6 (`MissingRequiredStyleRule`):** two CTO-named pattern variants (TOC-without-H1, FootnoteReference-without-Footnote) turned out to be unimplementable as originally scoped — the second needs a `Book` domain-model addition (no `FootnoteReference` inline element exists) that's out of a validation-rule commit's scope. Resolved by documenting both, not implementing either, and explicitly not registering no-op stub rules for them (ADR-0028 principle 1).
2. **Commit 7 (`TypographyRule`):** `QualityMetrics.widowsAndOrphans` turned out to be structurally equal to `headingCount` under Sprint 4's `TypographyResolver` (every `Heading` gets `staysWithNext: true` unconditionally), making a raw-count threshold either always-firing or never-firing — no real signal. Resolved by not implementing this specific check and documenting why (ADR-0028 principle 2).
3. **Commit 9 (`ComplianceRule`):** deliberately reads the same `metadata.isbn`/`title`/`author` fields `MetadataRule`/`StructuralRule` already check. Confirmed as intentional, not duplicated responsibility — different business questions, same underlying data (ADR-0028 principle 3).

---

## 5. Final Metrics

| Metric | Value |
|---|---|
| Tests | **282 passing, 0 failing** (up from 195 at Sprint 5's start — +87 tests) |
| Global coverage | **91.77%** statements |
| Domain coverage | **93.06%** statements |
| ESLint | **0 errors, 0 warnings** |
| TypeScript | strict mode, 0 compiler errors |
| `npm run verify-server` | ✅ passing (port read from the server's own startup log) |
| `npm run verify-real-export` | ✅ **16/16 checks** (4 canonical fixtures × import + export-docx/pdf/epub) |
| Real-import inspection | `typography-test.docx` and `large-book.docx` imported through the real running server, `ValidationReport` read directly — 4 real `WARNING` issues (ISBN/description/cover/KDP-readiness), score 60/100 (metadata subscore 60, others 100), `HeadingRule` correctly silent on `large-book.docx`'s 15 uniform-H1 chapters |

**Per-rule test coverage:** every one of the 8 rules has its own dedicated test file, and every one includes the ADR-0027 immutability check (`structuredClone` + deep-equality of `ValidationContext` before/after `evaluate()`) — a discipline established in commit 3 (`StructuralRule`) and followed without exception through commit 9 (`ComplianceRule`).

---

## 6. Deliberately Deferred to Future Work

- **`PostRenderValidation`** (real page count, embedded-font validity, EPUB structural validity) — named, not built. Likely future `Publishing Engine` scope (`PLATFORM_ARCHITECTURE_ROADMAP.md` §2.5).
- **Hyperlink reachability checking** (real HTTP calls) — syntactic-only this sprint (ADR compliance with ADR-0002); a future `ValidationPlugin` extension point if ever built.
- **`TOC-without-H1`** — feasible against today's model, deferred for scope/time (named in `MissingRequiredStyleRule`'s own doc comment).
- **`FootnoteReference-without-Footnote`** — not feasible without a `Book` domain-model addition (no such `InlineElement` variant exists today).
- **Long-chapter `SUGGESTION`** ("this chapter is 75 pages, consider splitting") — needs a per-chapter length breakdown `QualityMetrics` doesn't have; building it would have meant duplicating `BookMetricsCalculator`'s aggregation responsibility inside a rule.
- **`widowsAndOrphans` threshold check** — no real signal under Sprint 4's current `TypographyResolver` implementation (see §4).
- **`ValidationContext`'s reserved fields** (`configuration`, `locale`, `theme`, `rendererCapabilities`, `validationProfile`) — no rule reads any of them yet; a deliberate, disclosed tradeoff to stabilize the public API now rather than break it later.
- **Wiring `ValidationEngine` into `ExportManuscriptUseCase`** — Sprint 5 wires the import path only; `TypographyRule` in particular can't produce real findings on the import path today since no `PaginatedBook` exists there (only the export pipeline produces one).
- **`Editorial AI Engine`, `Professional Layout Engine`, `Publishing Engine`, `Plugin System`** — mapped at Level 1 only (`PLATFORM_ARCHITECTURE_ROADMAP.md`); no Level 2 design, no code, no Sprint assignment.

---

## 7. Residual Risks

1. **`RULE_CATEGORY`'s string-keyed lookup in `ValidationEngine.ts` has no compile-time link to actual rule names** — a future rule added without a matching entry silently contributes to `overall` but no category subscore. Disclosed in the code's own comment; a real, accepted maintenance risk, not hidden.
2. **`ValidationContext`'s 5 reserved fields carry zero real usage yet** (§6) — if none of them end up used by Sprint 6/7 or a future per-platform `ComplianceRule` variant, this is unused API surface carried for nothing. The CTO's own tradeoff, made explicitly.
3. **`QualityScore`'s severity-weight constants (25/10/3/1) are not derived from any external standard or real usage data** — locked functional intent (worse severity costs more), arithmetic openly available to retune once real manuscripts and real user feedback exist.
4. **`TypographyRule` is currently a no-op on every real import** — `ValidationContext.metrics` is never populated on the import path (§6), so this rule's 3 real checks (empty headings, inconsistent spacing, drop-cap ratio) never fire in production today, only in its own unit tests. Not a defect — a disclosed consequence of Sprint 5's explicit "import path only" wiring scope — but worth flagging so a future session doesn't mistake "TypographyRule never appears in real reports" for a bug.
5. **`MetadataRule`/`ComplianceRule` will flag nearly every real DOCX import** — `ASTBuilder.buildMetadata()` never sets `isbn`/`description`/`coverImage` from DOCX content (confirmed by reading the code, not assumed), so these 4 warnings are close to universal on real imports today. Accurate, not a false positive — but a UI consuming this report should expect it, not be surprised by it.

---

## 8. Lessons Learned

1. **A two-level Design Review (global map + one engine in depth) prevented scope creep without sacrificing architectural coherence.** The "Document Intelligence Engine" candidate was caught and withdrawn during Level 1, before any Level 2 design time was spent on a component with genuine responsibility overlap — cheaper to catch there than mid-implementation.
2. **Surfacing an implementation question mid-rule, rather than guessing, produced a better and more general answer than the original Design Review had.** All three ADR-0028 principles emerged from specific, narrow questions ("should this one threshold exist?") but the CTO's answers were phrased generally enough to govern every future rule, not just the one that prompted them — exactly the value of stopping to ask instead of silently picking a default.
3. **"Migration before evolution" (commit 3) paid for itself for the rest of the sprint.** Because `StructuralRule` was a pure adapter over the untouched `BookValidator` from the very first rule commit, every subsequent commit's rule additions were purely additive — no commit after 3 needed to touch already-shipped rule code, and the final wiring commit (11) had zero behavior surprises in the migrated portion.
4. **A consistent per-rule test pattern (immutability check via `structuredClone`) turned ADR-0027 from a design intention into something actually enforced.** Established once in commit 3, repeated without exception through commit 9 - by the time `ComplianceRule` shipped, "does this rule have an immutability test" was a checklist item nobody had to be reminded of.
5. **Wiring the real DOCX import pipeline exposed two disclosed-but-easy-to-forget consequences** (§7 risks 4 and 5) that unit tests alone would never surface, because unit tests construct their own `ValidationContext`/`Book` fixtures rather than going through `ASTBuilder.buildMetadata()`'s real defaults. The same "verify with a real file" discipline that found real bugs in Sprint 4 (ADR-0026) found real *consequences* (not bugs) in Sprint 5 — a softer but still valuable version of the same practice.

---

## 9. Links

- Design Review: `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` (Level 1), `docs/architecture/diagrams/VALIDATION_ENGINE.md` (Level 2)
- Sprint charter: `docs/architecture/diagrams/SPRINT_5_KICKOFF.md`
- Decisions: `docs/DECISIONS.md` (ADR-0027, ADR-0028)
- Current state (living doc): `docs/CURRENT_STATE.md`
- Backlog: `docs/TODO.md`
- Previous release: `v0.5.0-alpha` (`docs/releases/v0.5.0-alpha/ReleaseNotes.md`, `SPRINT_4_FINAL_REPORT.md`)
- This report precedes formal `ReleaseNotes.md` for `v0.6.0-alpha`, written once the tag is cut and the PR merges (per `docs/VERSIONS.md`'s "Released only after the tag is pushed" rule).
