# Import Pipeline (Manuscript → Book)

**Status:** Implemented end-to-end (Phase 2 complete). All steps below are real, tested code — not planned.

## Sequence Diagram

```
Client
  │  POST /api/manuscripts/import (multipart, DOCX buffer)
  ▼
ManuscriptController (Presentation)
  │  calls
  ▼
ImportManuscriptUseCase (Application)
  ├─→ DocumentParser.parse(buffer)              [Infrastructure: MammothParser]
  ├─→ DocumentNormalizer.normalize(html)         [Infrastructure: HtmlNormalizer]
  ├─→ ASTBuilder.build(normalized)                [Domain]
  ├─→ BookValidator.validate(book)                [Domain]
  ├─→ BookMetricsCalculator.calculate(book)       [Domain]
  ├─→ BookMetricsCalculator.countContent(book)    [Domain]
  └─→ BookMapper.map(book)                        [Application]
  ▼
ImportResponseDTO { book: BookDTO, report: ImportReportDTO }
  ▼
HTTP 200 (success) / 422 (parsed but invalid) / 400 (bad input) / 500 (unexpected)
```

This is the reference diagram for future use cases (`ExportPDFUseCase`, `ApplyThemeUseCase`, etc.), all implementing the same `UseCase<TRequest, TResponse>` contract.

## Detailed Steps

### Step 1: Parse (Infrastructure)
Input: `Buffer` (DOCX file binary)
Tool: Mammoth.js
Output: `{ html: "<h1>...</h1><p>...</p>" }`
Module: `src/infrastructure/parsers/MammothParser.ts` (implements `DocumentParser`)

### Step 2: Normalize (Infrastructure)
Input: HTML string from Mammoth
Tool: cheerio (DOM parsing)
Output: `NormalizedDocument { metadata: { title, author, fileName, uploadedAt }, nodes: [...] }`
Module: `src/infrastructure/normalizers/HtmlNormalizer.ts` (implements `DocumentNormalizer`)

### Step 3: Build (Domain)
Input: `NormalizedDocument`
Logic: Group headings into chapters/sections, build AST
Output: `Book { id, metadata, mainContent: [Chapter, ...], ... }` — `wordCount`/`pageCount`/`readingTime` are left `undefined` here; they're computed in Step 5, not Step 3.
Module: `src/domain/services/ASTBuilder.ts`

### Step 4: Validate (Domain)
Input: `Book`
Checks: non-empty content, chapter titles present, no duplicate chapter numbers, title/author present
Output: `ValidationResult { isValid, errors: ValidationError[], warnings: [] }`
Module: `src/domain/services/BookValidator.ts`
Scope note: structural/metadata checks only. Readability scoring, completeness scoring, and typography-issue detection (the fuller "ValidatorEngine" from the architecture vision) are Sprint 4 scope, once the Typography Engine exists.

### Step 5: Compute Metrics (Domain)
Input: `Book`
Output: `Book` enriched with `wordCount`, `pageCount` (300 words/page), `readingTime` (200 wpm) — plus a separate `countContent(book)` call returning `{ chapters, images, tables }` for the report
Module: `src/domain/services/BookMetricsCalculator.ts`

### Step 6: Map to DTO (Application)
Input: `Book` (enriched) + `ValidationResult`
Output:
```
{
  book: BookDTO,        // JSON-serializable, zero Domain-type references
  report: ImportReportDTO {
    status: "success" | "error",
    statistics: { chapters, images, tables, words },
    warnings: string[],
    errors: string[],
  }
}
```
Modules: `src/application/mappers/{BlockMapper,ChapterMapper,SectionMapper,BookMapper}.ts` (pure conversion only), `src/application/use-cases/ImportManuscriptUseCase.ts` (orchestration + report assembly)

## Error Handling

| Source | Result |
|---|---|
| No file attached | 400, `{ error: "No file uploaded" }` |
| Wrong file type / over size limit (multer) | 400 |
| DOCX fails to parse (`DocumentParseError`) | 400 |
| Book parses but fails validation | 422, body still includes the full `ImportResponseDTO` with `report.status: "error"` |
| Anything else unexpected | 500, `{ error: "Internal server error" }` (no internal details leaked) |

## Commit Timeline

- **Commit 1:** Parse stage (Mammoth parser) ✅
- **Commit 2:** Normalize stage (HtmlNormalizer) ✅
- **Commit 3:** Build stage (ASTBuilder) ✅
- **Commit 4:** Validate + Compute + Map + Presentation stages ✅ (BookValidator, BookMetricsCalculator, DTOs, mappers, ImportManuscriptUseCase, ManuscriptController, routes)
- **Commit 5:** BookDTO serialization ✅ (included in Commit 4 — DTOs and mappers were built together)

## Known limitation

`backend/src/index.ts` (via `presentation/app.ts`) still has a separate, legacy `POST /api/upload` route using `services/docxParser.ts` that never touches this pipeline (no Book AST, no tests). Both routes exist side by side; removing/replacing the legacy one is a separate, not-yet-made decision.
