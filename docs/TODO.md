# TODO - Book Publisher Studio

**Last Updated:** July 17, 2026 00:05 UTC

---

## 🔴 BLOCKED

None currently.

---

## 🟡 IN PROGRESS

**Sprint 3A (PDF export) — implementation complete on `feature/sprint-3a-pdf-export`, not yet reviewed/merged/tagged.** Per ADR-0017, this stays IN PROGRESS (not COMPLETED) until it's actually merged to `main` — moving it to Completed before that would repeat the `159a49b3` failure mode this project's discipline exists to prevent.

### Medium Priority (Sprint 3 — "Professional Export", planned commit sequence agreed 2026-07-17)

Same discipline as Sprint 2: Design Review → ADR → small atomic commits → green build/tests → PR → merge → tag.

**Sprint 3A (PDF export, priority — CTO-directed re-sequencing, 2026-07-17):**

1. ✅ PDFKit spike + ADR-0019 (`backend/spikes/pdfkit-spike.ts`) — fonts, Unicode, images, tables, page breaks, headers/footers, bleed, crop marks all verified against real output before writing `PDFRenderer`
2. ✅ `PDFRenderer` (`backend/src/infrastructure/renderers/PDFRenderer.ts`) — mirrors `DOCXRenderer`'s block coverage; built on `bufferPages: true` after two rounds of real bugs found and fixed (ADR-0019 finding 6: stack overflow, cursor-strand page blowup, wrong "Page N of TOTAL" caught against a real DOCX)
3. ✅ PDF export reuses `ExportManuscriptUseCase` as-is (already renderer-agnostic per ADR-0012) — no separate `ExportPDFUseCase` class needed, just a second instance configured with `PDFRenderer`
4. ✅ PDF endpoint — existing `POST /api/manuscripts/export` gained a `format` field (`docx` default, `pdf`), not a new route
5. ✅ Tests — 6 `PDFRenderer.test.ts` cases + 1 E2E `format=pdf` case in `export.test.ts`; 125/125 total tests passing, 84.47% global coverage
6. ✅ Verification pass — build/lint/test/coverage all green; also exported a real DOCX from `backend/uploads/` to PDF through the running dev server (not just fixtures), which is what caught the "Page N of TOTAL" bug in step 2

**Still open before merge:** PR not yet opened — waiting on go-ahead.

**Sprint 3B (EPUB, after 3A ships):**

1. EPUB library spike + ADR (ADR-0015 — `epub-gen` vs. hand-rolled OOXML via `jszip`)
2. EPUB Renderer
3. EPUB endpoint
4. Verification pass (`docs/MERGE_CHECKLIST.md`)

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
