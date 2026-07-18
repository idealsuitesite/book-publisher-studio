# Layout Fidelity — Gutter, Recto/Verso, and the One True Page Count — Level 2 Design Review

**Status:** 🟡 **ROUND 1 — DRAFT. Not approved. No branch, no code.**
**Date:** 2026-07-18
**Trigger:** two defects that share one root. **ADR-0043** (OPEN): `PageLayout` has no gutter, so every paperback this product generates runs text into the binding. **ADR-0045**'s deeper issue, deliberately left open there: renderers emit pages (title, copyright) that `LayoutEngine` never models, so pagination is not a model of the document — it is a model of *part* of it.

The shared root, named plainly: **`LayoutEngine` does not know what a book physically is.** It knows a stack of identical loose sheets. A real book has a binding side that alternates per page, front matter before the body, and a page count that feeds back into its own margins.

---

## 1. Objectives

1. Make `PageLayout` able to *express* KDP's gutter requirement, so a test can finally assert it (ADR-0043's core finding: no test can assert a requirement the model cannot express).
2. Make `LayoutEngine` model every page the renderer will emit, so `PaginatedBook` stops undercounting.
3. Resolve the gutter ↔ page-count circularity deterministically.
4. State what this does to the visual baseline and to every existing export, before it happens rather than after.

Out of scope: hyphenation/justification quality (ADR-0024, deferred to v2), running-head content rules, and replacing the estimator with a real text measurer — see Question 3 for why that last one is *named* here but not *decided* here.

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

---

## 4. Open questions — for CTO decision

**Question 1 — do KDP layout presets bake in a *default* gutter, or is the gutter always resolved from page count at export time?**
*Recommendation: resolved at export/publish time, presets carry none.* A preset with a baked 0.5″ gutter is wrong for a 600-page book and the model cannot know the count before pagination. The re-pagination pass (Decision 4) is the mechanism; presets stay honest by carrying only what is true independent of content.

**Question 2 — does the DOCX renderer use the library's native gutter field, or compute per-section margins itself?**
*Recommendation: native `margin.gutter`, with `mirrorMargins` contingent on the spike.* The gutter field is confirmed in the installed types; `mirrorMargins` is **not** exposed there (§2 — the draft claimed otherwise from memory and grep corrected it). If the spike finds no path to `w:mirrorMargins`, the fallback is honest: a gutter without mirroring is what OOXML's own gutter semantics give single-sided documents, and Word still applies it to the binding side when mirroring is enabled by the user. The spike (Commit 0) must open real output in Word and look — per ADR-0019/0020 precedent, and per this review's own fresh demonstration that remembered library capabilities cannot be trusted.

**Question 3 — is this the moment to replace `WORDS_PER_LINE` with width-aware line estimation?**
*Recommendation: no — but one narrow change is unavoidable.* The estimator must become *width-sensitive enough to notice the gutter* (chars-per-line derived from usable width and font metrics, still an estimate), or Decision 4's re-pagination pass would be re-running an estimator that cannot feel the thing that changed. Full text measurement (real font metrics, kerning) stays out — it is the Performance sprint's problem (ADR-0041 Constraint 1) and this review must not absorb it.

**Question 4 — blank verso after title page?**
*Recommendation: yes, one `'blank'` page* so copyright lands on the title's verso and Chapter 1 opens recto — standard book-making, and the `'blank'` page kind already exists (Sprint 6, `openingPageStyle`). Cheap now, a churn later.

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
