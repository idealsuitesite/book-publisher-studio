# ADR Index

A navigable table of every Architectural Decision Record in `docs/DECISIONS.md`, so a reader doesn't have to scroll a 750+ line file to find one. **This index is a pointer, not a source of truth** — `docs/DECISIONS.md` remains the single canonical record; this table is regenerated whenever an ADR is added, never edited independently of it. To jump to an entry, search `docs/DECISIONS.md` for its number (e.g. `ADR-0019`) — every heading is `## ADR-00NN: <title>`, so this always lands exactly.

| # | Title | Date | Category | Status |
|---|---|---|---|---|
| 0001 | Book is the Single Source of Truth | 2026-01-15 | Architecture | APPROVED |
| 0002 | Domain Layer Has Zero Infrastructure Dependencies | 2026-01-15 | Architecture | APPROVED |
| 0003 | Dependency Inversion in Use Cases | 2026-07-16 | Architecture | APPROVED |
| 0004 | Sequential Import Pipeline (No Branching) | 2026-07-16 | Import | APPROVED |
| 0005 | DTOs Are Immutable and Independent of Domain | 2026-07-16 | Architecture | APPROVED |
| 0006 | Testing Strategy | 2026-07-16 | Governance | APPROVED |
| 0007 | Git as Source of Truth | 2026-07-16 | Governance | APPROVED |
| 0008 | Metrics Ownership Moved from ASTBuilder to BookMetricsCalculator | 2026-07-16 | Architecture | APPROVED |
| 0009 | Legacy `/api/upload` Route Left in Place | 2026-07-16 | Import | APPROVED |
| 0010 | Correction of BASELINE_v0.1.md Test-Count Claims | 2026-07-17 | Governance | APPROVED |
| 0011 | Legacy `/api/upload` Marked Deprecated, Removal Scheduled for Sprint 3 | 2026-07-17 | Import | APPROVED |
| 0012 | Rendering Engine Architecture | 2026-07-17 | Rendering | APPROVED |
| 0013 | Pagination Strategy | 2026-07-17 | Rendering | APPROVED |
| 0014 | PDF Renderer — PDFKit | 2026-07-17 | Rendering | APPROVED |
| 0015 | EPUB Renderer — Library TBD, Spike Required | 2026-07-17 | Rendering | RESOLVED by ADR-0020 |
| 0016 | Theme Engine | 2026-07-17 | Rendering | APPROVED |
| 0017 | `main` as a Production Branch — Feature Branches Required Going Forward | 2026-07-17 | Governance | APPROVED |
| 0018 | DOCX Renderer — `docx` npm Package | 2026-07-17 | Rendering | APPROVED |
| 0019 | PDF Renderer Spike Findings | 2026-07-17 | Rendering | APPROVED |
| 0020 | EPUB Renderer — Library Decision (resolves ADR-0015) | 2026-07-17 | Rendering | APPROVED |
| 0021 | Post-Sprint-3 Governance Decisions | 2026-07-17 | Governance | APPROVED |
| 0022 | Typography Resolution Pipeline | 2026-07-17 | Rendering | APPROVED — implemented |
| 0023 | PDF Font Embedding — Gelasio, Inter, JetBrains Mono | 2026-07-17 | Rendering | APPROVED — implemented |
| 0024 | Hyphenation and Locale-Aware Smart Quotes Deferred to v2 | 2026-07-17 | Rendering | APPROVED — deferred |
| 0025 | Mammoth Drops DOCX Underline Formatting by Default (Import Pipeline Limitation) | 2026-07-17 | Import | APPROVED — documented, deferred |
| 0026 | Two Import-Pipeline Bugs Fixed During Sprint 4 Commit 10 (Explicit Scope Exception) | 2026-07-17 | Import | APPROVED |
| 0027 | Validation Engine Is Read-Only | 2026-07-17 | Validation | APPROVED |
| 0028 | Validation Engine Rule Design Principles | 2026-07-17 | Validation | APPROVED |
| 0029 | Professional Layout Engine — Extension Strategy, RunningHead, and LayoutSelector | 2026-07-17 | Layout | APPROVED |
| 0030 | KDP/Platform Trim-Size Spike Findings (Sprint 6, Commit 0) | 2026-07-17 | Layout | APPROVED |
| 0031 | Two Real Bugs Fixed During Sprint 6 Real-File Verification (Explicit Scope Exception) | 2026-07-17 | Layout | APPROVED |
| 0032 | Table of Contents Generation Follows Structural Document Hierarchy, Never Heading Blocks; Engineering Governance Principle | 2026-07-17 | Layout, Governance | APPROVED |
| 0033 | Repository Converted to an npm Workspace; `packages/shared-types` Introduced | 2026-07-18 | Architecture, Governance | APPROVED — implemented |
| 0034 | Sprint 7 Governance Decisions | 2026-07-18 | Governance | APPROVED |
| 0035 | KDP Publishing-Requirements Spike Findings (Sprint 8, Commit 0) | 2026-07-18 | Publishing Engine | APPROVED |
| 0036 | Platform-Specific Publishing Rules Must Be Encapsulated Behind a `RuleProvider` Port (Engineering Governance Principle) | 2026-07-18 | Publishing Engine, Governance | APPROVED |
| 0037 | Publishing Engine Domain Objects Are Platform-Agnostic; Platforms Depend on the Engine, Never the Inverse (Engineering Governance Principle) | 2026-07-18 | Publishing Engine, Governance | APPROVED |

## By category

- **Architecture** (core Clean Architecture / DDD rules): 0001, 0002, 0003, 0005, 0008, 0033
- **Import pipeline**: 0004, 0009, 0011, 0025, 0026
- **Rendering pipeline** (Theme/Typography/Layout-precursor/Renderer port/PDF/DOCX/EPUB): 0012, 0013, 0014, 0015, 0016, 0018, 0019, 0020, 0022, 0023, 0024
- **Validation Engine** (Sprint 5): 0027, 0028
- **Professional Layout Engine** (Sprint 6): 0029, 0030, 0031, 0032
- **First Demonstrable Product** (Sprint 7): 0033, 0034
- **Publishing Engine** (Sprint 8): 0035, 0036, 0037
- **Governance** (process, not a specific engine): 0006, 0007, 0010, 0017, 0021, 0032, 0033, 0034, 0036, 0037

## Related

- `docs/DECISIONS.md` — the full ADRs this table indexes
- `docs/DESIGN_REVIEW_PROCESS.md` — when a new ADR is required and how it fits into a sprint's own Design Review
