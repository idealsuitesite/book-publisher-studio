# Sprint 7 Final Report — First Demonstrable Product

**Sprint:** Sprint 7 ("First Demonstrable Product", renamed from "Premium UI/UX")
**Branch:** `feature/sprint-7-first-demonstrable-product`
**Date:** 2026-07-18 (single-day sprint, 12 commits — Commit 9 split into 9a/9b at CTO direction, so 13 implementation commits landed)
**Status:** ✅ Implementation complete on the feature branch. PR/merge/tag/branch-cleanup are separate `docs/RELEASE_CHECKLIST.md` steps, not part of this report — they require their own explicit authorization and have not been requested or performed as of this report.
**Target version:** `v0.8.0-alpha` (see `docs/VERSIONS.md`, currently ⏳ Planned pending the release steps above).

---

## 1. Initial Objectives

From the Design Review (`docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md`) and the Kickoff charter (`docs/architecture/diagrams/SPRINT_7_KICKOFF.md`):

1. Make six sprints of already-built, already-verified backend capability visible and usable for the first time — not add a new engine, not build the final application.
2. Ship a real Next.js frontend that drives the real backend for the entire core journey: import → structure → validation → format selection → preview → export, with no mocked or hardcoded state anywhere in the chain.
3. Introduce `packages/shared-types` as this project's first monorepo-structural change, eliminating hand-duplicated DTOs between `backend/` and `frontend/`.
4. Hold every `frontend/`-touching commit to the Visible Increment Rule — a real screenshot (or disclosed equivalent), a plain-language "what's now usable" description, and explicit real-data confirmation, logged in `docs/demo/VISIBLE_INCREMENTS.md`.
5. Close with a real, reproducible demonstration: the official Demo Script (`docs/product/PRODUCT_DEMO.md`), run against a real running instance, not a staged or pre-rendered mockup.

---

## 2. What Was Delivered

**Architecture:** stateless backend (Sprint 7 Decision 2) — every UI action is its own complete round trip, no session, no server-side manuscript cache. `packages/shared-types` is transport contracts only (types/interfaces/enums), never Mappers/Validators/business logic (ADR-0033 addendum) — a rule that held for the entire sprint without exception.

| Commit | Delivered |
|---|---|
| 1 | Repository converted to an npm workspace; `packages/shared-types` scaffolded (ADR-0033) |
| 2 | `GET /api/manuscripts/options` — real, additive registry-backed endpoint (Decision 5) |
| 3 | 9 pre-existing DTOs migrated into `packages/shared-types` as re-export shims |
| 4 | The first real screen — title + static drop zone, `lib/api-client.ts` written |
| 5 | Real upload flow — drag-and-drop calls the real import endpoint |
| 6 | `BookStructureView` — real chapter/section outline, word/page/reading-time stats |
| 7 | `ValidationSummary` — real severity-grouped issues + category score |
| 8 | `FormatSelector` — real grouped Standard/KDP layout radio-cards + theme cards |
| 9a | `PreviewPanel` — real on-demand PDF preview, real page count from real PDF bytes |
| 9b | `ExportPanel` — real independent PDF/DOCX/EPUB downloads |
| 10 | Sprint Review Technique — 7-part real-file/real-rebuild verification pass, no code |
| 11 | `ProgressStepper` + redesigned Preview/Validation panels (CTO UI feedback) |
| 12 | Official Demo Script run, 6 real screenshots, ADR-0034, this report |

**Also delivered, not itemized as its own numbered commit — CTO-directed process decisions, formalized in ADR-0034:**
- The Commit 9 → 9a/9b split, for clearer export-pipeline fault isolation.
- A licensing/monetization-aware architecture proposal (trial/Standard/Pro tiers) raised and explicitly deferred, not built.
- A full PDF viewer (page navigation, zoom) raised and explicitly deferred — needs a new dependency and its own Design Review.
- A disclosed, narrow exception to the "never search `backend/uploads/`" rule for a one-off large-document scale diagnostic (Commit 10, Verification 6).

---

## 3. ADRs Created This Sprint

| ADR | Title | Status |
|---|---|---|
| 0033 | Repository Converted to an npm Workspace; `packages/shared-types` Introduced | Written Commit 1, addendum added Commit 3 |
| 0034 | Sprint 7 Governance Decisions | New — consolidates 4 process-level rulings (Commit 9 split, PDF viewer deferral, licensing deferral, uploads/ verification exception) |

---

## 4. Real Bugs Found and Fixed During the Sprint

Unlike Sprint 6 (2 real architectural bugs found via real-file verification), Sprint 7's bugs were smaller in scope but caught by the same discipline — real interaction and real linting, not assumed correctness:

1. **Commit 5:** `lib/api-client.ts`'s `importManuscript` treated HTTP 422 as a hard failure, but `ManuscriptController` returns a real `ImportResponseDTO` body on both 200 and 422 (the pipeline ran either way). Found before it ever shipped to a component.
2. **Commit 8:** `RadioCard`'s `name` prop was destructured but never wired to the underlying `<input>` — caught by `eslint`'s `no-unused-vars` warning, not manual testing. Would have broken native keyboard radio-group navigation while looking visually correct.
3. **Commit 9a:** the first draft reset preview state via `setState` inside a `useEffect` keyed on `layout`/`theme` — a cascading-render anti-pattern caught by `eslint`'s `react-hooks/set-state-in-effect` rule before any browser check ran. Redesigned around derived render-time staleness.
4. **Commit 9b / Commit 10 (recurring):** a real verification-methodology gap, not a code defect — a click on a button below the current viewport fired no request (the automation's computed click coordinate landed outside the interactive element). Found and corrected (scroll into view first) before trusting any click-driven result as evidence, at both Commit 9b and again during Commit 10's Verification 5.

**A recurring tooling issue, not a code defect, tracked across the sprint:** the Next.js 16 Turbopack dev server's `global-error.js` React Client Manifest error, first observed Commit 4, recurred with increasing severity through Commits 8, 9a, and 11 — at its worst (Commit 9a), a full process restart wasn't enough and required clearing the `.next` dev cache. Confirmed closed at Commit 10's full clean rebuild (no recurrence in a fresh session).

---

## 5. Final Metrics

| Metric | Value |
|---|---|
| Backend tests | **336 passing, 0 failing** (unchanged since Sprint 7 Commit 2 — no backend logic changed after Commit 3's DTO migration) |
| Backend global coverage | 92.88% statements |
| Backend domain coverage | 93.76% statements |
| Backend ESLint | 0 errors, 0 warnings |
| Frontend ESLint | 0 errors, 0 warnings (held across all 13 implementation commits) |
| Frontend TypeScript | strict mode, `tsc --noEmit` 0 errors (held across all 13 implementation commits) |
| Frontend `next build` | clean across every commit |
| **Frontend automated test suite** | **none exists** — `frontend/package.json` has no `test` script. Every frontend commit was verified via real build/lint/type-check plus real, manual browser interaction (documented per-commit in `docs/demo/VISIBLE_INCREMENTS.md`), never via a repeatable `npm test`. Disclosed here as a real gap, not silently omitted. |
| `npm run verify-server` / `verify-real-export` (Commit 10) | ✅ 16/16 checks, all 4 canonical fixtures |
| Full clean rebuild (Commit 10, Verification 7) | 666 packages installed in 36s; 336/336 backend tests reproduced exactly from a wiped `node_modules`/`.next`/`dist` |
| Real cross-validated evidence | KDP 6×9 PDF: identical byte size (72,388) and `/MediaBox` whether generated via direct `curl` (Commit 10) or the real UI (Commit 10 Verification 5) — the UI and API export paths are provably the same code |

---

## 6. Deliberately Deferred to Future Work

- **A true PDF viewer with page navigation and zoom** — the current `<embed>` has no programmatic control; needs a new client-side dependency (e.g. pdf.js) and its own Design Review before implementation (ADR-0034 Decision 2).
- **A licensing/monetization-aware architecture** (trial/Standard/Pro tiers, feature-flag components) — conflicts with this sprint's own locked minimal-scope decision and the project's pre-existing licensing-deferral backlog entry; recommended as its own future Design Review (ADR-0034 Decision 3).
- **A frontend automated test suite** — no unit or integration tests exist for any of the 8 new frontend components shipped this sprint. Every commit's correctness claim rests on real manual browser verification, documented per-commit, not on a repeatable suite.
- **Per-layout page estimates shown inside the format selector itself** — would require one export call per layout before any user choice, contradicting the stateless one-round-trip-per-action architecture (Sprint 7 Decision 2). The real number that does exist (Commit 9a) is for one selection, from one real user action.
- **A committed screenshot set** — the 6 official Demo Script captures (Commit 12) exist only in-conversation; this environment has no mechanism to persist a captured screenshot to disk. A real committed PNG set remains a standing open item, same status as it held since Commit 4.

---

## 7. Residual Risks

1. **No frontend test suite is a real, accepted risk** — every one of this sprint's 4 found bugs (§4) was caught by either `eslint` or manual real-browser verification, not a test written to prevent regression. A future refactor of any of the 8 new components has no automated safety net.
2. **The Turbopack `global-error.js` watch-point is closed for this session but not permanently resolved** — the working remedy (a `.next` cache clear) is documented, but the underlying cause (a Next.js 16 Turbopack dev-server quirk) was never root-caused, only worked around when it recurred.
3. **The screenshot-persistence gap affects every future sprint's Visible Increment Rule compliance equally** — not unique to Sprint 7, but unresolved as of this report; a real tooling investment (e.g. a small Playwright capture script) remains the concrete fix named since Commit 4.
4. **`ManuscriptOptionsDTO` currently returns exactly 1 theme** — `FormatSelector`'s Theme section has never been exercised with more than one real option; its layout/behavior with 2+ themes is unverified beyond the component's own generic design.
5. **The stray `large-bhook.pdf` filename artifact (Commit 10) was never fully explained** — content-verified correct and not traced to any application code, but the root cause in this environment's download-handling layer remains unknown.

---

## 8. Lessons Learned

1. **Real interaction and real linting caught every bug this sprint — synthetic assumptions caught none.** All 4 bugs in §4 were found via `eslint` rules or real browser clicks, continuing this project's now seven-sprint-long pattern (ADR-0019/0020/0026/0031) of real verification exposing what code review and type-checking alone did not.
2. **A verification methodology can itself have bugs.** The viewport-click gap (§4, item 4) recurred twice in one sprint — not a product defect both times, but a reminder that "the click didn't register a network request" needs the same skepticism applied to the test as to the code under test, not an assumption that the tooling is infallible.
3. **Disclosing a tooling limitation once doesn't make it go away — it has to be re-disclosed, honestly, every time it recurs.** The screenshot-persistence gap and the Turbopack watch-point were both first logged at Commit 4 and both resurfaced multiple times afterward; the discipline that mattered was re-confirming and re-recording each recurrence, not assuming the first disclosure covered every future instance.
4. **A CTO's own UI mockup can encode an assumption the current architecture can't honestly satisfy** — the Commit 11 "Estimated pages" always-visible mockup assumed a number that doesn't exist before a real request. Flagging the gap and keeping the honest constraint (page count only after real generation) rather than quietly matching the mockup's shape with a fabricated placeholder was the right call, matching this project's real-fixture discipline applied to UI copy, not just backend data.
5. **Splitting a planned commit for better fault isolation (9 → 9a/9b) cost nothing and paid off immediately** — Commit 9a's own bug (`set-state-in-effect`) and Commit 9b's own bug (viewport-click) were each caught and fixed within their own narrower verification pass, exactly the benefit the split was requested for.

---

## 9. Links

- Design Review: `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md`
- Sprint charter: `docs/architecture/diagrams/SPRINT_7_KICKOFF.md`
- Decisions: `docs/DECISIONS.md` (ADR-0033, ADR-0034)
- Full evidence trail: `docs/demo/VISIBLE_INCREMENTS.md`
- Compiled timeline: `docs/releases/v0.8.0-alpha/SPRINT_7_TIMELINE.md`
- Demo Script: `docs/product/PRODUCT_DEMO.md`; screenshots (in-conversation only, not committed): `docs/demo/screenshots/README.md`
- Current state (living doc): `docs/CURRENT_STATE.md`
- Backlog: `docs/TODO.md`
- Previous release: `v0.7.0-alpha` (`docs/releases/v0.7.0-alpha/ReleaseNotes.md`, `SPRINT_6_FINAL_REPORT.md`)
- This report precedes formal `ReleaseNotes.md` for `v0.8.0-alpha`, written once a tag is cut and the PR merges (per `docs/VERSIONS.md`'s "Released only after the tag is pushed" rule) — neither has happened as of this report.
