# Current State - Book Publisher Studio

**Last Updated:** July 17, 2026 09:00 UTC
**Sprint:** Sprint 3A - PDF Export ✅ MERGED. Sprint 2 and Quality Sprint remain ✅ MERGED.
**Branch:** `main` — PR #1 (Sprint 2, `32ac220`), PR #2 (Quality Sprint, `c507f5d`), and PR #3 (Sprint 3A PDF export, `820f1ef`) all merged, no open feature branches

---

## Summary

**Completed:** 125 tests passing ✅ (re-verified on merged `main`, not just the feature branch: `npm test`, `npm run build`, `npm run lint`, `npm run test:coverage`, plus a real DOCX from `backend/uploads/` exported to both `.docx` and `.pdf` via the running dev server)
**Next:** Sprint 3B (EPUB export — ADR-0015 spike still needed, library TBD between `epub-gen` and hand-rolled OOXML via `jszip`)

---

## Sprint 1: Import Pipeline ✅ COMPLETE (tagged `v0.2.0-alpha`)

Domain + Infrastructure + Application + Presentation for `POST /api/manuscripts/import`. See `docs/releases/v0.2.0-alpha/ReleaseNotes.md` for full detail — not repeated here.

---

## Sprint 2: Rendering Engine ✅ COMPLETE (merged to `main` via PR #1, `32ac220`)

**Design Review complete and approved** (ADR-0012, 0013, 0014, 0016, 0017 — `docs/architecture/diagrams/RENDERING_PIPELINE.md`). **Implementation built, tested, and merged.**

**Domain (new):**
- ✅ `Theme`, `ResolvedBlockStyle`, `StyledBook` types (`domain/models/Theme.ts`)
- ✅ `PageLayout` type (`domain/models/PageLayout.ts`)
- ✅ `PaginatedBook`/`Page` types (`domain/models/PaginatedBook.ts`) — a real type wrapping `StyledBook` + `Page[]`, not a bare array, to leave room for headers/footers/running titles/page numbers/bleed/crop marks later
- ✅ `ThemeEngine.applyTheme(book, theme): StyledBook` — concrete class, not a port (same reasoning as `ASTBuilder`/`BookValidator`: one correct implementation for our Book model, no swappable-adapter case)
- ✅ `ClassicTheme` — first built-in theme, `getTheme(name)` registry (throws typed `UnknownThemeError` for unknown names)
- ✅ `LayoutEngine.paginate(styled, layout): PaginatedBook` — concrete class, heuristic pagination (word-count-based height estimate for text, actual height for images, row count for tables); chapters start new pages
- ✅ `Renderer<TOutput>` port (`domain/ports/Renderer.ts`) — the one piece of this pipeline that IS a port, since PDF/EPUB/DOCX/HTML/Kindle are genuinely swappable implementations
- ✅ `LetterPageLayout` — shared default `PageLayout` (`domain/layouts/`)

**Infrastructure:**
- ✅ `DOCXRenderer` (implements `Renderer<Buffer>`) — uses the `docx` npm package (ADR-0018). Renders headings/paragraphs/quotes/scripture/tables/lists/footnotes with resolved theme styles, inserts page breaks at `LayoutEngine`'s estimated boundaries. Images without embedded base64 data fall back to a text placeholder (no network fetch inside a renderer). Ordered lists use a manual "N. " prefix rather than `docx`'s numbering-config machinery.

**Application:**
- ✅ `ExportManuscriptUseCase` — same `UseCase<TRequest,TResponse>` shape as `ImportManuscriptUseCase`. Chains the *existing* import pipeline (Parser → Normalizer → ASTBuilder) into the new export pipeline (ThemeEngine → LayoutEngine → Renderer) in one round trip — no persistence layer exists, so export is DOCX-in/DOCX-out, not a lookup by id

**Presentation:**
- ✅ `ExportController`, `POST /api/manuscripts/export` route (multipart DOCX + optional `theme` field, defaults to `classic`), wired additively into `presentation/app.ts`
- ✅ `UnknownThemeError` (typed, matching `DocumentParseError`'s precedent) maps unknown theme names to 400, not the generic 500 fallback

**Verified with a real file:** a real DOCX from `backend/uploads/` was exported via the running dev server — valid zip structure, correct Word parts (`word/document.xml`, `styles.xml`, `numbering.xml`), page breaks present, Classic theme's Georgia font applied.

## Quality Sprint ✅ COMPLETE (merged to `main` via PR #2, `c507f5d`)

All 37 `@typescript-eslint/no-explicit-any` warnings eliminated — no behavior change, 118/118 tests unchanged, coverage unchanged. `HtmlNormalizer.ts` now uses real cheerio/domhandler types (`Element`, `AnyNode`, `isTag`/`isText` guards) instead of `any`; two test files use proper Domain type casts instead of `as any`; two `catch` blocks narrow via `instanceof Error`. ESLint now reports **0 errors, 0 warnings**.

**Nothing outstanding from Sprint 2 or the Quality Sprint** — both fully merged and verified on `main`.

## Sprint 3A: PDF Export ✅ COMPLETE (merged to `main` via PR #3, `820f1ef`; tagged `v0.4.0-alpha`)

**PDFKit spike + ADR-0019 completed before any renderer code was written** (`backend/spikes/pdfkit-spike.ts`, gitignored output in `spikes/output/`) — fonts, Unicode, images, tables, page breaks, headers/footers, bleed, and crop marks all verified against real PDFKit output first.

**Infrastructure:**
- ✅ `PDFRenderer` (implements `Renderer<Buffer>`) — uses the `pdfkit` npm package (ADR-0014). Mirrors `DOCXRenderer`'s block coverage (headings/paragraphs/quotes/scripture/tables/lists/footnotes/images), inserts page breaks at `LayoutEngine`'s estimated boundaries. Theme font families map onto PDFKit's standard-14 fonts by name heuristic (no redistributable font asset shipped yet — open item, see Known Issues). Built on `bufferPages: true`: content renders once with zero header/footer interference, then a second pass stamps every page's header/footer using the real page count from `doc.bufferedPageRange()`.

**Application/Presentation:**
- ✅ No new Use Case class — `ExportManuscriptUseCase` was already renderer-agnostic (ADR-0012), so PDF support is a second instance configured with `PDFRenderer` instead of `DOCXRenderer`
- ✅ `POST /api/manuscripts/export` gained a `format` field (`docx` default, `pdf`) rather than a new route; `ExportController` now holds one use case per format and picks Content-Type/filename accordingly

**Real bugs found and fixed during implementation** (not just the spike — documented in ADR-0019, finding 6):
1. Stack overflow: writing footer text below the page's bottom margin triggered PDFKit's own auto-pagination *from inside* the `pageAdded` handler drawing it, recursing until the stack overflowed.
2. Silent page-count blowup: `doc.text(x, y, ...)` left PDFKit's cursor stranded near the bottom of the page, so every subsequent content call without explicit coordinates overflowed onto a new page almost immediately — a 9-page test document rendered as 212 pages before this was caught.
3. Wrong "Page N of TOTAL": caught only by exporting a **real** DOCX from `backend/uploads/` through the running dev server, not a synthetic fixture — the footer showed "Page 6 of 4" because `LayoutEngine`'s word-count estimate undershot the actual rendered page count.

All three were fixed by the `bufferPages` redesign above.

**Testing:**
- ✅ `src/test-utils/extractPdfText.ts` — hex-token text extraction + `/MediaBox`-count page counting, hand-rolled after confirming the popular `pdf-parse` package couldn't be used (current major depends on a native canvas binding; the classic 1.x bundles a pdf.js too old for PDFKit's current xref format)
- ✅ 6 new `PDFRenderer.test.ts` cases + 1 E2E `format=pdf` case in `export.test.ts`

**Verified with a real file:** the same real DOCX from `backend/uploads/` used to verify Sprint 2's DOCX export was exported to both `.docx` and `.pdf` via the running dev server on merged `main` — both HTTP 200, correct Content-Type, valid output.

**Nothing outstanding from Sprint 3A** — fully merged and verified on `main`. Sprint 3B (EPUB) has not started.

---

## Test Summary

| Component | Tests |
|-----------|-------|
| Book domain model | 10 |
| ASTBuilder | 22 |
| BookValidator | 6 |
| BookMetricsCalculator | 6 |
| HtmlNormalizer | 17 |
| MammothParser | 3 |
| BookMapper | 6 |
| ImportManuscriptUseCase | 13 |
| Manuscript import route (E2E) | 5 |
| ThemeEngine | 4 |
| getTheme | 2 |
| LayoutEngine | 8 |
| DOCXRenderer | 5 |
| ExportManuscriptUseCase | 6 |
| Manuscript export route (E2E) | 6 (up from 5 — added a `format=pdf` case this sprint) |
| **PDFRenderer** | **6** |
| **Total** | **125** |

(Bold rows are new this sprint.)

---

## Architecture Compliance

| Rule | Status |
|------|--------|
| Domain has zero external dependencies | ✅ |
| Application depends only on interfaces (ports live in Domain) | ✅ |
| No Domain objects in DTOs | ✅ |
| Dependency Inversion enforced (constructor injection throughout) | ✅ |
| All tests passing | ✅ (125/125) |
| No circular dependencies | ✅ |
| TypeScript strict mode | ✅ |
| Controller contains no business logic | ✅ |
| Domain coverage >90% | ✅ (92.64%, unchanged — no new Domain code this sprint) |
| Global coverage >80% | ✅ (84.47%, down from 88.03% — new Infrastructure/Presentation code (`PDFRenderer`) has lighter coverage than Domain, same profile `DOCXRenderer` already had; still clears the >80% gate) |
| Renderer is a port; ThemeEngine/LayoutEngine are concrete classes | ✅ (Design Review decision, ADR-0012 addendum) |
| Zero ESLint warnings | ✅ (0 errors, 0 warnings — held since Quality Sprint, PR #2) |

---

## Known Issues

- Two DOCX-import code paths exist side by side: the new tested pipeline (`/api/manuscripts/import`) and the old untested one (`/api/upload`, `docxParser.ts`). Both marked `@deprecated`, removal still scheduled — not yet done (ADR-0011).
- `backend/uploads/` history: files are untracked going forward (fixed — see ADR in `docs/DECISIONS.md` / `docs/TODO.md`), but still present in past git history. Full history purge is a separate, not-yet-made decision.
- ADR-0015 (EPUB renderer library) remains open — a spike is Sprint 3B's first step, before any `EPUBRenderer` code is written.
- No redistributable font asset is shipped for PDF/theme rendering (ADR-0019): `ClassicTheme`'s Georgia isn't licensed for redistribution, and PDFKit ships no font data of its own. Theme fonts currently map onto PDFKit's standard-14 fonts by a name heuristic — functional, not the intended typography.
- No RTL / multi-script text support yet (ADR-0019): verified no single embedded font covers every script (Arabic renders as blank boxes with the font tested), and PDFKit does no bidi reordering or Arabic contextual glyph shaping. Real, separate work — flagged, not scheduled.

---

## Technical Debt

- `QualityMetrics` interface (in `Book.ts`) is declared but unused — needs the Typography Engine (Sprint 4).
- `DOCXRenderer`'s footnote rendering is simplified (inline `[n] content` paragraph, not real Word footnotes) and ordered lists use a manual prefix instead of `docx`'s numbering config — both documented, deliberate simplifications, not silent gaps.
- `PDFRenderer`'s table rendering does not split a table across a forced page break (matches `LayoutEngine`'s own treatment of a table as one non-splitting unit, ADR-0013 — not an inconsistency, but a real large-table edge case that could visually overflow a page if it ever occurs).
- `docs/architecture/diagrams/BASELINE_v0.1.md`'s "86/86 tests" claim was corrected via ADR-0010 (status annotation only, content not rewritten, per the doc's own frozen/ADR-only change rule).

---

## Next Session Preparation

**To resume work:**
1. Read `docs/START_HERE.md`
2. Read this file (`CURRENT_STATE.md`)
3. Begin Sprint 3B (EPUB export — ADR-0015 spike first: `epub-gen` vs. hand-rolled OOXML via `jszip`, decide before writing `EPUBRenderer`) on a new dedicated branch per ADR-0017, e.g. `feature/sprint-3b-epub-export`

**Quick Start:**
```bash
cd "D:\Book Publisher Studio\backend"
git checkout main && git pull
npm test              # Verify all 125 tests pass
npm run build         # Verify TypeScript compilation
npm run lint           # Verify 0 ESLint errors
npm run test:coverage  # Verify coverage thresholds
```

---

## Dependencies

**Runtime:**
- mammoth (DOCX parser)
- cheerio (HTML normalizer)
- **domhandler** (cheerio's node types — `Element`/`AnyNode`/`isTag`/`isText` — explicit dependency added during the Quality Sprint instead of relying on transitive resolution)
- express, multer, cors
- **docx** (DOCX generation — ADR-0018)
- **pdfkit** (PDF generation — ADR-0014)

**Dev:**
- vitest, @vitest/coverage-v8
- typescript
- eslint, typescript-eslint, @eslint/js, prettier
- supertest, @types/supertest
- jszip (test-fixture generation and test-side docx inspection)
- @types/pdfkit

---

## Git Status

**Branch:** `main`
**`main` synced with `origin/main` at:** `d593922` (docs commit marking `v0.4.0-alpha` Released, immediately after tagging; contains PR #3's merge commit `820f1ef` — `feature/sprint-3a-pdf-export` → `main` — in its history, same pattern as `v0.3.0-alpha`'s tag. PR #2 `c507f5d` and PR #1 `32ac220` merged earlier in the same history.)
**Remote:** https://github.com/idealsuitesite/book-publisher-studio
**Tags:** `v0.1.0-alpha.1`, `v0.2.0-alpha`, `v0.3.0-alpha`, `v0.4.0-alpha` (PDF export — see `docs/VERSIONS.md` and `docs/releases/v0.4.0-alpha/ReleaseNotes.md`)
**Open branches:** none — all merged feature branches deleted locally and remotely after merge
