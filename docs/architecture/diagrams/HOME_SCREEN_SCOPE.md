# First Screen — Combined Upload + Library vs a Choice-First Home — Scope Report (measured, no code)

**Status:** 📋 SCOPE REPORT — read-only, measured on `main` (`84c1bc8`). No production code opened (the `GUTTER_SCOPE.md` format).
**Date:** 2026-07-21.
**The constant that motivated it (CTO):** the first screen combines the upload zone and the list of already-imported books (with their stats) on one screen with several sections, rather than distinct pages.
**Instrument:** reading `app/page.tsx` (the `/` route), `UploadDropzone.tsx`, the route tree, and `HOME_WORKSPACE.md`.

---

## §0 — The measured answer: it is a CONSCIOUS, documented decision — not a default

The current Home is not an accident of the framework — it is **`HOME_WORKSPACE.md` Decision 1, CTO-approved in round 2 (2026-07-19)**: *"The Home is the project library, and the import flow becomes a destination, not the identity."* Its §0 fixes the split the CTO themself named — *"Home et Workspace : deux contextes complètement différents"*:

| | **Home** (`/`) answers | **Workspace** (`/projects/[id]`) answers |
|---|---|---|
| Object | the **library** (many projects) | **one book** |

So the combined-on-one-screen shape is the *deliberate* answer to "Home is the library." **A choice-first Home would revisit a prior CTO decision** — worth stating up front so the direction is a conscious reversal, not a discovery.

## §1 — What the one screen combines today (`app/page.tsx`, measured)

Four stacked sections on `/`, all sourced from `GET /api/projects` (never any book's content — that is Workspace's job):

| # | section | what it does | is it a distinct ACTION? |
|---|---|---|---|
| 1 | **"Your studio" + `UploadDropzone`** | drop/select a DOCX → import → **redirect** to the new project | **yes — import** |
| 2 | **"Recent projects"** | a grid of project cards, each with a **"Continue"** link to `/projects/[id]` | **yes — open an existing book** |
| 3 | **"Recent publications"** | a read-only list (shown only if any) | no — passive |
| 4 | **"Statistics"** | books / versions / targets counts (shown only if any) | no — passive |

**Two distinct actions** — *import a new manuscript* and *open an existing book* — plus two passive, conditional display sections. The two passive sections vanish on an empty library (first run), so a new user sees only upload + an honest empty state.

## §2 — The routes and the real cost of a choice-first Home

**Routes today (measured):** `/` (Home, this page) and `/projects/[id]` (Workspace). Import is **in-page**: `UploadDropzone` calls `importManuscript` then `router.push('/projects/[id]')` — no dedicated import route exists; the upload lives on Home by Decision 1.

**A choice-first Home ("Edit an existing book" / "Import a new manuscript", each its own page) would need:**
- A new landing at `/` presenting the two choices (new component, small).
- The library grid moved to its own route (e.g. `/library` or `/projects`) — a route that **does not exist today** (there is no list route; the list is a section of Home).
- The upload moved to its own route (e.g. `/import`) — also new; today it is a component on Home, not a page.
- Navigation wiring between them (choice → library, choice → import, back to choice), and a decision on where a returning user lands (the choice screen every time, or straight to the library).

So the cost is **two new routes + a landing component + the navigation between them**, and — the larger point — **it reverses `HOME_WORKSPACE` Decision 1.** It is not large code, but it is a design reversal, not a bug fix.

## §3 — Options (for the CTO to weigh — none opened here; the proposal is a starting point, not a conclusion)

- **A — Keep the combined Home (status quo, Decision 1).** One screen: upload + library + passive stats. Its rationale is on record; its weakness is that on a full library the upload and the list compete for the same first screen, and neither is a deliberate "what do you want to do?" moment.
- **B — Choice-first Home, two destinations.** `/` becomes "Import a new manuscript" / "Edit an existing book"; each opens its own page (§2's cost). Clearer intent per the CTO's constant, at the cost of an extra click for the common case (open a recent book) and a reversal of Decision 1.
- **C — Keep one Home but re-weight it (middle ground).** Home stays one screen but leads with the choice/primary actions and demotes stats; e.g. a prominent "Import" and a prominent "Recent books", stats folded away. Addresses "several sections competing" without new routes or reversing Decision 1 — a layout change, not a navigation change.
- **D — Choice depends on library state.** Empty library → the upload IS the screen (as today's empty state already nearly is); non-empty → lead with the library + a clear "Import" affordance. Adapts to the two real situations without a permanent extra click.

## §4 — What this report deliberately does not do

It does not recommend one. The CTO's framing (a choice-first Home) is entered as **Option B, a starting point, not the answer** — the measured facts are that the current shape is a deliberate, documented decision (§0), that it combines exactly two actions plus two passive displays (§1), and that reversing it costs two new routes + a landing + navigation (§2). Whether the right move is to keep it (A), reverse it (B), re-weight it without new routes (C), or make it state-dependent (D) is the CTO's call, and the trade-off that matters most is *clarity of intent* (B/D) versus *one fewer click for the common "continue a book" case* and *not reversing a prior decision* (A/C).

**Not opened here; measure done; awaiting the CTO's decision and altitude. No code before that.**

## Related
`HOME_WORKSPACE.md` Decision 1 + §0 (the deliberate Home-is-the-library decision this would revisit; the Home/Workspace context split), `app/page.tsx` (the four sections measured in §1), `UploadDropzone.tsx` (import-in-page → redirect, §2), `PRODUCT_EXPERIENCE.md` (the studio's zone model the Home sits in), `FIRST_SCREEN_ERROR.md` (a separate, already-closed first-screen concern — the stale-deep-link error, not this layout question), `GUTTER_SCOPE.md` (this report's measure-first format).
