# Mini Design Review — First screen: conditional Home layout (Option D)

**Status:** AWAITING CTO REVIEW — **no code written.** Option D of `HOME_SCREEN_SCOPE.md`, CTO-decided (2026-07-21): a *conditional layout* on library state, **no new routes**, respecting `HOME_WORKSPACE.md` Decision 1 (Home stays the library). This review must lock two sub-decisions before code (§2).
**Date:** 2026-07-21
**Re-verified against current code** (non-negotiable #7): `app/page.tsx`, `UploadDropzone.tsx`, the route tree, and `HOME_WORKSPACE.md` Decision 1, re-read on `main` (`bee13ef`).

---

## 1. What changes, and what does not

The Home (`/`) keeps being the library (Decision 1) and gains **no routes**. It re-weights by library state:
- **Empty library (0 projects):** the upload IS the screen — essentially today's first-run state (title + the full `UploadDropzone` + the honest empty line). Nothing to change here; Decision 1 already fits the empty case perfectly.
- **Non-empty library (≥1 project):** the **library leads** — the project grid comes first — with a **clearly visible import action** that no longer competes for space with the full dropzone form. The passive Statistics/Publications sections stay, demoted below the fold.

The problem this fixes (scope §3A): on a non-empty library, the upload zone and the list currently share the first screen and neither is the obvious "what do you want to do?" gesture. Option D makes the common case (continue a recent book) lead, while keeping import obvious — without paying Option B's cost (two new routes, an extra click to reopen a book) for a problem that only exists in one of the two states.

## 2. The two sub-decisions the CTO asked to lock

### 2.1 The empty ⇄ non-empty threshold
**Recommend: empty = exactly 0 projects; non-empty = ≥ 1.** The page already branches on `projects.length === 0` (the honest empty state) vs `> 0` (the grid), so the boundary already exists in the code and matches the user's mental model ("do I have any books yet?"). No fuzzy middle. (The `projects === null` loading state stays a third, neutral case — neither layout until the fetch resolves, as today.)

### 2.2 How import stays evident when the library leads
**Recommend: a prominent, permanent "Import a manuscript" primary action at the top of the non-empty Home — a real button/affordance, not a discreet link.** Two shapes to pick between (a §2 sub-choice for the CTO):
- **(a) A primary button that opens the file picker directly** (reusing `UploadDropzone`'s existing file-input + import→redirect logic behind a button), so import is one obvious click with the full dropzone out of the way.
- **(b) A compact import affordance that expands the full `UploadDropzone` on click/focus** (progressive disclosure) — keeps drag-and-drop discoverable for those who want it.
Either keeps import a first-class, visible action; the difference is whether drag-and-drop stays one-click-away (b) or click-to-file-picker (a). **Recommend (a)** for the least clutter, with drag-and-drop preserved on the empty-state screen where it is already the focus.

## 3. Measured facts this rests on

- **It is deliberate, not a default:** `HOME_WORKSPACE.md` Decision 1 (CTO round 2, 2026-07-19) — "Home is the project library, import becomes a destination." Option D respects it (Home stays the library); it does **not** reverse it (that would be Option B).
- **Two actions + two passive displays** (`app/page.tsx`): import (`UploadDropzone` → `router.push('/projects/[id]')`), open (`Continue` → `/projects/[id]`), plus Recent publications + Statistics (conditional, passive).
- **No routes are added:** import stays in-page (no `/import`), the library stays on `/` (no `/library`). Only the *arrangement* changes with state — a layout change, not a navigation change.

## 4. The plan (all in `app/page.tsx` + a small import affordance, frontend-only)

- Branch the render on `projects` state: `null` → loading (unchanged); `length === 0` → the upload-led empty screen (essentially today's empty branch, kept); `length > 0` → **library-first**: the project grid at the top, a prominent "Import a manuscript" action above/beside it (§2.2), Statistics/Publications demoted below.
- Reuse `UploadDropzone`'s import logic (file input + `importManuscript` + redirect) behind the chosen affordance — no duplicated import code, no new route.
- The empty-state upload experience (full dropzone, drag-and-drop) is preserved for first-run, where it is the point.

## 5. Verification plan

- **Empty library → upload-led:** with 0 projects, the screen leads with the upload/first-run state, no library grid.
- **Non-empty library → library-led + visible import:** with ≥1 project, the grid renders first and a clearly-labelled "Import a manuscript" action is present and operable (opens the picker / expands the dropzone per §2.2).
- **Import still works from the non-empty state:** the affordance triggers `importManuscript` and redirects to the new project (reusing the existing path).
- **Decision 1 held:** no book content renders on Home; no new route exists (`/` and `/projects/[id]` only).
- **Live:** a real empty library and a real populated one (faith-alone et al.) each render the right layout; import from the populated state redirects.

## 6. Risks

- **Import becomes too hidden** — the whole point of §2.2; the test asserts a visible, operable import action on the non-empty state, and drag-and-drop stays on the empty screen. This is the CTO's named concern.
- **A layout that reads as two different apps** — mitigated: same page, same Home identity (the library), only re-weighted; no route change means no navigation surprise.
- **Scope creep toward Option B** — explicitly out: no new routes, no choice screen; a conditional layout only.

## 7. What the CTO is asked to lock
1. **§2.1** — the threshold is 0 vs ≥1 (recommended).
2. **§2.2** — import affordance shape: (a) primary button → file picker (recommended) vs (b) compact affordance that expands the dropzone.

**No code until these are locked.**

## Implementation note (as-built)

Shipped as one frontend commit, exactly as scoped (both sub-decisions locked: threshold 0 vs ≥1; import = a primary button → file picker, §2.2a). `UploadDropzone` gained a `variant="button"` reusing its file input + import→redirect; `app/page.tsx` branches on state (error/loading neutral first; empty → full dropzone; non-empty → library-first + the import button). Verified live on a 3-project library: the library grid leads, the import affordance is a real `<label>` wrapping the `.docx` file input (opens the picker directly, confirmed by JS, not just a visual capture), and the full dropzone is absent; the empty state is covered by jsdom (dropzone + "No projects yet", no import button). No new routes; Decision 1 held. Console showed only Next dev-server RSC-prefetch errors (server-restart artefacts, not this change). Merged to `main` (`0093bb5`); frontend 181/181, tsc + eslint clean.

## Related
`HOME_SCREEN_SCOPE.md` (the measured scope — Option D chosen, no new routes), `HOME_WORKSPACE.md` Decision 1 (the deliberate Home-is-the-library decision Option D respects rather than reverses), `app/page.tsx` (the four sections re-weighted), `UploadDropzone.tsx` (the import→redirect logic reused behind the new affordance), `FIRST_SCREEN_ERROR.md` (a separate, already-closed first-screen concern — not this layout question).
