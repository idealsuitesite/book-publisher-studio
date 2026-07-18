# Sprint 7 Kickoff — First Demonstrable Product

**Status:** ✅ CTO go-ahead granted (2026-07-18), conditional on this document existing first. Branch created immediately after this document is committed.
**Date:** 2026-07-18

This is the charter for Sprint 7. It doesn't repeat the full design — that's `SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md`. This document is what a developer (or a fresh session) should be able to read in two minutes and know exactly what's expected, before opening that. Matches the precedent set by `SPRINT_6_KICKOFF.md` — the CTO asked for this same short step to sit between Design Review approval and Commit 1, rather than going straight from one to the other.

---

## Objective

Turn six sprints of already-built, already-verified backend capability (import, theme/typography/layout, PDF/DOCX/EPUB export, layout selection) into a first demonstrable, end-to-end user experience. This sprint reveals a software that already exists in depth — it does not manufacture one. The interface is a window onto proven engines, not a mask over an unproven backend.

## Out of Scope (explicitly, not by omission)

- Editorial AI Engine
- Plugin System
- Cloud sync / persistence
- Licensing / subscription model
- Collaborative editing
- Live/incremental preview — "preview" this sprint means a full re-export through the existing pipeline (Design Review Decision 1), never a new incremental renderer
- Session persistence — the backend stays fully stateless; every UI action is its own complete `Import → Backend → Result` round trip (Design Review Decision 2)

## Definition of Success

By the end of Sprint 7, a user can:

1. Launch Book Publisher Studio
2. Import a real DOCX manuscript
3. See the book's structure
4. Review its validation findings
5. Choose A4, A5, or a KDP trim size
6. Preview the result
7. Export to PDF
8. Export to DOCX
9. Export to EPUB

## Definition of Failure

Sprint 7 has **not** succeeded if:

- the interface looks polished but does not actually drive the real engines
- exports go through a different pipeline than the one already built, tested, and real-file-verified across Sprints 2-6
- the demonstration does not work end-to-end against `backend/verification/large-book.docx`

---

## New Rule (CTO direction, 2026-07-18): the Visible Increment Rule

From Sprint 7 onward, any commit that touches `frontend/` must leave something a human can actually look at and confirm working — not just "types added, no UI yet." This is a working discipline for demonstrable, incremental progress, layered on top of (not a replacement for) the Design Review's own 12-commit plan (`SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` §6). Illustrative mapping onto that plan:

- Commit 1 → the workspace builds
- Commit 4/5 → the frontend dev server starts and serves a page
- Commit 5 → drag-and-drop actually imports a real DOCX
- Commit 6 → the book's structure renders
- Commit 7 → real validation findings render
- Commit 8 → the format/layout selector is populated and selectable
- Commit 9 → a real embedded PDF preview renders
- Commit 9 → PDF/DOCX/EPUB are real, downloadable files

**Formalized the same day (CTO direction, after Commit 2):** every `frontend/`-touching commit now produces three concrete deliverables, logged in `docs/demo/VISIBLE_INCREMENTS.md` — a real screenshot of the running dev server (never a mockup), a plain-language "what's now usable" description, and an explicit "confirmed real, not simulated" statement showing the real backend request/response behind what's on screen. Full mechanics in `docs/DEVELOPMENT_WORKFLOW.md`'s "Frontend commit visibility" section, which this Kickoff's original rule is now a pointer to rather than a duplicate of. This is distinct from `docs/demo/screenshots/` — the curated, final 6-image Demo Script set produced once at Commit 11, not a per-commit log.

This rule is recorded as a durable workflow rule in `docs/DEVELOPMENT_WORKFLOW.md` (not just this sprint's charter), since the CTO's framing ("from Sprint 7 onward") is project-wide, not scoped to this sprint alone.

---

## Applicable ADRs

- **ADR-0005** — DTOs are immutable and independent of Domain. Unaffected by Decision 4 (`packages/shared-types`) — only *where* a DTO type is declared changes, not the boundary principle itself.
- **ADR-0012** — `Renderer` is a port; rendering pipeline reused as-is. This sprint is additive to Presentation only, consuming Domain/Application exactly as they already work — no new rendering path.
- **ADR-0017** — `main` as a production branch; this Kickoff (like Sprint 6's) is committed directly to `main` as a governance doc, the feature branch is created after.
- **ADR-0022/ADR-0027/ADR-0029** — the additive-field pattern (`blockTypography?`, `pageLayout?`/`tableOfContents?`, `runningHead?`) this sprint's `ManuscriptOptionsDTO` shape (Decision 5) reuses for the first time on an HTTP response instead of a Domain model.
- **ADR-0032** — the Engineering Governance Principle (Code/Product/Documentation, all three required together). This sprint's own Definition of Done (below) is checked against it directly — it is also the ADR this sprint is most at risk of violating in spirit if "the UI looks done" is mistaken for "the UI is done" without a real-fixture pass.
- **ADR-0033** — this project's first monorepo/npm-workspace structural change (Design Review Decision 4), written and implemented in Commit 1, per that Design Review's own instruction to write a dedicated ADR for Commit 1, not just a commit message.

## Reference Documents

- `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` — the full Design Review (read this before implementing any commit). Its 5 locked decisions are now formally indexed (CTO direction, added after Commit 1) — cite them as "Decision 1" through "Decision 5" (see that doc's Decision Index, right after the Status line) instead of re-quoting a paragraph.
- `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` §4a — the proposal this sprint formalizes
- `docs/product/PRODUCT_DEMO.md` — the official Demo Script, the real-file verification pass (Commit 10) runs through this
- `docs/product/PRODUCT_ACCEPTANCE.md` — the non-technical Definition of Done (import/read/understand/change/export)
- `docs/product/FEATURE_MATRIX.md` — what ships this sprint vs. deliberately deferred
- `docs/demo/screenshots/README.md` — the expected screenshot set Commit 11 produces
- `docs/demo/VISIBLE_INCREMENTS.md` — the running per-commit visual log the Visible Increment Rule produces, starting at whichever commit first touches `frontend/`
- `docs/DECISIONS.md` — every ADR listed above
- `docs/DEVELOPMENT_WORKFLOW.md` — branching, commit discipline, the Visible Increment Rule
- `docs/REAL_FIXTURE_POLICY.md` — applies to this sprint's UI too, not just backend renderers

## The Planned Commits

Per `SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` §6, one responsibility each, green build/tests before moving to the next:

1. `chore: convert repo to an npm workspace; scaffold packages/shared-types` — Decision 4's mechanics only, no product feature. Verify `backend/` and `frontend/` both still build/lint/test cleanly under the new structure. Write ADR-0033.
2. `feat(backend): GET /api/manuscripts/options` (Decision 5) — additive, no Domain/Application change.
3. `feat(backend): DTOs re-exported from packages/shared-types` — no behavior change, existing test suite stays green.
4. `feat(frontend): API client typed against packages/shared-types` — `lib/api-client.ts`, no UI yet.
5. `feat(frontend): upload flow` — drag-and-drop, `POST /api/manuscripts/import`, loading/error states.
6. `feat(frontend): book structure view` — render `BookDTO.mainContent`, metadata, word/page/reading-time counters.
7. `feat(frontend): validation summary` — render `ImportReportDTO.issues`/`.score`.
8. `feat(frontend): format/layout selector` — populated from Commit 2's endpoint.
9. `feat(frontend): export + preview` — `POST /api/manuscripts/export`, blob URL, embedded PDF preview, real download for all 3 formats.
10. Real-file verification pass — the CTO's own 6-step goal (`docs/product/PRODUCT_DEMO.md`'s Demo Script), run end to end against `typography-test.docx` and `large-book.docx`, through the actual running UI.
11. Screenshots captured per `docs/demo/screenshots/README.md`'s naming convention.
12. Docs/ADR reconciliation, Sprint 7 Final Report, `docs/VERSIONS.md`'s `v0.8.0-alpha` row renamed to match.

## Definition of "Done"

Sprint 7 is done when, and only when:

- All implementation commits landed, each with its own green build/lint/test before the next started, and each `frontend/`-touching commit satisfied the Visible Increment Rule above (screenshot + description + real-data confirmation logged in `docs/demo/VISIBLE_INCREMENTS.md`)
- `npm run dev` in `frontend/` and `npm run dev` in `backend/` both start cleanly under the workspace structure; the frontend calls the backend successfully across the two processes (CORS confirmed working, not assumed)
- A real DOCX from `backend/verification/` can be dragged in through the actual UI, its structure and real validation warnings are visibly rendered — not swallowed
- Selecting a different layout (e.g. KDP 6×9) and re-previewing shows a visibly different-sized PDF
- All 3 export formats (PDF/DOCX/EPUB) are downloadable from the UI and open without error
- No backend Domain/Application business logic changed — only the additive options route and DTO re-exports
- `docs/QUALITY_GATE.md`'s Code/Product/Documentation levels all pass (ADR-0032)
- `CURRENT_STATE.md`/`TODO.md`/`VERSIONS.md` reconciled, Sprint 7 Final Report written
- PR opened, reviewed, merged — no direct commits to `main` except this Kickoff and the Design Review itself (ADR-0017's governance-doc exception)

## Quality Checklist (run before every commit, not just at the end)

```bash
cd "D:\Book Publisher Studio\backend"
npm run build            # 0 TypeScript errors
npm run lint              # 0 ESLint errors/warnings
npm test                  # all passing, 0 skipped
npm run test:coverage     # Domain >90%, global >80% statements
npm run verify-server         # confirm the real port before any real-export check
npm run verify-real-export    # 16/16, unchanged this sprint (no renderer logic changes)

cd "D:\Book Publisher Studio\frontend"
npm run build              # 0 TypeScript errors, once frontend code exists (Commit 4+)
npm run lint                # 0 ESLint errors/warnings
```

---

## CTO Authorization (2026-07-18)

> The Design Review for Sprint 7 is approved. The scope, architectural decisions, and acceptance criteria are validated. You may create the `feature/sprint-7-first-demonstrable-product` branch and begin Commit 1. Commit 1 must exclusively set up the conversion of the repository to an npm workspace and the `packages/shared-types` package, without introducing any product feature. Validation criteria remain unchanged: Build, Lint, Tests, Coverage, verification of both applications (`frontend` and `backend`) under the new structure before any functional development. No scope expansion is authorized without a new Design Review.

**Scope discipline:** no deviation from the scope above without a new Design Review — the CTO's own condition for the go-ahead, not a suggestion.
