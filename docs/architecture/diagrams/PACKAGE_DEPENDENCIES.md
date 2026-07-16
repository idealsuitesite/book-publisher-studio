# Package Dependency Graph

## Layers Overview
┌─────────────────────────────────────────────┐
│ PRESENTATION LAYER                          │
│ src/presentation/controllers                │
│ src/presentation/routes                     │
└─────────────────┬───────────────────────────┘
│
│ depends on
▼
┌─────────────────────────────────────────────┐
│ APPLICATION LAYER                           │
│ src/application/use-cases                   │
│ src/application/ports                       │
│ src/application/dto                         │
└─────────────────┬───────────────────────────┘
┌───────┴────────┐
│                │
depends on       depends on
│                │
▼                ▼
┌──────────────────┐  ┌─────────────────────┐
│ DOMAIN LAYER     │  │ INFRASTRUCTURE      │
│ src/domain/*     │  │ src/infrastructure/ │
│                  │  │                     │
│ Models, Services │  │ Parsers, Normalizers
└──────────────────┘  └─────────────────────┘
▲                    ▲
│             depends on
│                    │
└────────────────────┘
┌─────────────────────────────────────────────┐
│ SHARED LAYER                                │
│ src/shared/utils                            │
│ (No dependencies except Domain contracts)   │
└─────────────────────────────────────────────┘
## Module-Level Dependencies

### Domain Layer
domain/
├── models/
│   ├── Book.ts (root aggregate)
│   └── Normalized.ts (input contract)
├── services/
│   ├── ASTBuilder.ts
│   │   └─→ imports models/, shared/utils
│   ├── BookValidator.ts (planned)
│   │   └─→ imports models/
│   └── BookMetricsCalculator.ts (planned)
│       └─→ imports models/, shared/utils
### Application Layer
application/
├── use-cases/
│   └── ImportManuscriptUseCase.ts
│       └─→ imports domain/services, infrastructure ports
├── ports/
│   ├── IParser.ts
│   └── INormalizer.ts
└── dto/
└── BookDTO.ts
└─→ imports domain/models
### Infrastructure Layer
infrastructure/
├── parsers/
│   └── MammothParser.ts
│       └─→ imports domain/models (read-only)
└── normalizers/
└── HtmlNormalizer.ts
└─→ imports domain/models (read-only)
└─→ implements application/ports
└─→ uses cheerio (external)
### Presentation Layer
presentation/
├── controllers/
│   └── ManuscriptController.ts
│       └─→ imports application/use-cases
└── routes/
└── index.ts
└─→ uses express
## Dependency Violations Checklist

- [x] Domain never imports Infrastructure
- [x] Domain never imports Application
- [x] Domain never imports Presentation
- [x] Application never imports Presentation
- [x] Infrastructure only depends on Domain (contracts)
- [x] No circular dependencies
- [x] Shared layer is dependency-free (except types)

**Status:** ✅ CLEAN (v0.1.0-alpha.1)