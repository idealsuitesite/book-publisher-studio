# Performance (S13) — Scope Report, not a Design Review

**Status:** SCOPE REPORT for CTO decision. No production code written. Opens the Performance milestone (`v0.14.0-alpha`).
**Date:** 2026-07-21, grounded in the code on `main` at `b0cfaf0` and in real measurement, not in the ~600ms figure remembered from Sprint 7 Commit 10.
**Purpose (the CTO's brief):** *real measurement of the ~600ms on the corpus first; where the cost comes from in the pipeline (parsing, pagination, PDF rendering itself); what is realistic to optimize without touching the R2 contract we defended this whole thread. Speed must come in addition to the rigour already built, never in its place.*

**Instrument (reproducible):** `backend/spikes/performance-pipeline-spike.ts` — times every stage of `ExportManuscriptUseCase.execute` + `renderBook` on each real corpus manuscript, cold run + warm median of 6, a fresh measurer and renderer per run. Fixed font-parse cost probed separately (method in §4). Run: `npx tsx spikes/performance-pipeline-spike.ts`.

---

## CORRECTION (2026-07-21, before any code) — the pipeline spike over-charged pagination ~4×; the real server is faster and even more render-dominated

**This correction was found by re-reading the wiring (`app.ts:65`) and re-measuring against it (`backend/spikes/performance-hotpath-probe.ts`), before locking any design — the non-negotiable #7 discipline applied to my own spike.** The numbers in §0–§1 below were measured with a **fresh `PdfKitTextMeasurer` per run**. The real server (`app.ts:65`, `:108`) constructs **one** measurer + one `LayoutEngine` at startup and reuses them across every request; only the `PDFRenderer`'s internal `PDFDocument` is genuinely fresh per call (`PDFRenderer.ts:105-116`, PDF docs are single-use). A fresh measurer per run re-parses the fonts *and* starts fontkit's per-font glyph-metrics cache cold across ~40k words; the singleton server pays that once, then measures against a warm cache.

Re-measured on faith-alone with the real singleton wiring (warm median of 10, run 0 discarded):

| stage | §1 spike (fresh/run) | **real server (singletons, warm)** |
|---|---|---|
| **paginate** | 214.9 ms (28%) | **50.1 ms (12%)** |
| **render** (fresh doc each call) | 443.8 ms (58%) | **379.6 ms (88%)** |
| **Proof hot path** (paginate + render) | ~660 ms | **~430 ms** |

**What this changes, and what it does NOT:**
- **Pagination is even cheaper and even more clearly worth keeping.** ~50 ms in production, not 215 ms. The "double pass is fidelity, not waste" conclusion is *strengthened*, not weakened — it is load-bearing **and** cheap, because the singleton measurer's warm glyph cache already amortises it. The mechanism is unchanged; only the misleading number is corrected.
- **Render is ~88% of the interactive Proof latency, not 58%.** The dominance conclusion holds a fortiori.
- **The two R2-safe options' prizes shrink** and must be re-weighed against the honest numbers: reusing pagination on an accent-only refresh (§5 option 2) saves ~50 ms, not ~215 ms; the parsed-font cache (§5 option 1) targets the render-side fresh-doc parse (~20 ms/render, biggest-relative on small books), since the measurer side is *already* amortised by the singleton. See the revised weighing appended to §5.
- **Parse being off the Proof hot path (§0b) is unaffected** — that was a wiring fact, not a timing artifact, and it stands.

The §0–§1 tables below are **left intact as measured** (the fresh-per-run method is legitimate for a cold-process or serverless model, and preserving them shows the reasoning); read them through this correction for the real long-running-server figures.

---

## 0. The headline the CTO needs first: the time is the render tail, and parsing is NOT on the Proof's hot path

Two facts reframe the whole chantier before any option is weighed.

**(a) The ~600ms is real, and it is almost entirely the render tail.** On the largest real book (faith-alone, 39,354 words, 158 pages, kdp-6x9, classic), a warm export is **767ms**, split:

| stage | ms | share |
|---|---|---|
| **render** (PDFRenderer) | 443.8 | **58%** |
| **paginate** (LayoutEngine + PdfKitTextMeasurer) | 214.9 | **28%** |
| parse (Mammoth DOCX→HTML) | 84.3 | 11% |
| normalize (HtmlNormalizer) | 32.4 | 4% |
| typography / applyTheme / build / frontMatter | < 5 total | < 1% |

**render + paginate = 86%.** The render tail (`renderBook`: theme→typography→paginate→render, everything after parsing) is ~660ms, which is the ~600ms ADR-0041 accepted, measured again.

**(b) The living Proof renders the STORED book — parse/normalize/build run once at import, never on a Proof refresh.** The Proof and every export go through `ExportProjectUseCase.execute` → `renderBook(project.book, …)` (`ExportProjectUseCase.ts:41-52`), which renders `project.book`, not the source bytes (ADR-0052). So the interactive latency the CTO named — the Proof re-inking after an edit — is **paginate + render only ≈ 660ms**; parse's 84ms (and its variability, §2) is off that path entirely.

**The consequence for scope:** "make the Proof instant" is a question about paginate + render, not about parsing. Parsing is an *import*-latency concern, separate and lower-priority, and — critically — the one stage whose optimisation would reopen the import-fidelity work this thread spent itself defending (§2, §5 option 4).

---

## 1. Where the cost is, across the whole corpus (measured)

Warm median per stage (ms), kdp-6x9, classic. `cold` = first run (font parse + JIT).

```
file                     words  pages   parse  normalize  build  typography  paginate  render   total   cold
generated-unstyled-3060w 3,060     12     8.6        3.5    0.1         0.3      12.6     54.2    77.9    125
pm-notes-unstyled-fr     1,403      9    28.2        3.7    0.1         0.4      32.7     77.0   150.2    196
art-of-captivating       9,280    109   281.0       38.6    1.1         6.7     165.7    304.6   804.3    827
faith-alone-styled      39,354    158    84.3       32.4    0.4         4.0     214.9    443.8   767.0    834
```

Two structural facts this table carries:

- **The double PDFKit text pass is the R2 contract, not waste.** `paginate` prices every block by measuring it with `PdfKitTextMeasurer.heightOfString` (`PdfKitTextMeasurer.ts:24-31`); `render` then re-draws every block with PDFKit. That is the same-font, same-metric double pass that makes *charged == consumed* exact (LAYOUT_FIDELITY Decision 6; ADR-0051). It is the reason the parity numbers hold. **The 215ms of pagination is load-bearing fidelity — it cannot be cut for the same book+layout+theme.** This is the single most important sentence in the report for keeping speed from eating rigour.
- **The cost is content-bound (word count), not purely page-bound.** The per-layout sweep on the same book:

```
layout        pages   paginate   render    total
letter           90      199.2    411.5    721.8
a4               84      230.9    378.4    737.3
a5              186      200.1    431.5    740.9
kdp-5x8         238      229.4    484.8    853.6
kdp-5.5x8.5     190      203.8    408.5    723.9
kdp-6x9         158      202.8    400.7    715.1
```

Total stays flat (715–854ms) while page count swings 84→238, because the dominant work is measuring and drawing the *same ~39k words*. So there is no "fewer pages = faster" lever; a speed win has to come from doing the per-word work less often or from fixed overhead, not from page geometry.

---

## 2. What is and isn't on the interactive hot path

- **Import path — runs once per manuscript:** parse → normalize → build → frontMatter. Parse is the variable one: **281ms on the 92 KB list-dense `art` book** vs 84ms on the 2.9 MB faith-alone — cost tracks Mammoth's list/table conversion, not file size or word count. This is real, but it is paid once at import and stored.
- **Proof / export hot path — runs on every refresh:** theme → typography → paginate → render, over the already-parsed stored book. ~660ms on the big book, dominated by render.

**Therefore:** parse optimisation improves *import* latency only, and it means touching `MammothParser`/`HtmlNormalizer` — the exact surface Import Fidelity (ADR-0049) and the fidelity doctrine (ADR-0050) hardened. Off the Proof hot path and fidelity-sensitive: the wrong place to start.

---

## 3. The R2 boundary — what a speed change may NOT cost

The contract this whole thread defended: the model charges a block exactly what the renderer consumes (Decision 6), and the renderer never breaks a page on its own initiative (ADR-0051), with the parity test locking real page counts. Any optimisation is admissible **only if it leaves the PaginatedBook geometry and the rendered bytes identical** for a given (book, layout, theme). Concretely:

- Removing or approximating the pagination measurement — **forbidden** (breaks charged==consumed silently; exactly the drift RENDER_DRIFT closed).
- Reusing a *cached* PaginatedBook — **admissible only when every geometry input is unchanged**; the cache key is the safety proof.
- Changing font handling — **admissible only if the font bytes are identical** (same glyphs, same metrics → byte-identical output; the visual baseline is the test).

---

## 4. The fixed overhead nobody is charging for (measured)

Fonts are registered per `PDFDocument` and parsed on first use, with **no module-level cache** (`PdfFontRegistry.ts:86-93` — `registerAll` re-registers all faces into each fresh doc). Probed cost:

- `new PdfKitTextMeasurer()` (doc + register 12 paths, no parse): **2.9 ms**
- first `heightOfString` (parse 1 face): **+2.7 ms/face**
- fresh doc + registerAll + use 4 faces: **22.7 ms**

A real export builds **two** documents that each parse the faces they use (the measurer during paginate, the renderer during render) → **~40–50 ms of pure font parsing per export**, repeated on every Proof refresh. It is ~6% of the big book but **over half of a small-book render** (the 3,060-word book is 78ms warm) and it is paid on *every* interactive refresh. This is fidelity-neutral by construction — the font bytes are identical whether parsed once or a thousand times.

---

## 5. A decision menu for the CTO (options, not a recommendation-disguised-as-a-plan)

1. **Parsed-font cache (fixed-cost, fidelity-neutral, R2-free).** Cache the parsed font data at module scope so the measurer's doc and the renderer's doc reuse it instead of re-parsing per request (PDFKit accepts a font `Buffer`, so the .ttf bytes are read/parsed once process-wide). Saves ~40–50 ms per export, biggest *relative* win on small books and on the interactive Proof loop. **Guard:** the visual baseline stays byte-identical (same glyphs, same metrics) — that is the whole proof it changed nothing but speed. Smallest blast radius, touches neither the model nor the parity contract.

2. **Pagination reuse across colour-only Proof refreshes (R2-safe by a proven invariant).** The per-project accent override is colour-only and geometry-invariant — MINI_DR_PER_THEME_ACCENT proved *both ways* that changing the accent leaves the page count identical. So when only `accentOverride` changes, the PaginatedBook can be reused and only `render` re-run, saving the ~215ms `paginate` (28%) on precisely the Layout-station accent-tuning loop. **Guard:** the cache key must include *every* geometry input (book `updatedAt`, `themeName`, `layoutName`) so a real structure/theme/layout change never reuses a stale plan — the key is the R2 safety argument, and it must be a test.

3. **Render micro-optimisation (largest slice, hardest to cut safely).** `render` is 58% and inherent — PDFKit draws every text run. Candidate wins (redundant `doc.font()`/`fontSize()` state changes, keep-with-next re-measurement) carry **real R2 risk** because they touch the parity-locked renderer. **Recommend NOT now** without its own targeted measurement and mini-review; it is the opposite of the low-risk paths above.

4. **Parse optimisation (Mammoth) — deferred by §0/§2.** Off the Proof hot path, helps import latency only, and means touching the import-fidelity surface. The 281ms `art` outlier is real and worth a *measurement* someday, but changing Mammoth's conversion is the highest-fidelity-risk move on the board. Recommend leaving it until a real user reports import latency, not export/Proof latency.

5. **Perceived performance, not raw speed (a UX answer).** A progressive/streamed Proof (first pages visible before the whole PDF finishes) or a skeleton state would make the ~660ms *feel* instant without touching the render tail at all. Its own small design question; noted so the menu isn't only "make the number smaller".

### Revised weighing after the CORRECTION above (2026-07-21)

Read the menu with the real singleton-server numbers, not the fresh-per-run ones:

- **Option 1 (parsed-font cache) — CLOSED ON EVIDENCE (2026-07-21, `backend/spikes/pdfkit-font-cache-spike.ts`).** The spike was made a hard prerequisite (below) and it refuted the option. PDFKit 0.19.1's *only* font-parse entry is `fontkit.create` (source `js/pdfkit.js:2791-2795`; a cached `Buffer` is a `Uint8Array` and still hits it — passing a Buffer does not avoid the parse). Measured, `fontkit.create` costs **~0.1–0.5 ms/face, ~2 ms total** — so a parse cache saves **at most ~2 ms/render, <0.5%**. The ~20 ms/doc this report earlier called "font parse" is per-document **glyph layout + subset embedding**, intrinsic to emitting a fresh PDF and *not* removable by a font-buffer/parse cache. The prize is near-zero; the option does not merit a Design Review. (Byte-identity, the safety question had the prize been real, is therefore moot.) Closed the same way as `HEURISTIC_STRUCTURE_DETECTION` — on measurement, not for want of an idea.
- **Option 2 (pagination reuse on colour-only refresh):** the reused artifact costs **~50 ms**, not ~215 ms. Still R2-safe by the proven accent invariant, but the prize is now small in absolute terms — worth it mainly because the accent picker is a *drag-to-tune* control (many refreshes in a row), where 50 ms × N adds up and the reuse is provably free. **Prize: small per-refresh, R2-safe, justified by refresh frequency not by single-shot size.**
- **The Option-1 spike was run first (process rule: a decision resting on a third-party library's real capability needs a spike first) and it CLOSED the option** — see the Option-1 bullet above and `backend/spikes/pdfkit-font-cache-spike.ts`. PDFKit re-parses via `fontkit.create` regardless of source, and that parse is only ~2 ms/render, so the option collapsed to near-zero exactly as the corrected weighing anticipated. **Only Option 2 survives to a Design Review.**

**What this report asserts, and stops at:** the export time is the render tail, not parsing (§0); the Proof's interactive latency excludes parse entirely because it renders the stored book (§0b, §2); the pagination measurement is load-bearing fidelity and must not be cut for the same inputs (§1, §3); the two genuinely R2-safe levers are the parsed-font cache (option 1) and colour-only pagination reuse (option 2), the first fidelity-neutral and the second safe by an already-proven invariant; render itself (option 3) is the biggest slice but the one with real R2 risk and should wait for its own measurement; and parse (option 4) is off the hot path and fidelity-sensitive. The scope decision — which options, and whether this is one Design Review or several — is the CTO's.

---

## Evidence index (all on `main` at `b0cfaf0`)
- `backend/spikes/performance-pipeline-spike.ts` — the per-stage instrument; all §0/§1 numbers.
- `ExportManuscriptUseCase.ts:34-71` — `execute` (parse→normalize→build→frontMatter) + `renderBook` (theme→typography→paginate→render); the stage boundaries timed.
- `ExportProjectUseCase.ts:41-52` — Proof/export render the **stored** `project.book` (ADR-0052); parse is not on this path.
- `PdfKitTextMeasurer.ts:24-31` — pagination prices every block via PDFKit `heightOfString` (the R2 measurement pass, Decision 6).
- `PdfFontRegistry.ts:86-93` — `registerAll` re-registers per document; no module-level parsed-font cache (the §4 fixed cost).
- `PDFRenderer.parity.test.ts` (ADR-0051) — the locked page/reconciliation numbers any render or pagination change must leave untouched.
- `MINI_DR_PER_THEME_ACCENT.md` — accent is colour-only and geometry-invariant (the proof underwriting option 2).
- ADR-0041 (`DECISIONS.md`) — the ~600ms render accepted, now re-measured and attributed.
- ADR-0050 / ADR-0051 / LAYOUT_FIDELITY Decision 6 — the fidelity contract §3 forbids trading for speed.
