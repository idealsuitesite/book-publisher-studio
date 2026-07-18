# Release Notes — v0.8.0-alpha

**Tag:** `v0.8.0-alpha`
**Date:** 2026-07-18
**Codename:** First Demonstrable Product

## Summary

This release ships Book Publisher Studio's first real, end-to-end user-facing product — a real Next.js frontend driving the real, already-built backend for the entire core journey: import a real DOCX, see its real structure, see real validation findings, choose a real page layout and theme, generate a real PDF preview, and download real PDF/DOCX/EPUB files. Six sprints of backend capability (import, rendering, typography, validation, layout) become visible and usable for the first time. No mocks, no hardcoded state, no pre-rendered demo data anywhere in the chain.

A Design Review preceded any code (`docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md`), locking 5 open decisions by explicit CTO direction — full-re-export preview, a stateless backend (every UI action is its own complete round trip), minimal-for-demo scope, a `packages/shared-types` npm workspace, an extensible `GET /api/manuscripts/options` endpoint. Built across 13 implementation commits (Commit 9 split into 9a/9b at CTO direction, ADR-0034) on `feature/sprint-7-first-demonstrable-product`, merged via PR #12. Full retrospective: `docs/releases/v0.8.0-alpha/SPRINT_7_FINAL_REPORT.md`.

## Features

- **`packages/shared-types`** (`backend/`/`frontend/` npm workspace, ADR-0033) — this project's first monorepo-structural change. Transport contracts only (types/interfaces/enums, never Mappers/business logic), eliminating hand-duplicated DTOs between the two apps.
- **`GET /api/manuscripts/options`** — a real, additive, registry-backed endpoint returning the real theme and layout options (`{themes: [...], layouts: [...]}`), shaped so future categories (plugins, templates) are new keys, never breaking changes.
- **`UploadDropzone`** — real drag-and-drop, driving a real state machine (idle → uploading → success/error) via a real `POST /api/manuscripts/import`.
- **`BookStructureView`** — real chapter/section outline, word/page/reading-time stats, from the real imported book.
- **`ValidationSummary`** — real severity-grouped issues (`Critical`/`Warning`/`Information`/`Suggestion`) and category score breakdown, plus a real "N things to improve" summary.
- **`FormatSelector`** — real grouped Standard/Amazon-KDP layout radio-cards and theme cards, populated from the real options endpoint, extensible without a code change as the backend adds more.
- **`PreviewPanel`** — a real on-demand PDF preview (Decision 1: full re-export, not an incremental preview system), embedding the real generated PDF and deriving a real page count from that PDF's own bytes. Real, human-readable format/theme labels shown before generating; staleness on selection change detected and shown, never silently outdated.
- **`ExportPanel`** — three independent real downloads (PDF/DOCX/EPUB), each its own complete round trip against the stateless backend, triggered via a real blob-URL download, not a direct file-URL navigation.
- **`ProgressStepper`** — a real 6-step checklist (Import/Structure/Validation/Layout/Preview/Export) across the whole flow, every checkmark driven by real completed state, not a fixed decorative bar.
- **Tests** — backend test count unchanged at 336 (no backend logic changed after Commit 3's DTO migration); frontend has no automated test suite yet (disclosed below, not hidden).

## Real Bugs Found and Fixed During Implementation

Disclosed, not hidden — continuing this project's now seven-sprint pattern of real interaction and real linting catching what synthetic assumptions did not (full detail in `docs/releases/v0.8.0-alpha/SPRINT_7_FINAL_REPORT.md` §4):

1. **`lib/api-client.ts`'s `importManuscript`** treated any non-2xx response as a hard failure, but `ManuscriptController` returns a real body on both HTTP 200 and 422 (the import pipeline ran either way). Found before it ever shipped to a component.
2. **`FormatSelector`'s `RadioCard`** had a `name` prop destructured but never wired to the underlying `<input>` — caught by ESLint, not manual testing; would have broken native keyboard radio-group navigation.
3. **`PreviewPanel`'s first draft** reset state via `setState` inside a `useEffect`, a cascading-render anti-pattern caught by ESLint's `react-hooks/set-state-in-effect` rule before any browser check ran.
4. **A recurring verification-methodology gap** (not a code defect) — a click on a button below the current viewport fired no request; found and corrected (scroll into view first) at both Commit 9b and again during Commit 10's real-file verification pass, before trusting either result as evidence.
5. **CI itself failed on this branch's first-ever push to origin** — `backend-ci.yml` never built `packages/shared-types` before `backend`, and the committed lockfile had no resolved cross-platform entry for a `vitest`/`rolldown` optional native binding needed only on the Linux CI runner. Both fixed and verified before merge (workflow updated to build `shared-types` first; lockfile regenerated with the missing platform entry confirmed present via `grep` before committing).

## Architecture

- **Design Review before code** (`docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md`), a short CTO-directed Kickoff charter between approval and Commit 1 (`SPRINT_7_KICKOFF.md`), matching the Sprint 6 precedent.
- **Stateless backend held throughout** (Decision 2) — every one of the 8 new frontend components makes its own complete round trip; no session, no server-side manuscript cache, confirmed in every commit's real-network verification.
- **`packages/shared-types` is transport contracts only, permanently** (ADR-0033 addendum) — held without exception for the whole sprint.
- **Commit 9 split into 9a/9b** (ADR-0034 Decision 1) — CTO-directed, for clearer export-pipeline fault isolation between document generation and the download mechanism.
- **A full PDF viewer (page navigation, zoom) and a licensing/monetization architecture were both raised and explicitly deferred** (ADR-0034 Decisions 2-3) — the former needs a new client-side dependency and its own Design Review; the latter conflicts with this sprint's own locked minimal-scope decision.
- **`main` as a production branch** (ADR-0017) held: built entirely on `feature/sprint-7-first-demonstrable-product`, merged via PR #12 — no direct implementation commits to `main` (one legitimate governance-doc commit, the Sprint 7 Kickoff charter, per the existing exception for planning docs).

## Quality Metrics

| Metric | Value |
|---|---|
| Backend tests | 336 passing, 0 failing (unchanged since Sprint 7 Commit 2) |
| Backend global coverage | 92.88% statements |
| Backend domain coverage | 93.76% statements |
| Backend ESLint | 0 errors, 0 warnings |
| Frontend ESLint / TypeScript | 0 errors/warnings, `tsc --noEmit` clean — held across all 13 implementation commits |
| Frontend automated test suite | **none exists** — disclosed as a real gap in `docs/releases/v0.8.0-alpha/SPRINT_7_FINAL_REPORT.md`, tracked in `docs/TODO.md`'s backlog |
| `npm run verify-real-export` | 16/16 (4 canonical fixtures × import + export-docx/pdf/epub), re-run and confirmed green on `main` after merge |
| Full clean rebuild (Sprint 7 Commit 10) | 336/336 backend tests reproduced exactly from a wiped `node_modules`/`.next`/`dist` |
| Manual verification | The official Demo Script (`docs/product/PRODUCT_DEMO.md`) run for real against the real running application, both demo scenarios, 6 real screenshots captured — not just asserted via automated checks |

## Known Issues / Deliberate Simplifications

- No automated frontend test suite exists — every frontend commit was verified via real build/lint/type-check plus manual real-browser interaction, never a repeatable suite.
- A true PDF viewer with page navigation and zoom is not built — the current `<embed>` has no programmatic control; needs a new dependency and its own Design Review.
- Per-layout page estimates are not shown inside the format selector itself — would require one export call per layout before any user choice, contradicting the stateless one-round-trip-per-action architecture. The real page count that does exist (`PreviewPanel`) is for one selection, from one real user action.
- No committed screenshot files exist in `docs/demo/screenshots/` — this environment has no mechanism to persist a captured screenshot to disk; the 6 official captures exist only in the session that produced Commit 12.
- `ManuscriptOptionsDTO` currently returns exactly 1 theme — `FormatSelector`'s Theme section has never been exercised with 2+ real options.

## What This Release Does Not Include

A licensing/monetization-aware architecture (trial/Standard/Pro tiers, feature flags) — raised as a CTO proposal, explicitly deferred pending its own future Design Review (ADR-0034 Decision 3). `Editorial AI Engine`, `Plugin System`, `Publishing Engine` — all mapped at Level 1 (`PLATFORM_ARCHITECTURE_ROADMAP.md`) but no Level 2 design, no code, no Sprint assignment.

## Upgrade / Migration Notes

This release is additive at the API level — no existing backend route's request/response shape changed. `GET /api/manuscripts/options` is new. The frontend (`frontend/`) is entirely new; no prior frontend existed to migrate from. Any consumer of the backend API directly (bypassing the new frontend) is unaffected.

## Links

- Architecture: `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md`
- Sprint charter: `docs/architecture/diagrams/SPRINT_7_KICKOFF.md`
- Sprint retrospective: `docs/releases/v0.8.0-alpha/SPRINT_7_FINAL_REPORT.md`
- Compiled timeline: `docs/releases/v0.8.0-alpha/SPRINT_7_TIMELINE.md`
- Full evidence trail: `docs/demo/VISIBLE_INCREMENTS.md`
- Decisions: `docs/DECISIONS.md` (ADR-0033, ADR-0034)
- Current state (living doc): `docs/CURRENT_STATE.md`
- Pull request: #12 (`feature/sprint-7-first-demonstrable-product` → `main`, merge commit `f17fd65`)
- Previous release: `v0.7.0-alpha` (Professional Layout Engine, `docs/releases/v0.7.0-alpha/ReleaseNotes.md`)
