# Mini Design Review — Blockless Titles Are Charged, and a Stranded Title Has a Name

**Date:** 2026-07-22 · **Status:** CTO-directed (the TYPOGRAPHY_QUALITY_SCOPE §1 ruling: "un
correctif préalable dans la lignée PART_LEVEL, pas le chantier de goût") · **Lineage:**
PART_LEVEL_STRUCTURE commit 1 (the blockless-chapter drift fix), one level down.
**Cadrage:** `TYPOGRAPHY_QUALITY_SCOPE.md` §1 — the cause is located and triply verified
(AST census, renderer warning, code reading), so this goes straight to mini-DR per the CTO
directive; the scope report is de facto this review's §1.

## §1 The defect (measured, not assumed — full evidence in TYPOGRAPHY_QUALITY_SCOPE §1)

A **titled content whose own `content` is empty** is invisible to pagination's title charging:
`titleHeightOf` is only ever spent through `flushBeforeTitleIfOrphaned(content, block)` inside
`for (const block of content.content)` — a loop an empty content never enters. Every renderer
draws the title anyway. Model +0 / renderer +~38pt per occurrence: a live ADR-0051 violation.

Real-page effect today: faith-alone carries exactly one such shape (`"3. The Law Was a Tutor,
Pointing to Christ"`, L2, 1 of 79 sections). On Modern the uncharged consumption crosses a page
boundary — PDFKit breaks **while rendering the title** (its unplanned #2), stranding an 18pt
heading at the bottom of real p.40 with zero lines under it. **§10.3's "headings hard gate 0 —
enforced by construction" is violated on a shipped page.** On Classic/Novel the same ~38pt is
absorbed silently — latent, not absent.

## §2 The shape, at ALL levels (CTO: "vérifie la même forme à tous les niveaux")

Four variants of "titled, own-content empty":

| # | Variant | Today | This review |
|---|---|---|---|
| a | **Nested section** (the exhibit, any level, with or without subsections) | title uncharged, in-flow draw | charged in-flow + orphan guard (D1, D3) |
| b | **Top-level section** | same — disclosed at `LayoutEngine.ts:280-283` as out of PART_LEVEL's scope | same fix (D1, D3) |
| c | **Chapter with sections but no own blocks** (reachable from a real import: Heading 1 immediately followed by Heading 2) | title uncharged **and** the chapter's conventional opening break never planned **and** `currentTopLevelTitle` never set (running-head attribution silently wrong for its pages) | full chapter-opening protocol (D2) |
| d | **Blockless childless top-level chapter** (Part opener) | already fixed (`ownsBarePage`, PART_LEVEL commit 1) | untouched |

Corpus census (probe 4): variant (a) ×1 in faith-alone; (b), (c) zero occurrences today — (c) is
nonetheless reachable from any real manuscript whose chapter heading is immediately followed by a
section heading, and (b) is one studio demotion away. Charged==consumed must hold for the class,
not the specimen.

## §3 Decisions

- **D1 — charge in-flow, at every level.** In `walkContent`, a titled content with empty
  `content.content` charges `titleHeightOf(content)` in-flow (variants a/b). The height goes on
  the current page; the page records the content's **own id** (`currentPageBlocks.push(content.id)`)
  — the PART_LEVEL precedent: the only id the shape has.
- **D2 — variant (c) gets the full chapter-opening protocol**: flush, `startPageNumber` /
  `openingPageStyle` parity, `currentTopLevelTitle = content.title` (the running-head fix rides
  along), title charged, content id pushed. The renderer is ALREADY ready: `renderContent`'s
  chapter `startKey` falls back to `content.id` (`PDFRenderer.ts:417-418`) with a comment
  explicitly holding the door open for this model change.
- **D3 — the orphan guard**: before charging, if the remaining page cannot hold
  `titleHeight + 2 body lines`, flush first — the same floor `flushBeforeTitleIfOrphaned` uses
  (`minStart = 2 * line`), applied to the shape that has no first block to key on. Whatever
  follows (a subsection's text, the next sibling's title) lands under the title on the fresh
  page. Disclosed edge: an empty-titled content that is the book's LAST content may legally
  close the final page — nothing follows to strand.
- **D4 — the renderer's section keep-with-next generalizes by one key**: the
  `PDFRenderer.ts:436` branch keys on `firstBlockId ?? content.id` (title present), so a
  planned break before a blockless title is expressible exactly like every other planned break.
  No other renderer changes; DOCX/EPUB render structure, not pages, and are untouched.
- **D5 — a stranded title has a name** (CTO: a reconciliation that strands a heading must not
  add anonymously into `unplannedPageBreaks`). `RenderMetrics` gains
  **`unplannedTitleBreaks?: number`** — the subset of unplanned breaks that fired while a TITLE
  was being drawn, classified off the existing `__currentBlockId` marker (`renderTitle` already
  stamps `title "…"`). Additive; the anonymous total stays. The §10.3 heading gate becomes a
  TEST: 0 across the corpus, all themes — renderer-enforced, not construction-claimed.
- **D6 — parity relocks ship IN the charging commit**, old → new numbers disclosed. Blast-radius
  proof: the three shape-free corpus books' numbers must NOT move; only faith-alone's may.

## §4 Locks (the CTO's three, made concrete)

1. **Modern p.40 repaired on the real page**: the real-page heading census (probe §4 instrument)
   re-run post-fix → 0 bottom-widow hits on all three themes; Modern's unplanned drops 2 → 1
   (the remaining 1 = the known ±1-line bold-run residual, attributed to a paragraph).
2. **Three themes re-censused to 0** — same instrument, plus `unplannedTitleBreaks === 0` pinned
   in-suite on the real fixture across themes (the gate outlives the probe).
3. **Corpus parity re-locked at the new exact numbers** — same commit as the charge (D6).

## §5 Commit plan

1. **Docs**: this review + `TYPOGRAPHY_QUALITY_SCOPE.md` + the four probes + the TODO
   amendments the CTO ordered with it (`LIST_SPLITTING_ACROSS_PAGES` re-measured to today's
   numbers; `LEADING_FIDELITY` consigned as a named follow-up).
2. **The charge, tests first** (red → green in one commit): variants a/b/c pinned in
   `LayoutEngine.test.ts` (charged height, orphan-guard flush, chapter protocol incl.
   running-head attribution, the id-on-page invariant), the renderer keep-with-next
   generalization + planned-break test, parity relocks with disclosed deltas, and the disclosed
   TOC bonus (a blockless section's TOC entry resolves a real page number through the existing
   `content.id` fallback — `LayoutEngine.ts:405` — pinned by test, not left as a surprise).
3. **The name** (D5): `unplannedTitleBreaks` + the corpus gate test + §10.3 annotation.

## §6 Out of scope, said now

Justification/hyphenation (that is TYPOGRAPHY_QUALITY, the taste chantier, after the founder
traversal), leading (`LEADING_FIDELITY`, consigned), any change to what titles LOOK like, and
any break the renderer does not consume today (an untitled blockless content draws nothing and
stays charged at zero — charging phantom heights would be the inverse drift).
