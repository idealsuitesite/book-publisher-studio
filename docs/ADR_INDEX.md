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
| 0038 | Publishing Engine Cannot See `LayoutEngine`'s Real Pagination Metrics — Deferred Beyond Sprint 8, Question Framed Not Answered | 2026-07-18 | Publishing Engine | ✅ RESOLVED by ADR-0042 |
| 0039 | Roadmap Reprioritized — Product Completeness Before AI (Strategic Decision) | 2026-07-18 | Governance, Product | APPROVED |
| 0040 | Sprint 9 Plan Corrections — Inline Tests, Playwright Adoption, and Two Documentation Fixes | 2026-07-18 | UI Foundation, Governance | APPROVED |
| 0041 | Two Scalability Constraints Framed, Not Fixed — Event-Loop Blocking and the Persistence Prerequisite | 2026-07-18 | Architecture, Governance | **OPEN** — both deferred, each awaiting its own Design Review |
| 0042 | Render Metrics Reach the Publishing Engine as a Narrow, Per-Format Value Object | 2026-07-18 | Publishing, Rendering | APPROVED — resolves 0038 |
| 0043 | `PageLayout` Has No Gutter — Every Paperback This Product Generates Is Non-Compliant | 2026-07-18 | Rendering, Layout | **OPEN** — confirmed defect, fix deferred to its own review |
| 0044 | Archiving and Deletion Are Two Operations, Decided Before the Storage Spike | 2026-07-18 | Architecture, Product Object Model | APPROVED — closes Aggregates Risk 5; **AMENDED 2026-07-23** (`CONTENT_DELETION_BY_AUTHOR` — author-facing deletion now IN, the no-UI-delete override superseded) |
| 0045 | Render Metrics Come From the Renderer — Correcting an Approved Decision | 2026-07-18 | Publishing, Rendering, Governance | APPROVED — corrects 0042 Q1, supersedes its ADR-0012 claim |
| 0046 | Persistence Store Spike — SQLite via node:sqlite Recommended | 2026-07-18 | Product Object Model, Persistence | APPROVED — answers Aggregates Q6; implementation gated on Sprint 11 |
| 0047 | A Successful Import Creates a Project — Decision 2 Amended in Code | 2026-07-18 | Product Object Model, Architecture | APPROVED — CTO-directed |
| 0048 | Sprint 7 Decision 2 Formally Amended — the Backend Is Stateful and Durable | 2026-07-20 | Architecture, Persistence, Governance | APPROVED — discharges ADR-0041 Constraint 2 |
| 0049 | An Importer That Finds No Structure Must Say So — Explorable Errors and Normalization Diagnostics | 2026-07-20 | Import, Validation, Governance | APPROVED — IMPORT_FIDELITY commit 1 |
| 0050 | Fidelity Is the Product | 2026-07-20 | Governance, Product | APPROVED — CTO-directed standing principle |
| 0051 | The Renderer Never Breaks a Page on Its Own Initiative | 2026-07-20 | Rendering, Governance | APPROVED — implemented with RENDER_DRIFT fixes; annex 2026-07-21 records the 7th real-fixture bug (ghost pages, found by the quality-bar calibration) |
| 0052 | Project Export/Publish Render the Stored Book, Not the Source Bytes — a Real Defect in Merged Phase-2 Code | 2026-07-21 | Architecture, Rendering, Product Object Model | APPROVED — CTO-directed; fixes structure edits silently discarded on export/publish; amends HOME_WORKSPACE Decision 6 |
| 0053 | `@dnd-kit` for Drag-and-Drop, and Why the Reorder Gesture Is Proven in a Real Browser, Not jsdom | 2026-07-21 | UI Foundation, Testing, Governance | APPROVED — spike-gated dependency; reorder gesture verified by Playwright (`verify-structure-editing`), handler logic in jsdom |
| 0054 | Approval Cadence — Intra-Chantier Autonomy Between Governance Gates | 2026-07-23 | Governance | APPROVED — CTO directive; fixes the 7 approval gates as the only ones, autonomy between them, 3 self-stops; mirrored as non-negotiable #8 |

## By category

- **Architecture** (core Clean Architecture / DDD rules): 0001, 0002, 0003, 0005, 0008, 0033, 0052
- **Import pipeline**: 0004, 0009, 0011, 0025, 0026, 0049
- **Rendering pipeline** (Theme/Typography/Layout-precursor/Renderer port/PDF/DOCX/EPUB): 0012, 0013, 0014, 0015, 0016, 0018, 0019, 0020, 0022, 0023, 0024, 0043, 0045, 0051, 0052
- **Validation Engine** (Sprint 5): 0027, 0028
- **Professional Layout Engine** (Sprint 6): 0029, 0030, 0031, 0032
- **First Demonstrable Product** (Sprint 7): 0033, 0034
- **Publishing Engine** (Sprint 8): 0035, 0036, 0037, 0038, 0042, 0045
- **Governance** (process, not a specific engine): 0006, 0007, 0010, 0017, 0021, 0032, 0033, 0034, 0036, 0037, 0039, 0040, 0045, 0050, 0051, 0054
- **UI Foundation** (Sprint 9): 0040, 0053
- **Product Object Model / persistence**: 0044, 0046, 0047, 0048, 0052
- **Scalability / open constraints**: ~~0038~~ (resolved by 0042), 0041, 0043

## Related

- `docs/DECISIONS.md` — the full ADRs this table indexes
- `docs/DESIGN_REVIEW_PROCESS.md` — when a new ADR is required and how it fits into a sprint's own Design Review
