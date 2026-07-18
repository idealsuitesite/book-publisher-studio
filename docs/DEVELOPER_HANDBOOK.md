# Developer Handbook

Coding conventions and layer rules for Book Publisher Studio. This is reference material for writing code day-to-day — for *why* the architecture is shaped this way, see `docs/ARCHITECTURE.md` and `docs/DECISIONS.md`; for *when* a Design Review is required before writing code at all, see `docs/DESIGN_REVIEW_PROCESS.md`.

## Clean Architecture layering (non-negotiable)

1. **Domain has ZERO infrastructure dependencies.** No database access, no HTTP calls, no file I/O, no third-party library imports beyond types. All I/O happens in Infrastructure. (ADR-0002)
2. **Application depends only on abstractions.** Use Cases take interfaces (ports) via constructor injection, never concrete Infrastructure classes directly. (ADR-0003)
3. **Presentation depends on Application, never on Domain directly.** Controllers return DTOs, never Domain objects. Mappers convert Domain → DTO. (Core Principle 3, `docs/CLAUDE.md`)
4. **No cyclic dependencies, ever**, in any direction.

## Dependency Inversion

- Use Cases depend on interfaces, not implementations — constructor injection is mandatory, not a style preference.
- Mock interfaces for testing, never the concrete class.
- Swapping an implementation (e.g. `MammothParser` → a future `PDFParser`, both implementing `DocumentParser`) must never require touching the Use Case that consumes it.

## When something is a port vs. a concrete class

This project has answered this question explicitly, per-component, every time it came up — the pattern is consistent enough to state as a rule: **a component is a port (interface + swappable adapters) when more than one genuinely different implementation is plausible** (`Renderer<TOutput>` — DOCX/PDF/EPUB are structurally different targets; `DocumentParser` — DOCX/PDF/Markdown would each need a different library; `LayoutSelector` — manual-by-name today, content-driven-automatic later, ADR-0029). **A component is a concrete Domain class when there is exactly one correct implementation for this project's own model** (`ThemeEngine`, `LayoutEngine`, `TypographyResolver`, `ASTBuilder`, `BookValidator`, `ValidationEngine` — each is "the one way we do this," not a family of interchangeable strategies). Getting this wrong in either direction has a real cost: over-porting adds indirection with no real second implementation ever arriving (see `ValidationContext`'s reserved-fields tradeoff, Sprint 5); under-porting forces an awkward class hierarchy when a real second implementation does eventually show up. When genuinely unsure, this is exactly the kind of question a Design Review should settle explicitly (see Sprint 4's `TypographyResolver`-vs-`ThemeEngine` decision, or Sprint 6's `LayoutEngine`-extended-vs-new-class decision) rather than guessed inline.

## TypeScript

- Strict mode, no `any` (except in test mocks where a real type would add no safety).
- Explicit return types on every exported function/method.
- Full type safety across layer boundaries — a DTO's shape is asserted by its interface, not inferred loosely.

## SOLID / DDD, applied concretely in this codebase

- **Single Responsibility:** one `ValidationRule` = one business question (ADR-0028 principle 3) — a rule that reads the same field another rule already reads is fine if the *question* is different (`MetadataRule` vs. `ComplianceRule`).
- **Open/Closed:** a new `PageLayout` preset, a new `ValidationRule`, a new `Renderer` adapter should never require editing the class that consumes them beyond a registry entry.
- **Domain contains business logic; Infrastructure never does.** `HtmlNormalizer` shapes HTML into a `NormalizedDocument` — it does not decide what a valid `Book` looks like.
- **Value Objects are immutable; `Book` itself is immutable** (ADR-0001) — transformations return new instances, never mutate in place. This is why every additive field across this project's history (`StyledBook.blockTypography`, `PaginatedBook.pageLayout`/`.tableOfContents`, `Theme.runningHead`) is `?`-optional and additive rather than a breaking shape change.
- **Ubiquitous Language:** Domain names match publishing terminology a real editor would recognize (`Chapter`, `Section`, `Heading`, `TableOfContents`, `openingPageStyle` — not generic CRUD nouns).

## Naming conventions

- **Domain:** `Book`, `Chapter`, `Block`, `Validator`, `Calculator` — nouns from the publishing domain, not technical jargon
- **Application:** `ImportManuscriptUseCase`, `BookDTO`, `BookMapper` — `<Verb><Noun>UseCase`, `<Noun>DTO`, `<Noun>Mapper`
- **Infrastructure:** `HtmlNormalizer`, `MammothParser` — `<Technology/Format><Role>`
- **Presentation:** `ManuscriptController`, `ManuscriptRoute` — `<Resource><Layer>`

## Repository structure (monorepo, since Sprint 7 commit 1 / ADR-0033)

The repository root is an npm workspace (`package.json`'s `workspaces` field) — not a single `backend/` project anymore. The `src/` tree below this section is `backend/src/`'s own internal layering; this is the level above it:

```
Book Publisher Studio/                (repo root - npm workspace)
├── backend/                            (Express API - Domain/Application/Infrastructure/Presentation, see below)
├── frontend/                           (Next.js 16, App Router - Sprint 7 in progress)
│   └── app/                              only the create-next-app default page as of Commit 1;
│                                          upload/structure/format/preview routes land Commits 5-9
├── packages/
│   └── shared-types/                   canonical DTO/type definitions, consumed by both backend/
│                                          and frontend/ - types only, zero runtime dependencies (ADR-0033)
└── docs/                               governance, product, and technical documentation (this file's own directory)
```

Each of `backend/`, `frontend/`, `packages/shared-types/` has its own `package.json`, builds/lints/tests independently (`npm run <script> --workspace=<name>` from the root, or `cd` into it directly), and is installed from the single root `package-lock.json` — never its own nested lockfile (removed in ADR-0033).

## File structure (`backend/src/`)

```
src/
├── domain/           (Business logic only)
│   ├── models/
│   ├── services/
│   ├── ports/
│   ├── layouts/
│   ├── themes/
│   └── plugins/       (future)
├── application/       (Use Cases + DTOs)
│   ├── contracts/
│   ├── dto/
│   ├── mappers/
│   └── use-cases/
├── infrastructure/    (External services)
│   ├── normalizers/
│   ├── parsers/
│   ├── renderers/
│   └── fonts/
├── presentation/       (Controllers + Routes)
│   ├── controllers/
│   ├── routes/
│   └── middleware/
└── shared/             (cross-cutting utils/errors with no layer-specific logic)
```

- One class per file; tests alongside implementation (`Feature.ts` + `Feature.test.ts`)
- Domain services and Domain ports are separate directories (`services/` for concrete classes, `ports/` for interfaces) — a port is never defined inside `services/`

## Testing

See `docs/DEVELOPMENT_WORKFLOW.md`'s "Testing" section for the mechanics (which layer gets which test type, coverage thresholds, which fixture to use) and `docs/TESTING_STRATEGY.md` for the functional/rendering and structural/rendering taxonomies.

## Related

- `docs/ARCHITECTURE.md` — the fuller architectural reference this handbook summarizes into actionable rules (note: `docs/ARCHITECTURE.md` predates several sprints' worth of real structure — e.g. it doesn't yet reflect `domain/ports/`, `domain/layouts/`, `domain/themes/`, or the render pipeline beyond "planned" — treat this handbook's File Structure section above as the current source until `ARCHITECTURE.md` is refreshed)
- `docs/DECISIONS.md` / `docs/ADR_INDEX.md` — the specific decisions behind each rule above
- `docs/DESIGN_REVIEW_PROCESS.md` — when a new naming/layering question needs its own Design Review rather than a judgment call against this handbook
