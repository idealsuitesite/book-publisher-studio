# Render Drift — Proof Over-Pagination Investigation (diagnostic only, no fix)

**Status:** ✅ **CLASSIFICATION VALIDATED and ALL THREE FIXES IMPLEMENTED (CTO feu vert 2026-07-20, with the observability amendment on fix 2). See §6 for the executed result and the two further root causes the implementation surfaced. ADR-0051 records the principle permanently; ADR-0050 records why fidelity wins the argument.** Ordered by the CTO (2026-07-20) after observing, on the Faith_Alone Proof, pages holding 1-2 lines followed by near-total whitespace, at ~299 total pages where ~150 were expected. Same discipline as `IMPORT_FIDELITY.md`: reproduce live, locate, classify — fix only after validation.
**Date:** 2026-07-20
**Instruments:** three spikes, all committed, all rerunnable — `spikes/overpagination-spike.ts` (model-side page fill), `spikes/addpage-census-spike.ts` (every real `addPage()` by call site), `spikes/render-drift-spike.ts` (charged-vs-consumed height, block by block).

---

## 1. The CTO's hypothesis, tested first

> "Chaque section détectée déclenche un saut de page forcé; si l'ASTBuilder découpe en trop de sections, chaque fausse frontière produit une page presque vide."

**Refuted by reproduction.** On Faith_Alone the ASTBuilder produces exactly **17 chapters and 79 sections** (18 h1 minus the absorbed empty one; 78 h2 + 1). `LayoutEngine` forces a page break **only for chapters** — sections flow inside their chapter's pages (LayoutEngine.ts:207: "Chapters conventionally start on a new page; sections/subsections flow"). The `addPage` census confirms it: exactly **17** chapter-opening breaks in the real PDF. There is no over-segmentation and no per-section break. **The import pipeline is innocent of this defect**, and this investigation therefore adds no new justification for heuristic heading detection — that question stays where IMPORT_FIDELITY left it.

## 2. What was actually reproduced (kdp-5x8, the trim that reproduces the reported count)

| Fact | Measured value |
|---|---|
| Domain model pages (measured LayoutEngine) | **227**, mean real fill **86%** — the *plan* is sane |
| Real PDF pages | **284** (Pages-tree `/Count`; CTO saw ~299 on their settings) |
| Unplanned pages | **57** |
| `addPage()` decomposition | 17 chapter opens + 60 planned overflow breaks + 149 planned split continuations + 3 front matter + **45 auto-breaks inside `doc.text()` (renderRuns:585) + 10 auto-breaks drawing titles (renderTitle:420)** |
| Near-empty real pages (≤2 content lines) | **50 of 284 (18%)** — the exact "1-2 lines then blank" signature in the captures |
| Same disease at letter | model 83 pages → real PDF 118 (+42%) |

The 55 auto-breaks are pages **PDFKit inserted on its own initiative** when text overflowed the bottom margin — the model never planned them, and the renderer never notices them.

## 3. The mechanism — how 2.4 pages of drift becomes 57 wasted pages

`render-drift-spike` measured every block the renderer drew without a page change (471 samples):

- **100% of blocks consume more height than the model charged.** Mean **+2.25pt per block**; 468/471 sit tightly in +2..6pt; 3 outliers exceed one full line (bold/italic runs wrapping differently than the plain-text measurement — the residual LAYOUT_FIDELITY §Phase B disclosed).
- Cumulative excess: 1,057pt ≈ only **2.4 pages** of content. The damage is not the excess itself — it is the **amplification**: ~15 blocks/page × 2.25pt ≈ 34pt ≈ 2.5 lines/page of unmodelled consumption, so roughly a quarter of planned pages overflow by ≥1 line. Each overflow triggers: PDFKit silently breaks → 1-2 lines spill onto an unplanned page → **the next model-planned break fires anyway** (renderBlock:438 honors `pageStarts` unconditionally) → the spilled page is abandoned at 1-2 lines. One drift event ≈ one nearly-empty page. 55 events, 50 observed near-empty pages, 57 extra pages: the numbers agree.

**Dominant sub-cause, located:** the model charges `spaceAfter` flat (LayoutEngine.ts:322-325, e.g. 8pt) but the renderer advances `doc.moveDown(spaceAfter / fontSize)` (PDFRenderer.ts:469/477/487/497), which moves `spaceAfter/fontSize × lineHeight ≈ spaceAfter × 1.15` — **+1.2pt per block at body size**, every block, plus ~1pt of line-height accounting difference. Emphasis-run wrapping is real but minor here (2.6% of characters; 3 blocks over a line).

## 4. Classification (the CTO's demanded triage)

**A renderer/model coordination defect in Infrastructure — not import, not the pagination rule, not the theme.**

- *Import*: innocent (§1 — structure counts exact, no section breaks).
- *Pagination algorithm*: the plan is sane (86% mean fill; chapter-break convention accounts for its legitimate short pages).
- *Theme/parameters*: no — the same `spaceAfter`/fonts feed both sides; the defect is that the two sides **spend them differently**.
- The deeper contract violation: ADR-0013 tolerated "±1 line drift" as *bounded*; Phase A/B made the model honest, but the renderer still has **two ways to break a page** (obey the plan, or let PDFKit auto-flow) and no reconciliation between them. LAYOUT_FIDELITY Decision 3's own words apply: *"renderers render what pagination says instead of addPage()-ing on their own initiative"* — the auto-break is exactly that initiative, silent.

**Also explained:** the "299 vs ~150" ratio decomposes as ~150 (word-estimate at letter proportions) → ~197-227 *legitimately* at 5x8 trim (smaller sheet + chapter convention — not a defect) → 284-299 through the drift amplification (**the defect**).

## 5. Fix directions (sketched for the verdict — NOT implemented)

1. **Charge what the renderer spends, or spend what the model charges** — align the `spaceAfter` semantics (one-line change on either side) and re-measure; this alone should collapse most of the 55 auto-breaks.
2. **Forbid the silent auto-break**: renderRuns/renderTitle detect an imminent overflow (cursor + next line > bottom) and reconcile with the plan instead of letting PDFKit page on its own — the structural completion of LAYOUT_FIDELITY Decision 3.
3. **A drift-parity assertion in the real-manuscript harness** (`verify-real-import`'s sibling for rendering): real PDF page count must equal `pages.length` + front-matter/blank bookkeeping, on the corpus — the regression became invisible because nothing compared the two counts.

Order matters: 1 shrinks the drift, 2 makes remaining drift loud, 3 keeps it dead. All three are small; none is authorized yet.

## 6. Executed (2026-07-20) — measured before/after

The three fixes landed in order, and the implementation surfaced **two further root causes** the §3 census could not see (its drift sampling excluded page-crossing blocks — a selection bias, disclosed):

1. **`spaceAfter` aligned** (fix 1): every block site now spends flat points via `spendSpaceAfter()`; heading/image/divider `moveDown(0.5)` and the unspent table/footnote gaps aligned too. Drift ratio 1.0206 → **1.0008**; 55 auto-breaks → 13.
2. **Line heights priced in the real face**: `TextMeasurer.lineHeight` gains a font context — the old "line height is a property of size, not family" claim measured FALSE (default 12.72pt vs Gelasio 13.96pt at body size, ~10% under-charge on every split-page line). Title `moveDown` likewise (+2-2.7pt per title × 96 titles).
3. **Title keep-with-next**: the model charged a section title to the CLOSING page while its first block flushed to the next — the renderer then drew a 40-90pt title into a spent page bottom (10 of the 13 residuals, traced live). `flushBeforeTitleIfOrphaned` + the renderer's matching break-before-title enforce one invariant: a titled content's first block starts a planned page ⇔ its title starts it too.
4. **`PAGE_SAFETY_PT` (7pt)**: measured pages keep half a line back, so the irreducible ±0.5pt/block render noise (justified wrapping, run-segmented draws) can never overflow silently.
5. **Observability (fix 2, CTO amendment)**: every deliberate break goes through `plannedAddPage()`; anything else is counted into `RenderMetrics.unplannedPageBreaks`, logged with its trigger block, and reconciled into `pageOwners` — closing a secondary defect the census exposed: unplanned pages shifted every later owner entry, misattributing running heads and page numbers for the rest of the book.
6. **Drift parity locked** (fix 3): `PDFRenderer.parity.test.ts` on the real corpus asserts exactly **3** reconciliations (the disclosed bold/italic-run wrapping residual, ±1 line each) and the exact page count — loud in both directions.

**Result on the corpus manuscript at kdp-5x8: 284 → 246 real pages (model 241), near-empty pages 50 → 3, ratio 1.0008.** The trace/census/drift spikes remain committed and rerunnable as the measuring instruments. *(Calibration follow-up, 2026-07-21: the quality-bar measurement then exposed a JS evaluation-order bug in the keep-with-next flush — ghost near-full pages at section boundaries; fixed, bringing the corpus book to 238 real pages / 234 model / 2 reconciliations / ZERO non-structural pages under 30% fill on all six layouts. PUBLICATION_QUALITY_BAR.md §10 carries the full table; the parity test carries the exact numbers.)* **The reconciliation count is not fixed at 3 — the parity test is its sole authority, and it has fallen 3 → 2 → 1 as successive latent drifts were closed. Latest, 2026-07-21 (MINI_DR_SUBTITLE_SPACING): `renderTitle` was spending title spacing for an untitled preamble Section that `titleHeightOf` charged at zero — a charged≠consumed drift that was itself producing one of the two remaining reconciliations. Closed by an empty-title guard aligning the renderer with the model; corpus book now 238 real pages / 235 model / 1 reconciliation at kdp-5x8 (the sole remaining bold-run residual). Recorded as an ADR-0051 latent-drift closure in `DECISIONS.md`.**

## Related

`IMPORT_FIDELITY.md` (the sibling investigation; its §4 commit plan is untouched by this finding), `LAYOUT_FIDELITY.md` (Phases A/B fixed the *model*; this defect lives in the renderer's obedience), ADR-0013 (drift tolerance, now measured as unbounded in accumulation), ADR-0043 (gutter, still OPEN, unrelated), ADR-0045 (renderer as metrics authority — ironically the metrics were right: 284 — nothing consumed them for parity).
