# Sprint 4 Final Report — Typography Engine

**Sprint:** Sprint 4 ("Typography Engine")
**Branch:** `feature/sprint-4-typography-engine`
**Date range:** 2026-07-17 (single-day sprint, 11 commits)
**Status:** Commits 1-11 complete. PR not yet opened at the time of writing — opens once this report and the final docs pass are committed and re-verified, per the project's "PR only once the whole sprint is done and verified" rule.
**Target version:** `v0.5.0-alpha` (per `docs/VERSIONS.md` — tag not yet cut; this report predates the tag, matching `docs/releases/v0.4.1-alpha/ReleaseNotes.md`'s own precedent of Release Notes accompanying, not preceding, the tag).

---

## 1. Initial Objectives

From the approved Design Review (`docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md`, §1):

1. Centralize typography (font resolution, weight/style, color, spacing, alignment, drop caps, smart quotes, widow/orphan avoidance) in one Domain component instead of three independently-evolving copies inside `PDFRenderer`, `DOCXRenderer`, `EPUBRenderer`.
2. Close a real, silent gap found while preparing the Design Review: **none of the three renderers rendered `Block.inlines`** (bold/italic/underline/strikethrough/superscript/subscript/links/small-caps) — data loss, not a stylistic simplification.
3. Give `LayoutEngine.paginate()`'s already-documented "typography extension seam" a real implementation, without changing its public signature.
4. Activate and expand `QualityMetrics` (`Book.ts`), declared-but-unused since ADR-0008, pending exactly this engine.
5. Resolve ADR-0021's deferred Gelasio font decision into an actual embedded PDF asset.

**CTO priority context:** Typography Engine was priority #1 of 5 in the post-Sprint-3 governance pass (ADR-0021), ahead of `ValidatorEngine`, the plugin system, premium UI, and AI features.

---

## 2. What Was Delivered

**Pipeline:** `ThemeEngine → TypographyResolver → LayoutEngine → Renderer`, with `StyledBook` gaining one additive optional field (`blockTypography`) rather than a new type replacing it — see ADR-0022 for the full rationale, including the larger `TypesetBook` proposal that was reviewed and rejected for blast radius before any code was written.

| Commit | Delivered |
|---|---|
| 1 | `ResolvedTypography`/`TypeRun` domain types; additive `StyledBook.blockTypography` |
| 2 | `TypographyResolver.resolve()` — inline run parsing (`Block.inlines` → `TypeRun[]`) |
| 3 | Drop caps, English-only smart quotes, forced quote/scripture italics (internal defaults, not `Theme`-configurable in v1) |
| 4 | `LayoutEngine` reads `blockTypography` for heading keep-with-next pagination (renamed from the design doc's `orphanRisk` to `staysWithNext` — see ADR-0022) — no signature change |
| 5 | `PDFRenderer` consumes `TypeRun` spans |
| 6 | Real font embedding — Gelasio/Inter/JetBrains Mono (12 `.ttf` files); `PdfFontRegistry` role-based API (ADR-0023) |
| 7 | `DOCXRenderer` consumes `TypeRun` spans + theme-driven heading sizes |
| 8 | `EPUBRenderer` consumes `TypeRun` spans + real CSS drop cap; ADR-0025 (Mammoth underline-drop) documented alongside |
| 9 | `BookMetricsCalculator.calculateQualityMetrics(paginated)` — activates all 7 `QualityMetrics` fields with real values |
| 10 | E2E real-file verification pass — found and fixed 3 real import-pipeline bugs as an explicit scope exception (ADR-0026) |
| 11 | ADR-0022/0023/0024, this report, final docs reconciliation |

**Also delivered as named side effects, not scope creep:**
- Alignment consistency (`block.align`) now respected identically by all three renderers, closing `DOCXRenderer`'s prior silent drop.
- Heading size (`theme.fontSizes.h1-h6`) is now the single source of truth for all three renderers — previously ignored entirely by `PDFRenderer` (hardcoded formula) and `DOCXRenderer` (delegated to `docx`'s own defaults).

---

## 3. ADRs Created This Sprint

| ADR | Title | Status |
|---|---|---|
| 0021 | Post-Sprint-3 Governance Decisions (font policy choice, precedes this sprint's implementation) | Prerequisite, written before Sprint 4 began |
| 0022 | Typography Resolution Pipeline | New this sprint |
| 0023 | PDF Font Embedding — Gelasio, Inter, JetBrains Mono | New this sprint |
| 0024 | Hyphenation and Locale-Aware Smart Quotes Deferred to v2 | New this sprint |
| 0025 | Mammoth Drops DOCX Underline Formatting by Default | New this sprint (found during commit 7's real-export verification) |
| 0026 | Two Import-Pipeline Bugs Fixed During Sprint 4 Commit 10 (Explicit Scope Exception) | New this sprint (found during commit 10's real-file verification) |

Five new ADRs from one sprint — high relative to Sprints 2/3A/3B (2-3 each) — driven by this sprint touching both a new Domain pipeline stage *and* real-file verification surfacing genuine import-pipeline gaps twice (ADR-0025, ADR-0026).

---

## 4. Historical Bugs Found and Fixed

All caught by exporting real fixtures through the running dev server, not by a green `npm test` alone — the same discipline `docs/REAL_EXPORT_CHECKLIST.md` formalizes and that ADR-0019/ADR-0020 established in earlier sprints.

1. **PDFKit crash (`NaN` from `Infinity * 0`) on headerless tables.** Found during Sprint 4 real-export verification, root-caused and fixed in a dedicated branch (`fix/pdf-table-without-header`, PR #8) rather than folded into this sprint's own commits — it predated Sprint 4 and wasn't specific to typography.
2. **`PDFRenderer.renderTitle()` used the wrong font role** (`resolveDefault()` instead of `resolveHeading()`) — found as a side effect of auditing every `PdfFontRegistry` call site during commit 6's role-based API migration. Fixed and disclosed in that commit's message.
3. **Mammoth silently drops DOCX underline formatting by default** (ADR-0025) — found during commit 7's real-export verification against `typography-test.docx`. Triaged as import-pipeline, not rendering-pipeline; documented with a verified workaround and a regression test, deliberately **not fixed** this sprint (scoped to a future "Import Fidelity" sprint).
4. **Strikethrough silently downgraded to plain text on import** (ADR-0026, finding 1) — `HtmlNormalizer.extractInlines()` had no tag-mapping case for `<s>`/`<strike>`/`<del>`.
5. **Whitespace between adjacent inline runs silently dropped, jamming words together** (ADR-0026, finding 2) — `extractInlines()` trimmed every text node independently; a lone whitespace-only node between two tags (a real word separator) trimmed to `''` and was dropped. A real DOCX imported `"mixes bold, italic"` as `"mixesbold,italic"` — content corruption, not a styling loss.
6. **`ASTBuilder.convertInlines()` dropped all plain-text inlines and silently mislabeled unknown inline types as bold** (ADR-0026, finding 3) — found while fixing finding 4/1 above (the untyped strikethrough fell into exactly this trap). Since `TypographyResolver` prefers `.inlines` over `.text` whenever populated, any real formatted paragraph lost all of its surrounding, unformatted prose in every renderer — not a styling loss, missing sentences.

**Findings 4-6 are the sprint's most significant discovery:** unlike finding 3 (ADR-0025), which the CTO triaged as out-of-scope-and-deferred, findings 4-6 were content-fidelity losses (missing/corrupted text, not just missing emphasis) and were fixed immediately as an explicit, disclosed scope exception (ADR-0026) rather than deferred — the CTO's own stated triage line was "is the logical content of the document still intact," not "which pipeline does this file belong to."

---

## 5. Final Metrics

| Metric | Value |
|---|---|
| Tests | **195 passing, 0 failing** (up from 133 at the start of Sprint 4 — +62 tests across the sprint) |
| Global coverage | **90.49%** statements, 80.21% branches, 97.89% functions, 91.72% lines |
| Domain (`domain/services`) coverage | **92.57%** statements, 87.13% branches, 98.43% functions, 93.84% lines |
| ESLint | **0 errors, 0 warnings** |
| TypeScript | strict mode, 0 compiler errors |
| `npm run verify-server` | ✅ passing (health, export route, canonical fixture all confirmed against the real running dev server) |
| `npm run verify-real-export` | ✅ **16/16 checks** (4 canonical fixtures × import + export-docx/pdf/epub) |
| Real-file visual inspection | Real DOCX/EPUB output from `backend/verification/output/typography-test/` text-extracted and read directly (not just asserted via `npm test`) — confirmed correct word spacing, strikethrough rendering, smart quotes, and no missing sentences |

**Per-file test counts** (exact, reconciled this commit — see `docs/CURRENT_STATE.md`'s Test Summary table for the full breakdown): the largest gains were `HtmlNormalizer.test.ts` (17 → 21), `TypographyResolver.test.ts` (0 → 17, new this sprint), `PDFRenderer.test.ts` (6 → 16), and `PdfFontRegistry.test.ts` (0 → 7, new this sprint).

---

## 6. Deliberately Deferred to Future Work

Not gaps found by accident — each is a named, disclosed decision with its own rationale recorded:

- **Hyphenation** and **locale-aware smart quotes** (non-English) — deferred to v2, ADR-0024. English-only smart quotes ship now; hyphenation isn't attempted at all this sprint.
- **Mammoth's underline-drop** (ADR-0025) — a verified workaround exists (`styleMap: ["u => u"]`) but requires touching `MammothParser`, scoped for a future "Import Fidelity" sprint alongside other named-but-unverified gaps (highlight, track changes, comments, text boxes, SmartArt, floating images, nested tables, DrawingML).
- **RTL / multi-script text support** — confirmed out of scope by explicit Design Review decision (also ADR-0019 finding 2); no single embedded font covers every script, and PDFKit does no bidi reordering.
- **`QualityMetrics` HTTP exposure** — `calculateQualityMetrics()` is real and tested (commit 9) but not wired into `ExportManuscriptUseCase` or any route; that wiring is explicitly `ValidatorEngine` scope (CTO priority #2), not Sprint 4.
- **Block-type typography rules as `Theme`-configurable** (e.g. making quote/scripture italics opt-out per theme) — currently `TypographyResolver`-internal defaults (CTO Final Decision 1); the design deliberately leaves room to lift this into `Theme` later without an architecture change.
- **The Documentation & Learning Platform proposal and the ADR-file-per-decision restructuring** (both raised mid-sprint, 2026-07-17) — explicitly deferred until after Sprint 4 closes, tracked as backlog notes in `docs/TODO.md`, not started.

---

## 7. Residual Risks

Carried forward from the Design Review (`docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md` §11), status as of sprint close:

1. **Widow/orphan avoidance is a best-effort nudge layered on an already-approximate pagination estimate** (`LayoutEngine`'s heuristic, ADR-0013) — not a guarantee of pixel-perfect widow control. Unchanged risk, accepted as documented, not mitigated further this sprint.
2. **Gelasio's Georgia-metric-compatibility is a design claim (the typeface's own stated intent), not independently visually verified** against this project's actual `ClassicTheme` output the way ADR-0019's PDFKit spike verified other font claims firsthand. The Design Review recommended a short verification step during commit 6; not confirmed as formally executed in this report — flagged here as an open item rather than silently assumed closed.
3. **Inline-run rendering was a genuinely new code path in all three renderers** — mitigated by real-file verification (commit 10) rather than the spike originally recommended in the Design Review; the spike wasn't done, but the real-fixture E2E tests added in commit 10 cover the same ground with real output, arguably more directly.
4. **`blockTypography`'s optionality requires every reader to tolerate its absence** — mitigated: production code paths are safe by construction (`ExportManuscriptUseCase` always resolves typography before pagination); test fixtures must opt in deliberately, which `LayoutEngine.test.ts`'s `styledBookFrom()`/`typesetBookFrom()` split makes visible rather than accidental.
5. **New risk, not in the original Design Review:** the "Import Fidelity" backlog item (ADR-0025) is now partially stale — 3 of its originally-implied findings (strikethrough, whitespace, plain-text-dropping) were resolved this sprint via ADR-0026, leaving underline and the other named-but-unverified gaps (highlight, track changes, etc.). A future session picking up "Import Fidelity" should read ADR-0026 first to avoid re-investigating already-fixed ground.

---

## 8. Lessons Learned

1. **Real-file verification found bugs that 195 passing unit tests did not.** This is the sprint's central, repeated lesson — not a one-off. `npm run verify-real-export`'s 16/16 was green *before* commit 10's deeper inspection found 3 real content-fidelity bugs; the automated pass/fail check confirmed the pipeline didn't crash and produced non-empty output, but only reading the actual exported text caught that words were missing or jammed together. `docs/REAL_EXPORT_CHECKLIST.md`'s existing "visual inspection, actually look" step is not a formality — this sprint is the third and fourth time (after PDF "Page 6 of 4" and the empty EPUB) that this exact discipline caught something automated checks alone did not.
2. **A stop-and-present discipline for scope ambiguity paid off twice in one sprint.** Commit 9's `QualityMetrics` formulas (`widowsAndOrphans`/`inconsistentSpacing`/`emptyHeadings`) had no locked Design Review formula; rather than guess, the gap was surfaced and definitions were proposed and confirmed before implementation. Commit 10's 3 import-pipeline bugs were found squarely outside the sprint's documented scope (ADR-0025 had just ruled out touching `HtmlNormalizer`); rather than either silently fixing them or silently ignoring them, they were presented with a clear severity distinction (styling loss vs. content loss) and the CTO made an informed, disclosed scope-exception call (ADR-0026) rather than the decision being made unilaterally in either direction.
3. **Additive-field design (ADR-0022's `StyledBook.blockTypography?`) delivered real value without the blast radius of the originally-proposed `TypesetBook` type.** The Design Review's own round 2 (CTO Review Outcomes #3/#4) is a concrete example of a design being meaningfully simplified during review, before any code existed to make that simplification costly.
4. **Centralizing typography in one Domain component surfaced pre-existing duplication that had drifted into silent inconsistency** — three renderers' quote/scripture italics hardcodes agreed today by coincidence, not by design; heading sizes were ignored by two of three renderers in different ways. Consolidation didn't just add features, it made several already-present, accidentally-correct behaviors traceable to one decision.
5. **A one-day, 11-commit sprint with 5 new ADRs is a lot of documentation output relative to code output** (per-commit: roughly one ADR per two commits) — appropriate given how much of this sprint was discovery (2 real-file-verification findings) rather than pure implementation, but worth naming as a data point: sprints with a real-file-verification commit built in should budget documentation time accordingly, not just implementation time.

---

## 9. Links

- Design Review: `docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md`
- Decisions: `docs/DECISIONS.md` (ADR-0021 through ADR-0026)
- Current state (living doc): `docs/CURRENT_STATE.md`
- Backlog: `docs/TODO.md`
- Real Export Checklist: `docs/REAL_EXPORT_CHECKLIST.md`
- Previous release: `v0.4.1-alpha` (`docs/releases/v0.4.1-alpha/ReleaseNotes.md`)
- This report precedes formal `ReleaseNotes.md` for `v0.5.0-alpha`, which will be written once the tag is actually cut (per `docs/VERSIONS.md`'s own "Released only after the tag is pushed" rule) and the Sprint 4 PR merges.
