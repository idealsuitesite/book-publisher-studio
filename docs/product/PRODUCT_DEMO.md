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

The literal, numbered sequence this demo runs — also `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` §6 commit 10's real-file verification pass, and the basis for the screenshot set in `docs/demo/screenshots/README.md`.

```
1. Launch Book Publisher Studio
       ↓
2. Import large-book.docx
       ↓
3. See the chapters
       ↓
4. See the warnings
       ↓
5. Change A4 → KDP
       ↓
6. Preview
       ↓
7. Export PDF
       ↓
8. Export EPUB
       ↓
9. Export DOCX
```

Uses `backend/verification/large-book.docx` — the canonical fixture already used for pagination/performance verification (`docs/DEVELOPMENT_WORKFLOW.md`'s "Which fixture to use"), real enough (15 real chapters, per Sprint 6's own real-file findings, ADR-0031) to show genuine structure, format switching, and multi-format export in one run.

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
