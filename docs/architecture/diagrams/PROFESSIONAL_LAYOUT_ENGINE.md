# Professional Layout Engine — Design Review (Sprint 6)

**Status:** ✅ APPROVED (2026-07-17) — round 2 complete, all open questions resolved by explicit CTO decision. Ready for implementation once the CTO gives final go-ahead to branch (same gate used for Sprint 5).
**Date:** 2026-07-17
**Scope:** Sprint 6, chosen from `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md`'s 4 remaining Level-1-mapped engines (Editorial AI Engine, Plugin System, Professional Layout Engine, Publishing Engine) — selected for its lowest-risk profile (no external vendor dependency, no UI requirement, extends existing code), matching the reasoning that selected Validation Engine for Sprint 5.

---

## 1. Objectives

Per `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` §2.4 and `docs/VISION.md`'s target Layout Engine scope ("pagination, margins, headers/footers, chapter-opening-page rules, TOC generation, print optimization"):

1. Close the gap between what `LayoutEngine` does today (pagination estimate + heading keep-with-next only) and what `docs/VISION.md` has always described as its target scope — most of that target scope doesn't exist yet.
2. Give real headers/footers a Domain-level concept, closing a real, evidence-confirmed gap (see §2) where the only implementation is PDF-specific, ad hoc, and shows a hardcoded literal string instead of the actual book's title.
3. Activate two `Chapter` fields declared since before this review but never read by anything: `openingPageStyle` and `startPageNumber`.
4. Automatically generate a Table of Contents from headings — `FrontMatter.toc`/`TableOfContents`/`TOCEntry` are fully modeled but nothing populates them.
5. Introduce the extension point for future automatic layout selection, without building the heuristic itself yet.

---

## 2. Current State — Evidence, Not Assumptions

Read directly from `LayoutEngine.ts`, `PageLayout.ts`, `LetterPageLayout.ts`, `Book.ts`, `ThemeEngine.ts`, `PDFRenderer.ts`, `DOCXRenderer.ts`, `EPUBRenderer.ts`, `ExportController.ts`, `ExportManuscriptUseCase.ts` before writing this review (same discipline as ADR-0019/0020/`TYPOGRAPHY_ENGINE.md`/`VALIDATION_ENGINE.md`):

| Concern | Current state |
|---|---|
| Pagination | `LayoutEngine.paginate(styled, layout): PaginatedBook` — word-count/line-height estimation per block type, forces a new page per top-level chapter, best-effort heading keep-with-next (Sprint 4). Explicitly an estimate: `PDFRenderer` no longer trusts `PaginatedBook.pages.length` for its own footer's page count — it uses PDFKit's real `bufferedPageRange().count` instead. |
| `PageLayout` variety | Type allows `'letter' \| 'a4' \| 'a5'`, but **exactly one instance exists in the entire codebase** (`LetterPageLayout`). No `A4PageLayout`/`A5PageLayout`, no KDP trim sizes. |
| Page layout selection via the API | **Hardcoded.** `ExportController.ts` constructs every export request with `pageLayout: LetterPageLayout` — a compile-time constant, not read from the request. `themeName` *is* caller-selectable (`req.body.theme`); page size is not. |
| Headers/footers | **Ad hoc, PDF-only, not a Domain concept.** `PDFRenderer.drawHeadersAndFooters()` (`PDFRenderer.ts:95-111`) draws a running head reading the **hardcoded literal string `'Book Publisher Studio'`** (not the actual book's title, not theme-driven) and a `Page N of TOTAL` footer using PDFKit's own real page count. `DOCXRenderer`/`EPUBRenderer` have **no page header/footer at all**. `PageLayout`/`Theme`/`StyledBook` have zero header/footer fields. |
| `Chapter.openingPageStyle` (`'right' \| 'left' \| 'any'`) | **Declared (`Book.ts:118`), read nowhere.** |
| `Chapter.startPageNumber` | **Declared (`Book.ts:119`), read nowhere.** |
| Table of Contents | `FrontMatter.toc?: TableOfContents` and `TOCEntry` are fully modeled (`Book.ts:74-79`, `406-418`) but **`.toc` is assigned nowhere in the codebase**. Already flagged from a different angle: `MissingRequiredStyleRule.ts`'s own doc comment (Sprint 5) names "TOC-without-H1" as "feasible against today's Book model... deferred only for scope/time." |
| Theme/layout auto-selection | **None.** `ThemeEngine.applyTheme(book, theme)` always takes a caller-supplied `Theme`. `getTheme(name)` is a pure string-keyed lookup. Page layout is equally always caller/constant-supplied. |

**A real, disclosed finding, not a hypothesis:** the PDF running head literally says "Book Publisher Studio" on every page of every exported book, regardless of what book it is. Resolved in §3, Decision 6 — fixed this sprint, not filed separately.

---

## 3. Round 2 — Locked CTO Decisions

**Decision 1 — Extend `LayoutEngine`, no new class.** `LayoutEngine`'s existing responsibility (pagination, page break decisions, positioning) already covers the same conceptual territory as running headers, footers, page numbering, TOC, and opening-page-side rules — all of them are computed *during* pagination, using data pagination already produces. A new class would introduce a redundant round trip for no separation-of-concerns benefit (unlike `TypographyResolver`, which earned its own class because inline-run resolution is a genuinely different kind of transform from visual-style resolution).

**Decision 2 — Header/footer content lives on `Theme`, as a richer `RunningHead` sub-structure (CTO addition, not just the round-1 default).** A theme decides colors, fonts, margins, heading styles — and, from this sprint on, running head/footer presentation too. Confirmed shape (see §6 for the full type):
```
Theme
 └── runningHead?: RunningHead
       ├── show: boolean
       ├── position: 'left' | 'right' (alternating, for a two-page-spread convention)
       ├── content: 'bookTitle' | 'chapterTitle'
       ├── pageNumber: boolean
       ├── separator?: string
       ├── uppercase: boolean
       ├── font?: string
       └── size?: number
```
This is deliberately more detailed than the round-1 draft's flat `{ show, content, customText }` — the CTO's stated reason: so future themes (Classic, Minimal, Academic, Novel, a Bible/Theology-oriented theme) can each have a genuinely different running-head presentation **without touching `LayoutEngine`** — only `ClassicTheme` gets a populated `runningHead` this sprint (see §5 item 3); the richer shape is what makes that extensibility real, not speculative.

**Decision 3 — PDF and DOCX only; EPUB is explicitly untouched.** EPUB is reflowable — a running head has no fixed page to attach to (same reasoning ADR-0013 already used to exclude EPUB from pagination). Confirmed, no change from the round-1 proposal.

**Decision 4 — TOC as an additive `PaginatedBook.tableOfContents?` field.** Confirmed: page numbers in a `TOCEntry` can only exist once pagination has run, so TOC generation cannot happen earlier in the pipeline. No change from the round-1 proposal.

**Decision 5 — No automatic *selection* heuristic this sprint, but the extension point is built now, not deferred.** Introduces a `LayoutSelector` port (see §6) with exactly one implementation this sprint, `ManualLayoutSelector` (wraps today's caller-supplied-by-name behavior — the only behavior that exists). `AutomaticLayoutSelector` is **named in this design as the intended future second implementation, not built** — a later sprint adds content-driven rules (language, page count, binding type, etc.) as a new class satisfying the same interface, with zero change to the public API or to any caller. This is architecturally different from ADR-0028 principle 1 (don't register a rule that never fires): `LayoutSelector` is a port with one real, fully-functional implementation registered today; `AutomaticLayoutSelector` is a *documented future adapter*, not a stub instance sitting unused in a registry — the same distinction `Renderer<TOutput>` already models (a port can have one real adapter today and gain a second one later without either being a no-op).

**Decision 6 — Fix the hardcoded `'Book Publisher Studio'` running-head string now, as a direct consequence of Decision 2, not a separate ticket.** Once `runningHead.content` is a real, `Theme`-driven choice between the book's actual title and the current chapter's title, the hardcoded string is structurally impossible to keep — this isn't extra scope, it's what building the feature correctly *means*. Matches the ADR-0023 precedent (the `renderTitle()` font-role bug, found and fixed as a side effect of that sprint's own refactor, disclosed in the commit message, not filed separately).

**Confirmed, not resolved by this review — do not guess:** exact KDP/other-platform trim sizes for the new `PageLayout` presets require a real spike against each platform's own published specs (they "change sometimes," in the CTO's own words) before any preset ships — matching the ADR-0019/0020 precedent exactly. This spike happens as commit 1's own prerequisite, not as an assumption baked into the design.

---

## 4. Architecture Impact

```
StyledBook (post-Typography) → LayoutEngine.paginate(styled, layout): PaginatedBook
                                        │
                                        ├── (existing) pages: Page[]
                                        ├── (new) per-page header/footer resolved from
                                        │         styled.theme.runningHead during pagination
                                        ├── (new) tableOfContents?: TOCEntry[] (additive)
                                        └── (new) Chapter.openingPageStyle/startPageNumber
                                              honored during pagination (may insert a blank
                                              page for right/left opening rules; offsets the
                                              page-number sequence consumed by the header/
                                              footer feature above)

LayoutSelector (new port)                    ExportController
 └── ManualLayoutSelector (only impl.,   ←──  calls LayoutSelector instead of
       wraps today's caller-by-name           hardcoding LetterPageLayout
       behavior)
 └── AutomaticLayoutSelector (future,
       named, not built)
```

**No signature change to `LayoutEngine.paginate()`'s existing callers** — same discipline as every prior engine (ADR-0022, ADR-0027): `PaginatedBook` and `Theme` gain additive fields only. `PageLayout`'s `pageSize` union already includes `'a4'`/`'a5'` — adding real instances fills in an already-declared type, not a signature change. `LayoutSelector` is new but additive — `ExportController` is the only caller affected, and its own change is a small, isolated swap (hardcoded constant → port call).

**`PDFRenderer`/`DOCXRenderer` become consumers of `paginated.tableOfContents` and the resolved header/footer content**, mirroring exactly how they became `TypographyResolver`'s consumers in Sprint 4 — each renderer's own private header/footer logic (PDF's hardcoded string; DOCX's total absence) is replaced by reading shared, resolved data. EPUB is explicitly not a consumer (Decision 3).

---

## 5. Functional Specifications (locked)

1. **Real `PageLayout` presets** — `A4PageLayout`, `A5PageLayout`, and KDP-relevant trim sizes, exact values from the required spike (§3), alongside the existing `LetterPageLayout`, in `domain/layouts/`.
2. **`LayoutSelector` port + `ManualLayoutSelector`** — `ExportController`/`ExportRequest` gains a page-layout selection field (mirroring how `themeName` already works), resolved through `ManualLayoutSelector` (a name/registry lookup, same shape as `getTheme()`), replacing the hardcoded `LetterPageLayout` constant. `AutomaticLayoutSelector` is documented as the reserved future second implementation, not built.
3. **`RunningHead` on `Theme`** — `ClassicTheme` gets a real, populated `runningHead` (book title, page numbers on, matching today's PDF defaults minus the hardcoded string); the type itself supports future themes choosing differently or opting out (`show: false`).
4. **`LayoutEngine` resolves per-page header/footer content** from `styled.theme.runningHead` during pagination, attached to `PaginatedBook` in a form `PDFRenderer`/`DOCXRenderer` can render directly (exact shape is implementation detail for the commit that builds it).
5. **`Chapter.openingPageStyle` honored** — `'right'`/`'left'` forces the chapter's starting page to the correct side (inserting a blank page where needed); `'any'`/unset keeps today's behavior.
6. **`Chapter.startPageNumber` honored** — resets/offsets the visible page-number sequence starting at that chapter, consumed by item 4.
7. **Automatic TOC generation** — walks all `Heading` blocks post-pagination, respects `TableOfContents.maxDepth`, populates `PaginatedBook.tableOfContents`. Only runs when `TableOfContents.generateAutomatically` is true; a manually-authored `FrontMatter.toc` is never overwritten.
8. **`PDFRenderer` drops the hardcoded `'Book Publisher Studio'` string** (Decision 6) — reads the resolved running-head content instead.
9. **`DOCXRenderer` gains header/footer support** — a genuinely new capability (today: none at all), not a migration of existing behavior.

---

## 6. Technical Specifications (locked public interfaces)

```ts
// domain/models/PageLayout.ts — unchanged shape, new instances only
export const A4PageLayout: PageLayout = { pageSize: 'a4', width: /* from spike */, height: /* from spike */, ... };
export const A5PageLayout: PageLayout = { pageSize: 'a5', ... };
// + KDP trim-size presets, exact values from the required spike (§3) - not guessed

// domain/models/Theme.ts — additive
export interface RunningHead {
  show: boolean;
  position: 'left' | 'right';
  content: 'bookTitle' | 'chapterTitle';
  pageNumber: boolean;
  separator?: string;
  uppercase: boolean;
  font?: string;
  size?: number;
}

export interface Theme {
  // ...existing fields unchanged...
  runningHead?: RunningHead;
}

// domain/models/PaginatedBook.ts — additive
export interface PaginatedBook {
  styledBook: StyledBook;
  pages: Page[];
  tableOfContents?: TOCEntry[]; // populated only when Book.frontMatter.toc?.generateAutomatically
}

// domain/services/LayoutEngine.ts — signature unchanged, internals gain:
export class LayoutEngine {
  paginate(styled: StyledBook, layout: PageLayout): PaginatedBook;
  // internally: honors Chapter.openingPageStyle/startPageNumber, resolves per-page
  // header/footer content from styled.theme.runningHead, builds tableOfContents
}

// domain/ports/LayoutSelector.ts — new port
export interface LayoutSelectionCriteria {
  requestedLayoutName?: string; // today's only real input - mirrors getTheme()'s name lookup
}
export interface LayoutSelector {
  select(criteria: LayoutSelectionCriteria): PageLayout;
}

// domain/services/ManualLayoutSelector.ts — new, only implementation this sprint
export class ManualLayoutSelector implements LayoutSelector {
  select(criteria: LayoutSelectionCriteria): PageLayout { /* name -> PageLayout registry lookup */ }
}
// AutomaticLayoutSelector - documented future adapter (Decision 5), NOT implemented this sprint.
// Would satisfy the same LayoutSelector interface using book-derived criteria (language, page
// count, binding type, etc.) instead of a caller-supplied name - no API change required when built.
```

**Wiring:** `ExportController` calls `LayoutSelector.select()` instead of hardcoding `LetterPageLayout`; `PDFRenderer`/`DOCXRenderer` read `paginated.styledBook.theme.runningHead` (resolved by `LayoutEngine`) and `paginated.tableOfContents` instead of deciding header/footer content themselves.

---

## 7. Risks

1. **Blank-page insertion (`openingPageStyle`) interacts with page numbering, header/footer, and TOC in the same pagination pass** — get the internal ordering wrong and the three features could disagree with each other. Needs careful sequencing inside `paginate()`, not three independent passes.
2. **KDP trim-size accuracy is a real research gap** — a wrong physical trim size is a real-world printing defect for an actual author, not a cosmetic bug. The required spike (§3) is a hard prerequisite for commit 1, not a nice-to-have.
3. **Automatic TOC generation inherits `LayoutEngine`'s existing "best-effort, not a guarantee" pagination caveat (ADR-0013)** — a generated TOC's page numbers carry the same estimation risk every other page-number-dependent feature in this codebase already has. Worth naming so a future session doesn't treat a TOC mismatch as a new class of bug.
4. **`LayoutSelector`'s one-implementation-today shape is a real, if modest, YAGNI tension** — `AutomaticLayoutSelector` is designed for but not built. Accepted explicitly by the CTO (Decision 5) as a deliberate extensibility investment, not an oversight — worth re-examining if no second implementation ever materializes, same category of accepted risk as `ValidationContext`'s reserved fields (Sprint 5).
5. **`RunningHead`'s 8 fields are locked before any second theme besides `ClassicTheme` exists to exercise them** — `position`/`separator`/`uppercase`/`font`/`size` are real fields with no current consumer variety to validate the shape against (only `ClassicTheme` will populate it this sprint). Same category of risk as Sprint 5's reserved `ValidationContext` fields — disclosed, not hidden.

---

## 8. Commit Plan

Same discipline as Sprints 4/5: small atomic commits, green build/tests before each next step, on a new feature branch (ADR-0017 — no direct-to-`main` implementation).

**Commit 0 (prerequisite, before commit 1): KDP/platform trim-size spike** — real published specs, not guessed, matching ADR-0019/0020's `backend/spikes/` precedent.

1. `domain(layout): A4/A5 + KDP trim-size PageLayout presets` (using commit 0's findings)
2. `domain(layout): LayoutSelector port + ManualLayoutSelector`
3. `application(export): ExportController uses LayoutSelector, replaces hardcoded LetterPageLayout`
4. `domain(layout): Theme gains RunningHead type (additive); ClassicTheme populated`
5. `domain(layout): LayoutEngine resolves per-page header/footer content from Theme.runningHead during pagination`
6. `infra(pdf): PDFRenderer consumes resolved header/footer, drops hardcoded 'Book Publisher Studio' string`
7. `infra(docx): DOCXRenderer gains header/footer support (new capability)`
8. `domain(layout): LayoutEngine honors Chapter.openingPageStyle (blank-page insertion for right/left starts)`
9. `domain(layout): LayoutEngine honors Chapter.startPageNumber`
10. `domain(layout): PaginatedBook.tableOfContents - automatic TOC generation from headings post-pagination`
11. E2E real-file verification pass (`docs/REAL_EXPORT_CHECKLIST.md` — this sprint touches `LayoutEngine`/`PDFRenderer`/`DOCXRenderer` directly, squarely inside the checklist's own required-scope list)
12. `docs`: ADR(s) for the decisions in §3, final `CURRENT_STATE.md`/`TODO.md`/`VERSIONS.md` pass, Sprint 6 Final Report

---

## 9. Acceptance Criteria

- All existing `LayoutEngine.test.ts` cases still pass, unchanged in behavior
- A real DOCX from `backend/verification/` exported to PDF shows: the actual book's title (not a hardcoded string) in the running head, correct page numbers, a chapter with `openingPageStyle: 'right'` actually starting on an odd page, and (if `generateAutomatically: true`) a populated, correctly-ordered table of contents with real page numbers
- Same real DOCX exported to A4 and a KDP trim size produces visibly correctly-sized, correctly-margined output — inspected, not just asserted
- DOCX export gains header/footer where it previously had none — inspected in a real opened `.docx`
- EPUB output is unchanged by this sprint (confirms Decision 3's scope boundary held)
- `ManualLayoutSelector` reproduces today's exact behavior for existing callers (no regression); `AutomaticLayoutSelector` is not present in any registry or wiring (nothing calls a class that doesn't exist)
- Global coverage stays >80%, Domain coverage stays >90% (ADR-0006 gates, unchanged)
- 0 ESLint errors/warnings maintained
- `docs/REAL_EXPORT_CHECKLIST.md` completed as a real PR artifact from the start of this sprint (Sprint 5's own closure found this missing until the PR stage — do it early this time)

---

## 10. Related

- `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` — Level 1, this engine's position
- `docs/VISION.md` — original target scope for "Layout Engine" this review closes the gap against
- ADR-0012 (`Renderer` is a port; `ThemeEngine`/`LayoutEngine` are concrete classes) — precedent for Decision 1 and the `LayoutSelector` port design
- ADR-0013 (pagination is a heuristic, EPUB excluded) — precedent for Decision 3 and Risk 3
- ADR-0019/0020 (spike-before-decide precedent) — the discipline the KDP trim-size spike must follow
- ADR-0022/0027 (additive-field-not-signature-break pattern) — reused for `PaginatedBook.tableOfContents` and `Theme.runningHead`
- ADR-0023 (real bug found and fixed as a refactor side effect, disclosed) — precedent for Decision 6
- ADR-0028 (rule design principles) — the reasoning Decision 5 distinguishes itself from (a real port with one adapter vs. a no-op registry stub)
