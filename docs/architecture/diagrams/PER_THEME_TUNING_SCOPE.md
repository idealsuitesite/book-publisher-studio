# Per-Theme Fine-Tuning — Scope Report (measured, no code)

**Status:** 📋 SCOPE REPORT — read-only, measured on `main` (`4ac9f0f`). No production code opened (the `GUTTER_SCOPE.md` / `SUBTITLE_SPACING_SCOPE.md` / `PROOF_EDITORIAL_CONTROL_SCOPE.md` format: measure and locate the gap; the CTO decides whether a chantier follows, and at what altitude).
**Date:** 2026-07-21. The top gap in `FORMATTING_TOOLS_AUDIT.md` §1 ("Per-theme fine-tuning — the knob an author most wants is uneditable without code").
**The CTO's framing:** per-theme fine-tuning, **accent at minimum.**
**Instrument:** reading `getTheme`, `Theme`, `ProjectSettingsDTO`/`UpdateProjectSettingsDTO`, the `renderBook` theme-resolution tail, every `colors.accent` consumer, and the validation rule set.

---

## §0 — The measured state: themes are fixed data, the project stores only a NAME

- **Themes are immutable registry entries.** `getTheme(name)` looks up a fixed `Record<string, Theme>` — `{ classic, modern }` (`getTheme.ts:6-9`). `ClassicTheme.ts` / `ModernTheme.ts` are hardcoded data. **Grep confirms no override anywhere:** no `updateTheme`, no `customAccent`, no theme-edit endpoint, no frontend picker.
- **The project stores a theme NAME, not values.** `ProjectSettingsDTO { layoutName, themeName }` (`ProjectDTO.ts:29-32`); `UpdateProjectSettingsDTO { layoutName?, themeName? }` is the `PATCH /settings` shape (`:52-55`). The render pipeline resolves it once: `renderBook(book, themeName, pageLayout)` → `getTheme(themeName)` (`ExportManuscriptUseCase.ts:57-58`), the **shared export/publish tail** (ADR-0052) — so export and publish render the identical resolved theme. **There is no seam today where a per-project value could enter after `getTheme`.**

So an author's real control is **all-or-nothing theme choice** (Classic or Modern). To tune *anything* — accent first — a value must be storable per project and applied over the chosen theme.

## §1 — What "accent" actually is (bounding the minimum knob)

`colors.accent` drives **heading + title colour, tri-format**, and nothing else — four consumers, all enumerated:

| consumer | file:line | what it colours |
|---|---|---|
| PDF title | `PDFRenderer.ts:546` | chapter/section titles (`fillColor(theme.colors.accent)`) |
| PDF/model heading blocks | `ThemeEngine.ts:47` | `heading` blocks' resolved colour |
| DOCX | `DOCXRenderer.ts:59` | heading style colour |
| EPUB | `EPUBRenderer.ts:142` | `h1..h6 { color: … }` |

Classic sets `accent === text === #000000` (invisible by design); Modern sets `#1D4E68` (visible, the first real consumer, MINI_DR_ACCENT_COLORS). **The accent is the single most self-contained theme value** — it colours headings and titles and touches nothing else.

## §2 — The load-bearing measured property: accent tuning is R2-FREE

**Accent is colour-only. Changing it changes fill colour, never geometry** — no glyph widths, no line heights, no spacing. So unlike the subtitle-spacing chantier (which shifted page counts and forced a deliberate parity re-lock), **an accent override has ZERO pagination impact: no `titleHeightOf` change, no parity re-lock, no `unplannedPageBreaks` risk.** This is what makes "accent at minimum" also the **lowest-risk** knob in the whole formatting surface.

**It also pairs naturally with the living Proof and sidesteps the screenshot-loop problem.** Every shade judgment this session (Modern's `#1D4E68`, the subtitle values) needed the CTO to see real pages, and headless capture hangs. An author tuning their *own* accent picks a colour, the Proof **re-inks** (the mechanism already exists — `proofRefreshKey`), and they see it live. The judgment moves from the CTO's screenshot loop to the author's own eyes, in real time.

## §3 — The shape of a fix (for the CTO to weigh — none opened here)

- **Option A — per-project accent override (the minimal, targeted answer).** Add `accentOverride?: string` to `ProjectSettings` (+ the two DTOs, + the existing `PATCH /settings` path — no new endpoint). Apply it in the shared `renderBook` tail, right after `getTheme`: `if (accentOverride) theme = { ...theme, colors: { ...theme.colors, accent: accentOverride } }` — a pure, local override, R2-free (§2). Frontend: a colour input in the theme/layout station, persisted via the existing PATCH, the Proof re-inking on change. **The author tunes exactly one value; blast radius is settings + DTO + one-line tail + one picker.**
- **Option B — more named theme variants** (add rows to the `getTheme` registry). This is *more fixed choices*, not *tuning* — it does not answer "let me nudge the accent", and it is a content/design decision (drawing new themes), orthogonal to this gap.
- **Option C — full theme customization** (fonts, spacing, colours). Large: font and spacing changes are **geometry** changes (the subtitle-spacing lesson — they move page counts and need parity re-locks), and the CTO scoped "accent au minimum." Out of proportion for the first step.

## §4 — Questions a review must lock (measured, flagged — not decided here)

1. **Override semantics.** Does `accentOverride` replace `colors.accent` for whatever theme is chosen — including Classic, whose identity is *all-black*? An override would let an author give Classic a Prussian accent (arguably good), but it also means "Classic + override" is no longer Classic. Replace-for-any-theme is simplest; the alternative (only themes that already use accent) is more conservative. A decision.
2. **The unguarded-accent gap (measured).** **No validation rule touches accent** (grep over `domain/services/validation/` — zero matches for accent/contrast/colour). A tuning feature hands the author a colour that could be **unprintable** — too light on white, or low-contrast — with nothing to catch it, the same class of gap as the KDP margin/gutter dead-data (`GUTTER_SCOPE.md`). Whether the first chantier adds a contrast/darkness guard or discloses the gap is a CTO call.
3. **Scope guard against creep.** Lock the first chantier to **accent only**. Fonts and spacing are geometry (parity cost) and belong to their own report — the same line the subtitle-spacing chantier honoured. "Accent at minimum" should not silently grow into "theme editor."
4. **Snapshot/refresh.** `proofRefreshKey` currently keys on `layoutName/themeName/updatedAt`; an accent override must join that key so the Proof re-inks on a shade change. Minor, but named so it is not missed.

## §5 — Recommendation

Accent tuning is the **audit's top-named gap**, the **lowest-risk** knob (colour-only, **R2-free** — no parity re-lock, unlike every geometry change this session), and it **pairs with the living Proof** so the author judges their own shade live instead of through the CTO's hung-screenshot loop. Recommend **Option A** (a per-project accent override) as a **mini Level-2 review** — bounded to settings + DTO + a one-line application in the shared render tail + one frontend picker — with §4's four questions (override semantics, the unguarded-accent gap, the accent-only scope guard, the refresh key) locked before code. Fonts/spacing tuning (geometry) and more themes (content) are each their own separate report, deliberately not folded in.

**Not opened here; measure done; awaiting the CTO's go and altitude. No code before that.**

## Related
`FORMATTING_TOOLS_AUDIT.md` (the gap this measures — §1 "Per-theme fine-tuning"), `MINI_DR_ACCENT_COLORS.md` (what `colors.accent` already drives — headings + titles, the first real consumer), `modernTheme.test.ts` (Modern's `#1D4E68`, accent exercised tri-format), ADR-0052 (the shared `renderBook`/`publishBook` tail — the single seam an override would enter), `SUBTITLE_SPACING_SCOPE.md` / `MINI_DR_SUBTITLE_SPACING.md` (the contrast: a *geometry* change needing a parity re-lock — why accent, being colour-only, is cheaper), `GUTTER_SCOPE.md` (the unguarded-value precedent for §4.2, and this report's measure-first format).
