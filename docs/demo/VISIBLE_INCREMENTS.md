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

### Commit 4 — `feat(frontend): home screen + API client` (the first real UI)

**Screenshot: not yet committed as a file — disclosed limitation, not skipped silently.** The real screen was rendered against a real `next dev` server (via this project's Browser tooling) and visually confirmed correct — see the exact capture inline in the session transcript that produced this entry. No tool available in that session could write the captured image to a file on disk for `git add`. Rather than fabricate a file or silently drop the requirement, this is recorded as an open item: either capture the screenshot manually from the terminal/session and add it as `docs/demo/visible-increments/commit-04-home.png`, or add a small real screenshot-capture script (e.g. Playwright) as its own scoped, disclosed piece of tooling in a later commit. Placeholder path reserved: `visible-increments/commit-04-home.png`.

**What's now true:** Book Publisher Studio has a real first screen. `frontend/app/page.tsx` renders an `<h1>Book Publisher Studio</h1>` (also the browser tab title, `frontend/app/layout.tsx`) and a `UploadDropzone` component with visual drag-over state and the text "Drop your DOCX here". Deliberately static — no `POST /api/manuscripts/import` call yet, by design (Commit 5's job, matching the Kickoff's home-screen/upload-flow split). `frontend/lib/api-client.ts` is a new typed fetch wrapper against `packages/shared-types` (`importManuscript`, `getManuscriptOptions`, `exportManuscript`) — written but not yet called from any component.

**Confirmed real, not simulated:**
- `frontend/` build (0 TypeScript errors), lint (0 errors/warnings), both re-run after every file change.
- A real `next dev` server was started via this project's Browser tooling (not a static export or a design mockup); `get_page_text` against the live page returned exactly: `Book Publisher Studio` / `Drop your DOCX here` / `.docx manuscripts only`; the browser tab title read `Book Publisher Studio` — both driven by real component/metadata code, not a screenshot of source.
- Backend availability was confirmed separately and for real: `curl http://localhost:5000/api/manuscripts/options` returned the real 6-layout/1-theme response (same backend the running frontend is configured to call, `NEXT_PUBLIC_API_BASE_URL` defaulting to `http://localhost:5000`) — the wiring exists and is reachable, even though this specific screen doesn't call it yet.
- **Disclosed, non-blocking observation:** the Next.js 16 Turbopack dev server logged repeated `Could not find the module ".../global-error.js#default" in the React Client Manifest` errors to its own console during this session, alongside one `Manifest file is empty` error on the very first request. The page itself rendered correctly and consistently across multiple checks (screenshot, `get_page_text`, tab title) — a known-looking Turbopack dev-mode console quirk, not a defect in this commit's code, but flagged rather than silently ignored per this project's own disclosure discipline. Worth re-checking if it recurs once real interactivity (Commit 5) is added.

## Related

- `docs/DEVELOPMENT_WORKFLOW.md` — the durable Visible Increment Rule this log exists to satisfy
- `docs/architecture/diagrams/SPRINT_7_KICKOFF.md` — the commit plan this log tracks against
- `docs/demo/screenshots/` — the separate, curated, final Demo Script capture set (Commit 11 only) — deliberately a different directory and naming convention than this log's `commit-NN-<slug>` files, so the two never collide
- `docs/DECISIONS.md` ADR-0033 addendum — the DTO-only scope rule Commit 3's move complies with, and that `frontend/lib/api-client.ts` (Commit 4) now also depends on
