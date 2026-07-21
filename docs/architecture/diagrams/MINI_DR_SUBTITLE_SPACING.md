# Mini Design Review — Subtitle spacing in the PDF (title spacing as a theme value)

**Status:** AWAITING CTO REVIEW — **no code written.** A small Level-2 mini-review, feu vert given, following `SUBTITLE_SPACING_SCOPE.md` (measured, read-only). This document locks the mechanism, the shape of the new theme value, the tri-format decision, and the parity re-lock — *before* any code.
**Date:** 2026-07-21
**Re-verified against current code** (non-negotiable #7): every line the scope report cited was re-read on `main` today. All its facts hold; **one of its claims is corrected below** (§4 — DOCX/EPUB are symmetric, not "convention-correct").

---

## 1. The defect, and what changes

Measured on `faith-alone` (Classic): every one of 79 section subtitles + 17 chapter titles renders with **3–4× more space below it than above it** — backwards from typographic convention, so a subtitle visually floats with the paragraph *above* it and detaches from the text it titles.

**Cause, re-read in the code (unchanged since the scope report):**
- `PDFRenderer.renderTitle` (`PDFRenderer.ts:534`) ends with a bare **`doc.moveDown()`** — one line **at the title's own font size** (30.5pt at 24pt, 22.9pt at 18pt) as the *only* deliberate title spacing. It adds **no space before the title at all**; the ~8pt visible above is just the previous block's flat `paragraphSpacing` bleeding down.
- A heading *block* is spaced completely differently — `ThemeEngine.resolveBlockStyle` (`ThemeEngine.ts:48-49`) gives it **symmetric** `spaceBefore = spaceAfter = headingSpacing`. But real DOCX imports produce **titles, not heading blocks** (ADR-0031/0032), so **all 96 titles take the `moveDown` path** and none gets the theme-driven treatment.

**So the change is not a bug-fix in one line — it is a missing concept.** There is no *title* spacing value anywhere in `theme.spacing`; `renderTitle` invents one inline, and the invented value is (a) size-dependent, (b) below-only, (c) unrelated to `headingSpacing`. **What changes:** give titles a real, theme-driven, flat spacing pair, consumed in lock-step by the renderer and the model.

## 2. Measured inputs (against real output, not constants)

**Today's rendered spacing** (`backend/spikes/subtitle-spacing-scope.ts`, faith-alone / Classic, `headingSpacing=16`, `paragraphSpacing=8`):

| Title | size | above | below | below÷above |
|---|---|---|---|---|
| chapter | 24pt | ~8.0pt | ~30.5pt | **3.8×** |
| section L0 (1×) | 22pt | ~8.0pt | ~27.9pt | **3.5×** |
| section L2 (78×) | 18pt | ~8.0pt | ~22.9pt | **2.9×** |

**Current parity lock** (`PDFRenderer.parity.test.ts:51-54`, the numbers this change will move): `pageCount = 238`, `paginated.pages.length = 234`, **`unplannedPageBreaks = 2`**. *(The 246/3 figure in the RENDER_DRIFT prose is an older measurement; the test is the authoritative current lock.)*

**Charged today** (`LayoutEngine.titleHeightOf`, `LayoutEngine.ts:128-135`): `measureHeight(title) + lineHeight(size, heading)` — the second term **is** the `moveDown`. Charged **equals** consumed; the comment even says so. This is why the defect is invisible to the parity lock (which measures page counts, not intra-page rhythm) — *"R2 verifies charged equals consumed, not that consumed is correct"* (ADR-0052 lineage). The value is faithfully rendered; it is the wrong value.

## 3. The design

### 3.1 Shape — an explicit asymmetric pair on `theme.spacing`

Add two additive fields to `theme.spacing` (`Theme.ts:41-45`):

```
spacing: { paragraphSpacing, headingSpacing, lineHeight,
           titleSpaceBefore, titleSpaceAfter }   // new, flat points
```

Then:
- **`renderTitle`** spends `titleSpaceBefore` (flat, `doc.y +=`) *before* drawing the title, and `titleSpaceAfter` (flat, via the same `spendSpaceAfter` path blocks use) *after* it — **dropping `moveDown()`**. Flat, not size-scaled, is itself a fix: today's chapter-below (30.5) differs from section-below (22.9) only because `moveDown` scales with font size; a flat pair gives one predictable, theme-owned rhythm.
- **`titleHeightOf`** changes **in the same commit**: replace `+ lineHeight(size)` with `titleSpaceBefore + … + titleSpaceAfter`, so charged stays equal to consumed **by construction** (ADR-0051).

**Rejected alternative — reuse `headingSpacing` symmetrically** (route titles through `resolveBlockStyle`'s heading branch). It would fix the *backwards* ratio but only to **symmetric** (16/16), never to the convention *above > below*. An explicit pair is barely more code and expresses the intent. Recommend the explicit pair.

### 3.2 One pair for all title levels (not per-level)

The pair applies uniformly to chapter and section titles, size-independent. The defect is uniform across levels; per-level or per-theme title tuning belongs to the **later per-theme fine-tuning chantier**, not here. Keeping this review to one pair keeps the parity re-lock bounded. (Flat spacing removes the *accidental* chapter-vs-section difference noted above — an improvement, not a regression.)

### 3.3 Proposed starting values (CTO calibrates on real pages)

One measured fact must inform the numbers: **the previous block's `paragraphSpacing` (8pt, flat) still contributes to the visible gap above a mid-page title.** So *effective above = 8 + titleSpaceBefore*; *below = titleSpaceAfter*. Proposed, to be judged on real pages like Modern's accent shade (headless PDF capture hangs in this env — the CTO's eye is the instrument):

| Theme | titleSpaceBefore | titleSpaceAfter | effective above | below | direction |
|---|---|---|---|---|---|
| Classic | 18pt | 8pt | ~26pt | 8pt | **above > below** ✓ |
| Modern | 14pt | 6pt | ~22pt | 6pt | above > below ✓ (tighter, matching Modern's rhythm) |

**Total-height lever, disclosed:** Classic's new total (18+8 = 26) is ≈ today's section total (~23) and < today's chapter total (~30.5) → **near-neutral page-count shift**. The CTO can instead choose a *tighter* total to reclaim whitespace (the half-empty-pages theme) — a deliberate page reduction. Recommend near-neutral for this review; the re-lock will show the exact shift.

**Chapter-opening sink, disclosed:** on a chapter's opening page there is no preceding block, so `titleSpaceBefore` reads as a small "sink" pushing the title ~18pt below the top margin. Typographically fine (arguably pleasant), and **charged correctly** (`titleHeightOf` returns the same total regardless of page position, so charged==consumed holds even at a page top). This is *not* a chapter "drop" feature (title a third of the way down) — that is `openingPageStyle`, out of scope. Recommend applying `titleSpaceBefore` uniformly rather than special-casing page-top (a position-dependent branch is the kind of complexity we avoid); the CTO confirms the small sink is acceptable on real pages.

## 4. Tri-format — a correction to the scope report

The scope report said DOCX/EPUB are "already convention-correct via Word/CSS." **Re-reading the code corrects that:** they are **not backwards, but they are symmetric, not *above>below*.**

| Format | title spacing today | verdict |
|---|---|---|
| **PDF** | `moveDown` — below only | **backwards** — the defect |
| **DOCX** | `buildHeadingStyles` (`DOCXRenderer.ts:63`) — `before = after = headingSpacing`, applied to Chapter/Section titles too | **symmetric** (16/16 Classic), not backwards, not the convention |
| **EPUB** | `buildCss` sets `h1..h6` font only (`EPUBRenderer.ts:133-134`); **no margin declared** → reading-system default | reading-system default, ~symmetric, **not under our control unless we add margins** |

**Recommendation: fix PDF only in this chantier** — it is the only *backwards* renderer and matches the CTO's "en PDF" framing. DOCX/EPUB are not defective. The two new `theme.spacing` fields are additive; DOCX/EPUB simply ignore them, no breakage.

**But this is a real decision, not consistency polish:** enforcing the convention *cross-format* (ADR-0050, fidelity is the product) would mean switching DOCX from symmetric to the asymmetric pair (`buildHeadingStyles` title spacing) and adding `h1..h6` margins in EPUB CSS. Bounded, but wider blast radius on two non-defective renderers. Recommend recording cross-format title-spacing convergence as a **candidate for the per-theme fine-tuning chantier** (the same way `MINI_DR_DROPCAP_OVERLAP.md §4` deferred drop-cap convergence), and deciding it separately. **CTO's call.**

## 5. R2 / ADR-0051 — the one real risk, and its guard

Changing every title's height moves page counts on the corpus. This is expected and **must be a deliberate, loud re-lock**, exactly like Modern's parity lock naming its tighter spacing:

- **Page count MAY change.** Re-run faith-alone, read the new `pageCount`/`pages.length`, update `PDFRenderer.parity.test.ts` with a comment naming the reason (subtitle-spacing convention fix). Never a silent re-baseline.
- **`unplannedPageBreaks` may NOT rise above 2.** This is the ADR-0051 contract, and it is the sharp line: if reconciliations increase, `renderTitle` and `titleHeightOf` have **diverged** (charged ≠ consumed) — that is drift to **diagnose, not re-baseline**. The re-lock touches the count; it must not touch the contract.

**R2 cost is bounded by construction:** the only R2-locked component touched is `PDFRenderer` (the title-spacing spend), and `titleHeightOf` moves in the same commit with the same theme values, so the contract is preserved. No new engine, no new port.

## 6. Verification plan

1. **Lock-step unit test** — the same theme `titleSpaceBefore`/`titleSpaceAfter` drive both `renderTitle` (rendered geometry) and `titleHeightOf` (charge); assert they agree (extends the ADR-0045 charged==consumed discipline to titles).
2. **Convention assertion** — on a real single-section page, measured space *above* the subtitle > space *below* it (asserted on real rendered geometry via the scope spike's method, not on constants) — proving the defect is actually inverted, not just moved.
3. **Deliberate parity re-lock** — new corpus `pageCount`/`pages.length` recorded with reason; **`unplannedPageBreaks` stays 2** (the guard).
4. **Real-export + visual baseline** — `verify-real-export` green; any byte-baseline screen showing a PDF recaptured deliberately (title spacing changes the bytes).
5. **Live judgment** — render faith-alone to PDF; the CTO confirms on real pages that subtitles now bind to the text they title (the shade-equivalent call; headless capture hangs here).

## 7. Risks

- **Values wrong / wrong feel.** Calibration, not correctness — the CTO judges on real pages (§3.3). Cheap to iterate: two theme numbers.
- **`unplannedPageBreaks` rises.** Means the two sides diverged. Guard in §5; diagnose, do not re-baseline.
- **Double-count of the preceding `paragraphSpacing`.** Disclosed (§3.3): effective above = 8 + `titleSpaceBefore`. Values chosen with the +8 in view; not hidden.
- **Chapter-opening sink.** Disclosed (§3.3): a small, correctly-charged sink; CTO confirms it reads well.
- **Tri-format divergence.** Disclosed (§4): PDF-only leaves DOCX symmetric / EPUB default. A recorded candidate, not a hidden gap.

## 8. What the CTO is asked to lock

1. **Shape** — explicit `titleSpaceBefore`/`titleSpaceAfter` on `theme.spacing` (recommended), vs symmetric `headingSpacing` reuse.
2. **Granularity** — one pair for all title levels (recommended), vs per-level.
3. **Values** — Classic 18/8, Modern 14/6 as *starting* points (recommended), and the total-height lever (near-neutral vs tighter). Final shade is the CTO's on real pages.
4. **Tri-format** — PDF only (recommended), vs also align DOCX/EPUB to the convention.
5. **Chapter-opening sink** — apply `titleSpaceBefore` uniformly incl. page-top (recommended), vs suppress at page-top.

**No code until these are locked.**

## Implementation note (added at build time — the design above is unchanged; this records what the build discovered)

Two facts the paper design did not predict, both measured and now on record:

1. **An empty-title guard was required, and it fixed a latent drift.** `titleHeightOf` already returns 0 for an empty title (`if (!content.title) return 0`), but `renderTitle` did not guard it — the old `moveDown()` (and, unfixed, the new flat pair) spent title spacing for an **untitled preamble Section** that the model charged at zero. This pre-existing asymmetry was widened by the flat pair (10pt → 26pt), so `renderTitle` gained `if (!content.title) return;` to match the model. `faith-alone` contains exactly one such untitled section, and that uncharged spacing was itself **producing one of the "2 disclosed reconciliations."** Closing it removed that reconciliation.

2. **The parity re-lock is 2 → 1, not "stays 2."** §5 predicted the contract number would hold at 2 and forbade it *rising*; measured, it **improved to 1** on Classic (kdp-5x8) and on Modern (letter), because of finding 1. It never rose. Final locked numbers:
   - **Classic kdp-5x8:** pageCount 238 (unchanged vs pre-chantier), model pages 235, **unplannedPageBreaks 2 → 1**. (The title-spacing change alone gave 239/235/2; the empty-title guard then took rendered 239 → 238 and reconciliations 2 → 1.)
   - **Modern letter:** 90 → 88, reconciliations **2 → 1**. **Modern kdp-6x9:** 158 (unchanged), reconciliations **stay 2** (there the untitled section's spacing did not straddle a page break).

Everything else in the design held: flat lock-step spend/charge, near-neutral page shift, PDF-only, one pair for all levels, the chapter-opening sink applied uniformly.

## Related
`SUBTITLE_SPACING_SCOPE.md` (the measured scope this implements) · `RENDER_DRIFT.md` / ADR-0051 (the charged==consumed contract; the `moveDown → flat` fix titles never received) · ADR-0052 (*R2 verifies charged equals consumed, not that consumed is correct* — the lineage) · ADR-0031/0032 (why real imports produce titles, not heading blocks) · `MINI_DR_DROPCAP_OVERLAP.md` (the analogous PDFRenderer+LayoutEngine lock-step fix with a deliberate parity re-lock; the cross-format-convergence-deferral precedent) · `ThemeEngine.resolveBlockStyle` (the symmetric `headingSpacing` titles don't get).
