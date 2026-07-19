# Publication Quality Bar — Design Review (Draft)

**Status:** 🟡 DRAFT — not active, not scoped into any sprint yet
**Gate:** This review does not lift the current freeze. No engine work (Validation evolution, Editorial AI, Layout, and now this document) starts until:
1. The Import Fidelity commits (1–5) are merged, and
2. The pagination/fragmentation investigation (empty-looking pages on `Faith_Alone`) is closed and classified.

**Purpose of this document:** define, in advance, what "professional export quality" means in terms Claude Code can verify automatically — so that when the freeze lifts, there is no ambiguity about what "done" means. This is a specification, not a task list. It does not authorize implementation.

**Date:** 2026-07-19
**Author:** CTO review, drafted ahead of need per founder request.

---

## 1. Why this document exists

The founder's requirement is simple to state and hard to verify by feel: *"the exported DOCX/PDF/EPUB must be professional-grade, with correct colors and alignment, such that the author needs to make almost no manual corrections before publishing."*

"Looks good" is not an engineering criterion. Every clause of that requirement must be translated into something `verify-real-export` (or a successor harness) can check automatically on real manuscripts — the same discipline that already caught the `<s>` bug, the `.trim()` bug, and the structure/pagination defects. A quality bar that lives only in a human's eye will regress silently the first time someone touches the renderer.

**This document is explicitly downstream of Import Fidelity.** A perfect PDF theme applied to a manuscript with wrong chapter counts or fabricated blank pages is not a quality product — it is a well-decorated bug. No criterion below is meaningful until the pipeline's structural fidelity is proven on varied real manuscripts.

---

## 2. Scope

### In scope
- Objective, automatable acceptance criteria for DOCX, PDF, and EPUB exports.
- A formal definition of "zero required modification" as a measurable target, not an impression.
- Extension of `verify-real-export` (or an equivalent) to check these criteria on the real-manuscript corpus already established for Import Fidelity.
- Auditing what the current "Classic" theme actually produces on real manuscripts today, as a baseline — before any new visual capability is added.

### Explicitly out of scope (for this document)
- New themes or visual styles beyond auditing the existing "Classic" theme.
- Subjective aesthetic judgment ("is this pretty") as an acceptance mechanism.
- Editorial AI–driven formatting suggestions — that engine consumes this bar's diagnostics later, it does not define them.
- Any implementation. This is a specification to be reviewed and locked, then handed to a future sprint.

---

## 3. Guiding principle

> **A quality claim that cannot be checked by a script is not a requirement — it is a hope.**

Every bullet in sections 4–6 must eventually correspond to an assertion in a test file, not a sentence in a README. Where a criterion is currently unverifiable (e.g., "colors are correct"), this document names the concrete, checkable proxy that will stand in for it, and says so explicitly rather than leaving it vague.

---

## 4. DOCX — acceptance criteria

| # | Criterion | How it is verified |
|---|---|---|
| 1 | Word heading styles (Heading 1–6) present and correctly nested, matching the AST's chapter/section hierarchy | Parse the exported DOCX styles; count matches against AST section count |
| 2 | Bold, italic, underline, strikethrough preserved | Round-trip test: import → export → re-import, compare inline formatting spans |
| 3 | Footnotes present and correctly anchored | Count footnote references vs. footnote definitions; no orphans |
| 4 | Lists (ordered/unordered) preserved with correct nesting | Structural diff of list nodes pre/post export |
| 5 | Tables preserved with correct column count and cell content | Cell-by-cell text comparison |
| 6 | Images present, correctly placed, correct resolution reference | Presence + position check against AST image nodes |
| 7 | Hyperlinks functional (internal anchors and external URLs) | Extract relationships XML, validate targets resolve |
| 8 | Correct font application per theme, no fallback-font silent substitution | Inspect `fonts.xml` / run properties against theme spec |
| 9 | No paragraph fragmentation: a paragraph that was one AST node exports as one paragraph, not split across artificial breaks | Text-content diff at paragraph-boundary granularity |

### Colors and alignment (DOCX)
Word documents don't carry "print colors" the way PDF does, but they carry style colors (headings, callouts, table shading). Criterion: every color reference in the theme spec resolves to the correct value in the exported style definitions — no default-black fallback. Verified by extracting `styles.xml` and comparing against the theme's declared palette.

---

## 5. PDF — acceptance criteria

| # | Criterion | How it is verified |
|---|---|---|
| 1 | Fonts embedded (no reliance on system fonts) | Inspect PDF font objects; every font used must have an embedded subset |
| 2 | Headings render in correct hierarchy and style | Text-extraction + font-size/weight check against AST heading levels |
| 3 | Table of contents present when the book has ≥1 detected chapter, correctly linked | TOC entries count matches chapter count; links resolve to correct page |
| 4 | Drop caps applied per theme spec where configured | Visual/positional check of first-letter glyph size and position |
| 5 | Pagination is continuous and non-fragmented — **no page break unless justified by a real structural boundary (chapter start, explicit page-break) or genuine content overflow** | This is the direct fix target for the current pagination defect. Acceptance: on the real-manuscript corpus, the ratio of (rendered pages) to (expected pages, computed from word count and theme's words-per-page) must fall within a defined tolerance band (e.g. ±10%, to be calibrated against `Faith_Alone` once fixed) |
| 6 | Images render at correct position, size, and resolution — no distortion, no missing images | Presence + dimension check against AST image nodes |
| 7 | Tables do not overflow page boundaries; long tables split with repeated headers | Visual/structural check for table-row bleed across page breaks |
| 8 | No orphaned lines, no widowed headings (a heading must never be the last line on a page) | Widows/orphans check, already partially covered by `QualityMetrics.widowsAndOrphans` — extend to be a hard export gate, not just an advisory metric |

### Colors and alignment (PDF)
This is where "professional and without color faults" becomes concretely checkable: every color used in rendering (text, table shading, callout backgrounds, headers/footers) must trace back to a value declared in the active theme — never a renderer default. Verified by comparing the PDF's extracted color operators against the theme's declared palette, on a sample of pages per manuscript.

Alignment: margins, gutters, and text-block boundaries must match the layout preset's declared measurements (already partially tracked via ADR-0043 — gutter application). This becomes a hard acceptance check, not an advisory note, once ADR-0043 ships.

---

## 6. EPUB — acceptance criteria

| # | Criterion | How it is verified |
|---|---|---|
| 1 | Valid EPUB (passes `epubcheck` with zero errors) | Run `epubcheck` in the harness, zero tolerance for errors (warnings logged, triaged separately) |
| 2 | CSS matches theme spec — no user-agent default styling leaking through | Extract embedded CSS, diff against theme's declared rules |
| 3 | Navigation (NCX/nav document) matches chapter structure exactly | Nav entries count and order match AST chapter list |
| 4 | Images present, correctly referenced, correctly sized for reflowable text | Manifest/reference check |
| 5 | Table of contents complete and correctly ordered | Same as PDF check #3, applied to EPUB nav |
| 6 | Footnotes/endnotes functional as EPUB-native popup/link references | Link-target resolution check |
| 7 | Metadata complete (title, author, language, identifier) before export is considered "ready," not just before KDP validation | Cross-check against the same metadata fields already tracked in "Ready for Print" |

---

## 7. "Zero required modification" as a measurable target

The founder's stated goal — *the author should need almost no manual correction before export* — must become a composite, corpus-level metric rather than a feeling. Proposed formal definition, to be calibrated once Import Fidelity is closed:

**On the real-manuscript verification corpus (the same corpus built for `verify-real-import`), for each format:**
- 0 pages with content-to-whitespace ratio below a defined threshold (catches the fragmentation defect currently under investigation)
- 0 chapter/section count mismatches between AST and rendered output
- 0 color values falling back to renderer defaults instead of theme values
- 0 font substitutions (embedded font ≠ requested font)
- 0 broken internal links or orphaned footnotes
- Widows/orphans count at zero for headings specifically (body-text widows may remain an advisory, not a hard gate, pending further discussion)

This list is deliberately conservative and additive — it can grow, but nothing here should be loosened without a documented reason. Each bullet should become one assertion in the export harness, named specifically (e.g. `NO_ORPHANED_FOOTNOTES`, `NO_FONT_FALLBACK`), following the same "a screen may only show an error it can name" discipline already adopted for the error contract.

---

## 8. What this document deliberately does not decide

- **Whether new themes beyond "Classic" are needed.** Out of scope until the existing theme is audited against the criteria above.
- **How Editorial AI will use these diagnostics.** This bar produces facts about export quality; what consumes them is a later engine's concern, consistent with the existing separation (Validation Engine produces diagnostics, Editorial AI consumes them).
- **The exact numeric thresholds** (page-ratio tolerance, widow/orphan limits). These need calibration against real data once the pagination investigation completes — placeholder values above are illustrative, not final.

---

## 9. Sequencing (unchanged from current CTO direction)

1. Close the pagination/fragmentation investigation (in progress).
2. Merge the 5 Import Fidelity commits.
3. Only then: review this document for real (calibrate thresholds against actual corpus data), lock it, and schedule its implementation as its own sprint — likely extending `verify-real-export` into a `verify-publication-quality` harness.

This document does not authorize any code. It exists so that step 3 can start immediately once steps 1–2 close, without re-deriving the specification from scratch.

---

## 10. Calibration round 1 — measured data and proposed values (2026-07-21, appended annotation)

*Appended per the CTO's feu vert and its strict framing: this section derives replacements for §8's provisional values from real corpus data. It touches nothing above; the scope stays as written. Instrument: `backend/spikes/quality-bar-calibration-spike.ts` (committed, rerunnable).*

**🔒 LOCKED (CTO verdict, 2026-07-21).** All four §10.3 values are adopted, with one formal amendment on value 1: **the ±8% page-ratio tolerance carries a re-evaluation condition — it must be re-derived as soon as the corpus reaches at least 3 manuscripts of varied structure** (chapter count, density, mixed formats). That condition lives as a NAMED follow-up item in `docs/TODO.md`, not only as this sentence, so that growing the corpus cannot silently outlive the number it was supposed to recalibrate. This lock closes the pagination/structure subset only (§5 criterion 5, §7); the DOCX/EPUB/color/font/link criteria still await the future `verify-publication-quality` harness (§9 step 3), and no frozen engine is unblocked by it.

### 10.1 The measurement found one more defect first

Producing the fill distribution exposed a ghost-page bug in the title keep-with-next flush (a JS evaluation-order trap: `currentHeight += f()` reads the left operand before `f()`'s internal flush zeroes it — every section boundary produced a phantom near-full page carrying one real paragraph). Fixed and locked in `PDFRenderer.parity.test.ts` before calibrating: **numbers below are from the fixed pipeline.** This is §3's guiding principle working as designed — the measurement script caught what 556 passing tests did not.

### 10.2 Measured baseline — `faith-alone-styled.docx` (39,354 words, 17 chapters, Classic theme)

| Layout | Model pages | Real pages | Reconciliations | Words/page | Mean fill | Pages <30% fill | …of which non-structural |
|---|---|---|---|---|---|---|---|
| letter | 86 | 90 | 2 | 458 | 88% | 6 | **0** |
| a4 | 81 | 85 | 2 | 486 | 93% | 1 | **0** |
| a5 | 182 | 186 | 2 | 216 | 95% | 3 | **0** |
| kdp-5x8 | 234 | 238 | 2 | 168 | 95% | 3 | **0** |
| kdp-5.5x8.5 | 187 | 191 | 2 | 210 | 96% | 1 | **0** |
| kdp-6x9 | 155 | 159 | 2 | 254 | 95% | 1 | **0** |

"Structural" = the page before a chapter start (new-page convention), before a titled-section keep-with-next break (ADR-0051), or the book's last page — legitimate typography, not defects.

### 10.3 Proposed calibrated values (replacing §8's placeholders)

1. **§5 criterion 5 — page-ratio tolerance (was "±10%, illustrative")**: expected pages = words ÷ WPP(layout), with the measured words-per-page table above as the Classic-theme WPP registry. Proposed tolerance: **±8%**, derived as: bounded reconciliation cost (≤2 pages, <1%) + chapter-count structure variance (a 5-to-40-chapter book shifts boundary short-pages by roughly ±5%) + a stated n=1 allowance. **Confidence note, not scope creep:** the corpus has one book-length manuscript; the tolerance should tighten as the corpus grows, per §7's own corpus-level framing.
2. **§7 bullet 1 — content-to-whitespace threshold (was "a defined threshold")**: hard gate = **zero non-structural pages under 30% fill**, with the §10.2 structural definition. Measured today: 0 on all six layouts. Permitted exception: at most `RenderMetrics.unplannedPageBreaks` such pages (each observable reconciliation can cost at most one short page) — that counter is itself parity-locked at 2 on the corpus.
3. **§7 last bullet — widows/orphans (was "pending further discussion")**: headings/titles hard gate **0** — enforced by construction (title keep-with-next + `staysWithNext`) and measured 0; body-text widows/orphans hard gate **0 by the min-2-lines rule** (Phase B splits never strand fewer than 2 lines at either end), observed 0. The "body advisory" hedge can be retired: the mechanism guarantees it.
4. **New number the original could not know — reconciliation bound**: `unplannedPageBreaks ≤ 2` on the corpus manuscript, exact-locked (`PDFRenderer.parity.test.ts`); any future criterion referencing "pages the model did not plan" uses this counter, never a PDF diff.

*Everything else in §4-§6 (DOCX/EPUB criteria, colors, fonts, links) carries no numeric placeholder and needs no calibration — those criteria await the future `verify-publication-quality` harness (§9 step 3), unchanged.*
