# FOUNDER_TRAVERSAL_1 — the founder's first pass through the real pipeline

**Date:** 2026-07-22 · **Status: REPORT, not a Design Review.** This is the document a future
session reads to understand *why the queue was reordered* after the founder ran his own manuscript
through the studio. It records the founder's raw findings, the named items they produce, and the
mapping to the four decided lots. It proposes no designs and opens no chantier by itself — each
lot earns its own scope/DR in turn.

## §1 What happened

The founder imported his own manuscript ("Without religious performance", a ~114-page English
book on spiritual growth) and used the studio end to end — import, manual structure editing
(10 saved versions: `promoteToChapter`, chapter renames, callouts), theme/typography choice,
and the Proof. The project is in the dev store as `1784744671298-h9o6o9tn2` and is **read-only
for all analysis** (CTO instruction) — every measurement below sondes it without modifying it.

**A provenance note, stated honestly.** The founder's findings reached this session **as relayed
by the CTO in the traversal directive**, not as a separate verbatim transcript. Each finding
below is therefore quoted from the CTO's relay (the closest-to-source text available) and marked
as such — no founder quote is reconstructed or invented. Where the relay is a paraphrase, it is
labelled a paraphrase. Each sentence is treated as a datum.

**One deployment fact that colours everything (measured, §3 of the defects report).** The
founder's file is named `…ldocx` and his stored title/author/language carry pre-fix values that
**current `main` no longer produces**. The measured conclusion: his import ran against a server
whose code predates two fixes now on `main` (the `&&` upload filter and the effective
extension-strip). So some of what he saw is *already fixed*; the traversal's value is that it
still surfaced the ones that are *live*, plus the experience-level truths no unit test measures.
Distinguishing already-fixed from live is the whole point of measuring before correcting.

## §2 The founder's raw findings (as relayed, each a datum)

Quoted from the CTO directive (the source of record for this traversal):

1. **Title = filename with extension.** *"Le nom de fichier (`Without religious performance.ldocx`)
   imprimé comme titre sur la page de titre."*
2. **Placeholders on the page.** *"« Unknown » et « © 2026 Unknown » imprimés."*
3. **Wrong language.** *"Langue détectée FR sur un manuscrit anglais."*
4. **Rename didn't reach the Proof.** *"Le rename de titre du fondateur qui n'a pas atteint le
   Proof."*
5. **One edition selects all three.** *"« PDF edition » qui sélectionne les trois éditions."*
6. **Theme choice is slow.** *"Lenteur du choix de thème (« plusieurs secondes »)."*

And the founder's larger signal, relayed as the reason the traversal was sequenced before
TYPOGRAPHY_QUALITY: his book judged the current **ragged-left** body text with an author's eyes,
and his sense of what a chapter *is* (he manually promoted his own chapters) is ground truth for
the assist question.

## §3 Named items produced

| # | Item | Kind | Lot |
|---|---|---|---|
| 1 | `TITLE_FROM_FILENAME` — filename (with extension) becomes the printed title | Defect — **already fixed on `main`** (measured); founder's project carries pre-fix data | Lot 1 (verify + migration stance) |
| 2 | `PLACEHOLDER_METADATA_PRINTS` — `Unknown` / `© 2026 Unknown` reach a rendered page | Defect — **live** | Lot 1 |
| 3 | `LANGUAGE_HARDCODED_FR` — language is a hardcoded constant, not detected | Defect — **live** | Lot 1 |
| 4 | `TITLE_FIELDS_DECOUPLED` — three "title" fields; only one is rendered; the canonical one has no editor | Defect + IA truth | Lot 1 (the bug) → Lot 3 (the experience) |
| 5 | `EDITION_BUTTON_STATE` — exporting one edition disables all three, reading as "all selected" | Defect — UI state | Lot 1 (the state) → Lot 3 (the affordance) |
| 6 | `THEME_SWITCH_LATENCY` — theme change feels like several seconds | Defect — **frontend locus** (backend render ~300 ms) | Lot 1 (measure/locate) → Lot 3 (perceived perf) |
| 7 | `STRUCTURE_ASSIST` — suggest structure on a manuscript with no Word heading styles | The core dream — scope only | Lot 2 |
| 8 | Ragged-left body vs a real publisher's justified page | Confirms the taste direction | Lot 4 (TYPOGRAPHY_QUALITY) |

## §4 The four decided lots

- **Lot 1 — Defects (now).** Items 1–6. Measure → CTO verdict → atomic correctif each (one
  commit, one intent, gate at every step). The measurement report is
  `FOUNDER_LOT1_DEFECTS.md`; **no production code before the CTO's verdicts.**
- **Lot 2 — `STRUCTURE_ASSIST` (scope now, build later).** The core of the product dream:
  turning a style-less manuscript into structure the author confirms. Measured on the founder's
  real DOCX (he is the ground truth), stopping at findings. Report:
  `STRUCTURE_ASSIST_SCOPE.md`. The doctrinal constraint is engraved: **suggested-never-imposed**
  (ADR-0049), and the cadrage must re-verify the `HEURISTIC_STRUCTURE_DETECTION` closure against
  its real text (non-negotiable #7) and state explicitly how confirmed-suggestion differs from
  the silent guess that closure rejected.
- **Lot 3 — `AUTHOR_EXPERIENCE` (consigned, awaits its turn).** The experience/information-
  architecture layer the defects point at from underneath: the three decoupled "title" fields
  and the missing canonical-title editor (item 4), the edition-button affordance (item 5), the
  perceived latency of the Proof (item 6). Its technical predecessor in the docs is the reserved
  `EDITOR_EXPERIENCE.md` review (PRODUCT_EXPERIENCE §10.8, VISUAL_LANGUAGE §8). Not opened here.
- **Lot 4 — `TYPOGRAPHY_QUALITY` (consigned, awaits its turn).** Already scoped
  (`TYPOGRAPHY_QUALITY_SCOPE.md`): justification with real-dictionary hyphenation as one
  decision. The founder's ragged-left reaction is exactly the taste input that traversal was
  meant to gather; it now waits for its DR turn.

**Sequence engraved:** Lot 1 (measure → verdicts → atomic fixes) → Lot 2 scope delivered as a
report → Lots 3 and 4 await their turns. This document is the why-the-queue-moved record; the
per-defect measurements and the assist cadrage are its two companion reports.
