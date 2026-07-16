# Rendering Pipeline (Book → PDF / EPUB / DOCX)

**Status:** Design Review complete (2026-07-17). ADR-0012 through ADR-0016 plus this document are now the validated design. Two items remain genuinely open (EPUB and DOCX library choices — see below) and need a spike before their specific renderers are implemented; everything else here is ready for a first implementation commit on `feature/sprint-2-rendering-engine`, per ADR-0017.

## Sequence Diagram

```
Client
  │  POST /api/manuscripts/{id}/export?format=pdf|epub|docx
  ▼
ExportController (Presentation, not built yet)
  │  calls
  ▼
Export{PDF,EPUB,DOCX}UseCase (Application)
  ├─→ ThemeEngine.applyTheme(book, theme)              [Domain, concrete class]  →  StyledBook
  ├─→ LayoutEngine.paginate(styledBook, pageLayout)     [Domain, concrete class]  →  Page[]  (PDF/DOCX only — EPUB skips this)
  └─→ Renderer.render(styledBook, context)              [Infrastructure, port: PDFRenderer | EPUBRenderer | DOCXRenderer]
  ▼
Buffer (PDF bytes / EPUB zip / DOCX bytes)
  ▼
HTTP 200 (application/pdf | application/epub+zip | application/vnd...wordprocessingml.document)
```

This mirrors `IMPORT_PIPELINE.md`'s shape deliberately: one port in Domain (`Renderer`), one adapter per format in Infrastructure, a thin per-format Use Case, one controller. No new architectural pattern is introduced for export.

## Design Review Outcome: Ports vs. Concrete Classes

Reviewed against the precedent already established in Phase 2, applying the same test used there: **is this a swappable adapter to an external system, or core logic with exactly one correct implementation for our own Book model?**

- **`Renderer` is a port** (`domain/ports/Renderer.ts`), matching `DocumentParser`/`DocumentNormalizer`. PDF, EPUB, DOCX, HTML, and (later) Kindle are genuinely distinct, swappable implementations — this is exactly the case Dependency Inversion exists for.
- **`ThemeEngine` and `LayoutEngine` are concrete Domain classes**, matching `ASTBuilder`/`BookValidator`/`BookMetricsCalculator` — not ports. There is exactly one correct way to apply a theme or paginate *our* Book model; wrapping them in an interface would add indirection with no real second implementation ever arriving. `TypographyEngine` (Sprint 4, not built) will follow the same rule when it lands.

## Detailed Steps

### Step 1: Apply Theme (Domain, concrete class)
Input: `Book`, `Theme` (fonts, sizes, colors, spacing, per-block styles — Classic is the first built-in)
Output: `StyledBook`
Module: `domain/services/ThemeEngine.ts` (not built)
See: ADR-0016

**`StyledBook` shape (resolved this review):**
```ts
interface StyledBook {
  book: Book;                                    // reference to the original, untouched — no deep clone
  theme: Theme;
  blockStyles: Record<string /* block.id */, ResolvedBlockStyle>;
}
```
Rejected alternative: cloning the whole `Book` tree with style properties merged onto every block. For a 1000+ page book (the project's own stated performance target) that's an O(n) deep clone on every export, for data that's mostly a lookup table. Keying resolved styles by `block.id` against the untouched `Book` reference is O(1) per lookup at render time and costs nothing extra to construct beyond the styles actually computed. Matches the same "why compute what nothing will use" reasoning already applied to `QualityMetrics` in Phase 2.

### Step 2: Paginate (Domain, concrete class) — PDF and DOCX only
Input: `StyledBook`, `PageLayout` (margins, page size, headers/footers)
Output: `Page[]` — heuristic estimate based on per-block-type height, not exact text shaping (renderer-specific, see ADR-0013)
Module: `domain/services/LayoutEngine.ts` (not built)
**Skipped entirely for EPUB** — EPUB is reflowable, the e-reader paginates it
See: ADR-0013

**`PageLayout` defaults (resolved this review):** always explicitly provided by the export request, no theme-level defaults. A `PageLayout` is a print/page-format concern (page size, margins); a `Theme` is a visual-style concern (fonts, colors). Conflating them would mean changing a theme silently changes page size — surprising behavior. If common `PageLayout` presets are wanted later (e.g. "US Trade 6x9"), that's a named preset the caller picks explicitly, not something a `Theme` implies.

**Typography extension seam:** `LayoutEngine.paginate()` does not call into any Typography Engine in Sprint 2 — there isn't one yet. The seam for Sprint 4 is that `paginate()`'s heuristic height-per-block estimate is exactly where widow/orphan-aware adjustments would plug in later, without changing `paginate()`'s signature. No speculative `TypographyEngine` interface is being created now with no implementation behind it.

### Step 3: Render (Infrastructure, implements the `Renderer` port)

```ts
// domain/ports/Renderer.ts
interface RenderContext {
  format: 'pdf' | 'epub' | 'docx' | 'html' | 'kindle';
  pages?: Page[];              // present for PDF/DOCX; absent for EPUB/HTML (reflowable)
  options?: Record<string, unknown>;  // format-specific overrides, e.g. embed-fonts
}

interface Renderer<TOutput> {
  render(book: StyledBook, context: RenderContext): Promise<TOutput>;
}
```

- `PDFRenderer` — wraps PDFKit, emits `Buffer` (ADR-0014, decided)
- `EPUBRenderer` — library **still TBD, spike required** (ADR-0015, not decided) — candidates: `epub-gen` package vs. hand-rolled OCF/OPF/XHTML via `jszip`
- `DOCXRenderer` — library **still TBD, needs its own ADR** — not evaluated yet at all, unlike EPUB where at least candidates are named

Modules: `infrastructure/renderers/{PDFRenderer,EPUBRenderer,DOCXRenderer}.ts` (none built)
See: ADR-0012, ADR-0014, ADR-0015

### Step 4: Orchestrate (Application)
Each format gets its own Use Case, same shape as `ImportManuscriptUseCase`:
```ts
class ExportPDFUseCase implements UseCase<ExportRequest, Buffer> {
  constructor(
    private themeEngine: ThemeEngine,       // concrete class, not injected as an interface
    private layoutEngine: LayoutEngine,     // concrete class, not injected as an interface
    private renderer: Renderer<Buffer>      // port — this one IS injected as an interface
  ) {}

  async execute(request: ExportRequest): Promise<Buffer> {
    const styled = this.themeEngine.applyTheme(request.book, request.theme);
    const pages = this.layoutEngine.paginate(styled, request.pageLayout);
    return this.renderer.render(styled, { format: 'pdf', pages });
  }
}
```
`ExportEPUBUseCase` is identical minus the `paginate()` call and with `pages` omitted from the context. `ExportDOCXUseCase` mirrors `ExportPDFUseCase`.

## What This Pipeline Does Not Cover

- Typography (widow/orphan control, hyphenation, smart quotes, drop caps) — Sprint 4, Typography Engine; `LayoutEngine.paginate()` has a documented seam for it (see Step 2) but no implementation
- Validator Engine's fuller readability/completeness scoring — Sprint 4
- Theme marketplace distribution/licensing — Commercial stage, `docs/VISION.md`
- Kindle/Kobo/Lulu/IngramSpark/Amazon KDP — later `Renderer` implementations behind the same port, no pipeline changes needed when they're added

## Genuinely Open Questions (not resolved by this review — need a spike, not more reasoning)

1. **EPUB library choice** (ADR-0015) — `epub-gen` vs. hand-rolled via `jszip`. Needs hands-on evaluation of EPUB3 compliance and maintenance status before deciding.
2. **DOCX renderer library choice** — not evaluated at all yet; needs its own ADR before `DOCXRenderer` implementation starts, even though DOCX export is first in the Sprint 2 queue (`docs/TODO.md`).

Everything else in this document is resolved and ready for implementation.
