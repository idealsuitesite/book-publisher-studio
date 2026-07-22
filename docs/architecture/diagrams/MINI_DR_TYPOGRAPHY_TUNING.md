# Mini Design Review — Per-project typography tuning: text-size presets + font pairing

**Status:** DRAFT — awaiting CTO approval (the queue's agreed gate for this item: review → approval → code). Queue item 4, continuing `TYPOGRAPHY_TUNING_SCOPE.md` with the CTO's four §3 answers locked.
**Date:** 2026-07-22. Re-verified against `main` at `f21afc6`: both shipped themes have `fontSizes.body: 11` (measured — the CTO's absolute preset mapping and the offset-from-default reading coincide exactly today, §2.1); `resolveTheme(name, accentOverride?)` is the one override seam (`getTheme.ts:27`); the pagination key is `md5(book):themeName:layout` (accent deliberately excluded).

---

## 1. The four CTO decisions (2026-07-22 — locked, restated, not reopened)

1. **Round-1 knobs = body size + font pairing** (option b): the pairing costs almost nothing geometrically (heading swap free, body swap +4%) and changes the book's visible identity far more than its cost — too favourable a value/cost ratio to leave out. Paragraph spacing stays out of round 1.
2. **Bounds = the measured 10–13pt window, no wider.** Below 10pt is unreadable print; above 13pt is a separate large-print format, not a slider pushed to its end. **The re-inking Proof is the disclosure** — the author watches the page count move live, more honest than a warning they would ignore.
3. **Presentation = four named presets** — Compact / Standard / Comfort / Large print → 10 / 11 / 12 / 13pt. A name tells the target author what they get; a point value tells them nothing. Matches the product's philosophy (intelligent automation, not InDesign-style pixel control).
4. **Heading + small sizes scale with the body, proportionally** — factor = chosenBody / themeDefaultBody applied to `h1–h6` and `small`; the RATIO between body and headings is what makes the hierarchy coherent, not the absolute values.

## 2. Design decisions this review proposes to lock

1. **Presets are stored by NAME and resolved as OFFSETS from the theme's own default body** (compact −1 / standard 0 / comfort +1 / large +2). For both shipped themes (body 11, measured) this is **numerically identical to the CTO's 10/11/12/13 mapping** — and it additionally guarantees that "Standard" always means *the theme's own designed default* if a future theme ships a different body size (the theme's identity survives the preset system). Storing the name (not a number) follows the `layoutName` precedent: a retuned preset reaches existing projects. Flagged as the one place this review interprets rather than transcribes — the mapping the CTO gave holds exactly, today and by construction at Standard.
2. **Font pairing = two logical roles, stored as `'serif' | 'sans'`** (`bodyFont`, `headingFont`), resolved against the registry's real families (Gelasio / Inter) inside `resolveTheme` — a pairing choice, never a font browser (three families exist; the UI shows real names "Gelasio (serif)" / "Inter (sans)"). Monospace is not offered (no body/heading role uses it).
3. **One seam:** `resolveTheme(name, accentOverride?, typographyOverride?)` — the override maps preset→`fontSizes` (body + scaled h1–h6/small, fractional values kept unrounded so ratios stay exact; measurer and renderer consume the same numbers, lock-step by construction) and roles→`fonts.*` before the theme reaches ThemeEngine. **Tri-format for free** (DOCX heading styles and EPUB CSS read the same resolved theme — measured in the scope report).
4. **Storage/boundary:** `settings.typographyOverride?: { preset?: 'compact'|'standard'|'comfort'|'large'; bodyFont?: 'serif'|'sans'; headingFont?: 'serif'|'sans' }`, additive on `ProjectSettings`/DTOs; `PATCH /settings` validates enums (else `400 INVALID_SETTINGS`, the accent hex precedent). No snapshot/undo — settings are not book mutations (the accent precedent; the Proof re-inks, reverting is re-picking).
5. **THE CACHE KEY GAINS THE OVERRIDE — non-negotiable (CTO), tested BOTH ways:** `paginationKey` appends the serialized `typographyOverride` (absent → the literal today's key, so existing cached geometry stays valid). Tests: a preset change → **MISS**; an accent change over a typography-overridden book → still **HIT**.
6. **`proofRefreshKey` includes the override** (the D5 stale-Proof rule, tested like accent's point 4).
7. **R2 guards:** `resolveTheme(name, acc)` with no typography override is **byte-identical** to today (the `=== getTheme` pattern extended); with-override, **charged == consumed holds by construction** — locked by a real-fixture test (faith-alone at Large + sans pairing: `unplannedPageBreaks` stays in the known residual class, page count lands in the measured band ~+30%); the corpus parity locks run at defaults and are untouched.

## 3. Frontend (Layout station, beside the accent picker)

- **"Text size"**: four named preset buttons/segments (Compact / Standard / Comfort / Large print), current one highlighted; picking persists via `PATCH /settings` and the Proof re-inks (the live page-count disclosure the CTO chose).
- **"Fonts"**: two compact selects — Body: Gelasio (serif) | Inter (sans); Headings: Gelasio (serif) | Inter (sans) — plus a reset-to-theme control (the accent picker's pattern).
- jsdom: picking a preset PATCHes the enum; reset clears; `proofRefreshKey` changes on override change with same `updatedAt`.

## 4. Commit plan (one responsibility each; gate green before the next)

1. **Backend seam:** `resolveTheme` extension (preset offsets, proportional scaling, role mapping) + settings/DTO additive fields + route enum validation + **the cache key** — unit tests: scaling preserves ratios (h1/body constant across presets); absent-override byte-identity; preset table; key MISS-on-typography / HIT-on-accent (both directions).
2. **Real-fixture lock:** faith-alone at Large + sans body through the real pipeline — page count in the measured band, `unplannedPageBreaks` residual-class, DOCX/EPUB reflect the pairing (tri-format proof).
3. **Frontend:** the two Layout-station controls + `proofRefreshKey` + jsdom.
4. **Live verification** (studio on faith-alone: pick Large → Proof re-inks visibly longer; pair sans headings → visible; reset → back; zero console errors) **+ docs reconciliation.**

## 5. Risks

- **A future theme with body ≠ 11** makes the absolute-vs-offset distinction real — §2.1 resolves it in favour of theme identity, documented in the resolver.
- **Scaled heading sizes are fractional** (e.g. h1 28×12/11 = 30.55) — deliberate (exact ratios); PDFKit/DOCX/EPUB all accept fractional points; named so nobody "cleans it up" into ratio drift.
- **Preset naming is user-facing English** — wording pass at build time if the studio ever localises.

## 6. Open questions

None — the four CTO answers cover the taste surface; §2.1 is the only interpretation and it is equivalence-preserving. Awaiting approval; no code before it.

## Related
`TYPOGRAPHY_TUNING_SCOPE.md` (the measured scope + the cache trap), `MINI_DR_PER_THEME_ACCENT.md` (the seam/settings/D5 precedents), `MINI_DR_PAGINATION_REUSE.md` §2.3 (the completeness rule §2.5 satisfies), `PdfFontRegistry.ts` (the three families behind the pairing).
