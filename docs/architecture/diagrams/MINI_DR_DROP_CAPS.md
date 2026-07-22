# Mini Design Review — Drop Caps (BOOK_PRESENTATION §4 row 4, as amended)

**Status:** AWAITING CTO REVIEW — **no code written.** Builds on the CTO-approved amendment to
`BOOK_PRESENTATION.md` §4 row 4 (scope now includes the trigger; the "already priced" claim
withdrawn as measured-false). No line touches `TypographyResolver` or any renderer until this is
approved.
**Date:** 2026-07-21

---

## 1. What this touches beyond a theme value

Declaring `Theme.presentation.dropCap` is a theme value. **Two things go past it:**

| Site | Change | Beyond a theme value? |
|---|---|---|
| `TypographyResolver` | must decide `dropCap` from the theme's rule + the block's **position** (is this the chapter's first paragraph). Today `resolveBlockTypography` is strictly per-block and has **no positional context at all** — it never learns where a block sits. | **YES — new information must reach the resolver** |
| `LayoutEngine.estimateBlockHeight` | ~~must charge a drop cap's added height, which it currently does not do in any form~~ — **DONE, shipped with the overlap fix (PR #26)**: a drop-cap paragraph is priced as `bandLines` beside the glyph plus the remainder at full width. This capability inherits the pricing instead of building it. | no longer pending |
| The three renderers | consume `dropCap` **already**, at `DROP_CAP_SCALE` — which since PR #26 lives in `domain/services/dropCapMetrics`, no longer duplicated privately in each renderer and now visible to the model. Making it theme-sourced is therefore **one substitution point, not three**. | value swap |

**Not touched, deliberately:** `Block.dropCap` stays in the model as the explicit per-block path.
It is not deleted and not populated. **Open question for the CTO in §5.**

## 2. Why it is necessary

Measured, not assumed (`spikes/dropcap-feasibility-spike.ts`): **0 drop caps across 2,152 real
paragraphs in 4 real manuscripts.** Nothing in the import path writes `Block.dropCap` — there is no
producer anywhere in the pipeline. Theming only the *form*, as originally scoped, would have dressed
a trigger that never fires: a second frozen capability, discovered after the work rather than before.

The trigger must therefore come from the theme, and it must be **positional, never inferential** —
"the first paragraph of a chapter", a structural fact, not a guess about what the author meant. That
is what keeps this outside §6 Q1's prohibition.

**Architectural constraint (§6 Q2):** presentation lives in `Theme`, never as per-block AST
overrides. So the rule is applied at *resolve* time by `TypographyResolver`; the import path is not
taught to write `dropCap` into the AST. Doing it at import would bake presentation into the document
model and violate Q2 directly.

## 3. How R2 is guaranteed — and tested

**IN SCOPE, CTO-ruled: pricing `estimateBlockHeight` for a `dropCap` block is part of THIS
capability's delivered work — not a separate debt.** (Distinguish it from
`DROPCAP_PARAGRAPH_ATOMICITY`, which *is* accepted debt and is only made observable here.) The
principle in §3.1 below — *the charged property must equal the real measurement against the
renderer* — is a **directing principle, not an option**, per the CTO's verdict.

**The premise the amended §4 row now carries: height impact is REAL and currently UNPRICED.**
`estimateBlockHeight` never mentions `dropCap`, so the model charges a drop-cap paragraph as if its
first character were body-sized while the renderer draws it at 2.5×. Today that costs nothing only
because no drop cap ever renders. **The moment the trigger fires, it becomes a live under-charge —
precisely the charged-vs-consumed class RENDER_DRIFT closed.**

Three instruments, each asserting the property that would be violated:

1. **Pricing test.** A drop-cap paragraph must be priced strictly higher than the same paragraph
   without one, and priced at what the renderer really draws. **The exact added height must be
   MEASURED against the renderer during implementation, not assumed from `DROP_CAP_SCALE` arithmetic**
   — the same discipline that caught the list-prefix under-charge, where the naive estimate made
   drift worse.
2. **Atomicity test (CTO-required, `DROPCAP_PARAGRAPH_ATOMICITY`).** A drop-cap paragraph too long
   for the page remainder must produce a **measured reconciliation**, never a silent overflow. The
   behaviour is accepted debt and is NOT corrected here; ADR-0051 requires only that it be loud.
3. **Parity byte-stability.** `ClassicTheme` declares `scope: 'none'` — the shipped theme grows no
   drop caps, so `PDFRenderer.parity.test.ts` must stay at **238 pages / 2 reconciliations**. Whether
   Classic ever adopts drop caps is an aspect decision reserved for the screenshot loop, exactly as
   with accent colours. Movement in either number means the capability leaked into the shipped theme
   and it stops and returns to review.

**Tri-format proof (ADR-0050),** with a test theme declaring `scope: 'chapterOpening'`: PDF first
glyph rendered at the declared scale · EPUB `::first-letter` CSS · DOCX enlarged first run.

## 4. What this capability is NOT — recorded, per CTO

It themes a **known v1 approximation**: an enlarged first character with **no text wrap-around**, in
all three renderers. The theme may vary scale and form *within* that approximation, **not beyond it**.
This is accepted for this scope, explicitly, not overlooked. Real wrap-around — a line-aware layout
problem — would be **its own chantier with its own R2**, never a silent extension of this one.

## 4bis. OPEN — three renderers, three strategies (**THE FIRST POINT to settle when this review reopens**)

**CTO ruling, 2026-07-21:** when this document is reopened for implementation, this question is
**the first item of the Design Review, not a note in passing.** A single theme-declared scale
masking three different behaviours is exactly the class of divergence this whole chantier refused
to leave invisible. It must be *decided*, not rediscovered at the moment of writing the theme.

**Recorded here, in the document that will be reopened, rather than left in the fix's review.**

Measured during the `DROPCAP_TEXT_OVERLAP` investigation: the three renderers implement drop caps by
three *different* strategies — **EPUB wraps text around the glyph** (`float: left`, correct);
**DOCX grows the line box** (a big first letter, degraded but lossless, confirmed in Word 16.0);
**PDF indents the overlapped lines** (shipped, PR #26). A single theme-declared drop-cap
*scale* therefore means three different things in three formats, and produces three different
paragraph heights for the same declared value.

**To settle before any theme wiring:** is that divergence acceptable under ADR-0050 (the declared
value reaches each format's native mechanism), or must the strategies converge first? **Not decided.
Not to be rediscovered.**

### §4bis RE-MEASURED (2026-07-22, queue item 5 — the convergence dossier; the decision is the CTO's, taken nowhere below)

Re-verified against `main` at `19eb54d` (non-negotiable #7 — the overlap fix, the shared pricing
and the `docx` library had all moved since this section was written). **Three premise shifts:**

1. **Two of the three formats ALREADY converge visually.** Since PR #26, PDF's strategy is
   glyph-at-scale **with the band lines indented beside it** (`renderRunsWithDropCap` +
   `dropCapGeometry`) — visually a true drop cap, not the "enlarged letter, no wrap" §4 describes.
   EPUB floats (`.dropcap { float: left … }`) — the same visual concept. **The divergence has
   narrowed to ONE outlier: DOCX** (enlarged inline run; Word grows the line box — the "degraded
   but lossless" form). §4's "no wrap-around in all three renderers" is stale on two counts and
   survives only as a description of DOCX.
2. **The "three different paragraph heights for one declared value" concern has an R2 dimension
   only in PDF — and that one is already priced.** DOCX reflows in Word and EPUB is reflowable;
   neither height is a locked artifact (the exact asymmetry pagination already accepts, ADR-0045).
   The PDF height runs through the shared `dropCapMetrics` (model and renderer, same arithmetic,
   same measured inputs). The spacing already converges too (`DROP_CAP_GUTTER_EM` mirrors the
   EPUB stylesheet's `padding-right: 0.08em`).
3. **NEW, decisive for the cost side: the installed `docx` 9.7.1 natively supports Word's REAL
   drop-cap mechanism** — `IBaseFrameOptions.dropCap` (`DropCapType`) with `lines`, the frame
   properties Word's own "Drop Cap" command produces (`dist/index.d.ts:916-929`, read not
   assumed). When this section was written, converging DOCX was an unknown, presumed-expensive
   path; it is now a bounded, library-supported change (still owing a spike in real Word for
   frame quirks before any lock — the ADR-0019/0020 discipline).

**The two real options (the taste/architecture stop — the CTO's call):**

- **Option A — converge UP: DOCX adopts Word's native drop-cap frame.** All three formats then
  render the same visual concept (a glyph `bandLines` tall with text beside it), each via its
  native mechanism; the theme's declared scale means ONE thing everywhere. Cost: a DOCX renderer
  change + a real-Word spike (frame borders/spacing/compat quirks); zero R2 surface (Word
  reflows). This is the option premise-shift 3 just made cheap.
- **Option B — accept the divergence, disclosed:** each format keeps its current native strategy;
  the declared value means "first letter at N× scale", with line behaviour per-format (the
  pagination-asymmetry precedent). Cheapest; but it ships the typographically weakest form in the
  format authors open most (Word), and §4bis's own founding instinct — *a single declared value
  masking different behaviours is the divergence class this chantier refused to leave invisible* —
  weighs against it now that convergence is cheap.

**What the dossier asserts, and stops at:** the outlier is DOCX alone (1); R2 is not the deciding
axis (2 — PDF is priced, the others reflow); the cost objection to convergence has materially
weakened (3). If A is chosen, §4's "v1 approximation" framing updates (the capability would theme
a real drop cap in all three formats) and the A-spike precedes any wiring. **The decision — A or
B — is not taken here.**

## 5. Risks, and one open question

- **The pricing is wrong in either direction.** Under-charge → overflow and reconciliation pages; over-charge → under-full pages. Instrument: §3.1 plus parity. This is the single largest risk, and the reason §3.1 insists the added height be measured rather than computed from the scale factor.
- **The trigger fires where it should not** (a chapter whose first block is not a paragraph, an empty chapter, a chapter opening on a split continuation). These are positional edge cases and belong in the resolver's own tests, enumerated before implementation rather than discovered by a real manuscript.
- **Classic drifts visually** → guarded by `scope: 'none'` plus parity byte-stability.
- **`Block.dropCap` — RESOLVED by the CTO, against my recommendation.** I proposed keeping it alive as a per-block override path for future structure editing. **Overruled, and correctly:** BOOK_PRESENTATION §6 Q2 already locked *"block presentation lives in `Theme`, never per-block AST overrides"* when this chantier opened. Keeping the field as an override mechanism would contradict a locked decision even while nobody activates it — my recommendation had simply failed to check it against that lock. **Decision: deprecated, not removed** — removal touches `Book.ts` and several consumers and deserves its own review rather than being a side effect of this one. Recorded in `docs/DECISIONS.md` so a future session does not rediscover the field and hesitate between the two readings.
