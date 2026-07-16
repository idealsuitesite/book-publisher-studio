# Release Notes — v0.2.0-alpha

**Tag:** `v0.2.0-alpha`
**Date:** 2026-07-17
**Codename:** Import Pipeline Complete

## Summary

This release completes the manuscript import pipeline end-to-end: a DOCX file, uploaded over HTTP, becomes a structured, validated, metrics-enriched Book AST, returned as a JSON DTO. Everything in this pipeline is tested and has been verified against a real DOCX file, not just synthetic fixtures.

## Features

- **DOCX import** — `MammothParser` converts a DOCX buffer to HTML
- **HTML normalization** — `HtmlNormalizer` converts HTML into a `NormalizedDocument` (headings, paragraphs, images, tables, lists, blockquotes, inline formatting)
- **Book AST construction** — `ASTBuilder` groups normalized nodes into a `Book` (chapters, nested sections, all block types)
- **Structural validation** — `BookValidator` checks for empty books, missing chapter titles, duplicate chapter numbers, missing title/author
- **Metrics calculation** — `BookMetricsCalculator` computes word count, page count, reading time, and content statistics (chapter/image/table counts), as an immutable transformation
- **DTOs and mapping** — 8 DTOs (`Metadata`, `Inline`, `Block`, `Chapter`, `Section`, `Book`, `ImportReport`, `ImportResponse`) and 4 pure mappers, fully independent of Domain types
- **Use case orchestration** — `ImportManuscriptUseCase`, the first implementation of the `UseCase<TRequest, TResponse>` contract every future use case will follow
- **REST API** — `POST /api/manuscripts/import`, memory-storage multer with MIME-type and size validation (25MB max), centralized error handling mapping to HTTP 200/400/422/500
- **Tests** — 88 tests: unit (Domain), integration (full pipeline via stubbed parser + real everything else), and E2E (supertest against the real Express app)
- **CI/CD** — GitHub Actions workflow (build + lint + test) on every push/PR touching `backend/`
- **Code quality tooling** — ESLint (0 errors, 37 warnings — see Known Issues), Prettier, `@vitest/coverage-v8`
- **Documentation** — `ARCHITECTURE.md`, `DECISIONS.md` (11 ADRs), `ROADMAP.md`, `TODO.md`, `CURRENT_STATE.md`, `VISION.md`, `IMPORT_PIPELINE.md`, all reconciled against actual code rather than aspirational

## Architecture

- **Clean Architecture / Hexagonal**: Domain has zero framework dependencies; Application depends only on interfaces (ports); Infrastructure implements those ports; Presentation depends on Application only
- **Dependency Inversion**: every cross-layer dependency in the pipeline is constructor-injected against an interface (`DocumentParser`, `DocumentNormalizer`), never a concrete class
- **Ports live in `domain/ports/`**, not `application/ports/` — keeps Infrastructure's dependency direction pointed at Domain only (a real violation was caught and fixed during this phase's build, not just avoided by luck)
- **DDD**: `Book` remains the single immutable aggregate every transformation reads from and returns a new instance of

## Quality Metrics

| Metric | Value |
|---|---|
| Tests | 88 passing, 0 failing |
| Domain coverage | 91.56% statements |
| Global coverage | 87.23% statements |
| ESLint | 0 errors, 37 warnings |
| TypeScript | strict mode, 0 compiler errors |
| CI | build + lint + test on every push/PR |

## Known Issues

- 37 ESLint warnings (`@typescript-eslint/no-explicit-any`), concentrated in cheerio-typed `HtmlNormalizer.ts` and the legacy `docxParser.ts` — tracked as a Sprint 2 "Quality Sprint" item, not fixed in this release
- Legacy `POST /api/upload` route (bypasses the Book AST entirely, untested) still exists alongside the new pipeline — marked `@deprecated`, removal scheduled Sprint 3 (ADR-0011)
- `errorHandler.ts` passes multer's own error message directly to the client for non-size-limit upload errors — low severity (multer's messages are generic, not internal details), not yet hardened
- No per-module `README.md` files yet, despite the stated "every module needs a README" rule
- `backend/uploads/` (13 real user documents) is untracked going forward but still present in past git history — a full history purge is a separate, not-yet-made decision

## What This Release Does Not Include

No rendering/export (PDF, EPUB, professional DOCX), no Theme Engine, no Layout Engine, no Typography Engine, no plugin system, no AI features, no licensing/subscription enforcement, no database, no authentication, no collaboration. All of these are intentionally out of scope — see `docs/VISION.md` for where they fit in the long-term plan, and `docs/TODO.md` for what's actually scheduled next.

## Upgrade / Migration Notes

Nothing to migrate — this is the first tagged release. Frontend (`frontend/`) is unaffected; it remains the default Next.js scaffold and has no work scoped until Sprint 5.

## Links

- Architecture: `docs/ARCHITECTURE.md`, `docs/architecture/diagrams/IMPORT_PIPELINE.md`
- Decisions: `docs/DECISIONS.md` (ADR-0001 through ADR-0011)
- Vision: `docs/VISION.md`
- Current state (living doc): `docs/CURRENT_STATE.md`
