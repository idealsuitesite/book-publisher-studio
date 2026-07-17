# Release Notes — v0.7.0-alpha

**Tag:** `v0.7.0-alpha`
**Date:** 2026-07-17
**Codename:** Professional Layout Engine

## Summary

This release extends `LayoutEngine` (not a new class, ADR-0029) to close the gap between what it did before this sprint (pagination estimate + heading keep-with-next only) and its long-standing target scope in `docs/VISION.md`: pagination, margins, headers/footers, chapter-opening-page rules, TOC generation. It replaces a hardcoded `'Book Publisher Studio'` PDF running-head string with real, `Theme`-driven header/footer content showing the actual book's title; gives DOCX header/footer support for the first time; adds real trim-size presets (A4, A5, three KDP sizes) selectable per export; activates `Chapter.openingPageStyle`/`startPageNumber`; and automatically generates a Table of Contents from a manuscript's structure.

A Design Review preceded any code (`docs/architecture/diagrams/PROFESSIONAL_LAYOUT_ENGINE.md`, ADR-0029), chosen from the 4 remaining Level-1-mapped engines for its lowest-risk profile — same reasoning that selected Validation Engine for Sprint 5. A real KDP/platform trim-size spike (`backend/spikes/kdp-trim-size-spike.ts`, ADR-0030) was completed as commit 0, before any preset code, matching the ADR-0019/0020 precedent. Built across 10 numbered implementation commits plus 2 disclosed fix commits on `feature/sprint-6-professional-layout-engine`, merged via PR #11. Full retrospective: `docs/releases/v0.7.0-alpha/SPRINT_6_FINAL_REPORT.md`.

## Features

- **Real `PageLayout` presets** (`backend/src/domain/layouts/`): `A4PageLayout`, `A5PageLayout`, `KDP5x8PageLayout`, `KDP5_5x8_5PageLayout`, `KDP6x9PageLayout` — exact dimensions verified against PDFKit's own runtime output (A4/A5) and Amazon KDP's own published trim-size table (KDP sizes), not guessed.
- **`LayoutSelector` port + `ManualLayoutSelector`** — `ExportController` no longer hardcodes `LetterPageLayout`; `POST /api/manuscripts/export` gains an optional `layout` field (mirrors `theme`), resolved through the same name-lookup shape as `getTheme()`. Unknown names return HTTP 400. `AutomaticLayoutSelector` is named and designed for (ADR-0029 Decision 5) as the future content-driven selection heuristic, not built this release.
- **`RunningHead` on `Theme`** (additive) — `show`/`position`/`content`/`pageNumber`/`separator`/`uppercase`/`font`/`size`. `ClassicTheme` gets a real populated value; a theme can opt out entirely (`show: false`).
- **Real per-page header/footer in `PDFRenderer` and `DOCXRenderer`** — both now show the actual book's title instead of a hardcoded literal, and a real page number. `DOCXRenderer`'s footer uses Word's own live `PAGE`/`NUMPAGES` fields, recalculated by Word itself as the document reflows.
- **`Chapter.openingPageStyle`** (`'right'`/`'left'`) — inserts a genuinely blank physical page when needed to force a chapter onto the correct recto/verso side, standard print convention (odd = right, even = left).
- **`Chapter.startPageNumber`** — resets the displayed page-number sequence starting at that chapter; subsequent pages keep incrementing from the reset value.
- **Automatic Table of Contents generation** — walks a manuscript's `Chapter`/`Section` structure post-pagination, resolves each entry's real page number, and renders it as real front-matter content in both PDF and DOCX output. Only runs when `Book.frontMatter.toc.generateAutomatically` is true; a manually-authored TOC is never touched (`Book` is immutable, ADR-0001).
- **EPUB confirmed unaffected** (ADR-0029 Decision 3) — EPUB is reflowable, with no fixed page to attach a running head, page number, or TOC page to; `EPUBRenderer` never references any of this release's new fields.
- **Tests** — 46 new tests (up from 282 to 328), covering real PDFKit/`docx`-library output (not mocks): real `/MediaBox` values, real `<w:pgSz>`/`<w:pgMar>`/`<w:pageBreakBefore/>` XML, real extracted PDF text.

## Real Bugs Found and Fixed During Real-File Verification (ADR-0031)

Two real, would-have-shipped-broken bugs were found and fixed as explicit scope exceptions, not deferred — same precedent as ADR-0026 (Sprint 4):

1. **Neither renderer had ever consumed `PageLayout` for real page geometry.** `LayoutEngine.paginate()` received a `layout` parameter, used it for pagination-height math, then discarded it. Every new preset this release added would have had zero effect on actual rendered output. Fixed: `PaginatedBook.pageLayout` (additive) is now populated by `LayoutEngine.paginate()`; both renderers read it for real geometry.
2. **Automatic TOC generation produced a permanently empty TOC on every real import.** The original implementation walked only content-level `Heading` blocks, matching the Design Review's own wording — but real DOCX imports never produce one: `ASTBuilder` structurally consumes every real heading into a `Chapter`/`Section` boundary. Found and fixed against the real `large-book.docx` fixture (15 real chapters); re-verified fixed against the same fixture.

## Architecture

- **Design Review before code** (`docs/architecture/diagrams/PROFESSIONAL_LAYOUT_ENGINE.md`), a real trim-size spike before any preset code (`backend/spikes/kdp-trim-size-spike.ts`, ADR-0030).
- **`LayoutEngine` extended, not replaced** (ADR-0029 Decision 1) — running headers, footers, page numbering, TOC generation, and `Chapter.openingPageStyle`/`startPageNumber` are all computed during pagination, from data pagination already produces. `LayoutEngine.paginate()`'s public signature is unchanged.
- **`LayoutSelector` is a port with one real implementation** (`ManualLayoutSelector`) — deliberately distinguished from ADR-0028's "don't register a no-op rule" principle: a port with one real, in-use adapter today isn't the same as a stub sitting unused in a registry (same shape `Renderer<TOutput>` already has, ADR-0012).
- **ADR-0030 — KDP/Platform Trim-Size Spike Findings.** Records the verified dimensions and the two-independent-source method used.
- **ADR-0031 — Two Real Bugs Fixed During Real-File Verification.** Full detail on both findings above.
- **`main` as a production branch** (ADR-0017) held: built entirely on `feature/sprint-6-professional-layout-engine`, merged via PR #11 — no direct code commits to `main`.

## Quality Metrics

| Metric | Value |
|---|---|
| Tests | 328 passing, 0 failing (up from 282) |
| Global coverage | 92.78% statements |
| Domain coverage | 93.75% statements |
| ESLint | 0 errors, 0 warnings |
| TypeScript | strict mode, 0 compiler errors |
| `npm run verify-real-export` | 16/16 (4 canonical fixtures × import + export-docx/pdf/epub) |
| Manual verification | Real HTTP exports of `typography-test.docx` at A4/KDP-6x9/Letter inspected directly (`/MediaBox`, `<w:pgSz>`), real running-head titles confirmed against `word/header1.xml` and PDF text extraction, real TOC generation re-verified against `large-book.docx`'s 15 real chapters — not just asserted via `npm test` |

## Known Issues / Deliberate Simplifications

- `Chapter.openingPageStyle`, `Chapter.startPageNumber`, and `Book.frontMatter.toc.generateAutomatically` have no DOCX-native signal `ASTBuilder` can set from real content — not reachable through a real DOCX upload today (same category as Sprint 5's `isbn`/`description`/`coverImage` finding). Fully implemented and verified against real rendering libraries; scoped for a future "Import Fidelity" sprint.
- DOCX header/footer is document-wide, not per-chapter — `RunningHead.content: 'chapterTitle'` and `Chapter.startPageNumber` both need real per-chapter behavior that would require splitting `DOCXRenderer`'s single Word section into multiple sections. Doesn't affect `ClassicTheme`.
- `AutomaticLayoutSelector` is named and designed for but not built.
- `RunningHead.font`/`.separator` are accepted by the type but not yet consulted by either renderer — no theme populates them yet.
- A generated TOC's own page is excluded from the body's own page-number sequence — a very long TOC overflowing its own PDF page falls into the same pagination-estimate-drift bucket as any other PDFKit overflow (ADR-0013).
- Only 3 of KDP's 16 published trim sizes shipped as presets (`5x8`, `5.5x8.5`, `6x9`) — the rest are recorded in the spike script for future demand.

## What This Release Does Not Include

`Editorial AI Engine`, `Plugin System`, `Publishing Engine` — all mapped at Level 1 (`PLATFORM_ARCHITECTURE_ROADMAP.md`) but no Level 2 design, no code, no Sprint assignment.

## Upgrade / Migration Notes

`POST /api/manuscripts/export` gains an optional `layout` field — omitting it reproduces today's exact Letter default, no regression for existing callers. PDF/DOCX output now shows a real running head/footer where PDF previously showed a hardcoded string and DOCX showed nothing at all — any client comparing exported output byte-for-byte against a pre-Sprint-6 baseline should expect this difference. EPUB output is unaffected. `POST /api/manuscripts/import` is entirely unaffected by this release.

## Links

- Architecture: `docs/architecture/diagrams/PROFESSIONAL_LAYOUT_ENGINE.md`
- Sprint charter: `docs/architecture/diagrams/SPRINT_6_KICKOFF.md`
- Sprint retrospective: `docs/releases/v0.7.0-alpha/SPRINT_6_FINAL_REPORT.md`
- Decisions: `docs/DECISIONS.md` (ADR-0029, ADR-0030, ADR-0031)
- Spike: `backend/spikes/kdp-trim-size-spike.ts`
- Current state (living doc): `docs/CURRENT_STATE.md`
- Pull request: #11 (`feature/sprint-6-professional-layout-engine` → `main`, merge commit `eb05beb`)
- Previous release: `v0.6.0-alpha` (Validation Engine, `docs/releases/v0.6.0-alpha/ReleaseNotes.md`)
