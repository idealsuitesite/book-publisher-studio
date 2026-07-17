# TODO - Book Publisher Studio

**Last Updated:** July 17, 2026 00:05 UTC

---

## 🔴 BLOCKED

None currently.

---

## 🟡 IN PROGRESS

**Sprint 3B (EPUB export) — implementation complete on `feature/sprint-3b-epub-export`, not yet reviewed/merged/tagged.** Per ADR-0017, this stays IN PROGRESS (not COMPLETED) until it's actually merged to `main`. (Sprint 3A/PDF export has already merged and tagged `v0.4.0-alpha` — see the Completed section below; this file's IN PROGRESS entry for it was left stale after that merge until this update caught it.)

### Medium Priority (Sprint 3 — "Professional Export")

Same discipline as Sprint 2: Design Review → ADR → small atomic commits → green build/tests → PR → merge → tag.

**Sprint 3B (EPUB export, CTO-directed re-sequencing, started 2026-07-17 after 3A/PDF merged):**

1. ✅ EPUB library spike + ADR-0020 resolves ADR-0015 (`backend/spikes/epub-library-spike.ts`) — `epub-gen-memory` chosen over the unmaintained `epub-gen` (last published 2022, ambiguous license, legacy deps) and over hand-rolling OCF/OPF/XHTML (no benefit once a spec-correct, TS-native library was verified)
2. ✅ `EPUBRenderer` (`backend/src/infrastructure/renderers/EPUBRenderer.ts`) — serializes the same block types the other two renderers handle into HTML per chapter; images with embedded data are written to a scoped temp dir and referenced via `file://` (epub-gen-memory unconditionally fetches `<img src>` otherwise — ADR-0020 finding 5)
3. ✅ EPUB export reuses `ExportManuscriptUseCase` as-is, same pattern as PDF — a third instance configured with `EPUBRenderer`
4. ✅ EPUB endpoint — existing `POST /api/manuscripts/export`'s `format` field now also accepts `epub`
5. ✅ Tests — 7 `EPUBRenderer.test.ts` cases (including a regression test for the bug below) + 1 E2E `format=epub` case; 133/133 total tests passing, 84.01% global coverage
6. ✅ Verification pass — build/lint/test/coverage all green; a real DOCX from `backend/uploads/` exported to EPUB through the running dev server caught a real bug: `EPUBRenderer` filtered top-level content to `Chapter` only, but `ASTBuilder` falls back to a top-level `Section` when the source has no Heading-1-level break — exactly this file's shape — producing a structurally valid but completely empty EPUB. Fixed by walking all of `mainContent` regardless of type, matching `DOCXRenderer`/`PDFRenderer` (ADR-0020 addendum)

**Still open before merge:** PR not yet opened — waiting on go-ahead.

- [ ] **Font asset for PDF/theme rendering** (surfaced by ADR-0019): Georgia (`ClassicTheme`) is a Microsoft-licensed font, not redistributable, and PDFKit ships no font data at all — production needs an openly-licensed font file shipped with the app, not an OS font lookup. Not yet decided which font or license.
- [ ] **RTL / multi-script text support** (surfaced by ADR-0019): no single embedded font covers every script (verified: Arabic renders as blank boxes, Greek dropped a glyph), and PDFKit does no bidi reordering or Arabic contextual shaping. Real work, not a font swap — flagged, not scheduled.

- [ ] **Remove legacy `/api/upload` route** (`docxParser.ts`, disk-based multer) — both now marked `@deprecated`; confirm nothing depends on the raw-paragraph response shape first (ADR-0011)

### Low Priority (Sprint 4+)

- [ ] `ValidatorEngine` (readability/completeness scoring, typography-issue detection — fuller than the current structural-only `BookValidator`)
- [ ] Typography Engine (widow/orphan control, hyphenation, smart quotes, drop caps)
- [ ] Plugin system
- [ ] Premium UI/UX (Next.js frontend)
- [ ] AI features (explicitly deferred — architecture should stay extensible for these, not build them now)
- [ ] Licensing/subscription model, observability/telemetry (also explicitly deferred — no DB/auth exists yet)

### Open decision (not scheduled)

- [ ] `backend/uploads/` history: files are now untracked going forward (ADR — see below), but still exist in past commit history. Decide whether a history purge (`git filter-repo` or similar) is warranted, or whether "untracked going forward" is sufficient.

---

## ✅ COMPLETED

### Sprint 1 - Phase 1: Domain + Infrastructure

- ✅ Book domain model
- ✅ ASTBuilder service
- ✅ HtmlNormalizer
- ✅ Block types
- ✅ 43 tests passing originally (Book: 7, ASTBuilder: 19, HtmlNormalizer: 17); 6 more added during Phase 2's coverage push (Book: +3, ASTBuilder: +3) for previously-untested type guards and block/inline conversion branches

### Sprint 1 - Phase 2: Application + Presentation

- ✅ `BookValidator`, `BookMetricsCalculator` (Domain — moved out of `ASTBuilder`)
- ✅ `UseCase<TRequest,TResponse>` contract
- ✅ 8 DTOs (Metadata, Inline, Block, Chapter, Section, Book, ImportReport, ImportResponse)
- ✅ 4 Mappers (Block, Section, Chapter, Book) — pure conversion
- ✅ `ImportManuscriptUseCase` (Dependency Inversion via constructor injection)
- ✅ `MammothParser` (Infrastructure, implements `DocumentParser`)
- ✅ `ManuscriptController` + `POST /api/manuscripts/import` route + error handling middleware
- ✅ ESLint, Prettier, vitest coverage, GitHub Actions CI — none of which existed before this phase
- ✅ **88 total tests passing**, verified against a real DOCX POSTed to a running server

### Sprint 2 - Rendering Engine (merged via PR #1, `32ac220`)

- ✅ `ThemeEngine` (concrete class) + Classic built-in theme + `getTheme(name)` registry
- ✅ `LayoutEngine` (concrete class) — heuristic pagination, returns `PaginatedBook`
- ✅ `Renderer<TOutput>` port + `DOCXRenderer` (uses the `docx` npm package, ADR-0018)
- ✅ `ExportManuscriptUseCase` + `POST /api/manuscripts/export` + `ExportController`
- ✅ `UnknownThemeError` (typed, maps unknown theme names to 400)
- ✅ **118 total tests passing**, re-verified on merged `main` (not just the feature branch), plus a real DOCX exported end-to-end
- ✅ Design Review completed and approved *before* any implementation code (ADR-0012 through ADR-0018)

### Quality Sprint (merged via PR #2, `c507f5d`)

- ✅ All 37 `@typescript-eslint/no-explicit-any` warnings eliminated (14 in `HtmlNormalizer.ts` with real cheerio/domhandler types, 21 across two test files with proper Domain type casts, 2 `catch` blocks narrowed via `instanceof Error`)
- ✅ No behavior change — 118/118 tests unchanged, coverage unchanged
- ✅ ESLint now reports **0 errors, 0 warnings**

### Sprint 3A - PDF Export (merged via PR #3, `820f1ef`; tagged `v0.4.0-alpha`)

- ✅ PDFKit spike + ADR-0019 completed before any renderer code (fonts, Unicode, images, tables, page breaks, headers/footers, bleed, crop marks all verified against real output)
- ✅ `PDFRenderer` (uses `pdfkit`, ADR-0014) — mirrors `DOCXRenderer`'s block coverage; built on `bufferPages: true` after three real bugs were found and fixed (ADR-0019 finding 6: stack overflow, cursor-strand page blowup, wrong "Page N of TOTAL" caught against a real DOCX from `backend/uploads/`)
- ✅ PDF export reuses `ExportManuscriptUseCase` as-is (no new Use Case class) + `POST /api/manuscripts/export` gains a `format` field
- ✅ **125 total tests passing** (up from 118), 84.47% global coverage, re-verified on merged `main` (not just the feature branch), plus a real DOCX exported to both `.docx` and `.pdf` end-to-end

---

## 📋 BACKLOG (Future)

- [ ] Collaborative editing
- [ ] Version control / history
- [ ] Cloud sync (AWS S3)
- [ ] Analytics dashboard
- [ ] Mobile apps
- [ ] Advanced search
- [ ] Spell check
- [ ] Translation assistance
- [ ] Custom plugins system
- [ ] Kindle / Kobo / Lulu / IngramSpark / Amazon KDP export targets

---

## 🐛 KNOWN ISSUES

- Legacy `/api/upload` route and new `/api/manuscripts/import` route both exist; only the new one is tested. Legacy route now marked `@deprecated`, removal scheduled Sprint 3 (ADR-0011).
- `backend/uploads/` no longer tracked going forward (`.gitignore` + `git rm --cached`), but still present in past commit history — see Open Decision above.

---

## 💡 TECHNICAL DEBT

- `QualityMetrics` interface declared but unused (needs Typography Engine, Sprint 4).
- `docs/architecture/diagrams/BASELINE_v0.1.md` staleness corrected via ADR-0010 (status annotation added, content not rewritten).
- `errorHandler.ts` passes multer's own error message straight to the client for non-size-limit errors (low severity — multer's built-in messages are generic, not stack traces/paths — but not a hardcoded message like the size-limit case).
- No per-module `README.md` files exist yet (Domain/Application/Presentation), despite the "every module must include a README" rule.

---

## 📊 METRICS

- **Test Coverage:** Domain 92.64% stmts, global 88.03% stmts (both verified via `npm run test:coverage`, not asserted)
- **Code Quality:** TypeScript strict mode ✅, ESLint **0 errors / 0 warnings**, Prettier applied
- **Tests:** 118 passing, 0 failing
- **Architecture Debt:** Legacy route duplication (see Known Issues)
- **Documentation:** Reconciled with actual code as of 2026-07-17 (post Sprint 2 + Quality Sprint merge)
