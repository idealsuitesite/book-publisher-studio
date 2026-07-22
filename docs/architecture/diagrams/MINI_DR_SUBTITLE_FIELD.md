# Mini Design Review — Chapter.subtitle: the gesture, the rendering, the retirement of Novel's asterisk

**Status:** ✅ DELIVERED on `feature/chapter-subtitle` — all four §7 commits built and gated
(1 `7aca991` ops+route · 2 `f951eac` render+price lock-step · 3 `b44a2cf` studio+live · 4 = this
commit), **the screenshot stop PASSED: `CHAPTER_SUBTITLE_RATIO = 0.6` and the italic are LOCKED
(CTO taste stop 2026-07-22, one round — the exhibit is `spikes/output/subtitle-novel-p4.png`,
the gestured faith-alone page in Novel: subtitle subordinate-not-timid inside the title block,
the drop cap on the PROSE — the THIRD_THEME_NOVEL §6 limitation retired on the page that
exposed it, with zero trigger code).** A future ratio change requires a new screenshot loop.
**MERGED to `main` 2026-07-22 (`be2b7a9`), branch deleted; the full gate re-verified POST-merge (backend 795/795, frontend 213/213, harnesses green, corpus parity locks unmoved).**
The loop's secondary verdicts, §9 below. Originally:
CTO-APPROVED (2026-07-22) **with three amendments, integrated below before any
code:** **A1** — the unblock guard written into the TODO entry itself (our own Subtitle-styled
export NEVER triggers the unblock — the fabricated-material variant the CTO already forbade on
RECALIBRATE; re-importing our export is an extra exercise the day an EXTERNAL manuscript fires
it, never the trigger); **A2** — first-row-only enters §8 as disclosed v1 boundary n°6 with its
exit door; **A3** — the already-populated/clear-on-empty throws prove themselves TYPED at both
levels: the route tests assert the named `ApiErrorCode` in BOTH directions (a screen may only
show an error it can name — IMPORT_FIDELITY's rule applied to defense-in-depth). Build
authorized: commits 1–2, then **MANDATORY STOP at commit 3** — the gestured faith-alone page
rendered in Novel, rasterised for the CTO (subtitle rendered, drop cap on the prose) before
0.6/italic lock; commit 4 amends the existing TODO entry for A1 rather than creating it.
**Date:** 2026-07-22, approved 2026-07-22
**Inputs:** `SUBTITLE_FIELD_SCOPE.md` (measured) · the CTO's four §6 answers + the
already-populated ruling (2026-07-22) · `THIRD_THEME_NOVEL.md` §6 (the consigned limitation this
retires).

---

## 0. The instrument, validated as demanded before the zero stands as fact

**The positive control PASSED** (CTO-required, the instrument-liar doctrine): the census spike
now generates, in-memory, a minimal DOCX carrying a real `Subtitle` paragraph style **and its
French styleId sibling `Sous-titre`**, and must count both before it censuses the corpus —
`POSITIVE CONTROL PASSED: Subtitle=1, Sous-titre=1`, then the corpus zero re-confirmed in the
same run (`subtitle-style-census-spike.ts`, self-validating on every future run; a failed
control poisons the zero and exits non-zero). **"No Subtitle style in the corpus" is now a
validated fact, not a comfortable measurement.**

## 1. The five locked decisions (the CTO's four + the already-populated ruling)

1. **Authoring-first only.** The import styleMap is NOT built — untestable on real material the
   day it is born (the C1 trap). **Named unblock `SUBTITLE_IMPORT_MAPPING_UNBLOCK`** (TODO.md,
   the C1 form, CTO's exact wording): *a real manuscript carrying a genuine Subtitle style
   enters the corpus → the styleMap line plus the same rendering path, tested on that material
   that day.*
2. **The look:** italic, subordinate scale (**0.6 × the title size as the starting point, not a
   lock**), under the title inside the same title block, ONE universal treatment first (the
   callout-D1 logic). **Explicit taste stop at the screenshot loop — which MUST include the
   gestured faith-alone chapter rendered in NOVEL**: the subtitle rendered AND the drop cap
   landing on the first prose paragraph beneath it. Not only clean Classic/Modern pages.
3. **`clearSubtitle` reinserts as first paragraph.** Round-trip is **plain-text identity** —
   the inline formatting lost at mark does NOT come back at clear (the promoteToChapter
   disclosure, extended per the CTO to cover the round trip explicitly, both directions).
4. **UI wording:** "Make this the chapter subtitle", on the block row, beside the two existing
   gestures — the pattern's fourth use.
5. **Already-populated:** the affordance **disables when `subtitle` is set** — the author
   clears first, explicitly. No hidden compound op. *The DR examined the alternative and found
   no measured reason to prefer it* — a compound replace would be two mutations in one snapshot
   (against the one-validated-command-one-version granularity Q2 locked), and every sibling op
   rejects rather than composes (the no-op-rejection philosophy). The CTO default stands.

## 2. The operations (Shape: the `setCallout` template, fifth use of the machinery)

- **`markAsSubtitle(book, blockId)`** — the block must be a paragraph **directly in a TOP-LEVEL
  chapter's `content`** (Sections have no `subtitle` field — verified in `Book.ts`; nested
  paragraphs are out, v1 boundary disclosed). Throws when the chapter's `subtitle` is already
  populated (decision 5's op-level enforcement — defense-in-depth behind the disabled
  affordance, never a 500 path). Effect: `chapter.subtitle = block.text` (plain text), the
  block leaves `content`.
- **`clearSubtitle(book, chapterId)`** — throws when no subtitle; effect: the subtitle text
  reinserted as the chapter's FIRST paragraph (a freshly minted block id — the injectable
  `idGenerator`, the promoteToChapter pattern), the field removed (`delete`, the
  property-removal idiom).
- No book-level `updatedAt` bump (the convention the callout instrument enforced — engraved in
  `setCallout`'s comment, honoured here from birth).
- `StructureMutation` gains both variants; **`parseMutation` whitelisted WITH route tests in
  the same commit** (the named lesson, applied d'office).

## 3. Cache — A CORRECTION TO THE SCOPE REPORT, flagged not slipped

`SUBTITLE_FIELD_SCOPE.md` §5 claimed clear would be the §3.6 legitimate-HIT's fourth
application. **That was wrong, and this DR corrects it:** `clearSubtitle` mints a NEW block id,
so the cleared book is NOT byte-identical to the pre-mark book — the hash differs and the cache
re-paginates once. That miss is **conservative and correct** (a content-hash key cannot know
two differently-id'd books share a geometry; serving nothing wrong, costing one pagination).
The genuine legitimate-HIT case here is **UNDO** (`restoreVersion` restores the byte-identical
snapshot). The standing scenario asserts the honest trio: **mark → MISS · clear → MISS (reason
pinned in the test comment) · undo-after-mark → legitimate HIT.**

## 4. Render + price — the lock-step extension (the one R2 edge)

- **PDF:** `renderTitle` draws the subtitle after the title, before `titleSpaceAfter`: italic,
  `0.6 ×` the title size (fractional on purpose). **`titleHeightOf` adds the measured subtitle
  height inside the SAME expression** — charged == consumed by construction, the
  MINI_DR_SUBTITLE_SPACING seam extended, never a parallel calculation.
- **Disclosed residual:** the measurer has no italic axis (`measureHeight` measures the regular
  face); the renderer draws Gelasio-Italic. Same family metrics → identical line heights,
  marginally different wrap widths — the standing ±1-line residual class (bold runs, split
  segments), named here rather than discovered.
- **DOCX:** a REAL `Subtitle`-styled paragraph after the H1 — the style declared in
  `styles.xml`, Word's own convention. *Deliberate bonus: our export becomes the first genuine
  Subtitle-styled material in this project's world — the day `SUBTITLE_IMPORT_MAPPING_UNBLOCK`
  fires, re-importing our own export exercises the mapping.*
- **EPUB:** a `chapter-subtitle` element + CSS (italic, relative size) under the heading.
- **Parity locks untouched by construction:** population is gesture-only; the fresh-import
  corpus renders byte-identically (asserted). Lit-but-empty, the callout pattern. The gestured
  book's numbers lock on the real fixture through the real mutation route
  (`projectExportReflectsEdit` pattern).

## 5. The studio

The first paragraph row of a top-level chapter (subtitle empty) gains **"Make this the chapter
subtitle"** — first row only: the gesture means "the line under the title", and that is where
the real case lives (the Novel screenshot-loop find). A chapter WITH a subtitle shows it in the
header area with **"Remove subtitle"** (the clear gesture, visible, its own undo). Affordances
on rows already rendered (D5 — no new rows). jsdom: affordance placement, disabled-when-
populated, both handlers' mutations.

## 6. Verification plan

Ops unit tests FIRST (mark/clear/plain-text round trip both directions/eligibility/
already-populated throw/unknown id/immutability) · route tests with the whitelist (same
commit), **asserting the named `ApiErrorCode` on BOTH refusal directions — mark-on-populated
AND clear-on-empty (A3: the throw typed at both levels, never a bare 500 path)** · the gestured-fixture export lock on faith-alone (subtitle out of the flow, rendered
in all three formats — DOCX carries the real `Subtitle` style — clear restores) · corpus parity
byte-stability (no gesture, no change) · the §3 cache trio · frontend jsdom · **the screenshot
loop closing on the CTO's required page: gestured faith-alone in Novel — the subtitle rendered,
the drop cap on the prose paragraph — the consigned limitation retired on the very page that
exposed it.**

## 7. Commit plan (one responsibility each; gate green before the next)

1. **The ops + the route.** `markAsSubtitle`/`clearSubtitle` (tests first), `StructureMutation`
   variants, `parseMutation` + route tests, DTO already crossed (`ChapterMapper.subtitle` —
   verified, nothing to add).
2. **Render + price, lock-step tri-format.** `renderTitle`/`titleHeightOf` together; DOCX
   `Subtitle` style; EPUB element+CSS; the gestured-fixture lock + parity stability + cache
   trio.
3. **The studio + live + the screenshot STOP.** The two affordances; live arc on faith-alone
   (mark → Proof → exports → clear → undo); **the Novel gestured page rastered for the CTO**
   (values 0.6/italic lock only after that look).
4. **Docs.** `SUBTITLE_IMPORT_MAPPING_UNBLOCK` in TODO.md (C1 form); reconciliation at merge.

## 8. Disclosures (complete list, each with its precedent)

1. Inline formatting lost at mark, **not restored at clear** — round-trip is plain-text
   identity (promoteToChapter, extended per CTO).
2. Subtitle words leave `wordCount` (titles are uncounted today — consistency, said).
3. The italic-measure ±1-line residual class (§4).
4. The §3 cache correction to the scope report (clear = conservative MISS, not legitimate HIT).
5. V1 boundary: top-level chapters only (Sections carry no subtitle field).
6. **V1 boundary (A2): the mark affordance sits on the FIRST paragraph row only** — the gesture
   means "the line under the title", where the real case lives. A manuscript whose chapter
   opens on an epigraph BEFORE its subtitle will one day exist and will not see the affordance
   there; the exit door is extending the affordance's placement if a real case demands it (the
   op itself already accepts any top-level-chapter paragraph — a UI decision, not a model one).

## 9. Screenshot-loop record (2026-07-22 — the verdicts and the two measured findings)

1. **The ratio LOCKED in one round** (§-status above; the exhibit named). The comparison of the
   two exhibits — generator vs real studio export, geometry identical to the point — was itself
   the CTO's secondary verdict: the pipeline prints exactly what is stored.
2. **Counter discrepancy, MEASURED (CTO point 1):** sidebar 16 ch (`Explorer.tsx` →
   `computeBookFacts` — the EDITORIAL count, classifier-excluded canonical parts) vs station
   header 17 chapters (`StructureEditor` — the STRUCTURAL count, the Part-chantier's deliberate
   "counts what things ARE"). **Nothing invented: two true notions, deliberately decided in two
   chantiers, never confronted — the defect is the UNLABELED disagreement** (15 vs 17 even
   without the rename). CTO ruling: **label, never merge** → `COUNTER_LABELLING` (TODO), form
   at a future capture-based taste stop.
3. **"(edited)", MEASURED (CTO point 2):** stored in `Chapter.title` (DB probe), provenance
   `version 1: "before rename"` — the phase-3 live rename never undone; it printed faithfully
   in the export (the exhibit shows it). **Not a fidelity defect — demo-data pollution.**
   Repaired by the real rename route on CTO authorization; the classifier effect RE-MEASURED
   after (editorial count 16 → 15). **The lesson, consigned (DEVELOPMENT_WORKFLOW):** a live
   verification that mutates the permanent library undoes itself in the same session — the
   harness-cleanup rule extended to manual gestures.
4. **The two UI findings** (long titles breaking one-word-per-line; block lists scrolling
   horizontally) predate this chantier → `STRUCTURE_ROW_LAYOUT` + the umbrella
   `STRUCTURE_STATION_ERGONOMICS` (TODO), never folded into commit 3 (one commit, one intent).

## Related
`SUBTITLE_FIELD_SCOPE.md` (corrected by §3) · `THIRD_THEME_NOVEL.md` §6 · `MINI_DR_SUBTITLE_SPACING.md`
(the seam) · `CREATE_CHAPTER.md` / `MINI_DR_CALLOUTS.md` (the gesture machinery) ·
`C1_QUOTE_PRESENTATION_UNBLOCK` (the unblock form) · `subtitle-style-census-spike.ts` (§0).
