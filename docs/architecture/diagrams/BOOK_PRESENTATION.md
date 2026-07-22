# Book Theme & Presentation System — Design Review (Phase 1)

**Status:** ✅ **APPROVED (CTO verdict 2026-07-21) — all five §6 questions answered and locked:** (1) no heuristic callout import mapping in v1 — a false callout is worse than none; (2) block presentation lives in `Theme` as declared styles, never per-block AST overrides; (3) EPUB fidelity standard = *declared value reaches the format's native mechanism*, not pixel parity; (4) image dimensions via a minimal in-repo parser — if a library is ever chosen instead, that is a full new-dependency decision with its own review line (the Radix precedent, no silent exception); (5) the second theme's aesthetic identity is chosen by the CTO through the screenshot calibration loop, never by engineering. **R2 (the height contract) is non-negotiable and must be traced by a TEST per capability, not only by the §4 table.** Sequencing authorized: **Phase 2 (image pipeline) starts now**; Phase 3 waits for Phase 2's tri-format proof, reviewed by the CTO. Structure editing (EXPLORER_PARITY) stays gated behind its own future review. The freeze on Validation evolution / Editorial AI / Publishing stands untouched.
**Date:** 2026-07-21
**Governance note:** the freeze on Validation evolution / Editorial AI / Publishing stands — this chantier is orthogonal and does not touch them. Every current-state claim in §2 was verified in the real code, not remembered.

---

## 1. Scope, as fixed by the CTO

**In:** text/accent colors · highlight blocks (callouts, styled quotes) · drop caps · **real image embedding** (replacing the placeholder fallback) · per-theme typography variations.
**Explicitly out (magazine, deferred):** multi-column layout · free-grid composition · text wrap around images.
**Standing law:** ADR-0050 — every capability must be verifiable in all three formats (DOCX/PDF/EPUB) before it counts as delivered. No single-format richness.

## 2. Current state, measured (what actually exists today)

1. **The `Theme` model already has the right skeleton** (`domain/models/Theme.ts`): `fonts{heading,body}`, `fontSizes{h1..h6,body,small}`, `colors{text,accent}`, `spacing`, `runningHead`. One theme resides (`ClassicTheme`); the UI's second slot is honestly "More themes are being set".
2. **`colors.accent` has ZERO consumers.** `ThemeEngine` assigns `theme.colors.text` to every block and heading (`ThemeEngine.ts:43,52`); nothing anywhere reads `accent`. A declared capability, unrendered — the first honest step of this whole chantier is making an existing field true.
3. **Block presentation is hardcoded per renderer, not themed.** Quote/scripture: PDF indents 36pt (`PDFRenderer.ts:486`), EPUB hardcodes `blockquote { margin-left: 1.5em }` in its CSS, DOCX has its own case — three sets of magic values that happen to agree in spirit. Any theme variation today would require editing three renderers.
4. **Drop caps are already tri-format wired at the trigger level**: `TypographyResolver` resolves `dropCap` per block; all three renderers consume it. What is NOT themed: size/face/scope are renderer-local choices.
5. **Images: the model and all three renderers already consume `Block.base64` — nothing populates it.** Verified end to end: `PDFRenderer` (`doc.image` at :470), `DOCXRenderer` (`ImageRun` at :469-476), `EPUBRenderer` (writes the file at :296) all have the real path AND the placeholder fallback; `HtmlNormalizer` copies `src` into `image.url` and never parses mammoth's inline data-URLs into `base64`; `MammothParser` passes no image options. **The placeholder problem is an import-side wiring gap, not a rendering gap** — which makes Phase 2 much narrower than assumed.
6. **No callout block exists.** The Block union is paragraph/heading/quote/scripture/list/table/footnote/image/page-break/divider.
7. **Fonts that are REAL in PDF**: `PdfFontRegistry` embeds Gelasio, Inter, JetBrains Mono (ADR-0023). `ClassicTheme` declares Georgia; the registry maps it. Any new theme's font claims meet a hard registry constraint (§4.6).

## 3. The boundary with the Professional Layout Engine — explicit, per CTO

**Layout Engine owns WHERE things go** (geometry): pagination, margins, gutter (ADR-0043, still open, still its), page breaks, splitting, keep-with-next, blank pages.
**The Presentation System owns HOW things look** (dress): color, face, size variation, ornament, block styling (indents, rules, callout chrome), drop-cap form, image presentation.

Two rules make the boundary load-bearing rather than decorative:

- **R1 — No new engine.** This system is the *existing* `Theme` model + `ThemeEngine` resolution, grown — renderers consume resolved styles and stop owning presentation constants. The Sprint-5 reflex that rejected the sixth engine ("Document Intelligence") applies identically here: capability growth inside an existing seam beats a new box on the diagram.
- **R2 — The height contract (ADR-0051's corollary).** Any presentation choice that consumes vertical space — callout padding, drop-cap line span, image height, quote spacing — MUST be priced through `TextMeasurer`/`estimateBlockHeight` before a renderer draws it. A presentation system that changes heights behind the model's back would manufacture exactly the render drift we just spent a chantier killing. Every §4 capability names its height impact.

## 4. Capabilities — each with its tri-format verification path (ADR-0050)

> **Delivery annotations (2026-07-22, added at the callouts merge so this frozen review cannot
> mislead):** row 3 (callouts) is **DELIVERED** via `MINI_DR_CALLOUTS.md` — with two premises
> re-measured and amended there: Shape B (an additive `Paragraph.callout` field) replaced the
> row's "NEW `Block` type" (the union cost measured at 9 exhaustive sites), and the "corpus
> fixture must contain one" clause was found unsatisfiable without fabrication (census: zero
> callout-shaped corpus content) — replaced by the real-manuscript + real-author-gesture proof.
> Row 4 (drop caps) is **DELIVERED** via `MINI_DR_DROP_CAPS.md` (merged `aa5ac9b`), as reframed
> by its own §4: a REAL tri-format drop cap, no longer the v1 approximation this table assumed.
> Rows 1, 2*, 5, 6 statuses: 1 delivered (accent, Phase 3), 2 remains FROZEN behind
> `C1_QUOTE_PRESENTATION_UNBLOCK`, 5 delivered (Phase 2, §4bis), 6 delivered (typography tuning).

| # | Capability | Mechanism (sketch) | Height impact | Verified by (per format) |
|---|---|---|---|---|
| 1 | Text + accent colors | `Theme.colors` grows (headings, accents on titles/ornaments); ThemeEngine resolves per block; renderers consume only resolved values | none | PDF: color operators vs declared palette (PQB §5); DOCX: `styles.xml` color check (PQB §4); EPUB: CSS diff vs theme (PQB §6) |
| 2 | Styled quotes/scriptures | The three hardcoded presentations (36pt / 1.5em / DOCX case) move into `Theme` as one declared block style (indent, italic, attribution, optional rule) | indent changes wrap width → measured via existing `measureHeight(width)` | same tri-format checks + parity test unchanged (`unplannedPageBreaks` stays 2) |
| 3 | Callout blocks | NEW `Block` type `'callout'` (+ DTO + mappers); themed chrome (background/border/padding) | padding + border enter `estimateBlockHeight` explicitly | tri-format render presence + the height-contract check; corpus fixture must contain one |
| 4 | Drop caps per theme | trigger stays `TypographyResolver`; **form** (scale, face, span) moves to `Theme` | span is already priced atomic (Phase B exclusion) — formalize | PDF: first-glyph size/position (PQB §5 crit 4); EPUB: `::first-letter` CSS; DOCX: run-format check |
| 5 | Real images | Populate `Block.base64` at import (parse mammoth's inline data-URLs in `HtmlNormalizer` — renderers already consume); themed sizing/caption | image height enters the model from REAL dimensions, not `DEFAULT_IMAGE_HEIGHT` | PQB already wrote the checks: §5 crit 6, §4 crit 6, §6 crit 4 |
| 6 | Typography variations | New themes declare fonts — **hard constraint: only faces `PdfFontRegistry` really embeds** (PQB "NO_FONT_FALLBACK"); DOCX/EPUB name the same families | line heights differ per face — already handled (`lineHeight(size, {theme})`, the RENDER_DRIFT fix) | font-object inspection (PDF), `fonts.xml` (DOCX), CSS `font-family` (EPUB) |

### Amendment to §4 row 4 — Drop caps (CTO-approved 2026-07-21, after the feasibility measurement)

**The row as originally approved read, verbatim:**

> | 4 | Drop caps per theme | trigger stays `TypographyResolver`; **form** (scale, face, span) moves to `Theme` | span is already priced atomic (Phase B exclusion) — formalize | PDF: first-glyph size/position (PQB §5 crit 4); EPUB: `::first-letter` CSS; DOCX: run-format check |

**Two things in it are now known to be false. Both were found by measuring before designing
(`backend/spikes/dropcap-feasibility-spike.ts`), which is why the row is amended rather than built on.**

1. **"trigger stays `TypographyResolver`" assumed a trigger exists. It does not.** `Block.dropCap` is
   declared (`Book.ts:166`), read by `TypographyResolver`, `LayoutEngine`, `BookMetricsCalculator`,
   `TypographyRule` and all three renderers — and **written by nothing in the import path**. Measured:
   **0 drop caps across 2,152 real paragraphs in all 4 corpus manuscripts.** Theming the *form* of a
   trigger that never fires would have produced a second frozen capability. **Scope amended, CTO-approved:
   the theme declares WHEN a drop cap applies as well as what it looks like** — as a positional
   typographic convention (first paragraph of a chapter), never an inference about content. This does not
   reopen §6 Q1: Q1 forbids guessing an authorial intent the document never expressed; a theme-imposed
   convention consults only structure (is this the chapter's first paragraph), never intent.
2. **"span is already priced atomic (Phase B exclusion) — formalize" conflates two different things.**
   The Phase B exclusion (`LayoutEngine.ts:222`) prevents a drop-cap paragraph from being *split*. It does
   **not** price the drop cap's extra height: `estimateBlockHeight` never mentions `dropCap` at all, so the
   model charges a drop-cap paragraph as if its first character were body-sized while the renderer draws it
   at `DROP_CAP_SCALE` (2.5×). **Height impact is therefore NOT "already handled" — it is real, unpriced,
   and currently invisible only because no drop cap ever renders.** See `MINI_DR_DROP_CAPS.md`.

**Also fixed by the CTO in the same verdict:** this capability themes a **known v1 approximation** — an
enlarged first character with **no text wrap-around**. The theme may vary scale and form *within* that
approximation, not beyond it. Real wrap-around, if it is ever needed, is its own chantier with its own R2,
never a silent extension of this one.

## 4bis. Phase 2 — ✅ EXECUTED and CTO-validated (2026-07-21)

Real image embedding shipped tri-format, exactly along §2.5's narrow path: `HtmlNormalizer` parses mammoth's data-URLs into `Block.base64`; the in-repo PNG/JPEG/GIF probe (Q4 as locked, zero dependency) supplies real intrinsic dimensions; `renderedImageSize()` is THE shared fit-to-column formula consumed by `estimateBlockHeight` (both branches) and `PDFRenderer` — R2 traced by named tests. DOCX now sniffs the real format (was hardcoded `'png'` at 300×200 — lineage bug #9) and EPUB writes the real extension. PDF gained a decode guard: an undecodable image degrades to an observable placeholder (warn + text), never killing the export; **DOCX/EPUB need no equivalent guard — verified empirically, not assumed: both embed the bytes verbatim without ever decoding them (the reader application is their decoder), confirmed by rendering a malformed PNG through both with no throw.** Found on the way: the `images.docx` fixture had carried a malformed PNG its whole life (lineage bug #8). Proof: `imageEmbedding.triformat.test.ts` on the real fixture — PDF `/Subtype /Image` XObject, DOCX `word/media/` bytes, EPUB packaged file, zero placeholders. Backend 567/567, `verify-real-export` 16/16 now exercising real embedding.

## 5. Sequencing (echoes the CTO's phases — nothing here reorders them)

Phase 2 (images) before any theme work: §2.5 shows it is import-side wiring plus real-dimension pricing. Phase 3 builds ONE rich theme end-to-end across all six capabilities, tri-format verified, before a second exists. Phase 4 seats it in the existing gallery slot. Phase 5 extends the quality harness so no capability exists unmeasured — the lesson of the seven-bug lineage applied prospectively.

## 6. Open questions for the CTO (recommendations, nothing locked)

1. **Callout import mapping.** Word has no native "callout". Recommend: **no import mapping in v1** — callouts render when the AST carries them (future structure-editing/authoring creates them; EXPLORER_PARITY.md shows that foundation is coming anyway). Mapping DOCX shaded paragraphs heuristically would risk false callouts — the same false-structure argument that deferred heuristic heading detection.
2. **Where does block presentation live?** Recommend: inside `Theme` as declared block styles (one source, three consumers) — not per-block overrides in the AST (that is authoring, later; and it would bloat the aggregate).
3. **What does "faithful" mean per format for EPUB?** EPUB reflows; drop caps/callout chrome are CSS approximations. Recommend: the review defines fidelity per format explicitly (PQB precedent) — *declared values reach the format's native mechanism* — rather than pixel-parity, which reflowable formats cannot promise.
4. **Image dimensions need probing** (real height pricing requires intrinsic size). Recommend: a minimal dimension parse (PNG/JPEG headers) implemented in-repo over adding a dependency — flag: if a library is chosen instead, that is a new-dependency decision requiring its own line in this review.
5. **The second theme's identity** (Phase 3). Recommend: CTO chooses the aesthetic via the VISUAL_LANGUAGE screenshot loop once capabilities exist — engineering should not pick the book's face.

## Related

ADR-0050 (the law this serves), ADR-0051 + R2 (the height contract), ADR-0023 (embedded fonts = the registry constraint), ADR-0043 (gutter — stays Layout's, untouched here), PUBLICATION_QUALITY_BAR.md (§4-§6 already name most verification checks; Phase 5 implements them), EXPLORER_PARITY.md (Phase 0 audit; shared structure-editing foundation), VISUAL_LANGUAGE.md (the aesthetic loop Phase 3 will reuse).
