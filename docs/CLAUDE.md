# Claude Instructions for Book Publisher Studio

## Core Principles

1. **Always review architecture before coding**
   - Check CLAUDE.md
   - Check docs/CURRENT_STATE.md
   - Check docs/ARCHITECTURE.md

2. **Never violate Clean Architecture**
   - Domain has ZERO infrastructure dependencies
   - Application depends only on abstractions
   - Presentation depends on Application
   - No cyclic dependencies

3. **Never expose Domain objects to Presentation**
   - Use DTOs for HTTP responses
   - Mappers convert Domain → DTO
   - Controllers never touch Domain

4. **Always use Dependency Inversion**
   - Use Cases depend on interfaces, not implementations
   - Constructor injection mandatory
   - Mock interfaces for testing

5. **Strict TypeScript**
   - No `any` (except for mocks)
   - Explicit return types
   - Full type safety

6. **SOLID Principles**
   - Single Responsibility
   - Open/Closed
   - Liskov Substitution
   - Interface Segregation
   - Dependency Inversion

7. **DDD (Domain-Driven Design)**
   - Domain contains business logic
   - Value Objects are immutable
   - Aggregates are explicit
   - Ubiquitous Language

8. **No Technical Debt**
   - Write tests before code
   - Document architectural decisions
   - Refactor before adding features
   - Keep coverage >80%

## After Every Task

- [ ] Update docs/CURRENT_STATE.md
- [ ] Update docs/TODO.md
- [ ] Run `npm test` (all tests pass)
- [ ] Run `npm run build` (no errors)
- [ ] Commit with clear message
- [ ] Push to GitHub

## Before Every Session

See [docs/START_HERE.md](START_HERE.md) for the reading order, then summarize:
- Current architecture
- Current sprint status
- Current task
- Remaining work
- Next action

## File Structure (Immutable)
src/
├── domain/           (Business logic only)
│   ├── models/
│   ├── services/
│   └── plugins/
├── application/      (Use Cases + DTOs)
│   ├── contracts/
│   ├── dto/
│   ├── mappers/
│   └── use-cases/
├── infrastructure/   (External services)
│   ├── normalizers/
│   └── parsers/
└── presentation/     (Controllers + Routes)
├── controllers/
└── routes/
## Testing Rules

- Unit tests for Domain
- Integration tests for Use Cases
- E2E tests for Presentation
- Minimum 80% coverage
- All tests must pass before commit

## Permanent Verification Policy (Real Export Checklist)

This project has already missed multiple real bugs that synthetic fixtures did not detect: PDF "Page 6 of 4" (ADR-0019 finding 6C), a completely empty EPUB (ADR-0020 addendum), and PDFKit infinite pagination (ADR-0019 finding 6B). All three were caught only by exporting a real manuscript through the running HTTP API and visually inspecting the output — never by a green `npm test` alone.

**Rule:** any change touching `DOCXRenderer`, `PDFRenderer`, `EPUBRenderer`, `ThemeEngine`, `LayoutEngine`, `TypographyResolver`, the `Renderer` port, or `ExportManuscriptUseCase` must complete `docs/REAL_EXPORT_CHECKLIST.md` before the task is considered done — unit tests and E2E tests passing is necessary but never sufficient on its own for this category of change. No sprint touching the rendering pipeline is complete until at least one real manuscript from `backend/uploads/` has been exported (all applicable formats) through `POST /api/manuscripts/export` and manually inspected — not by calling a renderer class directly in a script.

This is enforced at merge time via `docs/MERGE_CHECKLIST.md`'s own gate for this category of change. It applies automatically in every session touching the rendering pipeline, without needing to be re-requested.

## Naming Conventions

- Domain: `Book`, `Chapter`, `Block`, `Validator`, `Calculator`
- Application: `ImportManuscriptUseCase`, `BookDTO`, `BookMapper`
- Infrastructure: `HtmlNormalizer`, `MammothParser`
- Presentation: `ManuscriptController`, `ManuscriptRoute`

## Documentation

- Update DECISIONS.md for architectural changes
- Update CURRENT_STATE.md after each sprint
- Update ROADMAP.md if timelines change
- Keep docs/architecture/diagrams/ current