# Section Folding in the Structure Station — Scope Report (measured, no code)

**Status:** 📋 SCOPE REPORT — read-only, measured on `main` (`84c1bc8`). No production code opened (the `GUTTER_SCOPE.md` format).
**Date:** 2026-07-21.
**The constant that motivated it (CTO, real capture):** normal chapters show ALL their sections expanded, permanently — no fold, no option to fold. Never explicitly scoped; a direct carry-over from the old read-only panel.
**Instrument:** reading `StructureEditor.tsx` and the removed `BookStructureView.tsx` (git), plus a real height measurement in the studio.

---

## §0 — The measured answer: there is NO fold for a chapter's sections, and it IS a regression

**Exact current behaviour (`StructureEditor.tsx`):**
- A chapter's **blocks** (its paragraphs) sit behind a `<details>` toggle — "N blocks — split into chapters" — collapsed by default, and their list is height-capped (`BlockList`: `max-h-56 overflow-y-auto`). This is the Phase-3 D5 mechanism, correctly applied.
- A chapter's **sections** are rendered UNCONDITIONALLY in a plain `<ul>` (`content.sections.map`, no `<details>`, no toggle) with **no height cap**. So every section of every chapter is always on screen. The `<details>` the CTO wondered about exists — but only for blocks, never for sections.
- The whole editor Card has **no max-height** either — the chapter/section list grows without bound.

**This is a regression, not an unbuilt feature (measured against the removed `BookStructureView.tsx`, git `5df2bc7^`):** the old read-only panel wrapped the ENTIRE structure in one `<details>` — its own comment: *"The full structure is collapsed by default, deliberately (CTO decision, 2026-07-18) … once opened it can never dominate the page"* — and height-capped the opened list (`max-h-64 overflow-y-auto`). The Phase-3 rewrite (`StructureEditor`, commit `5df2bc7`) replaced it with an always-expanded, uncapped list. **Both the collapse-by-default AND the height cap were lost for the chapter/section list** — the D5 principle survived only for the block-aware view.

## §1 — The real height, measured (not "it's long")

Measured live in the studio on `faith-alone` (17 chapters / 79 sections / 1 untitled preamble), viewport 1030px:

| | measured |
|---|---|
| Structure editor Card height | **3898 px** |
| Main scroll height | 3962 px |
| Viewport | 1030 px |
| **Card ÷ viewport** | **≈ 3.8×** |

The panel is **nearly four viewports tall** on a real book — and it scales linearly with section count, so a denser manuscript is worse. This is exactly the "a panel's height must never be proportional to the manuscript" failure D5 named, present here for the chapter/section list.

## §2 — Does the D5 mechanism apply cleanly, or is a different approach needed?

D5's mechanism (used for the block view) is **height-cap + internal scroll** (`max-h-*`, `overflow-y-auto`). It applies cleanly to the whole chapter list — but on its own it produces one tall inner scroll area, which is not what the old panel (or a book outline) actually wants. The old panel combined **two** distinct things:
1. **Collapse by default** — a chapter shows its title + word count; its sections appear only when the author expands it. This is the outline behaviour a non-technical author expects, and it is what the CTO's proposed direction describes.
2. **A height cap** — a backstop so even a fully-expanded, section-dense book cannot dominate the page.

They are independent: (1) fixes the *default* height; (2) bounds the *worst case* (a book with hundreds of sections all expanded). The old panel had both. So this is not "apply D5 or not" — it is "restore collapse-by-default, and keep a cap as the backstop."

## §3 — Options (for the CTO to weigh — none opened here)

- **A — Collapse chapters by default (per-chapter `<details>`), sections on expand.** Each chapter row shows title + word count (already computed); a disclosure reveals its sections. Restores the pre-Phase-3 behaviour the CTO describes, per-chapter rather than one global toggle (better for editing — you can open just the chapter you are working on). The reorder/rename/placement controls stay on the always-visible chapter header. Smallest change that fixes the default height.
- **B — Height-cap the whole list (D5 mechanism only).** One `max-h` + internal scroll on the chapter `<ul>`. Bounds the panel but leaves every section expanded inside a tall scroll box — bounds the worst case without giving the author an outline. Weaker than A on its own.
- **C — Both (what the old panel did).** Collapse-by-default (A) for the outline, plus a cap (B) as the backstop for a pathologically section-dense expanded state. The most faithful restoration.

**Interaction to lock:** the drag-to-reorder gesture and the placement/rename controls live on the chapter header, which stays visible under any option — folding hides only the sections, not the chapter's own controls. And the unstructured-container block view (D5, the "Make this a chapter" flow) is untouched by all three — it already folds/caps correctly.

## §4 — Recommendation

A **measured regression** (not a missing feature): the pre-Phase-3 panel collapsed by default and capped its height; the rewrite dropped both for the chapter/section list, producing a **3898px / ≈3.8-viewport** panel on a real book. Recommend a **mini Level-2** to restore it, most likely **Option C** (per-chapter collapse-by-default + a height-cap backstop) — small, frontend-only, and it re-honours D5 where it was lost. Lock before code: A vs B vs C, whether collapse is per-chapter (recommended) or one global toggle like the old panel, and the default state (collapsed — recommended, matching the old CTO decision).

**Not opened here; measure done; awaiting the CTO's go and altitude. No code before that.**

## Related
`STRUCTURE_EDITING_PHASE3.md` D5 (the "never proportional to manuscript size" principle this restores for the section list), the removed `BookStructureView.tsx` (git `5df2bc7^` — the collapsed-by-default + `max-h-64` behaviour that regressed), `CREATE_CHAPTER.md` D5 (the block-aware view that DOES fold/cap correctly, untouched here), `GUTTER_SCOPE.md` (this report's measure-first format).
