# Rendering Pipeline (Book → PDF / EPUB / DOCX)

**Status:** Design only (ADR-0012 through ADR-0016). Nothing in this document is implemented yet — this is the conception phase, matching how `IMPORT_PIPELINE.md` was designed before Phase 2 was built. No code should be written against this until the design is reviewed.

## Sequence Diagram

```
Client
  │  POST /api/manuscripts/{id}/export?format=pdf|epub|docx
  ▼
ExportController (Presentation, not built yet)
  │  calls
  ▼
Export{PDF,EPUB,DOCX}UseCase (Application)
  ├─→ ThemeEngine.applyTheme(book, theme)         [Domain]  →  StyledBook
  ├─→ LayoutEngine.paginate(styledBook)           [Domain]  →  Page[]  (PDF/DOCX only — EPUB skips this)
  └─→ Renderer.render(styledBook | pages)         [Infrastructure: PDFRenderer | EPUBRenderer | DOCXRenderer]
  ▼
Buffer (PDF bytes / EPUB zip / DOCX bytes)
  ▼
HTTP 200 (application/pdf | application/epub+zip | application/vnd...wordprocessingml.document)
```

This mirrors `IMPORT_PIPELINE.md`'s shape deliberately: ports in Domain, adapters in Infrastructure, a thin per-format Use Case, one controller. No new architectural pattern is introduced for export.

## Detailed Steps

### Step 1: Apply Theme (Domain)
Input: `Book`, `Theme` (fonts, sizes, colors, spacing, per-block styles — Classic is the first built-in)
Output: `StyledBook` — a `Book` plus resolved style annotations per block, `Book` itself untouched (immutability, same principle as `BookMetricsCalculator.calculate()`)
Module: `domain/services/ThemeEngine.ts` (not built)
See: ADR-0016

### Step 2: Paginate (Domain) — PDF and DOCX only
Input: `StyledBook`, `PageLayout` (margins, page size, headers/footers)
Output: `Page[]` — a heuristic estimate based on per-block-type height, not exact text shaping (that's renderer-specific, see ADR-0013)
Module: `domain/services/LayoutEngine.ts` (not built)
**Skipped entirely for EPUB** — EPUB is reflowable, the e-reader paginates it
See: ADR-0013

### Step 3: Render (Infrastructure)
Three adapters, one port:
```ts
interface Renderer<TOutput> {
  render(book: StyledBook): Promise<TOutput>;
}
```
- `PDFRenderer` — wraps PDFKit, consumes `StyledBook` + `Page[]`, emits `Buffer` (ADR-0014)
- `EPUBRenderer` — library TBD pending a spike (ADR-0015), consumes `StyledBook` directly (no `Page[]`), emits a zip `Buffer`
- `DOCXRenderer` — consumes `StyledBook` + `Page[]`, emits `Buffer` (library choice not yet decided — likely `docx` npm package, needs its own ADR before implementation)

Modules: `infrastructure/renderers/{PDFRenderer,EPUBRenderer,DOCXRenderer}.ts` (none built)
See: ADR-0012, ADR-0014, ADR-0015

### Step 4: Orchestrate (Application)
Each format gets its own Use Case, same shape as `ImportManuscriptUseCase`:
```ts
class ExportPDFUseCase implements UseCase<ExportRequest, Buffer> {
  constructor(
    private themeEngine: ThemeEngine,
    private layoutEngine: LayoutEngine,
    private renderer: Renderer<Buffer>
  ) {}

  async execute(request: ExportRequest): Promise<Buffer> {
    const styled = this.themeEngine.applyTheme(request.book, request.theme);
    const pages = this.layoutEngine.paginate(styled);
    return this.renderer.render(styled);
  }
}
```
`ExportEPUBUseCase` is identical minus the `paginate()` call. `ExportDOCXUseCase` mirrors `ExportPDFUseCase`.

## What This Pipeline Does Not Cover

- Typography (widow/orphan control, hyphenation, smart quotes, drop caps) — Sprint 4, Typography Engine, interacts with but is separate from pagination (ADR-0013)
- Validator Engine's fuller readability/completeness scoring — Sprint 4
- Theme marketplace distribution/licensing — Commercial stage, `docs/VISION.md`
- Kindle/Kobo/Lulu/IngramSpark/Amazon KDP — later `Renderer` implementations behind the same port, no pipeline changes needed when they're added

## Open Questions Before Implementation

1. `StyledBook`'s exact shape — how do style annotations attach to blocks without duplicating the whole `Book` tree structure?
2. EPUB library choice (ADR-0015 spike)
3. DOCX renderer library choice (not yet its own ADR)
4. Does `PageLayout` need per-theme defaults, or is it always explicitly provided by the export request?

These should be resolved (or explicitly deferred with a note) before Sprint 2/3 implementation starts, not discovered mid-implementation.
