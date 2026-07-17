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