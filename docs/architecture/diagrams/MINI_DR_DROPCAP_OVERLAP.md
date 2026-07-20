# Mini Design Review — `DROPCAP_TEXT_OVERLAP` fix (PDF text layout)

**Status:** AWAITING CTO REVIEW — **no code written.** Distinct from `MINI_DR_DROP_CAPS.md`: that
one reviews drop caps as a *theme capability*; this one reviews a *text-layout defect* in
`PDFRenderer`. The theme capability stays frozen in full until this is fixed and verified.
**Date:** 2026-07-21

---

## 1. The defect, and what changes

Measured: `"…measurement carries the same words…"` renders with `carr` painted over by the drop-cap
glyph — four characters unreadable on every drop-cap paragraph. Cause:
`PDFRenderer.renderRunsWithDropCap` draws the glyph at 2.5× and then calls `renderRuns` for the
remainder **at full column width**, so the lines the glyph descends into start at the left margin,
underneath it. **The defect is horizontal.**

**What changes:** the lines the glyph spans must wrap at a narrowed width and start to the right of
the glyph. **This is text layout inside `PDFRenderer` — not a theme value, not the Presentation
System.** It is the smallest change that makes the output readable; it is *not* a general
wrap-around engine (arbitrary shapes, multi-glyph ornaments) — that stays out.

## 2. Measured inputs (against the real PDFKit document, not constants)

Classic theme at kdp-5x8 (`backend/spikes/dropcap-span-spike.ts`):

| | measured |
|---|---|
| body size / line height | 11pt / **13.96pt** |
| drop cap size | 27.5pt (2.5×) |
| glyph em-box height | **34.91pt** |
| **line boxes spanned** | **2.50 → 3** |
| glyph width | **19.83pt** of a 216pt column |
| indented wrap width | **196.17pt (90.8% of the column)** |

**Ink measured — and it CORRECTS what I told the CTO.** I reported that the glyph spans 2.50 line
boxes and therefore that line 3 was affected too, agreeing with the CTO's challenge against my own
capture. **The ink measurement refutes that: the capture was right and my correction was wrong.**

| | measured | lines |
|---|---|---|
| glyph **line box** | 34.91pt | 2.50 — **over-reports** |
| glyph **real ink** (cap height) | **19.05pt** | **1.36** |

**Lines to indent beyond line 1: exactly 1.** The line box includes ascent/descent padding the glyph
does not ink. This matches the visual evidence precisely: line 2 corrupted, line 3 clean.

*Method note, recorded because a wrong number was nearly published:* PDFKit normalises
`_font.capHeight` to a **1000-unit em** (1419 font units x scale 0.48828125 = 692.87), so it converts
with `/1000`, not with the inner font's `unitsPerEm` of 2048. Doing both gave 9.30pt -- a 0.34 em cap
height, implausible on its face and contradicted by the visual. Caught by a plausibility check, not
by the toolchain.

## 3. R2 — the central subject, per the CTO

Indenting the spanned lines narrows their wrap width to 90.8%, so they hold fewer characters, so
content is pushed down, so the paragraph may gain a line. **The fix creates a height cost that the
current broken behaviour does not have.** The model must charge it, and charge it correctly.

**The cost is small and quantised**, which is exactly why it cannot be approximated: ~9% narrowing
across 2 lines displaces roughly 0.18 of a line — usually **0** extra lines, occasionally **1**.
An estimate that "adds a bit" would be wrong in both directions on most paragraphs.

**Method:** `estimateBlockHeight` prices a drop-cap paragraph as *(the spanned lines measured at the
narrowed width) + (the remainder measured at full width)* — the same shape as C1's quote pricing,
which measures at the column the renderer really wraps in. Measured through `TextMeasurer`, never
derived from `DROP_CAP_SCALE`.

### 3bis. An objection to the CTO's proposed test criterion

The CTO asked that the charged height after the fix **match Word (~+1 page on the fixture)**. **I
believe that criterion is wrong, and I would rather say so than quietly implement a different test.**

Word's +1 page comes from a *different strategy*: Word does not indent anything — it grows the first
line's box to fit the tall run. That is the **degraded** implementation (a big first letter, not a
true drop cap). Our fix targets the **EPUB** behaviour (`float: left` — real wrap-around), where the
glyph occupies horizontal space and the paragraph's height changes only by the small re-wrap delta,
**not** by +2.5 line boxes. Matching Word's page count would mean reproducing Word's degradation.

**Proposed criterion instead:** *(a)* charged equals consumed **measured against our own post-fix
renderer**, on the real fixture; *(b)* the rendered text is no longer covered — asserted directly,
not by proxy; *(c)* `PDFRenderer.parity.test.ts` stays at 238 pages / 2 reconciliations, since no
corpus manuscript has a drop cap. **This is the CTO's call, and I have not chosen it unilaterally.**

## 4. Tri-format: the fix is PDF-only — stated explicitly, not left implicit

| | mechanism | verdict |
|---|---|---|
| **EPUB** | `.dropcap { float: left }` | **correct already — no change.** The reading system's CSS engine performs the real wrap. |
| **DOCX** | enlarged `TextRun` inline | **no change needed.** Confirmed in Word 16.0, not inferred: same 61 lines and 397 words, 3 → 4 pages — Word grows line boxes, nothing is hidden. Degraded (big letter, not a true drop cap) but lossless. |
| **PDF** | `doc.text(char, {continued:true})` | **the only renderer to fix.** |

**Implication for the future theme capability, flagged now:** the three renderers implement three
*different* drop-cap strategies. A theme declaring a drop-cap "scale" therefore means three different
things in three formats. Whether that is acceptable under ADR-0050, or whether the strategies must
converge first, belongs to `MINI_DR_DROP_CAPS.md` when it resumes — **out of scope for this fix**,
recorded so it is not rediscovered.

## 5. Risks

- **The indent count is wrong.** Now measured (§2): 1 line. Residual risk: cap height is not the only inking metric — a descending drop cap (`J`, `Q`) or another theme face changes the span, so the count must be **derived from the font metrics at render time, never hardcoded to 1**. Asserted by the no-overlap test.
- **The pricing is wrong.** Under-charge → overflow and reconciliations; over-charge → under-full pages. This is the risk the whole review exists for, and §3's method plus §3bis's criterion (a) are its instruments.
- **Justified text — baseline verified CLEAN, post-fix behaviour cannot yet be.** A justified fixture alternating drop-cap and plain paragraphs (`verification/dropcap-visual/justified.pdf`) renders flush right with even word spacing throughout: justification survives the drop cap, because `continued: true` carries the first `text()` call's options through the flow. **But the CTO's concern was a mid-block width change, which does not exist yet — the fix creates it.** This therefore closes the *baseline*, not the question, and becomes a **gate on the implementation** (assert even spacing on a justified drop-cap paragraph once the indent lands) rather than a precondition closable beforehand.
- **`DROPCAP_PARAGRAPH_ATOMICITY` is untouched** by this fix: the paragraph stays unsplittable. Accepted debt, unchanged, still to be made observable.
