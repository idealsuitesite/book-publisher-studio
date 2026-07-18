# User Journeys

Concrete paths through Book Publisher Studio, one per persona (`docs/product/PERSONAS.md`). Each journey is marked with what's real today (post-Sprint-6 backend, Sprint 7 UI) vs. what's a real, named future step — never invented capability presented as if it exists.

## Journey 1 — The Independent Author, preparing a KDP paperback

**Persona:** Independent Author. **Status:** fully supported by the Sprint 7 scope (`docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md`).

1. Opens Book Publisher Studio in a browser.
2. Drags in their manuscript `.docx`.
3. Sees their book's real structure — chapter titles, word count, page count, reading time — and any validation warnings (e.g. a missing ISBN or cover image, per `MetadataRule`/`ComplianceRule`, Sprint 5) surfaced immediately instead of discovered after export.
4. Selects the KDP 6×9 trim size from the format selector (Sprint 6's real preset, Sprint 7's UI for choosing it).
5. Previews the result — sees their actual title in the running head (not a placeholder, Sprint 6's own fix, ADR-0029 Decision 6), correct page numbers, correct physical page size.
6. Exports to PDF for KDP's manuscript upload, and separately to EPUB for Kindle.
7. **Not yet real (named, not built):** one-click KDP submission, cover generation, royalty tracking — `docs/TODO.md`'s Backlog, `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md`'s Publishing Engine, no Sprint assignment yet.

## Journey 2 — The Small Press Editor, validating before print

**Persona:** Small Press / Independent Publisher. **Status:** the validation half is fully real (Sprint 5); the UI to surface it is Sprint 7 scope.

1. Imports a manuscript from one of the press's authors.
2. Reviews the real `ValidationEngine` findings — a `QualityScore` and a list of concrete issues (missing metadata, heading-hierarchy skips, low-resolution images, broken hyperlink syntax) — before spending any time on formatting.
3. Fixes what needs fixing in the original manuscript (outside this product — there is no in-app editor yet, see Journey 2's own "not yet real" note below) and re-imports.
4. Once clean, exports to the press's house trim size and theme.
5. **Not yet real:** in-app editing/correction (the product surfaces findings, it does not yet let an editor fix them without leaving the tool) — this is a real, disclosed gap, not an oversight; `docs/VISION.md`'s Editorial AI Engine section is the eventual home for suggestion/accept-reject workflows, not scoped to any sprint yet.

## Journey 3 — The Educator, preparing course material with a Table of Contents

**Persona:** Educator / Institution. **Status:** the backend capability is fully real (Sprint 6); a fixture that stresses this journey's specific needs (tables, footnotes) is not yet part of the demo's canonical fixture set.

1. Imports a structured manuscript with multiple chapters and sections.
2. Enables automatic Table of Contents generation (Sprint 6, ADR-0031/0032 — real `Chapter`/`Section` titles, real resolved page numbers, not a placeholder).
3. Reviews the generated TOC as part of the structure view.
4. Exports to PDF for distribution to students.
5. **Not yet real:** a canonical academic/technical fixture (heavy on tables/footnotes) is not in `backend/verification/` today — `large-book.docx` exercises multi-chapter TOC generation but not this persona's full feature set. The professional editorial fixture library (`docs/TODO.md` Backlog, deferred until Sprint 7's scope was fixed — now fixed) is the natural place to add one.

## Related

- `docs/product/PERSONAS.md` — who these journeys are for
- `docs/product/PRODUCT_DEMO.md` — Journey 1 is the literal basis for the Demo Script
- `docs/product/FEATURE_MATRIX.md` — which specific features back each journey step
- `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` — the technical Design Review these journeys are checked against
