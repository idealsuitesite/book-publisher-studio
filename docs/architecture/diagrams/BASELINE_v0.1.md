# Architecture Baseline v0.1

**Status:** Frozen (v0.1.0-alpha.1)  
**Date:** 2026-07-16  
**Version:** 0.1.0-alpha.1

---

## 1. Overview

Book Publisher Studio is a domain-driven, layered architecture built on Clean Architecture principles. The system transforms raw DOCX manuscripts into structured Book ASTs (Abstract Syntax Trees) for formatting, validation, and multi-format export.

**Core Philosophy:**
- Domain Layer knows nothing about file formats, frameworks, or infrastructure
- Infrastructure Layer adapts external systems (HTML parsers, file I/O) to Domain contracts
- Application Layer orchestrates use cases
- Presentation Layer exposes HTTP endpoints

---

## 2. Layer Definitions

### **Domain Layer** (src/domain)
Purely business logic. Zero external dependencies except types.

**Modules:**
- `models/Book.ts` - Root aggregate for a manuscript
- `models/Normalized.ts` - Input contract from Infrastructure
- `services/ASTBuilder.ts` - Transforms NormalizedDocument → Book
- `services/BookValidator.ts` - Validates Book structure (planned)
- `services/BookMetricsCalculator.ts` - Computes wordCount, pageCount, readingTime

**Rules:**
- No imports from `infrastructure` or `application`
- No file I/O, network calls, or framework code
- Pure functions where possible
- All tests must pass with zero mocking

---

### **Application Layer** (src/application)
Orchestrates Domain services. Knows about use cases but not HTTP/frameworks.

**Modules:**
- `use-cases/ImportManuscriptUseCase.ts` - Orchestrates Parser → Normalizer → ASTBuilder → Validator → Mapper
- `ports/` - Interfaces (contracts) that Infrastructure must implement
- `dto/` - Data Transfer Objects for API responses

**Rules:**
- Depends on Domain and Ports, not Presentation
- Does NOT depend on Express, Next.js, or UI frameworks
- Transactional boundaries live here

---

### **Infrastructure Layer** (src/infrastructure)
Implements ports. Knows about external systems (Mammoth, cheerio, file I/O).

**Modules:**
- `parsers/MammothParser.ts` - DOCX → HTML (implements IParser)
- `normalizers/HtmlNormalizer.ts` - HTML → NormalizedDocument (implements INormalizer)

**Rules:**
- Can depend on Domain but not Application
- Can use external libraries freely
- Adapters convert external formats to Domain contracts

---

### **Presentation Layer** (src/presentation)
HTTP endpoints. Depends on Application.

**Modules:**
- `controllers/ManuscriptController.ts` - HTTP request handlers
- `routes/` - Express route definitions

**Rules:**
- Depends on Application, not Domain
- Translates DTOs to JSON responses
- Handles HTTP concerns (status codes, headers)

---

### **Shared Layer** (src/shared)
Utilities and cross-cutting concerns. No business logic.

**Modules:**
- `utils/idGenerator.ts` - Deterministic ID generation
- `utils/textMetrics.ts` - wordCount, pageCount, readingTime

---

## 3. Current Commit Status

| Commit | Module | Status | Tests |
|--------|--------|--------|-------|
| Commit 1 | `domain/models/Book.ts` | ✅ Complete | 7/7 |
| Commit 2 | `domain/services/ASTBuilder.ts` | ✅ Complete | 19/19 |
| Commit 3 | `infrastructure/normalizers/HtmlNormalizer.ts` | ✅ Complete | 15/15 |
| Commit 4 | Application layer + Presentation | 🔄 Planned | - |
| Commit 5 | BookMapper, DTOs | 🔄 Planned | - |

**Total Tests:** 86/86 passing ✅

---

## 4. Clean Architecture Validation

**Dependency Rules** (verified)
Presentation
↓
Application
↓
Domain
Presentation ←— Infrastructure
Infrastructure
↓
Domain (read-only)
**NO violations:**
- ✅ Domain never imports Infrastructure
- ✅ Domain never imports Application
- ✅ Application never imports Presentation
- ✅ Infrastructure implements Domain ports, not vice versa

---

## 5. Import Pipeline (Commit 4+)
POST /api/manuscript/import (Buffer DOCX)
↓
ImportManuscriptUseCase (Application)
├─ Parser.parse(buffer) → RawDocument
├─ Normalizer.normalize(raw) → NormalizedDocument
├─ ASTBuilder.build(normalized) → Book
├─ Validator.validate(book) → ValidationResult
├─ MetricsCalculator.compute(book) → void
└─ Mapper.toDTO(book, report) → BookDTO
↓
HTTP Response: { book: BookDTO, report: ImportReport }
---

## 6. Future Extensions (Planned, Not Breaking This Baseline)

**Commit 6+:** Theme Engine  
**Commit 10+:** PDF/EPUB Exporters (implement existing `IRenderer` port)  
**Commit 15+:** AI/LLM features (new Application service)  
**Commit 20+:** Multi-user collaboration (persistence layer)  

All extensions MUST:
1. Respect this dependency hierarchy
2. Use ports for external concerns
3. Have 80%+ test coverage
4. Include an ADR if changing architecture

---

## 7. Architecture Decision Records (ADR)

When proposing changes to this baseline:

1. Create `docs/architecture/adr/ADR-NNNN-{title}.md`
2. Document: Context, Decision, Consequences, Alternatives
3. Get review before merging to main

This baseline is frozen unless changed via ADR + review.

---

## 8. Package Dependency Graph

See `diagrams/PACKAGE_DEPENDENCIES.md`

---

## 9. Verification Checklist (v0.1)

- [x] Domain layer has zero external dependencies
- [x] All domain tests pass
- [x] Infrastructure adapters implement ports
- [x] No circular dependencies
- [x] Commit history is clean
- [x] TypeScript strict mode enabled
- [x] Code coverage >80%

---

**End of Baseline v0.1**