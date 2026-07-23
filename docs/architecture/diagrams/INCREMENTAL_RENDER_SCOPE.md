# INCREMENTAL_RENDER (P1) — cadrage (measured; stops at the constats)

**Status:** cadrage, awaiting CTO verdicts. **No production code.** This is P1 of the AUTHOR_EXPERIENCE
Axis-7 sequence — the second prerequisite after P2 (`BATCH_CONFIRM_LATENCY`, merged `712057e`). The
living Proof re-renders the WHOLE book on every change; criterion A (fluidity) needs incremental
rendering. **The CTO's instruction: the form is NOT presumed — instrument the three candidates against
the founder's real book, measure first.** This cadrage does that, and the measurement **reframes the
question** (a #7 surface: it contradicts the premise the three candidates share).

**Instrument:** `backend/spikes/incremental-render-cadrage.ts` (read-only — committed corpus + a fresh
import of book 3 from its stored bytes; the store is never written). Decomposes the whole-book render
into its stages and asks whether the PDF render is per-page or a fixed floor, on **three** real books
so no conclusion rests on one shape (#7). Numbers below are one representative warm run; the *shape* is
the finding.

---

## §1 The pipeline and the three candidates

`renderBook` = resolveTheme → `applyTheme` → `TypographyResolver.resolve` → **`LayoutEngine.paginate`**
(cached by `md5(book):theme:layout` — `MINI_DR_PAGINATION_REUSE`; a content change MISSES) → **`PDFRenderer.render`**.

The CTO's three candidates, each defined by the stage it would avoid:
1. **visible-page-only** — render only the on-screen page(s), not all N.
2. **progressive first-page-first** — paint page 1 immediately, stream the rest.
3. **partial repagination** — repaginate only the changed region, reuse the rest's geometry.

## §2 The measurement (three real books, KDP 6×9, classic)

| book | pages | theme+typo | **paginate** | **PDF render** | total |
|---|---|---|---|---|---|
| faith-alone (17 ch, structured, corpus) | 155 | 5 ms | 187 ms (38%) | **296 ms (61%)** | 487 ms |
| book 3 fresh import (1 section, ~46k w) | 340 | 20 ms | 136 ms (29%) | **315 ms (67%)** | 470 ms |
| book 3 as edited (23 entries) | 352 | 15 ms | 72 ms (16%) | **357 ms (80%)** | 445 ms |

**Render cost vs page count — is render per-page, or a fixed floor?**

| book | 1 page | 2 pages | 5 pages | ALL pages |
|---|---|---|---|---|
| faith-alone (155) | 259 ms | 244 ms | 250 ms | 270 ms |
| book 3 fresh (340) | 321 ms | 319 ms | 324 ms | 331 ms |
| book 3 edited (352) | 340 ms | 339 ms | 334 ms | 364 ms |

*(An earlier single-run showed pagination at 58% — that was a cold-JIT artifact of the first
`paginate` call, including the text-measurer warmup. The warm three-book run above is the true shape:
render-dominant, pagination secondary and shrinking as structure improves.)*

## §3 The two constats

**C1 — the PDF render dominates (61–80%); pagination is secondary (16–38%) and shrinks with
structure.** The better-structured the book, the cheaper pagination (72 ms on the edited book vs 187 ms
on faith-alone) and the larger render's share. This restores the older direction (ADR-0041, "~88%
render") after the cold-run false signal.

**C2 (load-bearing) — the PDF render is a FIXED FLOOR, not per-page.** Rendering **1 page costs the
same as rendering all 352** (340 ms vs 364 ms; ≈0.03–0.07 ms/page marginal). The floor (~260–360 ms) is
paid per render regardless of how much changed or is shown — it is font embedding/subsetting
(Gelasio/Inter/JetBrains) + PDFKit document setup + buffer flush, not the drawing of pages. *(This also
tensions PERFORMANCE_SCOPE Option 3's "~75% is doc.text()"; whatever the internal split, rendering
fewer pages does not reduce the time — a decomposition of the floor is owed, §5.)*

## §4 What the constats do to the three candidates

- **(1) visible-page-only — near-zero leverage.** The render is a fixed floor; rendering 1 page instead
  of 352 saves ~10–24 ms. It does not touch the floor, and it does not touch pagination. **Measured
  dead end** through the current PDF renderer.
- **(2) progressive first-page-first — first paint still pays the full floor (~340 ms).** Painting only
  page 1 does not make the first paint instant, because the render floor is fixed even for one page.
  Only helps if the floor itself is cut (and pagination made lazy enough to place page 1).
- **(3) partial repagination — attacks the SECONDARY term (16–38%), already cache-reused on colour-only
  changes.** Even eliminating pagination entirely leaves the ~350 ms render floor standing. **Bounded
  ceiling**, and the hardest to build (ADR-0051 page-owner shifts).

**None of the three presumed candidates attacks the bottleneck.** They all assume the cost scales with
the amount rendered; it does not — it is a fixed per-render floor plus a frontend stack on top.

## §5 The levers the measurement actually points to (for the CTO's verdict, not chosen)

- **(a) Cut the fixed render FLOOR.** A persistent / pre-warmed renderer or font-embed reuse across
  renders. Needs its own decomposition first — how much of the ~350 ms is font subsetting vs doc setup
  vs flush (PERFORMANCE_SCOPE Option 1 measured font *parse* at ~2 ms, but the *embedding* floor here is
  ~300 ms and was never isolated). This is the highest-leverage term the cadrage found.
- **(b) Change the live-preview ARTIFACT so an edit does not repay the PDF floor.** A lighter preview
  surface for the live edit (HTML/canvas reflow), with the PDF reserved for export/download. This is
  the biggest lever but a product+architecture decision that touches fidelity — the Proof must still
  match the exported file (ADR-0050). Its own DR.
- **(c) The frontend stack.** The felt latency is **500 ms debounce + backend render (~350 ms warm,
  ~1.1 s cold) + a full `<embed>` reload** of the whole PDF. The debounce and the wholesale `<embed>`
  swap are frontend and independent of any backend candidate — cheap wins available regardless of (a)/(b).

## §6 Verdicts owed (this cadrage stops here)

1. **The reframe.** The three candidates as posed have low ceilings (§4). Do we **pivot P1** to the
   fixed-floor + preview-artifact levers (§5 a/b/c), or hold to one of the three despite the measured
   ceiling?
2. **Next measurement.** Before choosing a floor-reduction path, decompose the ~350 ms render floor
   (font-embed vs doc-setup vs flush) — authorize that as the next read-only probe?
3. **Preview artifact (§5b).** Is a separate live-preview surface (not the export PDF) in scope for P1,
   or is that a distinct chantier — given it touches the Proof↔export fidelity promise (ADR-0050)?
4. **Frontend quick wins (§5c).** Fold the debounce tuning + incremental `<embed>` swap into P1, or
   split them out?

**Sequence (CTO):** this cadrage → verdicts → (the chosen P1 shape's own DR/correctif) → the
AUTHOR_EXPERIENCE Design Review → mockups → founder validation → construction. **Nothing is coded
before the verdicts above.**
