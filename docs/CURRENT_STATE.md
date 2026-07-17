# Current State - Book Publisher Studio

**Last Updated:** July 17, 2026 10:00 UTC
**Sprint:** Sprint 3B - EPUB Export ✅ MERGED. Sprint 3A, Sprint 2, and Quality Sprint remain ✅ MERGED. Sprint 3 ("Professional Export") is now fully complete.
**Branch:** `main` — PR #1 (Sprint 2, `32ac220`), PR #2 (Quality Sprint, `c507f5d`), PR #3 (Sprint 3A PDF export, `820f1ef`), and PR #4 (Sprint 3B EPUB export, `a7a38a0`) all merged, no open feature branches

---

## Summary

**Completed:** 133 tests passing ✅ (re-verified on merged `main`, not just the feature branch: clean `npm install`, `npm run build`, `npm run lint`, `npm test`, `npm run test:coverage`, plus a real DOCX from `backend/uploads/` exported to `.docx`, `.pdf`, and `.epub` via the running dev server)
**Next:** Sprint 3 (Professional Export — PDF + EPUB) is fully done. Sprint 4 is not yet scoped by the CTO — see `docs/TODO.md`'s backlog (Typography Engine, fuller `ValidatorEngine`, plugin system) and the still-open legacy `/api/upload` removal (ADR-0011, tracked since Sprint 3 planning, not yet done).

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

**Nothing outstanding from Sprint 3A** — fully merged and verified on `main`.

## Sprint 3B: EPUB Export ✅ COMPLETE (merged to `main` via PR #4, `a7a38a0`)

**EPUB library spike + ADR-0020 completed before any renderer code was written** (`backend/spikes/epub-library-spike.ts`) — resolves ADR-0015 with real evidence, not a guess. `epub-gen-memory` (a maintained TypeScript fork) chosen over the ADR-0015 example candidate `epub-gen` itself, which was rejected on hard evidence: last published to npm in 2022, never left `0.1.0`, no detected license on GitHub despite `package.json` claiming MIT, and a dependency tree full of genuinely legacy packages (`q`, `rimraf@2`, a second major of `cheerio` alongside this project's own).

**Infrastructure:**
- ✅ `EPUBRenderer` (implements `Renderer<Buffer>`) — uses `epub-gen-memory` (ADR-0020). Serializes the same block types `DOCXRenderer`/`PDFRenderer` already handle (headings, paragraphs, quotes/scripture, lists, tables, footnotes, images) into HTML per chapter. No pagination consulted (ADR-0013, unchanged — EPUB is reflowable). Images with embedded base64 data are written to a scoped temp directory per render and referenced via `file://`, since `epub-gen-memory` unconditionally fetches every `<img src>` with no bypass for already-available bytes (ADR-0020, finding 5) — this keeps the same no-hidden-network-I/O rule the other two renderers already follow.

**Application/Presentation:**
- ✅ No new Use Case class — `ExportManuscriptUseCase` was already renderer-agnostic (ADR-0012), so EPUB support is a third instance configured with `EPUBRenderer`
- ✅ `POST /api/manuscripts/export`'s `format` field now also accepts `epub` (alongside `docx` default, `pdf`) — no new route

**Real bugs found and fixed during implementation** (not just the spike — documented in ADR-0020's addendum):
1. Double-wrapped CJS/ESM interop: `epub-gen-memory`'s exported render function arrives two `.default` levels deep under this project's ESM toolchain — confirmed identically under both `tsx` and plain `node`, so not a dev-only quirk. Unwrapped defensively rather than hardcoding the depth.
2. Empty-book bug, caught only by exporting a **real** DOCX from `backend/uploads/` through the running dev server, not a synthetic fixture: `EPUBRenderer` filtered top-level content to `Chapter` only, but `ASTBuilder` falls back to a top-level `Section` ("preamble") when the source document has no Heading-1-level break at all — exactly this real file's shape. Produced a structurally valid but completely empty EPUB (correct `mimetype`/OPF, zero chapter files). Fixed by walking all of `mainContent` regardless of type, matching `DOCXRenderer`/`PDFRenderer`'s existing generic walk.

**Testing:**
- ✅ 7 new `EPUBRenderer.test.ts` cases, including a regression test reproducing the exact top-level-`Section`-with-no-`Chapter` shape that caused bug 2 above
- ✅ 1 new E2E `format=epub` case in `export.test.ts`

**Verified with a real file:** the same real DOCX from `backend/uploads/` used to verify Sprints 2 and 3A was exported to `.epub` via the running dev server on merged `main` — HTTP 200, correct Content-Type, `mimetype` correctly first/uncompressed, real chapter content present (not the empty shell bug 2 above produced before the fix).

**Nothing outstanding from Sprint 3B** — fully merged and verified on `main`. Sprint 3 ("Professional Export") is now fully complete; Sprint 4 has not started or been scoped.

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
| Manuscript export route (E2E) | 7 (up from 6 — added a `format=epub` case this sprint) |
| PDFRenderer | 6 |
| **EPUBRenderer** | **7** |
| **Total** | **133** |

(Bold rows are new this sprint.)

---

## Architecture Compliance

| Rule | Status |
|------|--------|
| Domain has zero external dependencies | ✅ |
| Application depends only on interfaces (ports live in Domain) | ✅ |
| No Domain objects in DTOs | ✅ |
| Dependency Inversion enforced (constructor injection throughout) | ✅ |
| All tests passing | ✅ (133/133) |
| No circular dependencies | ✅ |
| TypeScript strict mode | ✅ |
| Controller contains no business logic | ✅ |
| Domain coverage >90% | ✅ (92.64%, unchanged — no new Domain code this sprint) |
| Global coverage >80% | ✅ (84.01%, down slightly from 84.47% — new Infrastructure code (`EPUBRenderer`) has a similar coverage profile to `DOCXRenderer`/`PDFRenderer`; still clears the >80% gate) |
| Renderer is a port; ThemeEngine/LayoutEngine are concrete classes | ✅ (Design Review decision, ADR-0012 addendum) |
| Zero ESLint warnings | ✅ (0 errors, 0 warnings — held since Quality Sprint, PR #2) |

---

## Known Issues

- Two DOCX-import code paths exist side by side: the new tested pipeline (`/api/manuscripts/import`) and the old untested one (`/api/upload`, `docxParser.ts`). Both marked `@deprecated`, removal still scheduled — not yet done (ADR-0011).
- `backend/uploads/` history: files are untracked going forward (fixed — see ADR in `docs/DECISIONS.md` / `docs/TODO.md`), but still present in past git history. Full history purge is a separate, not-yet-made decision.
- No redistributable font asset is shipped for PDF/theme rendering (ADR-0019): `ClassicTheme`'s Georgia isn't licensed for redistribution, and PDFKit ships no font data of its own. Theme fonts currently map onto PDFKit's standard-14 fonts by a name heuristic — functional, not the intended typography. (Not an issue for EPUB — CSS `font-family` is just a reader-side hint, no font file needs to be embedded or licensed for redistribution.)
- No RTL / multi-script text support yet (ADR-0019): verified no single embedded font covers every script (Arabic renders as blank boxes with the font tested), and PDFKit does no bidi reordering or Arabic contextual glyph shaping. Real, separate work — flagged, not scheduled.
- `epub-gen-memory` (ADR-0020) is a smaller-community fork (58 GitHub stars) of a more popular but unmaintained parent (`epub-gen`, 458 stars) — worth watching at upgrade time, not a reason to avoid it now.

---

## Technical Debt

- `QualityMetrics` interface (in `Book.ts`) is declared but unused — needs the Typography Engine (Sprint 4).
- `DOCXRenderer`'s footnote rendering is simplified (inline `[n] content` paragraph, not real Word footnotes) and ordered lists use a manual prefix instead of `docx`'s numbering config — both documented, deliberate simplifications, not silent gaps.
- `PDFRenderer`'s table rendering does not split a table across a forced page break (matches `LayoutEngine`'s own treatment of a table as one non-splitting unit, ADR-0013 — not an inconsistency, but a real large-table edge case that could visually overflow a page if it ever occurs).
- `EPUBRenderer`'s `page-break` block renders a CSS `page-break-before` hint, not a real page break — EPUB is reflowable (ADR-0013), and reading systems vary in whether they honor the hint at all. Documented, not a silent gap.
- `docs/architecture/diagrams/BASELINE_v0.1.md`'s "86/86 tests" claim was corrected via ADR-0010 (status annotation only, content not rewritten, per the doc's own frozen/ADR-only change rule).

---

## Next Session Preparation

**To resume work:**
1. Read `docs/START_HERE.md`
2. Read this file (`CURRENT_STATE.md`)
3. Sprint 3 (Professional Export) is fully done. Sprint 4 has not been scoped by the CTO yet — see `docs/TODO.md`'s Low Priority backlog (Typography Engine, fuller `ValidatorEngine`, plugin system) and the still-open legacy `/api/upload` removal (ADR-0011) for candidates, but wait for direction before starting either on a new branch (ADR-0017)

**Quick Start:**
```bash
cd "D:\Book Publisher Studio\backend"
git checkout main && git pull
npm test              # Verify all 133 tests pass
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
- **epub-gen-memory** (EPUB generation — ADR-0020)

**Dev:**
- vitest, @vitest/coverage-v8
- typescript
- eslint, typescript-eslint, @eslint/js, prettier
- supertest, @types/supertest
- jszip (test-fixture generation and test-side docx/epub inspection)
- @types/pdfkit

---

## Git Status

**Branch:** `main`
**`main` synced with `origin/main` at:** `a7a38a0` (PR #4 merge commit — `feature/sprint-3b-epub-export` → `main`; PR #3 `820f1ef`, PR #2 `c507f5d`, and PR #1 `32ac220` merged earlier in the same history)
**Remote:** https://github.com/idealsuitesite/book-publisher-studio
**Tags:** `v0.1.0-alpha.1`, `v0.2.0-alpha`, `v0.3.0-alpha`, `v0.4.0-alpha` (PDF export — see `docs/VERSIONS.md` and `docs/releases/v0.4.0-alpha/ReleaseNotes.md`). `v0.4.1-alpha` (EPUB export) is merged but **not yet tagged** — waiting on explicit confirmation before creating it, per this project's own rule (`docs/VERSIONS.md`: a row only moves to Released once the tag is actually pushed).
**Open branches:** none — all merged feature branches deleted locally and remotely after merge
