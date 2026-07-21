# Editorial-Part Export Placement — Scope Report (measured, no code)

**Status:** 📋 SCOPE REPORT — read-only, measured on `main` (`61d046a`). No production code opened (the `GUTTER_SCOPE.md` / `PER_THEME_TUNING_SCOPE.md` format).
**Date:** 2026-07-21. The CTO's chosen next direction: close the *export* half of the editorial-parts fidelity gap (the studio now reports "Introduction present", but the exported PDF still renders it as a numbered chapter mid-flow — `PROOF_EDITORIAL_CONTROL_SCOPE.md §6`, the B/C territory that was named, never scoped).
**The question the CTO asked:** the real cost of **B** (detect + reclassify at import → DTO → 3 renderers) vs **C** (manual marking, reusing the built `StructureEditor` infrastructure).
**Instrument:** reading every renderer's front/back-matter handling, the `FrontMatter`/`BackMatter` model shapes, and the `StructureMutation` / `BookEditingService` / `EditBookUseCase` path.

---

## §0 — The measured gap: the renderers place NO editorial part today, only title + copyright

All three renderers render **exactly two** front-matter members — `titlePage` and `copyrightPage` — and **nothing else**: `PDFRenderer.ts:226-233`, `DOCXRenderer.ts:206-226`, `EPUBRenderer.ts:158-172` (the TOC is separate, via `paginated.tableOfContents`). **No renderer renders `frontMatter.preface/foreword/introduction/acknowledgments/dedication`, and none renders ANY `backMatter`** (bibliography/appendices/glossary/index/colophon). Populating `frontMatter.introduction` today would render **nothing** — the field is unread.

**This is the load-bearing finding, and it changes the CTO's framing:** the *placement* work — rendering an editorial part before chapter 1 (front) or after the last chapter (back), in all three formats — **does not exist yet and is the COMMON cost of B and C.** B vs C differ only in the *detection* half (§3); the rendering half is the same either way and is the bulk of the work.

## §1 — A structured-type boundary the placement must respect (measured)

A detected editorial part is a top-level `Chapter`/`Section` with `content: Block[]` (generic paragraphs) — faith-alone's "INTRODUCTION" and "Conclusion" are `Chapter`s. The `FrontMatter` fields it would map to are `Section`/`Block`-shaped (`preface`, `foreword`, `introduction`, `acknowledgments`, `dedication`) — **compatible**. But `BackMatter` carries **structured** types: `bibliography: Bibliography { entries: BibEntry[] }`, `glossary: GlossaryTerm[]`, `index: IndexEntry[]` (`Book.ts:362-399`). **A `Block[]` chapter titled "Bibliography" does NOT map to `BibEntry[]`** — you cannot place its paragraphs into a structured entry list without parsing them, which is fragile and a different problem.

**So the realistic placement is POSITIONAL, not structural:** render a detected part's `Block[]` as a Section positioned before/after the main flow (front/back), un-numbered. **Rich structured rendering of a real bibliography/glossary/index is explicitly OUT of a "placement" chantier** — it is its own future work (parsing blocks into entries). This boundary must be stated loud, exactly like `PROOF_EDITORIAL_CONTROL_SCOPE §6` stated the reporting-vs-placement one.

## §2 — Where "placement" lives — the real design question, common to B and C

Two model shapes could carry the placement, both feeding the same new renderer work:

- **§2a — Move the part into `frontMatter`/`backMatter`** (populate the domain Book's front/back). Faithful to the existing model, but hits the §1 mismatch (a Block[] part into a Section-shaped front field is fine; into structured back fields is not — so back-matter parts would need a generic "positioned Section" slot the model does not have today, e.g. `backMatter.sections?: Section[]`).
- **§2b — Keep the part in `mainContent`, tag it with a `role`/`placement`** (`'front' | 'back' | 'chapter'`), and have the LayoutEngine/renderer order front-role parts first, back-role last, and not number them. Sidesteps the structured-type mismatch entirely (parts stay Sections), and the frontend already excludes them from the chapter count (`bookFacts`, this session) — a role tag would make that exclusion authoritative rather than title-derived. Smaller model change, but a new ordering pass in the layout/render tail.

**This choice (§2a vs §2b) is arguably the bigger decision than B vs C**, because it shapes the renderer work both share. Recommend it be locked in the mini-review that follows, not here.

## §3 — B vs C: they differ ONLY in detection

Given §0 (rendering is common) and §2 (model is common), B and C diverge on one axis — **how a part gets its front/back role**:

- **B — detect + reclassify at import (automatic).** The canonical-title classifier exists **only in the frontend** (`editorialParts.ts`, this session) — B needs it in the **backend** at import, then auto-moves/tags matching top-level parts. **The false-positive risk becomes a RENDERING change:** a real chapter titled "Introduction" (or "Conclusion: …") would be **relocated in the exported PDF**, not merely mis-counted — strictly worse than the reporting miscount this session fixed, and it happens silently in the artifact the author ships. Contradicts the doctrine this whole thread has held (author control over inference — `HEURISTIC_STRUCTURE_DETECTION`, `CREATE_CHAPTER`).
- **C — manual marking (author-controlled).** Reuses the **built** structure-editing infrastructure end to end: a new `StructureMutation` variant (e.g. `{ type: 'setPartRole'; id; role }`) alongside the existing five (`StructureMutation.ts`), a new pure `BookEditingService` method (like `promoteToChapter`), the existing `EditBookUseCase` + generic `POST /:id/structure` route + snapshot/undo (free), and the block-aware `StructureEditor` UI extended with a "Move to front / back matter" action beside the existing "Make this a chapter". **Zero false positives** (the author decides), and it can be **suggest-assisted** by the existing frontend classifier ("this looks like an Introduction — move to front matter?", the ADR-0049 suggest-never-assert pattern) without ever auto-relocating content in the export.

## §4 — Cost comparison (measured)

| | Common to B & C | B adds | C adds |
|---|---|---|---|
| **Detection** | — | backend classifier at import + auto-reclassify | one `StructureMutation` variant + one `BookEditingService` method (reuses route/undo) |
| **Model** | the §2 choice (front/back fields **or** a role tag) | — (same) | — (same) |
| **Rendering** | **positioned-Section rendering in all 3 renderers** (§0 — the bulk) | — (same) | — (same) |
| **Frontend** | — | DTO must carry the part's role/placement to *show* the reclassification | `StructureEditor` action (reuses the built editor) + DTO role + optional suggest via the existing classifier |
| **Risk** | the §1 structured-type boundary (disclosed) | **false positive becomes a wrong PDF** (silent, in the shipped artifact) | none new (author-controlled) |

**The headline:** the expensive, load-bearing part — positioned rendering in three formats, plus the §2 model choice — is **identical** for B and C. B's only "saving" is skipping the manual UI, at the cost of a **silent mis-relocation risk in the exported book**; C's only "extra" is a UI action that **reuses infrastructure already built and proven this session**.

## §5 — Recommendation

Recommend **C**, and recommend the follow-up be a **mini Level-2** (the rendering is bounded to positioned Sections; the risky auto-inference is avoided). Rationale, measured: B and C cost the same for the hard part (§0/§2/§4), so B buys nothing but risk — and that risk is the **exact class this thread has spent the session closing** (a silent divergence between what the author intends and what the artifact contains: Q3, ADR-0052, the empty-title drift). C is consistent with the author-control-over-inference doctrine the CTO already chose for chapter creation, reuses the `StructureEditor`/mutation/undo infrastructure end to end, and can still *suggest* via the existing classifier without ever auto-relocating. **Two things the mini-review must lock before any code:** the §2 model shape (front/back fields vs a role tag) and the §1 structured-types boundary (positional only; rich bib/glossary/index rendering explicitly out).

**Not opened here; measure done; awaiting the CTO's go and altitude (B vs C, and — if C — the §2 model choice). No code before that.**

## Related
`PROOF_EDITORIAL_CONTROL_SCOPE.md` §6 (the reporting-vs-placement boundary this closes the other half of), `MINI_DR_EDITORIAL_PARTS.md` (the reporting fix + the frontend `editorialParts.ts` classifier C would reuse to suggest), `CREATE_CHAPTER.md` / `STRUCTURE_EDITING.md` (the author-controlled doctrine + the `StructureMutation`/`BookEditingService`/`EditBookUseCase` infrastructure C extends), `HEURISTIC_STRUCTURE_DETECTION` (why auto-inference — B — is the path this thread has repeatedly declined), ADR-0049 (suggest-never-assert — how C's classifier assist stays honest), ADR-0052 (the shared render tail the positioned rendering lives in), `Book.ts` `FrontMatter`/`BackMatter` (the §1 structured-type shapes).
