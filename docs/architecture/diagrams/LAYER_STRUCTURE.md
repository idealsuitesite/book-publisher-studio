# Layer Structure & Responsibilities

## Detailed Breakdown

### Domain Layer
**Purpose:** Pure business logic. The "core" of the system.

**What it contains:**
- Business entities (Book, Chapter, Section, Block)
- Business rules (ASTBuilder logic)
- Domain services (Validator, MetricsCalculator)

**What it DOESN'T know:**
- HTTP, Express, REST
- File formats (DOCX, HTML)
- Databases, persistence
- External libraries except types

**Examples:**
```typescript
// ✅ OK: Pure business logic
class ASTBuilder {
  build(doc: NormalizedDocument): Book { ... }
}

// ❌ NOT OK: Would violate Domain purity
class ASTBuilder {
  async build(filePath: string): Book {
    const html = fs.readFileSync(filePath);  // I/O!
    ...
  }
}
```

---

### Application Layer
**Purpose:** Orchestrates Domain services into use cases.

**What it contains:**
- Use cases (ImportManuscript)
- Port interfaces (IParser, INormalizer)
- DTOs for HTTP responses
- Transaction/workflow logic

**What it DOESN'T know:**
- HTTP framework details (Express, routing)
- Database/ORM specifics
- File I/O

**Examples:**
```typescript
// ✅ OK: Orchestrates Domain + Infra
class ImportManuscriptUseCase {
  execute(buffer: Buffer) {
    const raw = this.parser.parse(buffer);
    const normalized = this.normalizer.normalize(raw);
    const book = this.astBuilder.build(normalized);
    return book;
  }
}

// ❌ NOT OK: Would violate Application responsibility
class ImportManuscriptUseCase {
  async execute(req: Request, res: Response) {  // HTTP concerns!
    ...
    res.json(book);
  }
}
```

---

### Infrastructure Layer
**Purpose:** Implements Domain contracts using external tools.

**What it contains:**
- Parsers (Mammoth, docx-js)
- Normalizers (HTML parsing with cheerio)
- External library adapters

**What it DOESN'T know:**
- Presentation concerns (HTTP status codes)
- Application workflow logic

**Examples:**
```typescript
// ✅ OK: Adapter for external tool
class HtmlNormalizer implements INormalizer {
  normalize(html: string): NormalizedDocument {
    const $ = load(html);  // cheerio dependency OK here
    ...
  }
}

// ❌ NOT OK: Would violate Infrastructure purpose
class HtmlNormalizer {
  normalize(req: Request): NormalizedDocument {  // HTTP in Infrastructure!
    ...
  }
}
```

---

### Presentation Layer
**Purpose:** HTTP handling. Exposes use cases as endpoints.

**What it contains:**
- Controllers (request handlers)
- Routes (Express routing)
- HTTP middleware

**What it DOESN'T know:**
- Domain business logic
- Database details

**Examples:**
```typescript
// ✅ OK: HTTP handler calling use case
router.post('/api/manuscript/import', async (req, res) => {
  const result = await useCase.execute(req.file.buffer);
  res.json(result);
});

// ❌ NOT OK: Business logic in Presentation
router.post('/api/manuscript/import', async (req, res) => {
  const book = new ASTBuilder().build(someData);  // Logic in controller!
  res.json(book);
});
```

---

## Dependency Direction (Always Inward)
Presentation
     ↓
Application
  ↙    ↖
  Domain ← Infrastructure
↑
Shared (no deps)
**Rule:** Dependencies flow INWARD only. Never outward.

---

## Test Strategy by Layer

**Domain Tests** (86 tests)
- No mocks needed
- Pure function testing
- Test all edge cases

**Application Tests** (planned)
- Mock Infrastructure ports
- Test orchestration logic

**Infrastructure Tests** (planned)
- Test adapters
- Mock external libraries if needed

**Presentation Tests** (planned)
- Mock Application use cases
- Test HTTP contract