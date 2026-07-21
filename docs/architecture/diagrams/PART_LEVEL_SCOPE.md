# The "Part" level (Part I / Part II) — Scope Report, not a Design Review

**Status:** SCOPE REPORT for CTO decision. **No production code written.** Opens the `PART_LEVEL_STRUCTURE` backlog entry (three independent sources; Atticus and Vellum both ship "Volumes and Parts" as a major feature — a category standard this model lacks).
**Date:** 2026-07-21, grounded in code read on `main` at `036b873` and one geometry measurement (`backend/spikes/part-level-geometry-spike.ts`) — read and measured, not assumed.
**Purpose:** enough for the CTO to decide the shape and order of the chantier; the Design Review that follows locks the design. Same discipline as `GUTTER_SCOPE.md`.

---

## 0. The headline: a Part opener is NOT already expressible — the obvious shape carries a real, measured ADR-0051 drift today

The natural minimal Part opener — **a titled, empty-content top-level Chapter** ("Part I: …", zero blocks), reusing the chapter-starts-a-new-page rule — was probed on real faith-alone (kdp-6x9, classic, auto-TOC on), base vs +3 openers:

| | model pages | real pages | unplanned breaks | TOC entries |
|---|---|---|---|---|
| base | 155 | 161 | 3 | 95 |
| +3 openers | **155 (+0)** | **164 (+3)** | **6 (+3)** | 98 (+3, includes the Parts) |

**The model does not see them; the renderer draws them.** `LayoutEngine.walkContent` flushes pages per *block* (`LayoutEngine.ts:251-298`) — a content entry with no blocks never triggers a flush and its `titleHeightOf` is never charged — while all three renderers emit the title regardless of block count (PDF: proven by the +3 real pages, each an unplanned reconciliation; EPUB: `EPUBRenderer.ts:208-210` emits `<h1>` on `content.title` alone; DOCX: `renderTitle` references the same title styles). This is the exact inverse of the empty-title drift `MINI_DR_SUBTITLE_SPACING` closed (an *untitled* section *with* blocks); the blockless-titled shape was simply never reachable from a real import, so nothing ever charged it.

**Consequence for the chantier:** whatever shape "Part" takes, its **first prerequisite commit is closing this seam** — teach the model that a titled, blockless top-level content owns a page (charge `titleHeightOf`, flush a page) — with the R2 guard being **byte-identical output when no Part exists** and a conscious parity re-lock only for books that have them. Observable today, loud not silent (the 3 breaks are counted and logged, ADR-0051 held), but a Part feature cannot ship on top of a known drift.

*(Also measured in passing: the TOC consumer already works — `buildTableOfContents` walks titles, not blocks, so the openers landed in the TOC with no change. One of the three render consumers is already correct.)*

---

## 1. The model: a closed union, and the real blast radius of extending it

`Content = Chapter | Section` (`Book.ts:106`) — a closed discriminated union; `mainContent: Content[]` is flat at the top level. Every consumer walks it discriminating on `type`. Measured: **60 occurrences of `mainContent` across 20 backend files** (renderers ×3, LayoutEngine, ThemeEngine, TypographyResolver, ASTBuilder, BookValidator, BookMetricsCalculator, countBookWords, orderByRole, editing service, validation rules, DTO mapper…) **+ 11 across 3 frontend files** (`StructureEditor`, `bookFacts`, the Playwright verify script). That count is the honest price tag of a *structural* union extension: a new `Part` node type (`Part { chapters: Chapter[] }`) forces every one of those walkers to handle a third case, plus the DTO mirror (`ContentDTO`) and `shared-types`.

**Two shapes are genuinely on the table, and the codebase's own precedents both point the same way:**

- **Shape A — structural: `Content = Part | Chapter | Section`, `Part` contains its chapters.** A true tree level. Richest semantics (per-part operations are trivial), but the 60-site blast radius above, a DTO/shared-types break, and every recursive walker rewritten. Nothing in the category feature (a divider page + TOC grouping + optional per-part numbering) *requires* containment.
- **Shape B — flat: a Part is a top-level *opener entry*, grouping by position.** A Chapter-shaped (or minimally-new) entry marked as a part opener; the chapters "in" a part are simply those between it and the next opener — exactly how `role?: PartRole` placed editorial parts positionally without moving them (`Book.ts:109-116`), and how the TOC is already a **flat, level-annotated list whose nesting was deliberately deferred rather than guessed** (`Book.ts:424-434`, ADR-0029 Risk 5 restraint). Walkers keep working untouched; rendering/TOC/numbering read the flag.

This report does not choose — but it notes that Shape B is additive, reversible, and matches two standing precedents, while Shape A's cost is measured at 60 sites for semantics the feature does not yet need.

---

## 2. Editing: the `promoteToChapter` pattern extends cleanly — with one real question

`BookEditingService` (read in full) is pure top-level `Content[]` re-partition + `renumberChapters`, wired through the generic `StructureMutation` → `EditBookUseCase` → one route, with snapshot-before-edit and undo **free** (the CREATE_CHAPTER inheritance). A Part's ops — `insertPartOpener(book, index, title)` / `removePartOpener(id)` (+ rename, which already works on any titled content) — are *simpler* than `promoteToChapter` (no block splitting, no remainder rule). The pattern extends; no new infrastructure.

**The one real editing question (CTO decision for the DR): chapter numbering across parts.** `renumberChapters` numbers top-level chapters 1..N continuously. If an opener is Chapter-shaped it would *consume a number* (wrong); and the category convention splits — some books number continuously through parts, others restart per part. This must be a locked decision, not a default: (a) openers excluded from numbering (mandatory), (b) continuous vs per-part restart (a real product choice; Vellum exposes it as an option — recommend continuous in round 1, restart deferred).

---

## 3. The three render consumers (read against current code)

| Consumer | State | What a Part needs |
|---|---|---|
| **Pagination** (`LayoutEngine.walkContent` + `titleHeightOf`) | **The measured §0 drift** — blockless titled content never charged | The prerequisite fix; then an opener page is priced like any chapter title (24pt today; a Part opener plausibly larger — a theme value, per the subtitle-spacing precedent, NOT a hardcode). `Chapter.openingPageStyle: 'right'` **already exists** for recto-forcing an opener — reusable as-is. |
| **TOC** (`buildTableOfContents`) | **Already works, measured** (95→98, openers included via the title walk) | Only presentation: a Part entry's level/indent (the flat TOC's `level` field already expresses it). |
| **Running heads** (`Page.headerFooterTitle` = `currentTopLevelTitle`) | Works positionally | Chapter pages keep showing their chapter (Shape B leaves this untouched — the opener only owns its own page's title). A "part title in the running head" variant is a future theme option, not round 1. |

EPUB: an opener becomes its own file/section with an `<h1>` — correct shape already. DOCX: `renderTitle` draws it; pagination is Word's own (not R2-locked). **PDF is the only parity-relevant consumer, and its cost is the §0 seam + a conscious re-lock for part-bearing books.**

---

## 4. Frontend (`StructureEditor`): flat list, one deferred UX question

The editor renders `book.mainContent` flat (dnd items are top-level ids; per-type row headers; "X parts · drag to reorder"). Shape B slots in as a new row kind (an opener row with its own affordance — "Insert a part here" / rename / remove), reusing reorder/rename/undo as-is. **The real UX question to defer, stated now so it is not discovered mid-build:** does dragging a part opener drag its chapters with it? Under positional grouping the honest round-1 answer is *no — entries move individually* (matching the model), with group-drag as a future enhancement; the DR should lock this explicitly.

---

## 5. What this report asserts, and stops at

1. **The prerequisite is measured, not hypothetical:** the blockless-titled-content drift (§0) must close first, guarded byte-identical-when-absent — it is also, independently, a latent-correctness win of the same family as the subtitle-spacing empty-title closure.
2. **Shape B (flat opener + positional grouping) is the measured-cheap path** — additive, walkers untouched, two standing precedents (`role` tag, flat TOC), `openingPageStyle` reusable; Shape A costs 60 sites for containment semantics the feature does not need in round 1. The choice is the CTO's, in the Design Review.
3. **The editing pattern extends** (simpler ops than `promoteToChapter`, undo free); the numbering rule (openers excluded; continuous vs restart) is the one product decision to lock.
4. **Two of three render consumers are near-free** (TOC works today; running heads untouched under Shape B); pagination carries the §0 fix + a parity re-lock for part-bearing books only.
5. **Deferred, named:** per-part chapter-number restart; part title in running heads; group-drag in the editor; any import-side Part *detection* (nothing in a DOCX marks a Part — this is an authoring feature, created in the studio, consistent with `HEURISTIC_STRUCTURE_DETECTION`'s closure).

Next step if the CTO validates the direction: a Level-2 Design Review (`PART_LEVEL_STRUCTURE.md`) locking shape, numbering, the drift-fix commit plan, and the R2 guards — no code before its approval.

---

## Evidence index (all on `main` at `036b873`)
- `backend/spikes/part-level-geometry-spike.ts` — the §0 measurement (base 155/161/3 vs +3 openers 155/164/6; TOC 95→98).
- `Book.ts:106` (`Content` union), `:109-116` (`PartRole` positional precedent), `:118-135` (`Chapter.openingPageStyle`), `:424-434` (flat TOC, nesting deferred).
- `LayoutEngine.ts:251-298` (`walkContent` flushes per block — the drift seam), `:125-135` (`titleHeightOf`), `:48-56` (`currentTopLevelTitle` → running heads), `:324+` (`buildTableOfContents` walks titles).
- `EPUBRenderer.ts:208-210` (title emitted on `content.title` alone); `DOCXRenderer.ts:47-58` (`renderTitle` style sharing).
- `BookEditingService.ts` (read in full — the pure re-partition pattern + `renumberChapters:176-184`).
- `StructureEditor.tsx:449-575` (flat dnd list over `mainContent`).
- Grep counts: `mainContent` — 60 occurrences / 20 backend files (non-test), 11 / 3 frontend files.
- `docs/TODO.md` → `PART_LEVEL_STRUCTURE` (the three independent sources).
