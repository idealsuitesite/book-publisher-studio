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

This project has already missed multiple real bugs that synthetic fixtures did not detect: PDF "Page 6 of 4" (ADR-0019 finding 6C), a completely empty EPUB (ADR-0020 addendum), and PDFKit infinite pagination (ADR-0019 finding 6B). All three were caught only by exporting a real manuscript through the running HTTP API and visually inspecting the output — never by a green `npm test` alone. A separate incident (2026-07-17) showed the verification step itself can silently give a false read too: a real-export check was reported against the wrong port, never actually checked against the server's own startup log — see the Server Verification Policy below, added for exactly this reason.

**Rule:** any change touching `DOCXRenderer`, `PDFRenderer`, `EPUBRenderer`, `ThemeEngine`, `LayoutEngine`, `TypographyResolver`, the `Renderer` port, or `ExportManuscriptUseCase` must complete `docs/REAL_EXPORT_CHECKLIST.md` before the task is considered done — unit tests and E2E tests passing is necessary but never sufficient on its own for this category of change. No sprint touching the rendering pipeline is complete until the canonical fixture (see Real Export Policy below) has been exported (all applicable formats) through `POST /api/manuscripts/export` and inspected — not by calling a renderer class directly in a script.

This is enforced at merge time via `docs/MERGE_CHECKLIST.md`'s own gate for this category of change. It applies automatically in every session touching the rendering pipeline, without needing to be re-requested.

## Server Verification Policy

Never assume the backend port.

Before every real export verification:

1. Read the server's own startup output (`npm run dev` prints `Server running on http://localhost:PORT`) — do not assume a value.
2. Verify `GET /api/health` returns HTTP 200 on that exact port.
3. Use that verified port for every export request in the session.
4. Never hardcode `localhost:3000` — nothing in this project listens there. `src/index.ts` reads `PORT` from the environment (default `5000`); dev, tests, CI, and tooling all resolve it the same way.

`npm run verify-server` automates steps 1-3 (plus confirming the export route is registered and the canonical fixture — see below — exists) and exits non-zero on any failure with the specific check that failed. Run it before any Real Export Verification pass instead of assuming the server is reachable.

## Real Export Policy

Always use `backend/verification/typography-test.docx` for every real export verification, unless the change specifically concerns pagination/performance (`backend/verification/large-book.docx`), images (`backend/verification/images.docx`), or tables (`backend/verification/tables.docx`) — see `backend/verification/README.md`.

- Never search `backend/uploads/` or elsewhere for a DOCX to use.
- Never generate a temporary DOCX for verification.
- If the expected fixture file is missing, **stop and ask** — do not substitute or regenerate it silently.

This ensures the same known documents are used for verification every session, rather than whatever happens to be present.

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