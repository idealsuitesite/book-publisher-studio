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

> **⚠ C2 IS RETRACTED — it was an instrument artifact (see §7, the V2 arbitration, 2026-07-23).**
> `PDFRenderer.renderContents` draws `content.content` (EVERY block); it consults `book.pages` only for
> page-break placement and headers. **Slicing `book.pages` never reduced the drawn content**, so the
> flat 1-page-vs-352 curve measured page-metadata, not per-page render cost. The honest curve (truncate
> BOOK CONTENT) shows render **scales with content** and Option 3's "doc.text() dominates" is the
> surviving truth. C2's conclusion is FALSE; §7 carries the corrected finding. Kept here, struck, so
> the error and its correction both stay on the record.

## §4 What the constats do to the three candidates
> **⚠ §4 IS SUPERSEDED by §7 (V2 arbitration).** Its verdicts rest on the retracted C2. With the honest
> curve, candidate 1 (visible-region) and 2 (progressive) are **viable, ~8× leverage** — not dead.
> Read §7 for the corrected reading. §4 is kept struck, on the record.

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

---

## §7 V2 arbitration — the instrument that lied, and the corrected picture (2026-07-23)

**The CTO's V2 required the arbitration first: the older Option-3 spike ("~75% doc.text()") and this
cadrage's C2 ("fixed floor, 1 page ≈ 352 pages") cannot both be true — one instrument lied. Naming it
was the condition on any floor-reduction work.** Instrument: `backend/spikes/render-floor-decomposition.ts`.

**The liar is C2's page-slice — named by reading the renderer.** `PDFRenderer.renderContents`
(`PDFRenderer.ts:417/457`) draws `content.content` — EVERY block of the book — and consults
`book.pages` only for page-break placement and headers/footers. So slicing `book.pages` to `[0]` left
**all** the text drawn; the flat 1-page-vs-352 curve measured page-METADATA, not content. C2 proved
nothing about per-page cost. **Option 3 is vindicated.**

**The honest curve — truncate BOOK CONTENT (K chapters), split content-draw vs finalize (`doc.end`):**

| K chapters | pages | total | **content-draw** | finalize (font subset+zlib) | doc.text calls |
|---|---|---|---|---|---|
| 1 | 3 | 35 ms | **30 ms** | 5 ms | 19 |
| 2 | 5 | 36 ms | **30 ms** | 6 ms | 35 |
| 4 | 32 | 100 ms | **88 ms** | 11 ms | 210 |
| 8 | 67 | 187 ms | **165 ms** | 22 ms | 463 |
| 18 (full) | 155 | 282 ms | **248 ms (88%)** | 35 ms (13%) | 1166 |

- **Content-draw dominates (88%) and SCALES with content** (doc.text calls 19 → 1166). Fitting the two
  ends: content-draw ≈ **26 ms fixed** (font load/registration) **+ ~0.19 ms per text call**.
- **Finalize (font subset + zlib) is small (~13%, ~35 ms)** and scales mildly — it is NOT the ~350 ms
  floor C2 imagined.

**The correction reverses §4.** Rendering only the **visible region** (~1–2 pages ≈ 20–40 blocks) costs
≈ **26 ms fixed + ~5 ms + ~5 ms finalize ≈ 36 ms**, versus **282 ms** for the full book — **~8×**. So:
- **Candidate 1 (visible-region render) — VIABLE, ~8× leverage.** Draw only the visible page's blocks.
- **Candidate 2 (progressive first-page) — VIABLE.** First page ≈ 36 ms → a genuinely fast first paint.
- **Candidate 3 (partial repagination) — the SECOND-ORDER term.** Once render is incremental, pagination
  (16–38%, and cache-reused on colour-only) becomes the largest remaining backend cost on a content change.

**The catch (for the DR, not decided here):** to draw only the visible region the renderer must (a) know
which blocks fall on the visible page (from pagination — still whole-book unless made incremental) and
(b) draw only those. The ~26 ms font-load fixed cost is paid regardless. So the incremental-render budget
is roughly **pagination (cached ~0 / content-change ~70–190 ms) + visible-region draw (~36 ms)**.

### The felt-stack budget (V2 requirement 2) — "edit → visible" on the founder's real gesture

The final threshold is judged against the TOTAL, not the backend floor. Terms, each sourced:

| term | value | source | cut by an incremental/visible render? |
|---|---|---|---|
| debounce | **500 ms** | `PreviewPanel.tsx` `REFRESH_DEBOUNCE_MS` (frontend constant) | no — frontend tuning (V4) |
| paginate | ~70–190 ms (content change); ~0 cached (colour-only) | measured (§2) | candidate 3 |
| PDF render | ~282 ms full / **~36 ms visible-region** / ~1.1 s cold first-call | measured (§7) | **yes — candidates 1/2** |
| HTTP + PDF transfer | part of the ~730 ms round trip earlier measured (defect 6) | FOUNDER_TRAVERSAL Lot-1 | yes — a visible-region PDF is far smaller |
| `<embed>` reload | the browser re-parses/paints the WHOLE multi-hundred-page PDF blob | `PreviewPanel.tsx` `<embed src=blobUrl>`; browser term — needs a browser probe to isolate | yes — a small PDF parses/paints far faster |

**The reading:** a visible-region incremental render cuts the **largest backend term (render)** AND
shrinks the **frontend transfer + `<embed>` reload** (a 1–2 page PDF vs 155 pages) — it is the single
lever touching the most of the budget. The debounce (500 ms) is a fixed frontend floor on its own
(V4). The `<embed>`-reload term is the one still needing a browser measurement to size exactly.

### Consequence for the CTO's V1–V4 (reported, not acted on — #7, stop (a))

**V1 as issued ("pivot; the three candidates are dead; consign the reversal") rests on the retracted
C2.** The arbitration shows candidates 1/2 are viable (~8×), so I have **NOT** consigned a
"three-dead-candidates" reversal — that would engrave a measured-false claim. **This is #7 applied to
the V1 verdict itself; I stop and report for a re-verdict** rather than build on it. V2's decomposition
(this §7) is complete; V3 (preview artifact) is even more clearly deferrable — the PDF-as-preview
survives if a visible-region render holds the budget, so fidelity stays free by construction; V4
(frontend debounce/`<embed>`) stands unchanged and is confirmed by the budget as real, independent
latency. **Owed: the CTO's re-verdict on the corrected picture before any P1 build or branch.**
