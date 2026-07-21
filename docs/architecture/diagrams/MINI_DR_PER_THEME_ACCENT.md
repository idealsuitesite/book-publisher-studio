# Mini Design Review — Per-project accent override (Option A of PER_THEME_TUNING_SCOPE)

**Status:** CTO-APPROVED, four points pre-locked (2026-07-21) — **feu vert for commits.** Option A of `PER_THEME_TUNING_SCOPE.md`: the author tunes ONE value — the accent — over their chosen theme. Accent-only; fonts/spacing (geometry) are each their own future report.
**Date:** 2026-07-21
**Re-verified against current code** (non-negotiable #7): the shared render tail (`renderBook`/`publishBook`), its project callers, `getTheme`, the settings DTOs, and every `colors.accent` consumer re-read on `main` today (`ce9c1fc`). Facts below hold.

---

## 1. What changes

A per-project `accentOverride` colour, stored in settings, applied over the chosen theme in the **single shared render seam** (ADR-0052), surfaced by a colour picker whose change re-inks the living Proof. **Colour-only, so R2-free** (§3). No new endpoint, no model geometry, no parity re-lock.

## 2. The four points, CTO-locked (verbatim intent)

1. **Override semantics — replace for ANY theme, including Classic.** No special rule for "themes that already use accent." Once the author acts, it's their book; the default stays honest (Classic ships `accent === text`), but an explicit override wins for whatever theme is chosen.
2. **Unguarded accent — disclosed, no contrast guard in this chantier.** A real WCAG-style guard is its own measurement (which threshold, against which background, per format PDF/DOCX/EPUB) and would widen scope for a minor risk (the author sees a too-light shade in the live Proof and fixes it themselves — the point of the Proof coupling). **Recorded as a NAMED FOLLOW-UP in `TODO.md`**, same treatment as the margin/gutter dead-data gap — named, not hidden.
3. **Scope guard — accent only.** Fonts and spacing (geometry, parity cost) are never folded into "accent at minimum"; each is its own future report. Same line the subtitle-spacing chantier held.
4. **Refresh key — `proofRefreshKey` MUST include the override, proven by a TEST.** Without it, a shade change leaves the Proof silently stale — exactly the D5 risk closed for undo in Phase 3. Verified by an explicit test, not visual inspection alone.

## 3. R2-free — the load-bearing property

`accentOverride` sets `colors.accent`, which drives heading + title **colour** only (four consumers: `PDFRenderer.ts:546`, `ThemeEngine.ts:47`, `DOCXRenderer.ts:59`, `EPUBRenderer.ts:142`) — never a glyph width, line height, or spacing. So the override **cannot move page counts**: no `titleHeightOf` change, no `PDFRenderer.parity.test.ts` re-lock, no `unplannedPageBreaks` risk. This is the whole reason accent is the safe first tuning knob. A verification asserts pagination is unchanged by an override (§5).

## 4. The plan (blast radius, all bounded)

**Backend:**
- `resolveTheme(name, accentOverride?)` in `getTheme.ts` — `getTheme(name)` then, if an override is present, `{ ...theme, colors: { ...theme.colors, accent: override } }`. Pure, the single place the override is applied (DRY across both tails).
- `renderBook` (`ExportManuscriptUseCase`) and `publishBook` (`PublishingUseCase`) gain an optional 4th param `accentOverride?: string`, resolving via `resolveTheme`. The raw-bytes routes pass nothing (unchanged).
- `ExportProjectUseCase` / `PublishProjectUseCase` pass `project.settings.accentOverride`.
- `ProjectSettings` (domain) + `ProjectSettingsDTO` + `UpdateProjectSettingsDTO` gain `accentOverride?: string`; the settings mapper and the `PATCH /settings` handler carry it (the existing persist path — no new endpoint).

**Frontend:**
- A colour input in the theme/layout station (`FormatSelector`), persisted via the existing `PATCH /settings`.
- `proofRefreshKey` includes `settings.accentOverride` (point 4).

## 5. Verification plan

- **Override applies, tri-format & both paths:** an export/publish with an `accentOverride` renders headings/titles in the override colour, not the theme's — asserted on real output (a Modern-with-overridden-accent and a Classic-with-a-visible-accent), and on BOTH the export and publish tails (they share `resolveTheme`, so one proof each guards the shared seam).
- **R2-free (§3):** the same book paginates identically with and without an override — page count and `unplannedPageBreaks` unchanged. Colour cannot move geometry, asserted not assumed.
- **Settings round-trip:** `accentOverride` persists through the repository and returns on read; `PATCH /settings` sets and clears it.
- **`proofRefreshKey` includes the override (point 4, explicit test):** two projects differing only in `accentOverride` produce different keys — the D5 stale-Proof risk closed by test.
- **Live:** in the studio, set an accent on faith-alone → the Proof re-inks in the new colour; clear it → reverts. (Screenshot may hang on the embedded PDF — fall back to the accessibility tree / network as before.)

## 6. Risks

- **Stale Proof on a shade change** — the D5 risk; closed by the point-4 test, not inspection.
- **Unprintable accent** — disclosed (point 2), no guard this chantier, named in `TODO.md`; the live Proof is the author's own safeguard.
- **Override leaking to the raw-bytes routes** — it does not: those callers pass no override; `resolveTheme(name, undefined) === getTheme(name)` by construction, asserted.
- **Scope creep to fonts/spacing** — locked out (point 3); this review touches no geometry value.

## 7. What is already decided (no open questions)
All four §2 points are CTO-locked; Option A is the scope. This review carries no unresolved questions — it exists as the durable design record and the commit plan. Code proceeds; report at each green commit.

## Implementation note (added at build time — the design above is unchanged; this records what the build settled)

- **All four points shipped as locked**, each with a test: override replaces accent for any theme (Classic + Modern); accent-only proven R2-free **both ways** (unit: only `colors.accent` changes; real output: same page count with/without); `proofRefreshKey` re-inks on the override with the same `updatedAt` (the D5 test); the contrast guard is deferred and **named `ACCENT_CONTRAST_UNGUARDED` in TODO.md** (the `ProjectsController` comment references it — no dangling pointer).
- **Format guard only** (point 2): `PATCH /settings` accepts a valid hex, rejects otherwise with `400 INVALID_SETTINGS`; `null`/`''` clears. Verified live.
- **The raw-bytes non-regression** is a real test: `resolveTheme(name) === getTheme(name)` with no override, so the override cannot leak to a path that should not apply it.
- **Verified live on real faith-alone:** PATCH set/persist/reread; non-hex → 400; the Layout station's Accent picker reflects the persisted `#1D4E68` with its reset control; zero console errors.
- **Environment note (not a code defect):** a stale backend process from before this chantier held port 5000 and answered PATCH with the old behaviour (non-hex accepted) — killed by PID and restarted, after which the new code responded correctly. Recorded so a future reader does not mistake an obsolete-server symptom for a regression.

Merged to `main` (`f74db29`); backend 659/659, frontend 164/164, tsc + eslint clean.

## Related
`PER_THEME_TUNING_SCOPE.md` (the measured scope — Option A), `FORMATTING_TOOLS_AUDIT.md` (the top gap), `MINI_DR_ACCENT_COLORS.md` (what `colors.accent` drives — headings + titles), ADR-0052 (the shared `renderBook`/`publishBook` tail — the seam the override enters), `MINI_DR_SUBTITLE_SPACING.md` (the geometry contrast — why accent, colour-only, needs no parity re-lock), `STRUCTURE_EDITING_PHASE3.md` D5 (the stale-Proof risk the refresh-key test closes), `GUTTER_SCOPE.md` (the named-not-hidden treatment for the §2.2 validation gap).
