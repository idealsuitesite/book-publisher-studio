# Version Index

A running journal of every tagged version and where the product is headed. For exact sprint scope, see `docs/ROADMAP.md` and `docs/TODO.md` — this file tracks the version-to-milestone mapping, not day-to-day task detail.

| Version | Milestone | Status | Tag | Notes |
|---|---|---|---|---|
| v0.1.0-alpha.1 | Prototype — Domain + Infrastructure | ✅ Released | `v0.1.0-alpha.1` | Book AST model, ASTBuilder, HtmlNormalizer. See `docs/releases/` (none written for this tag retroactively — first Release Notes doc starts at v0.2.0-alpha). |
| v0.2.0-alpha | Import Pipeline | ✅ Released | `v0.2.0-alpha` | Full Application + Presentation layers, `POST /api/manuscripts/import`, 88 tests, CI/lint/coverage tooling. See `docs/releases/v0.2.0-alpha/ReleaseNotes.md`. |
| v0.3.0-alpha | Rendering Engine | ✅ Released | `v0.3.0-alpha` | Theme Engine, Layout Engine, `Renderer` port, DOCX export (PR #1, merge commit `32ac220`). 118 tests passing (up from 88). See `docs/releases/v0.3.0-alpha/ReleaseNotes.md`. |
| v0.4.0-alpha | PDF Export | ✅ Released | `v0.4.0-alpha` | `PDFRenderer` (PDFKit, ADR-0014), `POST /api/manuscripts/export` gains a `format=pdf` field (PR #3, merge commit `820f1ef`). 125 tests passing (up from 118). See `docs/releases/v0.4.0-alpha/ReleaseNotes.md`. Originally scoped as "Professional Export" covering both PDF and EPUB together; split in two after PDF landed first per the CTO-directed Sprint 3A/3B re-sequencing — EPUB is now its own row below. |
| v0.4.1-alpha | EPUB Export | ✅ Released | `v0.4.1-alpha` | `EPUBRenderer` (`epub-gen-memory`, ADR-0020), `POST /api/manuscripts/export` gains a `format=epub` field (PR #4, merge commit `a7a38a0`). 133 tests passing (up from 125). See `docs/releases/v0.4.1-alpha/ReleaseNotes.md`. Resolves ADR-0015 (spike + library decision recorded in ADR-0020). Completes the "Professional Export" milestone originally planned as one v0.4.0-alpha release, split into v0.4.0-alpha (PDF) and this row (EPUB) per the CTO-directed Sprint 3A/3B re-sequencing. Tag cut 2026-07-17 per ADR-0021 (post-Sprint-3 governance pass). |
| v0.5.0-alpha | Typography Engine | ✅ Released | `v0.5.0-alpha` | `TypographyResolver` pipeline (inline formatting, drop caps, English-only smart quotes, widow/orphan avoidance), real PDF font embedding (Gelasio/Inter/JetBrains Mono), `QualityMetrics` fully activated (PR #9, merge commit `27a4347`). 195 tests passing (up from 133). See `docs/releases/v0.5.0-alpha/ReleaseNotes.md` and `docs/releases/v0.5.0-alpha/SPRINT_4_FINAL_REPORT.md`. Originally scoped to also include a fuller `ValidatorEngine` (readability/completeness scoring) alongside Typography — split out during the sprint's own Design Review; `ValidatorEngine` is now a separate, not-yet-scheduled future milestone (see `docs/TODO.md`'s CTO priority order, item 2). |
| v0.6.0-alpha | Premium UI/UX | ⏳ Planned | — | Next.js frontend, drag-and-drop import, live preview — Sprint 5 scope. |
| v0.7.0-alpha | Plugin System | ⏳ Planned | — | Bible Reference, Translation, Index Generator, Glossary plugins. Not scheduled to a specific sprint yet. |
| v0.8.0-beta | AI Features | ⏳ Planned, explicitly deferred | — | AI rewrite/grammar/translation, cover/illustration generation. See `docs/VISION.md` — "explicitly not MVP." |
| v0.9.0-beta | Licensing & Cloud | ⏳ Planned, explicitly deferred | — | Subscription tiers, feature flags, collaboration, cloud sync. Requires a persistence layer that doesn't exist yet. |
| v1.0.0 | Commercial Release | ⏳ Planned | — | Full licensing enforcement, payment processing, plugin/theme marketplace. |

## How this maps to `docs/VISION.md`'s stage progression

```
MVP (v0.1.0 - v0.6.0-alpha) → Beta (v0.7.0 - v0.9.0-beta) → Public Beta → Commercial Launch (v1.0.0) → Enterprise
```

## Updating this file

- Add a row when a new version is planned, even before it's built — mirrors how ADR-0012–0016 were written before Sprint 2 code
- Move a row's Status to ✅ Released only after the tag is actually pushed (matches the discipline established for `v0.2.0-alpha`: tag, then Release Notes, then this index)
- Never delete a row — like `docs/DECISIONS.md`, this is meant to read as history in a few years, not just current status
