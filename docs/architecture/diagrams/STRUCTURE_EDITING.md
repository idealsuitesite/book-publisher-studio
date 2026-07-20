# Manual Structure Editing — Level-1 Design Review (round 1, OPENED)

**Status:** ✅ APPROVED (CTO 2026-07-21, six decisions locked — §5, all resolved as *implemented*). **PHASE 2 BACKEND COMPLETE AND MERGED to `main`** (2026-07-21): Phase 1 (`992688b`, `BookEditingService` pure ops); Phase 2 CORE (`8b9f65a`, `EditBookUseCase` + generic `POST /:id/structure` mutation route + undo via `restoreVersion`); the **ADR-0052 prerequisite defect fix** (`2015e07` — project export/publish render the stored `project.book`, not re-parsed source bytes, so structure edits reach the output; the CORE commit had left criteria §5/§9 false); and **Q3 front-matter-as-user-content** (`04e479b` — front matter populated once at import, `FrontMatterBuilder` no longer synthesises on the project path, renders stored content; the raw-bytes `/api/manuscripts/*` routes still synthesise). **Phase 3 (frontend) is now IMPLEMENTED** on `feature/structure-editing-phase3` (UNMERGED) — its own Level-2 review `STRUCTURE_EDITING_PHASE3.md` (approved, all 8 commits done): a `StructureEditor` with `@dnd-kit` reorder (ADR-0053), inline rename, single-level undo, and a living Proof that re-inks after an edit. The real drag gesture is proven by `npm run verify-structure-editing` (Playwright). Merge is the CTO's call, as with phase 2. §2/§5 below are the ORIGINAL pre-implementation snapshot — read them as history; the six decisions they pose are all resolved and shipped (Q3's "front matter is generated output, not user content" §2 bullet is now superseded — front matter IS user content since `04e479b`). This is the "own Level-1 Design Review" `EXPLORER_PARITY.md` and `IMPORT_FIDELITY.md` both defer to.
**Date:** 2026-07-21, grounded in code on `main` at `87f555d` and the live audit in `EXPLORER_PARITY.md`.

---

## 1. Objectives

Give authors the **organize** half of finalizing a book: reorder chapters/sections, rename them, and manipulate front/back matter — directly, deterministically, with no paid-AI dependency and no silent-false-positive risk. This is the same real problem the (now-suspended) AI structure detection targeted, solved by author control instead of inference. **Two demandeurs share this exact foundation:** Import Fidelity's "manual structure correction post-import" and the Reedsy-parity audit (`EXPLORER_PARITY.md` §0).

## 2. Current state — evidence, not assumptions (`EXPLORER_PARITY.md`, live-measured)

- **One missing capability class, not four widgets.** The Explorer is a read-only *navigator* by design (PRODUCT_EXPERIENCE §2.3). Live on the real 17-chapter book: `[draggable]` = 0, contenteditable/input inside the Explorer = 0; chapters are not nodes ("Structure — 17 ch · 79 sec" is one nav button).
- **No backend to land on.** `projects.ts` exposes `GET`/`GET :id`/`PATCH settings`/`POST export`/`POST publish` — **no structure mutation of any kind.**
- **The seam already exists, unexposed:** `ProjectService.replaceBook(project, book)` + `snapshot()` — version-before-edit is already the domain's pattern.
- **Front matter is generated output, not user content:** `FrontMatterBuilder` synthesizes title/copyright *at export time only*; import always sets `frontMatter: {}`. So today there is nothing to list, reorder, or add a dedication to (`EXPLORER_PARITY.md` §3).
- **`Book` is immutable** (ADR-0001): every transformation returns a new instance. Any edit must too.
- **The store is durable** (ADR-0048): edits persist through the existing whole-aggregate `save()`; this is no longer forbidden as it would have been pre-persistence.

## 3. The capability class in scope

Reorder chapters/sections (drag-drop), inline rename of chapter/section titles, and front/back matter as manipulable sections. (Per-chapter word counts — the one shallow display gap — were approved and are out of this review, `EXPLORER_PARITY.md` §4.)

## 4. Architecture — the shape this review must fix

| Layer | Proposed |
|---|---|
| **Domain** | A concrete `BookEditingService` (same precedent as `ThemeEngine`/`ASTBuilder`: one correct implementation, no port) — **pure functions, immutable `Book` in → new `Book` out**: `reorder(...)`, `renameChapter/renameSection(...)`, front/back-matter edits. Preserves ids, block ownership, and structural invariants. |
| **Application** | An `EditBookUseCase` that applies an edit, calls `snapshot()` (version-before-edit) then `replaceBook()`, and persists via the existing SQLite whole-aggregate `save()`. Undo = restore a prior version. |
| **Presentation** | New mutation route(s) on the project — shape is Q4. |
| **Frontend** | Editable Explorer nodes (per-chapter, which don't exist today), a drag-drop library (none in `package.json`), inline rename, and front/back-matter editing — the Explorer evolves from navigator to editor. |

## 5. Open decisions — for the CTO (this is a Level-1, so these are the load-bearing ones)

- **Q1 — Mutation surface.** A pure Domain service of functions (recommended: immutable in/out, matches `ThemeEngine`/`ASTBuilder` concrete-service precedent, trivially testable) vs methods on the aggregate. 
- **Q2 — Versioning & undo.** Is **every** edit a `snapshot()` (leveraging the existing mechanism), or are edits batched/debounced into one version? Undo = restore a snapshot. **Storage is a real input:** the 45MB-per-50-versions finding (ADR-0046/`PERSISTENCE.md`) means per-keystroke snapshots would balloon the store — argues for coarse-grained (per-committed-edit) versions.
- **Q3 — Front-matter content model (the biggest one).** Promote front matter to **user content** (import populates it, the user edits it) vs keep it **export-time generated** with user *overrides*. This changes `FrontMatterBuilder`'s role (today it synthesizes; if front matter becomes content, it stops inventing and starts rendering stored content). Has downstream effects on every renderer's front-matter path.
- **Q4 — Route shape.** One generic structured-mutation route (`POST :id/structure`, a typed edit command) vs several verb-specific routes (`/reorder`, `/rename`). Recommend the command shape — one seam, extensible, mirrors how `replaceBook` already takes a whole book.
- **Q5 — Concurrency/persistence.** Edits are stateful writes through the durable store (fine post-ADR-0048). Confirm no optimistic-concurrency need yet (single-author, single-session today).
- **Q6 — Validation interaction.** Validation stays **read-only** (ADR-0027): after an edit, validation recomputes on the next read. Editing never routes through validation — confirm this boundary.

## 6. R2 / determinism — explicitly LOW risk, and why

Editing produces a new `Book` AST; the **same deterministic pipeline** (`ThemeEngine → TypographyResolver → LayoutEngine → Renderer`) re-paginates it. The charged-vs-consumed contract (ADR-0051) is **untouched** — the mechanism is unchanged, only its input differs. **No parity re-lock is needed for editing.** The real risk surface is the *write path*, not pagination:

## 7. Risks
1. **Mutation correctness on a nested immutable AST** (chapters → sections → subsections): reorder/rename must preserve ids and block ownership. Mitigation: pure functions + property tests over real structures (faith-alone's 17ch/79sec).
2. **Immutability discipline** (ADR-0001): every op returns a new `Book`, never mutates. Mitigation: the service signature enforces it; a test asserts the input is unchanged.
3. **Undo/version storage growth** (Q2): coarse-grained snapshots + the ADR-0046 finding as a design constraint.
4. **The front-matter content-model decision** (Q3) ripples into `FrontMatterBuilder` and every renderer's front-matter path — the one decision with wide blast radius.
5. **The Explorer's read-only-navigator design must evolve to an editor** (PRODUCT_EXPERIENCE §2.3) + a new dnd dependency — a real UX shift, not just a widget.

## 8. Commit plan (phased; each phase may earn its own Level-2)
1. **Domain `BookEditingService`** — pure ops, immutable, property-tested. No persistence, routes, or UI.
2. **`EditBookUseCase` + persistence + versioning/undo** — `snapshot()` + `replaceBook()` + `save()`; undo restores.
3. **Presentation mutation route(s)** (Q4 shape).
4. **Frontend** — editable Explorer nodes + dnd + inline rename + front/back-matter editing.
5. **Real-fixture verification throughout:** edit faith-alone (reorder a chapter, rename, add a dedication), re-export, confirm the output reflects the edit and the page count re-derives; undo restores the prior version.

## 9. Acceptance criteria
- A reorder/rename/front-matter edit produces a **new** `Book` (original unmutated) and records a **snapshot**.
- Re-export reflects the edit; the page count re-derives through the unchanged pipeline (no parity-contract change).
- **Undo restores** a prior version.
- Validation recomputes **read-only** after an edit (ADR-0027 held).
- Front matter behaves per the Q3 decision, consistently across all three renderers.

## Related
`EXPLORER_PARITY.md` (the audit this opens), `IMPORT_FIDELITY.md` ("manual structure correction post-import" — the second demandeur), `ProjectService.replaceBook`/`snapshot` (the entry seam), ADR-0001 (immutability), ADR-0027 (validation read-only — editing is a separate write path), ADR-0048/`PERSISTENCE.md` (durable store + the version-growth finding that constrains Q2), PRODUCT_EXPERIENCE §2.3 (the navigator-to-editor evolution), `STRUCTURE_VS_THEME_SCOPE.md` (the scope report that sequenced this alongside the second theme).
