# Release Notes — v0.4.1-alpha

**Tag:** `v0.4.1-alpha`
**Date:** 2026-07-17
**Codename:** EPUB Export

## Summary

This release adds EPUB export alongside the existing DOCX and PDF export. A manuscript uploaded to `POST /api/manuscripts/export` can now come back as `.docx`, `.pdf`, or `.epub`, sharing the same import → theme → layout pipeline and differing only in which `Renderer<Buffer>` implementation runs last (ADR-0012). Following the same discipline as Sprints 2 and 3A — Design Review before code, small atomic commits, green build/tests at every step — a throwaway spike (`backend/spikes/epub-library-spike.ts`) resolved ADR-0015's open library question with real evidence before `EPUBRenderer` was written, and the findings are recorded in ADR-0020. Built across 5 commits on `feature/sprint-3b-epub-export`, merged via PR #4.

This completes Sprint 3 ("Professional Export"), which `v0.4.0-alpha`'s release notes explain was originally scoped as one release covering both PDF and EPUB together, then split in two mid-sprint per a CTO-directed re-sequencing: ship PDF first (the library was already decided, ADR-0014), treat the EPUB library choice (ADR-0015, undecided at the time) as its own spike-first sprint rather than rushing a decision. This release is that second half.

## Features

- **`EPUBRenderer`** (`backend/src/infrastructure/renderers/EPUBRenderer.ts`) — implements `Renderer<Buffer>`, serializes the same block types `DOCXRenderer`/`PDFRenderer` already handle (headings, paragraphs, quotes/scripture, ordered/unordered lists, tables, footnotes, images, dividers) into HTML per chapter. Nested sections render as heading levels matching their `section.level`, mirroring how the other two renderers treat sections as flowing within their parent chapter rather than as separate top-level units. No pagination is consulted (ADR-0013, unchanged) — EPUB is reflowable, so `PaginatedBook.pages` only matters to `PDFRenderer`/`DOCXRenderer`.
- **Library choice resolved with evidence, not a guess (ADR-0020, resolves ADR-0015):** `epub-gen-memory` (a maintained TypeScript fork) is used. The ADR-0015 example candidate, `epub-gen` itself, was rejected on hard evidence gathered via `npm view` and GitHub's API: last published to npm in 2022, never left `0.1.0`, written in CoffeeScript, no detected license on GitHub despite `package.json` claiming MIT, and a dependency tree full of genuinely legacy packages (`q`, `rimraf@2`, `archiver@3`, a second major version of `cheerio` alongside this project's own `cheerio@^1.2.0`). `epub-gen-memory` is TypeScript-native with bundled types, MIT-licensed, recently maintained, and its own `jszip` dependency is compatible with this project's existing one.
- **Images with embedded data are written to a scoped temp directory, not passed as `data:` URIs.** `epub-gen-memory` unconditionally fetches every `<img src>` in chapter content — even a `data:` URI throws, since the library only supports HTTP(S) and `file://`. `EPUBRenderer` writes already-available base64 image bytes to a per-render temp directory (`fs.mkdtempSync`) and references them via `file://`, which the library reads from disk with zero network calls, then deletes the directory after rendering — keeping the same no-hidden-network-I/O rule `DOCXRenderer`/`PDFRenderer` already follow. Images without embedded data are simply omitted from the HTML (same placeholder-only behavior as the other two renderers).
- **`POST /api/manuscripts/export` gains `format=epub`** — not a new route, and no new Use Case class either: `ExportManuscriptUseCase` was already renderer-agnostic (ADR-0012), so EPUB support is a third instance of it configured with `EPUBRenderer`.
- **Tests** — 7 new `EPUBRenderer.test.ts` cases plus 1 new E2E `format=epub` case in `export.test.ts`, bringing the suite to 133 total (up from 125).

## Real Bugs Found and Fixed During Implementation

Not just in the spike — both surfaced while building and verifying `EPUBRenderer` itself:

1. **Double-wrapped CJS/ESM interop.** The README's `import epub from 'epub-gen-memory'` does not yield a callable under this project's ESM toolchain. `epub-gen-memory` ships as CJS with no `exports` map; under Node's own CJS/ESM interop for this compiled shape, the real function arrives two `.default` levels deep (`module.default.default`, not `module.default`) — confirmed identically under both `tsx` and plain `node`, so this is deterministic Node behavior, not a dev-only quirk. `EPUBRenderer` unwraps defensively (looping until a callable is found) rather than hardcoding the depth, in case a future version or runtime changes it.
2. **Empty-book bug, caught only by exporting a real DOCX from `backend/uploads/` through the running dev server — not a synthetic fixture.** An earlier version of `EPUBRenderer` filtered top-level content to `Chapter` only, mirroring the (wrong) assumption that top-level content is always a `Chapter`. `ASTBuilder` actually falls back to a top-level `Section` ("preamble", empty title) when the source document has no Heading-1-level break at all — exactly this real file's shape (body text and subheadings, no top-level heading). The filtered version produced a **structurally valid but completely empty EPUB**: correct `mimetype`, correct OPF, zero chapter files. No fixture used up to that point would have caught this, since every one always included an explicit top-level `Chapter`. Fixed by mapping over all of `mainContent` regardless of `Chapter`/`Section` type, matching `DOCXRenderer`/`PDFRenderer`'s existing generic walk, with an `'Untitled'` fallback for the EPUB nav/TOC entry specifically (not fabricated into the visible body heading, which is simply omitted when the title is empty). A regression test reproducing this exact shape is included.

## Architecture

- **Design Review before code**: ADR-0020 records the spike findings and final library decision, resolving ADR-0015 — matching the discipline already established for ADR-0012 through ADR-0019.
- **No new Application-layer class needed**: same payoff `PDFRenderer` already demonstrated in `v0.4.0-alpha` — `ExportManuscriptUseCase`'s renderer-agnostic design (ADR-0012) meant EPUB support required zero Domain or Application changes.
- **`main` as a production branch** (ADR-0017) held: built entirely on `feature/sprint-3b-epub-export`, reviewed via PR #4, merged — no direct commits to `main`, and strictly scoped to EPUB (no PDF changes bundled in).

## Quality Metrics

| Metric | Value |
|---|---|
| Tests | 133 passing, 0 failing (up from 125) |
| Domain coverage | 92.64% statements (unchanged — no new Domain code this release) |
| Global coverage | 84.01% statements (down slightly from 84.47% — new Infrastructure code has a coverage profile similar to `DOCXRenderer`/`PDFRenderer`; still clears the >80% gate) |
| ESLint | 0 errors, 0 warnings (unchanged) |
| TypeScript | strict mode, 0 compiler errors |
| Manual verification | A real DOCX from `backend/uploads/` (the same file used to verify Sprints 2 and 3A) exported to `.docx`, `.pdf`, and `.epub` via the running dev server on merged `main` — all three HTTP 200, correct Content-Type, valid output; the `.docx`/`.pdf` outputs matched Sprint 3A's verified-good byte sizes exactly, confirming no regression |

## Known Issues / Deliberate Simplifications

Documented in code and in `docs/DECISIONS.md` (ADR-0020), not silent gaps:
- `EPUBRenderer`'s `page-break` block renders a CSS `page-break-before` hint, not a real page break — EPUB is reflowable, and reading systems vary in whether they honor the hint at all.
- `epub-gen-memory` is a smaller-community fork (58 GitHub stars) of a more popular but unmaintained parent (`epub-gen`, 458 stars) — worth watching at upgrade time, not a reason to avoid it now.
- No redistributable font asset is needed for EPUB the way `v0.4.0-alpha` flagged for PDF — CSS `font-family` is just a reader-side hint, not an embedded glyph requirement, so this is a non-issue for this renderer specifically.
- No RTL / multi-script text support (same ADR-0019 finding as PDF, not re-verified for EPUB specifically in this release, but likely to carry over since it's a text-shaping concern, not a PDFKit-specific one).

## What This Release Does Not Include

Typography Engine, fuller `ValidatorEngine` (readability/completeness scoring), plugin system, premium UI, AI features, licensing enforcement, database, authentication, collaboration. Sprint 3 ("Professional Export") is now fully complete with this release; Sprint 4 has not been scoped yet. See `docs/VISION.md` for the long-term plan and `docs/TODO.md` for the backlog.

## Upgrade / Migration Notes

Nothing to migrate. `POST /api/manuscripts/export` is backward compatible — omitting `format` still returns `.docx`, and `format=pdf` is unaffected by this release. `POST /api/manuscripts/import` is unaffected. The legacy `POST /api/upload` route remains deprecated but present (ADR-0011, removal still not scheduled to a specific release). Frontend is unaffected.

## Links

- Architecture: `docs/architecture/diagrams/RENDERING_PIPELINE.md`
- Decisions: `docs/DECISIONS.md` (ADR-0020; ADR-0015 for the original open question this resolves)
- Vision: `docs/VISION.md`
- Current state (living doc): `docs/CURRENT_STATE.md`
- Merge checklist used: `docs/MERGE_CHECKLIST.md`
- Pull request: #4 (`feature/sprint-3b-epub-export` → `main`, merge commit `a7a38a0`)
- Previous release: `v0.4.0-alpha` (PDF export, `docs/releases/v0.4.0-alpha/ReleaseNotes.md`)
