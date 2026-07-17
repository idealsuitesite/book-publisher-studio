# Sprint 5 Kickoff — Validation Engine

**Status:** ✅ Implementation complete (all 11 commits, CTO-approved one by one). Verified against this charter's own Definition of Done below (2026-07-17, governance closure pass) — one item found not yet satisfied, corrected before the PR opens. PR not yet opened.
**Date:** 2026-07-17

This is the charter for Sprint 5. It doesn't repeat the full design — that's `VALIDATION_ENGINE.md` (Level 2) and `PLATFORM_ARCHITECTURE_ROADMAP.md` (Level 1). This document is what a developer (or a fresh session) should be able to read in two minutes and know exactly what's expected, before opening either of those.

---

## Objective

Give Book Publisher Studio its first real, objective quality-diagnostics engine. Today's `BookValidator` only checks 5 structural facts (title, author, empty book, empty/duplicate chapter). Sprint 5 replaces it with `ValidationEngine` — an orchestrator running independent, pure rules over a manuscript's structure, metadata, typography, images, and hyperlinks — and, for the first time, gives `QualityMetrics` (built Sprint 4, unused since) a real consumer.

## Scope

- `ValidationEngine` orchestrating a `RuleRegistry` of 7 rules: `StructuralRule`, `MetadataRule`, `HeadingRule`, `MissingRequiredStyleRule`, `TypographyRule`, `ImageRule`, `HyperlinkRule`, `ComplianceRule`
- New types: `ValidationContext`, `ValidationSeverity` (`ERROR`/`WARNING`/`INFO`/`SUGGESTION`), `ValidationIssue`, `ValidationReport`, `QualityScore`
- Wiring into `ImportManuscriptUseCase` (replaces its `BookValidator` dependency)
- KDP/EPUB compliance: **pre-render checks only** (`PreRenderValidation`)
- Hyperlink checks: **syntactic only**, no network calls

## Out of Scope (explicitly, not by omission)

- **Corrections of any kind.** Validation Engine never mutates the `Book` — that's ADR-0027, enforced by test. Fixing what it finds is Editorial AI Engine's job (Sprint 6/7+), not this sprint's.
- **`PostRenderValidation`** (real page count, embedded-font validity, EPUB structural validity) — named, deferred to the future Publishing Engine.
- **Network-based hyperlink reachability checking** — syntactic validation only this sprint.
- **`TOC-without-H1` and `FootnoteReference-without-Footnote`** checks — named by the CTO, reserved in the registry, not implemented (the second needs a `Book` domain-model addition — no `FootnoteReference` inline element exists today).
- **`ExportManuscriptUseCase` wiring** — Sprint 5 wires the import path only.
- **Editorial AI Engine, Professional Layout Engine, Publishing Engine, Plugin System** — mapped at Level 1 only; no Level 2 design, no code, no Sprint assignment.

## Applicable ADRs

- **ADR-0027** — Validation Engine is read-only. The one non-negotiable constraint on every rule.
- **ADR-0002** — Domain has zero infrastructure dependencies (why hyperlink checks stay syntactic).
- **ADR-0001** — Immutable updates only (the same purity pattern `ThemeEngine`/`TypographyResolver`/`LayoutEngine` already follow).
- **ADR-0008** — Metrics ownership; precedent for moving `BookValidator`'s existing logic into `StructuralRule` without behavior change.
- **ADR-0022** — Additive-field-not-signature-break pattern, reused for `ValidationContext` and `ValidationReport`.
- **ADR-0006** — Coverage gates (Domain >90%, global >80%), unchanged.
- **ADR-0017** — No direct-to-`main` implementation; feature branch + PR.

## Reference Documents

- `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` — Level 1, the 5-engine map and why Validation Engine runs before Editorial AI Engine
- `docs/architecture/diagrams/VALIDATION_ENGINE.md` — Level 2, the full design (read this before implementing any rule)
- `docs/DECISIONS.md` — ADR-0027 and every ADR listed above
- `docs/REAL_EXPORT_CHECKLIST.md` — applies to commit 12 (`ImportManuscriptUseCase` changes)
- `docs/CLAUDE.md` — Clean Architecture rules, naming conventions, after-every-task checklist

## The 11 Planned Commits

Per `VALIDATION_ENGINE.md` §8, one responsibility each, green build/tests before moving to the next:

1. `domain(validation): ValidationContext, ValidationSeverity, ValidationIssue, ValidationReport, QualityScore types`
2. `domain(validation): ValidationRule contract + RuleRegistry`
3. `domain(validation): ValidationEngine orchestrator; StructuralRule wraps existing BookValidator logic unchanged`
4. `domain(validation): MetadataRule — ISBN/language/description/cover completeness`
5. `domain(validation): HeadingRule — heading level skip detection`
6. `domain(validation): MissingRequiredStyleRule — chapter-without-body-text pattern`
7. `domain(validation): TypographyRule wraps QualityMetrics from ValidationContext.metrics + long-chapter SUGGESTION`
8. `domain(validation): ImageRule + HyperlinkRule (syntactic only, no network I/O)`
9. `domain(validation): ComplianceRule — KDP/EPUB pre-render readiness`
10. `domain(validation): QualityScore composite scoring`
11. `application(import): wire ValidationEngine into ImportManuscriptUseCase, DTO updates`

(Commit 12, E2E real-file verification, and commit 13, docs/ADR reconciliation, follow per `VALIDATION_ENGINE.md` §8 but aren't "implementation" commits in the same sense — listed there, not repeated here as part of the 11.)

## Definition of "Done"

Sprint 5 is done when, and only when — verified here against what actually happened, not assumed:

- [x] All 11 implementation commits landed, each with its own green build/lint/test before the next started
- [x] Every rule has its own test file (one responsibility, own test suite — no shared "all rules" test file): `StructuralRule`, `MetadataRule`, `HeadingRule`, `MissingRequiredStyleRule`, `TypographyRule`, `ImageRule`, `HyperlinkRule`, `ComplianceRule` all have one
- [x] Every rule's test suite asserts input immutability (deep-equality of `ValidationContext`/`Book` before vs. after `evaluate()`) per ADR-0027
- [x] `BookValidator`'s existing behavior (6 cases, not 5 — corrected count) preserved unchanged: `BookValidator.test.ts` still tests it directly, and the new `StructuralRule.test.ts` independently verifies the same 6 cases through the `ValidationRule` adapter
- [x] A real DOCX from `backend/verification/` produces a `ValidationReport` with real, non-hardcoded-zero findings when imported through the running dev server — confirmed against `typography-test.docx` (4 `WARNING` issues, score 60/100) and `large-book.docx`
- [x] `CURRENT_STATE.md`/`TODO.md`/`VERSIONS.md` reconciled, new ADRs written (ADR-0027, ADR-0028)
- [ ] ~~`docs/REAL_EXPORT_CHECKLIST.md` completed for the `ImportManuscriptUseCase` change~~ — **found not yet done during this verification pass.** `npm run verify-server`/`verify-real-export` both ran and passed (commit 11), but the literal filled-out checklist template (matching Sprint 4 PR #9's own precedent, embedded in the PR body) was not produced as its own artifact yet. Will be completed as part of the PR body, before the PR opens - not silently skipped.
- [ ] PR opened, reviewed, merged — no direct commits to `main` — not yet done, explicitly deferred pending CTO go-ahead

## Quality Checklist (run before every commit, not just at the end)

```bash
cd "D:\Book Publisher Studio\backend"
npm run build            # 0 TypeScript errors
npm run lint              # 0 ESLint errors/warnings
npm test                  # all passing, 0 skipped
npm run test:coverage     # Domain >90%, global >80% statements
npm run verify-server         # only needed once ImportManuscriptUseCase wiring lands (commit 11+)
npm run verify-real-export    # 16/16, same commits
```

---

**Scope discipline:** no deviation from the scope above without a new Design Review — this is the CTO's own condition for the go-ahead, not a suggestion.
