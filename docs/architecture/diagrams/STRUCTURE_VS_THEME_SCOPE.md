# Structure Editing vs. Second Theme — Scope Report, not a Design Review

**Status:** SCOPE REPORT for CTO decision. **No code.** Same purpose and shape as `GUTTER_SCOPE.md`: what each candidate really costs (layers touched, R2 risk), what each concretely unblocks for an author finalizing a book, and whether one is a prerequisite of the other. **A decision menu, not a recommendation disguised as fact** — the CTO arbitrates the order.
**Date:** 2026-07-21, grounded in the code and docs on `main` at `0f695bd`.
**Why now:** with the paid-AI structure-detection path frozen (`NO_PAID_AI_BEFORE_REVENUE`), these are the two backlog chantiers that carry the founder's goal — *the author has all the elements to finalize a professional book without paid AI* — split into its two halves: **organize** (structure editing) and **stylize** (a second theme).

---

## 0. The two halves of the same promise

The founder's requirement is one sentence: an author should spend little energy finalizing. It decomposes into two independent capabilities:

- **Organize** — fix a manuscript whose structure imported wrong (reorder chapters, rename, add front/back matter). This is the *same real problem* the AI detection targeted, minus the paid dependency and the silent-false-positive risk.
- **Stylize** — choose how the finished book looks. Today there is exactly one aesthetic (Classic), so "advanced formatting with little effort" currently means "little effort, no choice."

Neither is a subset of the other, and both are already named in the backlog. This report costs each.

---

## 1. Chantier — Manual structure editing (`EXPLORER_PARITY.md`)

**What it is.** One missing *capability class*, not four widgets (`EXPLORER_PARITY.md` §0): drag-drop chapter reorder, inline rename, and front/back matter as manipulable sections. Today the Explorer is a read-only navigator — measured live: `[draggable]` count **0**, contenteditable/input inside the Explorer **0**, and the project routes expose no structure mutation at all (`projects.ts`: `GET`/`GET :id`/`PATCH settings`/`POST export`/`POST publish`).

**Layers touched — all of them (this is the big one):**
| Layer | Work |
|---|---|
| Domain | A new **AST-mutation service** — pure reorder/rename/front-matter ops returning a *new* immutable `Book` (ADR-0001). |
| Application | A use case wiring the existing seam **`ProjectService.replaceBook` + `snapshot()`** (version-before-edit is already the domain's pattern, `EXPLORER_PARITY.md` §1); **versioning/undo** semantics. |
| Presentation | New **mutation routes** (reorder/rename/front-matter) — none exist today. |
| Frontend | Per-chapter **editable nodes** in the Explorer (they don't exist — chapters are one nav button today), a **drag-drop library** (none in `package.json`), inline rename UI, and front/back-matter editing. |

**A content-model decision it forces.** Front matter is currently **generated output, not user content**: `FrontMatterBuilder` synthesizes a title/copyright page *at export time only*, and import always sets `frontMatter: {}` (`EXPLORER_PARITY.md` §3). Making it "manipulable sections" means promoting front matter to real user content — a model decision, not just UI.

**R2 risk: essentially NONE for the pagination contract.** Editing produces a new `Book` AST; the *same* deterministic pipeline (`ThemeEngine → TypographyResolver → LayoutEngine → Renderer`) re-paginates it. The charged-vs-consumed contract (ADR-0051) is untouched because the mechanism is unchanged. The real risk surface is **the write path itself**: mutation correctness, immutability discipline (new instances, never in-place), and undo/versioning. Validation stays read-only (ADR-0027) — editing is a separate write path, never validation's.

**What it unblocks.** An author whose import structured wrong is no longer stuck: they fix it themselves, deterministically, no false positives, no paid dependency. It also serves a **second demandeur** — Import Fidelity's "manual structure correction post-import" shares this exact prerequisite (`IMPORT_FIDELITY.md`, `EXPLORER_PARITY.md` §0). One chantier, two callers.

**Effort: LARGE, and needs a full Level-1 Design Review** (the CTO's own verdict in `EXPLORER_PARITY.md`: AST-mutation service, versioning/undo, `replaceBook`+`snapshot` as the entry seam). Not a mini-review.

---

## 2. Chantier — A second Book Presentation theme

**What it is.** A second entry in the theme registry. A `Theme` is declarative data (fonts, sizes, colors, spacing, running head — `Theme.ts`), and `getTheme` is a trivial one-line registry (`getTheme.ts`: `THEMES = { classic }`). ADR-0029 explicitly built the pipeline to consume *future* themes "without any LayoutEngine change," and `ClassicTheme.ts` even reserves the accent-aesthetic decision "for the second theme's screenshot loop." The architecture already anticipates this.

**Layers touched — few:**
| Layer | Work |
|---|---|
| Domain | A new `Theme` object + one registry line. Trivial as *data*; the design (what it looks like) is the real content. |
| Fonts | **Reuse the three embedded SIL-OFL faces** (Gelasio serif / Inter sans / JetBrains mono, 4 variants each) → **no new embedding**. Only a genuinely *new typeface* adds embedding (SIL-OFL font, 4 variants, registry entry, and re-measuring the drop-cap `capHeight` plausibility range for that face). |
| Frontend | **~Zero.** The theme gallery is already theme-count-agnostic — `FormatSelector.tsx` maps `options.themes` (the registry enumerated via `listThemeNames()`); a second theme appears as a card automatically. Engine-rendered thumbnails remain optional polish (backlog), not required. |

**R2 risk: LOW, but real per-theme verification.** A second theme changes fonts/sizes/spacing → different line heights → a different page count. The render-drift mechanism absorbs this **by construction**: `LayoutEngine` measures the *real* theme's faces via `TextMeasurer` (the "size not family" assumption was measured false and fixed). So charged still equals consumed — *for the new theme's own numbers*. The caveats:
- `PDFRenderer.parity.test.ts` is **locked on Classic/faith-alone** (238 pages, etc.). A second theme needs its **own** parity lock — new numbers, its own assertion. It does not threaten Classic's.
- The §10 page-ratio calibration (`PUBLICATION_QUALITY_BAR.md`) is **Classic-only** (its WPP registry is Classic's). A second theme adds a theme dimension to `RECALIBRATE_PAGE_RATIO_TOLERANCE` and needs its own words-per-page baseline.

**A design dimension, not just code.** The second theme's aesthetic is a **CTO screenshot-loop call** (VISUAL_LANGUAGE §9; `ClassicTheme.ts` defers the accent decision to it). Unlike structure editing, part of this chantier's cost is *taste calibration*, not engineering.

**What it unblocks.** A real aesthetic *choice* — the point at which "advanced formatting with little effort" stops ringing hollow. It directly changes what "I can export something professional" means to an author, and it exercises the theme architecture (accent colours, running heads, drop-caps) that is currently validated by a single resident.

**Effort: SMALL to MODERATE.** Small if it reuses the embedded faces (a `Theme` object + registry line + its own parity/calibration verification + a CTO aesthetic pass). Moderate if it introduces a new typeface (+embedding + `capHeight` range). No new architecture.

---

## 3. Prerequisite or independent?

**Independent.** They touch disjoint foundations: structure editing is a **write path** (AST mutation, routes, versioning); a second theme is **declarative data + presentation**. Neither blocks the other; either can go first.

**Complementary, not competing.** Structure editing is the *organize* half, the second theme the *stylize* half. Both shipped is what makes "all the elements to finalize" literally true. And structure editing carries a **shared prerequisite** with Import Fidelity's manual-correction gap — doing it once discharges two backlog items.

---

## 4. Decision menu (the CTO arbitrates; this report does not pick)

The choice turns on which lever weighs more on *real finalization energy* — the CTO's own open question. The two profiles, stated neutrally:

| | **Second theme first** | **Structure editing first** |
|---|---|---|
| Effort | Small–moderate | Large (full Level-1 review) |
| R2 risk | Low (own parity/calibration lock; +font work if new face) | ~None on the pagination contract; risk is the write path (mutation/undo) |
| Unblocks | A real aesthetic *choice* — changes what "professional export" means | A bad import is no longer a dead end — the deterministic answer to what AI detection targeted |
| Leaves open | The organize gap (a mis-structured import still can't be fixed) | The aesthetic ceiling (still one theme) |
| Bonus | Exercises the theme architecture beyond one resident | Discharges Import Fidelity's manual-correction prerequisite too |
| Non-engineering cost | A CTO aesthetic/screenshot pass | A content-model decision (front matter as user content) |

**The trade-off in one line:** the second theme is the **cheaper, lower-risk, faster-visible** win that reuses architecture already built for it, but it only deepens the *stylize* half; structure editing is the **larger** chantier that closes the *bigger real gap* (and serves two demandeurs), but it opens a new write path and a content-model decision. Neither is a prerequisite of the other, so order is pure priority, not dependency.

**What this report deliberately does not do:** recommend one. The two cost/unblock profiles are laid out so the CTO can weigh them against which finalization pain an author actually hits first — the measurement the CTO said they didn't want guessed.

---

## Evidence index (all on `main` at `0f695bd`)
- `EXPLORER_PARITY.md` §0–§5 — the structure-editing audit (one capability class; live-measured 0 draggable/editable nodes; the `replaceBook`+`snapshot` seam; front matter as generated output).
- `backend/src/presentation/routes/projects.ts` — no mutation route exists today.
- `Theme.ts` / `getTheme.ts` / `ClassicTheme.ts` — theme is declarative data; registry is one line; ADR-0029 built for future themes; the accent decision reserved for the second theme.
- `PdfFontRegistry.ts` + `assets/fonts/*` — three embedded SIL-OFL faces (Gelasio/Inter/JetBrains), reusable without new embedding.
- `frontend/components/FormatSelector.tsx` — the gallery maps `options.themes`, theme-count-agnostic; a second theme is auto-picked-up.
- `PDFRenderer.parity.test.ts` (ADR-0051) + `PUBLICATION_QUALITY_BAR.md` §10 — Classic-locked parity/calibration a second theme must re-derive for itself.
- ADR-0001 (immutability), ADR-0027 (validation read-only — editing is a separate path), ADR-0029 (theme extensibility without LayoutEngine change).
