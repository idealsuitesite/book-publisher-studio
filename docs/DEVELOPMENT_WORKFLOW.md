# Development Workflow

Day-to-day operational rules for working in this repository — distinct from `docs/DESIGN_REVIEW_PROCESS.md` (what happens before code) and `docs/RELEASE_CHECKLIST.md` (what happens after a sprint's PR merges).

## Branching

- All implementation work happens on a `feature/<name>` branch, never directly on `main` (ADR-0017). Naming convention: `feature/sprint-N-<engine-name>` for sprint work, `fix/<short-description>` for standalone bug fixes, `chore/<short-description>` for tooling/governance.
- Governance/planning docs (a Design Review, a Kickoff charter, a cross-cutting policy doc like this one) may be committed directly to `main` — they aren't "implementation" in ADR-0017's sense. Precedent: Sprint 5's Design Review/Kickoff docs (`599e297`), this project's various post-Sprint governance passes.
- Branch from `main` at its current tip, never from another feature branch.

## Commit discipline

- Small, atomic commits, one responsibility each — matches every sprint's own commit plan in its Design Review.
- Conventional Commit prefixes, established pattern in this repo: `feat(...)`, `fix(...)`, `docs(...)`, `chore(...)`, `refactor(...)`, `domain(...)`/`infra(...)`/`application(...)` for layer-specific Domain/Infrastructure/Application changes.
- Every commit must clear `docs/QUALITY_GATE.md`'s Level 1 gate (build, lint, tests) before the next commit starts — never stack unverified commits.
- A real bug found mid-implementation gets its own commit and, if it represents a real architectural lesson, its own ADR — not silently folded into an unrelated commit's diff.

## Frontend commit visibility — the "Visible Increment Rule" (from Sprint 7 onward)

- Every commit that touches `frontend/` must leave something a human can actually look at and confirm working — a running dev server, a rendered page, a working interaction, a real download. "Types added, no UI yet" is not a frontend commit's stopping point on its own; pair it with the next commit that makes it visible, or fold it into that commit.
- CTO direction, 2026-07-18 (`docs/architecture/diagrams/SPRINT_7_KICKOFF.md`): the backend's existing discipline (green build/lint/test per commit) proves correctness; this rule proves the same increments are also demonstrable, not just compilable — the whole point of a "First Demonstrable Product" sprint.
- **Formalized the same day (CTO direction): three concrete deliverables per frontend commit, logged in `docs/demo/VISIBLE_INCREMENTS.md`** (distinct from `docs/demo/screenshots/`, the separate curated final Demo Script capture set produced once at sprint close):
  1. **A real screenshot** of the running `frontend/` at that commit — captured against the actual dev server in a browser (this project's Browser tooling: `preview_start`/`navigate`/`computer` screenshot), never a mockup or a design tool export. Saved to `docs/demo/visible-increments/commit-NN-<slug>.png`.
  2. **A short "what's now usable" description** — plain language, what a person could actually do by hand at this commit, not an implementation summary.
  3. **A "confirmed real, not simulated" statement** — explicit evidence the screenshot reflects the real backend, not mocked/hardcoded frontend state: the real HTTP request/response inspected via the Browser pane's network tools, or the real fixture file used, quoted directly.
- **Scope extended the same day (CTO direction, after Commit 3), Sprint 7 only:** `docs/demo/VISIBLE_INCREMENTS.md` now logs every implementation commit from Commit 3 onward, not just `frontend/`-touching ones. A backend/tooling commit with no UI yet gets a small conceptual diagram (SVG, two or three labeled boxes + an arrow, e.g. "Workspace → Shared DTOs") instead of a screenshot, plus the same "what's now true" description and "confirmed real" evidence. The screenshot requirement above for `frontend/` commits is unchanged and still the project-wide rule below; the diagram-for-every-commit extension is this sprint's own flavor of making the whole build visible, not a permanent requirement for every future sprint's backend work.
- Applies going forward, not just to Sprint 7 — a later sprint that adds frontend work should keep the screenshot bar, including the three-part log.

## After every task

- [ ] Run `npm run build` (backend) — 0 TypeScript errors
- [ ] Run `npm run lint` — 0 errors
- [ ] Run `npm test` — all passing
- [ ] Update `docs/CURRENT_STATE.md` if the task changes what's true about the project's current state
- [ ] Update `docs/TODO.md` if the task completes, adds, or changes a tracked item
- [ ] Commit with a clear, Conventional-Commit-style message
- [ ] Push (to a feature branch, or to `main` only for the governance-doc exception above)

## Server verification (never assume the port)

Before any real export/import verification against a running server:

1. Read the server's own startup output (`npm run dev` prints `Server running on http://localhost:PORT`) — never assume a value, never hardcode `localhost:3000` (nothing in this project listens there; `src/index.ts` reads `PORT` from the environment, default `5000`).
2. Verify `GET /api/health` returns HTTP 200 on that exact port.
3. Use that verified port for every request in the session.

`npm run verify-server` automates steps 1-3 (plus confirming the export route is registered and the canonical fixture exists) and exits non-zero on the specific check that failed. Run it before any real-file verification pass instead of assuming the server is reachable. This exists because a real-export check was once reported against the wrong port, never actually checked against the server's own startup log (2026-07-17 incident, `docs/CLAUDE.md`'s original "Server Verification Policy").

## Which fixture to use

Always `backend/verification/typography-test.docx` for a real export verification, unless the change specifically concerns pagination/performance (`large-book.docx`), images (`images.docx`), or tables (`tables.docx`) — see `backend/verification/README.md` and `docs/REAL_FIXTURE_POLICY.md` for the full policy this selection serves.

- Never search `backend/uploads/` for a DOCX to use.
- Never generate a temporary DOCX for verification.
- If the expected fixture file is missing, **stop and ask** — do not substitute or regenerate it silently.

## Testing

- Unit tests for Domain (pure functions, no I/O)
- Integration tests for Application (Use Case orchestration)
- E2E tests for Presentation (HTTP)
- Minimum coverage: Domain >90%, global >80% (ADR-0006) — `npm run test:coverage`
- See `docs/TESTING_STRATEGY.md` for the functional-vs-rendering and structural(L1)-vs-rendering(L2) test taxonomies once a suite grows large enough to need them for triage.

## Related

- `docs/DESIGN_REVIEW_PROCESS.md` — what happens before this workflow starts (Design Review, approval gate)
- `docs/RELEASE_CHECKLIST.md` — what happens after a sprint's implementation work is merged
- `docs/QUALITY_GATE.md` — the per-commit checklist this workflow exists to satisfy
- `docs/REAL_FIXTURE_POLICY.md` — the policy behind "which fixture to use" and when real-file verification is mandatory
- `docs/demo/VISIBLE_INCREMENTS.md` — the running evidence log the Visible Increment Rule above produces, one entry per `frontend/`-touching commit
- `docs/DEVELOPER_HANDBOOK.md` — naming conventions, file structure, layer rules
- ADR-0017 (`main` as a production branch)
