# Sprint 7 Timeline — First Demonstrable Product

Compiled from `docs/demo/VISIBLE_INCREMENTS.md` at Sprint 7 closure (Commit 12), per that log's own stated compilation plan. This is the polished, chronological narrative; `docs/demo/VISIBLE_INCREMENTS.md` remains the full, uncompressed evidence trail (every disclosed bug, every tooling incident, every exact real request/response) and is not superseded by this document.

## Before Commit 1

Design Review round 2 approved (`docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md`), 5 open decisions locked by explicit CTO direction: full-re-export preview, a stateless backend, minimal-for-demo scope, a `packages/shared-types` npm workspace, an extensible `GET /api/manuscripts/options` endpoint. A Kickoff charter followed (`SPRINT_7_KICKOFF.md`), introducing the Visible Increment Rule this log satisfies. CTO go-ahead granted 2026-07-18; branch created.

## Commits 1-3 — Foundation (no visible UI yet)

- **Commit 1:** the repository became a real npm workspace; `packages/shared-types` scaffolded empty (ADR-0033).
- **Commit 2:** `GET /api/manuscripts/options` shipped — a real tension between "no duplicated business logic" and "no Domain/Application changes" was flagged and resolved by the CTO (additive, read-only registry exports).
- **Commit 3:** all 9 pre-existing backend DTOs moved into `packages/shared-types` as thin re-export shims. `packages/shared-types` formalized as transport-contracts-only, permanently (ADR-0033 addendum).

## Commit 4 — The First Screen

`<h1>Book Publisher Studio</h1>` and a static drop zone, real for the first time. The CTO redefined this commit's scope mid-flight to ship the actual first screen rather than a headless API client. `docs/demo/screenshots/` naming collision found and reconciled (per-commit artifacts live in this log instead). The Turbopack `global-error.js` console-noise watch-point was first observed and logged here — tracked, not worked around, until Sprint 7 closure.

## Commit 5 — The Page Becomes Alive

Drag-and-drop now calls the real `POST /api/manuscripts/import`. A real bug (`lib/api-client.ts` treating HTTP 422 as a hard failure, when `ManuscriptController` returns a real body on both 200 and 422) was found and fixed before it ever shipped.

## Commit 6 — Real Book Structure

`BookStructureView` renders the real imported book — title, author, word/page/reading-time stats, chapter/section outline. A Browser-pane incident (a `.docx` navigated to directly triggered what was likely an undismissable native download prompt, dropping both dev servers) was recovered mid-verification: servers restarted, reachability reconfirmed via `curl`, verification completed.

## Commit 7 — Real Validation Findings

`ValidationSummary` renders the real `ImportReportDTO.score`/`.issues`, severity-grouped. The CTO raised a licensing/monetization-aware architecture proposal (trial/Standard/Pro tiers, feature flags) alongside this commit — flagged as conflicting with the Design Review's own minimal-scope decision and the project's existing licensing-deferral backlog entry, recommended as its own future Design Review, not implemented (ADR-0034 Decision 3).

## Commit 8 — Real Format/Layout Selector

`FormatSelector` renders the real 6 layouts (grouped Standard/KDP, per CTO design direction) and real themes as radio-cards. A live per-layout page estimate was requested but explicitly not built — it would need one export call per layout before any user choice, contradicting the stateless one-round-trip-per-action architecture. A lint-caught bug (`name` prop never wired to the radio `<input>`) was fixed before verification.

## Commit 9 (split into 9a/9b) — Preview and Export

The CTO redirected the originally-planned single Commit 9 into two independently verified sub-steps, so an export-pipeline problem's root cause (generation vs. download) would be immediately identifiable (ADR-0034 Decision 1).

- **9a — PDF preview:** `PreviewPanel` fires a real export on demand, embeds the real PDF, derives a real page count from the PDF's own bytes. A lint-caught React anti-pattern (`set-state-in-effect`) was redesigned around derived render-time staleness. A more severe recurrence of the Turbopack watch-point required a `.next` cache clear to resolve — the first time a plain retry wasn't enough.
- **9b — export/download:** `ExportPanel` offers 3 independent real downloads via a synthetic `<a download>` click on a blob URL, deliberately avoiding the file-navigation pattern that caused Commit 6's incident. A verification-methodology bug (a click landing below the viewport, firing nothing) was found and fixed. **Sprint 7's core user journey became real, end to end, in one session.**

## Commit 10 — Sprint Review Technique

Redefined by the CTO from a routine verification pass into 7 concrete checks answering one question: is Sprint 7 actually finishable? No code changed.

1-2. Existing `verify-server`/`verify-real-export` tooling: **16/16 real checks**, every output file independently `file`-validated.
3-4. All 6 real layouts exported and geometrically compared — dimensionally exact, physically coherent page counts.
5. Cold restart + full journey on a different fixture (`large-book.docx`) — a real bug found and fixed mid-verification; the UI-driven and direct-API export paths proven to be the same code via byte-identical output.
6. A real large-document stress test using a disclosed, narrow exception to the "never search `backend/uploads/`" rule (ADR-0034 Decision 4) — honest gap disclosed: 134 pages is the largest real document available, not the requested 400-500.
7. A full clean rebuild from wiped `node_modules`/`.next`/`dist` — 336/336 tests reproduced exactly. **Closes the Turbopack watch-point tracked since Commit 4.**

## Commit 11 — Polish UI

Implements the CTO's UI feedback from the Commit 10 session: a real `ProgressStepper` (6 steps, every checkmark real derived state), a redesigned `PreviewPanel` (real format/theme labels before generating, real page count only after), and softened `ValidationSummary` severity labels. A true PDF viewer with page navigation/zoom remains explicitly deferred — needs a new dependency and its own Design Review (ADR-0034 Decision 2). A stale-HMR-cache bug (same class as 9a's) was found and resolved identically.

## Commit 12 — Closure

The official Demo Script (`docs/product/PRODUCT_DEMO.md`) run end to end against the real running application: `large-book.docx` primary scenario (home → import → layout change → preview → export) plus `typography-test.docx` secondary scenario (validation findings). Six real screenshots captured in-conversation — no committed PNG files, matching the standing decision on this environment's screenshot-persistence limitation (first disclosed Commit 4). ADR-0034 written, consolidating four Sprint 7 governance decisions. This document and `SPRINT_7_FINAL_REPORT.md` close the sprint's documentation.

## Recurring Threads

- **The Turbopack `global-error.js` watch-point** — logged Commit 4, recurred with increasing severity through Commits 8, 9a, 11, closed clean at Commit 10's full rebuild. Working remedy identified: a `.next` cache clear, not just a retry.
- **The Browser pane's screenshot-persistence limitation** — no mechanism exists in this environment to write a captured screenshot to disk. Disclosed at Commit 4, held as a standing CTO-accepted decision (in-conversation proof is sufficient) through to Commit 12's official capture set.
- **Real bugs found via real interaction, not synthetic tests** — Commit 5 (422-handling), Commit 8 (radio `name` prop), Commit 9a (`set-state-in-effect`), Commit 9b/10 (viewport-click verification gaps) — every one caught before or during real-file/real-browser verification, matching this project's six-sprint-long pattern (ADR-0019/0020/0026/0031) of real-file verification catching what synthetic fixtures structurally cannot.

## Related

- `docs/demo/VISIBLE_INCREMENTS.md` — the full, uncompressed evidence trail this document compiles
- `docs/releases/v0.8.0-alpha/SPRINT_7_FINAL_REPORT.md` — objectives, ADRs, metrics, deferred items, lessons learned
- `docs/DECISIONS.md` (ADR-0033, ADR-0034) — the two Sprint 7 ADRs
- `docs/product/PRODUCT_DEMO.md` — the Demo Script Commit 12's screenshots follow
