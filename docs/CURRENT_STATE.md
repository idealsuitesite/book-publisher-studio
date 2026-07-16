# Current State - Book Publisher Studio

**Last Updated:** July 17, 2026 22:25 UTC
**Sprint:** Sprint 2 - Rendering Engine (Theme Engine, Layout Engine, DOCX Export)
**Branch:** `feature/sprint-2-rendering-engine` (not yet merged to `main` — see Git Status)

---

## Summary

**Completed:** 118 tests passing ✅ (verified via `npm test`, `npm run build`, `npm run lint`, `npm run test:coverage`, plus a real DOCX exported end-to-end against a running server)
**Next:** Merge this branch to `main` per `docs/MERGE_CHECKLIST.md`, then Sprint 3 (PDF export, EPUB export)

---

## Sprint 1: Import Pipeline ✅ COMPLETE (tagged `v0.2.0-alpha`)

Domain + Infrastructure + Application + Presentation for `POST /api/manuscripts/import`. See `docs/releases/v0.2.0-alpha/ReleaseNotes.md` for full detail — not repeated here.

---

## Sprint 2: Rendering Engine 🔄 IN PROGRESS (implementation, on feature branch)

**Design Review complete and approved** (ADR-0012, 0013, 0014, 0016, 0017 — `docs/architecture/diagrams/RENDERING_PIPELINE.md`). **Implementation now built and tested**, not yet merged to `main`.

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

**Not yet done (still Sprint 2 scope, per `docs/TODO.md`):**
- Quality Sprint: 37 ESLint warnings still outstanding (unchanged this phase, tracked not fixed)
- Merge to `main` — this branch hasn't been merged yet; `docs/MERGE_CHECKLIST.md` should be run through explicitly before that happens

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
| **ThemeEngine** | **4** |
| **getTheme** | **2** |
| **LayoutEngine** | **8** |
| **DOCXRenderer** | **5** |
| **ExportManuscriptUseCase** | **6** |
| **Manuscript export route (E2E)** | **5** |
| **Total** | **118** |

(Bold rows are new this sprint.)

---

## Architecture Compliance

| Rule | Status |
|------|--------|
| Domain has zero external dependencies | ✅ |
| Application depends only on interfaces (ports live in Domain) | ✅ |
| No Domain objects in DTOs | ✅ |
| Dependency Inversion enforced (constructor injection throughout) | ✅ |
| All tests passing | ✅ (118/118) |
| No circular dependencies | ✅ |
| TypeScript strict mode | ✅ |
| Controller contains no business logic | ✅ |
| Domain coverage >90% | ✅ (92.64%) |
| Global coverage >80% | ✅ (88.01%) |
| Renderer is a port; ThemeEngine/LayoutEngine are concrete classes | ✅ (Design Review decision, ADR-0012 addendum) |

---

## Known Issues

- Two DOCX-import code paths exist side by side: the new tested pipeline (`/api/manuscripts/import`) and the old untested one (`/api/upload`, `docxParser.ts`). Both marked `@deprecated`, removal scheduled Sprint 3 (ADR-0011).
- `backend/uploads/` history: files are untracked going forward (fixed — see ADR in `docs/DECISIONS.md` / `docs/TODO.md`), but still present in past git history. Full history purge is a separate, not-yet-made decision.
- ADR-0015 (EPUB renderer library) and the DOCX-adjacent library choice for a future `docx`-alternative if `docx` proves insufficient remain open — not blocking, since DOCX export (this sprint) uses `docx` (ADR-0018) and EPUB is Sprint 3.

---

## Technical Debt

- `QualityMetrics` interface (in `Book.ts`) is declared but unused — needs the Typography Engine (Sprint 4).
- 37 ESLint warnings (`@typescript-eslint/no-explicit-any`) — tracked as a Sprint 2 Quality Sprint item, not yet fixed.
- `DOCXRenderer`'s footnote rendering is simplified (inline `[n] content` paragraph, not real Word footnotes) and ordered lists use a manual prefix instead of `docx`'s numbering config — both documented, deliberate simplifications, not silent gaps.
- `docs/architecture/diagrams/BASELINE_v0.1.md`'s "86/86 tests" claim was corrected via ADR-0010 (status annotation only, content not rewritten, per the doc's own frozen/ADR-only change rule).

---

## Next Session Preparation

**To resume work:**
1. Read `docs/START_HERE.md`
2. Read this file (`CURRENT_STATE.md`)
3. Read `docs/MERGE_CHECKLIST.md` before merging `feature/sprint-2-rendering-engine`
4. After merge: begin Sprint 3 (PDF export — ADR-0014 already decided; EPUB export — ADR-0015 spike still needed)

**Quick Start:**
```bash
cd "D:\Book Publisher Studio\backend"
git checkout feature/sprint-2-rendering-engine
npm test              # Verify all 118 tests pass
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
- **docx** (DOCX generation — new this sprint, ADR-0018)

**Dev:**
- vitest, @vitest/coverage-v8
- typescript
- eslint, typescript-eslint, @eslint/js, prettier
- supertest, @types/supertest
- jszip (test-fixture generation and test-side docx inspection)

---

## Git Status

**Branch:** `feature/sprint-2-rendering-engine` (created from `main` at `d684201`, per ADR-0017)
**`main` last synced with `origin/main`:** `d684201`
**Remote:** https://github.com/idealsuitesite/book-publisher-studio
**Tags:** `v0.1.0-alpha.1`, `v0.2.0-alpha`
