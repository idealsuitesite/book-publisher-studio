# Formatting Tools — Author Control Audit (factual inventory, not a Design Review)

**Status:** AUDIT for CTO prioritization. **No production code** — read and measure only. Same shape as `GUTTER_SCOPE.md` / `STRUCTURE_VS_THEME_SCOPE.md`: a table of **verified findings**, not recommendations. The CTO decides the next chantier's priority from this; the audit does not pick.
**Date:** 2026-07-21, grounded in code on `main` at `992688b` and verified live in L'Atelier this session.
**Question it answers:** what can an author actually control themselves today to style and export a professional book, and what is missing?

---

## 0. Headline (measured)

An author today has a **real professional baseline**: pick a theme (2), pick a trim size (6), see a **live auto-regenerating proof**, and export PDF/DOCX/EPUB. But almost every *finer* styling knob is **fixed or frozen** — the author cannot nudge an accent colour, cannot enable callouts (never built), cannot reach styled quotes or drop caps (frozen), and cannot yet edit structure in the UI. Real control today = **theme choice + layout choice + live proof + export.** Everything below that is not author-adjustable.

---

## 1. Verified findings

| Capability | What the author controls today | State (verified) | Gap |
|---|---|---|---|
| **Themes** | Pick **Classic** or **Modern** from the gallery | 2 registered (`getTheme`: classic, modern). Modern = sans headings + **visible Prussian accent** + tighter heading spacing vs Classic's serif/all-black. Genuinely different looks — **but only 2**. | A real choice exists, shallow (2 residents); no third, no depth. |
| **Per-theme fine-tuning** (accent, font, spacing) | **Nothing** | Themes are **fixed data** (`ClassicTheme.ts`/`ModernTheme.ts`); grep found **no** `updateTheme`/`customAccent`/edit endpoint or UI. All-or-nothing. | The knob an author most wants — the accent shade — is **uneditable without code**. |
| **Layout / trim size** | Pick from **6 presets** (Letter/A4/A5/KDP 5×8/5.5×8.5/6×9) | Built, real, **persisted per project** (`PATCH /settings`, verified). | Size is controllable; margins/gutter are fixed (`GUTTER_SCOPE.md` — a validation gap, not an author control). |
| **Table of contents** | Automatic | **BUILT** (Sprint 6: auto-generated from chapter/section titles, rendered in PDF + DOCX). | Works, but not author-configurable (depth/inclusion). |
| **Callouts** | **Nothing** | **NEVER BUILT** — appears only in `BOOK_PRESENTATION.md` (design); **zero code** (grep). Part of the frozen Phase-3 six-capability set. | Entirely absent. |
| **Styled quotes** | Automatic italics on quote/scripture blocks | **PARTIAL** — `TypographyResolver` forces italics (merged); the richer **C1 theme-value presentation** (`indentPt`) is **FROZEN** on `feature/book-presentation-p3` (unmerged). Quotes arise only from Word's "Quote" style, so **0 in real unstyled manuscripts**. | The rich presentation is frozen and quotes are largely unreachable from real imports. |
| **Drop caps** | **Nothing** | Fix shipped (`DROPCAP_TEXT_OVERLAP`, priced), but the drop-cap **theme capability** (positional trigger) is **FROZEN** (`MINI_DR_DROP_CAPS`); nothing populates `Block.dropCap` (0/2,152 real paragraphs). | Author cannot enable drop caps; a latent capability with no trigger. |
| **Inline formatting** (bold/italic/strike/…) | Preserved from the source manuscript | **BUILT** tri-format (`TypographyResolver`); underline dropped at import (ADR-0025). | Author edits it upstream in Word, not in-studio. |
| **Structure editing** (reorder / rename / front matter) | **Nothing in the UI yet** | Domain + Application + mutation route **BUILT** (phase 1 + phase 2 core, this session, on branch — persisted, undoable); **no frontend** (phase 3); front-matter-as-user-content is the remaining phase-2 commit. | Not author-reachable until the frontend (phase 3). |
| **Living Proof** (preview before export) | Auto-regenerating PDF preview | **BUILT + WORKS** — verified live this session: a settings change re-inked the proof, page count read from the real PDF bytes (90→159 on a trim change). It is one of **7 stations** ("Proof"). | Visible but **not the default view** (Overview is); a non-technical author must navigate to it to notice it. |
| **Interface light/dark** (`AppTheme`, distinct from the book `Theme`) | Follows the **OS** setting | **BUILT + WORKS** — tokenized light+dark pairs, `@media (prefers-color-scheme: dark)` in `globals.css`; **light is the default** (`:root` base = light). | **No in-app toggle** — the user cannot switch it; it tracks the OS only. |

---

## 2. What this audit deliberately does not do

It does not recommend a next chantier. The two threads already open — the **second-theme aesthetic** (awaiting the CTO's screenshot-loop judgment of `#1D4E68`) and **structure editing phases 2–3** — are noted as *state*, not priorities. The table above is the input for the CTO's own prioritization: whether the highest-value gap is *more themes*, *per-theme tuning*, *callouts*, *unfreezing quotes/drop-caps*, or *finishing structure editing into the UI* is the CTO's call, and this report deliberately leaves it there.

## 3. Evidence index (all on `main` at `992688b`, verified this session)
- `backend/src/domain/themes/getTheme.ts` — 2 themes registered; `ClassicTheme.ts`/`ModernTheme.ts` — fixed data, no tuning surface.
- grep (backend + frontend) — no theme-edit endpoint; `callout` only in `BOOK_PRESENTATION.md`.
- `LayoutEngine` TOC (Sprint 6) — built; `PATCH /settings` — layout persisted.
- `TypographyResolver` — inline formatting + forced quote italics; `feature/book-presentation-p3` — C1 quote presentation frozen; `MINI_DR_DROP_CAPS` — drop-cap capability frozen.
- Live L'Atelier this session — Living Proof re-inks on settings change (90→159 pages), one of 7 stations.
- `frontend/app/globals.css` — light+dark tokens via `prefers-color-scheme`, light default, no toggle.
- `STRUCTURE_EDITING.md` — structure editing built through the route this session, no frontend yet.
