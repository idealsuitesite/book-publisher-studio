# Import Pipeline (Manuscript → Book)

## High-Level Flow
User uploads DOCX file (Buffer)
│
▼
POST /api/manuscript/import
│
▼
┌──────────────────────────────────────────┐
│ Presentation Layer                       │
│ ManuscriptController.importFile()        │
└──────────────────┬───────────────────────┘
│
▼
┌──────────────────────────────────────────┐
│ Application Layer                        │
│ ImportManuscriptUseCase.execute()        │
└──────────────────┬───────────────────────┘
│
┌──────────────┼──────────────────┐
│              │                  │
▼              ▼                  ▼
[1. Parse]    [2. Normalize]     [3. Build]
│              │                  │
└──────────────┼──────────────────┘
│
┌──────────┼──────────┐
│          │          │
▼          ▼          ▼
[4. Validate] [5. Compute] [6. Map]
│          │          │
└──────────┼──────────┘
│
▼
HTTP Response (200 OK)
{ book: BookDTO, report: ImportReport }
## Detailed Steps

### Step 1: Parse (Infrastructure)
Input:  Buffer (DOCX file binary)
Tool:   Mammoth.js
Output: { value: "<h1>...</h1><p>...</p>", ... }
Module: src/infrastructure/parsers/MammothParser.ts
### Step 2: Normalize (Infrastructure)
Input:  HTML string from Mammoth
Tool:   cheerio (DOM parsing)
Output: NormalizedDocument {
metadata: { title, author, fileName, uploadedAt },
nodes: [
{ type: 'heading', level: 1, text: 'Chapter 1', ... },
{ type: 'paragraph', text: '...', inlines: [...], ... },
...
]
}
Module: src/infrastructure/normalizers/HtmlNormalizer.ts
### Step 3: Build (Domain)
Input:  NormalizedDocument
Logic:  Group headings into chapters/sections, build AST
Output: Book {
id: 'book-1',
metadata: { title, author, ... },
mainContent: [ Chapter { ... }, ... ],
wordCount: 50000,
pageCount: 250,
readingTime: 250
}
Module: src/domain/services/ASTBuilder.ts
### Step 4: Validate (Domain)
Input:  Book
Checks: Structure integrity, required fields, constraints
Output: ValidationResult {
isValid: true,
errors: [],
warnings: ["2 unsupported styles converted"]
}
Module: src/domain/services/BookValidator.ts (planned)
### Step 5: Compute Metrics (Domain)
Input:  Book
Output: Enriches Book with computed properties:

wordCount (exact count)
pageCount (heuristic: 300 words/page)
readingTime (wordCount / 200 wpm)
Module: src/domain/services/BookMetricsCalculator.ts (planned)
### Step 6: Map to DTO (Application)
Input:  Book + ValidationResult
Output: {
book: BookDTO (JSON-serializable),
report: ImportReport {
status: "success",
statistics: { chapters: 14, images: 3, tables: 2 },
warnings: ["2 styles converted", "1 table simplified"]
}
}
Module: src/application/use-cases/ImportManuscriptUseCase.ts
## Error Handling
At each stage, errors are caught and returned in the HTTP response:
ValidationError
→ 400 Bad Request { error: "Book structure invalid", details: [...] }
ParseError
→ 400 Bad Request { error: "DOCX parsing failed", details: [...] }
NormalizationError
→ 400 Bad Request { error: "HTML normalization failed", details: [...] }
InternalError
→ 500 Internal Server Error { error: "Unexpected error" }
## Commit Timeline

- **Commit 1:** Parse stage (Mammoth parser) ✅
- **Commit 2:** Normalize stage (HtmlNormalizer) ✅
- **Commit 3:** Build stage (ASTBuilder) ✅
- **Commit 4:** Validate + Compute + Map stages (this commit)
- **Commit 5:** Add BookDTO serialization