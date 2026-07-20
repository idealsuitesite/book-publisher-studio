# Mini Design Review — Accent Colors (BOOK_PRESENTATION §5, capability 1)

**Status:** AWAITING CTO REVIEW — **no code written.** Required by the 2026-07-21 rule before any
line, because wiring `colors.accent` touches renderer code, not only a theme value.
**Date:** 2026-07-21

---

## 0. Correction to what I previously reported

I told the CTO the title colour was *"hardcoded `'#000'` in all three renderers."*
**Measured, that is wrong for two of the three,** and the real scope is markedly smaller:

| Renderer | What is actually there | Cost to wire accent |
|---|---|---|
| **PDF** | `renderTitle` :508 — `.fillColor('#000')` hardcoded. It **already receives `theme`**. | **one token** |
| **DOCX** | **Already theme-driven.** `buildHeadingStyles(theme)` sets `color = theme.colors.text` on Word's *default* Heading-N styles, and its own comment states this resolves *"both Heading blocks and Chapter/Section titles (renderTitle) at once"*. | **one token**, no signature change |
| **EPUB** | **No hardcoded title colour at all** — headings inherit `body { color: theme.colors.text }`. | **one added CSS rule** |

Plus `ThemeEngine.resolveBlockStyle` :43, `theme.colors.text` → `theme.colors.accent` for heading blocks.

**Consequence: no signature changes, no control-flow changes, no threading — four single-line
edits.** This is materially cheaper than the picture I gave, and the CTO should have the corrected
figure before approving.

## 1. What goes beyond a theme value, and why it is necessary

Only one thing genuinely does: **PDF `renderTitle`'s hardcoded `'#000'`**. It cannot be avoided —
it is the literal point where a theme colour would be applied, so touching it *is* the wiring, not
cleanup. The DOCX and EPUB sites are already theme-sourced; they change which field they read.

**Explicitly frozen in this commit, per the CTO's instruction.** The other hardcoded colours found
in `PDFRenderer` are a **different surface** — front matter and chrome, not body headings — and are
*not* needed to wire accent. Not touched, recorded here for a separate increment:
- running heads / footers :332, :341 (`'#000'`)
- title page :442 `'#000'`, :447 `'#333'`, :453 `'#555'`, :457 `'#000'`
- copyright page :479 `'#000'`
- (also out of scope: `renderTitle`'s hardcoded *sizes* `24 / max(12, 22-2·level)` — typography, not colour)

## 2. Classic stays visually stable — the mechanism, stated

`ClassicTheme.colors` is `text: '#000000'`, `accent: '#4A4A4A'`. Once headings consume `accent`,
leaving `#4A4A4A` would silently restyle the **shipped** theme — the aspect decision the CTO
reserved for the screenshot loop. So: **`ClassicTheme.colors.accent` becomes `#000000`** — Classic's
accent *is* its text colour, which is an honest statement about a plain classic book, not a
placeholder. Safe because `accent` has **zero consumers today** (verified). PDF's `'#000'` and
`#000000` emit the same colour operator, so shipped output stays identical.

**Not anticipated here:** whether Classic ever adopts a visible accent, and which one, stays open
for the 2nd-theme screenshot loop.

## 3. R2, the height contract — guaranteed, and how it is tested

**Colour has zero height impact in all three formats.** It changes no wrap width, no font metric,
no spacing — unlike C1's indent, which changed the wrap column. There is no new pricing to add.

That is not an assertion to take on faith; it is falsifiable and will be the gate:
`PDFRenderer.parity.test.ts` must stay **byte-stable — 238 pages, `unplannedPageBreaks` = 2.**
Any movement in either number means colour reached geometry and the premise of this review is
false. **This is the R2 test for this capability.**

## 4. Proof the mechanism is real (ADR-0050, tri-format)

Classic being visually unchanged means the shipped theme cannot prove anything. So the proof uses
**a test theme declaring a distinct accent** (e.g. `#1D4E68`), asserted in all three outputs:
PDF colour operator · DOCX `styles.xml` heading-style `color` · EPUB CSS rule. The test asserts the
declared value **reaches the format's native mechanism** — the fidelity standard fixed in
BOOK_PRESENTATION §6 Q3 — and asserts the property directly, not a proxy.

## 5. Risk if this is wrong

- **A renderer silently ignores accent** → single-format richness, a direct ADR-0050 violation. Instrument: the §4 tri-format test — the only thing standing between "declared" and "true".
- **Classic drifts visually** → an unauthorised aspect change to the shipped theme. Instrument: accent := text colour (§2) plus parity/baseline stability.
- **The zero-height premise is false** → caught by §3; if it moves, the capability stops and returns to review rather than being patched forward.
