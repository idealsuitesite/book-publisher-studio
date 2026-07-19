# Book Theme & Presentation System — Design Review (Phase 1)

**Status:** 🟡 **DRAFT round 1 — awaiting CTO. ZERO code before approval (CTO gate, explicit).** Scope was fixed by the CTO's roadmap decision (2026-07-19: book first; magazine/report deferred to backlog); this draft works strictly inside it.
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

| # | Capability | Mechanism (sketch) | Height impact | Verified by (per format) |
|---|---|---|---|---|
| 1 | Text + accent colors | `Theme.colors` grows (headings, accents on titles/ornaments); ThemeEngine resolves per block; renderers consume only resolved values | none | PDF: color operators vs declared palette (PQB §5); DOCX: `styles.xml` color check (PQB §4); EPUB: CSS diff vs theme (PQB §6) |
| 2 | Styled quotes/scriptures | The three hardcoded presentations (36pt / 1.5em / DOCX case) move into `Theme` as one declared block style (indent, italic, attribution, optional rule) | indent changes wrap width → measured via existing `measureHeight(width)` | same tri-format checks + parity test unchanged (`unplannedPageBreaks` stays 2) |
| 3 | Callout blocks | NEW `Block` type `'callout'` (+ DTO + mappers); themed chrome (background/border/padding) | padding + border enter `estimateBlockHeight` explicitly | tri-format render presence + the height-contract check; corpus fixture must contain one |
| 4 | Drop caps per theme | trigger stays `TypographyResolver`; **form** (scale, face, span) moves to `Theme` | span is already priced atomic (Phase B exclusion) — formalize | PDF: first-glyph size/position (PQB §5 crit 4); EPUB: `::first-letter` CSS; DOCX: run-format check |
| 5 | Real images | Populate `Block.base64` at import (parse mammoth's inline data-URLs in `HtmlNormalizer` — renderers already consume); themed sizing/caption | image height enters the model from REAL dimensions, not `DEFAULT_IMAGE_HEIGHT` | PQB already wrote the checks: §5 crit 6, §4 crit 6, §6 crit 4 |
| 6 | Typography variations | New themes declare fonts — **hard constraint: only faces `PdfFontRegistry` really embeds** (PQB "NO_FONT_FALLBACK"); DOCX/EPUB name the same families | line heights differ per face — already handled (`lineHeight(size, {theme})`, the RENDER_DRIFT fix) | font-object inspection (PDF), `fonts.xml` (DOCX), CSS `font-family` (EPUB) |

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
