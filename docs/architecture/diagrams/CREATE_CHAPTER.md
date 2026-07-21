# Create / Split a Chapter — Level-2 Design Review (round 1, OPENED)

**Status:** ✅ APPROVED + **IMPLEMENTED** (CTO 2026-07-21) on `feature/structure-editing-create` (UNMERGED — merge is the CTO's call, as with phases 2/3). Commits: domain ops (1, incl. the promote→merge round-trip on the 0-chapter fixtures AND faith-alone), shared-types + dispatch + route (2), the block-aware editor (3), live verification (4). **Verified live in the studio (the load-bearing proof):** imported the real 0-chapter `generated-unstyled-3060w.docx`, clicked "Make this a chapter" → a real chapter was created, the ADR-0049 "0 chapters — needs review" banner **cleared** (Structure → "1 ch · 1 sec", Ready-for-Print stopped flagging it), a version snapshotted with Undo available; the DOCX **export reflected the new chapter** (a `Heading1`); **undo** restored the 0-chapter blob. Every handler unit-tested; the promote/merge UX driven by real clicks in jsdom (plain buttons, not a drag — no Playwright needed). Gate green throughout (backend 650/650, frontend 148/148). **Minor observation (not a defect):** promoting a long paragraph makes a long chapter title (title = block text); the author shortens it with the existing inline rename — expected, and pronounced only on the synthetic "word word…" fixture whose paragraphs are pathologically long. **Ordering note:** the exhaustive `never` check in `EditBookUseCase.apply` coupled the shared-types variant to its dispatch, so §7 commits 1+3 folded into one and domain ops led — same commits, dependency-correct order. Locked answers: **§9.1** merge at `mainContent[0]` is **disallowed** (throws; version-undo is the clean exit — no extra model path for a rare case); **§9.2** block rows appear **only in the unstructured container, expand-on-demand elsewhere** (stays strictly on the measured 0-chapter case); **§9.3** an empty leading remainder after promoting a first block is **dropped** (no phantom untitled section for the author to manage). **CTO addition (verify at commit 2):** the promote→merge **round-trip identity test must run on `faith-alone` too**, not only the 0-chapter fixtures — proving merge stays correct in a book that already has chapters (a non-degenerate, multi-container context), before an author with a partially-structured book relies on it. Report at each green commit; **commit 5 (live 0-chapter verification in the studio) is the load-bearing proof** — that the founder can rebuild a book without Word.
**Date:** 2026-07-21, grounded in real code on `main` (`3dd6b8f`) and the live 0-chapter measurement in `CREATE_CHAPTER_SCOPE.md`.
**Parent:** `STRUCTURE_EDITING.md` (Level-1). This is the *create* half its §1 named; Phase 3 (`STRUCTURE_EDITING_PHASE3.md`) shipped the *organize* half. Extends Phase 3's `StructureEditor`, `EditBookUseCase`, `StructureMutation`, `POST /:id/structure` — does not rebuild them.

---

## 🔒 LOCKED SCOPE (CTO 2026-07-21 — a constraint, not a recommendation to revisit)

Round 1 is **strictly** `promoteToChapter` **+ its inverse**, nothing more. **Explicitly OUT** (do not design them in, do not "leave room" that widens the surface): mid-paragraph splitting, dragging a block between chapters, `promoteToSection`, promoting blocks nested inside sub-sections. `CREATE_CHAPTER_SCOPE.md` §0 already established this is not an arbitrary carve — promote-to-chapter is *the* missing thing. The review must not reopen the scope question.

## 1. Objectives

Let a non-technical author **carve chapters, by hand, out of a manuscript the importer could not structure** — turning a selected paragraph into a chapter title and splitting the surrounding content there — without going back to Word. This closes the founder's named gap (`CREATE_CHAPTER_SCOPE.md` §0: a 0-chapter manuscript imports as one untitled section of 30 blocks, and Phase 3's reorder/rename/undo cannot create a chapter). The bar is Phase 3's bar: **obvious, not merely possible**, for a non-technical author.

## 2. Current state — evidence, not assumptions (read on `main` `3dd6b8f`)

- **A 0-chapter manuscript is one untitled `Section` of `Block[]`.** Measured live: `generated-unstyled-3060w.docx` → `book.mainContent = [ Section{ title:'', content:[30 blocks] } ]`. The Structure station shows the ADR-0049 banner + one row "Untitled — 3,060 words".
- **The model is a clean re-partition target.** `Content = Chapter | Section`; both carry `content: Block[]` (`Book.ts:108/126`). `Chapter { number, title, content }`, `Section { title, content, level }`. Blocks carry stable `id` + (for text) `text` — present in `BlockDTO` (id/text on paragraph/heading/quote/scripture), so the frontend can reference and display a block. **No AST shape change is needed** — only splitting a `Block[]` into `Content[]`.
- **`BookEditingService` is the pure-op home** — `reorderChapters`, `rename`, immutable `Book → Book`, `ContentNotFoundError` on a bad id (`BookEditingService.ts`). The renumber logic `promoteToChapter` needs already exists there (reorder renumbers chapters).
- **The write path is complete and generic.** `EditBookUseCase` dispatches a `StructureMutation` (snapshot-before-edit → `replaceBook` → save; undo = `restoreVersion`); `POST /:id/structure` validates any mutation and re-fetches so validation recomputes read-only (ADR-0027, ADR-0049 finding clears itself). `StructureMutation` lives in `shared-types`. **Adding a variant needs no new route, no new use case, no new undo.**
- **The `StructureEditor` is title-level only.** It renders chapter/section titles + word counts + per-chapter drag handles + inline rename. It does **not** render blocks (paragraphs). Making it show paragraphs — for the untitled container — is the one genuinely new surface (Risk 1).

## 3. Locked-decision proposals (for the CTO; the scope itself is already locked above)

- **D1 — The domain op: `BookEditingService.promoteToChapter(book, blockId)`** (+ inverse `mergeChapterIntoPrevious(book, chapterId)`). Pure, immutable, `ContentNotFoundError` on unknown id — the `reorderChapters`/`rename` precedent exactly. `promoteToChapter` finds the **top-level container** (`mainContent[i]`) holding `blockId`, splits its `content` at that block: blocks *before* stay in the original container; the block itself becomes a new `Chapter { title: block.text, content: [blocks after it in that container] }` inserted immediately after; chapters renumber. (Splitting the untitled section is the 0-chapter case; the same op splits an existing chapter at a block boundary — a boundary split, not the excluded mid-paragraph split.)
- **D2 — The inverse is a real op, and a true inverse.** `mergeChapterIntoPrevious(chapterId)`: the chapter's title becomes a paragraph block, and `[prev.content, titleAsParagraph, chapter.content]` merges into the immediately-preceding top-level container — reconstructing the exact pre-promote state. **Open sub-question:** the chapter at `mainContent[0]` has no previous container — disallow the inverse there (throw/no-op) vs. turn it into an untitled section. Recommend **disallow at index 0** (simplest; version-undo still exists). *(This is the "+ its inverse" the CTO locked — not extra scope.)*
- **D3 — Title source = the promoted block's text, verbatim.** No separate title prompt: promoteToChapter uses `block.text` as the chapter title, and the author refines it with the **existing inline rename** (Phase 3). Two locked ops compose; no new input UI.
- **D4 — Promotable blocks = text blocks (`paragraph`/`heading`) in a top-level container.** A block with no text (image/table/divider) cannot become a title; blocks nested inside sub-sections are out (LOCKED scope). The 0-chapter fixtures are all paragraphs, so this covers the gap.
- **D5 — The block-aware editor, scoped to defeat the wall-of-text (Risk 1, the real design problem).** Block rows appear **only where they are needed**: inside an **untitled / zero-chapter container** (expanded by default because that is where the author must act), and **expand-on-demand** for a normal chapter (collapsed by default — a chapter already has a title). Each block row shows its text **truncated** (first ~80 chars) in a **height-capped, internally-scrolling** list (the exact information-hierarchy lesson the old `BookStructureView` `<details>` encoded — a panel's height must never be proportional to manuscript size). Each paragraph row carries one affordance: **"Make this a chapter"**. A chapter the author created carries a **"Merge back"** affordance (the inverse). Nothing else changes about the title-level view Phase 3 shipped.
- **D6 — Everything else reuses Phase 3 unchanged:** `StructureMutation` gains `{ type:'promoteToChapter'; blockId }` and `{ type:'mergeChapterIntoPrevious'; chapterId }` in `shared-types`; `EditBookUseCase` dispatches them (snapshot + undo free); the generic route validates the new shapes; the `editStructure` client already carries any mutation; **server-authoritative apply** (Phase 3 D6). The ADR-0049 banner clears itself as real chapters appear (validation recomputes read-only).

## 4. Architecture impact

- **No rendering-pipeline change, no engine, no R2 surface.** A promote/merge produces a new `Book` AST; the same deterministic `ThemeEngine → TypographyResolver → LayoutEngine → Renderer` re-paginates it. ADR-0051's charged-equals-consumed contract is **untouched** — **no parity re-lock** (unlike the subtitle-spacing chantier). Confirmed against the scope report §4.
- **Additive everywhere:** two `BookEditingService` methods, two `StructureMutation` variants, two `EditBookUseCase` cases, route validation, and the `StructureEditor` block-aware extension. No signature breaks; `Content`/`Block`/`Chapter`/`Section` unchanged.

## 5. Functional / technical specifications (locked before implementation)

- **Domain:** `promoteToChapter(book: Book, blockId: string, now?: Date): Book` — throws `ContentNotFoundError` if no top-level container holds a text block with that id. `mergeChapterIntoPrevious(book: Book, chapterId: string, now?: Date): Book` — throws if not a chapter, or `ContentNotFoundError`/disallowed at index 0. Both return a new `Book`; the input is never mutated (a test asserts it).
- **shared-types:** `StructureMutation |= { type:'promoteToChapter'; blockId:string } | { type:'mergeChapterIntoPrevious'; chapterId:string }`.
- **Route validation** (`ProjectsController.parseMutation`): accept the two shapes (string fields, non-empty).
- **Frontend:** `StructureEditor` renders block rows per D5; a promote/merge calls `editStructure` and applies the returned project (server-authoritative). The promote affordance is a **plain button** — so, unlike Phase 3's drag, the interaction is **fully jsdom-testable** (see §7).

## 6. Risks (named)

1. **Wall-of-text / non-technical clarity** — the core risk, mitigated by D5 (block rows only in the unstructured container + expand-on-demand elsewhere, truncated, height-capped). Verified by a real-fixture browser pass, not just render tests.
2. **Split/merge correctness on the immutable AST** — preserve block ids/ownership, renumber chapters, keep the inverse exact. Mitigation: pure functions + property tests over the **real 0-chapter fixtures** (`generated-unstyled-3060w`, `pm-notes-unstyled-fr`), incl. a round-trip test (promote then merge == identity).
3. **Edge cases:** promoting the first block of a container (before-part becomes empty — allowed? recommend the original container may end empty and is dropped if it has no blocks and no title); merge at index 0 (D2). To settle in the review, not silently.
4. **Scope creep** — the LOCKED constraint is the mitigation; this review must refuse mid-paragraph split / drag-between / promoteToSection if they surface.

## 7. Commit plan (post-approval; one responsibility each, green gate between)

1. **`shared-types`**: the two `StructureMutation` variants; backend imports them (no behaviour change).
2. **Domain `promoteToChapter` + `mergeChapterIntoPrevious`** — pure ops, property-tested on the real 0-chapter fixtures **and on `faith-alone`** (CTO: the promote→merge round-trip identity must hold in an already-chaptered, multi-container book, not only the degenerate single-container case). No routes/UI.
3. **`EditBookUseCase` dispatch + route validation** — snapshot/undo free; route integration tests (200 + snapshot, 400 on bad id).
4. **`StructureEditor` block-aware view (D5)** — block rows in the unstructured container, truncated + height-capped, "Make this a chapter" + "Merge back"; handler unit-tested; the button interaction UX tested with **real user events in jsdom** (no drag → no Playwright needed for the gesture, unlike Phase 3).
5. **Real-fixture verification + docs/ADR reconciliation** — in the running studio: import a 0-chapter manuscript, promote several paragraphs into chapters, confirm the structure rebuilds, the ADR-0049 banner clears, export reflects the new chapters, and merge/undo restores. Reconcile `STRUCTURE_EDITING.md` / `CREATE_CHAPTER_SCOPE.md` / `CURRENT_STATE` / `TODO`; ADR if warranted.

## 8. Acceptance criteria (concrete, inspectable)

- Importing a real 0-chapter manuscript then promoting three paragraphs yields **three real chapters** (numbered 1–3) with the intervening content as their bodies; the leading remainder stays an untitled section (or is dropped if empty).
- The **ADR-0049 "0 chapters — needs review" banner disappears** once a chapter exists (validation recomputes read-only).
- **"Merge back" is the exact inverse** — promote then merge returns the original book (property test **on the 0-chapter fixtures AND on `faith-alone`**) — and version-undo also restores.
- Re-export reflects the new chapters; the page count re-derives through the unchanged pipeline (no parity change).
- The editor holds the studio at **0 axe nodes**; the block list never makes the panel's height proportional to manuscript size (D5).
- No backend rendering test changes value (no R2 impact); backend + frontend suites stay green.

## 9. Open questions — RESOLVED (CTO 2026-07-21)

1. **D2** — merge at `mainContent[0]`: ✅ **disallow** (throws; version-undo is the clean exit — no extra model path for a rare case).
2. **D5** — ✅ **block rows only in the unstructured container, expand-on-demand elsewhere** (stays on the measured 0-chapter case; making promote available everywhere would widen the surface past the locked scope).
3. **Risk 3** — empty leading remainder: ✅ **drop it** (no phantom untitled section; consistent with "editing must be obvious").

**Plus (CTO): the round-trip identity test runs on `faith-alone` too**, not only the 0-chapter fixtures — see §7 commit 2 and §8.

## Related
`CREATE_CHAPTER_SCOPE.md` (the scope report + the locked constraint), `STRUCTURE_EDITING.md` (Level-1 parent — the create half), `STRUCTURE_EDITING_PHASE3.md` (the organize half; the `StructureEditor`/`EditBookUseCase`/`StructureMutation` this extends; D6 server-authoritative), ADR-0049 (the UNSTRUCTURED_MANUSCRIPT finding this lets the author resolve), ADR-0001 (immutable `Book`), ADR-0051 (the R2 contract this leaves untouched), `EXPLORER_PARITY.md`/`IMPORT_FIDELITY.md` ("manual structure correction post-import" demandeur).
