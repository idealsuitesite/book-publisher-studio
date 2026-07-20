# Mini Design Review — extending the `TextMeasurer` port

**Status:** AWAITING CTO REVIEW — **no code written.** Required because pricing a drop-cap
paragraph needs metrics the port does not expose, and a Domain port is not modifiable inside a
review scoped to a renderer (`CLAUDE.md` non-negotiable #4). Reviewed **at the level of the port**,
not of the drop cap: drop caps are the first consumer, not the justification.
**Date:** 2026-07-21

---

## 0. Why the port, and not a workaround

`estimateBlockHeight` needs two quantities to price a drop-cap paragraph: the **advance width** of
the glyph (the narrowed column of the indented lines) and its **real ink height** (how many lines
are indented). Neither is reachable through `measureHeight` / `lineHeight`.

**The trap that makes this a port problem rather than a call-site problem:** the *wrong* metric IS
reachable and looks right. `measureHeight('E', { fontSize: 27.5, heading: true })` returns the
glyph's **line box** — measured **34.91pt = 2.50 line heights** — while its real ink (cap height) is
**19.05pt = 1.36 line heights**. A caller reaching for the obvious method indents 2 lines instead of
1 and over-charges the height.

Rejected alternatives, recorded: deriving the width from a constant fraction of the font size (the
reasoning that produced the list-prefix under-charge), and shipping the render fix without the
pricing (deliberately re-opening a charged-vs-consumed disagreement).

## 1. `measureWidth()` — signature, designed for the second caller

```ts
/** Advance width this text really occupies at this size in this face — no wrapping. */
measureWidth(text: string, options: Omit<MeasureOptions, 'width'>): number;
```

- **Mirrors `measureHeight(text, options)`** — same text-first shape, same style selectors (`fontSize`, `heading`, `theme`), same `number` return in points.
- **`width` is omitted deliberately**, and this is the one asymmetry worth defending: `MeasureOptions.width` means *the column to wrap in*. An advance width has no column — including the field would invite a caller to pass one and expect a wrapped result. `Omit<>` keeps the two option types coupled (a future field added to `MeasureOptions` reaches both) while removing the one that would be a lie here.
- **Not drop-cap-shaped.** It answers *how wide is this string in this face* — what a fitted running head, a table column, or a leader-dotted TOC entry would each ask.

## 2. Real ink height — and the trap documented IN the port

```ts
/**
 * Cap height (real ink above the baseline) at this size, in points.
 *
 * NOT `measureHeight` of a single character: that returns the LINE BOX, which includes
 * ascent/descent the glyph does not ink. Measured on Gelasio-Bold at 27.5pt: line box
 * 34.91pt (2.50 body lines) vs real cap height 19.05pt (1.36 body lines). A caller that
 * reaches for measureHeight here over-reports by ~83% and reserves too much space.
 */
capHeight(fontSize: number, font?: { theme: Theme; heading?: boolean }): number;
```

**Shape mirrors `lineHeight(fontSize, font?)` exactly** — same arguments, same optional face
selector, same units. The two belong to one family: scalar vertical metrics of a face at a size.

**The warning lives in the port's own doc comment, not only in this review.** That is the CTO's
requirement and it is the right one: the next caller will read `TextMeasurer.ts`, not this file, and
the failure mode is silent — a wrong indent count renders plausibly and prices plausibly.

## 3. Cost on the existing implementation — the two additions are NOT symmetric

`PdfKitTextMeasurer` is currently built entirely on **public** PDFKit API (`font`, `fontSize`,
`heightOfString`). The two additions differ sharply, and this is the finding of this section:

| | implementation | risk |
|---|---|---|
| `measureWidth` | `doc.widthOfString(text)` — **public API**, one line | none beyond what already exists |
| `capHeight` | `doc._font.capHeight` — **PRIVATE/internal field**, normalised by PDFKit to a 1000-unit em | **the first private-API dependency in this class** |

**Mitigation, and it is not optional:** the plausibility guard already written and self-tested in
`spikes/dropcap-ink-spike.ts` moves into the implementation — a cap height outside **0.6–0.8 em** for
a Latin face is a measurement failure, not a font property, and must throw rather than return. That
is what makes a future PDFKit upgrade which renames or rescales `_font.capHeight` fail **loudly**
instead of silently producing a wrong indent. *(The guard already caught one real conversion error:
dividing by the inner font's `unitsPerEm` on top of PDFKit's per-mille value yielded 0.34 em — i.e.
"no lines to indent", i.e. "no bug".)*

**Can a future DOCX implementer honour this contract?** Asked because the port's own header states a
DOCX-faithful implementation is foreseeable.

- **`capHeight`: yes — more easily than anything already in the port.** It is a pure font metric (OS/2 `sCapHeight`), readable from any font toolkit, unlike `measureHeight`, which is a *layout result* a DOCX implementer must reproduce Word's line-breaking to answer.
- **`measureWidth`: yes.** Advance widths come from the same font metrics; strictly easier than the wrapped `measureHeight` the port already promises.

**So the contract is more portable than the port's existing surface, while the fragility is
implementation-local (a PDFKit private field), not contractual.** Two different risks, deliberately
not conflated.

## 4. R2 unchanged — staged so the claim is falsifiable

Both are **pure additions**. `measureHeight` and `lineHeight` are untouched, so no existing pricing
path changes behaviour: non-drop-cap blocks are measured exactly as before.

**Not asserted — staged to be proved.** The port extension lands and is verified **inert** before
anything consumes it: full suite green and `PDFRenderer.parity.test.ts` byte-stable at **238 pages /
2 reconciliations** with the new methods present and unused. Only then does the drop-cap pricing
consume them, at which point parity is re-checked. **If the numbers move at the first stage, the
pure-addition claim is false and the work stops.**

## 5. Risks

- **`capHeight`'s private-field access breaks on a PDFKit upgrade.** Guarded (§3): loud failure, not a wrong number. Residual: a version removing the field entirely breaks the build — acceptable and visible, unlike a silent rescale.
- **`measureWidth` is asked for text it cannot measure unwrapped** (a very long string). It answers honestly — an advance width, however large. Callers wanting a column must use `measureHeight`; the doc comment must say so.
- **Cap height is the wrong metric for a descending glyph.** `J`, `Q`, `y` ink below the baseline, so a drop cap using one spans further than `capHeight` reports. **Out of scope here, and named:** the drop-cap consumer must derive its indent count from the metrics at render time and must never assume "1 line" is universal — already recorded as a risk in `MINI_DR_DROPCAP_OVERLAP.md` §5.
- **Scope creep into a metrics façade.** Two methods, each with a named present consumer and a named foreseeable second one. Anything further (kerning, per-glyph bounds, baseline offsets) is a new decision, not an extension of this one.
