# Mini Design Review — C1, Quote Presentation as a Theme Value (RETROACTIVE)

**Status:** AWAITING CTO REVIEW. Retroactive: the code exists on `feature/book-presentation-p3`
(commit `c464761`), unmerged. Owed because the CTO's 2026-07-21 rule — *a capability that changes
the R2 height contract or touches the renderer beyond a theme value stops and reports first* —
applies to it and was not honoured at the time. Nothing merges until this is reviewed.
**Date:** 2026-07-21

---

## 1. What this touches beyond a theme value — declared honestly

Adding `Theme.presentation.quote.indentPt` is a theme value. **Three things go past that:**

| Site | Change | Beyond a theme value? |
|---|---|---|
| `LayoutEngine.estimateBlockHeight` | `quote`/`scripture` split out of the `paragraph` case; priced at `usableWidth - indent` | **YES — this is the R2 height contract itself** |
| `PDFRenderer` quote case | `{ indent: 36 }` (PDFKit **first-line** indent) → cursor shift + narrowed `width` (**true block** indent) | **YES — a rendering behaviour change, not a value swap** |
| `DOCXRenderer` | `theme` threaded through `renderContent`/`renderBlock` (3 call sites, mechanical); `indent.left` 720 → derived twips | signature change only, no behaviour |
| `EPUBRenderer` | `margin-left: 1.5em` → `${indentPt}pt` | value swap, but **changes the shipped EPUB**: 1.5em ≈ 16.5pt → 36pt |

## 2. Why it is necessary (and why the three could not move independently)

The three renderers disagreed **in kind, not merely in number**: PDF indented only the first line,
DOCX inset the whole block by 720 twips, EPUB by ~16.5pt. "Indented quote" meant three different
things in three formats — an ADR-0050 problem (no single-format truth) before it was a theming one.

Critically, **the PDF fix and the LayoutEngine fix cannot land separately.** While PDF indented
only line one, measuring quotes at full width was *approximately correct for PDF*. Making the PDF
indent real changes the wrap width, hence the true height — so the model must be taught the same
narrowing in the same commit. Splitting them would create, in one direction, an under-charged
block that overflows (unplanned page breaks), and in the other, an over-charged block that leaves
pages under-full. This is the exact charged-vs-consumed disagreement class RENDER_DRIFT closed.

## 3. How R2 stays guaranteed — and tested

- **Priced, not assumed:** the height goes through `TextMeasurer.measureHeight(text, {width: usableWidth - indent})` — the model charges the column the renderer really wraps in.
- **Locked by a property test** (`LayoutEngine.test.ts`, "quote pricing at the inset column"): asserts the priced height equals the narrowed-column measurement **and** is strictly greater than the full-width one — i.e. it tests the property that was violated (the narrowing really costs height), not a proxy.
- **Fallback is the historical constant** (`?? 36`), so a theme without `presentation` renders exactly as before — additive, ADR-0022/0027 pattern.

## 4. Risk if this is wrong — and one honest gap

- **If the model narrows and PDF does not:** over-charge → under-full pages. **If PDF narrows and the model does not:** overflow → unplanned page breaks. Both are caught by `PDFRenderer.parity.test.ts` (corpus: 238 pages, `unplannedPageBreaks` = 2).
- **The gap, stated plainly:** the parity suite is green, but green here proves *no regression on the corpus manuscript* — it does **not** prove this path is exercised, because it is not established that the corpus book contains quote blocks at all. Per the project's own principle (*a test is only as honest as the property it measures*), **§3's property test is currently the only real instrument for this capability.** Before this branch merges, either confirm the corpus exercises quotes or add a fixture that does. **I have not made this claim as verified, because I have not measured it.**
- **EPUB's disclosed visual change** (16.5pt → 36pt inset) is a real change to shipped output. It is the intended unification, but it is a change, and it is named here rather than buried.
