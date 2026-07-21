# Design Review (Level 2) — The "Part" level: flat openers, positional grouping (PART_LEVEL_STRUCTURE)

**Status:** DRAFT — awaiting CTO approval. **No branch, no code before the approval gate** (`DESIGN_REVIEW_PROCESS.md`).
**Date:** 2026-07-21. Follows `PART_LEVEL_SCOPE.md` (measured; CTO validated the direction and pre-locked three decisions, §2 below).
**Re-verified against current code** (non-negotiable #7), on `main` at `3c9d3d6`: `Book.ts` (the `Content` union, `PartRole`, `openingPageStyle`), `BookEditingService` (read in full), `LayoutEngine.walkContent`/`titleHeightOf`/`buildTableOfContents`, the three renderers' title paths, `ProjectsController.parseMutation:16` (the route-validation whitelist — the live-found `setPartRole` lesson), `bookFacts.ts:114` (the chapter-count surface), `StructureEditor.tsx` (flat dnd list), and the §0 drift **measured, not assumed** (`part-level-geometry-spike.ts`: model +0 / renderer +3 / unplanned 3→6).

---

## 1. What this builds

An author groups chapters into **Parts** (Part I, Part II…) from the studio: a **part opener** is a top-level entry that renders as its own divider page, appears in the TOC, and groups the chapters that follow it **by position** — closing the `PART_LEVEL_STRUCTURE` category gap (three independent sources; Atticus/Vellum both ship it) without a model-tree rewrite. Created in the studio only — nothing in a DOCX marks a Part, so there is no import detection (consistent with `HEURISTIC_STRUCTURE_DETECTION`'s closure).

## 2. CTO-locked decisions (from the scope report, 2026-07-21 — restated, not reopened)

1. **Shape B — flat opener, positional grouping.** No `Part` node in the `Content` union (Shape A's measured cost: 60 `mainContent` sites / 20 backend files + 11/3 frontend). A part's chapters are those between its opener and the next opener — the `role?: PartRole` and flat-TOC precedents.
2. **Numbering: openers excluded (mandatory); continuous across parts in round 1.** Per-part restart is deferred, named, not configured.
3. **The §0 drift fix is the FIRST commit, prerequisite to everything** — the model must charge a titled, blockless top-level content the page the renderers already draw for it — guarded **byte-identical when no such content exists**, with a conscious parity re-lock only for part-bearing books.

## 3. Design decisions this review proposes to lock

1. **An opener is a `Chapter` carrying `partOpener: true`** — an additive optional field, not a new type. Rationale: every walker keeps working untouched (the whole point of Shape B); `Chapter` already has `title`, `subtitle?`, `openingPageStyle?` ('right' reusable for recto-forced openers later) and crosses the DTO boundary today. The flag is the single discriminator every consumer reads: `renumberChapters` skips flagged entries (they consume no chapter number), `bookFacts.chapters` excludes them (`bookFacts.ts:114`, alongside the editorial-parts exclusion), the classifier ignores them.
2. **Round-1 rendering: an opener renders exactly as a chapter title does today** (same `renderTitle`, same 24pt, own page via the drift-fixed pagination). A distinct Part typographic treatment (larger face, centred, drop folio) is **theme work, deferred** — the subtitle-spacing precedent: a theme value later, never a hardcode now. This keeps the R2 delta of a part-bearing book to exactly "one title page per opener".
3. **TOC: openers enter via the existing title walk** (proven working in the spike, 95→98) at level 1, chapters unchanged — presentation refinement (indenting a part's chapters) deferred with the TOC's own "nesting deferred rather than guessed" precedent.
4. **Editing ops: `insertPartOpener(index, title)` and `removePartOpener(id)`** in `BookEditingService` (pure `Content[]` ops + renumber; simpler than `promoteToChapter` — no block splitting). Rename reuses the existing `rename` (openers are titled content). Remove deletes only the opener entry — its chapters simply flow to the previous part (positional grouping makes this a non-destructive one-liner; undo restores).
5. **Reorder semantics round 1: entries move individually** — dragging an opener does NOT drag its chapters (matches the flat model; group-drag is a named deferral). The `StructureEditor` announces openers distinctly so the author understands the flat semantics.
6. **The pagination cache needs no change and must be proven, not assumed:** inserting/removing an opener edits the book → new content hash → a miss by construction (`MINI_DR_PAGINATION_REUSE` §2.3's completeness rule) — asserted by a test, since a stale part-less geometry served after an insert would be exactly the silent-drift class.

## 4. Commit plan (one responsibility each; gate green before the next)

1. **The drift fix (model side only).** `LayoutEngine.walkContent`: a titled, blockless top-level content owns a page — force the page break, charge `titleHeightOf`, flush. Tests: (a) **byte-identity guard** — every corpus book (which contains no such shape, measured) paginates to deep-equal `pages` before/after the fix; (b) the spike's shape re-run: model +N pages for N openers, `unplannedPageBreaks` back to base (the +3 drift gone); (c) a `PDFRenderer.parity`-style lock for one part-bearing composition.

   **AMENDED AT BUILD TIME (2026-07-21, disclosed before the commit, not after):** "model side only" was wrong — read against the renderer's planned-break protocol, the fix necessarily spans **both sides of the same invariant**. `pageStarts` keys planned pages by *first block id*, and a blockless content has none; so the model's opener page carries the **content's own id** in `Page.blocks`, and `PDFRenderer.renderContent` matches it via a `startKey` fallback (first-block id when blocks exist — byte-for-byte the old path — else the content id for a titled blockless top-level chapter). Without the renderer half, every `pageOwners` entry after an opener would shift — the exact misattribution class ADR-0051 closed. Scope precision, also disclosed: the branch covers the **chapter** opener shape only; a blockless titled top-level *section* keeps today's in-flow title (the renderer plans no break for it; mirroring that shape is out of scope, unreachable from imports — measured by `empty-shape-probe.ts`: zero blockless top-level contents of any kind on the whole corpus). Third finding at build: inserting openers into faith-alone legitimately shifts one borderline paragraph's page context and the known **±1-line bold-run residual** (RENDER_DRIFT, disclosed) fires once — attributed, logged, locked exactly in `partOpenerParity.test.ts` (base 155/161/3 unchanged = the corpus byte-identity guard; +3 openers → 158/165/4, the 3 opener drifts gone, the ADR-0051 ledger `real = model + 3 front pages + unplanned` balancing in both runs).
2. **Domain: the flag + ops.** `Chapter.partOpener?: true`; `insertPartOpener`/`removePartOpener` + `renumberChapters` exclusion; unit tests incl. the round-trip (insert → remove restores numbering) and continuous numbering across openers.
3. **Boundary: DTO + route.** `ContentDTO`/`shared-types` carry `partOpener`; `StructureMutation` gains the two ops; **`parseMutation` whitelists them with route tests** — the untrusted-body boundary tested explicitly, the exact gap `setPartRole` shipped with and had to close live (`MINI_DR_EDITORIAL_PLACEMENT`).
4. **Frontend.** `StructureEditor`: opener rows (insert/rename/remove affordances, distinct styling, dnd as plain entries); `bookFacts.chapters` excludes openers; jsdom tests (insert/remove via real clicks; count surfaces). Proof re-inks via the existing `updatedAt` key; the cache-invalidation test from §3.6 lands here or in commit 3, wherever the seam is clearest.
5. **Real-fixture verification + docs.** Live in the studio on faith-alone: insert Part I/II → Structure shows them, the Proof re-inks with real opener pages, TOC lists them, chapter labels unchanged ("Chapter 5" stays "Chapter 5"); export PDF/DOCX/EPUB all reflect; undo removes. `verify-real-export` 16/16. Then docs/ADR reconciliation.

## 5. Verification plan (the load-bearing properties, each a named test)

- **Byte-identical when absent** (the CTO's R2 guard): corpus pagination deep-equal across the drift fix; `verify-real-export` unchanged.
- **Charged == consumed on openers**: N openers → model +N pages AND renderer +N pages, `unplannedPageBreaks` at base (the §0 drift closed, loud in both directions).
- **Numbering**: openers never consume a chapter number; continuous across parts; renumber stable through insert/remove/reorder.
- **Count surfaces**: `bookFacts.chapters` and every "X ch" display excludes openers (the editorial-parts miscount lesson, not repeated).
- **Route boundary**: malformed/valid `insertPartOpener`/`removePartOpener` bodies → 400/200 by test (the `parseMutation` lesson).
- **Cache**: an opener insert/remove invalidates the pagination cache (miss), an accent change over a part-bearing book still hits.
- **Live**: the §4.5 studio sequence on real faith-alone, zero console errors.

## 6. Risks (named)

- **The drift fix touches `walkContent`** — the pagination core. Bounded by the byte-identity guard (corpus unchanged) and by the fact that the new branch triggers only on a shape no imported book produces (measured); but it is model-geometry work and gets the parity-style lock, not just unit tests.
- **A "part" wording collision**: the UI already says "X parts" for top-level entries and `PartRole` names editorial placement. The DR's naming (`partOpener`) is distinct in code; UI wording must be checked in commit 4 so "Part I" (the book concept) and "parts" (list entries) don't confuse — a wording pass, not a model change.
- **Deferred set is real scope pressure**: per-part restart, group-drag, part-in-running-heads, opener typography, TOC indentation — each named here and in `TODO.md` at close, none silently folded in.

## 7. Open questions

None blocking — §2 was CTO-locked and §3 is proposed for approval as a set. If the CTO amends any §3 point (e.g. opener typography now rather than deferred), the commit plan absorbs it without resequencing (it would land as its own theme commit after #4).

## Related
`PART_LEVEL_SCOPE.md` (the measured scope; §0 drift), `part-level-geometry-spike.ts` (the instrument), `MINI_DR_SUBTITLE_SPACING.md` (the sibling empty-title drift + the theme-value precedent), `MINI_DR_EDITORIAL_PLACEMENT.md` (the positional-tag precedent + the `parseMutation` lesson), `MINI_DR_EDITORIAL_PARTS.md` (the count-surface lesson), `CREATE_CHAPTER.md` (the editing-op pattern being extended), `MINI_DR_PAGINATION_REUSE.md` §2.3 (the cache-completeness rule §3.6 tests), ADR-0051 (charged == consumed).
