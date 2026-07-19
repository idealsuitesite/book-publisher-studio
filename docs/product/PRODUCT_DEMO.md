# Product Demo

The official demonstration of Book Publisher Studio's first demonstrable product (Sprint 7). This document is what every UI-facing sprint after this one should be checked against: does it still produce this demo, correctly, end to end.

## Objective

Make six sprints of already-built, already-verified backend capability visible and usable for the first time — not add a new engine, not build the final application. A stakeholder (editor, author, partner) should be able to watch or run this demo and understand, without reading any code, what Book Publisher Studio actually does today.

## Features shown

- Real DOCX import, with the manuscript's actual structure (chapters, sections, metadata) displayed
- Real validation findings (`ValidationEngine`, Sprint 5) — warnings and a quality score, not hidden
- Real page-layout selection (A4/A5/KDP trim sizes, Sprint 6) via a real selector, not a hardcoded default
- A real preview of the formatted result before committing to an export
- Real export to all three supported formats — PDF, DOCX, EPUB

## What is deliberately absent

Stated explicitly so nobody mistakes an intentional Sprint 7 boundary for an oversight (matches `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` Decision 3):

- No accounts, no login, no saved projects — nothing persists between browser sessions
- No live/instant preview — changing format triggers a real (fast, but not instantaneous) re-export
- No in-app editing — validation findings are shown, not fixed, inside the product
- No dark mode, no split editor view, no chapter-by-chapter navigation within the preview
- No AI-assisted suggestions, no publishing-platform integration (KDP/Kobo/Apple Books submission)

## Storyboard

A stakeholder opens Book Publisher Studio in a browser. They drag in a real manuscript. Within seconds, they see its actual structure — not a spinner, not a generic success message, but the real chapter list, word count, and any real issues the manuscript has (a missing ISBN, say). They pick a KDP trim size from a dropdown that was populated by the backend, not hardcoded into the page. They click Preview and see a real, correctly-sized, correctly-titled PDF page appear inline. They click Export, and a real file downloads — one they could genuinely hand to a printer or upload to KDP. They repeat for DOCX and EPUB. Nothing shown was faked, mocked, or pre-rendered for the demo — every screen reflects a real request to the real backend built across Sprints 1-6.

## Demo Script

> **Superseded 2026-07-19 (HOME_WORKSPACE.md §0, CTO-approved):** the vertical-pipeline demo below this box was Sprint 7's script, written when the product was a conversion. The product is now a studio with a Home (the library) and a Workspace (one book, stations). The current script IS the complete user journey the navigation review defined, and `frontend/scripts/capture-baseline.mjs` drives it verbatim with a real browser and the real fixture.

```
1. Launch Book Publisher Studio → Home (the library, honest empty state)
       ↓
2. Import large-book.docx → a project is created, redirect to its Workspace
       ↓
3. Manuscript station — the book, its structure collapsed behind "Structure — 15 parts"
       ↓
4. Layout station — pick KDP 6"×9"; settings persist ON THE PROJECT
       ↓
5. Preview station — a real PDF rendered from the STORED source (no re-upload)
       ↓
6. Publish station — real KDP validation; the attempt enters the project history
       ↓
7. Back Home — the library shows the project, its version, the statistics
```

Uses `backend/verification/large-book.docx` — the canonical fixture (15 real chapters, ADR-0031). The expected Publish outcome on this fixture is an honest **FAIL** (missing ISBN, no cover image) — the demo deliberately shows the product telling the truth about a manuscript, which is its job.

## Expected screenshots

One per Demo Script step where the screen materially changes — see `docs/demo/screenshots/README.md` for the exact file naming and capture instructions.

## Demo scenarios

**Primary scenario (the Demo Script above):** `large-book.docx`, clean multi-chapter structure, demonstrates structure view, format switching, and all 3 exports.

**Secondary scenario (validation findings):** `backend/verification/typography-test.docx`, which real Sprint 5 verification already confirmed produces real warnings (missing ISBN/description/cover image, `score.overall` 60/100 — see `docs/CURRENT_STATE.md`'s Sprint 5 section) — demonstrates the warnings panel with real, non-empty content instead of an empty-state screenshot that proves nothing.

## Related

- `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` — the technical Design Review this demo is built from
- `docs/product/PRODUCT_ACCEPTANCE.md` — the user-facing success criteria this demo is judged against
- `docs/product/WIREFRAMES.md` — the screen structure behind each Demo Script step
- `docs/demo/screenshots/README.md` — where the real captures from this script live
