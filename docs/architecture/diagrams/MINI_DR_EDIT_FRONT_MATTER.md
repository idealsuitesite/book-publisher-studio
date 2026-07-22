# Mini Design Review — Front-matter editing (Phase 3b, `editFrontMatter`)

**Status:** ✅ MERGED to `main` (2026-07-22, no-ff; queue item 3). Built as designed in 4 commits (mini-DR → pure op → boundary → studio card); backend **724/724**, frontend **201/201**, tsc + eslint clean both sides. **Verified live on real faith-alone in the studio:** tagline edited via the card → stored (v2) AND present in the exported DOCX; copyright page removed → **gone from the export, no resurrection** (the Q3 property, now author-triggered end to end) while the tagline survived; Undo → the copyright page back, the tagline intact; zero console errors. Two build notes: the route's guards enforce the same non-emptiness as the pure op so the op's throw is defense-in-depth (never a 500 path), and the §2.6 cache-MISS case was placed *after* the Part chantier's legitimate-hit case so both properties stay pinned. One disclosed nicety: `copyrightText` has no input but is state-carried on Save — replace-whole never wipes it. *(Original status: approved-by-delegation under the CTO queue directive — item 3, technical, established pattern.)*
**Date:** 2026-07-22.
**Re-verified against current code** (non-negotiable #7), on `main` at `c97f757`:
- `FrontMatterBuilder` populates **only** `titlePage` + `copyrightPage` (from metadata, at import, existing-wins — Q3);
- all three renderers render **only** those two sections (+ the generated `toc`): `PDFRenderer.ts:226-242`, DOCX `:197-210`, EPUB `:158-172`. The other typed `FrontMatter` fields (dedication, preface, foreword, introduction, acknowledgments) are **typed-but-unrendered since Sprint 1**;
- **`BookDTO` carries no front matter at all** (grep: zero matches in shared-types) — the frontend has never seen it;
- Q3's proven property (`projectFrontMatterStored.test.ts`): the project path renders **stored** front matter with no synthesis, and **clearing it makes it vanish from the export** — the render tail never resurrects it.

---

## 1. What changes

The author edits (or clears) the **title page** and the **copyright page** of their stored book from the studio — the two sections every export actually renders. Until now these were derived once at import from metadata and untouchable: a typo in the tagline or an updated rights line meant re-importing. The edit rides the established mutation pattern end to end (pure op → `StructureMutation` → generic route → snapshot/undo → Proof re-ink), which is the entire reason Phase 3b is a small chantier.

## 2. Design decisions

1. **Scope = the two RENDERED sections, nothing else.** Editing `dedication`/`preface`/etc. would offer fields no export shows — a UI lie. Extending *rendering* to those fields is its own future chantier (content, not editing); named out.
2. **Mutation semantics — partial, with explicit clearing:** `{ type: 'editFrontMatter', titlePage?: TitlePageDTO | null, copyrightPage?: CopyrightPageDTO | null }`. `undefined` = untouched, `null` = **cleared** (the Q3-proven vanish stays author-expressible — a book with no copyright page is a legitimate choice), object = replaced whole. Field-level patching inside a section is refused complexity: the sections are 4-5 small fields, the form submits them together.
3. **Validation in the pure op** (`BookEditingService.editFrontMatter`): a provided `titlePage` requires non-empty `title` and `author` (the model's required fields — `FrontMatterBuilder`'s own "a blank sheet is worse than none" rule); a provided `copyrightPage` requires non-empty `text`. Violations throw → the route's 400, same as `rename`'s empty-title rule.
4. **Boundary (additive only):** shared-types gains `FrontMatterDTO` (`titlePage`/`copyrightPage`, exactly the rendered shapes); `BookDTO` gains `frontMatter?: FrontMatterDTO`; `BookMapper` crosses it; `parseMutation` whitelists the new variant **with route tests in the same commit** (the `setPartRole` lesson, standing).
5. **Frontend:** a compact "Title page & copyright" editor card in the Structure station (the book-content editing surface) — current values shown, edit-in-place, Save per section, "Remove page" per section; server-authoritative via the existing `editStructure` client; snapshot/undo free; the Proof re-inks via `updatedAt` (no new key work).
6. **Pagination cache:** a front-matter edit is a book change → a new content hash → a MISS by construction; asserted (one case added to the §3.6 invalidation suite — the key-completeness rule stays a tested property, not a hope).
7. **No renderer change, no R2 surface.** Title/copyright pages are renderer-planned front pages already; clearing one changes the planned front-page count, which the metrics ledger already accounts for (`real = model + front pages + unplanned`).

## 3. Verification plan

- **Unit (pure op):** replace title page; replace copyright; clear each (null → field gone); untouched-when-undefined; empty-title/author/text → throw; immutability (ADR-0001).
- **Route:** valid edit → 200 + fresh DTO + snapshot; malformed bodies → `INVALID_MUTATION`; the DTO round-trip carries `frontMatter` (the new crossing).
- **Real fixture (Q3's own property, extended):** on real faith-alone through the real route — edit the title page → the exported PDF/DOCX carries the new title-page text; **clear the copyright page → it vanishes from the export** (no resurrection); undo restores.
- **Cache:** front-matter edit → paginate MISS (the §2.6 case).
- **Live in the studio:** edit tagline + rights on faith-alone → Proof re-inks showing them; remove copyright page → gone from the Proof; undo → back; zero console errors.

## 4. Risks

- **DTO widening** (`BookDTO.frontMatter`) is additive and optional — no existing consumer breaks; jsdom fixtures unaffected until they opt in.
- **A cleared page vs a build-derived page:** clearing stores the absence; a **re-import** (new book) rebuilds from metadata — correct and already Q3's documented semantics (`FRONT_MATTER_PRE_Q3_MIGRATION`'s "re-import" workaround unchanged).
- **Scope creep to unrendered fields or per-field patching:** both named out (§2.1, §2.2).

## Related
STRUCTURE_EDITING.md Q3 (front-matter-as-user-content — the property this edit path completes), STRUCTURE_EDITING_PHASE3.md (the explicit deferral this reopens), `projectFrontMatterStored.test.ts` (the no-resynthesis proof), MINI_DR_EDITORIAL_PLACEMENT (the parseMutation lesson), MINI_DR_PAGINATION_REUSE §2.3 (the cache-key completeness rule), ADR-0001/0027 (immutability / read-only validation).
