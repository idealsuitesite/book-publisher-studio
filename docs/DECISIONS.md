# Architectural Decisions

## ADR-0001: Book is the Single Source of Truth

**Status:** APPROVED  
**Date:** 2026-01-15  
**Decision:** All data flows through the Book model.

**Rationale:**
- Eliminates data duplication
- Ensures consistency across export formats
- Simplifies state management
- Enables undo/redo

**Consequences:**
- All transformations must return a Book
- No side effects during transformation
- Immutable updates only

**Related:** Core architecture principle

---

## ADR-0002: Domain Layer Has Zero Infrastructure Dependencies

**Status:** APPROVED  
**Date:** 2026-01-15  
**Decision:** Domain imports NOTHING from external packages except for types.

**Rationale:**
- Maximum portability
- Testability without mocks
- Easy to replace infrastructure
- Domain is the core value

**Consequences:**
- No database access in Domain
- No HTTP calls in Domain
- No file I/O in Domain
- All I/O happens in Infrastructure

**Related:** Clean Architecture, Dependency Inversion

---

## ADR-0003: Dependency Inversion in Use Cases

**Status:** APPROVED  
**Date:** 2026-07-16  
**Decision:** Use Cases depend on interfaces, not implementations.

**Example:**
```typescript
class ImportManuscriptUseCase {
  constructor(
    private parser: DocumentParser,      // interface
    private normalizer: DocumentNormalizer,  // interface
    private builder: BookBuilder,        // interface
    // ... not concrete classes
  ) {}
}
```

**Rationale:**
- Easy to swap implementations (MammothParser → PDFParser)
- Easy to test with mocks
- Use Cases never change
- Infrastructure is pluggable

**Consequences:**
- More interfaces to maintain
- Mocking is mandatory
- Clear contracts between layers

**Related:** SOLID, Clean Architecture

---

## ADR-0004: Sequential Import Pipeline (No Branching)

**Status:** APPROVED  
**Date:** 2026-07-16  
**Decision:** Import pipeline is purely sequential. No conditional branches inside the Use Case.

**Pipeline:**
Parser → Normalizer → Builder → Validator → Metrics → Mapper → Response
**Rationale:**
- Easy to understand and debug
- No hidden branches
- Easy to add/remove steps
- Testable at each step

**Consequences:**
- Error handling is outside the pipeline
- Validation must happen at each step
- No early returns mid-pipeline

**Related:** Simplicity, Testability

---

## ADR-0005: DTOs Are Immutable and Independent of Domain

**Status:** APPROVED  
**Date:** 2026-07-16  
**Decision:** DTOs never reference Domain objects. All conversions happen in Mappers.

**Rationale:**
- Presentation never leaks Domain details
- Easy to evolve API without changing Domain
- Clear API contracts
- JSON serialization guaranteed

**Consequences:**
- Mappers are required for every Domain type
- DTOs must be maintained separately
- More code, but clearer boundaries

**Related:** Clean Architecture, Separation of Concerns

---

## ADR-0006: Testing Strategy

**Status:** APPROVED  
**Date:** 2026-07-16  
**Decision:**
- Unit tests for Domain (pure functions)
- Integration tests for Application (orchestration)
- E2E tests for Presentation (HTTP)

**Coverage:** Minimum 80%

**Rationale:**
- Domain is testable without infrastructure
- Application tests verify orchestration
- E2E tests verify HTTP contracts

**Related:** Quality Assurance

---

## ADR-0007: Git as Source of Truth

**Status:** APPROVED  
**Date:** 2026-07-16  
**Decision:** docs/ folder is committed to Git. It's the project memory.

**Files:**
- CURRENT_STATE.md (updated per sprint)
- ROADMAP.md (living document)
- DECISIONS.md (immutable history)
- TODO.md (task list)

**Rationale:**
- No dependency on individual Claude memory
- Onboarding new collaborators is fast
- Audit trail of decisions
- Distributed knowledge

**Consequences:**
- Discipline to update docs
- Clear communication required
- Instant context on new sessions

**Related:** Documentation, Knowledge Management

---

## ADR-0008: Metrics Ownership Moved from ASTBuilder to BookMetricsCalculator

**Status:** APPROVED
**Date:** 2026-07-16
**Decision:** `ASTBuilder.build()` no longer computes `wordCount`/`pageCount`/`readingTime` inline. That responsibility moved entirely to a new `BookMetricsCalculator.calculate(book): Book`, called by `ImportManuscriptUseCase` after validation.

**Rationale:**
- `ASTBuilder`'s single responsibility is `NormalizedDocument → Book` structure; word counting is a distinct concern
- Matches the Definition of Done requirement that `BookMetricsCalculator` exist as its own tested Domain service
- Keeps `Book.wordCount`/`pageCount`/`readingTime` as the same fields on `Book` (no new parallel `QualityMetrics` object yet — see below)

**Consequences:**
- `ASTBuilder.build()` now returns a `Book` with those three fields `undefined`; callers must run it through `BookMetricsCalculator` to get them populated
- The 3 existing metrics tests moved from `ASTBuilder.test.ts` to `BookMetricsCalculator.test.ts` (same assertions, different location)
- `Book.ts`'s `QualityMetrics` interface (with `widowsAndOrphans`, `inconsistentSpacing`, `emptyHeadings`, etc.) remains declared but unused — those fields require the Typography Engine (Sprint 4), and computing them now would mean fabricating zeros for something not actually analyzed. `BookMetricsCalculator` also exposes `countContent(book)` for the report's `chapters`/`images`/`tables` counts, which are legitimately computable now.

**Related:** Phase 2 (Application Layer), YAGNI

---

## ADR-0009: Legacy `/api/upload` Route Left in Place

**Status:** APPROVED
**Date:** 2026-07-16
**Decision:** The new `POST /api/manuscripts/import` route (Book AST pipeline) was added alongside the existing `POST /api/upload` route (`services/docxParser.ts`, disk-based multer, raw paragraph extraction, no tests, no Book AST). Neither route was deleted or modified to depend on the other.

**Rationale:**
- Removing the legacy route is a separate decision with its own consequences (breaks any existing client relying on its raw-paragraph response shape) that hadn't been made yet at the time Phase 2 was built
- Keeping both avoids blocking Phase 2 on an unrelated decision
- New route uses memory-storage multer (buffer only, nothing written to `backend/uploads/`), so it doesn't add to the already-flagged tracked-files concern in that directory

**Consequences:**
- Two DOCX-import code paths currently exist in the same server; only one is tested and follows Clean Architecture layering
- Follow-up decision still needed: deprecate, redirect, or remove the legacy route

**Related:** Repository Reality Check (2026-07-16), Phase 2 (Application + Presentation Layers)

---

## ADR-0011: Legacy `/api/upload` Marked Deprecated, Removal Scheduled for Sprint 3

**Status:** APPROVED
**Date:** 2026-07-17
**Decision:** Resolves ADR-0009's open follow-up. `POST /api/upload` (`presentation/app.ts`) and `parseDocxFile` (`services/docxParser.ts`) are marked `@deprecated` in code. Removal is scheduled for Sprint 3, after Sprint 2's rendering/export work lands — not immediately.

**Rationale:**
- `/api/manuscripts/import` now fully covers the same use case (DOCX → structured content) with a tested, Clean-Architecture-compliant pipeline
- Waiting until Sprint 3 avoids removing a working endpoint while Sprint 2 (Theme Engine, Layout Engine, DOCX export) is in flight, in case anything still depends on it during that work
- `@deprecated` JSDoc makes the intent visible in the IDE immediately, without requiring a doc lookup

**Consequences:**
- Both routes remain live through Sprint 2
- Sprint 3 planning must include: confirm nothing depends on `/api/upload`'s raw-paragraph response shape, then delete the route, `parseDocxFile`, and the disk-based multer config in `app.ts`

**Related:** ADR-0009, Sprint 3 (`docs/TODO.md`)

---

## ADR-0010: Correction of BASELINE_v0.1.md Test-Count Claims

**Status:** APPROVED
**Date:** 2026-07-17
**Decision:** `docs/architecture/diagrams/BASELINE_v0.1.md` is marked "frozen" (§7: "This baseline is frozen unless changed via ADR + review") and states "Total Tests: 86/86 passing." That number was never accurate — even at the time it was written, its own commit table (7+19+15=41) didn't add up to 86; the 86 figure was an early instance of the same stale-`dist/`-double-counting bug found and fixed during the 2026-07-16 reality check. Current verified count is 88 tests (see `docs/CURRENT_STATE.md`).

Per this ADR (satisfying BASELINE's own change-control rule): `BASELINE_v0.1.md` is annotated as superseded for metrics purposes, without rewriting its architectural content (which remains accurate — Domain/Application/Infrastructure/Presentation layer definitions and dependency rules still hold).

**Rationale:**
- BASELINE's own governance rule requires an ADR to change it — this is that ADR
- Rewriting the whole document would lose the historical record of what v0.1.0-alpha.1 actually specified
- `CURRENT_STATE.md` is already the living source for test counts and should stay that way, rather than duplicating maintenance across two files

**Consequences:**
- `BASELINE_v0.1.md` gets a short status annotation pointing to `CURRENT_STATE.md`, not a full rewrite
- Future architecture-baseline corrections should follow this same pattern: new ADR + annotation, not silent edits to a "frozen" doc

**Related:** Repository Reality Check (2026-07-16), ADR-0007 (Git as Source of Truth)

---

## ADR-0012: Rendering Engine Architecture

**Status:** APPROVED (Design Review 2026-07-17 — see `docs/architecture/diagrams/RENDERING_PIPELINE.md` for the resolved design; ready for implementation on `feature/sprint-2-rendering-engine`)
**Date:** 2026-07-17
**Decision:** Rendering follows the same Hexagonal pattern as import. A new `Renderer` port lives in `domain/ports/` (alongside `DocumentParser`/`DocumentNormalizer`):

```ts
interface Renderer<TOutput> {
  render(book: StyledBook): Promise<TOutput>;
}
```

`PDFRenderer`, `EPUBRenderer`, `DOCXRenderer` implement it in `infrastructure/renderers/`. Each gets its own Use Case (`ExportPDFUseCase`, `ExportEPUBUseCase`, `ExportDOCXUseCase`), all implementing the existing `UseCase<TRequest, TResponse>` contract — no new orchestration pattern needed. The export pipeline is: `Book → ThemeEngine.applyTheme() → StyledBook → LayoutEngine.paginate() (PDF/DOCX only, see ADR-0013) → Renderer.render() → output bytes`.

**Rationale:**
- Reuses the exact pattern already proven in the import pipeline (ports in Domain, adapters in Infrastructure, orchestration in Application) rather than inventing a new one
- Renderers stay swappable — adding Kindle/Kobo/Lulu/IngramSpark later (per `VISION.md`) means a new Infrastructure adapter, zero Domain/Application changes
- `StyledBook` (new Domain type, ADR-0016) is the actual input to rendering, not `Book` directly — rendering never touches raw, unstyled content

**Consequences:**
- None of Domain/Application/Infrastructure for rendering exists yet; this ADR precedes implementation, not follows it
- `ThemeEngine`, `LayoutEngine`, and each `Renderer` are separate, independently testable components — a `PDFRenderer` unit test should not require a real `Theme` or a real paginated book, just a `StyledBook` fixture
- **Design Review addendum (2026-07-17):** confirmed `ThemeEngine`/`LayoutEngine` are concrete Domain classes, not ports — only `Renderer` is a port (interface with multiple swappable implementations). Reusing the same test already applied to `ASTBuilder`/`BookValidator` in Phase 2: a port makes sense where genuinely swappable adapters exist (Renderer: PDF/EPUB/DOCX/HTML/Kindle); a concrete class is correct where there's exactly one right implementation for our own Book model (ThemeEngine, LayoutEngine — same reasoning as ASTBuilder).

**Related:** Sprint 2 (Theme Engine, Layout Engine, DOCX export), Sprint 3 (PDF, EPUB export), `docs/VISION.md`

---

## ADR-0013: Pagination Strategy

**Status:** APPROVED (confirmed unchanged by Design Review 2026-07-17; `PageLayout` defaults resolved — see `docs/architecture/diagrams/RENDERING_PIPELINE.md`)
**Date:** 2026-07-17
**Decision:** Pagination is a **Layout Engine** responsibility (`LayoutEngine.paginate(content: Block[]): Page[]`), and it only applies to fixed-layout output formats (PDF, DOCX). EPUB is reflowable — the e-reader paginates it, not us — so `EPUBRenderer` never calls `paginate()`.

For the first implementation, pagination is heuristic, not exact: each block type gets an estimated height (heading > paragraph > image, roughly proportional to font size × line count for text blocks, actual `height`/`width` for images), accumulated per page against a `PageLayout.height` minus margins/header/footer, breaking to a new `Page` when the estimate is exceeded. This is deliberately simpler than true text-shaping (which needs font metrics from the specific renderer) — exact fidelity is a `PDFRenderer`-level concern, not a `LayoutEngine`-level one.

**Rationale:**
- Exact pagination requires font-metric data that only the renderer (PDFKit) actually has at render time — computing it earlier in the Domain layer would mean either duplicating renderer-specific logic in Domain (violates layer boundaries) or making Domain depend on PDFKit (violates "Domain has zero external dependencies")
- A heuristic estimate is sufficient for `BookMetricsCalculator`'s existing `pageCount` field and for a first-pass Layout Engine; it does not need to be pixel-perfect to be useful
- Widow/orphan control (keeping the last line of a paragraph from being orphaned at a page break) is explicitly deferred to the Typography Engine (Sprint 4) — pagination and typography are separate concerns that happen to interact, not one responsibility

**Consequences:**
- `LayoutEngine.paginate()` output (`Page[]`) is an estimate; `PDFRenderer` may still need to adjust page breaks at render time based on actual PDFKit text measurement — the two are not guaranteed to agree exactly, and that's an accepted trade-off, not a bug, until Typography Engine work lands
- `EPUBRenderer` and `DOCXRenderer` differ here: DOCX (like PDF) is fixed-layout and uses pagination; a Word document's "pages" are also reader/print-dependent in practice, so DOCX pagination is similarly a best-effort estimate, not authoritative

**Related:** ADR-0012, ADR-0014, Sprint 2 (Layout Engine), Sprint 4 (Typography Engine)

---

## ADR-0014: PDF Renderer — PDFKit

**Status:** APPROVED (confirmed unchanged by Design Review 2026-07-17)
**Date:** 2026-07-17
**Decision:** `PDFRenderer` (Infrastructure) wraps **PDFKit** (already named in `PROJECT.md`'s tech stack), a pure-JavaScript PDF generation library with no native/browser dependencies. It consumes a paginated, styled `Book` (see ADR-0012/0013) and emits a `Buffer`.

**Rationale:**
- Pure-JS avoids the operational overhead of a headless-browser-based approach (e.g., Puppeteer/Chromium for HTML-to-PDF) — no browser binary to ship, no sandboxing concerns, smaller deploy footprint
- Trade-off, accepted: PDFKit has no HTML/CSS layout engine, so all layout (pagination, positioning) must be computed at the Domain/Application level before `PDFRenderer` runs — this is exactly why ADR-0012/0013 put pagination in `LayoutEngine`, not in the renderer
- Matches the project's stated performance target (large books, 1000+ pages, thousands of images) better than a browser-rendering approach, which scales worse for very long documents

**Consequences:**
- `PDFRenderer` needs real PDFKit spike work before Sprint 3 implementation starts — this ADR records the choice, not a working implementation
- Image embedding, font embedding, and print-grade features (bleed, crop marks) are PDFKit-specific concerns to resolve during that spike, not decided here

**Related:** ADR-0012, ADR-0013, Sprint 3 (PDF export)

---

## ADR-0015: EPUB Renderer — Library TBD, Spike Required

**Status:** PROPOSED (design only, decision incomplete)
**Date:** 2026-07-17
**Decision:** `EPUBRenderer` (Infrastructure) will generate EPUB3-compliant output (per `ROADMAP.md`'s stated goal). Unlike ADR-0014, the exact library is **not** being committed to here — candidates are an existing EPUB-generation npm package (e.g. `epub-gen`) or hand-rolling the OCF/OPF/XHTML structure directly using `jszip` (already a project dependency, added for DOCX test fixtures). A short spike at the start of the EPUB work should decide between them before writing `EPUBRenderer` itself.

**Rationale:**
- EPUB is fundamentally a zip of XHTML + CSS + an OPF manifest — structurally closer to the Book AST (blocks map naturally to XHTML elements) than PDF is, so a from-scratch approach is more feasible here than it would be for PDF
- Committing to a specific third-party package now, without having evaluated its EPUB3 compliance, maintenance status, or fit with the existing `BlockDTO`/mapper structure, would be a guess dressed up as a decision — exactly the kind of unverified claim this project has been correcting all session

**Consequences:**
- This ADR is intentionally incomplete; it should be updated (not silently replaced — see ADR-0007/ADR-0010's precedent on correcting rather than rewriting) once the spike concludes, with the next available ADR number (ADR-0017 was taken by the branching-policy decision before this spike concluded — use ADR-0018) or an explicit amendment noted here
- No pagination needed for this renderer (ADR-0013) — EPUB is reflowable

**Related:** ADR-0012, ADR-0013, Sprint 3 (EPUB export)

---

## ADR-0016: Theme Engine

**Status:** APPROVED (Design Review 2026-07-17 — `StyledBook` shape resolved, `ThemeEngine` confirmed as a concrete class not a port — see `docs/architecture/diagrams/RENDERING_PIPELINE.md`)
**Date:** 2026-07-17
**Decision:** `Theme` is a plain data interface (fonts, sizes, colors, spacing, per-block-type styles) living in Domain — not code, not a class with behavior. `ThemeEngine.applyTheme(book: Book, theme: Theme): StyledBook` produces a new `StyledBook` (Domain type: a `Book` plus resolved style annotations per block), leaving `Book` itself untouched. First built-in theme: Classic.

**Rationale:**
- Themes-as-data (not themes-as-code) means no plugin sandboxing is needed for themes specifically — unlike the code-executing Plugin System (`VISION.md`), a theme can't do anything except supply style values, so it's inherently safe to load from anywhere, including a future theme marketplace
- `StyledBook` as a distinct type (not mutating `Book`) preserves the immutability principle already established for `Book` itself (see the mutation-vs-immutability finding from comparing against the discarded `159a49b3` commit — that mistake is exactly what this ADR is designed to avoid repeating for the new `StyledBook` type)
- Keeps `ThemeEngine` swappable/testable independent of rendering: a `ThemeEngine` unit test needs a `Book` and a `Theme`, nothing else

**Consequences:**
- `StyledBook`'s exact shape (how style annotations attach to blocks) — **resolved by Design Review 2026-07-17**: `{ book: Book, theme: Theme, blockStyles: Record<blockId, ResolvedBlockStyle> }`, keyed lookup rather than a deep-cloned tree, to avoid an O(n) clone on every export of a large book. See `docs/architecture/diagrams/RENDERING_PIPELINE.md`.
- Theme marketplace (free vs. premium themes) is a Commercial-stage concern (`VISION.md`) layered on top of this later; this ADR only covers the mechanism, not distribution/licensing

**Related:** ADR-0012, Sprint 2 (Theme Engine), `docs/VISION.md` (Theme Marketplace)

---

## ADR-0017: `main` as a Production Branch — Feature Branches Required Going Forward

**Status:** APPROVED
**Date:** 2026-07-17
**Decision:** Starting with Sprint 2, `main` is treated as a production branch. Every new feature (Rendering Engine, Theme Engine, Typography Engine, PDF/EPUB export, etc.) is developed on its own branch, reviewed against its architecture design (the relevant ADR(s) — e.g. ADR-0012 through ADR-0016 for the rendering work), then integrated via atomic commits — not committed directly to `main`.

**Rationale:**
- Sprint 1 and Phase 2 were built directly on `main` because there was no shared history to protect yet and no other contributor/branch to conflict with — that's no longer true now that `v0.2.0-alpha` is tagged and pushed
- The `159a49b3` incident (a parallel Application-layer implementation pushed to `main` directly, diverging silently from this session's work until discovered by a repository audit) is exactly the failure mode branch-per-feature + review-before-merge is meant to prevent
- Matches the ADR-driven design-before-code discipline already established for Sprint 2 (this ADR and ADR-0012 through 0016 exist before any Sprint 2 code does)

**Consequences:**
- Sprint 2 work starts on a dedicated branch (e.g. `feature/sprint-2-rendering-engine`), not on `main`
- Each feature branch should be checked against its ADR(s) before merging, not just against tests passing
- `main` should only receive: merges of reviewed feature branches, and direct documentation/governance commits (ADRs, roadmap updates) of the kind this session has been making throughout — those don't need a feature branch since they carry no implementation risk

**Related:** Repository Reality Check (159a49b3 incident, 2026-07-17), ADR-0012 through ADR-0016 (Sprint 2/3 design)

---

## ADR-0018: DOCX Renderer — `docx` npm Package

**Status:** APPROVED
**Date:** 2026-07-17
**Decision:** `DOCXRenderer` (Infrastructure) wraps the **`docx`** npm package (by dolanmiu) to generate `.docx` output from a `PaginatedBook`. This was the one library choice `docs/TODO.md` flagged as still open after the Rendering Engine Design Review.

**Rationale:**
- Actively maintained, TypeScript-native, purpose-built for generating (not parsing) Word documents from structured content — `Paragraph`, `TextRun`, `Table`, `ImageRun` map cleanly onto the Book AST's `Heading`/`Paragraph`/`Table`/`Image` block types
- Rejected: hand-rolling raw OOXML directly (as done for the minimal test fixtures in `test-utils/buildTestDocx.ts`). That was sufficient for a heading + a couple of plain paragraphs; "Professional DOCX Export" needs styles, tables, and images, and reimplementing what `docx` already solves correctly is wasted effort and a real correctness risk (OOXML has enough sharp edges that a mature library earns its keep here)
- Rejected: `officegen` — older, less actively maintained, no TypeScript types of its own

**Consequences:**
- `docx` becomes a new runtime dependency (not dev-only, unlike `jszip` which is test-fixture-only)
- `DOCXRenderer` consumes `PaginatedBook.styledBook.blockStyles` (font/size/color per block) to build styled `docx` paragraphs, and `PaginatedBook.pages` to insert explicit page breaks at the `LayoutEngine`'s estimated boundaries — Word will still reflow within those breaks, so this is a best-effort layout, not authoritative (ADR-0013)

**Related:** ADR-0012, ADR-0013, ADR-0014 (same rationale pattern as the PDFKit decision), Sprint 2 (Professional DOCX Export)

---

## ADR-0019: PDF Renderer Spike Findings

**Status:** APPROVED
**Date:** 2026-07-17
**Decision:** Before writing `PDFRenderer`, a throwaway spike (`backend/spikes/pdfkit-spike.ts`, not part of `src/` or the test suite, run via `npx tsx spikes/pdfkit-spike.ts`) exercised real PDFKit output for every capability ADR-0014 deferred to implementation time: font embedding, Unicode, images, tables, page breaks, headers/footers, bleed, crop marks. This ADR records what was actually verified, not assumed, and the concrete choices `PDFRenderer` must make as a result.

**Findings (each visually verified against generated PDF output, not just "it didn't throw"):**

1. **Fonts.** PDFKit's 14 standard fonts (Helvetica, Times-Roman, Courier + variants, Symbol, ZapfDingbats) are WinAnsi-only and ship with no glyph data beyond that — there is no bundled "Georgia" or any theme font. `ClassicTheme`'s `Georgia` font family (`docs/ARCHITECTURE.md`/`Theme.ts`) does not exist in PDFKit and must be embedded as a real TTF file. TTF embedding itself works cleanly (`doc.font(pathToTtf)`), verified with a real Georgia TTF. **Open item, not resolved by this ADR:** Georgia itself is a Microsoft-licensed font, not redistributable — production needs an openly-licensed font asset shipped with the app (e.g. an SIL-OFL serif), not an OS font lookup, since deployment targets (Linux containers) won't have Windows fonts installed at all. Bold/italic variants need their own separate TTF files per family; PDFKit does not synthesize them from a single regular-weight file. (Not currently a blocker: `DOCXRenderer` doesn't render inline bold/italic runs either — see ADR-0018/`Block.inlines` — so `PDFRenderer` v1 can match that existing scope.)

2. **Unicode.** Confirmed non-Latin text is unreadable through a standard-14 font (mojibake), as expected. A single embedded Unicode-capable font (tested: Malgun Gothic) does **not** solve global text support: it rendered Chinese, Cyrillic, and Korean correctly, dropped an accented Greek character (glyph missing from that specific font), and rendered Arabic as blank boxes (no Arabic glyphs in that font at all) — and even a font with Arabic glyphs wouldn't fix RTL rendering, since PDFKit does no bidi reordering or Arabic contextual shaping on its own. **Decision:** `PDFRenderer` needs a small per-script font stack (Latin/Cyrillic/Greek, CJK, Arabic/Hebrew with bidi handling), selected per block/run — not one "Unicode font" for everything. Full RTL support is real, separate work, not a font swap; this ADR flags it but does not schedule it (out of scope for Sprint 3A, which targets the same content shape `DOCXRenderer` already handles).

3. **Images.** `doc.image()` accepts a `Buffer` (matches `Image.base64` on the `Block` type) with `fit: [w, h]` or `width` options; both preserve aspect ratio correctly, verified visually. No surprises — same no-network-fetch rule as `DOCXRenderer` applies (embed from `base64` or fall back to a text placeholder, per ADR-0012/existing `DOCXRenderer` behavior).

4. **Tables.** PDFKit has no table primitive at all. Verified a manual approach works: draw cell borders with `rect().stroke()`, compute row height per row via `doc.heightOfString(text, { width: colWidth })` across all cells in the row (tallest cell wins), draw text into each cell at accumulated `x`. This is hand-rolled logic in `PDFRenderer`, structurally parallel to `LayoutEngine`'s own heuristic block-height estimation (ADR-0013) — not a new kind of complexity for this codebase, just a new place it has to happen.

5. **Page breaks.** `doc.addPage()` maps 1:1 onto `PaginatedBook.pages` boundaries — no surprises, matches the `DOCXRenderer` pattern of inserting a break at each page's first block.

6. **Headers/footers — three real bugs found while building `PDFRenderer`, not just in the spike, ending in a different (and simpler) final design than first planned.** The original approach drew headers/footers live via the `pageAdded` event while content was still flowing:
   - **Bug A (stack overflow):** drawing footer text below the page's bottom-margin boundary (e.g. `y = pageHeight - 50` against a 72pt margin) made PDFKit's own overflow-triggered auto-pagination fire *from inside* the `pageAdded` handler that was drawing the footer — which re-emitted `pageAdded`, re-entering the same handler, recursing until the stack overflowed. `lineBreak: false` did **not** fix this (it only suppresses line-wrapping, not the bottom-margin overflow check).
   - **Bug B (silent page-count blowup):** `doc.text(str, x, y, opts)` moves PDFKit's internal cursor (`doc.x`/`doc.y`) to just below whatever it wrote. Since the footer was drawn near the bottom of the page, that left the cursor there — and every subsequent content call that omits explicit `x`/`y` (which is how prose blocks are rendered) continued writing from that stranded cursor, overflowing onto a new page almost immediately. A 9-page test document rendered as 212 pages before this was caught.
   - **Bug C (wrong total, caught on a real DOCX from `backend/uploads/` exported through the running dev server — not just synthetic fixtures):** even after fixing A and B, the footer displayed things like "Page 6 of 4". `PaginatedBook.pages.length` (LayoutEngine's word-count-based estimate, ADR-0013) was being used as the "of TOTAL" figure, and real content routinely exceeds that estimate once PDFKit's actual text measurement runs — exactly the "not guaranteed to agree exactly" trade-off ADR-0013 already flagged, just more visibly wrong than expected when surfaced as a displayed number rather than an internal estimate.

   **Final design (all three fixed by one change):** construct the `PDFDocument` with `bufferPages: true`, which defers writing pages to the output stream until flushed. Content renders first with zero header/footer interference — no header/footer code runs while `doc.addPage()` is flowing content, so bugs A and B can't occur by construction. Only after all content exists does a second pass loop with `doc.switchToPage(i)` over `doc.bufferedPageRange()` and stamp each page's header/footer, using `range.count` — the *real, exact* rendered page count — for "Page N of TOTAL", fixing bug C. This is a two-pass *header/footer draw*, not a two-pass *render*; `PDFRenderer.render()` still renders content exactly once. `PaginatedBook.pages.length` is no longer used for the displayed total at all — only for computing forced page-break positions (ADR-0013).

7. **Bleed and crop marks.** Bleed is straightforward: set the PDFKit page size to trim size + bleed on all sides, and offset all content by the bleed amount. Crop marks have no built-in support and are drawn manually with `moveTo`/`lineTo` (same category of manual work as the table grid). **Caveat:** PDFKit's public API only ever writes the PDF's `/MediaBox`; there is no `trimBox`/`bleedBox` option. Setting real `/TrimBox` and `/BleedBox` page-dictionary entries (so print/prepress software can tell bleed from trim) is only reachable via an undocumented internal property, `doc.page.dictionary.data`, not a supported API. This is a real forward-compat risk if `pdfkit` changes its internals across versions.

**Rationale:**
- Matches this project's established discipline (ADR-0012 through ADR-0018): resolve unknowns with evidence before writing the real component, not while writing it
- A spike script (not shipped code, not test-suite code) is the right vehicle — cheaper to throw away sections that don't pan out than to discover a stack-overflow bug for the first time inside `PDFRenderer.test.ts`
- Two findings (font redistribution licensing, `/TrimBox`/`/BleedBox` via undocumented internals) are real risks worth recording even though neither blocks Sprint 3A's first cut of `PDFRenderer`

**Consequences:**
- `PDFRenderer` implementation must use the `margins.bottom = 0` pattern for header/footer drawing (finding 6) — this is not optional, it's a reproduced crash
- `PDFRenderer` v1 targets the same content scope `DOCXRenderer` already covers (no inline bold/italic, no RTL) — both are explicit, tracked gaps, not silent omissions (`docs/TODO.md`)
- Choosing and licensing a real font asset to ship (replacing the spike's ad hoc system-font lookup) is a follow-up decision, not resolved here — tracked in `docs/TODO.md`
- `pdfkit` version should be pinned (already true via `package.json`'s `^0.19.1`, but the undocumented-internals risk (finding 7) means a version bump needs a manual bleed/crop-mark smoke check, not just `npm test`

**Related:** ADR-0012, ADR-0013, ADR-0014, Sprint 3A (PDF export)