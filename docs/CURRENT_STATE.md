# Current State - Book Publisher Studio

**Last Updated:** July 17, 2026 03:30 UTC
**Sprint:** Sprint 1 - Import Pipeline
**Phase:** Phase 1 (Domain + Infrastructure) and Phase 2 (Application + Presentation) both complete. Sprint 1 done.

---

## Summary

**Completed:** 88 tests passing ✅ (verified via `npm test`, `npm run build`, `npm run lint`, `npm run test:coverage`)
**Next:** Sprint 2 — Theme Engine, Layout Engine, Professional DOCX Export (per the dictated MVP roadmap)

> Earlier versions of this file claimed Phase 2 (Application Layer) was complete with 69–110 tests passing, when in reality nothing existed under `src/application/`. That was corrected on 2026-07-16 (see prior revision / `docs/architecture/diagrams/BASELINE_v0.1.md` history). Phase 2 has now genuinely been built and verified end-to-end, including a real DOCX POSTed to the running server.

---

## Sprint 1: Import Pipeline ✅ COMPLETE

### Phase 1: Domain + Infrastructure ✅ COMPLETE

- ✅ Book domain model (immutable) — `src/domain/models/Book.ts`
- ✅ Normalized document contract — `src/domain/models/Normalized.ts`
- ✅ ASTBuilder service (Normalized → Book) — `src/domain/services/ASTBuilder.ts`
- ✅ HtmlNormalizer (HTML → NormalizedDocument, implements `DocumentNormalizer`) — `src/infrastructure/normalizers/HtmlNormalizer.ts`
- ✅ Block types: heading, paragraph, image, table, list, quote, scripture, footnote
- ✅ Shared utils: `idGenerator.ts`, `textMetrics.ts`

### Phase 2: Application + Presentation ✅ COMPLETE

**Domain (new this phase):**
- ✅ `BookValidator` — structural + metadata validation (`src/domain/services/BookValidator.ts`)
- ✅ `BookMetricsCalculator` — word/page/reading-time metrics + content statistics, moved out of `ASTBuilder` (`src/domain/services/BookMetricsCalculator.ts`)
- ✅ Ports: `DocumentParser`, `DocumentNormalizer` — live in `src/domain/ports/` (not `application/ports/`, to keep Infrastructure→Domain-only dependency direction)

**Application:**
- ✅ `UseCase<TRequest, TResponse>` contract
- ✅ DTOs: `MetadataDTO`, `InlineDTO`, `BlockDTO`, `ChapterDTO`, `SectionDTO`, `BookDTO`, `ImportReportDTO`, `ImportResponseDTO`
- ✅ Mappers: `BlockMapper`, `SectionMapper`, `ChapterMapper`, `BookMapper` — pure conversion, no calculation
- ✅ `ImportManuscriptUseCase` — orchestrates Parser → Normalizer → ASTBuilder → BookValidator → BookMetricsCalculator → BookMapper

**Infrastructure:**
- ✅ `MammothParser` (implements `DocumentParser`, Buffer → HTML, throws typed `DocumentParseError`)

**Presentation (new layer):**
- ✅ `ManuscriptController`, `POST /api/manuscripts/import` route, memory-storage multer with MIME/size validation, centralized `errorHandler`
- ✅ Wired additively into `presentation/app.ts` (extracted from `index.ts` so the Express app is importable/testable without starting a real server)
- ✅ Legacy `POST /api/upload` (old `docxParser.ts` pipeline) left untouched — see ADR-0009

**Tooling (also this phase):**
- ✅ `vitest.config.ts` scopes test discovery to `src/**/*.test.ts` (fixes a stale-`dist/` double-counting bug found during the reality check)
- ✅ ESLint (`eslint.config.mjs`) + Prettier (`.prettierrc`) — 0 lint errors, 37 warnings (all pre-existing `@typescript-eslint/no-explicit-any`, mostly in cheerio-typed `HtmlNormalizer.ts`)
- ✅ Coverage via `@vitest/coverage-v8` — Domain 91.56% stmts (>90% target met), global 87.23% stmts (>80% target met)
- ✅ `.github/workflows/backend-ci.yml` — build + lint + test on push/PR

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
| Manuscript route (E2E, supertest) | 5 |
| **Total** | **88** |

---

## Architecture Compliance

| Rule | Status |
|------|--------|
| Domain has zero external dependencies | ✅ |
| Application depends only on interfaces (ports live in Domain) | ✅ |
| No Domain objects in DTOs | ✅ |
| Dependency Inversion enforced (constructor injection throughout) | ✅ |
| All tests passing | ✅ (88/88) |
| No circular dependencies | ✅ |
| TypeScript strict mode | ✅ |
| Controller contains no business logic | ✅ |
| Domain coverage >90% | ✅ (91.56%) |
| Global coverage >80% | ✅ (87.23%) |

---

## Known Issues

- Two DOCX-import code paths exist side by side: the new tested pipeline (`/api/manuscripts/import`) and the old untested one (`/api/upload`, `docxParser.ts`). Not a bug, but an open decision (ADR-0009).
- `backend/uploads/` (13 real user documents) is still tracked in git, not excluded by `.gitignore` — flagged previously, not yet resolved.

---

## Technical Debt

- `QualityMetrics` interface (in `Book.ts`) is declared but unused — its typography-specific fields (`widowsAndOrphans`, `inconsistentSpacing`, `emptyHeadings`) need the Typography Engine (Sprint 4).
- `docs/architecture/diagrams/BASELINE_v0.1.md` is marked "frozen"; it wasn't edited as part of this phase (only `IMPORT_PIPELINE.md` and `DECISIONS.md` were updated) — its "86/86 tests" claim is stale and would need an ADR to formally correct per its own rules.

---

## Next Session Preparation

**To resume work:**
1. Read `docs/START_HERE.md`
2. Read this file (`CURRENT_STATE.md`)
3. Read `docs/ARCHITECTURE.md`
4. Begin Sprint 2: Theme Engine, Layout Engine, Professional DOCX Export

**Quick Start:**
```bash
cd "D:\Book Publisher Studio\backend"
npm test              # Verify all 88 tests pass
npm run build         # Verify TypeScript compilation
npm run lint           # Verify 0 ESLint errors
npm run test:coverage  # Verify coverage thresholds
```

---

## Dependencies

**Runtime:**
- mammoth (DOCX parser)
- cheerio (HTML normalizer)
- express, multer, cors

**Dev:**
- vitest, @vitest/coverage-v8
- typescript
- eslint, typescript-eslint, @eslint/js, prettier
- supertest, @types/supertest
- jszip (test-fixture generation only)

---

## Git Status

**Branch:** main
**Remote:** https://github.com/idealsuitesite/book-publisher-studio
