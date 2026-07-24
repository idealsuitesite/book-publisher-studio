# INCREMENTAL_RENDER — candidate 1 (visible-region render) Design Review

**Status: BUILT on `feat/incremental-render`, JUDGED GREEN, AWAITING THE FOUNDER TASTE-STOP → then CTO merge (2026-07-24).** The six-commit sequence (§6) is complete and pushed on `feat/incremental-render`; `main` is untouched. The judge (§3) is green on every mechanical point — on the FOUNDER'S EDITED book 3 (`…d7bticjiw`, v34, 32 chapters, a5/classic/comfort, 445 pages — his real gesture, reconciled from the original `…cy7m12l0w` v22 copy the cadrage/DR had measured): engine **155 ms ≤ 300 ms** hot (region render 31 ms, paginate 122 ms the heavy term; full 650 ms → **4.2×**), page-region ≡ page-export on the three pages (faith-alone Novel drop-cap p23 + book-3 median 224 + book-3 continuation p4; DR-named p171 still clean and green), scroll preserved across a re-ink (jsdom + real-Chromium Playwright), a11y text layer selectable (asserted), backend 921 / frontend 234 / tsc / eslint / builds, and verify-real-* 4/4·16/16·4/4 on a throwaway server. **Point 6, the founder taste-stop on the living studio, is the founder's and is PENDING** — nothing ships to `main` before it. **CANDIDATE 3 stays consigned second-order (D5): the whole engine is under budget hot, so pagination — the heavy ~122 ms term — did NOT break the budget; the re-measure did not trip its trigger.** *(Original DR text below, unchanged; it was CTO-approved at gate 2 and the branch was created at that gate, as the preventive rule requires.)*

**Prior status: DR — AWAITING CTO APPROVAL (gate 2 / non-negotiable #4). No branch, no code.** The branch is
created at CTO validation of this DR (the preventive rule). P1 of the AUTHOR_EXPERIENCE Axis-7 sequence,
after P2 (`BATCH_CONFIRM_LATENCY`, merged `712057e`).

**The measured foundation (not assumed):** the cadrage + its V2 arbitration + the two authorized probes,
all in `INCREMENTAL_RENDER_SCOPE.md` (§7 arbitration, §8 probes). The load-bearing numbers this DR is
built on: render **scales with content**, doc.text-dominated (§7); a real median region of book 3 renders
in **~20 ms vs 402 ms full (~20×)** (Probe 1); the decomposed engine budget drops from **~534 ms (over)
to ~111 ms (under the 300 ms threshold)** with candidate 1 (§8). The CTO's threshold: **engine
contribution of "edit → visible" (paginate + region render + transfer + paint, EXCLUDING the 500 ms
debounce) ≤ 300 ms hot on the edited book 3.**

**Objective (unchanged, engraved):** criterion A (fluidity) must be reachable by the ENGINE before the
AUTHOR_EXPERIENCE DR draws a promise. This DR makes the living Proof update fluidly — in milliseconds AND
without the author losing their place.

---

## §1 The invariant — page-region ≡ page-export (ADR-0050/0051, first class)

**A page N rendered in a region MUST be identical to page N of the full export** — text, geometry, page
number, running head. A region page that diverges from the exported file is a structural lie to author B
(ADR-0050: fidelity is the product; ADR-0051: the renderer never breaks a page on its own).

**How the design makes this free by construction — the crux the probes sharpened.** The region render
**draws from the FULL `PaginatedBook`'s `Page` objects**, never a re-paginated sub-book. Full pagination
(already the source of truth, already cached — `MINI_DR_PAGINATION_REUSE`) owns the block→page
attribution, the true numbers, the running heads, the splits. The partial render takes `pages[N-1 … N+w]`
from that same `PaginatedBook` and draws each page's blocks with that page's own context — the identical
per-page inputs the full render uses. Same code path per page, same inputs ⇒ same output. *(The Probe-1
naive truncation numbered from page 1 precisely because it re-paginated a sub-book; the real design does
not — it reuses the full pagination.)*

The invariant is verified, not trusted (`SOLO_RENDER_VERIFICATION` discipline): extract page N from a
region render and from the full export and assert identity of text, geometry and number.

## §2 The decisions (in the CTO's order of importance)

### D1 — Page-true fidelity architecture (the spine)
- **New capability, in the renderer, not the model:** `renderPageRange(paginated: PaginatedBook, range:
  [number, number]): Buffer` — iterate the full book's `Page` objects in `range`, draw each page's blocks
  (resolved by id from the book) using that `Page`'s `number`, `runningHead`, `blankPagesBefore`, and
  split state. ADR-0001 holds: the **Book is untouched**; the **Page model already carries every field**
  needed (Probe 1 confirmed) — the design GROWS the renderer's entry point and reuses the existing
  per-block drawing (`renderBlock`), it does not grow or bypass the model.
- **The one real technical risk — the continuation split-tail y-origin.** When a region starts on a
  `startsWithContinuation` page, its first block is the TAIL of a paragraph split on the previous page;
  the render must resume that paragraph at line `splitAfterLines(prev)+1`, at the page top. Today the full
  render reconstructs this from `splitSegments`/`continuationPages` built over all pages; the range render
  must reconstruct the same split state at the region's leading boundary. **This is where a lie would
  hide, so the judge tests a continuation page explicitly (§3).**
- **Judge (part of the chantier judge, §3):** page-region ≡ page-export on **two** pages of the edited
  book 3 — a clean median (page 171) AND a continuation page.

### D2 — The display surface (decision criterion: continuity of the gaze FIRST, cost second)
**Losing scroll/zoom on every edit is a criterion-A violation, not a cosmetic one** — fluidity is
milliseconds AND the continuity of the author's gaze (CTO). Options, judged on continuity first:
- **Region-PDF in `<embed>`** — render only the visible pages to a small PDF, embed it. **Fails the
  continuity criterion:** Probe 2 (constat B) proved `<embed src>` swaps reset the plugin (no page API,
  `contentDocument` null) — the author's scroll/zoom is lost every edit. Rejected on the primary criterion.
- **PDF.js canvas — RECOMMENDED.** Render the real region-PDF's page(s) to a canvas the app controls, so
  an edit repaints only the changed page's canvas and the author's scroll/zoom are preserved. **Fidelity
  stays free** — it paints the bytes of the *real* render (same PDF), so this is NOT V3's feared divergent
  artifact; it is the real export, displayed page-wise.
- **New dependency ⇒ spike-gated (ADR-0053 precedent).** PDF.js is locked only after a throwaway spike
  proves, in THIS React 19 / Next 16 install: it renders our real PDF faithfully (a page painted via
  PDF.js is visually identical to the native viewer), performs, and clears the a11y bar. If the spike
  fails, the DR reopens D2.

### D3 — Window policy (a product decision, dimensioned against the budget)
When the author scrolls out of the rendered region: **render the visible page ± a small neighbour window,
render-on-scroll beyond it.** Each neighbour page costs **~10 ms** of draw (Probe 1 marginal), so a window
of visible ± 2 (5 pages) ≈ ~70 ms — comfortably under budget. **Proposal:** eager-render visible ± 1–2,
render-on-scroll (debounced) past the window. The margin is large, but **the window size is spent by
decision, not by drift** — the DR fixes it as a measured, revisable value.

### D4 — V4 (frontend) folded in
- **Debounce:** keep `REFRESH_DEBOUNCE_MS = 500` as the measured-reasonable default, **consigned revisable
  at the founder taste-stop** — it is the pure-feel knob (the only P1 element the founder's screen judgment
  may reopen).
- **Swap mechanism:** chosen in D2 (PDF.js per-page canvas repaint replaces the whole-`<embed>` reswap).
  This IS the frontend correctif of V4; "incremental `<embed>` swap" becomes "PDF.js canvas repaint."

### D5 — The pagination cache, articulated
A **content** edit misses the pagination cache by construction (`md5(book)` changes) → **~72 ms paid** on
book 3. The DR states it plainly; **the budget absorbs it** (72 + 20 + transfer + paint ≈ 111 ms ≤ 300).
Colour-only changes still hit the cache (existing behaviour preserved). **Candidate 3 (partial
repagination) stays consigned second-order** — opened ONLY if a post-construction re-measure shows
pagination is the term breaking the budget on a real gesture. Not built now.

## §3 The chantier judge (the CTO's final gate)
1. **Engine ≤ 300 ms** on the real gesture (edited book 3), excluding the debounce.
2. **Page-region ≡ page-export** (text, geometry, number, running head) on **two** pages: the clean median
   (171) AND a continuation page (D1's split-tail case).
3. **Scroll/zoom preserved across an edit** (D2's continuity criterion, proven in a real browser — the
   Playwright discipline of ADR-0053).
4. **Accessibility (commit-4 gate, CTO):** the PDF.js surface renders the standard **text layer** — the
   page's text is **selectable / exposed to screen readers**, asserted by test. Canvas-only would render
   the book mute to screen readers and text selection — serving author B by excluding some author B's.
   The requirement carries a test, not only a sentence.
5. **Invariants + full harnesses:** backend + frontend suites, tsc, eslint, builds, `verify-real-*`
   (throwaway server, zero trace, store baseline 8).
6. **Founder taste-stop: YES** — the felt fluidity of the living studio is criterion A itself; the founder
   judges on the screen, not on our numbers. His validation on the living studio is the last gate.

## §4 Scope boundaries
- **IN:** the `renderPageRange` capability (D1), its API, the PDF.js canvas display (D2, spike-gated),
  window policy (D3), V4 debounce (D4).
- **OUT:** cold render (`COLD_RENDER_FIRST_OPEN` — welcome problem); candidate 3 (second-order, consigned
  D5); V3's divergent preview artifact (dead — PDF.js of the real PDF is not divergent).
- **New dependency:** PDF.js — spike-gated, dependency locked only after the feasibility spike (ADR-0053).

## §5 Disclosed reserves
- **The `<embed>` ~26 ms carries an asterisk** (CTO): it is the `<embed>` load event, not necessarily the
  full progressive paint — the native viewer loads lazily, so the figure may under-state real paint. No
  verdict consequence (this term is not the bottleneck in either reading), but recorded honestly.
- **n = 2 confirmed** (CTO): the fidelity judge runs on book 3 (median 171 + a continuation page — book 3
  has the long split paragraphs) AND faith-alone (clean median + a Novel drop-cap page, crossing the
  spike's hard-page requirement).

## §5bis PDF.js feasibility spike — GREEN (2026-07-23, `INCREMENTAL_RENDER_SCOPE.md` will carry the run)
**Verdict: GREEN — dependency feasible, locks at commit 3.** pdfjs-dist **6.1.200** (Mozilla, mature),
loaded as ESM from the local build + worker in this env, painted the two HARD pages the CTO required
(Decision 1): a book-3 **Gelasio** body region and a faith-alone chapter opening with the **Novel 2.5
drop cap**. Both faithful — embedded Gelasio (serifs, citation italics), the drop cap at correct
scale with the locked accent `#6E3B2F`, our running heads. Warm canvas **~70 ms/page** (one-time
~105–132 ms worker init). **The tell that matters — font SUBSTITUTION — is closed** (a fallback font
would show wrong serifs; it does not). **Disclosed limitation (CTO-accepted):** the side-by-side vs the
NATIVE viewer was **not capturable** — the native PDF plugin surface does not composite for the
screenshot tool; this is an **instrument limitation, not a fidelity signal.** Fidelity is established by
(a) the substitution tell above, (b) the chantier's real guarantee — the byte-level invariant
page-region ≡ page-export (stronger than a screenshot), and (c) the founder's final taste-stop on the
living surface.

## §6 Proposed commit sequence (built only after approval; branch at the gate)
1. **Backend — `renderPageRange` + the fidelity invariant.** Draw from the full `PaginatedBook`'s pages;
   the invariant test asserts page-region ≡ page-export on the median AND a continuation page of book 3
   (the split-tail case). The load-bearing commit.
2. **Backend — the region-render API** (a page-range export for a project), whitelisted + route tests in
   the same commit (the standing `setPartRole` lesson).
3. **Frontend — lock the PDF.js dependency** (the feasibility spike is DONE and GREEN, §5bis; `npm i
   --save pdfjs-dist@6.1.200` — the deliberate lock act, ADR-0053 precedent).
4. **Frontend — the PDF.js canvas display** replacing the whole-`<embed>` reswap: incremental per-page
   repaint, scroll/zoom preserved (proven in a real browser), **and the standard text layer** so the
   page text is selectable / screen-reader-exposed (§3 judge point 4, asserted by test).
5. **Frontend — window policy (D3) + V4 debounce (D4).**
6. **The judge (§3) + docs reconciliation.** Engine ≤ 300 ms, page identity on both pages, scroll
   preserved, full harnesses — then the founder taste-stop on the living studio.

**On approval, this sequence is built in autonomy (cadence directive), gated commits, the branch created
at the gate. The three self-stops apply. Nothing before the CTO's word on this DR.**
