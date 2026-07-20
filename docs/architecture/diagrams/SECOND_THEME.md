# Second Book Presentation Theme — Level-2 Design Review (short)

**Status:** ✅ APPROVED (mechanism) + direction **A "Modern"** chosen; **steps 1-3 MERGED** to `main` (`e5954e9` — theme + registry + gallery + own parity/calibration `§10.4`). **One thing still open: the CTO's screenshot-loop judgment of the exact accent shade (`#1D4E68`)** on real pages — the studio's PDF proof cannot be captured in the headless env, so the CTO judges locally (the accent is objectively correct in the render; only the shade preference remains).
**Date:** 2026-07-21, grounded in code on `main` at `87f555d` and verified **live** in L'Atelier this session.
**Scope (CTO's words):** data + one registry line + a clean parity/calibration verification, then code. Deliberately short — no new architecture.

---

## 1. Objectives

Ship a **second theme** so the studio offers a real aesthetic *choice*. Today Classic is the only resident, so "advanced formatting with little effort" means "little effort, no choice." A second theme is the *stylize* half of the founder's "all the elements to finalize" (`STRUCTURE_VS_THEME_SCOPE.md`).

## 2. Current state — evidence, verified live

- A `Theme` is **declarative data** (`Theme.ts`: fonts/sizes/colors/spacing/runningHead); `getTheme` is a one-line registry (`getTheme.ts`: `THEMES = { classic }`); `listThemeNames()` already enumerates it for the options endpoint.
- The frontend gallery is **theme-count-agnostic** — **confirmed live this session**: the Layout station renders the Classic card plus an honest "More themes are being set. Classic is the first resident." slot, mapping `options.themes`. A second registry entry appears as a card automatically; **frontend cost ≈ zero**.
- **Three embedded SIL-OFL faces** (Gelasio serif / Inter sans / JetBrains mono, 4 variants each) are reusable → a second theme needs **no new font embedding** unless it wants a genuinely new typeface.
- **The architecture was built for this**: ADR-0029 consumes future themes "without any LayoutEngine change," and `ClassicTheme.ts` explicitly reserves the accent-aesthetic decision "for the second theme's screenshot loop."
- The **living Proof works** (verified live: format change re-paginated 90 → 159 pages) — the screenshot loop's mechanism is real.

## 3. Architecture impact — additive, no pipeline change

A new `Theme` object + one line in `getTheme`'s `THEMES` map. `listThemeNames()` and the frontend gallery pick it up with no further change. `ThemeEngine`/`TypographyResolver`/`LayoutEngine`/renderers are **untouched** (ADR-0029). If the chosen aesthetic wants a new typeface: + font embedding (SIL-OFL, 4 variants, `PdfFontRegistry` entry, and re-measuring the drop-cap `capHeight` plausibility range for that face) — **recommend reusing the three embedded faces to keep this small**.

## 4. The aesthetic decision — CTO's call (a menu, not a pick)

The second theme's *look* is a taste calibration via the screenshot loop (VISUAL_LANGUAGE §9), not an engineering choice. Three directions grounded in what's already embedded, for the CTO to pick and refine:

- **A — "Modern":** Inter (sans) headings + Gelasio (serif) body, a **visible accent** (the reserved decision — e.g. a Prussian blue like the studio's own, or another), slightly tighter heading spacing. Most visibly different from Classic; exercises `colors.accent` end-to-end (already consumed tri-format).
- **B — "Novel":** Gelasio throughout but a distinct *rhythm* — larger leading, a `chapterTitle` running head (vs Classic's `bookTitle`), more generous heading spacing. A quieter, book-interior feel; differs by typography, not colour.
- **C — "Academic":** serif body, sans headings, a small-caps or numbered running head, tighter body size for dense text. Different *density*.

I recommend nothing here — the CTO names the direction (or a fourth), then the screenshot loop refines it against real pages in the local browser (the Proof, confirmed working).

## 5. R2 / parity / calibration — the clean verification (named, not skipped)

A second theme changes fonts/sizes/spacing → different line heights → a different page count. The render-drift mechanism **absorbs this by construction** (`LayoutEngine` measures the *real* theme's faces via `TextMeasurer`), so charged still equals consumed — **for the new theme's own numbers.** The verification this chantier owes, explicitly:
1. **Its own parity lock.** `PDFRenderer.parity.test.ts` is Classic/faith-alone-locked. The second theme gets its **own** asserted numbers on the corpus (a new lock), never reusing Classic's. Classic's remain untouched.
2. **Its own words-per-page calibration.** `PUBLICATION_QUALITY_BAR.md` §10's WPP registry is Classic-only. The second theme adds its own WPP baseline; this also advances `RECALIBRATE_PAGE_RATIO_TOLERANCE` (a theme dimension joins the fixture dimension).
3. **No Classic regression.** Classic's visual baseline and parity stay byte-stable — the second theme is purely additive.

## 6. Risks
1. **The aesthetic is subjective** — mitigated by the screenshot loop against the real (working) Proof, the CTO calibrating.
2. **A new typeface adds embedding + `capHeight` range work** — mitigated by reusing the three embedded faces (recommended).
3. **Per-theme parity/calibration must be re-derived, not assumed** — named as owed work (§5), not a silent gap.

## 7. Commit plan (short)
0. (If a new typeface is chosen) font-embedding spike — else skip.
1. The `Theme` object + `getTheme` registry line — inert, tri-format export proven, no Classic change (byte-stable baseline).
2. The theme's **own** parity lock + WPP calibration entry (§5) — its numbers asserted on the corpus.
3. Frontend confirmation (auto-rendered gallery card; the honest slot updates itself) + the CTO screenshot loop on real pages.

## 8. Acceptance criteria
- The second theme exports PDF/DOCX/EPUB; its fonts and (if any) accent appear in output, verified the way `accentColors.triformat.test.ts` verifies Classic.
- Its parity numbers are locked on the corpus; Classic's parity and visual baseline are unchanged (byte-stable).
- The gallery shows **two** residents; selecting the second re-inks the Proof (the mechanism verified live this session).

## 9. The decision for the CTO
1. Approve the additive mechanism (§3) and the parity/calibration plan (§5).
2. **Pick the aesthetic direction (§4)** — A/B/C or a fourth — and whether to reuse embedded faces or authorize a new typeface.

## Related
- `STRUCTURE_VS_THEME_SCOPE.md` (the scope report that arbitrated this first), ADR-0029 (theme extensibility without LayoutEngine change), `ClassicTheme.ts` (the reserved accent decision), `accentColors.triformat.test.ts` (how a theme's colours/fonts are verified), `PDFRenderer.parity.test.ts` + `PUBLICATION_QUALITY_BAR.md` §10 (the Classic-locked parity/calibration a second theme re-derives for itself), VISUAL_LANGUAGE §9 (the screenshot loop).
