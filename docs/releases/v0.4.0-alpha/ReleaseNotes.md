# Release Notes — v0.4.0-alpha

**Tag:** `v0.4.0-alpha`
**Date:** 2026-07-17
**Codename:** PDF Export

## Summary

This release adds PDF export alongside the existing DOCX export. A manuscript uploaded to `POST /api/manuscripts/export` can now come back as either `.docx` (default) or `.pdf`, sharing the same import → theme → layout pipeline and differing only in which `Renderer<Buffer>` implementation runs last (ADR-0012). PDFKit (ADR-0014) was chosen back in Sprint 2's Design Review but not implemented until now. Following the same discipline as Sprint 2 — Design Review before code, small atomic commits, green build/tests at every step — a throwaway spike (`backend/spikes/pdfkit-spike.ts`) verified fonts, Unicode, images, tables, page breaks, headers/footers, bleed, and crop marks against real PDFKit output *before* `PDFRenderer` was written, and the findings are recorded in ADR-0019. Built across 5 commits on `feature/sprint-3a-pdf-export`, merged via PR #3.

This release was originally scoped together with EPUB export as "v0.4.0-alpha: Professional Export," per the plan in `docs/TODO.md`. The CTO redirected the sequencing mid-sprint: ship PDF first (PDFKit already decided, all the supporting infrastructure — `ThemeEngine`, `LayoutEngine`, `StyledBook`, `PaginatedBook`, `Renderer<T>` — already existed from Sprint 2, so PDF was "just" a new `Renderer`), and treat the EPUB library choice (ADR-0015, still undecided) as its own spike-first sprint rather than rushing a decision to keep both formats in the same release. EPUB is now `v0.4.1-alpha` (Sprint 3B), not part of this release.

## Features

- **`PDFRenderer`** (`backend/src/infrastructure/renderers/PDFRenderer.ts`) — implements `Renderer<Buffer>`, mirrors `DOCXRenderer`'s block coverage: headings, paragraphs, quotes/scripture (italicized + indented), ordered/unordered lists, tables (drawn manually — PDFKit has no table primitive), footnotes, images (embedded from base64 or a text placeholder — no network fetch inside a renderer), page breaks, and dividers.
- **Font mapping** — theme font families (e.g. `ClassicTheme`'s Georgia) map onto PDFKit's 14 standard fonts by a name heuristic (serif/mono/sans pattern matching), since PDFKit ships no font data of its own and no redistributable font asset has been chosen yet (tracked in `docs/TODO.md`).
- **Headers and footers** — every page gets a running header and an accurate "Page N of TOTAL" footer. Built on `bufferPages: true`: content renders once with no header/footer interference at all, then a second pass stamps every page using the real page count from `doc.bufferedPageRange()` — not an estimate.
- **`POST /api/manuscripts/export` gains a `format` field** (`docx` default, `pdf`) — not a new route. No new Use Case class either: `ExportManuscriptUseCase` was already renderer-agnostic (ADR-0012), so PDF support is just a second instance of it configured with `PDFRenderer` instead of `DOCXRenderer`.
- **Tests** — 6 new `PDFRenderer.test.ts` cases plus 1 new E2E `format=pdf` case in `export.test.ts`, bringing the suite to 125 total (up from 118). A small purpose-built test helper, `src/test-utils/extractPdfText.ts`, extracts rendered text from an uncompressed PDF buffer for assertions — PDFKit encodes shown text as hex-string `TJ`/`Tj` operands, not literal runs a DOCX-style XML search would find, and neither the current major nor the classic 1.x version of the popular `pdf-parse` package could be used (native canvas dependency and pdf.js-too-old-for-PDFKit's-xref-format, respectively).

## Real Bugs Found and Fixed During Implementation

Not just in the spike — all three surfaced while building and verifying `PDFRenderer` itself, and all three are fixed by the same design change:

1. **Stack overflow.** An earlier version drew headers/footers live via PDFKit's `pageAdded` event while content was still flowing. Writing footer text below the page's bottom-margin boundary made PDFKit's own overflow-triggered auto-pagination fire *from inside* the handler that was drawing the footer — which re-emitted `pageAdded`, re-entering the same handler, recursing until the stack overflowed.
2. **Silent page-count blowup.** `doc.text(x, y, ...)` leaves PDFKit's internal cursor stranded just below whatever it wrote. Since the footer was drawn near the bottom of the page, every subsequent content call that omitted explicit coordinates (which is how prose blocks render) continued from that stranded cursor and overflowed onto a new page almost immediately. A 9-page test document rendered as 212 pages before this was caught.
3. **Wrong "Page N of TOTAL."** Caught only by exporting a real DOCX from `backend/uploads/` through the running dev server — not a synthetic fixture. The footer displayed "Page 6 of 4" because `LayoutEngine`'s word-count pagination estimate (ADR-0013) undershot PDFKit's actual rendered page count once real content exceeded it.

**Fix:** rebuild header/footer drawing around `bufferPages: true`. Content renders exactly once, with zero header/footer code running while it flows — eliminating bugs 1 and 2 by construction. A second pass then loops `doc.switchToPage()` over `doc.bufferedPageRange()`, using the *real* page count for "Page N of TOTAL," fixing bug 3. Full detail in ADR-0019, finding 6.

## Architecture

- **Design Review before code**: ADR-0019 (PDF Renderer Spike Findings) records what was verified against real PDFKit output before any renderer code was written — matching the discipline already established for ADR-0012 through ADR-0018 in Sprint 2.
- **No new Application-layer class needed**: `ExportManuscriptUseCase`'s renderer-agnostic design (ADR-0012) meant PDF support required zero Domain or Application changes — exactly the payoff ADR-0012 predicted ("adding Kindle/Kobo/Lulu/IngramSpark later means a new Infrastructure adapter, zero Domain/Application changes").
- **`main` as a production branch** (ADR-0017) held: built entirely on `feature/sprint-3a-pdf-export`, reviewed via PR #3, merged — no direct commits to `main`.

## Quality Metrics

| Metric | Value |
|---|---|
| Tests | 125 passing, 0 failing (up from 118) |
| Domain coverage | 92.64% statements (unchanged — no new Domain code this release) |
| Global coverage | 84.47% statements (down from 88.03% — new Infrastructure/Presentation code has a lighter coverage profile than Domain, matching `DOCXRenderer`'s own existing profile; still clears the >80% gate) |
| ESLint | 0 errors, 0 warnings (unchanged) |
| TypeScript | strict mode, 0 compiler errors |
| Manual verification | A real DOCX from `backend/uploads/` (the same file used to verify Sprint 2's DOCX export) exported to both `.docx` and `.pdf` via the running dev server on merged `main` — both HTTP 200, correct Content-Type, valid output |

## Known Issues / Deliberate Simplifications

Documented in code and in `docs/DECISIONS.md` (ADR-0019), not silent gaps:
- No redistributable font asset shipped yet — `ClassicTheme`'s Georgia isn't licensed for redistribution, and PDFKit ships no font data at all. Theme fonts currently map onto PDFKit's standard-14 fonts by name heuristic. Choosing and licensing a real font asset is an open, undecided item.
- No RTL / multi-script text support — verified no single embedded font covers every script (Arabic renders as blank boxes with the font tested in the spike), and PDFKit does no bidi reordering or Arabic contextual glyph shaping. Real, separate work, not a font swap — flagged, not scheduled.
- `PDFRenderer`'s table rendering does not split a table across a forced page break — matches `LayoutEngine`'s own treatment of a table as one non-splitting unit (ADR-0013), not an inconsistency, but a real edge case for very large tables.
- Setting real `/TrimBox`/`/BleedBox` PDF page-dictionary entries (for print-ready bleed) is only reachable via an undocumented internal PDFKit property, not a supported API — a forward-compatibility risk flagged in ADR-0019 but not exercised by `PDFRenderer` itself yet (no bleed/crop-mark feature has been built, only spiked).

## What This Release Does Not Include

EPUB export (ADR-0015 still needs a library spike — `epub-gen` vs. hand-rolled OCF/OPF/XHTML via `jszip` — before `EPUBRenderer` is written; this is Sprint 3B / v0.4.1-alpha), Typography Engine, fuller `ValidatorEngine` (readability/completeness scoring), plugin system, premium UI, AI features, licensing enforcement, database, authentication, collaboration. See `docs/VISION.md` for the long-term plan and `docs/TODO.md` for what's scheduled next.

## Upgrade / Migration Notes

Nothing to migrate. `POST /api/manuscripts/export` is backward compatible — omitting `format` still returns `.docx`, matching pre-existing client behavior. `POST /api/manuscripts/import` is unaffected. The legacy `POST /api/upload` route remains deprecated but present (ADR-0011, removal still not scheduled to a specific release). Frontend is unaffected.

## Links

- Architecture: `docs/architecture/diagrams/RENDERING_PIPELINE.md`
- Decisions: `docs/DECISIONS.md` (ADR-0019; ADR-0014 for the original PDFKit choice)
- Vision: `docs/VISION.md`
- Current state (living doc): `docs/CURRENT_STATE.md`
- Merge checklist used: `docs/MERGE_CHECKLIST.md`
- Pull request: #3 (`feature/sprint-3a-pdf-export` → `main`, merge commit `820f1ef`)
