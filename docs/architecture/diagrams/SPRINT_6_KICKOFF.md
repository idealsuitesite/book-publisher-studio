# Sprint 6 Kickoff — Professional Layout Engine

**Status:** ✅ Design Review complete, awaiting explicit CTO go-ahead to branch.
**Date:** 2026-07-17

This is the charter for Sprint 6. It doesn't repeat the full design — that's `PROFESSIONAL_LAYOUT_ENGINE.md`. This document is what a developer (or a fresh session) should be able to read in two minutes and know exactly what's expected, before opening that.

---

## Objective

Close the gap between what `LayoutEngine` does today (pagination estimate + heading keep-with-next only) and what `docs/VISION.md` has always described as its target scope: pagination, margins, headers/footers, chapter-opening-page rules, TOC generation, print optimization. Extends `LayoutEngine` — does not replace it or add a parallel class.

## Scope

- Real `PageLayout` presets beyond Letter: A4, A5, KDP-relevant trim sizes (exact values from a required spike — see Out of Scope/prerequisite below)
- `LayoutSelector` port + `ManualLayoutSelector` (wraps today's caller-by-name behavior); `ExportController` stops hardcoding `LetterPageLayout`
- `RunningHead` type on `Theme` (`show`/`position`/`content`/`pageNumber`/`separator`/`uppercase`/`font`/`size`); `ClassicTheme` gets one populated
- `LayoutEngine` resolves per-page header/footer content from `Theme.runningHead` during pagination
- `PDFRenderer` consumes resolved header/footer, **drops the hardcoded `'Book Publisher Studio'` string** — a real, disclosed bug fixed as a direct consequence of this sprint, not filed separately
- `DOCXRenderer` gains header/footer support — new capability, DOCX has none today
- `Chapter.openingPageStyle` honored (blank-page insertion for right/left chapter starts)
- `Chapter.startPageNumber` honored (page-number reset/offset per chapter)
- Automatic Table of Contents generation from headings, additive on `PaginatedBook.tableOfContents`, only when `TableOfContents.generateAutomatically` is true

## Out of Scope (explicitly, not by omission)

- **Automatic layout *selection* heuristics** (choosing a layout by book language, page count, binding type, etc.) — `AutomaticLayoutSelector` is named and designed for, but not built. `ManualLayoutSelector` is the only real implementation this sprint.
- **EPUB headers/footers/page numbers** — EPUB is reflowable, no fixed page to attach a running head to (same reasoning as ADR-0013 excluding EPUB from pagination). EPUB output must be unchanged by this sprint.
- **Guessed KDP/platform trim sizes** — a real spike against each platform's own published specs is a hard prerequisite for commit 1, not an assumption baked into any preset.
- **A new `LayoutEngine`-replacing class** — extending the existing class is the locked decision (ADR-0029); do not introduce a parallel engine.
- **Manually-authored `FrontMatter.toc` being overwritten** — automatic TOC generation only runs when `generateAutomatically: true`; a manually-authored TOC is never touched.

## Applicable ADRs

- **ADR-0029** — Professional Layout Engine: extension strategy, `RunningHead`, `LayoutSelector`. The three locked architectural choices for this sprint.
- **ADR-0012** — `Renderer` is a port; `ThemeEngine`/`LayoutEngine` are concrete classes. Precedent for extending `LayoutEngine` rather than adding a new class, and for `LayoutSelector`'s port shape.
- **ADR-0013** — Pagination is a heuristic ("not guaranteed to agree exactly"), EPUB excluded from it entirely. Both the TOC-page-number caveat and the EPUB exclusion in this sprint follow this precedent directly.
- **ADR-0019/ADR-0020** — Spike-before-decide. Governs the mandatory KDP/platform trim-size research before any new `PageLayout` preset ships.
- **ADR-0022/ADR-0027** — Additive-field-not-signature-break pattern, reused for `PaginatedBook.tableOfContents` and `Theme.runningHead`.
- **ADR-0023** — A bug found and fixed as a refactor side effect, disclosed in the commit, not filed separately. Precedent for fixing the hardcoded PDF running-head string as part of this sprint rather than a standalone ticket.
- **ADR-0028** — Rule design principles (Validation Engine). `LayoutSelector`'s one-adapter-today shape is deliberately distinguished from this ADR's "don't register a no-op rule" principle — see `PROFESSIONAL_LAYOUT_ENGINE.md` §3 Decision 5 and ADR-0029's rationale for why a port with one real adapter isn't the same thing.

## Reference Documents

- `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` — Level 1, the 5-engine map and why Professional Layout Engine was chosen for Sprint 6 (lowest risk: no external vendor, no UI requirement, extends existing code)
- `docs/architecture/diagrams/PROFESSIONAL_LAYOUT_ENGINE.md` — the full design (read this before implementing any commit) — includes the evidence gathered on today's `LayoutEngine`/header-footer/TOC/`Chapter` field state
- `docs/DECISIONS.md` — ADR-0029 and every ADR listed above
- `docs/REAL_EXPORT_CHECKLIST.md` — applies directly this sprint (unlike Sprint 5's import-side change, this sprint touches `LayoutEngine`/`PDFRenderer`/`DOCXRenderer` squarely)
- `docs/CLAUDE.md` — Clean Architecture rules, naming conventions, after-every-task checklist

## The Planned Commits

Per `PROFESSIONAL_LAYOUT_ENGINE.md` §8, one responsibility each, green build/tests before moving to the next:

0. **Prerequisite spike:** KDP/platform trim-size research — real published specs, not guessed (`backend/spikes/`, matching the ADR-0019/0020 precedent)
1. `domain(layout): A4/A5 + KDP trim-size PageLayout presets`
2. `domain(layout): LayoutSelector port + ManualLayoutSelector`
3. `application(export): ExportController uses LayoutSelector, replaces hardcoded LetterPageLayout`
4. `domain(layout): Theme gains RunningHead type (additive); ClassicTheme populated`
5. `domain(layout): LayoutEngine resolves per-page header/footer content from Theme.runningHead during pagination`
6. `infra(pdf): PDFRenderer consumes resolved header/footer, drops hardcoded 'Book Publisher Studio' string`
7. `infra(docx): DOCXRenderer gains header/footer support (new capability)`
8. `domain(layout): LayoutEngine honors Chapter.openingPageStyle (blank-page insertion for right/left starts)`
9. `domain(layout): LayoutEngine honors Chapter.startPageNumber`
10. `domain(layout): PaginatedBook.tableOfContents — automatic TOC generation from headings post-pagination`

(Commit 11, E2E real-file verification, and commit 12, docs/ADR reconciliation, follow per `PROFESSIONAL_LAYOUT_ENGINE.md` §8 but aren't "implementation" commits in the same sense — listed there, not repeated here as part of the numbered plan.)

## Definition of "Done"

Sprint 6 is done when, and only when:

- The KDP/platform trim-size spike is completed *before* commit 1, with real sourced specs, not guessed values
- All implementation commits landed, each with its own green build/lint/test before the next started
- All existing `LayoutEngine.test.ts` cases pass unchanged
- A real DOCX from `backend/verification/` exported to PDF shows the actual book's title (not a hardcoded string) in the running head, correct page numbers, a `openingPageStyle: 'right'` chapter actually starting on an odd page, and a populated TOC with real page numbers when requested
- Same real DOCX exported to A4 and a KDP trim size produces visibly correctly-sized output — inspected, not just asserted
- DOCX export shows a real header/footer where it previously had none — inspected in a real opened `.docx`
- EPUB output is confirmed unchanged by this sprint
- `ManualLayoutSelector` reproduces today's exact behavior for existing callers; `AutomaticLayoutSelector` does not exist in any registry or wiring
- `docs/REAL_EXPORT_CHECKLIST.md` is filled out as a real PR artifact **from the start of this sprint** — Sprint 5's own closure found this checklist missing until the PR stage; do it earlier this time, not as a last-minute catch
- `CURRENT_STATE.md`/`TODO.md`/`VERSIONS.md` reconciled, Sprint 6 Final Report written
- PR opened, reviewed, merged — no direct commits to `main`

## Quality Checklist (run before every commit, not just at the end)

```bash
cd "D:\Book Publisher Studio\backend"
npm run build            # 0 TypeScript errors
npm run lint              # 0 ESLint errors/warnings
npm test                  # all passing, 0 skipped
npm run test:coverage     # Domain >90%, global >80% statements
npm run verify-server         # confirm the real port before any real-export check
npm run verify-real-export    # 16/16 — this sprint touches renderers directly, run from commit 1 onward
```

---

**Scope discipline:** no deviation from the scope above without a new Design Review — this is the CTO's own condition for the go-ahead, not a suggestion.
