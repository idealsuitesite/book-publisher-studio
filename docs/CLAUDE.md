# Claude Instructions for Book Publisher Studio

This file is an entry point, not a container. It states what governs the project and where to find each policy in detail — it does not restate architecture, ADRs, review rules, coding conventions, or Git workflow inline. If you're about to add more than a couple of lines to this file, that content almost certainly belongs in one of the documents below instead.

## What this project is

A global publishing software platform (DOCX import, AST-based book model, PDF/EPUB export, AI-assisted editing) built on Clean Architecture (Domain → Application → Infrastructure/Presentation) and DDD. Start a session with `docs/SESSION_BOOTSTRAP.md`, not this file directly.

## The non-negotiables (detail lives elsewhere)

1. **Never violate Clean Architecture** — Domain has zero infrastructure dependencies; no cyclic dependencies. → `docs/DEVELOPER_HANDBOOK.md`
2. **Never expose Domain objects to Presentation** — DTOs and Mappers only. → `docs/DEVELOPER_HANDBOOK.md`
3. **Always use Dependency Inversion** — constructor injection, ports over concrete classes where more than one real implementation is plausible. → `docs/DEVELOPER_HANDBOOK.md`
4. **A Design Review precedes non-trivial code** — new engines, new ports, new dependencies, or an approach with two genuinely different options all need one, approved before a branch exists. → `docs/DESIGN_REVIEW_PROCESS.md`
5. **Real fixtures over synthetic ones** — for import, pagination, TOC, renderer, and publishing changes, verify against a real manuscript, not only hand-built test objects. This project has shipped nine real bugs that passed 100% synthetic-fixture coverage (ADR-0019, ADR-0020, ADR-0031, IMPORT_FIDELITY commit 3, RENDER_DRIFT, the ADR-0051 annex, the ADR-0050 annex — full lineage in the policy doc). → `docs/REAL_FIXTURE_POLICY.md`
6. **No feature is done until Code, Product, and Documentation all pass** — this is now a formal governance principle, not just a habit. → `docs/DECISIONS.md` (ADR-0032) and `docs/QUALITY_GATE.md`

## Where everything lives

### Governance (process — how work gets done)
- `docs/DEVELOPMENT_WORKFLOW.md` — branching, commits, "after every task," server verification, which fixture to use
- `docs/DESIGN_REVIEW_PROCESS.md` — when a Design Review is required, the two-level structure, the approval gate
- `docs/RELEASE_CHECKLIST.md` — the exact sprint-closure sequence (tag, Release Notes, `VERSIONS.md` flip, branch cleanup)
- `docs/REAL_FIXTURE_POLICY.md` — when real-manuscript verification is mandatory and how to handle fields the real import pipeline can't reach
- `docs/QUALITY_GATE.md` — the per-commit checklist and the 3 validation levels (Development/Product/Release)
- `docs/TESTING_STRATEGY.md` — functional-vs-rendering and structural(L1)-vs-rendering(L2) test taxonomies
- `docs/MERGE_CHECKLIST.md` — the narrower gate specific to merging a feature branch into `main`

### Technical (how the system is built)
- `docs/ARCHITECTURE.md` — layered architecture reference (see `docs/DEVELOPER_HANDBOOK.md` for a note on this file's staleness)
- `docs/DEVELOPER_HANDBOOK.md` — coding conventions, naming, file structure, port-vs-class judgment calls
- `docs/DECISIONS.md` — every ADR, full text
- `docs/ADR_INDEX.md` — a searchable table of every ADR (number, title, date, category, status)

### Product (what's being built and why)
- `docs/VISION.md` — long-term product vision
- `docs/ROADMAP.md` — timeline (note: predates the current sprint-numbering scheme; `docs/VERSIONS.md` is the current source of truth for what's shipped and what's next)
- `docs/VERSIONS.md` — version-to-milestone mapping, the authoritative "what's released" record
- `docs/releases/<version>/SPRINT_N_FINAL_REPORT.md` and `ReleaseNotes.md` — per-sprint retrospectives and release notes
- `docs/architecture/diagrams/*.md` — Design Review documents, one per engine/sprint
- `docs/product/PERSONAS.md`, `USER_JOURNEYS.md`, `FEATURE_MATRIX.md`, `WIREFRAMES.md`, `PRODUCT_DEMO.md`, `PRODUCT_ACCEPTANCE.md` — user-facing product thinking, distinct from the technical Design Reviews above (introduced Sprint 7)
- `docs/demo/screenshots/` — real captures from `docs/product/PRODUCT_DEMO.md`'s Demo Script

## Session start

See `docs/SESSION_BOOTSTRAP.md` for the reading order, then summarize: current version, current branch, architecture, completed work, next task. Wait for explicit approval before writing code.
