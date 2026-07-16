# Current State - Book Publisher Studio

**Last Updated:** July 16, 2026 17:45 UTC
**Sprint:** Sprint 1 - Import Pipeline
**Phase:** Phase 1 (Domain + Infrastructure) complete. Phase 2 (Application) and Phase 3 (Presentation) not started.

---

## Summary

**Completed:** 43 tests passing ✅ (backend/src only — see note below on prior counts)
**Next:** Application Layer (ImportManuscriptUseCase, DTOs, mappers), then Presentation Layer (ManuscriptController)

> Earlier versions of this file claimed Phase 2 (Application Layer) was complete with 69–110 tests passing. That did not match the actual `backend/src` tree: there is no `application/` directory, no `ImportManuscriptUseCase.ts`, no DTOs, no mappers, and no `BookValidator`/`BookMetricsCalculator` as separate services. The inflated counts came from vitest also running stale compiled test files left over in `backend/dist/` (gitignored build output) with no `vitest.config` to exclude them — including, at one point, orphaned `dist/application/**` files for an Application layer that no longer existed in `src/`. Both issues are now fixed: `dist/` was cleared and `backend/vitest.config.ts` now scopes test discovery to `src/**/*.test.ts`.

---

## Sprint 1: Import Pipeline

### Phase 1: Domain + Infrastructure ✅ COMPLETE

**Status:** 43/43 tests passing

- ✅ Book domain model (immutable) — `src/domain/models/Book.ts` (7 tests)
- ✅ Normalized document contract — `src/domain/models/Normalized.ts`
- ✅ ASTBuilder service (Normalized → Book, incl. metrics calculation) — `src/domain/services/ASTBuilder.ts` (19 tests)
- ✅ HtmlNormalizer (HTML → NormalizedDocument) — `src/infrastructure/normalizers/HtmlNormalizer.ts` (17 tests)
- ✅ Block types: heading, paragraph, image, table, list, quote, scripture, footnote
- ✅ Shared utils: `idGenerator.ts`, `textMetrics.ts`
- ✅ `src/services/docxParser.ts` (DOCX → HTML via Mammoth, not yet wired into a use case)

**Not implemented as separate services** (contrary to earlier docs): `BookValidator`, `BookMetricsCalculator` — metrics are currently computed inline inside `ASTBuilder`.

---

### Phase 2: Application Layer 🔴 NOT STARTED

Nothing exists yet under `src/application/`. Needed:
- `UseCase<TRequest, TResponse>` contract
- `ImportRequest` / `ImportResponseDTO` types
- `DocumentParser`, `DocumentNormalizer`, `BookBuilder`, `BookMapper` port interfaces
- DTOs: `MetadataDTO`, `BlockDTO`, `ChapterDTO`, `SectionDTO`, `BookDTO`
- Mappers: `BlockMapper`, `ChapterMapper`, `SectionMapper`, `BookMapper`
- `ImportManuscriptUseCase` orchestrating Parser → Normalizer → ASTBuilder → (Validator) → Mapper

---

### Phase 3: Presentation Layer 🔴 NOT STARTED

- `ManuscriptController.ts`
- `routes/manuscripts.ts`
- Express wiring, error-handling middleware
- E2E HTTP tests

---

## Test Summary

| Component | Tests | Status |
|-----------|-------|--------|
| Book domain model | 7 | ✅ |
| ASTBuilder | 19 | ✅ |
| HtmlNormalizer | 17 | ✅ |
| **Total** | **43** | **✅** |

---

## Architecture Compliance

| Rule | Status |
|------|--------|
| Domain has zero external dependencies | ✅ |
| All tests passing | ✅ |
| No circular dependencies | ✅ |
| TypeScript strict mode | ✅ |
| Application depends only on interfaces | N/A — not yet built |
| No Domain objects in DTOs | N/A — no DTOs yet |

---

## Known Issues

- None currently (stale-`dist/` test pollution fixed by adding `backend/vitest.config.ts`)

---

## Technical Debt

- Documentation (`CURRENT_STATE.md`, `ROADMAP.md`, `TODO.md`, `DECISIONS.md`) previously described Phase 2 as complete when it wasn't. This file has been corrected; the others may still need reconciling.

---

## Next Session Preparation

**To resume work:**
1. Read `docs/START_HERE.md`
2. Read this file (`CURRENT_STATE.md`)
3. Read `docs/ARCHITECTURE.md`
4. Begin Phase 2: Application Layer

**Quick Start:**
```bash
cd "D:\Book Publisher Studio\backend"
npm test              # Verify all 43 tests pass
npm run build         # Verify TypeScript compilation
```

**Next Task:**
- Build the Application layer (use case, ports, DTOs, mappers) before starting Presentation
- Then: ManuscriptController, manuscript routes, E2E tests

---

## Dependencies

**Runtime:**
- mammoth (DOCX parser)
- cheerio (HTML normalizer)
- express (not yet used)

**Dev:**
- vitest
- typescript

---

## Git Status

**Branch:** main
**Remote:** https://github.com/idealsuitesite/book-publisher-studio
