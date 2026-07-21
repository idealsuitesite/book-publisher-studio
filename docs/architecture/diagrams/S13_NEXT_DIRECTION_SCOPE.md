# Performance (S13) — next-direction illumination report (ordering, not design)

**Status:** ILLUMINATION REPORT for a CTO ordering decision. **No code, no branch, no Design Review.** Deliberately shorter than a scope report — the goal is to choose the order of three candidates with the same criteria used at every fork this session (real cost, R2 risk, value for the vision: reliable automation + verifiable fidelity, not cosmetic), not to design any of them.
**Date:** 2026-07-21, grounded in code read on `main` at `2c1be0f` and in this session's measurements — nothing new investigated beyond confirming the one question below.
**The candidates (CTO's numbering):** (1) targeted render measurement (PDFKit, ~380ms/88% of the refresh, the R2-locked component); (2) perceived performance (progressive/skeleton Proof, `PERFORMANCE_SCOPE.md` §5.5); (3) the "Part" level (`PART_LEVEL_STRUCTURE`, a structure chantier, not performance).

---

## 0. The specific question, checked first: does "perceived-perf is lower-risk than render measurement, and may suffice" hold?

**Partly — and the part that fails should change how we lean on it.** Two facts, both verified in code, not assumed:

1. **The measurement of the render is itself read-only and R2-safe.** The risky thing about candidate 1 is *acting* on the render, not *measuring* it. A render-decomposition spike changes nothing and cannot break parity — so "perceived-perf vs render measurement" is not risk-symmetric the way the framing suggests: the measurement is as safe as reading code, and it is the only thing that tells us whether candidate 1 even *has* a safe target before we commit to anything.
2. **The low-risk perceived-perf win is already shipped.** `PreviewPanel.tsx` already keeps the previous proof visible and dims it while a new one renders (lines 137–146 — "re-inking, never a blank flash"), and shows a pulse skeleton on first load (lines 147–151), with a `runId` guard so the proof never goes backwards. The classic "no blank flash / skeleton / keep-previous" moves — the sense-of-speed the intuition is reaching for — **exist today.** What remains under §5.5 is only *true* progressive rendering (page 1 visible before the whole PDF finishes), and that needs the backend to **stream** the PDF page-by-page — which reaches back into the render path, undercutting the very "doesn't touch the sensitive component" premise.

**So the intuition holds on the narrow claim (a frontend-only perceived-perf change is lower R2 risk than optimizing the renderer) but is a weak basis for ordering:** the cheap perceived-perf gains are already in the product, and the remaining one is not frontend-only. Meanwhile the *safe, cheap, decision-informing* first move is the render **measurement** (read-only), which the framing miscasts as the risky option. Verify-before-leaning: the intuition should not, on its own, push perceived-perf to the front of the queue.

*(Side note, not a candidate: the Proof refresh carries a deliberate 500ms debounce before it even starts rendering — so the accent drag-tune loop feels ~500ms + ~430ms, and the pagination-reuse win we just shipped saves ~50ms of that. Relevant only as context for how much "felt speed" is actually on the table.)*

---

## 1. The three candidates at a glance

| | Investigation cost | Apparent R2 risk (before digging) | Dependency | Value for the vision |
|---|---|---|---|---|
| **1. Render measurement** (PDFKit, ~380ms) | **A measurement + a code read.** A render-decomposition spike (text draw vs font ops vs page setup vs header/footer vs the addPage reconciliation) + reading `PDFRenderer`'s hot loops. Moderate. | **Measuring: zero** (read-only). **Acting on it: the highest on the board** — `PDFRenderer` is the parity-locked component (`PDFRenderer.parity.test.ts`, ADR-0051, charged==consumed). | Independent. It is the prerequisite to *ever* touching candidate-1-the-optimization, and the only one that could buy **real** (not felt) speed on the dominant cost. | **Medium–high, but gated:** real speed serves large-file/automation throughput — *if* the measurement finds a safe sub-target. It may find none (much of 380ms is inherent glyph drawing PDFKit must do). |
| **2. Perceived performance** (§5.5) | **Mostly a code read** (frontend Proof delivery — done: see §0) + a small design question. Low. | **Lowest — if frontend-only.** But the only *remaining* perceived-perf move (true streaming) needs backend PDF streaming, which re-enters the render path. | Independent. | **Lowest — closest to cosmetic**, and the non-cosmetic frontend part is already built. Masks latency; does not reduce it (irrelevant to automation throughput or large-file reality). |
| **3. "Part" level** (`PART_LEVEL_STRUCTURE`) | **A code read + likely a small spike.** Read `Book.ts`, `StructureEditor`/`BookEditingService` (does the `promoteToChapter` pattern extend?), and the three render consumers (pagination/TOC/running-heads); a spike to measure geometry impact. Read-heavy, largest surface. | **Real but different in kind:** it adds *new geometry* (a Part title page, Part in the TOC, Part in running heads) that pagination must accommodate — it touches the render's **input**, not PDFKit internals. Shifts page counts. Mitigable with the additive/byte-identical-when-absent discipline already used for editorial-part placement (`orderByRole` was a no-op untagged). | Independent of the perf work entirely (structure, not performance). | **Highest:** a confirmed category-standard capability gap (three independent sources; Atticus/Vellum both ship it), direct product/structure value, serves the "author rebuilds their book by hand" automation story. Not cosmetic. |

---

## 2. What this implies for ordering (options for the CTO, not a decision)

- **The risk ranking and the value ranking point opposite ways.** Least R2 risk: perceived-perf < Part < render-optimization. Most vision value: Part > render-speed > perceived-perf. Ordering on risk alone would put the most cosmetic, already-largely-built item first; ordering on value alone would put the largest-surface structure chantier first. The honest tiebreak is the third column: the render **measurement** is cheap, read-only, and *informs* whether candidate 1 is even viable — so it is the one move that reduces uncertainty for the whole S13 direction at almost no cost.
- **Two clean, defensible sequences** (both consistent with this session's method):
  - **"Know before you touch"**: do the render **measurement** first (read-only, ~a spike), purely to learn whether Option 3 has a safe target. If yes → its own scoped review later; if no → close Option 3 on evidence like the font cache, and Performance (S13) is effectively *done* for now. Then **Part level** as the next real chantier (highest vision value, independent).
  - **"Follow the vision"**: treat S13 as having delivered enough (Option 2 shipped, Option 1 the font-cache closed), and open **Part level** now as the next big chantier — leaving the render measurement as a named, ready follow-up for when perceived or real Proof speed is actually reported as a problem.
- **Perceived-perf (§5.5) is not recommended as a standalone next chantier** on this evidence: its cheap win exists, and its remaining win is not the low-risk thing it appears to be. Better folded into a future Proof/streaming review *if* real speed work happens, than opened for its own sake.

**What this report asserts, and stops at:** the intuition holds narrowly (frontend perceived-perf is low-risk) but is a weak ordering basis because the cheap perceived-perf win is already shipped and the render *measurement* — miscast as the risky option — is actually the cheap, safe, decision-informing move; the risk and value rankings invert, so the tiebreak is the read-only render measurement; and the "Part" level is the highest-value independent chantier whenever structure is chosen over performance. The order is the CTO's call.

---

## Evidence index (all on `main` at `2c1be0f`)
- `frontend/components/PreviewPanel.tsx:137-151` — the Proof already keeps-previous-and-dims + first-load skeleton (§0.2); `:39` the 500ms refresh debounce.
- `PERFORMANCE_SCOPE.md` §0/§5.5 — the ~430ms hot path (render ~88%), and the progressive/skeleton idea; `performance-hotpath-probe.ts` the render number.
- `PDFRenderer.ts` + `PDFRenderer.parity.test.ts` (ADR-0051) — the parity-locked component candidate 1 would touch.
- `MINI_DR_EDITORIAL_PLACEMENT.md` / `orderByRole` — the additive, byte-identical-when-absent precedent a Part level would follow for its geometry.
- `docs/TODO.md` → `PART_LEVEL_STRUCTURE` — the backlog entry and its three sources.
