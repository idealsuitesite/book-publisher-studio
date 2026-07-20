# Gutter (ADR-0043) — Scope Report, not a Design Review

**Status:** SCOPE REPORT for CTO decision. No code written. Chantier C of the 2026-07-21 sequencing.
**Date:** 2026-07-20 (session), grounded in the code on `main` at `dce4f18`, not in ADR-0043's 2026-07-18 text.
**Purpose (CTO's own words):** *which renderers, what impact on the already-calibrated pagination, what R2 risk — enough for the CTO to decide, not a full Design Review.*

This report deliberately re-derives the defect from the current code rather than trusting ADR-0043, because the render-drift work, the R2 parity lock, and `RenderMetrics` all landed **after** that ADR was written. One of its central claims does not survive re-measurement.

---

## 0. The headline the CTO needs first: the "emergency" premise is false, measured

ADR-0043 is titled *"Every Paperback This Product Generates Is Non-Compliant"* and states *"Text runs into the binding."* **On the shipped numbers, that is overstated.**

- Every layout preset — KDP and non-KDP alike — ships **72pt (1.0in) symmetric margins** (`KDP6x9PageLayout.ts:11-14`, and identical in `KDP5x8`, `KDP5.5x8.5`, `A4`, `A5`, `Letter`).
- KDP's inside-margin (gutter) requirement is a **minimum**, and its **maximum** value across the entire 24–828 page range is **0.875in = 63pt** (`KDPRuleData.ts:38-42`).
- **72pt inside > 63pt maximum required gutter.** The default inside margin therefore satisfies the KDP gutter minimum for *every* book in the supported page range. Text does not run into the binding at the shipped defaults.

ADR-0043's reasoning error: it assumed `marginLeft` "happened to be" less than the gutter. It happens to be 1in everywhere, which clears the bar. The defect is real, but it is **not a compliance emergency** — it is a latent **capability + validation** gap masked by a conservative default. That changes the urgency, and the CTO should decide against the true framing.

---

## 1. What is actually missing (re-confirmed in current code)

`PageLayout` (`PageLayout.ts:1-9`) has exactly `marginTop/Bottom/Left/Right` — symmetric, no inside/outside, no recto/verso. Three consequences, in descending order of real risk:

1. **Validation gap — the load-bearing one.** `KDPRuleData.marginsByPageCount` / `gutterIn` is **dead data**: a grep across `backend/src` for `marginsByPageCount|gutterIn|MarginRow` returns matches **only in `KDPRuleData.ts` itself** — no rule reads it. So compliance today is *accidental* (the 1in default happens to exceed the max gutter), not *enforced*. A user who ever sets a tighter inside margin would silently ship a non-compliant interior and nothing would catch it. This is the gap worth closing first, and it needs no renderer change.
2. **Capability gap.** The model cannot express `inside ≠ outside`, so professional binding-reserve typography (a wider inside than outside) is impossible, and margins cannot be tuned tighter without going symmetric on both sides.
3. **Recto/verso mirroring.** Moot while margins are symmetric-equal (both sides identical, so there is nothing to mirror). Becomes necessary the instant `inside ≠ outside` is introduced.

---

## 2. Which renderers, and what each costs

| Renderer | Affected? | Cost | Why |
|---|---|---|---|
| **PDF** (`PDFRenderer.ts`) | Yes — this is the print-critical, R2-locked one | **Real change** | Margins are applied once at doc creation (`:104-107`) from `book.pageLayout`; PDFKit has **no native mirror-margin concept**. Per-page (recto/verso) margins need a per-`addPage` override, and every header/footer/title x-origin that reads `doc.page.margins.left` (`:353, :362, :463, :855…`) must follow the correct inside/outside per page. |
| **DOCX** (`DOCXRenderer.ts`) | Yes | **Cheap** | Builds one `ISectionOptions` with symmetric `margin: {top,bottom,left,right}` (`:302-310`). The `docx` package supports native `gutter` and `mirrorMargins` in the section margin object — a few added fields. Note DOCX reflows in Word, so its pagination is **not** the R2-locked artifact. |
| **EPUB** (`EPUBRenderer.ts`) | No | **None** | Reflowable; the reading system owns margins. A gutter has no meaning here. |

---

## 3. Impact on the already-calibrated pagination — the R2 question, answered precisely

The pagination model and the PDF renderer share **one identical formula** for the text column:
- model: `usableWidth = layout.width - layout.marginLeft - layout.marginRight` (`LayoutEngine.ts:44`)
- renderer: `contentWidth = width - margins.left - margins.right` (`PDFRenderer.ts:343`, `:459`)

That shared formula is what makes the locked parity numbers (238 real pages / 2 reconciliations, `PDFRenderer.parity.test.ts`, ADR-0051) hold. Whether a gutter disturbs them depends entirely on **one variable — the total horizontal margin** — and the answer splits cleanly:

- **Redistribution (inside + outside = today's 144pt): pagination is UNTOUCHED.** `usableWidth = width − inside − outside` is unchanged when the total is preserved, so the page count, the parity numbers, and the drift contract all hold **with no re-lock and no circularity**. The change becomes purely "which side is wider" — a renderer-placement concern. **This is the low-R2-risk path** and it still delivers real binding-reserve typography.
- **Additive (inside grows, outside fixed): pagination SHIFTS.** `usableWidth` narrows → more lines per paragraph → more pages → the parity numbers must be consciously re-locked, **and** ADR-0043's circularity bites (gutter depends on page count; a wider gutter raises the count; a book near a threshold — 150/300/500/700 — can cross it because of its own margin). Only this path needs the ADR's one-repagination-pass.

**Crucial simplification, true for both paths:** `usableWidth` is **side-independent**. On a recto the inside is the left margin; on a verso it is the right; but `width − inside − outside` is identical either way. So the *model* never needs to know recto from verso — only the *renderer* does, for placement. The pagination change (if any) is one narrower column applied uniformly, not a per-page variable. That is what keeps this bounded and re-lockable rather than open-ended.

**R2 failure mode to call out:** model and renderer must apply the *same* margins or parity breaks **silently**. Today they agree by sharing the symmetric formula. Any gutter must be mirrored in **both** `LayoutEngine.usableWidth` and `PDFRenderer`, or the drift the render-drift work just closed reopens without a test noticing until the parity assertion is re-run. `RenderMetrics.pageLayout` (`RenderMetrics.ts:31`) already carries the geometry actually used, so a post-render gutter-compliance check is possible the moment the model can express one.

---

## 4. A decision menu for the CTO (options, not a recommendation-disguised-as-a-plan)

1. **Validation-first (cheapest real risk reduction).** Add an inside-margin notion to the model + a KDP gutter rule that finally consumes the dead `marginsByPageCount` via `RenderMetrics.pageLayout`. No renderer mirroring yet. Converts *accidental* compliance into *enforced* compliance and catches a too-tight margin. Zero pagination impact.
2. **Redistribution mirroring (professional typography, provably zero parity risk).** Introduce `inside`/`outside` as a redistribution of the current 144pt total; PDF applies them per recto/verso, DOCX uses native `mirrorMargins`. `usableWidth` unchanged → no re-lock, no circularity. Pairs naturally with option 1.
3. **Additive gutter (full ADR-0043 as originally imagined).** Inside grows on top of the outside; triggers the re-pagination pass, the parity re-lock, and the threshold-crossing report. Largest blast radius; justified only if a design genuinely needs more inside margin than the current 1in already provides — which, per §0, it does not for KDP compliance.
4. **DOCX-only quick win.** Native `gutter`/`mirrorMargins` on the DOCX section alone. Low value: PDF is the print format and stays untouched.

**What this report asserts, and stops at:** the defect is a capability + validation gap, not the compliance emergency ADR-0043 describes (§0); the highest value-per-risk lies in options 1 and 2, both of which avoid the pagination re-lock entirely; and no path should be taken that changes the total horizontal margin unless a specific design requires it, because that is the only path that reopens the R2 contract. The scope decision — and whether this becomes one Design Review or two (validation vs. renderer mirroring) — is the CTO's.

---

## Evidence index (all on `main` at `dce4f18`)
- `PageLayout.ts:1-9` — symmetric margins, no gutter.
- `KDP6x9PageLayout.ts:11-14` + the four other presets — uniform 72pt margins.
- `KDPRuleData.ts:37-42` — gutter table (max 0.875in); read by no rule (grep).
- `LayoutEngine.ts:43-44` — `PAGE_SAFETY_PT` reserve + the `usableWidth` formula.
- `PDFRenderer.ts:104-107, 343, 459` — margins applied once at creation; the mirror-formula the model shares.
- `DOCXRenderer.ts:302-310` — single symmetric section; native `gutter`/`mirrorMargins` available.
- `RenderMetrics.ts:31` — `pageLayout` carried per artifact, enabling post-render validation.
- ADR-0042 / ADR-0043 (`DECISIONS.md`) — the origin, and the circularity this report bounds.
- `PDFRenderer.parity.test.ts` (ADR-0051) — the 238/2 numbers a re-lock would touch.
