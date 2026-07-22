# Mini Design Review — KDP margin/gutter validation (GUTTER_VALIDATION_FIRST, chantier D)

**Status:** ✅ MERGED to `main` (2026-07-22, no-ff; queue item 1). Built exactly as designed below; backend **716/716** post-merge, tsc + eslint clean; the real-fixture pair proven on faith-alone (default kdp-6x9 → no margin issue; a 20pt inside margin → `INSIDE_MARGIN_BELOW_GUTTER`); `verify-real-publish` **4/4 live with no `MARGINS_UNKNOWN`** — the metrics reach the rule end to end through the real HTTP route. One environmental note: the publish harness posts to the raw-bytes route and creates **no** fixture projects — the repollution risk named in `HOME_TIGHTEN_SCOPE` applies to the import/export harnesses only. *(Original status: approved-by-delegation under the CTO queue directive 2026-07-21 — technical, no taste decision; the standing `GUTTER_SCOPE.md` §4 option-1-only decision not reopened.)*
**Date:** 2026-07-22.
**Re-verified against current code** (non-negotiable #7), on `main` at `c8f6826` — and the re-measurement **improved the premise**: `GUTTER_SCOPE.md` §1 and ADR-0038 both described real render metrics as unreachable by post-render rules. **That wall no longer exists**: the bundle carries `RenderedOutput.metrics` and `PageCountRule` already reads `metrics.pageCount` through it (`PageCountRule.ts:36`, the RENDER_METRICS Decision-2 route; ADR-0042). So `metrics.pageLayout` — the real geometry the artifact was rendered at (`RenderMetrics.ts:31`) — is **already reachable** and this chantier needs **no contract evolution at all**: one new rule + one Domain helper. Also re-confirmed: `marginsByPageCount`/`gutterIn` are still read by no rule (grep — only `KDPRuleData.ts` itself), and every preset still ships 72pt symmetric margins.

---

## 1. What changes

The dead `KDPRuleData.interiorSpec.marginsByPageCount` table finally gets a consumer: a **`MarginComplianceRule`** (`PostRenderValidationRule`) that validates the **real rendered geometry** (`metrics.pageLayout`) at the **real rendered page count** (`metrics.pageCount`) against KDP's published gutter/margin minimums. Today's compliance is *accidental* (72pt inside > the 63pt maximum requirement, `GUTTER_SCOPE.md` §0); after this it is *enforced* — an author who ever tightens an inside margin gets a nameable ERROR instead of a silently non-compliant book. **Zero renderer change, zero pagination impact, zero R2 surface** (validation reads what was rendered; it renders nothing).

## 2. Design decisions

1. **The "inside-margin notion in the model" is a derivation, not a stored field.** `insideMarginOf(layout)` = `min(marginLeft, marginRight)`, a pure helper beside `PageLayout`. With symmetric, unmirrored margins the binding side alternates recto/verso, so the *guaranteed* inside margin on every page is the minimum of the two — storing a separate `insideMargin` field the renderer ignores would be a lie in the model. The helper is documented as **the one seam to update** when real inside/outside mirroring lands (`GUTTER_SCOPE.md` §4 option 2, explicitly not taken now).
2. **Rule shape follows the house pattern** (ADR-0036/Decision 7): configuration by constructor (`marginsByPageCount`, `artifact: 'pdf'`), data injected by `KDPRuleProvider`, no platform name inside the engine, metrics read through the bundle (the `PageCountRule` precedent — no second copy on the context).
3. **Three honest outcomes, one deliberate silence:**
   - metrics/pageLayout/pageCount unreachable → **WARNING `MARGINS_UNKNOWN`** (the disclosed-unknown pattern — never a false green);
   - `insideMarginOf < gutterIn·72` for the page count's row → **ERROR `INSIDE_MARGIN_BELOW_GUTTER`**;
   - `min(marginTop, marginBottom) < outsideMinIn·72` → **ERROR `MARGIN_BELOW_MINIMUM`** (the horizontal outside needs no separate check: the alternating-sides guarantee makes it ≥ the inside minimum, which every row's gutter already exceeds);
   - page count **beyond the table** (>828) → **no issue from this rule**: `PageCountRule` already owns `PAGE_COUNT_OUT_OF_RANGE`, and double-reporting one fact as two errors is noise, not rigour.
4. **Row selection:** first row with `pageCount <= maxPages` — the table is ascending and KDP's requirement steps at those boundaries (verified against the ADR-0035 spike transcription, not re-derived).

## 3. Verification plan

- **Unit (`MarginComplianceRule.test.ts`):** compliant 72pt layout at a mid-table count; a tightened `marginLeft` failing at a higher row (**fails for the right reason** — the message names the row's requirement); a top/bottom violation; missing metrics → WARNING; >828 pages → silent (deference proven); an exact-boundary count picks the right row.
- **Provider:** `KDPRuleProvider` roster includes the rule with the real data table.
- **Real fixture (REAL_FIXTURE_POLICY — publishing change):** faith-alone through the real publish pipeline on the default kdp-6x9 layout → **no margin issue** (the §0 accidental compliance, now *proven* by the rule rather than assumed); the same book at a deliberately tightened inside margin → the ERROR appears. Plus `verify-real-publish` live (4/4).

## 4. Risks

- **False alarm on unusual-but-compliant layouts:** impossible by construction — the rule compares the *rendered* geometry to the *published* table; there is no heuristic.
- **The helper drifting when mirroring lands:** named in the helper's own doc (§2.1) — option 2's future review must update `insideMarginOf`, and its absence from that review would be caught by this rule's tests going stale against mirrored layouts.
- **Scope creep to the renderer:** locked out by the standing CTO decision; nothing in this chantier touches a renderer file.

## Related
`GUTTER_SCOPE.md` (the measured scope; §0 accidental-compliance finding; §4 option 1), ADR-0043 (the origin, premise corrected by the scope report), ADR-0035/0036/0037 (rule-provider discipline), ADR-0038 + `PageCountRule.ts` (the metrics route this rule reuses — the wall that no longer exists), ADR-0042 (validate the artifact, never the estimate), `RenderMetrics.ts:31` (`pageLayout`).
