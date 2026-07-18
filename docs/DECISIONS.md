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

**Status:** RESOLVED by ADR-0020 (2026-07-17) — `epub-gen-memory` chosen. This entry is left as-written (not rewritten) per this project's own precedent (ADR-0007/ADR-0010: correct via a new ADR + pointer, not a silent edit to history) — see ADR-0020 for the spike findings and final decision.
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

---

## ADR-0020: EPUB Renderer — Library Decision (resolves ADR-0015)

**Status:** APPROVED
**Date:** 2026-07-17
**Decision:** `EPUBRenderer` (Infrastructure) will use **`epub-gen-memory`** (a maintained fork of `epub-gen`), not `epub-gen` itself and not a hand-rolled OCF/OPF/XHTML implementation via `jszip`. Resolves ADR-0015's open spike requirement. Verified with a real spike (`backend/spikes/epub-library-spike.ts`) before this ADR was written, same discipline as ADR-0019 for PDF.

**Evidence gathered (via `npm view`, GitHub's API, and real generated output — not the README alone):**

1. **`epub-gen` (the ADR-0015 example candidate) is unmaintained.** Last published to npm 2022-06-17 (over 4 years stale as of this decision), never left `0.1.0`, written in CoffeeScript, GitHub shows **no detected license** (`license: null`) despite `package.json` claiming MIT — an ambiguity, not just staleness. Its dependency tree carries genuinely legacy packages: `q@^1.5.1` (pre-native-Promises era), `rimraf@^2.6.3` and `archiver@^3.0.0` (both several majors behind current), `cheerio@^0.22.0` (a *different major* than this project's own `cheerio@^1.2.0`, meaning it would install a second, ancient copy alongside ours).
2. **`epub-gen-memory`** (`cpiber/epub-gen-memory`, a fork of `epub-gen`) is the stronger candidate: TypeScript-native with bundled `.d.ts` types (no separate `@types` package needed), MIT-licensed (GitHub confirms a real `license` object, unlike the parent), last pushed 2024-07-29 (~2 years old, notably fresher than the parent), 58 stars / 22 forks / 1 open issue, and its dependency tree is current and free of the parent's legacy packages — including `jszip@^3.7.1`, compatible with this project's own `jszip@^3.10.1` (already a dependency for DOCX test fixtures, ADR-0018's precedent).
3. **API shape verified with real output, not assumed:** `epub(options, content: Chapter[], version)` returns `Promise<Buffer>` directly — matches `Renderer<Buffer>` (ADR-0012) with no filesystem round-trip needed, unlike the parent `epub-gen`'s file-path-based API. A generated EPUB was inspected structurally: `mimetype` is correctly the first zip entry and stored uncompressed (EPUB OCF spec requirement, confirmed via JSZip's compression metadata), the OPF manifest declares `version="3.0"`, and both `toc.ncx` (EPUB2 back-compat) and `toc.xhtml` (EPUB3 nav document) are generated automatically. Chapter content is an **HTML string** per chapter, not our Book AST directly — `EPUBRenderer` needs a small `Block[] → HTML` serializer (structurally simpler than PDFKit's imperative drawing API, and the natural fit ADR-0015's rationale already predicted: "blocks map naturally to XHTML elements").
4. **Real import gotcha (reproduced):** the README's `import epub from 'epub-gen-memory'` does not yield a callable under this project's tsx/ESM toolchain — the package is TS-compiled-to-CJS, and under Node's ESM/CJS interop the callable arrives double-wrapped (`module.default.default`, not `module.default`). Confirmed by inspecting the runtime module object directly. `EPUBRenderer` must import it this way; a naive default import will fail with a non-obvious "epub is not a function" error.
5. **Real architectural conflict found and resolved:** the README states chapter-content image sources are downloaded, and this was verified to mean *unconditionally* — even a `data:` URI throws `"Only HTTP(S) protocols are supported"` (the library routes every `<img src>` through `node-fetch`, with no bypass for already-available bytes). This conflicts with this project's established rule (`DOCXRenderer`, `PDFRenderer`): no hidden network I/O inside a renderer. **Verified workaround:** the library does support `file://` local paths with zero network calls. `EPUBRenderer` must write embedded base64 image bytes to a scoped temp directory per render (`fs.mkdtempSync`), reference them via a `file://` URL, and delete the temp directory after rendering completes — a real, documented integration cost, not a silent gap. Images without embedded base64 data are simply omitted from the HTML (same placeholder-only rule the other two renderers already follow) — never worth triggering a real fetch for.

**Rationale:**
- Hand-rolling OCF/OPF/XHTML from scratch (ADR-0015's other candidate) is strictly more work for no benefit once a well-tested, actively-maintained, TypeScript-native library is confirmed to produce spec-correct output with an API shape that already matches `Renderer<Buffer>` — rejected on those grounds, not on principle
- `epub-gen` itself (the literal ADR-0015 example) is rejected on maintenance and dependency-health grounds — this is a "don't guess, verify" correction of ADR-0015's own example candidate, exactly the kind of unverified claim this project's discipline exists to catch before it becomes code
- The image-fetching conflict is real but has a verified, contained workaround (temp file + `file://`) rather than requiring either a rule exception or abandoning the library

**Addendum (2026-07-17) — real bug found and fixed while building `EPUBRenderer`, not just in the spike:** an early version of `EPUBRenderer` walked `PaginatedBook.styledBook.book.mainContent` filtered to `content.type === 'chapter'` only, mirroring the assumption that top-level content is always a `Chapter`. This is wrong — `ASTBuilder` falls back to a top-level `Section` ("preamble", `title: ''`) when the source document has no Heading-1-level break at all, and `DOCXRenderer`/`PDFRenderer` already handle this by walking `Content` (the `Chapter | Section` union) generically rather than filtering. The filtered version produced a **structurally valid but completely empty EPUB** — correct `mimetype`, correct OPF, zero chapter files — for a real DOCX from `backend/uploads/` that has exactly this shape (no Heading-1 styles, just body text and subheadings). No synthetic test fixture would have caught this, since every fixture used up to that point always included an explicit top-level `Chapter`. Caught only by exporting a real file through the running dev server and inspecting the actual zip contents, not by trusting the HTTP 200 response alone. Fixed by mapping over all of `mainContent` regardless of `Chapter`/`Section` type, matching the other two renderers, with an `'Untitled'` fallback for the EPUB nav/TOC entry title specifically (not fabricated into the visible body heading, which is simply omitted when `content.title` is empty).

**Consequences:**
- `EPUBRenderer` needs a `Block[] → HTML` serializer as its main body of work — mapping the same block types `DOCXRenderer`/`PDFRenderer` already handle (headings, paragraphs, quotes, lists, tables, footnotes, images) onto HTML tags
- `EPUBRenderer` must manage a scoped temp directory for embedded images per render call (create before rendering, delete in a `finally`) — this is new lifecycle-management code neither `DOCXRenderer` nor `PDFRenderer` needed, since neither writes to disk
- No pagination needed (ADR-0013, unchanged) — EPUB is reflowable, `PaginatedBook.pages` is not consulted by `EPUBRenderer` the way `PDFRenderer`/`DOCXRenderer` consult it for forced page breaks
- `epub-gen-memory` becomes a new runtime dependency; its own dependency tree should be watched at upgrade time given it's a smaller-community fork (58 stars) of a more popular but unmaintained parent (458 stars) — not a reason to avoid it now, but a reason not to assume it's risk-free forever

**Related:** ADR-0012, ADR-0013, ADR-0015 (resolved by this ADR), ADR-0018 (same rationale pattern — verify a library choice with evidence, same as the `docx` package decision), Sprint 3B (EPUB export)

---

## ADR-0021: Post-Sprint-3 Governance Decisions

**Status:** APPROVED
**Date:** 2026-07-17
**Decision:** Four small governance items were left open after Sprint 3B merged (PR #4, `a7a38a0`). CTO direction resolves all four before Sprint 4 design work starts:

1. **Tag `v0.4.1-alpha` now.** EPUB export is merged, tested (133/133), and verified against a real file on `main` — nothing left to gate the tag per `docs/VERSIONS.md`'s own rule ("Released only after the tag is actually pushed").
2. **Remove the legacy `/api/upload` route now**, not deferred further. Resolves ADR-0011's scheduled-for-Sprint-3 removal: `POST /api/upload` (`presentation/app.ts`), `parseDocxFile` (`services/docxParser.ts`), and the disk-based multer config are deleted outright, not just left `@deprecated`. Sprint 3 ("Professional Export") is complete, satisfying ADR-0011's own precondition ("after Sprint 2's rendering/export work lands").
3. **Font policy: Gelasio.** Resolves the open item from ADR-0019 finding 1 (Georgia is Microsoft-licensed, not redistributable, and PDFKit ships no font data). Gelasio is a SIL Open Font License serif metrically compatible with Georgia — closest visual match available under a redistributable license. This ADR records the **choice only**; embedding the actual `.ttf` assets into `PDFRenderer`/`ClassicTheme` is implementation work, deferred to Sprint 4 (natural fit for the Typography Engine, which will own font/size/weight/style resolution — see the forthcoming Sprint 4 Design Review) rather than done as a standalone patch.
4. **`backend/uploads/` git history: keep as-is, no purge.** Resolves the open decision tracked in `docs/TODO.md` since the 2026-07-16 reality check. The directory is untracked going forward (`.gitignore` + `git rm --cached`, already done); a `git filter-repo` history rewrite is a destructive, hash-rewriting operation whose only benefit is cosmetic (old blobs no longer added to) — not worth the coordination cost (force-push, every clone/fork needing to re-clone) for a repository with a small, known set of collaborators.

**Rationale:**
- Items 1, 2, and 4 were already fully specified by earlier ADRs (`docs/VERSIONS.md`'s tagging rule, ADR-0011, and the reality-check follow-up respectively) — this ADR is the actual go/no-go call those were waiting on, not new design
- Item 3 follows the same "record the decision, defer the implementation" pattern already used for library choices (ADR-0014, ADR-0018, ADR-0020) — picking Gelasio doesn't require writing renderer code today
- Bundling four small, independent governance calls into one ADR (rather than four) matches their actual size — none individually warrants a full Design Review

**Consequences:**
- `docs/VERSIONS.md`'s `v0.4.1-alpha` row moves to ✅ Released once the tag is pushed
- `docs/TODO.md`'s legacy-route and uploads-history open items close; the font item moves from "undecided" to "decided, not yet implemented"
- `PDFRenderer`/`ClassicTheme` still render Georgia-by-name-heuristic until Sprint 4 actually embeds Gelasio — this ADR does not change current PDF output, only the plan for it

**Related:** ADR-0011, ADR-0019, ADR-0020, `docs/VERSIONS.md`, `docs/TODO.md`

---

## ADR-0022: Typography Resolution Pipeline

**Status:** APPROVED — implemented, Sprint 4 commits 1-4
**Date:** 2026-07-17
**Decision:** A new concrete Domain service, `TypographyResolver`, is inserted into the rendering pipeline: `ThemeEngine → TypographyResolver → LayoutEngine → Renderer`. `StyledBook` gains one additive optional field, `blockTypography?: Record<string, ResolvedTypography>`, populated by `TypographyResolver.resolve(styled, options?): StyledBook` (same input/output type, immutable — a `{ ...styled, blockTypography }` spread, matching `ThemeEngine.applyTheme()`'s own pattern). `LayoutEngine.paginate()`, `PaginatedBook`, and `Renderer<TOutput>` all keep their exact pre-Sprint-4 signatures — `LayoutEngine` only gains an *internal* read of the new optional field.

**Rationale:**
- **What this replaces:** before this sprint, none of the three renderers (`PDFRenderer`/`DOCXRenderer`/`EPUBRenderer`) rendered `Block.inlines` at all — bold/italic/underline/strikethrough/superscript/subscript/links/small-caps were silently dropped to plain text in every export. Heading size (`theme.fontSizes.h1-h6`) was ignored entirely by `PDFRenderer` (hardcoded formula) and `DOCXRenderer` (delegated to `docx`'s own default `HeadingLevel` styling). Quote/scripture italics were three independent per-renderer hardcodes that happened to agree, not a shared rule. `TypographyResolver` centralizes all of this into one Domain component, computed once instead of three times.
- **Design Review rejected a larger v1 proposal** (`docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md`, CTO Review Outcomes #3/#4): a new `TypesetBook` type with `LayoutEngine`/`PaginatedBook` retyped to match. Judged not worth the blast radius (every renderer's access path, `LayoutEngine.test.ts`, every `PaginatedBook`-typed fixture across 4 test files) for what is, in the end, additive data. The additive-field version shipped instead.
- **Block-type typography rules (quote/scripture italics, etc.) are `TypographyResolver`-internal defaults in v1, not `Theme`-configurable** (CTO Final Decision 1) — Sprint 4's goal was centralizing typography, not making it configurable; that's separable future work the current design doesn't block.

**What was actually built (commits 1-4):**
- `ResolvedTypography`/`TypeRun` domain types (`domain/models/ResolvedTypography.ts`) — per-run bold/italic/underline/strikethrough/superscript/subscript/smallCaps/linkUrl, plus block-level `dropCap`/`staysWithNext`.
- `TypographyResolver.resolve()` — inline run resolution (`Block.inlines` → `TypeRun[]`, with a plain-text fallback via `shared/utils/typographyRuns.ts`'s `plainTypeRun`/`runsOrPlainFallback`, used identically by all 3 renderers), drop caps (`Paragraph.dropCap` → `ResolvedTypography.dropCap`), English-only smart quotes (see ADR-0024), and forced italics on quote/scripture blocks.
- A composite key convention (`shared/utils/typographyKeys.ts`): `blockTypographyKey(id)` is the identity function (most blocks own one text stream, keyed by their own `block.id`); `listItemTypographyKey(id, index)` gives `List` — the one block type with several independent text streams (one per item) — a distinct key per item instead of losing item boundaries; `::cell-R-C` reserved (not yet implemented) for a future `Table` inline-support case.
- **The design doc's proposed `orphanRisk` flag was renamed `staysWithNext` during implementation** — the actual behavior only ever flags `Heading` blocks (`staysWithNext: true` unconditionally, computed with no page-layout knowledge), and `LayoutEngine` never splits a block's content mid-page, so there is no line-level widow/orphan under this pagination model, only this block-level "don't strand this block alone at a page break" signal. The field name was corrected to describe what it actually does, not what the original design doc assumed it might grow into.
- `LayoutEngine.paginate()` reads `styled.blockTypography?.[lastBlockId]?.staysWithNext` on an overflow-triggered page break and carries that block onto the new page instead of leaving it stranded — best-effort, layered on top of `LayoutEngine`'s already-approximate heuristic pagination (ADR-0013's own documented "not guaranteed to agree exactly with real rendered output" caveat now also covers this nudge).

**Consequences:**
- All three renderers became pure "drawers": they consume `styled.blockTypography?.[block.id]?.runs` instead of `block.text` directly, and each renderer's private font-heuristic/heading-size/italic-hardcode logic was deleted.
- `TypographyResolver` is a concrete class, not a port — same reasoning as `ThemeEngine`/`LayoutEngine`/`ASTBuilder`/`BookValidator`: one correct implementation for this project's Book model, no swappable-adapter case (ADR-0002).
- `blockTypography` being optional on `StyledBook` means every reader must tolerate its absence (a `StyledBook` produced by a path that skips `TypographyResolver`, e.g. a hand-built test fixture) — production code paths are safe by construction since `ExportManuscriptUseCase` always calls `resolve()` before `paginate()`; test fixtures must opt in deliberately (see `LayoutEngine.test.ts`'s `styledBookFrom()` vs `typesetBookFrom()` helpers, which exist specifically to exercise both states).
- Real bugs found via this pipeline's own real-file verification led directly to ADR-0026 (3 import-pipeline content-fidelity bugs, fixed as an explicit scope exception) — the same "verify with a real file" discipline this pipeline's `TypeRun` rendering was built under caught bugs one layer upstream of it.

**Related:** `docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md` (full Design Review), ADR-0012 (`Renderer` is a port; `ThemeEngine`/`LayoutEngine` are concrete classes), ADR-0013 (pagination heuristic, "not guaranteed to agree exactly"), ADR-0008 (`QualityMetrics`, extended in commit 9), ADR-0023 (font embedding this pipeline's `PDFRenderer` consumes), ADR-0024 (hyphenation/locale-aware quotes deferred), ADR-0026 (bugs found via this pipeline's real-file verification)

---

## ADR-0023: PDF Font Embedding — Gelasio, Inter, JetBrains Mono

**Status:** APPROVED — implemented, Sprint 4 commit 6
**Date:** 2026-07-17
**Decision:** Three real, embedded, redistributable font families replace `PDFRenderer`'s PDFKit standard-14 substitutes across **all three** typographic categories, not just the serif/Georgia gap ADR-0021 originally flagged: **Gelasio** (serif, replaces the Georgia/Times fallback), **Inter** (sans-serif, replaces the Helvetica fallback), **JetBrains Mono** (monospace, replaces the Courier fallback). All three are open-licensed and safe to redistribute (Gelasio and Inter under SIL OFL 1.1, JetBrains Mono under Apache 2.0) — 12 `.ttf` files (4 weight/style combinations × 3 families) committed to `backend/assets/fonts/`, with license files and a sourcing README, so there is no network dependency at build/test/export time.

**Rationale:**
- Resolves ADR-0021 finding 3, which recorded the font **choice** (Gelasio) but explicitly deferred embedding the actual asset to Sprint 4 as "a natural fit for the Typography Engine, which will own font/size/weight/style resolution."
- **Scope expanded from one family to three** (CTO Final Decision 2, Design Review round 2): technical/professional documents routinely contain code (monospace) and the existing Courier fallback read as unpolished — no reason to fix only the serif gap while leaving sans-serif and monospace on bare PDFKit standard-14 substitutes.
- DOCX and EPUB output do **not** need this kind of embedding — `docx`'s `TextRun.font` passes a font name straight through for the reader's own Word/LibreOffice installation to resolve, and EPUB's CSS `font-family` is a reader-side hint for the e-reader's own font stack. Only `PDFRenderer` bakes glyphs directly into the output file, so only PDF had a real "no redistributable font data" gap (ADR-0019 finding 1) to close.

**What was built:** `PdfFontRegistry` (`infrastructure/fonts/PdfFontRegistry.ts`) — deliberately **role-based**, not string-based: `resolveBody(theme, bold, italic)`, `resolveHeading(level, theme, bold, italic)`, `resolveMonospace(bold, italic)`, `resolveDefault(bold, italic)` (page chrome — running header/footer — drawn independently of any block or theme), plus `registerAll(doc)` to register all 12 files with PDFKit once per document. `PDFRenderer` never inspects a theme's font-name string or does its own family-matching anymore; it only asks for a role and gets back a registered PDFKit font name. `resolveFamily()`'s regex-based family detection (mapping theme font-name strings like `"Georgia"`/`"Helvetica"`/`"Courier"` onto one of the 3 embedded families) is kept internally — still needed to decide *which* family a given theme font name means — but its output is now one of the 3 registered embedded families instead of a PDFKit standard-14 name.

`PdfFontRegistry` was audited to confirm it contains **zero PDF-rendering logic** — only `doc.registerFont()` calls and name resolution, no `doc.font()` selection calls, no coordinates, no font sizes — so it can become the template for a shared `FontRegistry` across PDF/DOCX/EPUB later without carrying any PDF-specific drawing concerns with it.

**Real bug found and fixed as a side effect of this refactor:** `PDFRenderer.renderTitle()` was calling `resolveDefault()` (the sans-serif page-chrome fallback) instead of `resolveHeading()` for chapter title text — a heading-font inconsistency that predated this commit but was only surfaced while auditing every call site during the role-based API migration. Fixed and disclosed in the commit message, not folded in silently.

**Consequences:**
- `ClassicTheme`'s `fonts.heading`/`fonts.body` (both `"Georgia"`) now resolve to real embedded Gelasio glyphs in PDF output, verifiable via the extracted `/BaseFont` name in the generated PDF (`extractPdfText.ts`'s `extractPdfRuns()`, rewritten this sprint to be font-aware for exactly this purpose).
- No RTL/multi-script coverage — verified no single one of the 3 embedded families covers every script (Arabic renders as blank boxes with the fonts tested); this was already flagged out of scope by ADR-0019 finding 2 and remains flagged, not solved by this ADR.
- PDFKit has no native primitive for superscript/subscript/small-caps — these `TypeRun` flags remain unrendered in `PDFRenderer` regardless of which font backs them (a PDFKit API gap, not a font-asset gap; DOCX and EPUB render all three correctly).

**Related:** ADR-0019 finding 1 (Georgia not redistributable, PDFKit ships no font data), ADR-0021 (font policy decision, embedding deferred to Sprint 4), ADR-0022 (the pipeline `PdfFontRegistry` integrates with via `PDFRenderer`'s `FontResolver` closure)

---

## ADR-0024: Hyphenation and Locale-Aware Smart Quotes Deferred to v2

**Status:** APPROVED — confirmed decision, not new design
**Date:** 2026-07-17
**Decision:** Two typography features are formally out of Sprint 4 scope, recording what the Design Review already decided informally (CTO Review Outcomes #6/#7) rather than introducing a new decision:
1. **Hyphenation.** No language-aware, dictionary-based line-breaking is implemented anywhere in `LayoutEngine` or the three renderers. Not attempted even partially or naively this sprint.
2. **Locale-aware smart quotes.** `TypographyResolver`'s `smartenQuotes()` applies **English-only** straight-to-curly substitution (`"` → `“`/`”`, `'` → `‘`/`’`) unconditionally, regardless of `Book.metadata.language`. French (`« »`), German (`„ "`), and every other locale's own quoting convention is explicit, tracked future work — not silently missing, since `Book.metadata.language` already carries the ISO 639-1 code a future locale-aware implementation would key off of.

**Rationale:**
- **Hyphenation** is materially bigger scope than every other Sprint 4 typography item combined (Design Review §4 item 7) — real hyphenation needs per-language dictionaries and correct handling of compound words, proper nouns, and existing manual hyphens; a naive character-count-based approach would produce visibly wrong breaks, which is worse than not hyphenating at all.
- **Locale-aware quotes** were confirmed v1-English-only specifically to keep Sprint 4 focused (Design Review §4 item 5, same "avoiding scope creep" framing the CTO used for the Round 2 final decisions) — English quoting is also what every canonical verification fixture (`backend/verification/`) currently exercises, so this is the tested, evidenced state, not an untested guess.

**A real, disclosed consequence, not just a feature gap:** because `smartenQuotes()` runs unconditionally, importing a **French-language** manuscript today produces English-style curly quotes on its straight quotes/apostrophes — this is **wrong output for that document**, not merely "a feature not yet built." Flagged explicitly here so a future session doesn't mistake this for an oversight when a non-English real document is verified.

**Also confirmed, not touched:** no line-breaking/overflow handling exists for long unhyphenated words — in a narrow column or justified-text layout, a sufficiently long word can visually overflow rather than break, since `LayoutEngine`'s pagination is word-count-based (ADR-0013) and has no per-line glyph-width awareness to detect this in the first place.

**Consequences:**
- `TypographyOptions.smartQuotes?: boolean` (default `true`) remains the only quoting control surface — an on/off switch, not a locale selector. Adding locale-aware quoting later is additive (a new option or a `Book.metadata.language`-keyed lookup inside `smartenQuotes()`), not an architecture change.
- Tracked as explicit future work, not folded into the "Import Fidelity" backlog item (that's for import-pipeline fidelity; this is rendering-pipeline scope) — no dedicated backlog entry exists yet beyond this ADR and the Design Review doc; a future session should give it one before starting the work, matching this project's "spike/design before code" discipline (ADR-0019/ADR-0020 precedent) given hyphenation in particular is real, multi-locale, dictionary-dependent work.

**Related:** `docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md` §4 items 5 and 7 (Design Review), ADR-0022 (the pipeline `TypographyResolver` belongs to), ADR-0013 (word-count pagination heuristic, relevant to the unhyphenated-overflow consequence above)

---

## ADR-0025: Mammoth Drops DOCX Underline Formatting by Default (Import Pipeline Limitation)

**Status:** APPROVED — documented and deferred, not fixed
**Date:** 2026-07-17
**Decision:** A real, verified limitation surfaced while real-export-verifying Sprint 4 commit 7 (`npm run verify-real-export` against `backend/verification/typography-test.docx`). Explicit CTO triage: this belongs to the **import** pipeline (`MammothParser`), not the **rendering** pipeline Sprint 4 is building — document it now, do not modify `MammothParser` or any import-side code this sprint. Tracked for a future dedicated "Import Fidelity" sprint instead.

**What's lost:** Underline formatting (`<u>` in Word) on inline text is silently dropped during `MammothParser`'s DOCX→HTML conversion. The underlined *word* survives; only the underline *styling* is lost. No error, no warning — the round trip DOCX → Book AST → export (DOCX/PDF/EPUB) produces text that reads correctly but has silently lost that emphasis.

**Evidence (mammoth's own documentation, not assumed):**
> "By default, the underlining of any text is ignored since underlining can be confused with links in HTML documents." — `node_modules/mammoth/README.md`, "Underline" section

Confirmed empirically against a real document, not just the docs: `MammothParser.parse()`'s raw HTML output for `backend/verification/typography-test.docx` (authored with an explicit underlined run via the `docx` package) contains the word "underlined" as plain, untagged text — no `<u>` anywhere — while the *same paragraph's* bold/italic/strikethrough runs correctly produce `<strong>`, `<em>`, `<s>`. This confirms mammoth's underline-dropping is a deliberate default specific to underline, not a general inline-formatting failure — bold/italic/strikethrough all round-trip correctly today, confirmed by `MammothParser.test.ts`.

The rest of the pipeline already fully supports underline — confirmed by reading the code, not assumed:
- `HtmlNormalizer.ts:126`: `else if (tag === 'u') inlines.push({ type: 'underline', text });`
- `ASTBuilder.ts:274-275`: `case 'underline': return { type: 'underline' as const, text: inline.text };`
- `TypographyResolver`/`PDFRenderer`/`DOCXRenderer` (Sprint 4 commits 2-7) all correctly render an `UnderlineText` `InlineElement` when the Book AST actually has one (both renderers' test suites include passing underline cases against hand-built fixtures).

So this is one precisely-located gap: `MammothParser.ts`'s `mammoth.convertToHtml({ buffer })` call passes no `styleMap` option, so mammoth's underline-ignoring default applies. Everything downstream of that call is already correct and ready.

**User impact:** Any real DOCX containing underlined text (a common choice, especially in legal/academic/business documents) silently loses that formatting on import, with no error surfaced.

**Documented, verified workaround — not implemented this sprint:** mammoth supports exactly this case via a `styleMap` option: `styleMap: ["u => u"]` passed to `mammoth.convertToHtml()` would map Word's underline run style onto an HTML `<u>` tag, which `HtmlNormalizer`/`ASTBuilder` already correctly convert into an `UnderlineText` inline element — closing the gap with what reads like a one-line change to `MammothParser.ts`. Deliberately not applied now: Sprint 4 does not touch the import pipeline, even for a small, well-understood fix — that is Import Fidelity sprint scope, not Rendering (Sprint 4) scope.

**Alternative libraries — named as candidates for a future spike, not evaluated with real evidence here (that's Import Fidelity sprint work, matching the ADR-0019/ADR-0020 spike-before-decide precedent):**
- Mammoth's own `styleMap` option (above) — smallest possible change, keeps the already-adopted, already-verified library
- `docx4js` — an alternative DOCX parser more OOXML-structure-aware than mammoth's HTML-semantic focus; maintenance/license status not checked
- Hand-rolling a minimal OOXML run-property reader against `word/document.xml` via `jszip` (already a project dependency) for just the formatting flags mammoth currently drops — bypasses HTML entirely for this narrow purpose; more code to own, full control (same reasoning pattern as ADR-0018's docx-generation choice)

**Other known mammoth-default-drops worth the same future sprint's attention (named, not yet individually verified):** highlight, track changes, comments, text boxes, SmartArt, floating images, nested tables, DrawingML.

**Consequences:**
- No import-pipeline code change this sprint
- `MammothParser.test.ts` gains a regression test asserting this AS the current, correct, documented behavior (word present, `<u>` absent) — so a future engineer (or session) never mistakes this for a Sprint 4 typography regression, and so a future fix (e.g. adding the `styleMap`) shows up as an intentional, visible test change rather than silently flipping an unguarded assertion
- Tracked for a dedicated future "Import Fidelity" sprint (post-Sprint-4): underline (this ADR) plus highlight, track changes, comments, text boxes, SmartArt, floating images, nested tables, DrawingML — evaluate mammoth `styleMap` options and/or alternative libraries with real spike evidence before deciding, matching this project's established discipline

**Related:** ADR-0019, ADR-0020 (spike-before-decide precedent), Sprint 4 Typography Engine design review, `docs/TODO.md` (Import Fidelity backlog entry)

---

## ADR-0026: Two Import-Pipeline Bugs Fixed During Sprint 4 Commit 10 (Explicit Scope Exception)

**Status:** APPROVED
**Date:** 2026-07-17
**Decision:** Sprint 4 commit 10's real-file verification (`docs/REAL_EXPORT_CHECKLIST.md`, `typography-test.docx` through the running dev server) found two real bugs in `HtmlNormalizer`/`ASTBuilder` — both in the **import** pipeline, which ADR-0025 (this same sprint, one commit earlier) had just established as explicitly out of scope. Unlike ADR-0025's underline finding, the CTO reviewed these two and directed an immediate fix rather than document-and-defer, on the grounds that both are genuine content-fidelity losses, not formatting-only gaps.

**What was found and fixed:**
1. **Strikethrough (`<s>`/`<strike>`/`<del>`) silently downgraded to plain text.** `HtmlNormalizer.extractInlines()`'s tag-to-type mapping (`HtmlNormalizer.ts`) had cases for `strong/b`, `em/i`, `u`, `a`, but nothing for strikethrough — it fell through to the generic `else` branch and was stored as an untyped `'text'` inline. The word survived; the styling silently didn't. Fixed by adding a case mapping `s`/`strike`/`del` to `type: 'strikethrough'` (`Normalized.ts`'s `InlineNode.type` union gained the member).
2. **Whitespace between adjacent inline elements silently dropped, jamming words together.** `extractInlines()` called `.trim()` on every individual text node independently. A text node that IS a lone word-separating space between two tags (e.g. the `" "` between `</strong>` and `<em>`) trims to `''` and was dropped entirely; a text node with real leading/trailing space lost it too. Real effect on `typography-test.docx`: `"This paragraph mixes bold, italic..."` imported as `"This paragraph mixesbold,italic..."` — not a styling loss, corrupted, unprofessional-reading output in every exported format. Fixed by collapsing internal whitespace runs to a single space (`.replace(/\s+/g, ' ')`) without trimming the ends, so a node is only dropped when genuinely zero-length after collapsing.
3. **A closely related third bug surfaced while fixing the above:** `ASTBuilder.convertInlines()` filtered every plain `'text'`-type inline out of `Paragraph.inlines` entirely (`.filter((inline) => inline.type !== 'text')`), and its `switch` had a `default: return { type: 'bold', ... }` fallback — any inline type without an explicit case (which is exactly what the untyped strikethrough became, finding 1) was silently mislabeled as **bold**. Since `TypographyResolver.resolveRuns()` prefers `Block.inlines` over `Block.text` whenever `inlines.length > 0`, any real paragraph with at least one formatted run lost **all of its surrounding plain prose** in every renderer — not a spacing bug, missing sentences. Fixed by keeping `'text'` inlines in the mapped output and replacing the silent `default` with an exhaustive `never`-checked switch (compile error on an unhandled `InlineNode.type`, not a silent mislabel) — the same idiom already used elsewhere in this codebase (`BlockMapper.map()`, `LayoutEngine.estimateBlockHeight()`).

**Why fixed now instead of deferred like ADR-0025:** ADR-0025's underline finding is a pure styling loss — the word is intact, only its emphasis is gone, and a reader gets the correct sentence. All three findings here are **content-fidelity** losses: strikethrough is at least word-preserving like underline, but findings 2 and 3 actually corrupt or delete real text a reader would see. The CTO's triage line was specifically "is the logical content of the document still intact," not "does the import pipeline belong to Sprint 4."

**Evidence:** found and confirmed via `typography-test.docx` (the canonical fixture) through the real `ThemeEngine → TypographyResolver → LayoutEngine → Renderer` pipeline via `POST /api/manuscripts/export`, not a synthetic fixture or a renderer class called directly — same discipline as every other real bug this project has caught (ADR-0019 finding 6, ADR-0020 addendum).

**Consequences:**
- `Normalized.ts`, `HtmlNormalizer.ts`, `ASTBuilder.ts` all changed this sprint despite ADR-0025's "Sprint 4 does not touch the import pipeline" framing — that framing now reads as "does not touch the import pipeline **except for confirmed content-fidelity bugs found via real-file verification**," not an absolute rule
- New regression tests: `HtmlNormalizer.test.ts` (+4: strikethrough via `<s>`, strikethrough via `<strike>`/`<del>`, whitespace preservation, true-empty-node dropping), `ASTBuilder.test.ts` (+1, plus one existing test extended to cover strikethrough), plus real-fixture E2E regressions in `export.test.ts` (+3) and `ExportManuscriptUseCase.test.ts` (+1, PDF font-weight check needs `compress: false`, incompatible with the real HTTP route's production `compress: true` default — see that test's own comment)
- ADR-0025's underline finding is unaffected and still deferred — underline specifically is dropped by **mammoth itself** before HTML ever reaches `HtmlNormalizer` (a different, harder problem: fixing it means adding a `styleMap` option to the mammoth call, genuinely separate from these three `HtmlNormalizer`/`ASTBuilder`-internal bugs)
- Reinforces the "Import Fidelity" backlog item (`docs/TODO.md`) as still real and still needed for the remaining named gaps (highlight, track changes, comments, text boxes, SmartArt, floating images, nested tables, DrawingML) — this ADR closes 3 specific findings, not the whole category

**Related:** ADR-0025 (the precedent this deviates from, and why), ADR-0019/ADR-0020 (real-file verification discipline), `docs/REAL_EXPORT_CHECKLIST.md`, Sprint 4 commit 10

---

## ADR-0027: Validation Engine Is Read-Only

**Status:** APPROVED
**Date:** 2026-07-17
**Decision:** No component of the Validation Engine (`ValidationEngine`, `RuleRegistry`, or any individual `ValidationRule`) may ever mutate the `Book` AST it's given, directly or indirectly. Every rule is a pure function: `evaluate(context: ValidationContext): ValidationIssue[]`, reading from `ValidationContext` and returning findings, never touching the `Book`/`PaginatedBook` objects inside it. This is a hard architectural boundary, not a coding-style preference.

**Rationale:**
- **Separates diagnosis from correction, cleanly, by construction.** Validation Engine's whole purpose (`docs/architecture/diagrams/VALIDATION_ENGINE.md`, `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md`) is to say *what* is wrong with a manuscript. *Fixing* what's wrong is explicitly Editorial AI Engine's job (content-level suggestions, accept/reject by the author) or Professional Layout Engine's job (composition/layout decisions) — never Validation Engine's. Making this a type-level/architectural guarantee, not just a documented intention, prevents the boundary eroding one "helpful" auto-fix at a time across future sprints (the same kind of drift ADR-0026 found had already happened once, silently, in `ASTBuilder.convertInlines()`'s data-dropping bug).
- **Matches this project's existing purity precedent.** `TypographyResolver.resolve()`, `ThemeEngine.applyTheme()`, and `LayoutEngine.paginate()` are all already immutable, input-in/new-object-out Domain services (ADR-0001's "immutable updates only" rule) — Validation Engine doesn't even need to return a new `Book`, since it never had a reason to touch one in the first place. This ADR is a stricter version of an already-established pattern, not a new one.
- **Makes Editorial AI Engine's eventual design safer.** Once Editorial AI Engine (Sprint 6/7) exists and legitimately does need to propose content changes, the fact that everything upstream of it (Validation Engine) is provably read-only means any `Book` mutation found anywhere in the pipeline can be immediately attributed to Editorial AI Engine or Professional Layout Engine — never "was it Validation Engine?"

**Consequences:**
- Every `ValidationRule` implementation is testable by construction: a test can assert the input `Book`/`ValidationContext` is unchanged (deep-equality before/after `evaluate()`) as a standard part of that rule's test suite, not just its stated findings — `docs/architecture/diagrams/VALIDATION_ENGINE.md` §9 makes this an explicit Acceptance Criterion, not merely a code-review expectation.
- `ValidationEngine.validate()`'s return type (`ValidationReport`) contains only diagnostics (`issues`, `errors`, `warnings`, `score`) — it never returns a `Book`, unlike `ThemeEngine.applyTheme()`/`TypographyResolver.resolve()`/`LayoutEngine.paginate()`, which all return a new, richer version of what they were given. This is a deliberate, visible asymmetry with those three services, not an inconsistency — they *transform* the book toward its rendered form; Validation Engine only *observes* it.
- If a future sprint finds a genuine need for Validation Engine to suggest a fix (not just flag a problem), that capability belongs in Editorial AI Engine consuming Validation Engine's diagnostics (already the fixed dependency direction, `PLATFORM_ARCHITECTURE_ROADMAP.md` §3) — not a carve-out in this ADR.

**Related:** `docs/architecture/diagrams/VALIDATION_ENGINE.md` (Sprint 5 Design Review this ADR constrains), `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` (Level 1 — Validation Engine → Editorial AI Engine dependency), ADR-0001 (immutable updates only), ADR-0022 (`TypographyResolver`'s own immutability precedent)

---

## ADR-0028: Validation Engine Rule Design Principles

**Status:** APPROVED
**Date:** 2026-07-17
**Decision:** Three principles, each confirmed as official policy by the CTO during Sprint 5's implementation (commits 6, 7, and 9), formally recorded here so every future rule — in Validation Engine or any later engine built the same way — is designed against a written standard instead of re-deriving it commit by commit:

1. **A rule that always fires, or a rule that never fires, is not a real check — don't register either.** `RuleRegistry` must contain only rules that produce a genuine signal from the data available today. A pattern named in a Design Review but not implementable yet (no reliable underlying data, or a Domain-model gap) is documented — in the nearest rule's own doc comment, or here — never represented as a no-op stub rule that always returns `[]`. A no-op stub is indistinguishable from "checked, passes," which misrepresents real coverage exactly as much as a rule that always fires misrepresents a real defect.
2. **A rule only produces a diagnostic when it has reliable, explicitly modeled data to reason about.** Where the underlying signal doesn't yet reliably distinguish a real problem from normal structure (e.g. `QualityMetrics.widowsAndOrphans` currently equals `headingCount` by construction, so a threshold on it fires on every book with a heading, or none), the correct move is to document the limitation and not implement the check — not to invent a heuristic that produces plausible-looking but meaningless output, and not to duplicate another component's responsibility to manufacture the missing data.
3. **A rule is defined by its business intent, not by which fields it reads.** Two rules may legitimately read the same underlying data if they answer different questions — e.g. `MetadataRule`'s "is this manuscript editorially complete?" and `ComplianceRule`'s "is this manuscript ready for KDP/EPUB?" both read `metadata.isbn`, deliberately, because they mean different things by "missing." This is not duplicated responsibility; it's two independent, correctly-scoped concerns that happen to share an input. Rules are not required to partition the `Book`'s fields exclusively among themselves.

**Rationale:**
- All three were reached the same way: a real implementation question came up during a specific rule's commit (`MissingRequiredStyleRule`'s two unimplementable variants, commit 6; `TypographyRule`'s degenerate `widowsAndOrphans` threshold, commit 7; `ComplianceRule`'s overlap with `MetadataRule`/`StructuralRule`, commit 9), was surfaced rather than silently resolved either way, and the CTO's answer generalized cleanly beyond the one rule that prompted it. Recording them together, after the fact, rather than as three separate small ADRs, reflects that they're one coherent design philosophy for this engine, not three unrelated rulings.
- Matches this project's established pattern of formalizing a principle once it's been exercised for real, not speculatively in advance (ADR-0021's governance-decisions-bundled-together precedent; ADR-0026's "found via real implementation, not hypothesized").

**Consequences:**
- `MissingRequiredStyleRule.ts`, `TypographyRule.ts`, and `ComplianceRule.ts` already comply — their own doc comments already state the specific instance of each principle; this ADR is a record of the general policy those specific comments are instances of, not a mandate to rewrite them.
- A future rule that violates principle 1 or 2 should be treated as an implementation defect, not a style nit — it produces either false confidence (no-op stub) or alarm fatigue (always-fires check), both of which erode trust in every other rule's real findings.
- Principle 3 means code review for a new rule should never reject it purely for "this field is already read by rule X" — the right question is whether the new rule's business question is genuinely distinct, which `docs/architecture/diagrams/VALIDATION_ENGINE.md` §5's per-rule descriptions already model correctly (`MetadataRule` vs. `ComplianceRule`).
- Applies to Validation Engine now; expected to generalize to Editorial AI Engine's own rule/service composition (Sprint 6/7) and any later engine built as an orchestrator over independent, focused units — not re-derived from scratch there either.

**Related:** `docs/architecture/diagrams/VALIDATION_ENGINE.md` (the rules these principles were extracted from), ADR-0027 (the read-only boundary these principles operate within), `docs/releases/v0.6.0-alpha/SPRINT_5_FINAL_REPORT.md`

---

## ADR-0029: Professional Layout Engine — Extension Strategy, RunningHead, and LayoutSelector

**Status:** APPROVED
**Date:** 2026-07-17
**Decision:** Three related architectural choices for Sprint 6 (Professional Layout Engine), decided together since each depends on the others reading correctly:

1. **`LayoutEngine` is extended, not replaced by a new class.** Running headers, footers, page numbering, automatic Table of Contents generation, and `Chapter.openingPageStyle`/`startPageNumber` handling are all computed *during* pagination, from data pagination already produces — they are not a structurally different kind of transform the way inline-run resolution (`TypographyResolver`) was from visual-style resolution (`ThemeEngine`). `LayoutEngine.paginate()`'s public signature is unchanged; its internals gain these responsibilities.
2. **Header/footer presentation lives on `Theme`, as a `RunningHead` sub-structure** (`show`, `position`, `content`, `pageNumber`, `separator`, `uppercase`, `font`, `size`) — a theme already owns every other visual decision (fonts, colors, spacing, heading styles); running-head presentation is the same category of decision, not a page-geometry concern (`PageLayout`) or a new parallel type. Deliberately more detailed than a minimal on/off flag, specifically so future themes (Classic, Minimal, Academic, Novel, a Bible/Theology-oriented theme) can each present a genuinely different running head without any `LayoutEngine` change — only `ClassicTheme` populates it in Sprint 6; the shape is what makes later themes free to differ.
3. **`LayoutSelector` is introduced now as a port, with exactly one real implementation (`ManualLayoutSelector`), so a future automatic-selection heuristic (`AutomaticLayoutSelector`) can be added later without an API change.** No automatic *selection* logic (content-driven layout choice by language, page count, binding type, etc.) is built in Sprint 6 — `ManualLayoutSelector` only wraps today's existing caller-supplied-by-name behavior. `AutomaticLayoutSelector` is named and documented as the intended second implementation, not built.

**Rationale:**
- Decision 1 follows the same test Sprint 4's Design Review already applied when it *rejected* folding `TypographyResolver` into `ThemeEngine`: is this a genuinely different responsibility, or the same one going deeper? Inline-run resolution failed that test (genuinely different) and got its own class; header/footer/TOC/page-numbering pass the test the other way (same responsibility, more of it) and stay inside `LayoutEngine`.
- Decision 2's extra structural depth (8 fields, not a single toggle) is a direct CTO addition beyond the Design Review's own round-1 default (which had proposed a flatter `{ show, content, customText }' shape) — justified by a concrete near-term need (`docs/VISION.md` already names Classic/Modern/Academic/Novel/Minimal/Premium/Dark/Theology as planned themes) rather than speculative over-design.
- Decision 3 is deliberately distinguished from ADR-0028 principle 1 (don't register a rule that never fires): `LayoutSelector` is a **port** with one fully real, in-use adapter today (`ManualLayoutSelector`) — the same shape `Renderer<TOutput>` already has (one port, multiple adapters added over time, ADR-0012). `AutomaticLayoutSelector` is a *documented future adapter*, never registered or called, not a no-op instance sitting in a registry pretending to do something. The distinction is real: a no-op rule silently misrepresents coverage that's supposedly happening now; an unbuilt future adapter to a port claims nothing about the present.

**Consequences:**
- `PaginatedBook` and `Theme` both gain additive-only fields (`tableOfContents?`, `runningHead?`) — no existing consumer of either type breaks, matching the pattern ADR-0022/ADR-0027 already established for `StyledBook.blockTypography?` and `ValidationContext`.
- `ExportController`'s hardcoded `LetterPageLayout` constant is replaced by a `LayoutSelector.select()` call — the only caller-facing change in Sprint 6, and it preserves today's exact behavior through `ManualLayoutSelector`.
- The Sprint 6 Design Review (`docs/architecture/diagrams/PROFESSIONAL_LAYOUT_ENGINE.md`) also disclosed and resolved a real, pre-existing defect found while gathering evidence for this ADR: `PDFRenderer`'s running head was a hardcoded literal string (`'Book Publisher Studio'`), never the actual book's title — fixed as a direct consequence of Decision 2 (once `runningHead.content` is real, the hardcoded string is structurally impossible to keep), not filed as a separate ticket, matching the ADR-0023 precedent (a bug found and fixed as a refactor side effect, disclosed in the commit, not hidden).
- `AutomaticLayoutSelector` not existing yet is a real, accepted risk (same category as `ValidationContext`'s unused reserved fields, Sprint 5) — worth revisiting if no second `LayoutSelector` implementation ever materializes.
- Exact KDP/platform trim-size values are explicitly not decided by this ADR — they require a real spike against each platform's own published specs (ADR-0019/0020 precedent) before any new `PageLayout` preset ships.

**Related:** `docs/architecture/diagrams/PROFESSIONAL_LAYOUT_ENGINE.md` (the Sprint 6 Design Review this ADR formalizes), `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` (Level 1), ADR-0012 (`Renderer` port precedent for `LayoutSelector`), ADR-0013 (pagination-is-a-heuristic, EPUB-excluded precedent), ADR-0022/ADR-0027 (additive-field pattern), ADR-0023 (bug-fixed-as-refactor-side-effect precedent), ADR-0028 (the no-op-rule principle Decision 3 is deliberately distinguished from)

---

## ADR-0030: KDP/Platform Trim-Size Spike Findings (Sprint 6, Commit 0)

**Status:** APPROVED
**Date:** 2026-07-17
**Decision:** Resolves the one item ADR-0029 explicitly declined to decide ("exact KDP/platform trim-size values... require a real spike... before any new `PageLayout` preset ships"). Spike script: `backend/spikes/kdp-trim-size-spike.ts`, run via `npx tsx spikes/kdp-trim-size-spike.ts`, same throwaway/not-in-`src/`/not-test-covered discipline as `pdfkit-spike.ts` (ADR-0019) and `epub-library-spike.ts` (ADR-0020).

**Verified values (this sprint's `PageLayout` presets):**

| Preset | Source | Dimensions (pt) |
|---|---|---|
| `A4PageLayout` | PDFKit's own real runtime output (`new PDFDocument({size:'A4'}).page.width/height`) — the exact library `PDFRenderer` already depends on — cross-checked against an independent ISO 216 210mm×297mm→pt conversion; both agree exactly | 595.28 × 841.89 |
| `A5PageLayout` | Same method, ISO 216 148mm×210mm | 419.53 × 595.28 |
| `KDP5x8PageLayout` | kdp.amazon.com's own published paperback trim-size table (`/en_US/help/topic/GVBQ3CMEQW3W2VL6`, fetched directly, re-fetched a second time for consistency), 5in×8in at exact 72pt/inch | 360 × 576 |
| `KDP5_5x8_5PageLayout` | Same source, 5.5in×8.5in — KDP's own page names this "popular for fiction" | 396 × 612 |
| `KDP6x9PageLayout` | Same source, 6in×9in — KDP's own page names this "the most common trim size for books in the U.S." | 432 × 648 |

**Method (two independent checks, not a single trusted source, per ADR-0019/0020 discipline):**
1. A4/A5 verified by actually instantiating a real `PDFDocument` and reading its computed page size back — not copied from PDFKit's source or README — then cross-checked against an independently computed ISO 216 mm→pt conversion at the standard 72pt/25.4mm ratio. Both methods agreed exactly (595.28×841.89 and 419.53×595.28); the spike script throws if they ever disagree, so a future PDFKit upgrade that changes this table would fail loudly rather than silently drift.
2. KDP sizes fetched directly from KDP's own help page (not a third-party aggregator) and cross-checked against one independent secondary source (`kdpprintcover.com`), which agreed on 15 of 16 published sizes. The one disagreement (the 16th "large format" entry: KDP's own page returned `8.27"×11.69"` on two separate fetches; the secondary source listed `8.25"×11"` instead) is disclosed, not silently resolved — and moot for this ADR's actual decision, since neither disputed value was selected (see scope decision below).

**Scope decision — 3 of KDP's 16 published sizes selected, not all 16:** `5x8`, `5.5x8.5`, `6x9` — the three KDP's own page and independent guides repeatedly single out by name as the sizes an actual author picks (compact/mass-market fiction, popular fiction, and "the most common trim size for books in the U.S." respectively). The remaining 13 (including the disputed 16th) are recorded in the spike script's `KDP_ALL_SIZES` table for a future session to add on real demand, not guessed now — same restraint already applied to `RunningHead`'s fields (ADR-0029 Risk 5) and `ValidationContext`'s reserved fields (Sprint 5): real, disclosed scope-narrowing, not an oversight.

**Consequences:**
- `domain/layouts/` gains 5 new preset files (commit 1) built directly from this table — no further trim-size research needed for this sprint's acceptance criteria (A4 + one KDP size, per `PROFESSIONAL_LAYOUT_ENGINE.md` §9).
- `PageLayout.pageSize`'s union type gains `'kdp-5x8' | 'kdp-5.5x8.5' | 'kdp-6x9'` alongside the existing `'letter' | 'a4' | 'a5'` (commit 1) — an additive union extension, not a breaking change to any existing switch/lookup over the old 3-value union (each such site must add the new cases explicitly, not fall through silently).
- If a future session adds one of the other 13 sizes, it must re-run or extend this same spike rather than trust this ADR's table read in isolation years later — trim sizes "change sometimes" in the CTO's own words (`PROFESSIONAL_LAYOUT_ENGINE.md` §3).

**Related:** ADR-0029 (the design decision this spike unblocks), ADR-0019/ADR-0020 (spike-before-decide precedent and throwaway-script discipline), `backend/spikes/kdp-trim-size-spike.ts` (the spike itself)

---

## ADR-0031: Two Real Bugs Fixed During Sprint 6 Real-File Verification (Explicit Scope Exception)

**Status:** APPROVED
**Date:** 2026-07-17
**Decision:** Two real, would-have-shipped-broken bugs were found while implementing and real-file-verifying Sprint 6 (Professional Layout Engine), each fixed immediately as a direct, necessary consequence rather than deferred or filed separately — same precedent as ADR-0023 (bug found as a refactor side effect) and ADR-0026 (Sprint 4's real content-fidelity bugs found during commit 10's real-file pass).

**Bug 1 — Neither renderer actually consumed `PageLayout` (found before any real-file test, while reading `PDFRenderer.ts`/`DOCXRenderer.ts` to wire RunningHead support):** `LayoutEngine.paginate()` received a `layout` parameter, used it for pagination-height math, then discarded it — `PaginatedBook` never carried it forward. `PDFRenderer` hardcoded `PAGE_SIZE='LETTER'`/`MARGIN=72`; `DOCXRenderer`'s section had no `page` property at all, silently defaulting to `docx`'s own Letter-equivalent. Every `PageLayout` this sprint added (commit 1) — A4, A5, three KDP trim sizes — would have had **zero effect on actual rendered output**, since only `LetterPageLayout` had ever existed before Sprint 6, so this gap was invisible until multiple real `PageLayout` values existed to expose it. Fixed: `PaginatedBook.pageLayout` (additive) is now populated by `LayoutEngine.paginate()` from its own existing parameter; `PDFRenderer` reads `doc.page.margins`/`width`/`height` (set from `book.pageLayout` at construction) instead of hardcoded constants; `DOCXRenderer` sets a real `<w:pgSz>`/`<w:pgMar>` from `book.pageLayout`, converted pt→twips at the render boundary. Verified against real HTTP exports of `typography-test.docx`: A4 → real `/MediaBox [0 0 595.28 841.89]`; KDP 6×9 → real `/MediaBox [0 0 432 648]`; A5 DOCX → real `<w:pgSz w:w="8390" w:h="11905"/>`.

**Bug 2 — Automatic TOC generation produced a permanently empty TOC on every real import (found during commit 11's real-file verification against `large-book.docx`, 15 real chapters):** `LayoutEngine.buildTableOfContents()` (commit 10) originally walked only content-level `Heading` blocks, matching the Design Review's own wording ("walks all Heading blocks"). Reading `ASTBuilder.ts` and testing against the real fixture confirmed the design's assumption was wrong for real content: every real DOCX heading is structurally consumed into a `Chapter`/`Section` boundary (its `title` field) during import, never emitted as a content-level `Heading` block at all — the `convertHeading()` method that *can* produce one is only reachable for non-heading node types, since heading nodes are `continue`d past into `openChapter()`/`openSection()` instead. A synthetic test fixture (hand-built `Chapter`/`Heading` objects, not real import output) could never have caught this — it was found only by walking real imported content. Fixed: `buildTableOfContents()` now walks `Chapter`/`Section` titles as the primary, real-world path (`TOCEntry.headingId` repurposed to the owning content node's own id when no `Heading.id` exists, documented on the type in `Book.ts`), while still additionally including literal `Heading` blocks for hand-built `Book` models or a future import-pipeline change. An untitled preamble `Section` (ADR-0020 addendum) is skipped rather than producing an empty-title entry. Verified fixed against the same real fixture post-fix: 15 real chapters → 15 real TOC entries with correct resolved page numbers, TOC page actually renders in real PDF output.

**Rationale for fixing immediately rather than deferring (same test ADR-0026 already applied):** both bugs corrupt or nullify real functionality this sprint explicitly set out to build — deferring either would have shipped a sprint whose two most visible acceptance criteria ("A4/KDP trim size produces visibly correctly-sized output," "a populated, correctly-ordered table of contents with real page numbers") silently didn't work for any real user, discoverable only by someone independently re-doing the same real-file verification this sprint's own checklist already mandated.

**Consequences:**
- Confirms `docs/REAL_EXPORT_CHECKLIST.md`'s own stated purpose once again: both bugs were invisible to `npm test` (328/328 passing throughout) and to every synthetic-fixture unit test written before the real-file pass — caught only by exporting real manuscripts (`typography-test.docx`, `large-book.docx`) through the real pipeline and inspecting real output, exactly the failure mode the checklist exists to close.
- `Chapter.openingPageStyle`/`startPageNumber`/`Book.frontMatter.toc.generateAutomatically` remain **not reachable through the real HTTP import→export round trip** — `ASTBuilder` has no DOCX-native signal to populate any of the three from real content (same category of gap as Sprint 5's finding that `ASTBuilder.buildMetadata()` never sets `isbn`/`description`/`coverImage`). Verified instead via direct real-pipeline composition using real fixture content with only those three unreachable fields set programmatically — disclosed in `docs/REAL_EXPORT_CHECKLIST.md`'s Sprint 6 instance rather than silently skipped or claimed as full HTTP-round-trip coverage it isn't. A future "Import Fidelity" sprint (already scoped in `docs/TODO.md` for unrelated reasons) is the natural place to revisit whether any of these three ever gets a real DOCX-native signal to key off.

**Related:** ADR-0023 (bug-fixed-as-refactor-side-effect precedent), ADR-0026 (Sprint 4's real content-fidelity bugs, same discipline), ADR-0029 (the Sprint 6 design these bugs were found implementing), `docs/REAL_EXPORT_CHECKLIST.md` (the process that caught bug 2), `docs/TODO.md`'s Import Fidelity backlog item

---

## ADR-0032: Table of Contents Generation Follows Structural Document Hierarchy, Never Heading Blocks; Engineering Governance Principle

**Status:** APPROVED
**Date:** 2026-07-17
**Decision:** `LayoutEngine.buildTableOfContents()` MUST derive TOC entries from `Chapter.title` and `Section.title` — the structural hierarchy of the `Book` AST — as its primary and authoritative source. It MAY additionally include literal content-level `Heading` blocks (for hand-built `Book` models or a future import-pipeline change), but a future implementation MUST NOT treat `Heading` blocks as the primary or sole source of TOC entries.

**Rationale (formalizing ADR-0031 bug 2 as a standing rule, not just a retrospective bug report):** real DOCX imports never produce a content-level `Heading` block — `ASTBuilder` structurally consumes every real heading into a `Chapter`/`Section` boundary (its `title` field) during import; the `convertHeading()` method that *can* produce a `Heading` block is only reachable for node types other than `'heading'`, since heading nodes are always routed into `openChapter()`/`openSection()` instead. An implementation that walks only `Heading` blocks produces a **permanently empty TOC on every real import** — not a rare edge case, the universal case for anything derived from an uploaded `.docx`. This was caught once during Sprint 6 real-file verification (ADR-0031) precisely because a synthetic test fixture (hand-built `Chapter`/`Heading` objects matching the `Book` type's own shape) could not have exposed it — only real imported content could. This ADR exists so a future session, refactoring or extending `buildTableOfContents()` without re-reading ADR-0031's narrative, cannot silently reintroduce the same defect by "simplifying" back to a `Heading`-only walk.

**Consequences:**
- Any future change to `LayoutEngine.buildTableOfContents()` (or a successor) must preserve the `Chapter`/`Section`-title-primary behavior; a code review or test suite change that drops this without discussion should be treated as reintroducing a known, previously-shipped-and-fixed defect, not a stylistic simplification.
- `TOCEntry.headingId` continues to reference either a `Heading.id` (when one exists) or the owning `Chapter`/`Section`'s own id (the common, real-import case) — documented on the type itself in `Book.ts`, not just in this ADR.
- This is a Real Fixture Policy example case (see `docs/REAL_FIXTURE_POLICY.md`): any future TOC-adjacent change should be re-verified against a real multi-chapter fixture (`backend/verification/large-book.docx`), not synthetic fixtures alone, before being considered done.

---

**Additional decision, same ADR (CTO direction, 2026-07-17 — matches the ADR-0028 precedent of consolidating related rulings into one record rather than a new ADR per ruling): the Engineering Governance Principle.**

**Decision:** No feature may be considered done until it is validated **simultaneously** at three levels — Code, Product, and Documentation. All three are required together; passing two of three is not "done," it's "done except for the part most likely to hide a real bug" (see ADR-0031, where Code passed — 328/328 tests — while Product had never actually been checked).

- **Code:**
  - Build (`npm run build`, 0 TypeScript errors)
  - Lint (`npm run lint`, 0 errors)
  - Tests (`npm test`, 0 failing)
  - Coverage (`npm run test:coverage`, Domain >90% / global >80%, ADR-0006)
- **Product:**
  - Real fixtures (`docs/REAL_FIXTURE_POLICY.md`) — verified against actual manuscript content, not only hand-built test objects
  - `npm run verify-server` (real port, real route, real fixture — never assumed)
  - `npm run verify-real-export` (16/16 canonical-fixture checks)
- **Documentation:**
  - ADRs — a real architectural decision this work made has a record; an existing ADR it contradicts has been updated or superseded, not silently ignored
  - `docs/CURRENT_STATE.md` — reflects what actually shipped, with real verified numbers
  - `docs/TODO.md` — completed items moved, newly discovered items added
  - Sprint Report / Release Notes — written for anything reaching a sprint or release boundary

**Rationale:** this project's own six-sprint history is the evidence for the rule, not an abstraction invented ahead of it. Every real bug this project has shipped past its own test suite (ADR-0019 findings 6B/6C, ADR-0020 addendum, ADR-0031 bugs 1 and 2) passed Code-level validation completely — 100% synthetic-fixture coverage, 0 lint errors, full build — and was only caught because someone separately checked the Product level (a real manuscript through the real running server). Documentation gaps have their own independent history in this project (`docs/architecture/diagrams/BASELINE_v0.1.md`'s stale test-count claim, corrected by ADR-0010; the Sprint 6 PR/merge race that dropped a docs commit, caught only by `docs/RELEASE_CHECKLIST.md`'s mandatory re-verification-on-`main` step). Three independent kinds of gap, three independent kinds of check — collapsing them into "tests pass" has already produced real, shipped defects more than once.

**Consequences:**
- `docs/QUALITY_GATE.md`'s per-commit checklist and its 3 validation levels (Development/Product/Release) are the operational form of this principle — this ADR is the formal record of *why* those three levels are mandatory together, not just a convenient checklist shape.
- A PR or commit that reports "tests pass" without addressing Product and Documentation should be treated as incomplete, not merely light on process — matching how ADR-0031's own two bugs are now treated as defects this project takes seriously enough to name a permanent principle after, not isolated incidents.
- This principle is expected to outlive any single engine or sprint — it is a project-wide rule, not scoped to Professional Layout Engine or Table of Contents generation specifically, which is why it's recorded as a second decision in this ADR rather than folded into the first decision's own narrower rationale.

---

## ADR-0033: Repository Converted to an npm Workspace; `packages/shared-types` Introduced

**Status:** APPROVED — implemented, Sprint 7 commit 1
**Date:** 2026-07-18
**Decision:** The repository root gained a `package.json` with `"workspaces": ["backend", "frontend", "packages/*"]`, making `backend/`, `frontend/`, and the new `packages/shared-types/` real npm workspace members installed and locked from one root `package-lock.json`, instead of three independently-installed directories. `packages/shared-types` is a new, types-only workspace package (`package.json` name `shared-types`, zero runtime dependencies, `tsc`-built `dist/` with declarations) — currently a deliberate scaffold (`src/index.ts` exports nothing yet) rather than populated with real DTOs, per this sprint's own Commit 1 scope rule ("without introducing any product feature," CTO authorization, `docs/architecture/diagrams/SPRINT_7_KICKOFF.md`). Real DTO re-exports land in Commit 3.

This is the project's first monorepo-structural change — implements Design Review Decision 4 (`docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` §3), written as its own ADR per that Design Review's explicit instruction (§6 commit 1), not folded into a plain commit message.

**Rationale:**
- Resolves the Design Review's stated problem directly: `backend/` and `frontend/` would otherwise hand-duplicate the DTO shapes (`BookDTO`, `ImportReportDTO`, `ManuscriptOptionsDTO`, …) they both need — rejected as a real, avoidable duplication risk (CTO, verbatim: "absolutely avoid duplication").
- `packages/*` (a glob, not a single named entry) matches the Design Review's own architecture diagram (§4) and leaves room for a second shared package later without another root `package.json` edit.
- Scaffolding `shared-types` empty in Commit 1, rather than moving real DTOs in the same commit, keeps this commit's blast radius to *structure only* — exactly Risk 2 from the Design Review ("verified working... before any feature code depends on it") and the CTO's own Commit 1 constraint.

**What was actually built and verified (not assumed):**
- Root `package.json` (`workspaces`, no dependencies of its own) and root `package-lock.json` (single lockfile for all three workspaces, replacing `backend/package-lock.json` and `frontend/package-lock.json`, both deleted — a stale nested lockfile next to a workspace root lockfile is exactly what Next.js 16's own Turbopack build warned about on first build, confirmed empirically, not guessed: "Warning: Next.js inferred your workspace root, but it may not be correct... Detected additional lockfiles"; the warning disappeared once the redundant lockfiles were removed and the root lockfile re-verified via a full `npm ci`).
- `packages/shared-types/` — `package.json`, `tsconfig.json` (same compiler options as `backend/tsconfig.json`: ES2020, `bundler` resolution, declarations on), `eslint.config.mjs` (same flat-config shape as `backend/eslint.config.mjs`), `src/index.ts` (empty `export {}` placeholder).
- `.github/workflows/backend-ci.yml` updated — this was not optional cleanup, it was a real regression this commit would otherwise have introduced silently: CI ran `npm ci` with `working-directory: backend` against `cache-dependency-path: backend/package-lock.json`, both of which stopped existing the moment the repo became a single-lockfile workspace. Fixed to install once from the workspace root (`npm ci` against `package-lock.json`) and run backend's build/lint/test via `--workspace=backend`, matching the standard npm-workspace CI pattern. Trigger `paths` extended to include `packages/**`/`package.json`/`package-lock.json` so a future shared-types change (or another root dependency bump) actually re-runs backend CI instead of being silently skipped by the old `backend/**`-only filter.
- Verified clean, in this order, matching ADR-0032's Code-level gate: `backend/` — `npm run build` (0 errors), `npm run lint` (0 errors/warnings), `npm test` (328/328 passing, unchanged from Sprint 6), `npm run test:coverage` (92.78% global / 93.75% domain statements — identical to the pre-workspace baseline, confirming no behavioral drift). `frontend/` — `npm run lint` (0 errors/warnings), `npm run build` (compiles, typechecks, generates both static routes). `packages/shared-types` — `npm run build` and `npm run lint` both clean. Both `backend/`'s and `frontend/`'s `npm run dev` were also started directly (not assumed) and confirmed to boot (`✅ Server running on http://localhost:5099`, `✓ Ready` on `localhost:3000`) under the new structure. A full `npm ci` at the root (the exact command CI now runs) was executed as its own check, not just `npm install`, to confirm the committed lockfile is reproducible from a clean `node_modules` — all of the above re-verified afterward against the `npm ci`-produced install, not just the original `npm install`.

**Disclosed, non-blocking observation:** npm 11's `allow-scripts` supply-chain gate blocks the install-time scripts for `esbuild`, `sharp`, and `unrs-resolver` (transitive devDependencies of the frontend's Tailwind/ESLint toolchain) by default on a fresh install — `npm warn allow-scripts ... 3 packages have install scripts not yet covered`. Not approved or worked around in this commit: every verification above (including a full `npm ci` reinstall) passed with those scripts still blocked, so there is no evidence yet that any Sprint 7 command needs them. Flagged here rather than silently ignored in case a later commit (e.g. one that actually renders an uploaded image via `next/image`, which is what `sharp` accelerates) surfaces a real need — matching this project's "disclosed, not hidden" precedent (ADR-0031/ADR-0032), not a claim that this is fully resolved.

**Consequences:**
- A workspace member's own dependency version can now be hoisted to the root `node_modules` or kept locally nested by npm depending on version conflicts (observed: `frontend/`'s ESLint 9.x stays nested next to `backend/`'s/`shared-types/`'s hoisted ESLint 10.x) — this is normal npm-workspace behavior, not a misconfiguration, and requires no manual intervention.
- Any future workspace member (`packages/shared-types`'s eventual siblings, if any) is picked up automatically by the existing `packages/*` glob — no root `package.json` edit needed for that specific case.
- `backend/`'s and `frontend/`'s own `package.json` files are otherwise completely unchanged by this commit — no new dependency on `shared-types` yet (that starts Commit 3/4), no script changes, no behavioral change to either app.
- Future CI additions (a `frontend-ci.yml`, which does not exist yet — out of scope for this commit) should follow the same root-install-then-`--workspace=frontend` pattern established here, not reintroduce a scoped `working-directory`/nested-lockfile pattern.

**Addendum (2026-07-18, Sprint 7 commit 3, CTO direction) — `packages/shared-types` is transport contracts only, permanently:** confirmed and formalized while migrating the 9 pre-existing backend DTOs (`BookDTO`, `ChapterDTO`, `SectionDTO`, `BlockDTO` + its 8 block-variant types, `InlineDTO`, `MetadataDTO`, `ImportReportDTO`, `ImportResponseDTO`, `ValidationIssueDTO`, `QualityScoreDTO`) into this package. **Rule:** `packages/shared-types` may contain interfaces, types, and enums — nothing else. No Mappers, no Validators, no business rules, no Services, no runtime logic of any kind. If a future addition would do anything at runtime beyond being a plain data shape, it does not belong in this package, no matter how small or "just a helper" it looks. Stated as a single sentence in `packages/shared-types/README.md` itself (not just this ADR) so the constraint is visible the moment anyone opens the package, not only to someone who happens to read `docs/DECISIONS.md` first.

**Rationale:** a shared-types package that starts accumulating "just one small helper function" or "just this one validator, it's shared logic too" is exactly how a types-only boundary quietly turns into a second, competing home for business logic outside Domain — the same category of drift ADR-0027 was written to prevent for Validation Engine specifically (a hard architectural boundary stated once, up front, rather than eroded one "helpful" addition at a time). This package sits on the direct import path of both `backend/` and `frontend/`; unlike a Domain-internal drift, logic smuggled in here would be structurally invisible to Clean Architecture's own layering rules (`docs/DEVELOPER_HANDBOOK.md` rule 3 governs Presentation→Domain, not a cross-cutting workspace package neither layer definition anticipated) — worth a named, explicit rule precisely because the usual layering check wouldn't catch a violation on its own.

**Consequences (addendum):**
- The 9 migrated DTO files kept their exact pre-existing shapes and cross-file imports unchanged — this was a relocation, not a redesign; confirmed via `backend/`'s full test suite staying green (336/336) and a real import of `typography-test.docx` through the running dev server returning the identical `BookDTO`/`ImportReportDTO` shape as before the move.
- `backend/src/application/dto/*.ts` (all 10 files) are now thin re-export shims (`export type { X } from 'shared-types';`) rather than deleted outright — every existing consumer (`BlockMapper`, `BookMapper`, `ChapterMapper`, `SectionMapper`, `ImportManuscriptUseCase` and its test) keeps importing from `'../dto/...'` unmodified. A future commit may migrate those call sites to import `'shared-types'` directly and delete the shims, but that is a separate, larger-blast-radius change, not implied by this one.
- `docs/DEVELOPER_HANDBOOK.md` gained a short cross-reference to this rule alongside its existing layering rules, since a contributor deciding "does this belong in Domain or here" needs the answer in the same place they already look for that judgment call.

**Related:** `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` §3 Decision 4, §4 (architecture diagram), §5 Risk 2 (the risk this ADR's verification directly addresses), `docs/architecture/diagrams/SPRINT_7_KICKOFF.md` (Commit 1's scope constraint), ADR-0018 (`docx` package choice — same "verify before adopting" discipline, applied here to tooling rather than a library), ADR-0027 (the precedent for stating a hard boundary once, explicitly, rather than letting it erode), ADR-0032 (the Code-level gate this commit's verification satisfies)

**Related:** ADR-0031 (the real-file-verification finding this ADR formalizes into a standing rule), `docs/REAL_FIXTURE_POLICY.md` (the governance policy this decision is a worked example of), `docs/QUALITY_GATE.md` (the operational checklist this principle underlies), `docs/RELEASE_CHECKLIST.md` (the Documentation-level check that caught the Sprint 6 PR/merge race), ADR-0028 (precedent for consolidating multiple related rulings into one ADR when CTO-directed), `backend/src/domain/services/LayoutEngine.ts` (`buildTableOfContents()`)

---

## ADR-0034: Sprint 7 Governance Decisions

**Status:** APPROVED
**Date:** 2026-07-18
**Decision:** Consolidates four process-level rulings made during Sprint 7's implementation (Commits 7-12), each raised and resolved in the same session, following ADR-0021/ADR-0028's precedent of grouping related governance calls into one ADR rather than opening a separate number for each.

**1. Commit 9 split into 9a (preview) and 9b (export), at CTO direction.** The Design Review's own commit plan (`docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` §6) listed a single Commit 9 (`export + preview`). Before implementation began, the CTO requested it be delivered as two independently verified sub-steps instead, so that if a problem appeared in the export pipeline, its root cause (document generation vs. the download mechanism) would be immediately identifiable rather than conflated. Both sub-commits remain "Commit 9" in the sprint's own numbering — Commit 10 onward is unaffected, no renumbering cascaded. Implemented as `3ab8926` (9a) and `eac9fec` (9b), each independently build/lint/test-verified and each producing its own `docs/demo/VISIBLE_INCREMENTS.md` entry.

**2. A full PDF viewer (page navigation, zoom) is deliberately deferred, not built.** Raised as CTO UI feedback during the Commit 8/9/10 sessions. The current `<embed type="application/pdf">` (Commit 9a) has no programmatic page or zoom API — a real page-navigation/zoom viewer needs a client-side PDF rendering library (e.g. pdf.js), which is a new runtime dependency. Per this project's own rule (`docs/CLAUDE.md` non-negotiable 4, `docs/DESIGN_REVIEW_PROCESS.md`), a new dependency requires a Design Review before implementation, not a quiet addition inside a UI-polish commit. Not built in Commit 11; recorded in `docs/TODO.md`'s backlog as a real, named future item, not silently dropped.

**3. A licensing/monetization-aware architecture (trial/Standard/Pro tiers, feature-flag components) is deliberately deferred, not built.** Raised as a CTO strategic proposal alongside Commit 7. Conflicts directly with two already-locked constraints: Sprint 7 Design Review Decision 3 (minimal-for-demo scope, not `docs/VISION.md`'s full UI ambition) and the pre-existing `docs/TODO.md` backlog entry stating licensing is explicitly deferred pending a persistence/auth layer that doesn't exist yet. Flagged before any code was written rather than silently implemented or silently ignored; recommended as its own future Design Review, timing left to the CTO. No license-gating code exists anywhere in the codebase as of this ADR.

**4. Commit 10 Verification 6 (large-document stress test) used a real `backend/uploads/` file as a disclosed, one-off exception to `docs/DEVELOPMENT_WORKFLOW.md`'s "never search `backend/uploads/` for a DOCX to use" rule.** That rule targets keeping the *canonical* regression fixture set (`backend/verification/`) deterministic and reproducible for routine real-file verification — it does not contemplate a one-time, CTO-requested scale/timing diagnostic for which no canonical fixture of the required size exists. `Faith_Alone_Professional_KDP_Kobo.docx` (2.93MB, already present in `backend/uploads/` from earlier, unrelated real-world testing) was used exactly once, for measurement only — not adopted as a new canonical fixture, not copied into `backend/verification/`, not committed anywhere. Real results (39,913 words, 17 chapters, 134-page import estimate, sub-second import/export timing) are recorded in `docs/demo/VISIBLE_INCREMENTS.md`'s Commit 10 entry. The honest gap — no real fixture at the requested 400-500 pages exists — was disclosed rather than closed by fabricating one, per `docs/REAL_FIXTURE_POLICY.md`'s standing rule against synthetic verification data.

**Rationale (why grouped into one ADR):** none of these four decisions individually rises to the weight of a new architectural pattern requiring its own numbered record and Design Review citation elsewhere in the codebase — each is a scope, sequencing, or verification-methodology call made once, disclosed once, and not expected to recur in this form. Recording them together, at Sprint 7's closure, keeps the decision trail complete without inflating the ADR sequence with four single-paragraph entries that would otherwise never be cross-referenced individually.

**Consequences:**
- A future contributor asking "why is Commit 9 actually two commits in git history" or "why does `ExportPanel` exist as a separate file from `PreviewPanel`" has a citable answer (Decision 1) instead of needing to reconstruct CTO intent from commit messages alone.
- The PDF-viewer and licensing deferrals (Decisions 2-3) are now findable from `docs/ADR_INDEX.md`'s search path, not only from `docs/TODO.md`'s backlog prose — a future Design Review scoping either feature has a fixed starting citation.
- Decision 4 sets precedent: a future one-off scale/timing diagnostic may use a real `backend/uploads/` file under the same narrow conditions (measurement only, never adopted as a fixture, disclosed in the same commit's `VISIBLE_INCREMENTS.md` entry) without each future instance re-litigating whether `DEVELOPMENT_WORKFLOW.md`'s rule applies — it does, and this is the documented shape of the narrow exception to it.

**Related:** ADR-0021 (post-Sprint-3 governance decisions, the precedent this ADR's grouping follows), ADR-0028 (Validation Engine rule-design principles, the precedent for consolidating multiple CTO-directed rulings into one ADR), ADR-0033 (the npm workspace / `packages/shared-types` decision, Sprint 7's other ADR), `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` (Decision 3, the minimal-for-demo scope Decision 3 above cites), `docs/DEVELOPMENT_WORKFLOW.md` ("Which fixture to use," the rule Decision 4 narrowly departs from), `docs/REAL_FIXTURE_POLICY.md`, `docs/TODO.md` (the backlog entries for the PDF viewer and licensing proposal), `docs/demo/VISIBLE_INCREMENTS.md` (Commits 9a, 9b, and 10's entries, the real evidence behind Decisions 1 and 4), `docs/releases/v0.8.0-alpha/SPRINT_7_FINAL_REPORT.md`

---

## ADR-0035: KDP Publishing-Requirements Spike Findings (Sprint 8, Commit 0)

**Status:** APPROVED
**Date:** 2026-07-18
**Decision:** Resolves the one item Decision 2 of `docs/architecture/diagrams/PUBLISHING_ENGINE.md` explicitly declined to decide ("a real Commit-0 spike... verifying KDP's actual current metadata requirements, cover image spec, and file-naming/submission rules is required before any `KDPTarget`/`KDPRuleSet` code is written"). Spike script: `backend/spikes/kdp-publishing-spike.ts`, run via `npx tsx spikes/kdp-publishing-spike.ts`, same throwaway/not-in-`src/`/not-test-covered discipline as `pdfkit-spike.ts` (ADR-0019), `epub-library-spike.ts` (ADR-0020), and `kdp-trim-size-spike.ts` (ADR-0030, this spike's direct sibling for the same platform).

**Method:** Not a runtime API/library check — KDP has no submission API to query, and Decision 5 (locked, no reservations) forbids creating an account or calling Amazon this sprint regardless. The real external behavior verified here is KDP's own *documented policy*: five `kdp.amazon.com` help pages fetched directly (Paperback Submission Guidelines `G201857950`, Create a Paperback Cover `G201953020`, Set Trim Size/Bleed/Margins `GVBQ3CMEQW3W2VL6`, Metadata Guidelines `G201097560`, Cover Image Guidelines `G6GTK3T3NUHKLEFX`), not summarized by a third party first. Bleed (0.125in) and the cover-width formula were independently confirmed on two of the five pages and agreed exactly — no discrepancy to disclose this time, unlike `kdp-trim-size-spike.ts`'s real 16th-size disagreement.

**Verified values:**

| Area | Finding |
|---|---|
| Interior manuscript formats | PDF/DOC/DOCX/RTF/HTML/TXT without bleed; PDF only if any content bleeds to the edge |
| Interior bleed | 0.125in (3.2mm) top/bottom/outer edge; bleed PDFs sized +0.25in height / +0.125in width over trim size |
| Interior margins | Gutter 0.375in–0.875in scaling with page count (24–828 pages, 5 tiers); outside margin ≥0.25in (no bleed) / ≥0.375in (bleed) |
| Interior resolution | 300 DPI minimum, 600 DPI recommended max (600MB file-size cap) |
| Page count bounds | 24 minimum, up to 828 maximum (upper bound depends on ink/paper/trim combination) |
| File naming | No emoji or unsupported special characters in cover/interior file names |
| Paperback cover | Single PDF (front+spine+back as one image), CMYK, 300 DPI minimum, 650MB max (40MB recommended) — dimensions **computed**, not fixed |
| Spine width formula | `pageCount × factor`, factor = 0.002252in (B&W white / standard color), 0.0025in (B&W cream), 0.002347in (premium color); no spine text printed below 79 pages |
| eBook cover (different artifact) | JPEG, RGB (not CMYK), fixed ~2560×1600px, 300 DPI minimum, 5MB max — recorded for disambiguation, not used by this sprint's paperback-only scope (Decision 2) |
| Metadata, mapped to real `BookMetadata` | `title`/`author`/`isbn`/`language` required; `description`/`keywords` recommended, not required |
| Metadata gap found | KDP also requires `Categories` (≤3), `Primary Audience` (explicit-content Y/N), and `Primary Marketplace` at submission — none has a `BookMetadata` field today; out of scope to add this sprint (Decision 5), recorded so a future session doesn't rediscover it from scratch |

**A real shape correction this spike surfaces:** `PUBLISHING_ENGINE.md` §5's provisional `KDPRuleSet.coverSpec: {minWidthPx, minHeightPx, minDpi}` assumed a fixed-pixel cover, matching the eBook model. The real paperback cover has no fixed pixel size — width and height are computed from trim size, page count, and paper type via the spine formula above. §5 is corrected to define a `PaperbackCoverSpec` shape instead of forcing a real value into the wrong field, following this project's own "confirmed, not guessed" discipline rather than shipping a plausible-looking but wrong interface.

**Consequences:**
- `domain/publishing/KDPRuleData` (Commit 3) is built directly from this table — no further KDP requirements research needed for Sprint 8's acceptance criteria. (Renamed from the `KDPRuleSet` name used when this ADR was first written — ADR-0036/`PUBLISHING_ENGINE.md` Decision 7, same day, locked the data as inert and reachable only through a new `KDPRuleProvider`/`ValidationRuleProvider` port, not referenced directly by `SubmissionValidator`.)
- `PublishingIssue`-producing `PostRenderValidationRule`s (Commit 3) can cite exact real thresholds (e.g. "gutter margin below 0.5in for a 200-page book") instead of placeholder logic.
- The metadata gap (Categories/Primary Audience/Primary Marketplace) is not blocking Sprint 8 (`PublishingReport` can flag "not verifiable — no BookMetadata field" as a `WARNING`, not silently skip the check) — recorded here so a future `BookMetadata` extension has a citable originating source, and formalized as a per-platform traceability table in `PUBLISHING_ENGINE.md`'s Decision 7 section.
- If KDP's own published spec changes later, per Risk 5 (`PUBLISHING_ENGINE.md` §6), this same spike script is re-run rather than trusting this ADR's table read in isolation years later.

**Related:** `PUBLISHING_ENGINE.md` Decision 2 (the design decision this spike unblocks) and Decision 6/7/Risk 5 (`KDPRuleData` reached only through the `ValidationRuleProvider` port), ADR-0019/ADR-0020/ADR-0030 (spike-before-decide precedent), ADR-0036 (the `RuleProvider` governance rule this ADR's findings are wrapped behind), `backend/spikes/kdp-publishing-spike.ts` (the spike itself)

---

## ADR-0036: Platform-Specific Publishing Rules Must Be Encapsulated Behind a `RuleProvider` Port (Engineering Governance Principle)

**Status:** APPROVED
**Date:** 2026-07-18
**Decision:** Reviewing ADR-0035's findings, the CTO caught a real remaining architectural seam before Commit 1 could start: `PUBLISHING_ENGINE.md`'s Decision 6 had already isolated KDP's requirements as *data* (`KDPRuleSet`), but `SubmissionValidator` still referenced that data's concrete name directly — an implicit dependency on "which platform" that would have forced a code change to `SubmissionValidator` the moment a second target (Kobo, Apple Books, Lulu, IngramSpark) was added, exactly the drift Decision 6 was written to prevent one layer up. This ADR locks the fix as a standing rule for the whole engine, not a one-sprint choice, matching the engineering-governance-principle precedent set by ADR-0032 (TOC generation must follow structural hierarchy, never `Heading` blocks).

**The rule:** Platform-specific publishing requirements (KDP today; Kobo, Apple Books, Lulu, IngramSpark later) must never be hardcoded as conditionals or by-name data references inside the Publishing Engine's orchestration classes (`PublishingUseCase`, `SubmissionValidator`, `Packaging`, `KDPTarget`'s siblings). They must be encapsulated behind a `ValidationRuleProvider` port — one method, `getRules(): PostRenderValidationRule[]` — with exactly one concrete provider class per platform (`KDPRuleProvider` this sprint; `KoboRuleProvider`/`AppleBooksRuleProvider`/`LuluRuleProvider`/`IngramRuleProvider` future). No `if (platform === 'kdp')` branch may appear anywhere in the engine's own code — the CTO's own verbatim requirement.

**Rationale:** Mirrors the exact reasoning this project has already applied to every other cross-cutting concern with more than one plausible real implementation — `Renderer<TOutput>` (PDF/DOCX/EPUB, ADR-0012), `LayoutSelector` (A4/A5/KDP trims, ADR-0029/0030), and now `PublishingTarget` itself (Decision 1). A `RuleProvider` port is the same Dependency Inversion pattern one layer deeper: `SubmissionValidator` depends on the abstraction, never the concrete platform, so its own code never needs to change as platforms are added — only a new provider class is written, and only `KDPTarget`'s (or `KoboTarget`'s, etc.) wiring changes to inject it.

**Consequences:**
- The `KDPRuleSet` interface named in `PUBLISHING_ENGINE.md` §5's initial draft (not yet written to `src/` — Commit 3 is still pending) is renamed `KDPRuleData` (inert data) and is joined by a new `ValidationRuleProvider` Domain port and `KDPRuleProvider` Infrastructure class — see `PUBLISHING_ENGINE.md` §5 for the exact shapes to be implemented in Commit 3.
- `SubmissionValidator`'s constructor signature takes a `ValidationRuleProvider`, never a platform name or a concrete rule-data type — enforced by the type system, not by code-review discipline alone.
- Sprint 8's Acceptance Criteria (`PUBLISHING_ENGINE.md` §8) already required the architecture to extend to Kobo/Apple Books/Lulu "without modifying any public interface" for `PublishingTarget` — this ADR extends that same guarantee one layer down, to `ValidationRuleProvider`.
- A future contributor adding `KoboTarget` writes exactly one new class (`KoboRuleProvider implements ValidationRuleProvider`) and wires it into `KoboTarget`'s constructor — `SubmissionValidator`, `PublishingUseCase`, and `PublishingReport` are untouched, verifiable by the fact that none of them import any platform-specific type today.

**Related:** ADR-0035 (the KDP-specific findings this rule now wraps behind a port), ADR-0032 (the engineering-governance-principle precedent this ADR's format follows), ADR-0012 (`Renderer` port-vs-class precedent), ADR-0029/ADR-0030 (`LayoutSelector` port precedent), `PUBLISHING_ENGINE.md` Decision 6/Decision 7 (where this rule is locked at the design-review level, with the full component diagram), `docs/DEVELOPER_HANDBOOK.md` (the general port-vs-class judgment rule this ADR applies to a new case)

---

## ADR-0037: Publishing Engine Domain Objects Are Platform-Agnostic; Platforms Depend on the Engine, Never the Inverse (Engineering Governance Principle)

**Status:** APPROVED
**Date:** 2026-07-18
**Decision:** Reviewing Commit 1 (`PublishingTarget` + `PublishingReport`/`PublishingIssue`), the CTO generalized ADR-0036's rule-provider-specific pattern into a standing principle covering every object the Publishing Engine defines, applied immediately as a condition on Commit 2's `PublishingBundle`. Same engineering-governance-principle format as ADR-0032 and ADR-0036.

**The rule (CTO's verbatim principle):** *"Les objets du Publishing Engine ne doivent jamais dépendre d'une plateforme spécifique. Les plateformes (KDP, Kobo, Apple Books, etc.) dépendent du Publishing Engine, jamais l'inverse."* No Domain object the engine defines — `PublishingTarget`, `PublishingReport`, `PublishingBundle`, `ValidationRuleProvider`, or any future addition — may reference a platform name, a platform-specific field, or a platform-specific assumption. Platform implementations (`KDPTarget`, `KDPRuleProvider`, and later `KoboTarget`/`AppleBooksTarget`/`LuluTarget`/`IngramTarget`) are always the dependent side.

**Rationale:** This is ADR-0036's Dependency Inversion pattern stated once, generally, instead of re-derived per object. ADR-0036 already applied it narrowly to rule injection (`ValidationRuleProvider`); Decision 1/ADR predecessors already applied it to the target itself (`PublishingTarget`); this ADR closes the gap for everything else the engine will define — starting with Commit 2's `PublishingBundle`, which the CTO named explicitly as this rule's first real test: `{manuscript, cover, metadata, assets, manifest}`, with zero KDP-specific fields or assumptions.

**Consequences:**
- `PublishingBundle` (Commit 2) is built to this rule from its first line of code — `manuscript` stays typed as `RenderedOutputs` (every rendered format available), not a single pre-chosen format, because choosing which format a given platform needs is that platform's decision, not `Packaging`'s.
- Every future Commit adding a new engine-level type (a hypothetical `PublishingSubmission`, `PublishingSchedule`, etc.) is reviewed against this rule before being written, not only `PublishingBundle`.
- Combined with ADR-0036, the full dependency direction for Sprint 8 is: `KDPTarget` → `PublishingTarget` (implements), `KDPTarget` → `PublishingBundle` (uses), `KDPRuleProvider` → `ValidationRuleProvider` (implements) — never the reverse arrow, in either case.

**Related:** ADR-0036 (the rule-provider-specific instance this ADR generalizes), ADR-0032 (the engineering-governance-principle precedent both follow), `PUBLISHING_ENGINE.md` Decision 8 (where this rule is locked at the design-review level) and Decision 1/6/7 (the prior instances of the same dependency direction this ADR states generally)

---

## ADR-0038: Publishing Engine Cannot See `LayoutEngine`'s Real Pagination Metrics — Deferred Beyond Sprint 8, Question Framed Not Answered

**Status:** ✅ **RESOLVED by ADR-0042** (2026-07-18). The original status is preserved below rather than rewritten, per ADR-0010's annotate-never-rewrite precedent — this ADR did its job by framing a question well enough that a later review could answer it, and that history is worth reading.

> **Resolution note (2026-07-18):** `RENDER_METRICS.md` answered the question below and ADR-0042 records the decision. One correction to this ADR's own framing: it describes a single blocked consumer (`PageCountRule`), but there are **three** — KDP's spine width and its gutter margins are also functions of page count. The third turned out to be a live product defect in its own right, now ADR-0043.

*Original status:* OPEN — deferred by explicit CTO decision (2026-07-18). **This ADR deliberately does not decide the answer.** It records a confirmed gap and frames the question a future Design Review must resolve.
**Date:** 2026-07-18
**Decision:** Do **not** change Publishing Engine behavior in Sprint 8 to close this gap. Document it, leave `PageCountRule` reporting `PAGE_COUNT_UNKNOWN` when the information genuinely is not available, and open this record for a dedicated future decision.

**The confirmed gap (found by Commit 7's real-fixture verification, not by inspection or assumption):** `PageCountRule` reports `PAGE_COUNT_UNKNOWN` on **every** real fixture — all 4 canonical fixtures including `large-book.docx`. Traced by reading the actual code:

- `Book.pageCount` is populated only by `BookMetricsCalculator`, which runs only on the **import** path (`ImportManuscriptUseCase`). It never runs on the export/publish path.
- The **real** page count does exist inside the publish pipeline: `LayoutEngine.paginate()` produces a `PaginatedBook` carrying real `pages`, which `PublishingUseCase` computes and renders from — then discards, because `PublishingTarget.prepare(book, renderedOutputs)` receives only the `Book` and the rendered bytes.
- Note the two are not even the same quantity: `BookMetricsCalculator.pageCount` is an *estimate* derived from word count (`estimatePageCount(wordCount)`), whereas `PaginatedBook.pages` is the *real* paginated result. Any future fix must decide which one Publishing Engine should actually validate against — they will not agree.

`PageCountRule` itself is correct and needs no change: it honestly reports "unknown" rather than guessing. It is simply being fed less than the pipeline already knows.

**Why this was not fixed in Sprint 8 (CTO's own reasoning, verbatim in substance):** Sprint 8's objective was to *create a Publishing Engine*, not to *modify the rendering pipeline*. Closing this gap would mean changing the data passed to `PublishingTarget.prepare(...)` — modifying an internal API, enriching the transported objects, and propagating a new value across several layers. That is not a small correction; it is a **contract evolution**, and it warrants its own architectural decision rather than being absorbed silently into a validation-only commit.

**The question a future Design Review must answer (posed here, deliberately unanswered):**
> How should `LayoutEngine`'s computed metrics be exposed to the Publishing Engine without breaking the existing separation of responsibilities?

Constraints any answer must respect, all already locked by earlier decisions in this sprint:
- Decision 8 / ADR-0037 — every Publishing Engine object stays platform-agnostic; platforms depend on the engine, never the inverse.
- Decision 1's API-evolution note — `prepare()` is Sprint 8's only operation, not necessarily `PublishingTarget`'s final API; a widened signature is an anticipated, planned evolution, not a surprise break.
- Decision 6's OWNS/NEVER boundaries — whatever carries the metrics must not turn `Packaging` into a validator or `SubmissionValidator` into a packager.

Candidate shapes worth weighing (**none endorsed here** — listed so a future session starts from a real option set rather than a blank page): widening `RenderedOutputs` to carry render-time metrics alongside the bytes; adding a metrics field to `PostRenderValidationContext`; passing `PaginatedBook` (or a narrow projection of it) into `prepare()`; or having `PublishingUseCase` enrich the `Book` with real pagination data before delegating.

**Consequences:**
- `PageCountRule` ships in Sprint 8 permanently reporting `PAGE_COUNT_UNKNOWN` (a `WARNING`, never an `ERROR`, so it never blocks a report) against real manuscripts. Real, disclosed, and expected — not a defect to be surprised by later.
- `PUBLISHING_ENGINE.md` §6 Risk 6 records the same gap at the design-review level; this ADR is its citable, permanent counterpart.
- A future contributor asking "why does the page-count check never pass?" has a complete answer — including the estimate-vs-real distinction — instead of rediscovering it from scratch.
- Whoever picks this up must run real-fixture verification again afterward (`npm run verify-real-publish`), since this gap was invisible to 386 passing tests and was found only by a real round trip — the fifth instance of this project's recurring pattern (ADR-0019, ADR-0020, ADR-0031, ADR-0032).

**Related:** `PUBLISHING_ENGINE.md` §6 Risk 6 (the design-review-level record) and Decision 1's API-evolution note (the anticipated-evolution framing this deferral relies on), ADR-0037 (the platform-agnostic constraint any answer must respect), ADR-0031/ADR-0032 (prior real bugs found only by real-file verification, the same discipline that surfaced this), `docs/REAL_FIXTURE_POLICY.md` (the policy whose Publishing-Engine scope mandated the pass that found this), `backend/scripts/verify-real-publish.ts` (the verification that surfaced it)
---

## ADR-0039: Roadmap Reprioritized — Product Completeness Before AI (Strategic Decision)

**Status:** APPROVED
**Date:** 2026-07-18
**Decision:** Editorial AI Engine and Plugin System are moved from "next up" to the **strategic backlog (Sprint 18+ / Sprint 19+)**. Sprints 9–17 are reassigned to completing Book Publisher Studio as a real, usable, stable product. Decided by the CTO immediately after reviewing `EDITORIAL_AI_ENGINE.md`'s round-1 Design Review.

**CTO's rationale (verbatim reasoning):** the Editorial AI Engine is a very high-value feature, but not indispensable for shipping a usable product. Waiting until real users are actually using Book Publisher Studio allows the AI to be designed from **observed needs rather than assumed ones**. The Plugin System follows the same logic: it only has value once several AI engines or extensions actually need integrating.

**The reordered roadmap:**

| Sprint | Milestone | Rationale |
|---|---|---|
| 9 | **UI Foundation** | Design System, components, themes, typography, colors, icons, grid, responsive, accessibility, navigation. **No new business logic.** |
| 10 | **UX & Workflow** | How an editor actually works, end to end — not how it looks. Observable with real editors. |
| 11 | **Workspace & Project Management** | Projects, recent manuscripts, favorites, history, search. Today the user works on *a file*; tomorrow on *a library*. |
| 12 | **Autosave & Recovery** | Guarantee no work is ever lost — before there are many users, not after. |
| 13 | **Performance & Scalability** | Large DOCX/PDF, memory, speed, pagination, rendering. Where the real problems usually surface. |
| 14 | **Collaboration** | Comments, sharing, review, history, version comparison. |
| 15 | **Cloud Sync** | Only after the local version is stable. |
| 16 | **Licensing** | Activation, licences, subscriptions, Community/Pro editions. |
| 17 | **Telemetry & Observability** | Non-personal indicators — import time, error frequency, most-used features, performance — to direct future work with evidence. |
| 18+ | **Editorial AI Engine** | By then: real users, real manuscripts, real feedback, real friction points. |
| 19+ | **Plugin System** | Valuable once multiple engines/extensions need integrating. |

**UI and UX are deliberately separate sprints, not one** (CTO direction). UI (Sprint 9) answers *"what does the software look like?"* — visual identity, components, colour, graphical consistency, the Design System. UX (Sprint 10) answers *"is the software pleasant and efficient to use?"* — user journey, click count, comprehensibility of actions, error messages, guidance, fluidity. One can have a beautiful UI with poor UX, or excellent UX with an unpolished interface; separating them lets each be designed against its own objective.

**A real architectural prerequisite this reordering surfaces, flagged rather than discovered mid-sprint:** **6 of the 9 newly-scheduled sprints require a persistence layer that does not exist and is currently forbidden.** Sprint 7 Decision 2 (approved, and held without exception through Sprint 8) states: *"No session, no server-side manuscript cache — every UI action is its own complete round trip,"* and `grep`-confirmed there is no database, repository, session, or cache anywhere in `backend/src/`. Workspace (11), Autosave (12), Collaboration (14), Cloud Sync (15), Licensing (16), and Telemetry (17) each fundamentally require remembering something between requests. **Sprints 9 and 10 do not** — they are frontend-only and fully compatible with the stateless backend as it stands, which is a further argument for their position at the front of the queue. Amending Decision 2 is therefore a prerequisite for Sprint 11, and warrants its own Design Review at that time rather than being treated as an implementation detail.

**Consequences:**
- `docs/VERSIONS.md`'s version-to-milestone mapping is rewritten from `v0.10.0-alpha` onward: the previously-planned Plugin System / AI Features / Licensing & Cloud rows are superseded by the sequence above. Same renumbering discipline already applied four times (v0.6.0, v0.7.0, v0.8.0, v0.9.0) — annotated, never deleted.
- `EDITORIAL_AI_ENGINE.md` is **deferred, not rejected, and not withdrawn.** Its round-1 draft stays exactly as written: the 6 open questions, the real code evidence (zero AI references, zero outbound HTTP, no secret management), and the accept/reject-versus-stateless tension all remain valid and will save the Sprint-18 session that work. Its status is amended to record the deferral and why.
- `PLATFORM_ARCHITECTURE_ROADMAP.md` §2.2/§2.3 keep their architectural content unchanged — only their scheduling expectation moves. §2.3's existing "Not this sprint or the next" line becomes an understatement rather than an error.
- The Level 1 map gains no new engines: Sprints 9–17 are product/platform work, not new Domain engines, so no new Level 1 §2 section is required. Each still needs its own Level 2 Design Review before implementation, per the unchanged two-gate discipline.

**Related:** `docs/architecture/diagrams/EDITORIAL_AI_ENGINE.md` (the round-1 review this decision defers), `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` Decision 2 (the stateless constraint 6 of these sprints will need amended), `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` §2.2/§2.3, `docs/VERSIONS.md` (the mapping this decision rewrites), `docs/DESIGN_REVIEW_PROCESS.md` (each new sprint still needs its own Level 2 review)

---

## ADR-0040: Sprint 9 Plan Corrections — Inline Tests, Playwright Adoption, and Two Documentation Fixes

**Status:** APPROVED
**Date:** 2026-07-18
**Decision:** Four corrections to the Sprint 9 UI Foundation plan and its surrounding documentation, made after an evidence-gathering audit and before any Sprint 9 code exists. Records the reasoning, not just the rulings, per this project's standing discipline.

### Correction 1 — There is no standalone test commit; the harness lands at Commit 2 and every commit after ships its own tests

**Supersedes both the round-1 commit plan (tests at Commit 8) and the round-2 revision (a single test commit at Commit 2).** Neither is right, and the reason is a fact about this repository rather than a preference.

**Evidence:** every Sprint 8 implementation commit shipped its own tests inline — `86e0116` (1 test file), `5abd067` (6), `99f0df7` (1), `68be289` (1), `9133931` (2). **This project has never once had a standalone unit-test commit.** Tests have always been part of the commit that created the thing they test.

**Why the round-2 revision cannot work as literally stated:** a "frontend test suite" commit at position 2 would have almost nothing to test — the `ui/` primitives it would cover do not exist until Commit 3. It would either be an empty harness mislabelled as a suite, or it would force primitives to be written early, collapsing Commits 2 and 3 together.

**The correction keeps the round-2 *intent* — a safety net before the large refactor — while making it buildable:**
- **Commit 2** establishes the **harness only**: Vitest + Testing Library configuration, a `test` script in `frontend/package.json`, and one smoke test proving the runner actually executes. Small, and genuinely appearance-neutral.
- **Commits 3 onward each ship their own tests**, exactly as all 8 prior sprints did. By Commit 5 (the large refactor), every `ui/` primitive it depends on already has real tests — which is precisely the safety net the round-2 revision was reaching for.

This is stronger than a single test commit: a lump-sum suite written at position 2 would be written against components that do not exist, whereas tests written alongside each component test real behaviour.

### Correction 2 — Playwright is adopted as a frontend dev dependency at Commit 0

**The problem, confirmed by checking rather than assuming:** neither `playwright` nor `puppeteer` is installed anywhere in this repository. The round-2 acceptance criterion requiring reference screenshots *"archived before the first commit, then compared after every commit that intentionally changes appearance"* **cannot currently be met at all.** Sprint 7 Commit 12 separately established that this environment cannot persist a captured screenshot to disk, and that captures return blank when the page is scrolled.

**Decision: add `playwright` as a `frontend/` dev dependency in Commit 0.** New dependencies require a Design Review in this project; this ADR is that record.

**Justification, weighed rather than assumed:** Playwright is a large dependency and this project has been deliberately frugal (10 backend runtime dependencies after 8 sprints). It is justified here because it serves **two** separately-locked requirements, not one:
1. The screenshot baseline and comparison that makes Decision 3's appearance-neutral policy enforceable rather than aspirational.
2. Commit 9's real-browser verification pass, which currently depends on an interactive browser tool that Sprint 7 proved unreliable (crashes, blank captures, click-below-viewport failures).

A checked-in Playwright script makes both **reproducible by anyone on any machine**, rather than by one operator in one environment. That is the same reasoning that produced `verify-server`, `verify-real-export`, and `verify-real-publish` — this project's consistent preference for scripted, re-runnable verification over manual steps.

**Scope limit:** Playwright is for screenshot capture and Demo Script verification only. It is **not** a general E2E testing framework for this sprint, and component testing stays with Vitest + Testing Library (Correction 1). Should Playwright fail to install or run in this environment, that is a **Commit 0 blocker to be surfaced immediately**, not worked around silently — the acceptance criterion depends on it.

### Correction 3 — `docs/ROADMAP.md` is superseded and no longer authoritative

**Evidence:** `docs/ROADMAP.md` currently opens with *"Sprint 1: Import Pipeline ✅ IN PROGRESS — Phase 2 (Application Layer) Complete → Phase 3 (Presentation) Starting."* The project has since released **nine** sprints through `v0.9.0-alpha`. The document is roughly eight sprints stale. **`docs/VERSIONS.md` line 3 actively points to it** as the authority for *"exact sprint scope,"* which makes it a live pointer to obsolete information, not merely a dormant file.

**Decision: annotate it as historical and superseded — do not rewrite it, and do not delete it.** Following ADR-0010's established precedent (corrections are annotated, never rewritten), it stays readable as the record of early planning. `docs/VERSIONS.md`'s pointer is corrected to name the documents that are actually maintained: `VERSIONS.md` itself, `TODO.md`, and the per-sprint Level 2 Design Reviews.

**Why not simply update it:** `VERSIONS.md` (version→milestone), `TODO.md` (task state), and the per-sprint Design Reviews (scope) already cover everything `ROADMAP.md` claimed, and all three are actively maintained. Keeping a fourth overlapping document synchronized is precisely how documents drift — this staleness is the demonstration.

### Correction 4 — `docs/CURRENT_STATE.md`'s test table is rebuilt from real measured counts

**Evidence:** the table's per-row figures summed to **378** against a real total of **386** — a delta of 8, because rows predating Sprint 7 were never re-derived. Sprint 8's closure disclosed this discrepancy in a footnote rather than fixing it.

**Decision: rebuild all 44 rows from vitest's own JSON reporter and delete the disclaimer.** The disclosure was honest, but a permanently non-summing table invites future readers to distrust the whole document. Real counts also revealed genuine drift beyond the missing rows — `ManualLayoutSelector` had 10 tests where the table claimed 8, and `getTheme` 4 where it claimed 2.

**Consequences:**
- Sprint 9's commit plan (`UI_FOUNDATION.md` §7) is rewritten per Correction 1; Decision 6 is amended to say "harness at Commit 2, tests inline thereafter."
- `frontend/package.json` gains `playwright`, `vitest`, and `@testing-library/react` as dev dependencies during Sprint 9 — the first new frontend dependencies since Sprint 7.
- `docs/ROADMAP.md` gains a superseded header; `docs/VERSIONS.md`'s pointer is corrected.
- `docs/CURRENT_STATE.md`'s test table becomes self-consistent and stays that way only if future sprints regenerate it rather than appending rows.

**Related:** `docs/architecture/diagrams/UI_FOUNDATION.md` (the Sprint 9 review these correct), ADR-0039 (the reprioritization that made UI Foundation Sprint 9), ADR-0010 (the annotate-never-rewrite precedent Correction 3 follows), ADR-0033 (the last new-dependency decision, for comparison), `docs/DESIGN_REVIEW_PROCESS.md` (the new-dependency rule Correction 2 satisfies)

---

## ADR-0041: Two Scalability Constraints Framed, Not Fixed — Event-Loop Blocking and the Persistence Prerequisite

**Status:** OPEN — both deferred deliberately. **This ADR does not decide either answer.** It records two constraints found by the 2026-07-18 review, with enough evidence that a future Design Review starts from facts rather than rediscovery.

**Date:** 2026-07-18
**Decision:** Do **not** fix either inside Sprint 9. Both are architectural changes with real blast radius, and Sprint 9's defining constraint is that it touches no backend code and adds no business logic. Fixing them here would break that constraint and bury a significant change inside a UI sprint.

### Constraint 1 — Rendering blocks the Node event loop

**Confirmed by reading the code, not inferred:** `PDFRenderer.render()` is declared `async` and returns a `Promise<Buffer>`, but the work inside is synchronous PDFKit document construction — the `async` wrapper never yields to the event loop. The same shape holds for `DOCXRenderer` and `EPUBRenderer`.

**The measured consequence:** Sprint 7 Commit 10 recorded a real 39,913-word manuscript exporting to PDF in 598ms. That is 598ms during which this single-threaded server **answers no other request** — not a health check, not another user's import. Two concurrent exports serialise; ten make the tenth user wait several seconds before their work even starts.

Today this is invisible: the product has one user at a time and no deployment. It stops being invisible the moment two people use it simultaneously, and `v0.14.0-alpha` (Sprint 13, Performance & Scalability) is where it must be answered.

**The question a future Design Review must answer:**
> How should rendering be moved off the request thread without breaking the `Renderer<TOutput>` port that three implementations and every export path depend on?

Candidate shapes, **none endorsed here**: a `worker_threads` pool behind the existing port (keeps the contract, adds serialisation cost for the `PaginatedBook`); a job queue with polling or SSE (changes the HTTP contract from synchronous to asynchronous, and would interact with Sprint 12's Autosave work); or accepting the limit and scaling horizontally with multiple processes (cheapest, but caps per-instance throughput at one export).

**A constraint any answer must respect:** ADR-0012 makes `Renderer<TOutput>` a port with three real implementations. Whatever is chosen should not force PDF, DOCX and EPUB renderers to each know they are running in a worker.

### Constraint 2 — Six of nine scheduled sprints need a persistence layer that is currently forbidden

**Confirmed by `grep` across `backend/src/`:** there is no database, no repository, no session, and no cache. Sprint 7 Decision 2 (approved, held without exception through Sprints 8 and 9) states: *"No session, no server-side manuscript cache — every UI action is its own complete round trip."*

**The conflict, from ADR-0039's own roadmap:** Workspace (11), Autosave & Recovery (12), Collaboration (14), Cloud Sync (15), Licensing (16), and Telemetry (17) each fundamentally require remembering something between requests. **Sprint 11 is where this becomes blocking** — projects, recent manuscripts, favourites and history are, definitionally, state.

Sprints 9 and 10 are frontend-only and fully compatible with the backend as it stands, which is part of why ADR-0039 placed them first.

**The question a future Design Review must answer:**
> What is persisted, where, and does Sprint 7 Decision 2 get amended or superseded?

This is not only a storage choice. It reopens questions the stateless design currently answers for free: what a "project" is as a Domain concept, whether manuscripts are stored as uploaded bytes or as serialised `Book` ASTs (`Book.ts` already declares itself SERIALIZABLE), who owns them once Licensing exists, and what happens to them on deletion.

**Consequences:**
- Neither constraint blocks Sprints 9 or 10. Both are recorded now so Sprint 11 opens with the problem already framed rather than discovered.
- Sprint 13's Design Review should treat Constraint 1 as its starting point and re-measure first: the 598ms figure is from Sprint 7 and the pipeline has changed since.
- Sprint 11's Design Review must resolve Constraint 2 **before** any Workspace code, since amending an approved decision is a governance step, not an implementation detail.
- If both are still open when a real second user appears, Constraint 1 becomes a live production problem rather than a theoretical one.

**Related:** ADR-0039 (the reordered roadmap that scheduled the six dependent sprints), `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` Decision 2 (the stateless rule Constraint 2 must amend), ADR-0012 (the `Renderer` port Constraint 1 must not break), ADR-0038 (the other OPEN deferral, also awaiting its own review), `docs/demo/VISIBLE_INCREMENTS.md` (Sprint 7 Commit 10, where the 598ms measurement is recorded)

---

## ADR-0042: Render Metrics Reach the Publishing Engine as a Narrow, Per-Format Value Object

**Status:** APPROVED (CTO, 2026-07-18). **Resolves ADR-0038**, which framed this question and deliberately left it unanswered.
**Date:** 2026-07-18
**Decision:** Introduce a `RenderMetrics` Domain model carrying the *real* paginated page count and the `PageLayout` pagination actually used. Attach it per rendered format, transport it through a widened `PublishingTarget.prepare()`, and expose it on `PostRenderValidationContext` where rules read it.

**Why the gap mattered more than ADR-0038 recorded.** ADR-0038 described one blocked consumer (`PageCountRule`). Writing `RENDER_METRICS.md` found three, by reading `KDPRuleData.ts`: KDP's page-count range (24-828), its **spine width** (`spineWidthInPerPage x pages`, so paperback cover dimensions are *derived* from page count), and its **gutter margins** (`marginsByPageCount`). Two of the three were never mentioned.

**The four candidates ADR-0038 listed, adjudicated:**

- *Enrich `Book` with the real count* - **rejected.** `Book.pageCount` is an import-time estimate from word count; writing the real value there gives one field two meanings depending on which path produced it, with no way for a consumer to tell which it holds. A page count is a property of a rendition, not of the work (`AGGREGATES_AND_PERSISTENCE.md` section 1).
- *Pass `PaginatedBook` into `prepare()`* - **rejected.** It carries `styledBook`, `pages`, `pageLayout` and the TOC. Publishing needs counts, not content; passing it couples the publishing port to the layout engine's internal model.
- *Widen `RenderedOutputs`* and *add a field to `PostRenderValidationContext`* - **both adopted**, since they solve different hops: the first transports, the second delivers.

**Per-format, not per-bundle.** A bundle may hold a paginated PDF and a reflowable EPUB at once; a single bundle-level page count would necessarily be wrong about one of them. `RenderMetrics.pageCount` is therefore **optional**, and `PAGE_COUNT_UNKNOWN` keeps a legitimate life for reflowable formats - it simply stops firing on every PDF, which was the actual defect.

**No fallback, ever.** `PageCountRule` must not fall back to `Book.pageCount` when metrics are absent. KDP rejects on the real count; validating an estimate against a hard platform limit converts an honest `WARNING` into a `PASS` on a book Amazon will refuse. A false green is worse than a disclosed unknown.

**Consequences:**
- `PublishingTarget.prepare()`'s signature widens. This is the evolution Sprint 8 Decision 1 explicitly anticipated in the port's own comment, not an unplanned break, and `KDPTarget` is its only implementation.
- The `Renderer` port (ADR-0012) is **untouched** - `PublishingUseCase` assembles the metrics from the `PaginatedBook` it already holds, so none of the three renderers change.
- The export path is deliberately not given metrics: `ExportManuscriptUseCase` has no validator to feed, and an unused field is the thing this project's handbook rule exists to prevent.
- Real page counts may push small fixtures below KDP's 24-page minimum, turning comfortable `WARNING`s into real `ERROR`s. That is the fix working and must not be resolved by loosening the rule.

**Related:** ADR-0038 (resolved by this), ADR-0043 (the defect found alongside it), ADR-0037 (platform-agnostic constraint held), ADR-0012 (`Renderer` port left untouched), ADR-0035 (the KDP spike that supplied the spine and margin data), `docs/architecture/diagrams/RENDER_METRICS.md`

---

## ADR-0043: `PageLayout` Has No Gutter - Every Paperback This Product Generates Is Non-Compliant

**Status:** OPEN - defect confirmed and disclosed, fix deliberately deferred to its own review. **Not** a decision to leave it broken.
**Date:** 2026-07-18
**Found by:** writing `RENDER_METRICS.md` - reading `KDPRuleData.ts` against `PageLayout.ts`, not by a failing test.

**The defect.** `PageLayout` offers `marginTop`, `marginBottom`, `marginLeft`, `marginRight` and nothing else. Confirmed by grep: `gutter` appears in neither `PageLayout.ts` nor `LayoutEngine.ts`. KDP requires an inside (gutter) margin that scales with page count:

| Pages | Gutter required |
|---|---|
| <=150 | 0.375 in |
| <=300 | 0.5 in |
| <=500 | 0.625 in |
| <=700 | 0.75 in |
| <=828 | 0.875 in |

Margins are therefore **symmetric**, with no inside/outside distinction and no recto/verso notion - every page is laid out as a loose sheet. A 400-page book generated today owes a 0.625 in gutter and gets whatever `marginLeft` happened to be. **Text runs into the binding.**

**Why 479 passing tests did not catch it.** No test can assert a requirement the model is incapable of expressing. This is the sixth instance of this project's recurring pattern (ADR-0019, 0020, 0031, 0032, 0038) and the first where the blind spot was in a *Domain model's shape* rather than in a library's behaviour - worth noting, because no amount of additional test coverage against the current `PageLayout` would have surfaced it.

**A real circularity, named now rather than discovered mid-implementation.** The required gutter depends on page count; widening the gutter reduces text per page, which increases page count. A book near a threshold (150, 300, 500, 700) can cross it *because of* the margin its own page count demanded.

**Recommended resolution when this is picked up** (not decided here): one re-pagination pass, not convergence to a fixed point - paginate, look up the gutter for the resulting count, re-paginate if it changed, then validate. If the second pass crosses another threshold, report it as an issue rather than looping; an author whose book sits on a boundary needs to be told, not silently handed a third layout.

**Why not fixed alongside ADR-0042.** The fix changes `PageLayout` and `LayoutEngine`, alters the visual output of every existing export, and has visual-baseline consequences. Folded into a metrics-transport change it would produce a commit that cannot be reviewed. Scope discipline here is the same call Sprint 8 made when deferring ADR-0038 itself.

**Consequences:**
- ADR-0042's work makes the page count *visible and validatable*; it does not make the product compliant. Release notes must say so plainly rather than let a green publish report imply otherwise.
- Until fixed, print-on-demand output should be treated as not production-ready, regardless of what `SubmissionValidator` reports.

**Related:** ADR-0042 (the work that surfaced this), ADR-0035 (the spike whose data made it visible), ADR-0030 (KDP trim sizes), `docs/architecture/diagrams/RENDER_METRICS.md` section 3

---

## ADR-0044: Archiving and Deletion Are Two Operations, Decided Before the Storage Spike

**Status:** APPROVED (CTO, 2026-07-18). Closes `AGGREGATES_AND_PERSISTENCE.md` Risk 5.
**Date:** 2026-07-18
**Decision:** Separate **archive** (reversible, loses nothing, hides from the library) from **delete** (irreversible, removes the whole aggregate including the author's original upload). Deletion is never blocked by history. `ProjectRepository` gains no new method.

**The finding that dissolved the dilemma.** Framed as "keep history or destroy it", the question looks unresolvable. The real problem is that **one verb served two intentions**: "this is finished, get it out of my way" (common, expects to lose nothing) and "this was a mistake, remove it" (rare, expects real erasure). A single destructive delete fails the common case by discarding a publication record the author wanted kept; a single soft delete fails the rare case worse, retaining data the author believes erased. Separating them lets archive absorb the common case - and the publication record then survives because *the project* survives.

**Deletion is not blocked, however much history exists.** The project belongs to the author; refusing because they once published is paternalism dressed as stewardship. Amazon holds its own record of what was published. This also keeps the product defensible under a right-to-erasure request - a "delete" that quietly retains is the shape that causes real trouble later.

**Archiving needs no port surface, and that is evidence.** It is a state change on the aggregate (`archivedAt`), persisted through the existing whole-aggregate `save()`. Only `list()` changes, gaining an options argument and **excluding archived projects by default** - a caller that forgets the flag then shows too few projects, which is visible and reported, rather than leaking archived work into every library view. That a lifecycle change is absorbed without widening the persistence boundary is independent confirmation that the aggregate boundary approved in `AGGREGATES_AND_PERSISTENCE.md` section 2 is drawn correctly.

**Sequenced before the storage spike, deliberately.** Whether the schema carries a nullable `archivedAt` and whether every query filters is determined here. Deciding after a store is chosen means a migration over real author data - the one class of change this project has no way to rehearse.

**CTO override, recorded.** The review recommended offering deletion in the UI immediately. The CTO decided **no**, and the override is correct: a delete button is the one control whose mistakes cannot be walked back, and against a store that loses everything on restart its only real use would be working around a limitation we intend to remove. The review's own "a mis-imported file needs removing" argument is better served by archive, which the same review introduces - the destructive tool was reached for while the reversible one sat on the same page.

**Consequences:**
- `delete()` stays as designed, correct, and without a UI caller - its state today.
- Decision 6's typed confirmation is a UI rule with no surface to live on; deferred with the UI.
- The publication-record export is still built: it is a legitimate read of an author's own history independent of deletion, and it must exist before a delete button can ever be offered.
- `archivedAt` becomes a filter every future project query must respect. Sprint 11 (Workspace) and Sprint 14 (Collaboration) each add queries and each is a chance to forget it; default-exclude plus a standing regression test are the mitigation.
- Committing to real deletion before a real store exists makes backup and replica retention a **selection criterion** for the storage spike rather than a later discovery.

**Related:** `AGGREGATES_AND_PERSISTENCE.md` Risk 5 (closed by this) and section 2 (the boundary this confirms), ADR-0041 (persistence prerequisite; this is sequenced before its spike), ADR-0001 (immutability - `archive()` returns a new Project), `docs/architecture/diagrams/PROJECT_LIFECYCLE.md`

---

## ADR-0045: Render Metrics Come From the Renderer - Correcting an Approved Decision, and the Publish/Export Divergence It Exposed

**Status:** APPROVED (implemented 2026-07-18). **Corrects RENDER_METRICS.md Question 1**, which was approved and wrong.
**Date:** 2026-07-18
**Found by:** real-fixture verification during ADR-0042's own Commit 4 - not by the 484 tests that were green at the time.

**What the approved review said.** RENDER_METRICS.md Question 1 asked whether the `Renderer` port should produce metrics or `PublishingUseCase` should assemble them. It recommended the use case, reasoning that `Renderer` has three implementations and widening its return type would change all three plus the export path "for no gain", and that this keeps ADR-0012 untouched. The CTO approved it. **It was wrong twice over.**

**First: `PaginatedBook.pages.length` is an estimate the codebase already documented as unreliable.** ADR-0013 recorded that PDFKit's real rendered page count can differ from `LayoutEngine`'s `Page[]` length, and `PDFRenderer` says so in its own comments - it deliberately uses `doc.bufferedPageRange().count` for the "of TOTAL" footer *because* the estimate undershot on real content (ADR-0019 finding 6C). Question 1 selected, as the source of a number used to validate against a hard platform limit, the one figure this project had already written down as untrustworthy.

**Second: renderers emit pages that pagination never sees.** `PDFRenderer` renders the title and copyright pages from `book.frontMatter` itself, outside `LayoutEngine.paginate()`. The estimate therefore counts body pages only.

**The measurement.** On the canonical fixtures the publish pipeline reported a page count of **1** while the exported PDF had **3**. After the fix, reported and real agree exactly: 3/3, 3/3, 3/3, and `large-book.docx` at 32 real pages sits inside KDP's 24-828 range and correctly raises no issue.

**A second, independent defect surfaced by the same investigation.** `PublishingUseCase` did not build front matter at all, while `ExportManuscriptUseCase` did. **The Publishing Engine was validating a document the author would never upload** - no title page, no copyright page, no ISBN page - and reporting on it as though it were the finished book. Fixed in the same work by giving both paths the same `FrontMatterBuilder` step, and locked by a test that renders through both and asserts the publish-reported count equals the real page count of the PDF export actually ships.

**Decision:** `Renderer<TOutput>.render()` returns `RenderResult<TOutput> = { output, metrics }`. Only the renderer knows what it emitted, so only the renderer can report it honestly.

- `PDFRenderer` reports `doc.bufferedPageRange().count`, captured after every `addPage()` and before `end()` flushes.
- `DOCXRenderer` reports **no** page count. Word repaginates on open against the reader's own fonts and printer metrics; a number here would be invented.
- `EPUBRenderer` reports **no** page count. Reflowable formats have no pages until a device lays them out.

The two renderers that return `pageCount: undefined` are not gaps - they are the reason `RenderMetrics.pageCount` is optional (ADR-0042), and `PageCountRule`'s `PAGE_COUNT_UNKNOWN` is the correct outcome for them.

**Consequences:**
- ADR-0012's `Renderer` port **does** change, contrary to ADR-0042's stated consequence. That earlier claim is superseded here rather than edited, per ADR-0010's annotate-never-rewrite precedent.
- `ExportManuscriptUseCase` discards the metrics: it has no validator to feed, and an unused field is what the handbook's port-vs-class rule exists to prevent. `verify-real-export` stayed 16/16 across the change.
- Cost of the correction: 55 call sites, almost all of them assertions in the three renderer test suites. Mechanical, and cheap precisely because it was caught during the sprint that introduced the metric rather than after something depended on it.
- **The deeper issue is left open**: renderers adding pages behind pagination's back means `LayoutEngine` does not model the whole document. That also affects running heads and page numbering, and it is the same class of layout-fidelity problem as ADR-0043's missing gutter. Both belong to one future Design Review on layout fidelity; neither is fixed here.

**The governance lesson, recorded because it is the actionable part.** This project's rule is spike-before-decide for external behaviour (ADR-0019, 0020, 0030, 0035). Question 1 was a decision about **this codebase's own internals**, made by reasoning about blast radius rather than by reading `PDFRenderer` - which contained, in a comment, the exact fact that falsified it. ADR-0031/0032 already recorded that "confirmed, not guessed" applies to our own upstream code too. It applied here and was not honoured, and a design review being approved did not make it true.

**Related:** ADR-0042 (whose Question 1 this corrects and whose `Renderer`-untouched consequence this supersedes), ADR-0013 (the estimate-vs-real drift already on record), ADR-0019 finding 6C (why `bufferedPageRange().count` is the trusted figure), ADR-0012 (the port this widens), ADR-0043 (the sibling layout-fidelity defect), ADR-0031/0032 ("confirmed, not guessed" applied to our own code), `docs/REAL_FIXTURE_POLICY.md` (the verification that caught it), `docs/architecture/diagrams/RENDER_METRICS.md`

---

## ADR-0046: Persistence Store Spike — SQLite via `node:sqlite` Recommended, and the Aggregate Is the Real Cost

**Status:** APPROVED as a spike finding + recommendation (2026-07-18). **Answers AGGREGATES_AND_PERSISTENCE.md Question 6.** Implementation deliberately NOT started: Sprint 7 Decision 2 (stateless backend) must be formally amended by Sprint 11's Design Review first (ADR-0041 Constraint 2) — choosing the store and wiring the store are two gates, not one.
**Date:** 2026-07-18
**Spike:** `backend/spikes/persistence-store-spike.ts`, run on this machine (Node v24.18.0, Windows). Round-trips **real domain aggregates** built by the real `ProjectService` — an 80k-word, 20-chapter book, a real 5MB source upload, 50 version snapshots, 200 further projects for the listing — per ADR-0031/0032's "confirmed, not guessed" applied to our own code. ADR-0045, three commits ago, is what guessing costs.

**Candidates and why only these two.** (A) one JSON file per aggregate — the zero-dependency baseline; (B) SQLite via `node:sqlite` — built into Node 24 (verified), so **also zero new dependencies**, which changes the usual calculus. Postgres and document stores were deliberately not spiked: they need a running server, and this product's own reference points (Atticus, Affinity Publisher — the CTO's stated inspirations) are local-first tools. A client-server store is Sprint 15's (Cloud Sync) question, not "where does an author's project live on their machine".

**Measured results (real numbers, this machine):**

| Measure | A: JSON files | B: SQLite |
|---|---|---|
| Save aggregate + 5MB blob | 177ms (blob separated) | 3052ms (one transaction) |
| Load whole aggregate | 571ms | 616ms |
| `list()` over 201 projects | **7015ms — loads every aggregate** | **317ms — summary columns, zero aggregates loaded** |
| Crash mid-write | **CORRUPTED, unreadable** without rename discipline | **rolled back**, partial state never visible |
| Blob embedded in aggregate | 58MB file, 4.9s load | n/a (blobs table by design) |

**Decision basis, stated plainly:**
- The two measures that decide it are the last two. `list()` is the operation the UI runs constantly, and 7s vs 0.3s is not a tuning gap — the files candidate has no index and structurally cannot have one without building, by hand, the thing SQLite already is. And a store that can hand back a **corrupted, unreadable aggregate** after a crash fails the whole reason the aggregate boundary exists (a consistency boundary that can be torn in half is not one). File-rename discipline mitigates but cannot cover multi-file writes (aggregate + blobs), which SQLite covers with one transaction — measured, not asserted (B4).
- SQLite's slower save (3s, dominated by binding a 45MB string) is the price of that transaction, paid at save time where it is least felt.

**Recommendation: SQLite via `node:sqlite`.** Schema shape proven in the spike: aggregate as a JSON document column (the port's whole-aggregate contract, kept literally), summary fields as real indexed columns (Question 4's read model becomes a `SELECT`, and ADR-0044's `archived_at IS NULL` filter becomes an index), blobs in their own table written in the same transaction (Question 5's source retention without aggregate bloat — the embedded-blob measurement, 58MB/4.9s, is why this is structural, not stylistic).

**The finding that outranks the question asked:** the blob-stripped aggregate was **45.1MB** — not from the book (~0.9MB) but from **50 full-copy version snapshots**. Version history grows the aggregate linearly, and at that size every candidate is slow at whole-aggregate load (571ms vs 616ms — the store choice is a rounding error next to the shape). This does not change today's model (correct first, compact later, ADR-0001's immutability makes dedup/structural-sharing possible precisely because snapshots never mutate) — but Sprint 11's review must treat **version-snapshot growth** as a first-class design input, not discover it in production.

**Also real, disclosed:** both candidates need an explicit hydration layer (`Date` and `Buffer` do not survive `JSON.parse` naively — the spike's `hydrate()` is the sketch); `node:sqlite` is the one dependency on Node's own API stability, verified available without flags on v24.18.0 and worth re-verifying in CI's Node version before Sprint 11 wires it.

**Related:** `AGGREGATES_AND_PERSISTENCE.md` Question 6 (answered here), Question 4 (the summary read model this schema makes a `SELECT`), Question 5 (blob separation), ADR-0044 (`archivedAt` as an indexed filter), ADR-0041 Constraint 2 (the governance gate implementation waits behind), ADR-0019/0020/0030/0035 (spike-before-decide precedent), ADR-0045 (the freshest reason this spike used real aggregates), `backend/spikes/persistence-store-spike.ts`

---

## ADR-0047: A Successful Import Creates a Project — Decision 2 Amended in Code, by CTO Direction

**Status:** APPROVED (CTO-directed, 2026-07-18)
**Date:** 2026-07-18
**Decision:** `ImportManuscriptUseCase` now creates a `Project` around every successfully imported book, retains the original upload as its `'source'` asset byte for byte, and returns `projectId` on the response (additive, optional). `GET /api/projects` lists the library as `ProjectSummaryDTO`s. One `InMemoryProjectRepository` instance is the app's state.

**This is the moment Sprint 7 Decision 2 (stateless backend) stops being amended "in principle only."** The backend now deliberately holds state between requests, by explicit CTO instruction ("le câblage de Project dans l'import"). The state is in-memory and does not survive a restart — disclosed in the repository class, in `app.ts` at the wiring site, and here. The durable store is chosen (SQLite, ADR-0046) but its wiring stays gated behind Sprint 11's Design Review, which must formally restate Decision 2 (ADR-0041 Constraint 2). Holding state and holding it durably are different promises; this ADR makes only the first.

**Product decisions embedded here, each reversible in one place:**
- **A rejected import creates no project.** The UI treats 422 as "fix your file and try again"; a library accumulating a project per failed attempt fills with orphans the author never asked to keep. Confined to one block in the use case if real authors prove this wrong.
- **Default settings are the registries' own defaults** (`letter`/`classic`), the same ones the export path applies when nothing is chosen. The project remembers them from birth so they become editable properties later (Decision 1 of `UI_FOUNDATION.md`: layout/theme are book properties, not workflow steps).
- **The library endpoint is read-only.** No create (import IS create), no delete (ADR-0044's CTO decision — no UI caller until persistence is real), no archive endpoint yet (the control and its consequence should ship together with the library UI, not as an orphaned endpoint first).

**A real defect found by the wiring's own test:** `InMemoryProjectRepository`'s `structuredClone` silently downgraded `Buffer` to `Uint8Array` — bytes intact, prototype gone, so the first caller invoking `asset.data.equals(...)` crashed on a value the type system swears is a `Buffer`. Sixteen existing repository tests missed it because none round-tripped a real asset payload. Fixed in the clone (a prototype-restoring view over the clone's own fresh memory, not a second copy), locked by a regression test at the class that owns the clone. Note for Sprint 11: the SQLite hydration layer has the same class of problem (ADR-0046 already flags `Date`/`Buffer` revival), and this is the concrete proof it bites.

**Verified end to end against the real server:** import of `typography-test.docx` → `projectId` returned → `GET /api/projects` lists the project with its name, zero versions, no publications. The rejected-import path and the Unicode invariant (`supplémentaire` intact through the whole HTTP loop) are locked by route tests.

**Related:** `PRODUCT_OBJECT_MODEL.md` (the project as unit of work), `AGGREGATES_AND_PERSISTENCE.md` Question 5 (source retention — the byte-for-byte test is its proof), ADR-0044 (why delete/archive are absent from the endpoint), ADR-0046 (the chosen store this deliberately does not wire), ADR-0041 Constraint 2 (the governance gate durability still waits behind), Sprint 7 Decision 2 (the stateless rule this amends in code)
