# First-Screen "Could not open this project" — Investigation (diagnostic only, no fix)

**Status:** ✅ **FIXED + VERIFIED LIVE (CTO-authorized 2026-07-21, scope strictly the redirect).** On `PROJECT_NOT_FOUND` the workspace now `router.replace('/')` to the library instead of dead-ending; other errors keep the recoverable screen; the typed error contract is untouched. Reproduced the real stale deep-link in the browser (`/projects/<gone-id>` → landed on "Your studio", `pathname: "/"`, no "Could not open this project" text). Backend 575/575, frontend 139/139, tsc + eslint clean, baseline byte-identical. The aesthetic finding stands: Home is NOT regressed (the "black" was dark mode); the `body`→`--app-surface-0` token migration remains minor disclosed tech-debt. Ordered by the CTO (2026-07-21, high priority — first-contact trust) after landing on the "Could not open this project" error as the FIRST screen, reaching the real library only after clicking "Back to the studio". Same discipline as the fidelity investigations: reproduce live, locate, classify — and, per the standing rule, the CTO's mechanical hypothesis was **verified against the code, not assumed correct**.

**Date:** 2026-07-21

---

## 0. Headline: the hypothesis was close in spirit, wrong in mechanism (measured)

The CTO's read — "`resume-where-left` holds an entry pointing at a `projectId` that no longer exists, and resolving it happens before Home mounts" — describes a mechanism the code **does not have**. Verified in the real source:

- **There is no launch-time project resume.** Nothing reads a stored "last project id" and navigates to it. Grep of `app/`, `components/`, `lib/`: the only `localStorage` key is `bps.view.${id}` (which STATION within an already-open project), read ONLY inside `app/projects/[id]/page.tsx:51`, never at the root. There is no `bps.lastProject`, no redirect in `app/page.tsx` (Home) or `app/layout.tsx`.
- **Home never navigates.** `app/page.tsx` lists projects from `GET /api/projects` and renders "Your studio". It cannot produce the error screen.

**What actually happens:** `/projects/[id]` is a real, reloadable, shareable URL. When the browser restores a stale project deep-link as its last-visited URL — a pre-SQLite in-memory id, an id from a reset dev database, a different `DATABASE_PATH`, or a genuinely deleted project — the workspace mounts, `getProject(id)` returns `PROJECT_NOT_FOUND`, and its error branch renders. **The first screen is a stale deep-link reload, not a resume bug.** The CTO's gravity assessment is nonetheless correct: whatever the mechanism, the first thing seen can be a generic error.

## 1. The purge DOES run — but it clears the wrong scope and does not redirect

The Import-Fidelity Commit-3 cleanup is present and fires (`app/projects/[id]/page.tsx:78-88`):
```ts
if (error instanceof ApiError && error.code === 'PROJECT_NOT_FOUND') {
  localStorage.removeItem(viewStorageKey(id));   // clears bps.view.<id>
  setLoadError('This project is no longer in your library.');
  return;
}
```
Two precise facts:
- It removes the per-project **VIEW** key (`bps.view.<id>` — which station reopens), which is the only stored state keyed on this id. There is no "last project" entry to purge, because none exists. So the purge is correct but narrow — it prevents nothing about the first-screen error.
- **It sets `loadError` and stops — it never redirects.** The user dead-ends on the error screen and must manually click "Back to the studio" (`:154`). For a stale deep-link restored on launch, that means the app's first screen is a terminal error requiring a click to escape.

**Classification: a recovery-UX defect in the workspace's not-found branch (Presentation).** The typed error contract itself is correct (PROJECT_NOT_FOUND, clear message, a recovery control) — the defect is that the recovery is a manual dead-end instead of an automatic return to the one place that makes sense. Not a data-fidelity issue, not a resume-where-left bug.

## 2. The aesthetic question — answered by capture, NOT a regression

Reproduced live, Home at `/` in both colour schemes (screenshots in session):
- **Light:** fully styled L'Atelier — warm-paper desk (`#f6f4ef`), header on `#fbfaf7`, bordered project cards, "Your studio" hierarchy, the dropzone. Exactly what `CURRENT_STATE.md` describes.
- **Dark:** the same layout on the theme-aware **dark palette** (warm-dark surfaces `#181614`–`#282420`), cards and borders intact. This IS the "black background" the CTO saw — **dark mode working as designed** (the VISUAL_LANGUAGE tokens style both schemes via `@media (prefers-color-scheme: dark)`), not a visual regression. The low contrast between dark surface levels is a real characteristic of the dark palette (a legitimate future polish item), but the screen is styled, not broken.

**One minor real token-debt, disclosed:** `body` still consumes the scaffold's `--background` (`#0a0a0a` pure black in dark) rather than `--app-surface-0` (`#181614`), a migration `globals.css` itself defers ("should be removed at Commit 5"). AppShell fills the viewport with `app-surface` tokens, so the visible desk is the warm-dark surface and the pure-black body is almost entirely covered — cosmetic, not the cause of the CTO's concern.

## 3. Fix directions (sketched — NOT implemented)

1. **On `PROJECT_NOT_FOUND`, return to the library instead of dead-ending.** The recovery action is the only sensible next step, so the app should take it: `router.replace('/')` (replace, not push, so Back doesn't bounce into the dead link again), optionally surfacing a brief, dismissible notice on Home ("That project is no longer in your library"). This removes the terminal-error first screen for stale deep-links while keeping the typed contract. The narrow purge stays as-is (correct).
2. **Optional hardening:** treat a restored stale deep-link as a redirect at the earliest point — but (1) already covers it, since the workspace is the only place the id is resolved.
3. **Minor polish (separate):** move `body` onto `--app-surface-0` (the deferred Commit-5 migration) and revisit dark-palette surface contrast — both cosmetic, neither blocks anything.

**Severity:** the CTO's "first-contact trust" framing holds even with the corrected mechanism — a stale deep-link restored on launch should not greet an author with a generic error screen. Fix direction 1 is small, localizable, and closes it. No fix applied; awaiting the CTO's verdict.

## Related

IMPORT_FIDELITY.md Commit 3 / ADR-0049 §3 (the typed error contract and the purge that fire correctly here — the recovery just needs to redirect), PRODUCT_EXPERIENCE §10.3 (resume-where-left is per-project VIEW state, not a launch-time project opener — the design never intended launch resume), VISUAL_LANGUAGE.md (the dark palette confirmed working, both schemes styled), globals.css (the disclosed body-token migration deferred from Commit 5).
