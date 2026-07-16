# Architectural Decisions

## ADR-0001: Book is the Single Source of Truth

**Status:** APPROVED  
**Date:** 2026-01-15  
**Decision:** All data flows through the Book model.

**Rationale:**
- Eliminates data duplication
- Ensures consistency across export formats
- Simplifies state management
- Enables undo/redo

**Consequences:**
- All transformations must return a Book
- No side effects during transformation
- Immutable updates only

**Related:** Core architecture principle

---

## ADR-0002: Domain Layer Has Zero Infrastructure Dependencies

**Status:** APPROVED  
**Date:** 2026-01-15  
**Decision:** Domain imports NOTHING from external packages except for types.

**Rationale:**
- Maximum portability
- Testability without mocks
- Easy to replace infrastructure
- Domain is the core value

**Consequences:**
- No database access in Domain
- No HTTP calls in Domain
- No file I/O in Domain
- All I/O happens in Infrastructure

**Related:** Clean Architecture, Dependency Inversion

---

## ADR-0003: Dependency Inversion in Use Cases

**Status:** APPROVED  
**Date:** 2026-07-16  
**Decision:** Use Cases depend on interfaces, not implementations.

**Example:**
```typescript
class ImportManuscriptUseCase {
  constructor(
    private parser: DocumentParser,      // interface
    private normalizer: DocumentNormalizer,  // interface
    private builder: BookBuilder,        // interface
    // ... not concrete classes
  ) {}
}
```

**Rationale:**
- Easy to swap implementations (MammothParser → PDFParser)
- Easy to test with mocks
- Use Cases never change
- Infrastructure is pluggable

**Consequences:**
- More interfaces to maintain
- Mocking is mandatory
- Clear contracts between layers

**Related:** SOLID, Clean Architecture

---

## ADR-0004: Sequential Import Pipeline (No Branching)

**Status:** APPROVED  
**Date:** 2026-07-16  
**Decision:** Import pipeline is purely sequential. No conditional branches inside the Use Case.

**Pipeline:**
Parser → Normalizer → Builder → Validator → Metrics → Mapper → Response
**Rationale:**
- Easy to understand and debug
- No hidden branches
- Easy to add/remove steps
- Testable at each step

**Consequences:**
- Error handling is outside the pipeline
- Validation must happen at each step
- No early returns mid-pipeline

**Related:** Simplicity, Testability

---

## ADR-0005: DTOs Are Immutable and Independent of Domain

**Status:** APPROVED  
**Date:** 2026-07-16  
**Decision:** DTOs never reference Domain objects. All conversions happen in Mappers.

**Rationale:**
- Presentation never leaks Domain details
- Easy to evolve API without changing Domain
- Clear API contracts
- JSON serialization guaranteed

**Consequences:**
- Mappers are required for every Domain type
- DTOs must be maintained separately
- More code, but clearer boundaries

**Related:** Clean Architecture, Separation of Concerns

---

## ADR-0006: Testing Strategy

**Status:** APPROVED  
**Date:** 2026-07-16  
**Decision:**
- Unit tests for Domain (pure functions)
- Integration tests for Application (orchestration)
- E2E tests for Presentation (HTTP)

**Coverage:** Minimum 80%

**Rationale:**
- Domain is testable without infrastructure
- Application tests verify orchestration
- E2E tests verify HTTP contracts

**Related:** Quality Assurance

---

## ADR-0007: Git as Source of Truth

**Status:** APPROVED  
**Date:** 2026-07-16  
**Decision:** docs/ folder is committed to Git. It's the project memory.

**Files:**
- CURRENT_STATE.md (updated per sprint)
- ROADMAP.md (living document)
- DECISIONS.md (immutable history)
- TODO.md (task list)

**Rationale:**
- No dependency on individual Claude memory
- Onboarding new collaborators is fast
- Audit trail of decisions
- Distributed knowledge

**Consequences:**
- Discipline to update docs
- Clear communication required
- Instant context on new sessions

**Related:** Documentation, Knowledge Management

---

## ADR-0008: Metrics Ownership Moved from ASTBuilder to BookMetricsCalculator

**Status:** APPROVED
**Date:** 2026-07-16
**Decision:** `ASTBuilder.build()` no longer computes `wordCount`/`pageCount`/`readingTime` inline. That responsibility moved entirely to a new `BookMetricsCalculator.calculate(book): Book`, called by `ImportManuscriptUseCase` after validation.

**Rationale:**
- `ASTBuilder`'s single responsibility is `NormalizedDocument → Book` structure; word counting is a distinct concern
- Matches the Definition of Done requirement that `BookMetricsCalculator` exist as its own tested Domain service
- Keeps `Book.wordCount`/`pageCount`/`readingTime` as the same fields on `Book` (no new parallel `QualityMetrics` object yet — see below)

**Consequences:**
- `ASTBuilder.build()` now returns a `Book` with those three fields `undefined`; callers must run it through `BookMetricsCalculator` to get them populated
- The 3 existing metrics tests moved from `ASTBuilder.test.ts` to `BookMetricsCalculator.test.ts` (same assertions, different location)
- `Book.ts`'s `QualityMetrics` interface (with `widowsAndOrphans`, `inconsistentSpacing`, `emptyHeadings`, etc.) remains declared but unused — those fields require the Typography Engine (Sprint 4), and computing them now would mean fabricating zeros for something not actually analyzed. `BookMetricsCalculator` also exposes `countContent(book)` for the report's `chapters`/`images`/`tables` counts, which are legitimately computable now.

**Related:** Phase 2 (Application Layer), YAGNI

---

## ADR-0009: Legacy `/api/upload` Route Left in Place

**Status:** APPROVED
**Date:** 2026-07-16
**Decision:** The new `POST /api/manuscripts/import` route (Book AST pipeline) was added alongside the existing `POST /api/upload` route (`services/docxParser.ts`, disk-based multer, raw paragraph extraction, no tests, no Book AST). Neither route was deleted or modified to depend on the other.

**Rationale:**
- Removing the legacy route is a separate decision with its own consequences (breaks any existing client relying on its raw-paragraph response shape) that hadn't been made yet at the time Phase 2 was built
- Keeping both avoids blocking Phase 2 on an unrelated decision
- New route uses memory-storage multer (buffer only, nothing written to `backend/uploads/`), so it doesn't add to the already-flagged tracked-files concern in that directory

**Consequences:**
- Two DOCX-import code paths currently exist in the same server; only one is tested and follows Clean Architecture layering
- Follow-up decision still needed: deprecate, redirect, or remove the legacy route

**Related:** Repository Reality Check (2026-07-16), Phase 2 (Application + Presentation Layers)

---

## ADR-0011: Legacy `/api/upload` Marked Deprecated, Removal Scheduled for Sprint 3

**Status:** APPROVED
**Date:** 2026-07-17
**Decision:** Resolves ADR-0009's open follow-up. `POST /api/upload` (`presentation/app.ts`) and `parseDocxFile` (`services/docxParser.ts`) are marked `@deprecated` in code. Removal is scheduled for Sprint 3, after Sprint 2's rendering/export work lands — not immediately.

**Rationale:**
- `/api/manuscripts/import` now fully covers the same use case (DOCX → structured content) with a tested, Clean-Architecture-compliant pipeline
- Waiting until Sprint 3 avoids removing a working endpoint while Sprint 2 (Theme Engine, Layout Engine, DOCX export) is in flight, in case anything still depends on it during that work
- `@deprecated` JSDoc makes the intent visible in the IDE immediately, without requiring a doc lookup

**Consequences:**
- Both routes remain live through Sprint 2
- Sprint 3 planning must include: confirm nothing depends on `/api/upload`'s raw-paragraph response shape, then delete the route, `parseDocxFile`, and the disk-based multer config in `app.ts`

**Related:** ADR-0009, Sprint 3 (`docs/TODO.md`)

---

## ADR-0010: Correction of BASELINE_v0.1.md Test-Count Claims

**Status:** APPROVED
**Date:** 2026-07-17
**Decision:** `docs/architecture/diagrams/BASELINE_v0.1.md` is marked "frozen" (§7: "This baseline is frozen unless changed via ADR + review") and states "Total Tests: 86/86 passing." That number was never accurate — even at the time it was written, its own commit table (7+19+15=41) didn't add up to 86; the 86 figure was an early instance of the same stale-`dist/`-double-counting bug found and fixed during the 2026-07-16 reality check. Current verified count is 88 tests (see `docs/CURRENT_STATE.md`).

Per this ADR (satisfying BASELINE's own change-control rule): `BASELINE_v0.1.md` is annotated as superseded for metrics purposes, without rewriting its architectural content (which remains accurate — Domain/Application/Infrastructure/Presentation layer definitions and dependency rules still hold).

**Rationale:**
- BASELINE's own governance rule requires an ADR to change it — this is that ADR
- Rewriting the whole document would lose the historical record of what v0.1.0-alpha.1 actually specified
- `CURRENT_STATE.md` is already the living source for test counts and should stay that way, rather than duplicating maintenance across two files

**Consequences:**
- `BASELINE_v0.1.md` gets a short status annotation pointing to `CURRENT_STATE.md`, not a full rewrite
- Future architecture-baseline corrections should follow this same pattern: new ADR + annotation, not silent edits to a "frozen" doc

**Related:** Repository Reality Check (2026-07-16), ADR-0007 (Git as Source of Truth)