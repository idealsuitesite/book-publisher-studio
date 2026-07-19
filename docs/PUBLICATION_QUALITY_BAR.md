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
