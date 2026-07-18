# Visible Increments — Sprint 7 Commit-by-Commit Log

**Purpose (CTO direction, 2026-07-18 — the "Visible Increment Rule"):** a running visual timeline of Sprint 7, so the sprint leaves both a clean Git history and a chronology of Book Publisher Studio actually coming into existence. This is distinct from `docs/demo/screenshots/`, which is the curated, final 6-image Demo Script capture set produced once at Commit 11 — this log is incremental, produced at every commit along the way, and never retroactively cleaned up or replaced.

**Scope extended (CTO direction, 2026-07-18, after Commit 3):** originally scoped to `frontend/`-touching commits only. Now covers every implementation commit from Commit 3 onward, with two artifact types depending on what the commit actually changed:

- **Backend/tooling commits** (no UI yet to screenshot) — a small conceptual diagram (SVG, two or three labeled boxes + arrows) showing the architectural step in one glance, e.g. "Workspace → Shared DTOs."
- **`frontend/`-touching commits** — a real screenshot of the running dev server, per the original rule (see below) — never a mockup.

Both get the same accompanying **"what's now true/usable"** description and **"confirmed real, not simulated"** statement.

## What each entry contains

Per commit, appended below (never edited retroactively — this is a timeline, not a status page):

1. **Artifact** — a real diagram (backend/tooling commit) or a real screenshot of the running `frontend/` (UI commit), stored in `docs/demo/visible-increments/commit-NN-<slug>.{svg,png}`, embedded inline.
2. **What's now true/usable** — 1-3 sentences, plain language, describing the concrete new capability or architectural state a person could verify by hand (not "types added" — see `docs/DEVELOPMENT_WORKFLOW.md`'s Visible Increment Rule, which this log is the evidence trail for).
3. **Confirmed real, not simulated** — explicit evidence, not an assertion: the real HTTP request/response observed (curled directly or via the Browser pane's network inspector), the real fixture file used, or the real test/build output — quoted directly.

## Entries

### Commit 3 — `feat(backend): DTOs re-exported from packages/shared-types`

![Workspace to Shared DTOs](visible-increments/commit-03-shared-dtos.svg)

**What's now true:** the 9 pre-existing backend DTOs (`BookDTO`, `ChapterDTO`, `SectionDTO`, `BlockDTO` + its 8 block-variant types, `InlineDTO`, `MetadataDTO`, `ImportReportDTO`, `ImportResponseDTO`, `ValidationIssueDTO`, `QualityScoreDTO`) now live in `packages/shared-types` as their single canonical source, alongside `ManuscriptOptionsDTO` from Commit 2. `backend/src/application/dto/*.ts` are now thin re-export shims — every existing import in the codebase (`BlockMapper`, `BookMapper`, `ChapterMapper`, `SectionMapper`, `ImportManuscriptUseCase`) keeps working unmodified. `packages/shared-types` is now genuinely ready for `frontend/` to depend on (Commit 4).

**Confirmed real, not simulated:**
- `backend/` build (0 TypeScript errors), lint (0 errors/warnings), tests (336/336, identical count to before the move), coverage (92.88% global / 93.76% domain — byte-identical to pre-move, confirming zero behavior change) — all re-run after the move, not assumed unchanged.
- A real DOCX (`backend/verification/typography-test.docx`) POSTed to a real running dev server on a scratch port returned the exact same `BookDTO`/`ImportReportDTO` JSON shape as before the migration: `{"book":{"id":"book-1","metadata":{"title":"typography-test.docx",...},"mainContent":[{"type":"chapter",...`
- `frontend/` and `shared-types` build/lint re-verified clean (no dependency graph changed this commit — `package-lock.json` untouched, confirmed via `git status`).

## Related

- `docs/DEVELOPMENT_WORKFLOW.md` — the durable Visible Increment Rule this log exists to satisfy
- `docs/architecture/diagrams/SPRINT_7_KICKOFF.md` — the commit plan this log tracks against
- `docs/demo/screenshots/` — the separate, curated, final Demo Script capture set (Commit 11 only)
- `docs/DECISIONS.md` ADR-0033 addendum — the DTO-only scope rule this commit's move complies with
