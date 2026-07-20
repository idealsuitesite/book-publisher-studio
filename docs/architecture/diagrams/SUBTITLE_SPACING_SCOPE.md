# Subtitle Spacing in the PDF — Scope Report (measured, no code)

**Status:** 📋 SCOPE REPORT — read-only, measured on `faith-alone`. No production code opened (the `GUTTER_SCOPE.md` format: measure and locate the cause; the CTO decides whether a chantier follows).
**Date:** 2026-07-21. A new front, not a Phase 3 extension.
**Instrument:** `backend/spikes/subtitle-spacing-scope.ts` (rerunnable), plus reading `PDFRenderer.renderTitle`, `ThemeEngine.resolveBlockStyle`, `LayoutEngine.titleHeightOf`.

---

## §0 — The measured finding (faith-alone, Classic theme)

`theme.spacing = { paragraphSpacing: 8, headingSpacing: 16, lineHeight: 1.4 }`. 17 chapters, **79 section subtitles** (78 at level 2 / 18pt, 1 at level 0 / 22pt). As the PDF renders them **today**:

| Subtitle | font size | space ABOVE | space BELOW | below ÷ above |
|---|---|---|---|---|
| chapter title | 24pt | ~8.0pt | ~30.5pt | **3.8×** |
| section L0 (1×) | 22pt | ~8.0pt | ~27.9pt | **3.5×** |
| section L2 (78×) | 18pt | ~8.0pt | ~22.9pt | **2.9×** |

**Every subtitle has 3–4× more space below it than above it.** That is **backwards from typographic convention**: a heading should bind to the text it introduces — *more* space above (to separate it from the preceding block), *less* below (to group it with what follows). Today it is the reverse, so a subtitle visually floats with its *preceding* paragraph and detaches from the text it titles.

## §1 — The exact cause, located

Three facts, each read in the code:

1. **`PDFRenderer.renderTitle` (line 534) spaces a chapter/section title with a bare `doc.moveDown()`** — which advances **one line at the title's own font size** (`lineHeight(size, heading)`): 30.5pt at 24pt, 22.9pt at 18pt. It adds **no space *before* the title at all** — the ~8pt above is just the *previous* block's `paragraphSpacing` (flat) bleeding down.
2. **A heading *block* is spaced completely differently** — `ThemeEngine.resolveBlockStyle` (lines 48–49) gives `heading` blocks `spaceBefore = spaceAfter = headingSpacing = 16pt`: **symmetric, flat, theme-driven, measured**. So the same conceptual element (a heading) is spaced two different ways depending on whether it is a Chapter/Section **title** or a `heading` **block**.
3. **Real DOCX imports produce titles, not heading blocks** (ADR-0031/0032: real `Heading 1/2` become `Chapter`/`Section` titles). So **all 79 of faith-alone's subtitles take the `moveDown` path** — none gets the symmetric 16pt treatment. The inconsistency isn't academic; it's what every real manuscript hits.

**So the cause is not in one file — it is a missing concept:** there is no *title* spacing value in `TypographyResolver`/`ThemeEngine`. `renderTitle` invents one inline (`moveDown()`), and it is (a) size-dependent, (b) below-only, (c) different from `headingSpacing`.

## §2 — This is a typographic-design defect, NOT a render-drift / pagination bug

`LayoutEngine.titleHeightOf` (line 134) **already charges** the `moveDown` as exactly `lineHeight(size, heading)` — the comment even says *"renderTitle's moveDown(), in the face it really uses."* So charged **equals** consumed: the ADR-0051 contract holds, pagination does **not** drift, and this is invisible to the parity lock (which measures page counts, not intra-page spacing). Nothing here is broken in the RENDER_DRIFT sense. **The value is faithfully rendered — it is just the wrong value**, the same distinction ADR-0052's lineage draws: *R2 verifies charged equals consumed, not that what is consumed is correct.*

**PDF only.** DOCX resolves title spacing through `buildHeadingStyles` (Word's own before/after), EPUB through CSS — neither uses `moveDown`. The defect is specific to `PDFRenderer.renderTitle`, matching the CTO's "en PDF" framing.

## §3 — Scope of a fix (for the CTO to weigh — not opened here)

The clean shape: **give titles a real, theme-driven spacing pair** (a `titleSpacing`/`titleSpaceBefore`+`titleSpaceAfter` on `theme.spacing`, or route titles through the same heading-style resolution blocks use), then:
- `renderTitle` spends `spaceBefore` (flat, via `doc.y +=`) before the title and `spaceAfter` (flat, via `spendSpaceAfter`) after it — dropping `moveDown()`. This lets the convention be honoured: e.g. above > below.
- **`LayoutEngine.titleHeightOf` MUST change in lockstep** — replace the `+ lineHeight(size)` term with the new `spaceBefore + spaceAfter`, so charged stays equal to consumed (ADR-0051). **This is the one real risk**: the two must move together, and `PDFRenderer.parity.test.ts` + the corpus page counts must be re-locked (a chapter title's height changes → page counts shift by a known amount → re-baseline deliberately, loud not silent).
- DOCX/EPUB: optionally align their title spacing to the same theme values for cross-format consistency (or leave them — they are already convention-correct via Word/CSS). A decision, not a requirement.

**R2 cost:** touches `PDFRenderer` (the R2-locked component) — but only the title-spacing spend, and with `titleHeightOf` updated in the same change the contract is preserved by construction. Expect a **deliberate parity re-lock** (page counts change), not a contract break.

## §4 — Recommendation

A real, measured typographic defect that every real manuscript hits (79/79 subtitles on faith-alone), cheap to fix conceptually (one theme-spacing pair consumed in two places that already exist), with a **bounded, loud** R2 cost (a deliberate parity re-lock, no new engine). Recommend a **small Level-2 mini-review** to lock: the exact spacing values (above vs below), whether DOCX/EPUB align too, and the parity re-lock — before any code. **Not opened here; awaiting the CTO's go.**

## Related
`RENDER_DRIFT.md` / ADR-0051 (the charged-equals-consumed contract this must preserve; the `moveDown → flat spaceAfter` fix that titles never received), ADR-0052 (*R2 verifies charged equals consumed, not that consumed is correct* — the same lineage), ADR-0031/0032 (why real imports produce titles, not heading blocks), `ThemeEngine.resolveBlockStyle` (the symmetric `headingSpacing` titles don't get), `GUTTER_SCOPE.md` (this report's format).
