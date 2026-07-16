# Release Notes — v0.3.0-alpha

**Tag:** `v0.3.0-alpha`
**Date:** 2026-07-17
**Codename:** Rendering Engine Complete

## Summary

This release adds the first export pipeline: a DOCX manuscript, uploaded over HTTP with a chosen theme, comes back as a styled, paginated `.docx` file. It reuses the existing import pipeline (`MammothParser` → `HtmlNormalizer` → `ASTBuilder`) as its front half, so import and export share the same Book AST rather than duplicating parsing logic. Every design decision — including a real architecture question about which components should be ports versus concrete classes — was reviewed and approved *before* any implementation code was written, then implemented across 7 atomic commits on a dedicated feature branch and merged via PR #1.

## Features

- **Theme Engine** — `ThemeEngine.applyTheme(book, theme): StyledBook` resolves a `ResolvedBlockStyle` (font, size, color, spacing) per block, keyed by block id against an untouched `Book` reference rather than deep-cloning the tree. One built-in theme, Classic (Georgia, structured heading/body sizes).
- **Layout Engine** — `LayoutEngine.paginate(styled, layout): PaginatedBook` estimates page breaks heuristically (word-count-based height for text, actual height for images, row count for tables); chapters start new pages. Returns a real `PaginatedBook` type (`{ styledBook, pages }`), not a bare array — leaves room for headers/footers/running titles/page numbers/bleed/crop marks later without reshaping the `Renderer` contract.
- **`Renderer<TOutput>` port** — the one piece of this pipeline that's a port rather than a concrete class, since PDF/EPUB/DOCX/HTML/Kindle are genuinely swappable implementations (Theme/Layout Engines are concrete classes — same reasoning as `ASTBuilder`/`BookValidator`, exactly one correct implementation for our Book model).
- **DOCX rendering** — `DOCXRenderer` (uses the `docx` npm package) renders headings, paragraphs, quotes/scripture (italicized), tables, ordered/unordered lists, footnotes, and page breaks with resolved theme styles.
- **Export use case and API** — `ExportManuscriptUseCase` (same `UseCase<TRequest,TResponse>` shape as `ImportManuscriptUseCase`) and `POST /api/manuscripts/export` (multipart DOCX + optional `theme` field, defaults to `classic`). Single round trip — no persistence layer exists, so there's no lookup-by-id; the client gets back a rendered file directly.
- **Typed error handling** — `UnknownThemeError` maps an unrecognized theme name to HTTP 400 instead of falling through to the generic 500 handler.
- **Tests** — 30 new tests (`ThemeEngine`, `getTheme`, `LayoutEngine`, `DOCXRenderer`, `ExportManuscriptUseCase`, and an E2E route test), bringing the suite to 118 total.

## Architecture

- **Design Review before code**: ADR-0012 (Rendering Engine Architecture), ADR-0013 (Pagination Strategy), ADR-0014 (PDF Renderer — PDFKit, decided but not yet built), ADR-0016 (Theme Engine), and ADR-0018 (DOCX Renderer — the `docx` package) were all written and approved before implementation started.
- **Port-vs-concrete-class decision** (ADR-0012 addendum): applying the same test already used for `ASTBuilder`/`BookValidator` in Phase 2 — a port makes sense only where genuinely swappable adapters exist. `Renderer` is a port; `ThemeEngine`/`LayoutEngine` are concrete classes.
- **`main` treated as a production branch** (ADR-0017): this is the first feature built entirely on a dedicated branch (`feature/sprint-2-rendering-engine`) with review before merge — a direct response to the `159a49b3` incident from Sprint 1/2's transition, where a parallel implementation was pushed straight to `main` and diverged silently.

## Quality Metrics

| Metric | Value |
|---|---|
| Tests | 118 passing, 0 failing (up from 88) |
| Domain coverage | 92.64% statements (up from 91.56%) |
| Global coverage | 88.01% statements (up from 87.23%) |
| ESLint | 0 errors, 37 warnings (unchanged — not introduced by this release) |
| TypeScript | strict mode, 0 compiler errors |
| CI | build + lint + test on every push/PR |
| Manual verification | Real DOCX from `backend/uploads/` exported end-to-end via a running dev server — valid zip structure, correct Word parts, page breaks present, theme font applied |

## Known Issues / Deliberate Simplifications

Documented in code and in `docs/DECISIONS.md`, not silent gaps:
- Images without embedded base64 data fall back to a text placeholder — rendering never fetches remote URLs at render time (no hidden network I/O inside a renderer)
- Ordered lists use a manual "N. " prefix instead of `docx`'s numbering-reference configuration (which needs document-level setup)
- Footnotes render as an inline `[n] content` paragraph, not real Word footnotes
- Pagination is a heuristic estimate (word-count/row-count based), not exact text shaping — `docx`/Word may still reflow within the estimated breaks
- 37 ESLint warnings (`@typescript-eslint/no-explicit-any`) carried over unchanged from v0.2.0-alpha — tracked as a Quality Sprint item, not yet scheduled to a specific release

## What This Release Does Not Include

PDF export (ADR-0014 decided — PDFKit — but not yet implemented), EPUB export (ADR-0015 still needs a library spike between `epub-gen` and hand-rolled OOXML), Typography Engine, fuller `ValidatorEngine` (readability/completeness scoring), plugin system, premium UI, AI features, licensing enforcement, database, authentication, collaboration. See `docs/VISION.md` for the long-term plan and `docs/TODO.md` for what's actually scheduled next (Sprint 3: PDF + EPUB export).

## Upgrade / Migration Notes

Nothing to migrate. `POST /api/manuscripts/import` is unaffected. The legacy `POST /api/upload` route remains deprecated but present (ADR-0011, removal still scheduled for Sprint 3). Frontend is unaffected.

## Links

- Architecture: `docs/architecture/diagrams/RENDERING_PIPELINE.md`
- Decisions: `docs/DECISIONS.md` (ADR-0012 through ADR-0018)
- Vision: `docs/VISION.md`
- Current state (living doc): `docs/CURRENT_STATE.md`
- Merge checklist used: `docs/MERGE_CHECKLIST.md`
- Pull request: #1 (`feature/sprint-2-rendering-engine` → `main`, merge commit `32ac220`)
