# Layout Fidelity — Gutter, Recto/Verso, and the One True Page Count — Level 2 Design Review

**Status:** 🔵 **ROUND 2 — Phase A implementation CTO-authorized (2026-07-18 evening: "qu'on les implémente immédiatement avant de passer au Commit 5"). Questions 1–4 locked below. Phase B (line splitting, widows/orphans) designed here, implemented next.**
**Round 2 trigger:** the CTO exported a **real book** and reported systematic underfill — pages ending more than half empty (pp. 5, 6, 9 of their export), a chapter title ("3. Faith Is a Gift From God") alone above a huge blank, and an apparent "ça dépasse → nouvelle page" strategy. They asked for the responsible component, the reason, and algorithm-vs-library-vs-parameters — **before any fix**. §2bis answers all of it with measurements.
**Date:** 2026-07-18
**Trigger:** two defects that share one root. **ADR-0043** (OPEN): `PageLayout` has no gutter, so every paperback this product generates runs text into the binding. **ADR-0045**'s deeper issue, deliberately left open there: renderers emit pages (title, copyright) that `LayoutEngine` never models, so pagination is not a model of the document — it is a model of *part* of it.

The shared root, named plainly: **`LayoutEngine` does not know what a book physically is.** It knows a stack of identical loose sheets. A real book has a binding side that alternates per page, front matter before the body, and a page count that feeds back into its own margins.

---

## 1. Objectives

1. Make `PageLayout` able to *express* KDP's gutter requirement, so a test can finally assert it (ADR-0043's core finding: no test can assert a requirement the model cannot express).
2. Make `LayoutEngine` model every page the renderer will emit, so `PaginatedBook` stops undercounting.
3. Resolve the gutter ↔ page-count circularity deterministically.
4. State what this does to the visual baseline and to every existing export, before it happens rather than after.

Out of scope: hyphenation/justification quality (ADR-0024, deferred to v2) and running-head content rules. ~~Replacing the estimator with a real text measurer~~ — round 1 kept this out; **round 2 pulled it in as Decision 6**, because §2bis proved it is the root of the CTO-reported underfill, not an adjacent nicety.

---

## 2. Current state — evidence, every claim from source read this session

- **`PageLayout` is four symmetric margins** ([PageLayout.ts:1](../../../backend/src/domain/models/PageLayout.ts#L1)): `marginTop/Bottom/Left/Right`. No gutter, no inside/outside, no recto/verso concept anywhere — `grep gutter` matches nothing in `PageLayout.ts` or `LayoutEngine.ts`.
- **KDP's real requirement scales with page count** (`KDPRuleData.marginsByPageCount`, from the ADR-0035 spike): 0.375″ inside at ≤150 pages up to 0.875″ at ≤828, with 0.25″ minimum outside. A 400-page book owes 0.625″ inside and gets whatever `marginLeft` happens to be.
- **Pagination math uses only vertical margins** ([LayoutEngine.ts:21](../../../backend/src/domain/services/LayoutEngine.ts#L21)): `usableHeight = height - marginTop - marginBottom`.
- **The height estimator ignores page width entirely** ([LayoutEngine.ts:217](../../../backend/src/domain/services/LayoutEngine.ts#L217)): `countWords(text) / WORDS_PER_LINE` with a *constant* words-per-line. A gutter narrows the text column; the estimator would not notice. This is the mechanism behind ADR-0013's estimate-vs-real drift, not a separate fact.
- **Renderers emit pages pagination never saw**: `PDFRenderer` renders title and copyright pages from `book.frontMatter` itself, then `addPage()`s into the body ([PDFRenderer.ts:104](../../../backend/src/infrastructure/renderers/PDFRenderer.ts#L104)–118). On the canonical fixture: `pages.length` said 1, the shipped PDF had 3 (ADR-0045's measurement).
- **The true count already exists, in exactly one place**: `doc.bufferedPageRange().count`, which ADR-0019 finding 6C made the footer's "of TOTAL" denominator and ADR-0045 made `RenderMetrics.pageCount`. Everything downstream of rendering is already honest; the dishonest layer is pagination itself.
- **DOCX partially expresses this natively — checked against the installed types, and the check corrected the claim.** `margin.gutter` exists in the installed `docx` package's declarations (grep, `dist/index.d.ts:65`). `mirrorMargins` does **not** appear anywhere in those declarations — the draft of this very review asserted it did, from memory, and grep said no. Whether OOXML's `w:mirrorMargins` can be reached through this library (settings passthrough, raw XML, or not at all) is exactly what Commit 0's spike must answer before Question 2 is locked. EPUB has no pages at all and is untouched by this entire review.

---

## 2bis. The underfill investigation — component located, cause measured, verdict stated

Method: read both components end to end, then measure with `backend/spikes/pagination-fill-spike.ts` — real fixture, real pipeline, real PDFKit font metrics. No fix was designed before this section existed.

### Where the page-break decision is taken — two places, and their relationship is the defect

1. **The decision:** [LayoutEngine.ts:89](../../../backend/src/domain/services/LayoutEngine.ts#L89) — `overflow = currentHeight + blockHeight > usableHeight`. `blockHeight` is an **estimate**.
2. **The obedience:** [PDFRenderer.ts:371](../../../backend/src/infrastructure/renderers/PDFRenderer.ts#L371)–378 — every block the estimator designated as a page start triggers an unconditional `doc.addPage()`. **The renderer forces the estimator's breaks onto real text.** The estimator's error is not corrected at render time; it is enforced.

### The CTO's three suspicions, adjudicated against the code

- **"keepTogether / pageBreakBefore responsible?" — No.** The only keep rule is `staysWithNext` (headings, [LayoutEngine.ts:71](../../../backend/src/domain/services/LayoutEngine.ts#L71)) and it is not the driver. `pageBreakBefore` semantics exist only as chapter-start `forceNewPage`, which is correct book convention.
- **"Une règle trop conservatrice?" — Yes, and it is quantified.** Three compounding estimator errors:
  | Error | Mechanism | Measured |
  |---|---|---|
  | Line height | Estimator charges `fontSize × 1.5` (theme); renderer draws with **no `lineGap`** ([PDFRenderer.ts:402](../../../backend/src/infrastructure/renderers/PDFRenderer.ts#L402)–408), i.e. the font's natural ~1.15 | **16.5pt vs 12.7pt — +30% per line, every line** |
  | Words per line | `WORDS_PER_LINE = 12`, a constant blind to width, font, and language | wrong in *both* directions depending on prose |
  | Never modelled | chapter/section titles (24pt+ + a blank line, `renderTitle`), `spaceAfter` (~8pt × every block) | 15 titles at 0pt; ~3.7 pages of unmodelled spacing on the fixture |
- **"Ça dépasse → nouvelle page?" — Confirmed, verbatim.** `addBlock` ([LayoutEngine.ts:87](../../../backend/src/domain/services/LayoutEngine.ts#L87)) is fit-whole-or-flush. **A block is never split** — the code's own comment says so ("this pagination model never splits a block's own content across pages"). There is no "essai de coupure" step at all.

### The aggregate measurement

On the canonical fixture: the estimator charges **1.43×** the real rendered height (300 of 300 blocks overestimated >5%), which caps every page at a **mean real fill of 71%**. The canonical fixture *understates* the visible damage because its paragraphs are near-identical in length; on varied real prose the same mechanisms concentrate the waste into the exact pattern the CTO photographed — some pages half empty, and (per the simulation) the constant also *under*-estimates long-word prose, producing the historical "Page 6 of 4" drift in the other direction.

**The title-alone-above-blank case, explained:** a chapter opens (forced break, correct), its title is drawn at a cost the model booked as **zero**, and its following paragraphs are atomic blocks priced +43% — so the model concludes far less fits under the title than really does, and pushes them. The white space is the sum of both lies.

### Verdict — the CTO's question 5

**Algorithm and parameters. Not the library.** PDFKit provides exact measurement (`heightOfString`, already trusted for the footer's "of TOTAL" since ADR-0019) and natural text flow; the pipeline uses neither for pagination. It estimates with wrong constants, never splits, and then forces those estimates onto the rendered document. The fix is therefore architectural (measure, don't guess — Decision 6) followed by typographic (split with widow/orphan control — Decision 7), not a parameter tweak: correcting `WORDS_PER_LINE` alone would leave titles unmodelled, line height wrong, and blocks atomic.

**A Real Fixture Policy finding in its own right:** `large-book.docx`'s uniform paragraphs cannot exhibit variance-driven underfill — every page fills identically. The canonical set needs a varied-prose fixture; until then, the CTO's own book is the only artifact that shows this class of defect, which is precisely why it reached production-quality review before any fixture caught it.

---

## 3. Proposed decisions

### Decision 1 — `PageLayout` gains `gutterIn` and margins become inside/outside, with a compatibility view

```ts
export interface PageLayout {
  pageSize: ...;
  width: number; height: number;
  marginTop: number; marginBottom: number;
  /** Binding-side margin. Replaces marginLeft on recto pages, marginRight on verso. */
  marginInside: number;
  /** Outer-edge margin. */
  marginOutside: number;
}
```

`marginLeft/Right` are **removed, not aliased**. An alias would let every existing call site keep compiling while silently meaning something else — the exact failure mode ADR-0042 refused for `Book.pageCount`. The compiler must force every consumer to say which side it means. Cost measured before proposing: the six layout constants, two renderers, one estimator, and their tests — bounded, and the churn *is* the audit.

### Decision 2 — Recto/verso is resolved by the consumer from the page number, not stored per page

A page's binding side is `pageNumber % 2` (recto = odd, western convention, title on recto). Storing `side` on `Page` would be a second source of truth that `startPageNumber` (Sprint 6) could silently contradict. `PageLayout` gets two pure helpers (`leftMarginFor(pageNumber)`, `rightMarginFor(pageNumber)`) so both renderers and the estimator share one resolution rule.

### Decision 3 — `LayoutEngine` models front-matter pages; renderers stop inventing them

`paginate()` emits `Page` entries for title and copyright (kind-tagged, e.g. `page.kind: 'title' | 'copyright' | 'body' | 'blank'`), and renderers *render what pagination says* instead of `addPage()`-ing on their own initiative. This is the structural fix for ADR-0045's deeper issue: after it, `pages.length` and the rendered count can only drift for *estimation* reasons, never for *omission* reasons. `RenderMetrics` stays the authority regardless — Decision 3 narrows the gap, it does not repeal ADR-0045.

### Decision 4 — The circularity resolves in one re-pagination pass, never a loop

Paginate → look up the gutter for the resulting count in the target's margin table → if the gutter changed, re-paginate once → validate the result. If the second pass crosses *another* threshold, **report it as a `PublishingIssue`** rather than iterating: an author whose book sits exactly on a boundary needs to be told, not silently handed a third layout. Deterministic, bounded, and the boundary case becomes information instead of behavior.

**Where it runs:** the margin table lives in `KDPRuleData` (platform data); the re-pagination decision is therefore made in `PublishingUseCase` territory, not inside `LayoutEngine` — the engine takes margins as input and must never know KDP exists (ADR-0037 held).

### Decision 5 — Defaults keep today's geometry for non-KDP layouts

`letter`/`a4`/`a5` set `marginInside = marginOutside = ` today's symmetric value: **byte-identical output for every existing export path that doesn't ask for a gutter**. Only the three KDP trim layouts adopt real inside/outside values. This is what keeps the visual baseline change reviewable: Commit N's baseline diff shows *only* KDP-layout screens moving.

### Decision 6 — Pagination measures, it does not estimate: a `TextMeasurer` Domain port *(round 2, from §2bis)*

```ts
// Domain port
export interface TextMeasurer {
  /** Real rendered height of this text at this size in this column width, natural line height. */
  measureHeight(text: string, options: { fontSize: number; width: number; heading?: boolean }): number;
  /** Height of one line at this size — for moveDown modelling and per-line reasoning. */
  lineHeight(fontSize: number): number;
}
```

Infrastructure implements it on PDFKit's `heightOfString` with the **real embedded fonts** (the same `PdfFontRegistry` the renderer uses), so `LayoutEngine` prices a block at what `PDFRenderer` will actually draw. `WORDS_PER_LINE` dies. The engine also starts charging what it never charged: chapter/section titles (measured at `renderTitle`'s own sizes + its `moveDown`) and each block's `spaceAfter`.

Port-vs-class judgment (`DEVELOPER_HANDBOOK.md`): a port, because a second real implementation is already foreseeable — DOCX line metrics differ from PDF's, and a future DOCX-faithful pagination would implement the same interface with Word-metric behaviour. Clean Architecture holds: Domain defines the port, Infrastructure owns PDFKit.

This **supersedes Question 3's round-1 answer** ("width-sensitive estimation"): §2bis showed estimation with better constants still cannot price titles, spacing, or real fonts. Measurement is the only answer that closes the class of defect rather than one instance.

### Decision 7 — Typographic pagination lands in two phases, and the split is the honest part *(round 2)*

**Phase A — implemented now (CTO-authorized):** Decision 6. Blocks stay atomic, but their prices become true, titles and spacing enter the model, and the renderer's forced breaks land where real text actually ends. This removes the *systematic* underfill (the +43%) and the title-above-blank case. Residual waste = end-of-page remainders smaller than one block — real books show this as the occasional short page, not half-empty ones.

**Phase B — designed here, implemented next, not blind-fixed today:** line-level block splitting. `Page.blocks` entries become spans (`{ blockId, fromLine?, toLine? }`), `LayoutEngine` fills the remainder of a page with the head of the next paragraph when at least 2 lines fit and at least 2 lines remain for the following page — which **is** widow/orphan control (min-2-lines at both ends), plus `staysWithNext` generalized so a heading never sits last on a page. The renderer renders spans (PDFKit `heightOfString` per line range). Lists, quotes, tables split at item/row boundaries; images never split. This is the CTO's "veuves, orphelines, paragraphes longs, titres, listes, citations, images" list, mapped one-to-one — and it needs its own commit series with real-book visual verification, which is why it is not squeezed into tonight.

---

## 4. Open questions — ~~for CTO decision~~ **LOCKED (CTO, 2026-07-18 evening: "Propose la meilleure résolution pour ses quatre questions" — resolutions below are those proposals, applied)**

**Question 1 — do KDP layout presets bake in a *default* gutter, or is the gutter always resolved from page count at export time?**
**✔ LOCKED: resolved at export/publish time; presets carry none.** A preset with a baked 0.5″ gutter is wrong for a 600-page book and the model cannot know the count before pagination. The re-pagination pass (Decision 4) is the mechanism; presets stay honest by carrying only what is true independent of content.

**Question 2 — does the DOCX renderer use the library's native gutter field, or compute per-section margins itself?**
**✔ LOCKED: native `margin.gutter`; `mirrorMargins` contingent on the Commit-0 spike opening real output in Word.** The gutter field is confirmed in the installed types; `mirrorMargins` is **not** exposed there (§2 — the draft claimed otherwise from memory and grep corrected it). If the spike finds no path to `w:mirrorMargins`, the fallback is honest: a gutter without mirroring is what OOXML's own gutter semantics give single-sided documents, and Word still applies it to the binding side when mirroring is enabled by the user. The spike (Commit 0) must open real output in Word and look — per ADR-0019/0020 precedent, and per this review's own fresh demonstration that remembered library capabilities cannot be trusted.

**Question 3 — is this the moment to replace `WORDS_PER_LINE` with width-aware line estimation?**
**✔ LOCKED — and the round-1 answer is superseded by Decision 6:** not width-aware *estimation* but real *measurement* via the `TextMeasurer` port. §2bis is why half-measures cannot close this. The estimator must become *width-sensitive enough to notice the gutter* (chars-per-line derived from usable width and font metrics, still an estimate), or Decision 4's re-pagination pass would be re-running an estimator that cannot feel the thing that changed. Full text measurement (real font metrics, kerning) stays out — it is the Performance sprint's problem (ADR-0041 Constraint 1) and this review must not absorb it.

**Question 4 — blank verso after title page?**
**✔ LOCKED: yes, one `'blank'` page** so copyright lands on the title's verso and Chapter 1 opens recto — standard book-making, and the `'blank'` page kind already exists (Sprint 6, `openingPageStyle`). Cheap now, a churn later.

---

## 5. Risks

1. **Every KDP export changes visually.** Deliberate and announced (Decision 5 confines it), but the Sprint 9 baseline rule — desktop images byte-identical through Commit 7 — means **this review must not be implemented mid-Sprint-9** unless its scope stays off the demo screens. Sequencing, not design: it slots after Sprint 9's restyle commit or as its own sprint.
2. **Re-pagination doubles pagination cost near thresholds.** 598ms is the known large-book figure (ADR-0041); worst case adds one more pass on the publish path only. Acceptable now, and it makes the event-loop review's case stronger, not weaker.
3. **`page.kind` touches `Page`, which running heads and page numbering already consume.** The Sprint 6 rules (no header/footer on blank pages) must be re-verified against front-matter pages — title pages traditionally carry neither. A real-fixture visual pass is mandatory, not optional (six precedents and counting).
4. **The estimator change (Q3) shifts page counts even for non-gutter layouts** if chars-per-line replaces words-per-line globally. Mitigation: feed it the same effective width as today for symmetric layouts, so only gutter layouts see different estimates — same confinement strategy as Decision 5.

---

## 6. Commit plan (after approval — two-gate rule holds)

| # | Scope |
|---|---|
| 0 | Word-compatibility spike for DOCX gutter fields (Q2); ADR for findings. ADR-0043 OPEN → RESOLVED on approval of this review, cited by it. |
| 1 | `PageLayout` reshape (Decision 1) + helpers (Decision 2); all six layout constants; compiler-driven consumer audit. Symmetric defaults — baseline must stay byte-identical. |
| 2 | Estimator width-sensitivity (Q3, confined per Risk 4). |
| 3 | `LayoutEngine` models front matter + blank verso (Decisions 3, Q4); renderers consume instead of invent. |
| 4 | Re-pagination pass + threshold `PublishingIssue` (Decision 4), publish path only. |
| 5 | KDP layouts adopt real inside/outside; gutter margin rule added to `KDPRuleProvider` (now expressible — the point of it all); real-fixture verification with page-by-page visual inspection of a KDP PDF. |

---

## Related

ADR-0043 (the defect this resolves), ADR-0045 (the renderer-pages issue Decision 3 structures away), ADR-0013 / ADR-0019 finding 6C (the estimate-vs-real history), ADR-0035 (the spike that supplied the margin table), ADR-0037 (why the re-pagination decision sits outside `LayoutEngine`), ADR-0024 (typography quality explicitly out of scope), ADR-0041 (the performance context Risk 2 feeds), `UI_FOUNDATION.md` baseline rule (Risk 1's sequencing constraint), `docs/REAL_FIXTURE_POLICY.md`.
