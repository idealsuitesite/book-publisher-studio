# Mini Design Review — Editorial-part export placement (Option C + §2b)

**Status:** AWAITING CTO REVIEW — **no code written.** The chantier chosen from `EDITORIAL_PLACEMENT_SCOPE.md`, with two points **pre-locked by the CTO** (2026-07-21): **Option C** (manual marking, never automatic inference in the exported artifact) and **model §2b** (a `role` tag on `mainContent` Sections, ordering handled by the LayoutEngine/renderer — not a move into `frontMatter`/`backMatter`). The §1 positional-only boundary is locked and restated loud below.
**Date:** 2026-07-21
**Re-verified against current code** (non-negotiable #7): the render flow (`PDFRenderer.ts:216-243`), chapter-number usage, `StructureMutation` / `BookEditingService`, and the `Chapter`/`Section` model re-read on `main` (`84c1bc8`).

---

## 1. What changes

An author marks a top-level part (Introduction, Bibliography, …) as **front** or **back** matter in the `StructureEditor`; the export then **positions** it — front-role parts before chapter 1, back-role parts after the last chapter — in all three formats, un-numbered, while the studio keeps document order with a role badge. Author-controlled (never auto-relocated in the artifact), and the ordering is a render-time derivation of the stored book (ADR-0052), so export and publish order identically.

## 2. The locked boundary (§1 of the scope — restated loud, as the CTO required)

**Placement is POSITIONAL, not STRUCTURAL.** A detected part is a `Chapter`/`Section` with `content: Block[]`. This chantier positions that Section before/after the main flow. It does **NOT** parse a "Bibliography" part's paragraphs into `BackMatter.bibliography.entries: BibEntry[]`, nor a glossary into `GlossaryTerm[]`, nor an index into `IndexEntry[]`. **Rich structured rendering of bibliography / glossary / index is explicitly OUT of scope — its own future chantier** (block-to-entry parsing). Exactly the boundary `PROOF_EDITORIAL_CONTROL_SCOPE §6` drew between reporting and placement; this one draws it between positioning and structuring.

## 3. Two measured findings that shape the design

1. **Renumbering is NOT needed (out of scope by measurement).** `Chapter.number` is **never rendered as a chapter label** — every `.number` in the renderers is a *page* number (`owner.number`, `startPageNumber`) or a *footnote* number; the visible "Chapter One" is title **text** from the source. So moving a part to front/back leaves no visible numbering gap, and the real chapters need no renumber. (The frontend already stopped counting editorial parts as chapters this session; §5 makes that authoritative via the tag.)
2. **Ordering before pagination makes the whole pipeline follow.** The render flow is front-matter pages (title/copyright) → TOC → body(`mainContent`) (`PDFRenderer.ts:216-243`); the LayoutEngine paginates `mainContent` in order and derives the TOC and running heads from it. So a single pure **`orderByRole(mainContent)`** applied in the shared render tail *before* pagination carries through pagination, TOC and running heads automatically — no per-renderer ordering code.

## 4. The plan (§2b, all bounded)

**Model + ordering (backend):**
- `role?: 'front' | 'back'` on `Chapter`/`Section` (absent = ordinary main content). Additive, no shape change.
- A pure `orderByRole(book): Book` — front-role top-level parts first, role-absent parts next (document order preserved within each group), back-role parts last — applied in the shared render tail (`renderBook`/`publishBook`) *before* `applyTheme`. The **stored** book keeps document order + tags; only the render orders (mirrors `FrontMatterBuilder`'s render-time derivation, ADR-0052).

**Manual marking (the Option-C infrastructure, mostly reused):**
- A new `StructureMutation` variant `{ type: 'setPartRole'; id; role: 'front' | 'back' | 'main' }` beside the existing five; a pure `BookEditingService.setPartRole` (like `promoteToChapter`); the existing `EditBookUseCase` + `POST /:id/structure` route + snapshot/undo (free).
- `StructureEditor`: a "Move to front matter / back matter" action (and revert to main) beside the existing "Make this a chapter". **Suggest-assisted** by the frontend `editorialParts.ts` classifier already built ("this looks like an Introduction — move to front matter?"), the ADR-0049 suggest-never-assert pattern — the author still confirms; nothing auto-relocates.

**Transport + count (frontend):**
- `ChapterDTO`/`SectionDTO` gain `role?` so the studio shows the badge and the editor can mark it.
- `computeBookFacts` excludes role-tagged parts from the chapter count **by tag** (authoritative), superseding this session's by-title exclusion — a robustness improvement, not a rewrite.

## 5. Sub-decisions to lock (the two big ones are pre-locked; these remain)

1. **Studio display of a tagged part** — recommend **badge-in-place** (the `StructureEditor` keeps document order and shows a "Front matter"/"Back matter" badge), not a re-grouped studio view. The *export* is where order becomes real; re-grouping the studio too is more work for little gain and can follow with usage evidence.
2. **TOC inclusion** — front/back parts stay `Chapter`/`Section`, so the auto-TOC includes them, now correctly positioned (preface before, bibliography after). Recommend **leave them in the TOC** (a bibliography belongs in the contents); revisit only if the CTO wants front/back parts excluded.
3. **Suggest-assist in or out** — recommend **in** (the classifier exists; a one-line "looks like X" suggestion is cheap and honest), but it is severable if the CTO wants the first cut purely manual.

## 6. Verification plan

- **Placement, tri-format, on real content:** mark faith-alone's "INTRODUCTION" front and "Conclusion" back → the exported PDF/DOCX/EPUB render the Introduction **before** chapter 1 and the Conclusion **after** the last chapter — asserted on real output (heading order in the produced artifact), on both the export and publish tails (shared `orderByRole`).
- **Ordering is stable and pure:** `orderByRole` preserves intra-group document order; a book with no roles is byte-identical to today (the no-op case, so nothing regresses).
- **Round-trip:** `setPartRole` → save → re-read carries the role; undo restores; the frontend count excludes the tagged part.
- **The boundary holds:** a "Bibliography" part renders as its positioned paragraphs, NOT as structured entries — asserted, so the §2 boundary can't silently creep.
- **Live:** in the studio, mark Introduction as front matter → export → open the PDF and confirm it opens on the Introduction before Chapter One; the studio shows the badge, the chapter count is unchanged (already excluded).

## 7. Risks

- **Boundary creep** into structured bib/glossary/index rendering — closed by §2 (loud) and the §6 boundary test.
- **A no-role regression** — `orderByRole` must be an exact no-op when no part is tagged; the byte-identical test is its guard.
- **Studio/export order divergence confusing an author** — the studio shows document order + badge, the export positions; §5.1 keeps this simple, and the badge names the future position. Disclosed.
- **Never auto-relocate** — the suggest-assist only *proposes*; the role changes solely through an author action. This is the whole point of choosing C; the tests assert no role is set without a mutation.

## 8. What the CTO is asked to lock
The two headline decisions (C; §2b) and the §1 boundary are already locked. Remaining: the three §5 sub-decisions (badge-in-place display; TOC inclusion; suggest-assist in/out).

**No code until these are locked.**

## Related
`EDITORIAL_PLACEMENT_SCOPE.md` (the measured scope — C + §2b chosen), `PROOF_EDITORIAL_CONTROL_SCOPE.md` §6 (the reporting half this completes), `MINI_DR_EDITORIAL_PARTS.md` (the `editorialParts.ts` classifier the suggest-assist reuses; the by-title count exclusion this makes by-tag), `CREATE_CHAPTER.md` / `STRUCTURE_EDITING.md` (the `StructureMutation`/`BookEditingService`/`EditBookUseCase`/undo infrastructure extended), ADR-0049 (suggest-never-assert — how the assist stays honest), ADR-0052 (the shared render tail `orderByRole` lives in), `Book.ts` `FrontMatter`/`BackMatter` (the §2 structured shapes deliberately left untouched).
