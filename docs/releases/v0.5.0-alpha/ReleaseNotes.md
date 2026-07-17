# Release Notes — v0.5.0-alpha

**Tag:** `v0.5.0-alpha`
**Date:** 2026-07-17
**Codename:** Typography Engine

## Summary

This release adds a dedicated typography pipeline stage — `ThemeEngine → TypographyResolver → LayoutEngine → Renderer` — closing a real gap that predated Sprint 4: none of the three renderers (`PDFRenderer`/`DOCXRenderer`/`EPUBRenderer`) rendered `Block.inlines` at all, so bold, italic, underline, strikethrough, superscript, subscript, links, and small-caps were all silently flattened to plain text on every export. `TypographyResolver` centralizes inline-run resolution, drop caps, English-only smart quotes, and block-type rules (quote/scripture italics) in one Domain component instead of three independently-evolving renderer-side copies. `StyledBook` gains one additive optional field (`blockTypography`) — `LayoutEngine.paginate()`, `PaginatedBook`, and the `Renderer<TOutput>` port all keep their exact pre-Sprint-4 signatures, a deliberately smaller-blast-radius design chosen over a larger `TypesetBook` proposal during the Design Review (ADR-0022).

Real, redistributable PDF fonts (Gelasio/Inter/JetBrains Mono, SIL OFL/Apache 2.0) replace PDFKit's standard-14 substitutes across all three typographic categories, resolving the font gap ADR-0019/ADR-0021 had left open since Sprint 3A (ADR-0023). `QualityMetrics` (declared but unused since ADR-0008) is now fully activated with real computed values (ADR-0008 resolved).

Following the same discipline as every prior sprint — Design Review before code, small atomic commits, green build/tests at every step, real-file verification before merge — this sprint's own real-file verification pass (commit 10) found and fixed 3 real content-fidelity bugs in the import pipeline as a disclosed, CTO-approved scope exception (ADR-0026), and found (but deliberately deferred) a fourth, separate limitation in the `mammoth` dependency itself (ADR-0025). Built across 11 commits on `feature/sprint-4-typography-engine`, merged via PR #9. Full sprint retrospective (objectives, ADRs, bugs, metrics, deferred items, risks, lessons learned): `docs/releases/v0.5.0-alpha/SPRINT_4_FINAL_REPORT.md`.

## Features

- **`TypographyResolver`** (`backend/src/domain/services/TypographyResolver.ts`) — new concrete Domain service (ADR-0022). Resolves `Block.inlines` (or a plain-text fallback) into `TypeRun[]` per block, applies drop caps (`Paragraph.dropCap`), English-only smart-quote substitution, and forces italics on quote/scripture blocks as an internal default (not yet `Theme`-configurable — a deliberate v1 scope decision).
- **`LayoutEngine` keep-with-next pagination** — reads `blockTypography[...].staysWithNext` (headings only) and carries a heading onto the next page instead of stranding it alone at the bottom of a closing page, on overflow-triggered breaks. Best-effort, layered on `LayoutEngine`'s already-approximate heuristic pagination (ADR-0013) — not a hard guarantee.
- **Real embedded PDF fonts** — Gelasio (serif), Inter (sans-serif), JetBrains Mono (monospace); 12 `.ttf` files in `backend/assets/fonts/` with license files and a sourcing README. `PdfFontRegistry` (`backend/src/infrastructure/fonts/PdfFontRegistry.ts`) exposes a role-based API (`resolveBody`/`resolveHeading`/`resolveMonospace`/`resolveDefault`) so `PDFRenderer` never inspects a theme's font-name string directly (ADR-0023).
- **Full inline-formatting rendering in all three renderers** — `PDFRenderer`, `DOCXRenderer`, and `EPUBRenderer` all now consume `TypeRun[]` spans instead of `block.text`, and each renderer's private font/heading-size/italic-hardcode logic was deleted.
- **`BookMetricsCalculator.calculateQualityMetrics(paginated: PaginatedBook): QualityMetrics`** — new additive method (the existing `calculate(book: Book): Book` is unchanged) activating all 7 `QualityMetrics` fields with real, non-hardcoded-zero values. Not yet wired into any HTTP route/DTO — that's `ValidatorEngine` scope, a separate future milestone.
- **`POST /api/manuscripts/export`'s contract is unchanged** — no new Use Case class, no route change, no client-facing migration. Typography resolution is an internal pipeline step between `applyTheme()` and `paginate()`.
- **Tests** — 195 total (up from 133 at Sprint 4's start), including 17 new `TypographyResolver.test.ts` cases, 7 new `PdfFontRegistry.test.ts` cases, and real-fixture E2E regression tests using the canonical `typography-test.docx` verification fixture (not a synthetic buffer) for the first time.

## Real Bugs Found and Fixed During Implementation

Six real bugs surfaced this sprint — all caught by exporting real fixtures through the running dev server, never by a green `npm test` alone. Full detail in `docs/releases/v0.5.0-alpha/SPRINT_4_FINAL_REPORT.md` §4; summarized here:

1. **PDFKit crash on headerless tables** — pre-existing, not typography-specific; fixed in a dedicated branch (`fix/pdf-table-without-header`, PR #8) rather than folded into this sprint.
2. **`PDFRenderer.renderTitle()` used the wrong font role** (`resolveDefault()` instead of `resolveHeading()`) — found while auditing every `PdfFontRegistry` call site during the font-embedding commit; fixed and disclosed in that commit's message.
3. **Mammoth silently drops DOCX underline formatting by default** (ADR-0025) — triaged as import-pipeline, documented with a verified workaround, **deliberately not fixed** this sprint (scoped to a future "Import Fidelity" sprint).
4. **Strikethrough silently downgraded to plain text on import** — `HtmlNormalizer` had no tag-mapping case for `<s>`/`<strike>`/`<del>`.
5. **Whitespace between adjacent inline runs silently dropped, jamming words together** — a real DOCX imported `"mixes bold, italic"` as `"mixesbold,italic"`. Content corruption, not a styling loss.
6. **`ASTBuilder.convertInlines()` dropped all plain-text inlines and silently mislabeled unknown inline types as bold** — any real paragraph with at least one formatted run lost all of its surrounding, unformatted prose in every renderer.

**Findings 4-6 (ADR-0026) were fixed immediately as an explicit, disclosed scope exception**, not deferred like finding 3 (ADR-0025) — the triage line was "is the logical content of the document still intact," not "which pipeline does this belong to."

## Architecture

- **Design Review before code**: `docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md`, iterated through two CTO review rounds before any implementation — a larger `TypesetBook` proposal was reviewed and rejected for blast radius in round 1.
- **`TypographyResolver` is a concrete Domain class, not a port** — same reasoning as `ThemeEngine`/`LayoutEngine`/`ASTBuilder`/`BookValidator`: one correct implementation for this project's Book model, no swappable-adapter case (ADR-0002).
- **`main` as a production branch** (ADR-0017) held: built entirely on `feature/sprint-4-typography-engine`, reviewed via PR #9, merged — no direct commits to `main`.
- **Five new ADRs** this sprint (ADR-0022 through ADR-0026) — see `docs/DECISIONS.md`.

## Quality Metrics

| Metric | Value |
|---|---|
| Tests | 195 passing, 0 failing (up from 133) |
| Global coverage | 90.49% statements |
| Domain (`domain/services`) coverage | 92.57% statements |
| ESLint | 0 errors, 0 warnings |
| TypeScript | strict mode, 0 compiler errors |
| `npm run verify-real-export` | 16/16 (4 canonical fixtures × import + export-docx/pdf/epub) |
| Manual verification | Real DOCX/EPUB output from `backend/verification/output/typography-test/` text-extracted and read directly — confirmed correct word spacing, strikethrough rendering, smart quotes, and no missing sentences; PDF bold/italic runs confirmed to use the real embedded Gelasio-Bold/Gelasio-Italic font names, not a flattened/plain fallback |

## Known Issues / Deliberate Simplifications

Documented in code and in `docs/DECISIONS.md`, not silent gaps:
- Mammoth (DOCX import) silently drops underline formatting by default (ADR-0025) — a verified workaround exists but requires a mammoth-level `styleMap` change; scoped for a future "Import Fidelity" sprint.
- PDFKit has no native primitive for superscript/subscript/small-caps — `PDFRenderer` documents these `TypeRun` flags as unrendered; DOCX and EPUB render all three correctly.
- Hyphenation is not attempted at all (ADR-0024) — real language-aware, dictionary-based hyphenation is materially bigger scope than every other Sprint 4 item combined.
- Smart quotes are English-only (ADR-0024) — importing a non-English-language manuscript today applies English-style curly quotes regardless of `Book.metadata.language`, which is wrong output for that document, not merely a missing feature. Locale-aware quoting is explicit future work.
- No RTL / multi-script text support (ADR-0019, confirmed out of scope for this sprint) — no single embedded font covers every script, and PDFKit does no bidi reordering.
- `QualityMetrics` is fully computable but not yet exposed through any HTTP route/DTO — that wiring is `ValidatorEngine` scope, a separate future milestone.

## What This Release Does Not Include

`ValidatorEngine` (readability/completeness scoring beyond the current structural-only `BookValidator`), plugin system, premium UI, AI features / Editorial AI Engine, Import Fidelity improvements beyond ADR-0026's 3 fixes, licensing enforcement, database, authentication, collaboration. Sprint 5's actual scope and priority order are **not yet decided** — two competing proposals were raised during Sprint 4 (see `docs/TODO.md`) and are left for Sprint 5's own dedicated Design Review to resolve, not assumed here.

## Upgrade / Migration Notes

Nothing to migrate. `POST /api/manuscripts/export`'s contract is unchanged — no new fields, no behavior change to existing callers. `POST /api/manuscripts/import` is unaffected by the rendering-pipeline changes, but **does** benefit from ADR-0026's `HtmlNormalizer`/`ASTBuilder` fixes: strikethrough now imports correctly, and paragraphs with any inline formatting no longer lose their surrounding plain text. Frontend is unaffected (none exists yet).

## Links

- Architecture: `docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md`
- Sprint retrospective: `docs/releases/v0.5.0-alpha/SPRINT_4_FINAL_REPORT.md`
- Decisions: `docs/DECISIONS.md` (ADR-0022 through ADR-0026)
- Vision: `docs/VISION.md`
- Current state (living doc): `docs/CURRENT_STATE.md`
- Real Export Checklist used: `docs/REAL_EXPORT_CHECKLIST.md`
- Pull request: #9 (`feature/sprint-4-typography-engine` → `main`, merge commit `27a4347`)
- Previous release: `v0.4.1-alpha` (EPUB export, `docs/releases/v0.4.1-alpha/ReleaseNotes.md`)
