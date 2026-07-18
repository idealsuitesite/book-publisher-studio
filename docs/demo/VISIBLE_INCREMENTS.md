# Visible Increments — Sprint 7 Commit-by-Commit Log

**Purpose (CTO direction, 2026-07-18 — the "Visible Increment Rule"):** a running visual timeline of Sprint 7, one entry per commit that touches `frontend/`, so the sprint leaves both a clean Git history and a chronology of Book Publisher Studio's interface actually coming into existence. This is distinct from `docs/demo/screenshots/`, which is the curated, final 6-image Demo Script capture set produced once at Commit 11 — this log is incremental, produced at every frontend commit along the way, and never retroactively cleaned up or replaced.

**No entries yet** — Sprint 7 commits 1-2 were backend/tooling only (`packages/shared-types` scaffold, `GET /api/manuscripts/options`); nothing in `frontend/` has changed yet beyond the untouched `create-next-app` default. The first entry lands at whichever commit first touches `frontend/` (Commit 4 or 5 per `docs/architecture/diagrams/SPRINT_7_KICKOFF.md`'s commit plan).

## What each entry contains

Per commit, appended below (never edited retroactively — this is a timeline, not a status page):

1. **Screenshot** — a real capture of the running `frontend/` at that commit, taken against the actual dev server in a browser, embedded inline (`![](visible-increments/commit-NN-<slug>.png)`), file stored in `docs/demo/visible-increments/`.
2. **What's now usable** — 1-3 sentences, plain language, describing the concrete new capability a person could exercise by hand (not "types added" — see `docs/DEVELOPMENT_WORKFLOW.md`'s frontend commit-visibility rule, which this log is the evidence trail for).
3. **Confirmed real, not simulated** — an explicit statement of how it was verified that the screenshot reflects the real backend, not mocked/hardcoded data: the real HTTP request/response observed (via the Browser pane's network inspector) or the real fixture file used, quoted directly, not just asserted.

## Entries

_(none yet — see above)_

## Related

- `docs/DEVELOPMENT_WORKFLOW.md` — the durable "Visible Increment Rule" this log exists to satisfy
- `docs/architecture/diagrams/SPRINT_7_KICKOFF.md` — the commit plan this log tracks against
- `docs/demo/screenshots/` — the separate, curated, final Demo Script capture set (Commit 11 only)
