# Mini Design Review — Section folding in the Structure station (Option C)

**Status:** CTO-APPROVED — Option C, feu vert for commits (2026-07-21). Restores a **measured regression**: the Phase-3 rewrite dropped the old panel's collapse-by-default AND height cap for the chapter/section list.
**Date:** 2026-07-21
**Re-verified against current code** (non-negotiable #7): `StructureEditor.tsx` (section rendering, block `<details>`), the removed `BookStructureView.tsx` (git `5df2bc7^`), and the measured 3898px height on `main` (`bee13ef`).

---

## 1. What changes

Each chapter's **sections** move behind a **per-chapter, collapsed-by-default disclosure** — the chapter header (drag handle, title + word count, merge, placement) stays always visible; only the section list folds. The whole chapter list also gets a **height cap** (max-height + internal scroll) as a backstop for a book so section-dense that many chapters expanded would still dominate the page. Frontend-only; no backend, no DTO.

## 2. The locked decisions (CTO)

1. **Option C** — collapse-by-default **and** a height cap (not one or the other). Collapse fixes the common-case default height; the cap bounds the pathological all-expanded worst case. Restoring only one leaves a hole.
2. **Per-chapter collapse, not one global toggle** — an author working on one chapter opens just that chapter, without folding/unfolding the whole book each time. (Better for editing than the old panel's single global `<details>`.)
3. **Default state: collapsed** — matching the original CTO decision (2026-07-18) the removed panel cited; a refactor made it vanish inadvertently, no reason to depart from it.
4. **Folding hides ONLY the sections** — the drag/rename/placement/merge controls live on the always-visible chapter header and are never hidden.

## 3. Measured baseline (what we are fixing)

- `StructureEditor` renders a chapter's sections in a plain `<ul>` (`content.sections.map`) — no `<details>`, no cap. On `faith-alone` (17 ch / 79 sec) the editor Card measures **3898px, ≈3.8× the 1030px viewport**, linear in section count.
- The removed `BookStructureView` collapsed the whole structure by default and capped the opened list at `max-h-64` — *"once opened it can never dominate the page"*. Both properties regressed.
- The block-aware view (`BlockList`, the "Make this a chapter" flow) already folds/caps correctly (`max-h-56`) and is **untouched** by this change.

## 4. The plan (all in `StructureEditor.tsx`, frontend-only)

- **Sections behind a per-chapter `<details>`** (collapsed by default), distinct from the existing block `<details>` ("N blocks — split into chapters") — different purposes: blocks = the split tool, sections = the outline. Summary reads e.g. "N sections". The section rows inside are unchanged (title + word count + rename).
- **Height cap on the top-level chapter `<ul>`**: a `max-h-*` + `overflow-y-auto` backstop so even an all-expanded, section-dense book cannot grow without bound. Value chosen viewport-relative/generous so a normal book needs no inner scroll (collapse already bounds the default) and only a pathological one scrolls. (Exact value settled in code against the measured baseline — a design detail, not a new decision.)
- **The chapter header is untouched** — drag handle, "Chapter N:" + `EditableTitle`, word count, "Merge back", and the placement control all stay on the always-visible header row.

## 5. Verification plan

- **Collapsed by default (regression fix):** a rendered chapter with sections shows its header (title + word count) but NOT its section titles until expanded — asserted in jsdom (the section titles are not initially visible / the `<details>` is closed).
- **Per-chapter independence:** expanding one chapter's sections does not expand another's.
- **Controls stay visible under fold:** the drag handle, rename, merge, and placement controls are present on a collapsed chapter (the fold hides only sections).
- **Height bounded:** re-measure `faith-alone` in the studio — the collapsed default is a small multiple of the viewport (not ≈3.8×), and the cap holds when all chapters are expanded. (The number is the proof, per the scope report's standard.)
- **The block view is unchanged:** the unstructured-container "Make this a chapter" flow still renders/folds as before.

## 6. Risks

- **Losing the at-a-glance outline** — mitigated: the chapter header keeps title + word count always visible, so the book's shape (chapters + their sizes) is still scannable collapsed; only the sub-section detail folds. This is what an author expects of a book outline.
- **Reorder gesture interaction** — the drag handle is on the chapter header, above/outside the sections `<details>`, so folding cannot swallow the gesture; verified by the "controls stay visible" test.
- **A section-dense chapter expanded** — the outer cap is the backstop; the test asserts it.
- **Scope creep** — sections-fold + cap only; no change to the block view, the mutations, or the header controls.

## 7. What the CTO is asked to lock
All four §2 points are pre-locked. No open questions — this is the durable design record; commits follow (feu vert given), reported at each green step.

## Implementation note (as-built)

Shipped as one frontend commit, exactly as scoped. Verified live on faith-alone (the number is the proof, per the scope report): the Structure panel dropped from **3898px (≈3.8× viewport) to 851px (≈0.83×)** collapsed by default (all disclosures closed), and the chapter list caps at **721px (70vh) with internal scroll** even with everything expanded (7526px of content) — D5 restored in both the default and worst-case regimes. jsdom asserts collapsed-by-default and that the header controls stay visible while sections fold. The block "split into chapters" view is untouched. Console showed only Next dev-server RSC-prefetch errors (artefacts of server restarts, not this change). Merged to `main` (`1a6cf8a`); frontend 179/179, tsc + eslint clean.

## Related
`SECTION_FOLDING_SCOPE.md` (the measured scope — the 3898px regression, Option C chosen), `STRUCTURE_EDITING_PHASE3.md` D5 (the "never proportional to manuscript size" principle restored for the section list), the removed `BookStructureView.tsx` (git `5df2bc7^` — collapse-by-default + `max-h-64`, the behaviour regressed), `CREATE_CHAPTER.md` D5 (the block view that already folds/caps, untouched).
