# TODO - Book Publisher Studio

**Last Updated:** July 17, 2026 19:40 UTC

---

## 🔴 BLOCKED

None currently.

---

## 🟡 IN PROGRESS

None currently — Sprint 1 is complete.

---

## 🟢 READY (Priority Order)

### High Priority (Sprint 2 — per the dictated MVP roadmap)

1. **Theme Engine** (Domain)
   - [ ] `Theme` interface (fonts, sizes, colors, spacing, per-block styles)
   - [ ] `ThemeEngine.applyTheme(book, themeName): StyledBook`
   - [ ] At least one built-in theme (e.g. Classic)

2. **Layout Engine** (Domain)
   - [ ] `PageLayout` interface (margins, page size, headers/footers)
   - [ ] Pagination logic

3. **Professional DOCX Export**
   - [ ] `ExportBookUseCase` (Application, same `UseCase<TRequest,TResponse>` shape as `ImportManuscriptUseCase`)
   - [ ] `DOCXRenderer` (Infrastructure)

4. **Quality Sprint: 0 ESLint warnings**
   - [ ] Currently 37 warnings, all `@typescript-eslint/no-explicit-any`, mostly in cheerio-typed `HtmlNormalizer.ts`
   - [ ] Deliberately deferred rather than fixed during Phase 2 to avoid touching already-tested files outside that phase's scope — now explicitly scheduled

### Medium Priority (Sprint 3)

- [ ] PDF export (`PDFRenderer`, `ExportPDFUseCase`)
- [ ] EPUB export (`EPUBRenderer`, `ExportEPUBUseCase`)
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

- **Test Coverage:** Domain 91.56% stmts, global 87.23% stmts (both verified via `npm run test:coverage`, not asserted)
- **Code Quality:** TypeScript strict mode ✅, ESLint 0 errors / 37 warnings, Prettier applied
- **Tests:** 88 passing, 0 failing
- **Architecture Debt:** Legacy route duplication (see Known Issues)
- **Documentation:** Reconciled with actual code as of 2026-07-17
