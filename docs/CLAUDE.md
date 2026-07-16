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