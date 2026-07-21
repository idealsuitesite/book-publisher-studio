# Create / Split a Chapter From Unstructured Content — Scope Report (measured, no code)

**Status:** 📋 SCOPE REPORT — read-only, measured on a real 0-chapter manuscript. No production code opened (`GUTTER_SCOPE.md`/`SUBTITLE_SPACING_SCOPE.md` format: measure and locate; the CTO decides the chantier). **Highest-priority next front (CTO 2026-07-21):** this closes the founder's actual gap; subtitle-spacing and per-theme tuning are refinements to structure that already exists.
**Date:** 2026-07-21. Surfaced by the Phase 3 manual validation (the "0-chapter" case).

---

## §0 — The gap, measured (live, on `main` `560ea23`)

Imported `generated-unstyled-3060w.docx` into the running studio. It imports **success, 0 chapters** — `book.mainContent` is **one untitled `Section` holding all 30 paragraph blocks (3,060 words)**. The Structure station shows the ADR-0049 banner + a single row *"⠿ Untitled — 3,060 words"*.

**Phase 3 cannot help here.** Its three operations all assume structure exists: reorder (one item, nothing to reorder), rename (names the one blob, still 3,060 undifferentiated words), undo (N/A). The `StructureMutation` union is `reorderChapters | rename | restoreVersion` — **nothing creates a chapter or splits content.** The app's only advice is the banner's: *"Apply the Word 'Heading 1' style … and import again"* — i.e., go back to Word.

**This is the founder's named requirement** — *"even a raw document must be organizable without going back to Word"* — and the "manual structure correction post-import" demandeur named in `IMPORT_FIDELITY.md` / `EXPLORER_PARITY.md`. Phase 3 delivered the *organize-existing-structure* half; this is the *build-structure-the-import-missed* half, still open. It is also, under another name, the "add a chapter/section from a selected paragraph in one second" capability raised earlier — the anticipation of exactly this gap.

## §1 — What the capability must do

Let an author **turn a paragraph into a chapter (or section) title**, splitting the surrounding content at that boundary — supplying by hand the chapter breaks the importer could not detect. The minimal, gap-closing operation: **promote a block to a chapter.** Its inverse (demote a chapter back to body text / merge) makes it safe to experiment.

## §2 — The shape in the model (read, not assumed)

`Content = Chapter | Section`; both carry `content: Block[]` (`Book.ts`). A 0-chapter book is one `Section { title:'', content: [30 blocks] }`. **Promote block *X* to a chapter** is a pure `Book → Book` transformation (ADR-0001 immutability, exactly like today's `reorderChapters`/`rename`):
- blocks before *X* stay in the current container;
- *X* (a paragraph) becomes a new `Chapter { number, title: X.text, content: [blocks from X+1 up to the next chapter boundary] }`;
- chapters renumber (the `reorderChapters` renumber logic already exists).

No new block type, no AST shape change — only a re-partition of `Block[]` into `Content[]`. This is the same category of pure, testable op `BookEditingService` already houses.

## §3 — Where it lives (mirrors phases 1–3; one genuinely new surface)

| Layer | Addition | Precedent |
|---|---|---|
| **Domain** | `BookEditingService.promoteToChapter(book, blockId)` (+ inverse) — pure, immutable, property-tested on the real 0-chapter fixture | phase 1 (`reorderChapters`/`rename`) |
| **shared-types** | new `StructureMutation` variant(s): `{ type:'promoteToChapter'; blockId }` (+ inverse) | Phase 3 commit 1 |
| **Application** | `EditBookUseCase` already dispatches `StructureMutation` — add the variants; **snapshot-before-edit + undo work for free** | phase 2 CORE |
| **Presentation** | the generic `POST /:id/structure` route already takes any mutation — add shape validation | phase 2 CORE |
| **Frontend** | **the one genuinely new surface: the `StructureEditor` must become block-aware** — today it shows chapter/section *titles* + word counts, NOT the paragraphs. To promote a paragraph, the author must be able to SEE and pick one (at least within an untitled/zero-chapter section), with a clear "Make this a chapter" affordance per block. | Phase 3 `StructureEditor` (extends, not rebuilds) |

## §4 — R2 / determinism: none

Editing produces a new `Book` AST; the same deterministic `ThemeEngine → TypographyResolver → LayoutEngine → Renderer` re-paginates it (as with every phase since phase 2). ADR-0051's charged-equals-consumed contract is **untouched** — no parity re-lock. The risk surface is the *mutation correctness* (splitting `Block[]`, preserving ids/ownership, renumbering) and the *block-aware UX*, not pagination.

## §5 — Risks & open questions (for the mini-review, not decided here)

1. **The editor becoming block-aware is a real UX shift** — today it is title-level. Exposing paragraphs to select one, for a **non-technical author**, without turning the Structure station into a wall of text, is the core design problem (the same "obvious, not just possible" bar Phase 3 held). Likely scoped first to the 0-chapter / untitled-section case where it matters most, rather than every chapter's body at once.
2. **Which operations, minimally?** `promoteToChapter` + an inverse (demote/merge) covers the 0-chapter case. `promoteToSection`, split-mid-paragraph, drag-a-block-between-chapters are richer — recommend deferring, start minimal.
3. **Title source:** the promoted paragraph's text becomes the title verbatim, or the author types it (inline rename already exists — could reuse)?
4. **The UNSTRUCTURED_MANUSCRIPT finding (ADR-0049) clears itself** once real chapters exist — validation recomputes read-only after each edit (already wired), so the banner disappears as the author builds structure. That feedback loop is a feature to lean on, not new work.

## §6 — Recommendation

This is the real missing half of the manual-structure-editing promise, and the only queued item that closes the founder's named gap. It warrants **its own Level-2 Design Review** (like `STRUCTURE_EDITING_PHASE3.md`) — the block-aware editor UX and the split-correctness are non-trivial, and the two-gate discipline applies. **Recommend it as the next chantier, ahead of subtitle-spacing and per-theme tuning** (both refinements to existing structure). No code before that review is approved.

## Related
`STRUCTURE_EDITING.md` (the Level-1 parent — this is the create half its §3 named), `STRUCTURE_EDITING_PHASE3.md` (the organize half, shipped; the `StructureEditor` this extends), `EXPLORER_PARITY.md` / `IMPORT_FIDELITY.md` ("manual structure correction post-import" demandeur), ADR-0049 (the UNSTRUCTURED_MANUSCRIPT finding this lets the author resolve), ADR-0001 (immutable `Book` these ops return), `BookEditingService` (the pure-op home).
