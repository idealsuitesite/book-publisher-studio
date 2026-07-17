# Typography Resolution Pipeline — Design Review (Sprint 4)

**Status:** ✅ APPROVED (2026-07-17) — all open questions resolved, ready for implementation. ADR numbers below are still to be written into `DECISIONS.md` (happens as commit 11 of the plan, §8), but no further design changes are expected before then. v1 proposed a `TypographyEngine` + new `TypesetBook` type; round 1 of CTO review approved the pipeline position/responsibility split but rejected the `TypesetBook` rename and `LayoutEngine` signature change as unnecessary blast radius (§CTO Review Outcomes). Round 2 resolved the 4 remaining open questions (§14, now folded into the relevant sections and marked DECIDED below).
**Date:** 2026-07-17
**Scope:** Sprint 4, priority #1 per CTO direction (`docs/TODO.md`, ADR-0021).

---

## CTO Review Outcomes (v1 → v2 changes)

| # | v1 proposal | CTO decision | v2 change |
|---|---|---|---|
| 1 | Pipeline position: `ThemeEngine → TypographyEngine → LayoutEngine → Renderer` | **Approved as-is** | Unchanged — this is exactly right, typography is book enrichment before pagination |
| 2 | Renderers stop computing their own typography, become pure "drawers" | **Approved** | Unchanged |
| 3 | New `TypesetBook` type; `PaginatedBook.styledBook` renamed to `typesetBook` | **Rejected** — too much blast radius for the value gained | `StyledBook` keeps its name; gains an additive `blockTypography?` field instead. `PaginatedBook` and `Renderer<TOutput>` are now **entirely unchanged** |
| 4 | `LayoutEngine.paginate(styled: StyledBook, ...)` → `paginate(typeset: TypesetBook, ...)` | **Rejected** | Signature unchanged. `LayoutEngine` reads `styled.blockTypography?.[block.id]` internally — same input type, richer content |
| 5 | Component name `TypographyEngine` | **Renamed** — it resolves decisions (font, size, weight, drop cap) from theme + block, it doesn't render anything itself; "Resolver" describes the responsibility more accurately than "Engine" | `TypographyEngine` → **`TypographyResolver`** everywhere in this doc, the ADR, and the eventual code |
| 6 | Hyphenation deferred to v2 (recommendation) | **Confirmed, not just recommended** | Decided: out of Sprint 4 |
| 7 | Smart quotes: English-only v1, locale-aware later | **Confirmed** | Decided: v1 ships English curly quotes only; `fr`/`de`/etc. is explicitly future work, not silently missing |
| 8 | Gelasio font choice | **Confirmed** (already decided in ADR-0021) | Unchanged |
| 9 | `QualityMetrics` gains `widowsAndOrphans`/`inconsistentSpacing`/`emptyHeadings` | **Expand** — these will feed future Validator/AI-quality-scoring work, worth getting more of them now while the resolver already computes the underlying data | Add `averageHeadingDepth`, `paragraphDensity`, `lineDensity`, `dropCaps` (§5) |
| 10 | (not in v1) | **New requirement**: formalize the "verify with a real file" discipline this project has already relied on informally 3 times (PDF "Page 6 of 4", empty EPUB, PDFKit infinite pagination) as a **permanent, written governance policy** — not something to re-derive every sprint | New `docs/REAL_EXPORT_CHECKLIST.md`, `docs/MERGE_CHECKLIST.md` gains a mandatory step, `docs/CLAUDE.md` references it (tracked as a separate governance change, not part of the Typography implementation itself — see the companion update in this same session) |

The net effect of decisions 3–4: this sprint's blast radius shrinks substantially. `PaginatedBook`, `Renderer<TOutput>`, and `LayoutEngine`'s public signature are now untouched. Only `StyledBook` gains one additive optional field, and `LayoutEngine`'s *internals* (not its signature) read it.

## CTO Final Decisions — Round 2 (2026-07-17, resolves §14's 4 open questions)

Explicitly framed by the CTO as keeping Sprint 4 focused and avoiding scope creep:

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | Block-type typography rules (e.g. quote italics) — `Theme`-configurable this sprint, or internal default? | **Internal default in `TypographyResolver` for v1. `Theme` gains no new fields this sprint** (the `Theme.blockRules`/`Theme.typography` additions proposed in v2's §5 are dropped — see below) | Sprint 4's goal is centralizing typography, not making it configurable. Configurability is a distinct, later feature; today's internal-default design doesn't block adding it later without breaking the architecture |
| 2 | Font embedding scope | **Three families, not one: Gelasio (serif, replaces Georgia), Inter (sans-serif), JetBrains Mono (monospace)** — replacing all of `PDFRenderer`'s current standard-14 fallbacks (Helvetica, Courier), not just the serif/Georgia gap | Technical documents routinely contain code (monospace) and the current Courier fallback reads as unpolished; Inter/JetBrains Mono are both professional, widely-used, redistributable (SIL OFL / Apache 2.0) choices — no reason to leave two of the three font categories on bare PDFKit standard-14 substitutes while fixing only the third |
| 3 | RTL/multi-script support | **Confirmed out of scope for Sprint 4.** Not touched. | Real, separate, project-sized work (ADR-0019 finding 2) — already flagged, stays flagged, not pulled into this sprint |
| 4 | Exact formulas for `averageHeadingDepth`/`paragraphDensity`/`lineDensity` | **Functional definitions locked now (below); exact arithmetic finalized during implementation (commit 9), optimized later alongside `ValidatorEngine`** | Sprint 4 needs these fields to exist and mean the right thing; tuning their precision is better scoped with the `ValidatorEngine` work that will actually consume them (Sprint 4 priority #2, `docs/TODO.md`) |

**Functional definitions (decision 4), locked for implementation:**
- **`averageHeadingDepth`** — the mean of `Heading.level` across every `Heading` block in the book (1–6). Represents how deeply nested the book's structure typically is; `0` if there are no headings.
- **`paragraphDensity`** — count of `Paragraph` blocks divided by `PaginatedBook.pages.length` (the number of pages `LayoutEngine.paginate()` produced). Represents how many paragraphs a reader encounters per page on average.
- **`lineDensity`** — total estimated lines across all `Paragraph` blocks (using `LayoutEngine`'s existing `WORDS_PER_LINE` word-count heuristic — the same one `estimateBlockHeight()` already applies) divided by the count of `Paragraph` blocks. Represents average lines per paragraph.

Edge cases (division by zero when there are no pages/paragraphs, whether `Section`-only "preamble" content counts, exact rounding) are implementation details for commit 9, not fixed by this review.

---

## 1. Objectives

1. Centralize typography (font resolution, weight/style, color, spacing, alignment, drop caps, smart quotes, widow/orphan avoidance) in one Domain component instead of three independently-evolving copies inside `PDFRenderer`, `DOCXRenderer`, `EPUBRenderer`.
2. Close a real, silent gap found while preparing this review: **none of the three renderers currently render `Block.inlines`** (bold/italic/underline/strikethrough/superscript/subscript/links/small-caps) — see §2 for evidence. This is data loss, not a stylistic simplification.
3. Give `LayoutEngine.paginate()`'s already-documented "typography extension seam" (`RENDERING_PIPELINE.md`, Step 2) a real implementation, without changing its public signature.
4. Activate and expand `QualityMetrics` (`Book.ts:451-469`), declared-but-unused since ADR-0008 pending exactly this engine.
5. Resolve ADR-0021's deferred Gelasio font decision into an actual embedded asset in `PDFRenderer`.

---

## 2. Current State — Evidence, Not Assumptions

Read directly from `PDFRenderer.ts`, `DOCXRenderer.ts`, `EPUBRenderer.ts`, `Book.ts`, `LayoutEngine.ts` before writing this review (same "verify, don't guess" discipline as ADR-0019/0020):

| Concern | PDFRenderer | DOCXRenderer | EPUBRenderer |
|---|---|---|---|
| Heading size | Hardcoded formula `max(12, 28 - level*3)` — **ignores `theme.fontSizes.h1-h6` entirely** | Delegates to `docx`'s own built-in `HeadingLevel` styling — **also ignores `theme.fontSizes` entirely**, a different flavor of the same gap | Correctly uses `theme.fontSizes.h1-h6` via CSS — the one renderer that gets this right, but only at the theme (global) level, never per-block |
| Font family | `resolveFont()` — private regex heuristic mapping theme font names onto PDFKit's 14 standard fonts | Passes `style.fontFamily` straight to `docx`'s `TextRun.font` | Passes `theme.fonts.*` into a hand-built CSS string |
| Inline formatting (`Block.inlines`) | **Not rendered.** `renderBlock` always uses `block.text`, never walks `block.inlines` | **Not rendered.** Always wraps `block.text` in one `TextRun`, no `InlineElement` walk | **Not rendered.** `escapeHtml(block.text)` only |
| `Paragraph.dropCap` | Not read | Not read | Not read |
| `Paragraph.align === 'justify'` | Explicitly handled | **Not read at all** — paragraphs always render left-aligned regardless of `block.align` | Passed through as inline `style="text-align"` (works, but via raw passthrough, not a shared rule) |
| Quote/Scripture italics | Hardcoded via `resolveFont(family, false, true)` | Hardcoded `italics: true` on the `TextRun` | Hardcoded via a global `blockquote { font-style: italic }` CSS rule |

Three different renderers arrive at the same *today's* quote-italics output through three unrelated hardcodes — coincidence, not a shared rule. This table is the concrete case for centralizing, not a general "duplication is bad" argument.

Also confirmed: `ExportManuscriptUseCase.execute()` calls `layoutEngine.paginate()` unconditionally for all three formats, including EPUB — `EPUBRenderer` simply never reads `PaginatedBook.pages`. `RENDERING_PIPELINE.md`'s "EPUB skips this [pagination]" is aspirational, not what the code does today. Harmless currently (pagination is cheap and side-effect-free), and unaffected by this design (still no signature/behavior change forced onto that call site).

---

## 3. Architecture Impact

```
Book → ThemeEngine.applyTheme() → StyledBook (blockStyles only)
     → TypographyResolver.resolve() → StyledBook (same type, blockTypography now populated)
     → LayoutEngine.paginate() → PaginatedBook   [signature and shape UNCHANGED]
     → Renderer.render() → output bytes           [port UNCHANGED]
```

`TypographyResolver.resolve(styled: StyledBook, options?): StyledBook` takes and returns the **same type**, immutably (returns a new `StyledBook` object with `blockTypography` added — a `{ ...styled, blockTypography }` spread, not a mutation, matching ADR-0001's "immutable updates only" rule and the same pattern `ThemeEngine.applyTheme()` already uses).

**Two options considered for the component's place in the type system** (this is the part the CTO's review changed):

- **v1 proposal (rejected): a new `TypesetBook` type**, richer than `StyledBook`, flowing into a retyped `LayoutEngine`/`PaginatedBook`. Correct in principle but the CTO judged the blast radius (every renderer's access path, `LayoutEngine.test.ts`, every `PaginatedBook`-typed fixture across 4 test files) not worth it for what is, in the end, additive data.
- **v2 (adopted): `StyledBook` gains an additive `blockTypography?: Record<blockId, ResolvedTypography>` field.** `LayoutEngine`, `PaginatedBook`, and `Renderer<TOutput>` need **zero signature changes** — they already pass `StyledBook`/`PaginatedBook` through unchanged; they just get to read one more optional field on an object they already hold a reference to.

**Why this still respects Single Responsibility** (the concern that motivated `TypographyResolver` as its own class rather than folding into `ThemeEngine` in the first place): `ThemeEngine` and `TypographyResolver` remain two separate concrete Domain classes with two separate jobs (theme→visual style vs. structural typography rules) — only the *carrier type* they both write into is shared (`StyledBook`), not their responsibilities. This is the same pattern ADR-0008 already validated: `BookMetricsCalculator` and `ASTBuilder` are separate classes that both produce/enrich the same `Book` type.

**Consequences (disclosed, not hidden):**
- `Theme.ts`'s `StyledBook` interface gains one additive optional field — non-breaking for any code that doesn't read it yet.
- `LayoutEngine.estimateBlockHeight()` gains one new internal read (`styled.blockTypography?.[block.id]?.orphanRisk`) — no signature change, existing callers and tests unaffected except where they want to exercise the new behavior.
- `PaginatedBook`, `Renderer<TOutput>` — **no changes at all**.
- Renderers change internally (reading `blockTypography` instead of/alongside `blockStyles`, deleting their private font-heuristic/heading-size/italic-hardcode logic) but their `implements Renderer<Buffer>` contract is untouched.

---

## 4. Functional Specifications

1. **Inline run resolution** — `Block.inlines` (or plain-text fallback) → ordered list of styled runs (bold/italic/underline/strikethrough/superscript/subscript/small-caps/link), computed once instead of three renderers each needing their own walk.
2. **Font resolution policy** — `theme.fonts.{heading,body}` + run bold/italic → one logical font descriptor (family + weight + style), replacing `PDFRenderer`'s private `resolveFont()` heuristic and `DOCXRenderer`'s implicit reliance on `docx`'s default heading styles. **DECIDED: the logical family set is Gelasio (serif) / Inter (sans-serif) / JetBrains Mono (monospace)** — `PDFRenderer`'s current `SERIF_PATTERN`/`MONO_PATTERN` regex-to-PDFKit-standard-14 mapping is replaced by a mapping onto these three embedded families instead, closing the fallback gap for all three categories, not just serif/Georgia. (Actual font-*file* embedding stays an Infrastructure concern per ADR-0002 — `TypographyResolver` picks logical names, it doesn't touch `.ttf` bytes.)
3. **Heading size resolution** — `theme.fontSizes.h1-h6` becomes the single source of truth for all three renderers.
4. **Drop caps** — `Paragraph.dropCap` becomes a real, renderer-consumed instruction (currently unread by all three).
5. **Smart quotes — DECIDED: English-only in v1.** Straight `" '` → curly `" " ' '` substitution, theme-level on/off flag. Locale-aware quoting (French `« »`, German `„ "`, etc.) is explicit, tracked future work, not silently wrong — `Book.metadata.language` already carries the ISO 639-1 code this will key off of later.
6. **Widow/orphan avoidance** — `LayoutEngine.paginate()` consults a per-block "orphan risk" flag (last line of a paragraph estimated to land alone at a page boundary) and nudges the break. Best-effort, given `paginate()` is already a heuristic estimate (ADR-0013) — not a hard guarantee (see Risk 1). No signature change (§3).
7. **Hyphenation — DECIDED: deferred to v2.** Real (language-aware, dictionary-based) hyphenation is a materially bigger scope than every other item on this list combined; confirmed out of Sprint 4.
8. **Alignment consistency** — `block.align` respected identically by all three renderers (closes `DOCXRenderer`'s current silent drop).
9. **Quote/Scripture italics as a declared rule — DECIDED: `TypographyResolver`-internal default, not `Theme`-configurable in v1** (CTO Final Decision 1). Moves from three independent per-renderer hardcodes to one internal rule inside `TypographyResolver`. Same visual output today, but now traceable to one decision instead of accidental agreement — and structured so a later sprint can lift it into `Theme` without an architecture change, just an added field.
10. **`QualityMetrics` activation and expansion** (see §5 for the full field list) — `widowsAndOrphans`, `inconsistentSpacing`, `emptyHeadings` (declared since ADR-0008) plus newly added `averageHeadingDepth`, `paragraphDensity`, `lineDensity`, `dropCaps` become real computed values, feeding future Validator/AI-quality-scoring work per the CTO's stated rationale.

---

## 5. Technical Specifications

- **Modify:** `backend/src/domain/models/Theme.ts` — `StyledBook` gains one additive field:
  ```ts
  export interface StyledBook {
    book: Book;
    theme: Theme;
    blockStyles: Record<string, ResolvedBlockStyle>;
    blockTypography?: Record<string /* block.id */, ResolvedTypography>;  // populated by TypographyResolver
  }
  ```

- **New:** `backend/src/domain/models/ResolvedTypography.ts`
  ```ts
  export interface ResolvedTypography {
    runs: TypeRun[];
    dropCap: boolean;
    orphanRisk: boolean;
  }

  export interface TypeRun {
    text: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikethrough: boolean;
    superscript: boolean;
    subscript: boolean;
    smallCaps: boolean;
    linkUrl?: string;
  }
  ```

- **New:** `backend/src/domain/services/TypographyResolver.ts` — concrete class, pure function over Domain types, zero infra deps (ADR-0002). `resolve(styled: StyledBook, options?: TypographyOptions): StyledBook` — returns a new `StyledBook` with `blockTypography` populated (immutable, no mutation of the input).

- **Modify:** `backend/src/domain/services/LayoutEngine.ts` — **no signature change.** `estimateBlockHeight()` reads `styled.blockTypography?.[block.id]?.orphanRisk` when present (optional field — code must tolerate it being absent, e.g. if `TypographyResolver` is ever skipped).

- **Unchanged:** `backend/src/domain/models/PaginatedBook.ts`, `backend/src/domain/ports/Renderer.ts`.

- **Modify:** all three renderers — consume `styled.blockTypography?.[block.id]?.runs` instead of `block.text` directly; delete each renderer's private font/heading-size/italic-hardcode logic.

- **`PDFRenderer` additionally:** embed 3 font families (resolves ADR-0021, expanded by CTO Final Decision 2):
  - `backend/assets/fonts/Gelasio-{Regular,Bold,Italic,BoldItalic}.ttf` (SIL OFL) — serif, replaces Georgia/Times fallback
  - `backend/assets/fonts/Inter-{Regular,Bold,Italic,BoldItalic}.ttf` (SIL OFL) — sans-serif, replaces Helvetica fallback
  - `backend/assets/fonts/JetBrainsMono-{Regular,Bold,Italic,BoldItalic}.ttf` (Apache 2.0) — monospace, replaces Courier fallback
  All loaded via `doc.registerFont()`; `resolveFont()`'s regex-based family detection is kept (still needed to decide *which* of the 3 families a given theme font name maps to) but its output changes from a PDFKit standard-14 name to one of these 3 registered family names.

- **`Theme` interface — NO CHANGES this sprint** (CTO Final Decision 1). The v2 draft's proposed `blockRules`/`typography` additive fields are dropped; block-type rules (quote italics, smart-quote on/off, drop-cap on/off) are `TypographyResolver`-internal defaults/constructor options (§6's `TypographyOptions`) for v1, not `Theme` data. This can be lifted into `Theme` later without an architecture change.

- **Modify:** `backend/src/domain/models/Book.ts` — `QualityMetrics` gains 4 fields beyond what ADR-0008 already declared:
  ```ts
  export interface QualityMetrics {
    // ...existing fields unchanged...
    widowsAndOrphans: number;
    inconsistentSpacing: number;
    emptyHeadings: number;
    // New, added this sprint (functional definitions locked, CTO Final Decision 4):
    averageHeadingDepth: number;   // mean of Heading.level across all Heading blocks (1-6); 0 if none
    paragraphDensity: number;      // Paragraph block count / PaginatedBook.pages.length
    lineDensity: number;           // estimated total lines across all Paragraph blocks (LayoutEngine's WORDS_PER_LINE heuristic) / Paragraph block count
    dropCaps: number;              // count of blocks where TypographyResolver resolved dropCap: true
  }
  ```
  Functional definitions are locked (see "CTO Final Decisions — Round 2" above); exact rounding/edge-case handling (division by zero, etc.) is a `BookMetricsCalculator` implementation detail for commit 9 (§8), refined further alongside `ValidatorEngine`.

---

## 6. Public Interfaces (draft)

```ts
// domain/services/TypographyResolver.ts
export class TypographyResolver {
  resolve(styled: StyledBook, options?: TypographyOptions): StyledBook;
}

export interface TypographyOptions {
  smartQuotes?: boolean;  // default true (English-only substitution, §4 item 5)
  dropCaps?: boolean;     // default true; per-call override, not a Theme field (CTO Final Decision 1)
}
// Block-type rules (e.g. quote/scripture italics) are NOT part of this options
// surface in v1 - they're internal TypographyResolver defaults, not caller-configurable
// at all yet (CTO Final Decision 1). Only smartQuotes/dropCaps are exposed as options,
// and only because ExportManuscriptUseCase already needs an on/off switch for them today.

// domain/services/LayoutEngine.ts — UNCHANGED
export class LayoutEngine {
  paginate(styled: StyledBook, layout: PageLayout): PaginatedBook;
}

// domain/ports/Renderer.ts — UNCHANGED
export interface Renderer<TOutput> {
  render(book: PaginatedBook, context: RenderContext): Promise<TOutput>;
}
```

`ExportManuscriptUseCase` gains one constructor dependency (`TypographyResolver`, concrete class, not an interface — matching how it already takes `ThemeEngine`/`LayoutEngine` as concrete classes) and one extra call between `applyTheme()` and `paginate()`:

```ts
const styled = this.themeEngine.applyTheme(book, theme);
const typeset = this.typographyResolver.resolve(styled);   // new
const paginated = this.layoutEngine.paginate(typeset, request.pageLayout);  // same param type as before (StyledBook), richer content
```

Its own public shape (`UseCase<ExportRequest, Buffer>`) is unchanged — no HTTP/DTO impact.

---

## 7. ADRs to Add / Update (draft text — written into `DECISIONS.md` only after approval)

**New (draft numbers, to be finalized at approval time):**

- **ADR-0022 (draft): Typography Resolution Pipeline**
  ```
  AST (Book)
    ↓
  Theme (ThemeEngine → StyledBook.blockStyles)
    ↓
  Typography Resolution (TypographyResolver → StyledBook.blockTypography)
    ↓
  Pagination (LayoutEngine.paginate, unchanged signature, reads blockTypography)
    ↓
  Rendering (PDFRenderer | DOCXRenderer | EPUBRenderer)
  ```
  Decision: `TypographyResolver` is a concrete Domain class (not a port — same rule as `ThemeEngine`/`LayoutEngine`, exactly one correct resolution for our own Book model). It enriches `StyledBook` in place (new object, same type) rather than introducing a new pipeline type, keeping `LayoutEngine`, `PaginatedBook`, and `Renderer<TOutput>` signature-stable. Named "Resolver" rather than "Engine" because its job is resolving font/size/weight/dropCap *decisions* per block from `Theme` + `Block`, not performing any drawing/rendering itself — the renderers remain the only components that draw.

- **ADR-0023 (draft): Font Embedding — Gelasio, Inter, JetBrains Mono** — resolves ADR-0021's deferred implementation, expanded by CTO Final Decision 2 to all 3 logical font categories (serif/sans-serif/monospace) rather than serif alone; records the actual asset sources/versions/licenses (SIL OFL for Gelasio and Inter, Apache 2.0 for JetBrains Mono) and `PDFRenderer.registerFont()` integration.

- **ADR-0024 (draft): Hyphenation and Locale-Aware Smart Quotes Deferred to v2** — explicit scope cut, not a silent gap. Records both the hyphenation deferral and the smart-quotes-English-only-v1 decision in one place, since they're the same category of "real, scoped-out work" decision.

**Existing ADRs to annotate** (not rewritten, per ADR-0007/0010 precedent):
- ADR-0008 — note `QualityMetrics` finally wired up (and expanded) by ADR-0022.
- `RENDERING_PIPELINE.md` Step 2 — the "Typography extension seam" note gets a "resolved by ADR-0022" pointer.
- ADR-0013 — pagination heuristic gains a widow/orphan hook via `blockTypography`; annotate the existing "not guaranteed to agree exactly" caveat as now also covering orphan-risk nudges.
- ADR-0016 — note `StyledBook`'s keyed-lookup pattern (established there for `blockStyles`) is reused identically for `blockTypography`, avoiding a parallel new type.
- ADR-0019 finding 1 — note the Georgia gap resolved by ADR-0023.
- ADR-0021 — note the Gelasio *decision* (already recorded there) is now *implemented* per ADR-0023.

---

## 8. Commit Plan

Same discipline as Sprint 2/3: small atomic commits, green build/tests before each next step, on `feature/sprint-4-typography-engine` (ADR-0017 — no direct-to-`main` implementation).

1. `domain(typography): add ResolvedTypography/TypeRun types, extend StyledBook` — types only, `blockTypography?` added to `StyledBook`
2. `domain(typography): TypographyResolver.resolve() — inline run parsing` — `Block.inlines` → `TypeRun[]`, unit tests
3. `domain(typography): TypographyResolver — drop caps, smart quotes (English v1), block-type rules` — unit tests
4. `domain(layout): LayoutEngine reads blockTypography for orphan-risk nudge` — **no signature change**, update `LayoutEngine.test.ts` with new fixtures only
5. `infra(pdf): PDFRenderer consumes TypeRun spans, deletes private resolveFont()` — update `PDFRenderer.test.ts`
6. `infra(pdf): embed Gelasio/Inter/JetBrains Mono font assets (resolves ADR-0021)` — add `.ttf` files (12 total: 3 families × 4 weight/style combinations) + `registerFont()` calls, visual smoke check across all 3 families
7. `infra(docx): DOCXRenderer consumes TypeRun spans + theme-driven heading sizes` — update `DOCXRenderer.test.ts`
8. `infra(epub): EPUBRenderer consumes TypeRun spans (→ <strong>/<em>/...)` — update `EPUBRenderer.test.ts`
9. `domain(metrics): BookMetricsCalculator populates QualityMetrics widow/orphan/spacing/heading fields + averageHeadingDepth/paragraphDensity/lineDensity/dropCaps` — resolves ADR-0008's deferred item, implements §5's expanded metric list
10. `test: E2E export regression across all 3 formats with a real DOCX from backend/uploads/` — same "verify with a real file" discipline as every prior sprint; run the full `docs/REAL_EXPORT_CHECKLIST.md` (companion governance doc, this session)
11. `docs: ADR-0022/0023/0024 + CURRENT_STATE.md + TODO.md + VERSIONS.md`

---

## 9. Acceptance Criteria

- All 133 existing tests still pass, plus new tests for `TypographyResolver`/`LayoutEngine`/each renderer's changed behavior
- A real DOCX from `backend/uploads/` containing at least one bold/italic run, one `dropCap` paragraph, and one long paragraph near a page boundary, exported to `.docx`/`.pdf`/`.epub` via the running dev server, visually shows: bold/italic actually rendered (not flattened to plain text) in all 3 formats; drop cap applied where marked; no widowed single line at a PDF/DOCX page top
- `QualityMetrics.widowsAndOrphans`/`dropCaps`/etc. (all 4 new + 3 ADR-0008 fields) return real, non-hardcoded-zero numbers on a fixture with known issues
- `PDFRenderer`'s `ClassicTheme` output uses embedded Gelasio/Inter/JetBrains Mono as appropriate per block (not a PDFKit standard-14 substitute for any of the 3 categories), verifiable via extracted font name in the generated PDF (extending `extractPdfText.ts`)
- Global coverage stays >80%, Domain coverage stays >90% (ADR-0006 gates, unchanged)
- 0 ESLint errors/warnings maintained
- `docs/REAL_EXPORT_CHECKLIST.md` filled out and attached to the PR before merge (companion governance policy, this session)

---

## 10. Migration Strategy

- `StyledBook` gains one additive optional field — non-breaking for any existing consumer that doesn't read it.
- `LayoutEngine.paginate()`, `PaginatedBook`, `Renderer<TOutput>` are **unchanged** — no migration needed for any of them.
- `ExportManuscriptUseCase.execute()`'s public contract (`UseCase<ExportRequest, Buffer>`) is unchanged, so `POST /api/manuscripts/export`'s HTTP contract does not change — no client-facing migration.
- Feature branch `feature/sprint-4-typography-engine`, per ADR-0017.
- All-or-nothing rollout within the branch, no feature flag — matches `docs/CLAUDE.md`'s explicit "no feature flags... when you can just change the code."

---

## 11. Risks

1. **Widow/orphan avoidance layers on top of an already-approximate estimate** (`LayoutEngine`'s heuristic pagination, ADR-0013, already documented as "not guaranteed to agree exactly" with real rendered output — ADR-0019 finding 6C). Mitigation: treat orphan avoidance as a best-effort nudge, document it as such — not a promise of pixel-perfect widow control.
2. **Gelasio's Georgia-metric-compatibility is a design claim (the typeface's own stated intent), not yet visually verified against this project's actual `ClassicTheme` output** the way ADR-0019's PDFKit spike verified other font claims firsthand. Recommend a short verification step (render the same fixture with both fonts, diff visually) during commit 6.
3. **Inline-run rendering is a genuinely new code path in all three renderers** (today none render it — no existing fixture exercises it). PDFKit's multi-styled-run-per-line API, `docx`'s `TextRun[]` array, and HTML `<strong>/<em>` nesting are three structurally different approaches to the same problem — real risk of renderer-specific bugs with no prior art in this codebase to lean on. Recommend a small spike (same pattern as ADR-0019/0020) specifically for PDFKit's multi-run-per-line behavior before committing to its implementation — it's the least proven of the three APIs for this use case.
4. **~~Blast radius~~ — downgraded from v1.** Because `LayoutEngine`/`PaginatedBook`/`Renderer` signatures no longer change (§3), the test-file blast radius that v1 flagged as a top risk is now limited to: `LayoutEngine.test.ts` (new fixtures, no signature migration), and each renderer's own test file (new assertions for inline runs/drop caps). Meaningfully smaller than v1's estimate.
5. **`blockTypography` being optional (`?`) on `StyledBook` means every reader must handle its absence** — a real, if small, discipline risk: a renderer or `LayoutEngine` code path that forgets the `?.` will throw on any `StyledBook` produced by a path that skips `TypographyResolver` (tests using hand-built fixtures, for instance). Mitigation: `ExportManuscriptUseCase` always calls `TypographyResolver.resolve()` before `LayoutEngine.paginate()` (§6), so production code paths are safe by construction; test fixtures need to be updated deliberately, not silently pass by omission.

---

## 12. Test Strategy

- **Domain:** `TypographyResolver.test.ts` (inline-run parsing per `InlineElement` type, drop-cap resolution, smart-quote substitution, block-type rule resolution) — pure unit tests, matching ADR-0006
- **Domain:** `LayoutEngine.test.ts` extended with `blockTypography`-bearing fixtures and new orphan-risk cases — **no signature migration needed** for existing cases
- **Domain:** `BookMetricsCalculator.test.ts` extended for the newly-activated and newly-added `QualityMetrics` fields
- **Infrastructure:** each renderer's existing test file extended with inline-run and drop-cap cases
- **E2E:** `export.test.ts` extended with a fixture containing bold/italic/drop-cap content
- **Real-file verification (non-negotiable, per this project's own repeated lesson — ADR-0019 finding 6C, ADR-0020 addendum, and now formalized as permanent policy — see companion `docs/REAL_EXPORT_CHECKLIST.md`):** a real DOCX from `backend/uploads/` with actual bold/italic runs, exported through the running dev server for all 3 formats, checklist filled out, before any commit in the plan is called done

---

## 13. Documentation Updates

- This document is now `APPROVED` (matching `RENDERING_PIPELINE.md`'s own status-line pattern)
- `docs/DECISIONS.md` — add ADR-0022/0023/0024 as commit 11 of the plan (§8), once implementation is underway rather than before — matches this project's own precedent of writing ADRs alongside the work they govern (ADR-0019/0020 were written as implementation findings accumulated, not purely up front)
- `docs/architecture/diagrams/RENDERING_PIPELINE.md` — annotate Step 2's typography seam note as resolved (pointer, not rewrite — ADR-0007/0010 precedent)
- `docs/CURRENT_STATE.md` — new Sprint 4 section once implementation starts
- `docs/TODO.md` — move Typography Engine from Low Priority backlog to an active IN PROGRESS entry once the branch opens
- `docs/VERSIONS.md` — `v0.5.0-alpha` row already exists as "⏳ Planned"; update to in-progress once the branch opens, Released once tagged
- `docs/REAL_EXPORT_CHECKLIST.md` — filled out per merge, per the new permanent policy (companion governance change, this session)

---

## 14. Open Questions — Resolved

All 4 open questions from the previous draft were resolved by the CTO on 2026-07-17 (see "CTO Final Decisions — Round 2" near the top of this document). Nothing outstanding before implementation can start. Remaining decisions are ordinary implementation-time judgment calls (exact rounding, test fixture design, etc.), not design questions.
