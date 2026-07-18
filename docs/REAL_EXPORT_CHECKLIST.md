# Real Export Checklist

## Why this exists

Synthetic test fixtures have already missed real bugs in this project, three times:

1. **PDF "Page 6 of 4"** — `LayoutEngine`'s word-count pagination estimate undershot PDFKit's actual rendered page count; every synthetic fixture up to that point was too short to expose the gap (ADR-0019, finding 6C).
2. **Empty EPUB** — `EPUBRenderer` filtered top-level content to `Chapter` only; every synthetic fixture always included an explicit top-level `Chapter`, so none exercised the `Section`-only ("preamble") shape a real DOCX from `backend/uploads/` actually has (ADR-0020 addendum).
3. **PDFKit infinite pagination** — a 9-page test document rendered as 212 pages because of a cursor-stranding bug in header/footer drawing; caught by inspecting real generated output, not by a passing synthetic test (ADR-0019, finding 6B).

All three were caught only because someone exported a **real manuscript through the running HTTP API** and looked at the actual output — not by trusting a green `npm test`. This checklist makes that step mandatory and repeatable instead of something that has to be remembered fresh every sprint.

**Rule:** `npm test` passing is necessary but never sufficient for a renderer-related change. See `docs/MERGE_CHECKLIST.md`'s "real export verification" gate.

---

## When this checklist is required

Any change touching: `DOCXRenderer`, `PDFRenderer`, `EPUBRenderer`, `ThemeEngine`, `LayoutEngine`, `TypographyResolver` (once it exists), the `Renderer` port, or `ExportManuscriptUseCase`.

Not required for: Domain models/DTOs with no renderer-visible effect, import-pipeline-only changes, docs-only changes, dependency bumps with no behavior change.

---

## Checklist template

Copy this block into the PR description (or a linked comment) for every qualifying change.

```
## Real Export Checklist

Sprint:
Renderer(s) touched:
Test manuscript: backend/verification/typography-test.docx (default — use large-book.docx/images.docx/tables.docx instead only if the change specifically concerns pagination, images, or tables; see backend/verification/README.md and docs/DEVELOPMENT_WORKFLOW.md's "Which fixture to use" — never backend/uploads/, never a generated/temporary file)
Export method: POST /api/manuscripts/export via the running dev server (NOT calling renderer classes directly)

### 1. Unit tests
- [ ] npm test — all passing, 0 skipped without a documented reason

### 2. Integration / E2E tests
- [ ] Existing E2E export tests (export.test.ts) passing

### 2b. Server verification (docs/DEVELOPMENT_WORKFLOW.md's "Server verification")
- [ ] npm run verify-server passes (confirms the real port, the export route, and the fixture — never assume the port)

### 3. Real export (all 3 formats, even if only one renderer changed —
###    a shared Domain change like ThemeEngine/LayoutEngine/TypographyResolver
###    can affect all three silently)
- [ ] .docx generated and opens without error
- [ ] .pdf generated and opens without error
- [ ] .epub generated and opens without error

### 4. Visual inspection (open each file, actually look)
- [ ] Headings render at correct level/size
- [ ] Paragraph spacing looks correct
- [ ] Bold rendered
- [ ] Italic rendered
- [ ] Underline rendered (where applicable)
- [ ] Block quotes / scripture render correctly
- [ ] Lists (ordered + unordered) render correctly
- [ ] Tables render correctly
- [ ] Images render correctly (or placeholder, if no embedded data)
- [ ] Footnotes render correctly
- [ ] Page breaks land where expected (PDF/DOCX)
- [ ] Page numbers correct (PDF)
- [ ] Drop caps applied where marked (once implemented)
- [ ] Correct font family visible (not a silent fallback)
- [ ] No missing paragraphs
- [ ] No duplicated paragraphs
- [ ] No empty/blank pages
- [ ] No completely empty output (the empty-EPUB failure mode)

Verified by:
Date:
```

---

## Notes

- "Export method: via the running dev server" is deliberate — calling a `Renderer` class directly from a test bypasses `ExportManuscriptUseCase`'s full pipeline (`ThemeEngine → TypographyResolver → LayoutEngine → Renderer`) and the HTTP layer, which is exactly the path all three real bugs above traveled through before being caught.
- A change that only touches one renderer (e.g. `PDFRenderer`-only) still gets the "real export, all 3 formats" step **if it changed a shared Domain component** (`ThemeEngine`, `LayoutEngine`, `TypographyResolver`, or the `Book`/`StyledBook`/`PaginatedBook` models) — those are shared inputs to all three renderers, and a change presumed "PDF-only" has already once turned out not to be (see `docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md`'s evidence table, where the same theme/typography gap showed up differently in all three renderers).
- This checklist is a gate, not a formality — an unchecked box means the work isn't done, matching `docs/MERGE_CHECKLIST.md`'s existing "not a suggestion list, a gate" framing for its own items.
