# Explorer Parity — Gap Audit vs the Reedsy Sidebar (Phase 0, Book Presentation System)

**Status:** 🔍 **AUDIT — findings only, no fixes proposed (CTO mandate).** Phase 0 of the Book Presentation System roadmap (CTO direction 2026-07-19: book first, magazine deferred). Same discipline as `IMPORT_FIDELITY.md`/`RENDER_DRIFT.md`: every claim below was verified live or in the real code, none assumed.
**Date:** 2026-07-21
**Method:** code search across `frontend/` and `backend/` (dependency manifest, handlers, routes, services) + live DOM inspection of the real Explorer on a freshly imported real 17-chapter manuscript (`faith-alone-styled.docx`, project `1784503831189-qd10msrg7`).

---

## 0. The headline finding

The four Reedsy points are not four missing widgets — they are one missing **capability class**. L'Atelier's Explorer is a *navigator* (by design: PRODUCT_EXPERIENCE §2.3, "the tree IS the Domain model", read-only); Reedsy's sidebar is an *editor*. Every gap below reduces to the same absent foundation: **structure editing** — no AST-mutation service, no mutation routes, no editable nodes. This is the same foundation "manual structure correction post-import" (scoped out of `IMPORT_FIDELITY.md`, awaiting its own review) needs: the two chantiers share their prerequisite.

Live proof of the class, in one measurement: on the real 17-chapter/79-section book, the Explorer renders **7 interactive elements total — all `<button>`s, one per *view*** (Overview/Structure/Layout/Ready for Print/Proof/Editions/History). Chapters are not nodes: "Structure — 17 ch · 79 sec" is a single navigation button. Document-wide: `[draggable="true"]` count **0**, contenteditable/input/textarea inside the Explorer **0**.

## 1. Drag-and-drop chapter reorder — ABSENT, two layers deep

- **No dnd capability anywhere**: `frontend/package.json` has no drag-and-drop library; zero `draggable`/`onDrag*`/`DragEvent` handlers in `app/`, `components/`, `lib/` (the only drag-adjacent code is the import dropzone, unrelated).
- **Deeper than the missing widget**: there is nothing to drag. Per-chapter UI nodes exist only in `BookStructureView`'s collapsed `<details>` list — plain read-only text (`components/BookStructureView.tsx`).
- **No backend to land on**: the project routes expose `GET /`, `GET /:id`, `PATCH /:id/settings`, `POST /:id/export`, `POST /:id/publish` (`backend/src/presentation/routes/projects.ts`) — no structure mutation of any kind. The natural seam exists unexposed: `ProjectService.replaceBook(project, book)` + `snapshot()` (version-before-edit is already the domain's pattern).
- **Closest existing component**: `buildExplorer()` (`components/studio/Explorer.tsx`) builds the static view tree; it would need per-chapter nodes before any reorder affordance means anything.

## 2. Inline chapter rename from the Explorer — ABSENT

- Zero rename UI: no `contentEditable`, no inline `<input>`, no `onDoubleClick`, no "rename" string anywhere in `frontend/`.
- Backend nuance, verified: `ProjectService.rename()` **exists but renames the PROJECT** (its library name), and **no route exposes even that**. Renaming a *chapter title* is a Book-AST mutation — no service or route for it exists at all. Same seam as §1: `replaceBook` + snapshot.

## 3. Front matter / Back matter as manipulable sections — ABSENT from the UI entirely

- Zero occurrences of `frontMatter`/`backMatter` in any frontend component or page. The Explorer's groups are `Book` (Structure/Images/Citations/Footnotes/Tables), `Production`, `Record` — no front-matter nodes even as display.
- What DOES exist, for precision: the Domain types `Book.frontMatter`/`backMatter` (Sprint 8 era), and `FrontMatterBuilder` synthesizes a title page + copyright **at export time only** (`ExportManuscriptUseCase` — a presentation decision, per its own comment). Import always sets `frontMatter: {}`. So today front matter is *generated output*, not *user content*: nothing to list, nothing to reorder, nothing to add a dedication to.

## 4. Word counts at chapter/section level — ABSENT (display-only gap)

- Global counts are real and live: status bar and dashboard show the book's `wordCount`; the Explorer shows *counts of* chapters/sections ("17 ch · 79 sec"), never words *per* chapter.
- `BookStructureView` shows book-level Words/Pages/Reading-time stats and per-part titles — no per-part words.
- This is the shallowest of the four gaps: `computeBookFacts()` (`frontend/lib/bookFacts.ts`) already walks every block of every chapter; a per-chapter tally is the same walk with a different accumulator. No backend change would be needed. *(Noted as fact, not as a fix — mandate.)*

## 5. Summary table

| Reedsy capability | UI | Backend seam | Gap depth |
|---|---|---|---|
| Drag-drop chapter reorder | ✗ (no nodes, no dnd) | ✗ (no mutation route; `replaceBook` unexposed) | Capability class: structure editing |
| Inline chapter rename | ✗ | ✗ (project-rename exists unexposed; chapter rename = AST edit, nothing exists) | Same class |
| Front/back matter as sections | ✗ (not even displayed) | ✗ (export-time synthesis only; import leaves `{}`) | Same class + content model decision |
| Per-chapter word counts | ✗ (global only) | — (not needed — client-side walk suffices) | Display-only |

## Related

PRODUCT_EXPERIENCE §2.3 (why the Explorer is a navigator today — deliberate, now outgrown for editing), IMPORT_FIDELITY.md ("manual structure correction post-import", scoped out — shares the structure-editing foundation), `ProjectService.replaceBook`/`snapshot` (the domain seam any editing lands on), ADR-0027 (validation stays read-only regardless — editing is a *separate* write path, never validation's).
