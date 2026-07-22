# Per-theme typography tuning (fonts/sizes/spacing) — Scope Report, not a Design Review

**Status:** SCOPE REPORT for CTO decision — **stopped at the taste decision as directed** (queue item 4; the mechanics are designed to the end, the values/bounds/UI form are the CTO's). No production code.
**Date:** 2026-07-22, grounded in code read on `main` at `d8ae2e8` and a real geometry measurement (`backend/spikes/typography-tuning-spike.ts`). Continues `PER_THEME_TUNING_SCOPE.md` (whose Option A — accent — shipped as `MINI_DR_PER_THEME_ACCENT`; this is the geometry half it deliberately deferred).

---

## 0. The measured facts (faith-alone, 39,354 words, kdp-6x9, Classic base 155 model pages)

| candidate knob | model pages | Δ vs base | unplanned |
|---|---|---|---|
| **body size 11 → 12pt** | 182 | **+27 (+17%)** | 1 |
| body size 11 → 13pt | 204 | +49 (+32%) | 2 |
| body size 11 → 10pt | 134 | −21 (−14%) | 1 |
| body font Georgia → sans (Inter) | 161 | +6 (+4%) | 1 |
| heading font → sans (Inter) | 155 | **0** | 1 |
| paragraphSpacing 8 → 12 | 164 | +9 | 2 |
| paragraphSpacing 8 → 4 | 151 | −4 | 2 |

Four load-bearing conclusions:

1. **Body size is the heavyweight knob** — ±1pt moves the book ±14–17%. That is *product* meaning (reading comfort, the "large print" request, print cost per page at KDP) and *geometry* meaning at once.
2. **Charged == consumed holds under EVERY variation, by construction** — `unplannedPageBreaks` stays at the known 1–2 residual class across all eight runs, because the measurer and the renderer read the *same resolved theme* (the `resolveTheme` seam sits upstream of both). **The override mechanism itself needs no parity re-lock**: the corpus locks run at defaults, so the guard is *byte-identical-when-absent* (the accent pattern), and with-override geometry varies legitimately with no locked number to violate.
3. **Leading (line spacing) is NOT currently a real PDF knob** — measured in code, not assumed: `spacing.lineHeight` (1.4) is consumed only by the **fallback** estimator (`LayoutEngine.ts:549`, no-measurer path) and the EPUB CSS; the measured PDF path uses PDFKit's natural line height (`PdfKitTextMeasurer`, "no lineGap"). Offering leading means new renderer+measurer lock-step work (a `lineGap` capability priced on both sides) — **a different, bigger chantier than a settings override**; deferred and named, not folded in.
4. **The knobs are naturally tri-format** — `fonts.*` and `fontSizes.*` flow to DOCX (heading styles) and EPUB (CSS) from the same `Theme`, so an override applied in `resolveTheme` reaches all three formats with no per-renderer work (unlike subtitle spacing, which was PDF-only).

## 1. The critical trap, found by designing the mechanics to the end: the pagination cache key

`MINI_DR_PAGINATION_REUSE`'s key is `md5(book) : themeName : layout` — **accent was deliberately excluded because it is colour-only.** A typography override is **geometry-affecting but changes neither the book nor the theme name**: without a key change, the cache would serve **stale geometry** after a body-size change — precisely the silent-drift class §2.3's completeness rule exists to prevent, and the reason that rule was written as *"a future geometry-affecting setting MUST be added to the key"*. **This chantier is that future setting.** The design therefore includes, non-negotiably: the typography override joins the cache key (and the §5 tests prove a size change → MISS while an accent change → still HIT).

## 2. The mechanics (designed to the end, one seam, whatever knobs are chosen)

- **Storage:** `settings.typographyOverride?: { bodySizePt?: number; bodyFont?: 'serif' | 'sans'; headingFont?: 'serif' | 'sans'; paragraphSpacingPt?: number }` — logical font *roles*, not free font names: the registry ships exactly three families (Gelasio serif / Inter sans / JetBrains mono), so the honest offer is a pairing, not a font browser.
- **Application:** `resolveTheme(name, accentOverride, typographyOverride)` — the ONE shared seam (export + publish identical by construction, the accent precedent); the override maps onto `fonts.*` / `fontSizes.body` (+ derived `small`?) / `spacing.paragraphSpacing` before the theme reaches ThemeEngine — so measurer, renderer, DOCX and EPUB all see the same resolved values with zero per-consumer work.
- **Boundary:** `PATCH /settings` (existing), format-validated at the route (numeric bounds, enum roles — bounds themselves are §3's taste stop); DTO additive.
- **Frontend:** Layout-station controls beside the accent picker; `proofRefreshKey` includes the override (the D5 stale-Proof rule, tested like accent's point 4).
- **Cache:** the key gains the override (§1) — tested both directions.
- **R2 guards:** byte-identical-when-absent (no-override renders unchanged, the `resolveTheme(name, undefined) === getTheme(name)` pattern); charged==consumed under override (a with-override render keeps `unplannedPageBreaks` at the residual class — the spike's property as a test); WPP/quality-bar calibration untouched (defaults unchanged).

## 3. THE TASTE STOP — the CTO's decisions, not proposed as defaults

Stopped here precisely, as directed. What the CTO decides:

1. **Which knobs ship in round 1.** The measured menu, cheapest-first by blast radius: (a) **body size only** (the accent discipline — one knob, the heavyweight, the "large print" author request); (b) body size + **font pairing** (body/heading serif↔sans — heading swap is geometrically free, body swap +4%); (c) also paragraph spacing. *(Leading is excluded from all options — §0.3, its own future chantier.)*
2. **The bounds.** Body size: the full measured range 10–13 swings the book −14%…+32% — which window is *sane to offer* (9–14? 10–13?) and does the UI show the page-count consequence live (the Proof already re-inks — is that enough disclosure)?
3. **The presentation.** Free numeric input, a stepped slider, or named presets ("Compact / Standard / Comfort / Large print") — the same class of decision as Modern's `#1D4E68` shade: aesthetics and product voice, the founder/CTO's call.
4. **Whether `fontSizes.small` and heading sizes scale with the body override or stay fixed** — a typographic-judgement question (a 13pt body under a fixed 28pt h1 changes the page's hierarchy feel).

**What this report asserts, and stops at:** the knobs' real costs are measured (§0); the override mechanism is R2-safe by construction with byte-identical-when-absent as the guard (§0.2); leading is a different chantier (§0.3); the pagination-cache key MUST gain the override (§1 — the one non-negotiable piece of mechanics); and the full design is ready to become a mini Level-2 the moment the CTO answers §3. No code before that answer and the review that follows.

---

## Evidence index (all on `main` at `d8ae2e8`)
- `backend/spikes/typography-tuning-spike.ts` — the §0 table (8 runs, real faith-alone).
- `Theme.ts:21-58` — the theme surface; `ClassicTheme.ts` (body 11, lineHeight 1.4, paragraphSpacing 8).
- `LayoutEngine.ts:549` + `PdfKitTextMeasurer.ts` — leading consumed only by the fallback path (§0.3).
- `PdfFontRegistry.ts` — three families; role-based resolution (the pairing rationale).
- `getTheme.ts` (`resolveTheme`) — the one seam the override extends (accent precedent).
- `MINI_DR_PAGINATION_REUSE.md` §2.3 — the cache-key completeness rule §1 invokes.
- `EPUBRenderer.ts:132`, `DOCXRenderer.ts:53-58` — tri-format consumption of `fonts`/`fontSizes` (§0.4).
