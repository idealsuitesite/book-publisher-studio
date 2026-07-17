# Release Notes — v0.6.0-alpha

**Tag:** `v0.6.0-alpha`
**Date:** 2026-07-17
**Codename:** Validation Engine

## Summary

This release replaces `BookValidator`'s 5 structural-only checks with `ValidationEngine` — an orchestrator running 8 independent, pure `ValidationRule`s over a manuscript's structure, metadata, heading hierarchy, typography, images, hyperlinks, and KDP/EPUB platform readiness. It activates `QualityMetrics` (built Sprint 4, zero consumers until now) as real rule input for the first time, and produces a `QualityScore` (0-100, severity-weighted, per-category) — strictly an interpretation layer over the underlying diagnostics, never a substitute for them.

A two-level Design Review preceded any code: a global architecture map of all 5 remaining engines (`docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` — Validation, Editorial AI, Plugin System, Professional Layout, Publishing) fixed responsibilities and dependencies before any one of them was designed in depth, then Validation Engine's own full design (`docs/architecture/diagrams/VALIDATION_ENGINE.md`). A sixth candidate, "Document Intelligence Engine," was proposed and explicitly withdrawn during Level 1 — no prior definition anywhere in the project, and every plausible scope for it overlapped Validation or Editorial AI Engine. Built across 11 implementation commits plus a governance-closure commit on `feature/sprint-5-validation-engine`, merged via PR #10. Full retrospective: `docs/releases/v0.6.0-alpha/SPRINT_5_FINAL_REPORT.md`.

## Features

- **`ValidationEngine`** (`backend/src/domain/services/ValidationEngine.ts`) — orchestrates a `RuleRegistry` of 8 independent rules, assembling their findings into one `ValidationReport`. Never mutates its input (ADR-0027) — every rule's own test suite asserts this via `structuredClone` + deep-equality of the input before/after `evaluate()`.
- **8 `ValidationRule`s**, one responsibility each, zero inter-rule dependencies: `StructuralRule` (wraps `BookValidator` unchanged — migration before evolution), `MetadataRule` (ISBN/language/description/cover completeness), `HeadingRule` (heading level skip detection), `MissingRequiredStyleRule` (chapter-without-body-text pattern), `TypographyRule` (wraps `QualityMetrics` from `ValidationContext.metrics`), `ImageRule` (low-resolution images, syntactic), `HyperlinkRule` (syntactic link validation, no network I/O), `ComplianceRule` (KDP/EPUB pre-render readiness).
- **New types:** `ValidationContext` (stabilizes `validate(context)` against future per-platform rule variants without another signature break), `ValidationSeverity` (`ERROR`/`WARNING`/`INFO`/`SUGGESTION`, generalizing the old binary error/warning split), `ValidationIssue`, `ValidationReport` (extends the existing `ValidationResult` — `errors`/`warnings` stay as backward-compatible derived views), `QualityScore`.
- **`ImportManuscriptUseCase`** now uses `ValidationEngine` instead of `BookValidator` directly (`BookValidator` itself is untouched, now `StructuralRule`'s internal implementation). `ImportReportDTO` gains `issues`/`score` additively.
- **Tests** — 87 new tests (up from 195 to 282), one per rule's own dedicated test file, each including the ADR-0027 immutability check.

## Real, Disclosed Behavior Change (Not a Regression)

`ASTBuilder.buildMetadata()` never populates `isbn`/`description`/`coverImage` from DOCX content — confirmed by reading the code. As a direct, intended result, `POST /api/manuscripts/import`'s `warnings` array is no longer empty on a typical real import: `MetadataRule`/`ComplianceRule` now correctly flag these as missing. Confirmed against the real running server importing `backend/verification/typography-test.docx` (4 `WARNING` issues, `score.overall` 60/100) and `large-book.docx` (same 4 warnings; `HeadingRule` correctly silent on its 15 uniform-H1 chapters).

## Design-Review Gaps Found and Resolved Mid-Sprint

Not bugs — three real implementation questions surfaced during specific commits, each generalized into ADR-0028 (see Architecture below):

1. **Commit 6:** two Design-Review-named `MissingRequiredStyleRule` variants (TOC-without-H1, FootnoteReference-without-Footnote) turned out unimplementable as scoped — the second needs a `Book` domain-model addition (no `FootnoteReference` inline element exists). Documented, not implemented, not registered as no-op stubs.
2. **Commit 7:** `QualityMetrics.widowsAndOrphans` is structurally equal to `headingCount` under Sprint 4's `TypographyResolver` (every `Heading` gets `staysWithNext: true` unconditionally) — a threshold on it would always fire or never fire. Not implemented, documented why.
3. **Commit 9:** `ComplianceRule` deliberately reads the same fields `MetadataRule`/`StructuralRule` already check — confirmed intentional (different business questions, same data), not duplicated responsibility.

## Architecture

- **Design Review before code**, two levels (`PLATFORM_ARCHITECTURE_ROADMAP.md`, `VALIDATION_ENGINE.md`), two review rounds on the second.
- **`ValidationEngine` is a concrete Domain class, `RuleRegistry` holds `ValidationRule` instances (not classes)** — the swappable unit is the rule, not the engine, matching this project's existing `ThemeEngine`/`LayoutEngine`/`TypographyResolver` precedent (one correct orchestration, no port needed).
- **ADR-0027 — Validation Engine Is Read-Only.** Written *before* commit 1, constraining every rule from the start.
- **ADR-0028 — Validation Engine Rule Design Principles.** Three principles confirmed as official policy across commits 6/7/9 (see above), consolidated into one record for future rules — this engine's or later ones.
- **`main` as a production branch** (ADR-0017) held: built entirely on `feature/sprint-5-validation-engine`, reviewed commit-by-commit via PR #10, merged — no direct code commits to `main`.

## Quality Metrics

| Metric | Value |
|---|---|
| Tests | 282 passing, 0 failing (up from 195) |
| Global coverage | 91.77% statements |
| Domain coverage | 93.06% statements |
| ESLint | 0 errors, 0 warnings |
| TypeScript | strict mode, 0 compiler errors |
| `npm run verify-real-export` | 16/16 (4 canonical fixtures × import + export-docx/pdf/epub) |
| Manual verification | Real import of `typography-test.docx`/`large-book.docx` via the running dev server, `ValidationReport` read directly — real, non-hardcoded-zero findings and scores, not just asserted via `npm test` |

## Known Issues / Deliberate Simplifications

- `TypographyRule` is currently a no-op on every real import — no `PaginatedBook` exists on the import path (only `ExportManuscriptUseCase`'s pipeline produces one), so its 3 checks (empty headings, inconsistent spacing, drop-cap ratio) never fire in production yet, only in unit tests.
- `RULE_CATEGORY` (`ValidationEngine.ts`) is a string-keyed lookup with no compile-time link to actual rule names — a future rule added without a matching entry silently contributes to `overall` but no category subscore.
- `ValidationContext`'s 5 reserved fields (`configuration`, `locale`, `theme`, `rendererCapabilities`, `validationProfile`) carry zero real usage yet — a deliberate tradeoff to stabilize the API now.
- `QualityScore`'s severity-weight constants (25/10/3/1) aren't derived from any external standard — locked functional intent, arithmetic open to retuning.
- Hyperlink reachability checking (real HTTP calls) is out of scope — syntactic validation only, per ADR-0002 (Domain has zero infrastructure dependencies).
- `PostRenderValidation` (real page count, embedded-font validity, EPUB structural validity) is out of scope — likely future `Publishing Engine` territory.

## What This Release Does Not Include

`Editorial AI Engine`, `Professional Layout Engine`, `Publishing Engine`, `Plugin System` — all mapped at Level 1 (`PLATFORM_ARCHITECTURE_ROADMAP.md`) but no Level 2 design, no code, no Sprint assignment. Wiring `ValidationEngine` into `ExportManuscriptUseCase` is also not included — Sprint 5 wires the import path only.

## Upgrade / Migration Notes

`POST /api/manuscripts/import`'s `warnings` array is very likely non-empty now on real DOCX imports (see "Real, Disclosed Behavior Change" above) — any client treating an empty `warnings` array as the norm should be updated to expect real findings. `errors`/`statistics` fields are unchanged in shape and meaning. `issues`/`score` are new, additive fields — safe to ignore for clients that don't need them yet. `POST /api/manuscripts/export` is entirely unaffected by this release.

## Links

- Architecture: `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md`, `docs/architecture/diagrams/VALIDATION_ENGINE.md`
- Sprint charter: `docs/architecture/diagrams/SPRINT_5_KICKOFF.md`
- Sprint retrospective: `docs/releases/v0.6.0-alpha/SPRINT_5_FINAL_REPORT.md`
- Decisions: `docs/DECISIONS.md` (ADR-0027, ADR-0028)
- Current state (living doc): `docs/CURRENT_STATE.md`
- Pull request: #10 (`feature/sprint-5-validation-engine` → `main`, merge commit `3032d70`)
- Previous release: `v0.5.0-alpha` (Typography Engine, `docs/releases/v0.5.0-alpha/ReleaseNotes.md`)
