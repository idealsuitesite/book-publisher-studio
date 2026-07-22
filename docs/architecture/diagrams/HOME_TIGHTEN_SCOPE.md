# Home tightening (wording + "Continue" focus) — Scope Report, not a Design Review

**Status:** SCOPE REPORT for CTO decision. **No production code written.**
**Date:** 2026-07-21, grounded in the code on `main` at `2029398` (the real `app/page.tsx`, the repository's real ordering) and the real library state after the fixture cleanup — measured, not assumed.
**Brief (CTO):** two adjustments to the already-shipped Option-D Home — (A) a welcome line that states the product's promise (manuscript → professional book) without turning into a generic marketing slogan; (B) "Continue" tightened to the LAST project rather than the whole grid — the library still visible, less dominant, same screen, no new route.
**Explicitly OUT of scope (CTO, restated so it cannot creep in):** no "new book"/templates (the product imports an existing manuscript, it does not create from scratch); no "Discover"/tutorials/news section; no new route or navigation section (Documents/Favourites/Trash). Any of those returning is a separate, explicit product decision — never a silent addition here.

---

## 0. The measured facts the design must sit on

1. **The list is already recency-ordered, server-side.** `SqliteProjectRepository.listSummaries` returns `ORDER BY updated_at DESC` (`SqliteProjectRepository.ts:114`), and `ProjectSummaryDTO` already carries `updatedAt`. **So `projects[0]` IS the last-worked-on project, today, with zero backend change.** Point B is purely a presentation re-weighting.
2. **What `updatedAt` actually means (read, not assumed):** it bumps on every *write* — edit, snapshot, settings change, rename (`ProjectService`, measured during the pagination-reuse chantier) — and **not** on a read-only open (GET writes nothing, ADR-0027 discipline). So the hero is "the book you last *worked on*", not "last opened". For an author these coincide almost always; the divergence case (opened yesterday to *look*, edited another book after) is minor and disclosed in §2's options rather than silently ignored.
3. **The real library is small.** After the fixture cleanup (18 session fixtures deleted — two `verify-real-export` harness runs, four `verify-real-import` corpus imports, five faith-alone live-check duplicates; DB 36.7 MB → 32 KB), the library holds **0 projects**, and the realistic author profile this product serves holds **1–3 books** (every live verification this session worked one book at a time; resume-where-left already assumes one active project). **Consequence, stated honestly: the tightening's value at this scale is *clarity of the next action*, not taming a large grid** — the hero answers "what do I do now?" in one glance; it does not solve a scale problem we do not have.
4. **The current wording (verbatim, `app/page.tsx`):** empty state — h1 "Your studio" + "Bring in a manuscript to start your first project."; non-empty — h1 "Your studio" + "Continue where you left off, or import a new manuscript." The product's promise (manuscript in → professional, publishable book out) appears **nowhere on the first screen**.
5. **The standing decisions this must not disturb:** HOME_WORKSPACE Decision 1 (Home IS the library; import is a destination) and MINI_DR_HOME_STATE_LAYOUT Option D (empty → upload is the screen; non-empty → library leads with a primary import button). Point B re-weights **within** the non-empty branch; neither decision is reopened.

---

## 1. Point A — the welcome line (proposal, one recommendation)

The promise belongs **where first contact happens** — the empty/first-run screen — and the task belongs where the returning author lands. Splitting them keeps the pitch off the daily screen (the anti-slogan safeguard: a returning author reads their next action, not the product's mission).

- **Empty state (first contact — carries the promise):**
  - h1: **"Your studio"** (kept — it is the product's identity, and changing it everywhere is not what A asks)
  - subtitle: **"Import your manuscript — leave with a professional, publish-ready book."**
  - (dropzone unchanged; the honest empty line below unchanged.)
- **Non-empty state (the returning author — task-first, promise quietly present):**
  - subtitle: **"Pick up your book where you left it, or import a new manuscript."**
  - ("your book" rather than "where you left off" — it names the object of the promise without pitching.)

Alternative if the CTO wants the promise on BOTH states: append "— from manuscript to finished book." to the returning subtitle. Not recommended: it reads as decoration by the third visit.

## 2. Point B — "Continue" tightened to the last project (options)

- **Option B1 — a hero "Continue" card + the compact grid below (RECOMMENDED).** `projects[0]` (already the most recent) renders as one **wide, primary card** at the top of the library section: project name, book title · author, version count, a humanised recency line ("worked on today / 3 days ago" — from the `updatedAt` the DTO already carries), and **Continue as the visually primary action of the screen**. The remaining projects keep exactly today's grid, under a quieter heading ("All projects"); with **one** project the hero IS the library and the grid section simply doesn't render (no duplicate card). No new route, no new endpoint, no backend change; the library stays fully visible, just no longer competing with the one action a returning author takes. Cost: one frontend component + jsdom tests.
- **Option B2 — emphasis-only (first grid card enlarged/accented).** Smallest possible change, but the screen still reads as "a grid" rather than "your book, continue" — it tightens little for nearly the same code. Not recommended.
- **Option B3 — hero + the rest of the library folded behind a disclosure ("All projects (N)").** The strongest tightening, but it *hides* the library by default, which leans against HOME_WORKSPACE Decision 1's "Home is the library". Not recommended without an explicit CTO call to soften Decision 1's reading.
- **The `updatedAt` nuance (§0.2), same for all options:** "last worked on" is the hero. If the CTO ever wants true "last *opened*", that is a new signal (client-side recency in localStorage, or a write-on-open the read path deliberately refuses today) — its own small decision, deferred, not smuggled in.

## 3. What this report asserts, and stops at

The backend already provides everything Point B needs (§0.1); both points are frontend-only, inside the existing Option-D branches, and neither reopens Decision 1 or Option D (§0.5). The honest value at the product's real scale is next-action clarity, not grid-taming (§0.3). Recommendation: **A as proposed (promise at first contact, task on return) + B1**, one small frontend chantier, jsdom-tested, live-verified on a 2–3-project library. The decision is the CTO's; no code before it.

---

## Implementation note (added at build time — A + B1 as CTO-approved; this records what the build settled)

Built on `feature/home-tighten`, two commits, frontend-only, gate green at each (frontend 188 → **196**, tsc + eslint clean; backend untouched).

- **Commit 1 (`d30dd0a`) — Point A.** The two subtitles as proposed, split intact (promise at first contact, task on return); jsdom asserts both states **and that the pitch is absent on the returning screen** (the anti-wallpaper property, tested not hoped).
- **Commit 2 (`e840c7e`) — Point B1.** The hero card (recency line via `lib/recency.ts` — "Worked on…" wording matching the §0.2 honesty; name; book · author; versions; **Continue → in the import button's own visual language** so the screen has one consistent primary grammar); the rest of the library under "All projects" in the unchanged compact grid; **the single-project case renders no grid and no duplicate** (jsdom-pinned). `recencyLabel` unit-tested incl. the calendar-boundary "yesterday" (a date boundary, not a 24h window) and the unparseable-stamp guard.
- **Verified LIVE across the full arc on a real library (post-cleanup, no fixtures):** empty state shows the promise + dropzone-as-screen; **1 real book** (faith-alone) → the hero IS the library, no "All projects", no duplicate; **3 real books** (+ art-of-captivating, pm-notes) → hero = last imported, the other two in the grid, stats "3 books"; **then an edit on the *oldest* project (a rename in faith-alone) flipped the hero to it on reload** — "last worked on" proven end to end, not assumed from the sort order; zero console errors; screenshot captured.
- The three imported corpus manuscripts are **left in place deliberately** as a realistic 3-book demo library (they are real manuscripts, not harness fixtures) — the CTO may keep or clear them.

**Status: MERGED to `main` (`a60eb02`, no-ff, 2026-07-22).** Gate re-verified post-merge — and that re-run earned its keep: it caught a **real test defect** the pre-merge run had masked (`0a0332d`): the recency fixtures used Z-suffixed ISO strings while `recencyLabel` computes in *local* calendar days, so on this UTC+1 host the "yesterday" input crossed the midnight boundary into "today". Fixtures rebuilt from local components — deterministic in every timezone, matching what the function actually computes; no production code changed. Final: backend 709/709, frontend **196/196**, tsc + eslint clean. The CTO kept the 3-manuscript demo library (real manuscripts, not harness fixtures).

## Appendix — fixture cleanup (point 2 of the same directive, executed, environment-only)

18 projects deleted from `backend/data/studio.db` (direct SQL, dev-environment cleanup, no production code): 2× the `verify-real-export` harness quartet (images/large-book/tables/typography-test, runs of 21:44 and 23:29), 4× the `verify-real-import` corpus imports (faith-alone, pm-notes, generated-unstyled, art-of-captivating, 23:29), 5× faith-alone live-check duplicates (incl. the v3 Part-level verification project), 1× generated-unstyled (13:46). All created 2026-07-21 by this session's harnesses/verifications; none a real author book (CTO's own qualification). `versions` (6) and `blobs` (18) rows removed with them; `VACUUM` shrank the DB **36.7 MB → 32 KB**. The library is now genuinely empty — the Option-D first-run screen is what a capture shows next. **Note for future sessions: every `verify-real-export`/`verify-real-import` run repopulates four-to-eight fixture projects** — this pollution is structural to the harnesses (they import through the real route); if it becomes a recurring nuisance, a `DATABASE_PATH=:memory:`-style harness isolation is its own tiny report, not done here.
