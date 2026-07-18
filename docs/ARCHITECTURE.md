# Architecture Reference

> **⚠️ PARTIALLY STALE — the principles are current, the file listings are not (annotated 2026-07-18).**
>
> The **Core Principles** below remain accurate and are still the rules this codebase follows. The **directory listings** are Sprint-1-era and describe as "(planned)" several things that shipped long ago: renderers (Sprints 2–3B), themes (Sprint 3), and the export use case (Sprint 2). Nine sprints have shipped through `v0.9.0-alpha`.
>
> This staleness was disclosed in `docs/DEVELOPER_HANDBOOK.md` from Sprint 6 onward but never corrected. It is annotated here rather than rewritten (ADR-0010 precedent), because the principles are worth keeping verbatim and the listings are better read from the code than maintained by hand in a fourth place.
>
> **For the current structure, read the code** — `backend/src/{domain,application,infrastructure,presentation}` and `frontend/{app,components,lib}`. For which engines exist and what they do, see `docs/VERSIONS.md` and the per-sprint Level 2 Design Reviews in `docs/architecture/diagrams/`.

## Core Principles

### 1. Book is the Single Source of Truth

All data flows through the `Book` model:
- Parsed content → normalized → AST → Book
- Book → validated → metrics calculated → Book
- Book → mapped → DTO → HTTP response
- Book → themed → rendered → PDF/EPUB

### 2. Domain Layer (Zero Dependencies)
domain/
├── models/
│   └── Book.ts          (Immutable data structure)
├── services/
│   ├── ASTBuilder       (Normalized → Book)
│   ├── BookValidator    (Book validation)
│   ├── BookMetrics      (Calculate metrics)
│   └── BookFactory      (Create Book)
└── plugins/
└── (Future: Custom processors)
**Rules:**
- No imports from Application, Infrastructure, or Presentation
- All functions are pure (no side effects)
- Immutable data structures
- Clear error types

### 3. Application Layer (Orchestration Only)
application/
├── contracts/
│   └── UseCase.ts       (Generic interface)
├── dto/
│   ├── BookDTO
│   ├── ChapterDTO
│   ├── SectionDTO
│   ├── MetadataDTO
│   └── ImportResponseDTO
├── mappers/
│   ├── BlockMapper
│   ├── ChapterMapper
│   ├── BookMapper
│   └── (Mapper for each aggregate)
└── use-cases/
├── ImportManuscriptUseCase
├── ExportBookUseCase        (planned)
├── ApplyThemeUseCase        (planned)
└── GeneratePDFUseCase       (planned)
**Rules:**
- Use Cases depend on interfaces, not implementations
- No business logic (it's in Domain)
- Pure orchestration only
- All dependencies injected
- No side effects

### 4. Infrastructure Layer (External Services)
infrastructure/
├── normalizers/
│   └── HtmlNormalizer   (HTML → NormalizedDocument)
├── parsers/
│   └── MammothParser    (DOCX → RawDocument)
├── renderers/           (planned)
│   ├── PDFRenderer
│   ├── EPUBRenderer
│   └── HTMLRenderer
└── themes/              (planned)
└── ThemeEngine
**Rules:**
- Pluggable implementations
- Can be swapped without changing Domain/Application
- External API calls here
- Error handling for external failures

### 5. Presentation Layer (HTTP Interface)
presentation/
├── controllers/
│   └── ManuscriptController
├── routes/
│   └── manuscripts.ts
└── middleware/
├── errorHandler
└── validation
**Rules:**
- Controllers are thin
- No business logic
- Return DTOs, not Domain objects
- HTTP status codes mapped to errors

## Import Pipeline (Sequential)
ImportRequest (buffer, filename, mimeType)
↓
DocumentParser.parse()
↓ RawDocument
DocumentNormalizer.normalize()
↓ NormalizedDocument
BookBuilder.build()
↓ Book
BookValidator.validate()
↓ validation result
BookMetricsCalculator.calculate()
↓ Book (with metrics)
BookMapper.map()
↓ BookDTO
ImportResponseDTO
**No branching. No conditions. Pure sequence.**

## Render Pipeline (Planned)
Book
↓
ThemeEngine.apply()
↓ StyledBook
TypographyEngine.compute()
↓ LayoutBook
PDFRenderer.render()
↓ PDF bytes
## Key Abstractions

### DocumentParser (Dependency Inversion)

```typescript
interface DocumentParser {
  parse(buffer: Buffer): Promise<RawDocument>;
}
```

Implementations:
- MammothParser (DOCX)
- PDFParser (planned)
- MarkdownParser (planned)

### DocumentNormalizer

```typescript
interface DocumentNormalizer {
  normalize(doc: RawDocument): NormalizedDocument;
}
```

Implementations:
- HtmlNormalizer (current)

### BookBuilder

```typescript
interface BookBuilder {
  build(doc: NormalizedDocument): Book;
}
```

Implementations:
- ASTBuilder (current)

### BookMapper

```typescript
interface BookMapper {
  map(book: Book): BookDTO;
}
```

## Dependency Graph
Domain (no dependencies)
↑
Application (depends on Domain + interfaces)
↑
Infrastructure (implements Application interfaces)
↑
Presentation (depends on Application)
**No circular dependencies. Ever.**

## Testing Strategy

| Layer | Test Type | Example |
|-------|-----------|---------|
| Domain | Unit | BookValidator.test.ts |
| Application | Unit + Integration | ImportManuscriptUseCase.test.ts |
| Infrastructure | Unit | HtmlNormalizer.test.ts |
| Presentation | E2E | ManuscriptController.test.ts |

## File Organization

- One class per file
- Related classes in same folder
- Tests alongside implementation
- Naming: `Feature.ts` + `Feature.test.ts`

## Error Handling

- Domain throws typed errors
- Application catches and converts
- Presentation returns HTTP errors
- No error swallowing

## Immutability

- Book is immutable
- DTOs are immutable
- Configs are immutable
- State is passed, not mutated