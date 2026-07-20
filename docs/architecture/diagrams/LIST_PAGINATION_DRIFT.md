# List-Dense Pagination Drift — Investigation (diagnostic only, no fix)

**Status:** 🔍 **FINDINGS — awaiting CTO. No code changed.** Ordered by the CTO (2026-07-21) after a real 9,280-word manuscript ("The Art of Captivating and Selling" — bullet-list-dense, single-line paragraphs, structurally undetected / 0 chapters) showed the near-empty-page pattern again. Same discipline as `RENDER_DRIFT.md`: reproduce live, measure, classify — **and explicitly do not assume this is the already-disclosed prose residual.** It is not.

**Date:** 2026-07-21

---

## 0. First, an honesty gate: the specific manuscript is NOT in the repository

I do **not** have "The Art of Captivating and Selling". It is not in `backend/uploads/`, not in the SQLite store (which holds only `large-book`), and not a fixture. I cannot measure THAT document, and fabricating numbers for it would be exactly the assume-without-measuring error the CTO just warned against. **To measure the real document, drop the DOCX into `backend/uploads/` or `backend/verification/` and I will run the instruments on it directly.**

What I CAN do honestly: measure the **structural family** the CTO named — list-dense, chapterless — using the closest REAL fixture I have, `Project Management notes.docx` (9 lists, 0 tables, 0 chapters, French Word notes). It is 1,396 words (≈7× smaller than the CTO's), so I report a **rate**, normalized per page, and label every number as a **proxy for direction**, not a measurement of the CTO's file. All measurements are on the current branch, which already carries the authorized Défaut A/B fixes.

## 1. Measured: the reconciliation RATE is ~9× higher on list-dense content

Real fixtures, real pipeline, kdp-5x8, current (A/B-fixed) code:

| Fixture (real) | Shape | Words | Model pg | Unplanned breaks | **Reconciliations / 100 pg** |
|---|---|---|---|---|---|
| Faith_Alone | prose, chaptered (the calibration corpus) | 39,354 | 234 | 2 | **0.9** |
| generated-unstyled | prose, 0 chapters | 3,060 | 16 | 0 | **0.0** |
| **PM-notes** | **list-dense, 0 chapters** | 1,403 | 12 | 1 | **8.3** |

The absolute count on PM-notes is small (1) only because it is tiny. **The rate is the signal: 8.3 reconciliations per 100 pages on list-dense content, vs 0.9 on the prose corpus the tolerance was locked against.** Extrapolated to the CTO's ~9,280-word document (≈7× PM-notes → an order of ~80-90 pages), that rate implies **~7 reconciliations — well past the locked `unplannedPageBreaks ≤ 2`.** This is a directional estimate from a proxy, not a measurement of the file; the real number needs the real DOCX.

## 2. The mechanism, located and measured — not a regression, a THIRD phenomenon

**Root cause: list blocks are ATOMIC and their height is estimated APPROXIMATELY.**

- **Atomic:** Phase B line-splitting (LAYOUT_FIDELITY Decision 7) applies to plain paragraphs only — lists, tables, quotes stay atomic, disclosed. A list that does not fit the remaining space cannot split; it moves whole, and if the model mispriced it, PDFKit overflows and inserts an unplanned page.
- **Approximate height:** the model measures a list as `measure(items.join('\n'))` — one text block wrapped at full column width (`LayoutEngine.estimateBlockHeight`). The renderer draws each item as its **own** `text()` call, with a bullet/number prefix and an 18pt indent (narrower column), item by item. Measured per-block drift on PM-notes' real lists: **−12.5, −6.0, −6.0, +19.2, +4.0, −8.3, +4.4, +7.9 pt** — individual lists off by more than a full line (list-4: **+19.2pt**, drawn taller than charged). The totals happen to near-cancel (ratio 1.002), which is precisely why a whole-document average hid this: the errors are per-block and bidirectional, and an atomic block charged short but drawn tall overflows regardless of what the average says.

**This is distinct from everything already on record:**
- **Not Défaut A/B** (`TABLE_DUPLICATION.md`): PM-notes and the described manuscript have **0 tables**; Défaut B (footer) is unrelated and already fixed.
- **Not the disclosed prose residual** (ADR-0051, the ±1-line bold/italic-run wrapping): that is emphasis-run wrapping inside paragraphs. This is list-item-vs-joined-text wrapping mismatch on atomic list blocks — a different mechanism the prose-only corpus never exercised.

## 3. Classification

**A calibration-generalization gap with a concrete, localizable contributing mechanism.** Two true things at once (the CTO framed this exactly right — it is not purely one or the other):

1. **Calibration:** `unplannedPageBreaks ≤ 2` and the ±8% page-ratio tolerance were locked on a SINGLE prose book, with the CTO's own named condition `RECALIBRATE_PAGE_RATIO_TOLERANCE` reserved for when the corpus reaches ≥3 manuscripts of varied structure. This manuscript is the concrete proof that the prose calibration does not generalize to list-dense content — the trigger the condition anticipated.
2. **Mechanism:** the list-height estimation gap (§2) is a real, improvable measurement mismatch — the same *class* as the prose drifts RENDER_DRIFT already closed for paragraphs (charge what the renderer spends), never done for lists because the prose corpus never stressed it. Tightening it (measure lists per-item, with prefix and indent, as the renderer draws them) would cut the rate; it would not reach zero (genuinely-too-tall atomic lists still reconcile), but every reconciliation stays observable (ADR-0051) — none of this is silent.

**Not a fidelity violation** in the ADR-0050 sense: no text is duplicated or lost (unlike Défaut A). The pages are underfilled, not wrong — a quality/typography defect, grave for a premium product but a different severity class than a document that lies about its content.

## 4. Recommendations (sketched — NOT implemented, per the directive)

1. **Get the real file and measure it** before any number here is treated as this document's. My proxy establishes direction, not the document's actual count.
2. **Tighten list height estimation** to match the renderer's per-item draw (prefix + 18pt indent + per-item wrap), the list analogue of RENDER_DRIFT fix 1 — a localizable improvement that reduces the rate. Own small review/commit if authorized.
3. **Corpus expansion toward the CTO's ≥3 trigger:** this manuscript (or PM-notes promoted, or a real list-dense book the CTO provides) is the natural second varied-structure fixture. Per the standing disclosure rule (`RECALIBRATE_PAGE_RATIO_TOLERANCE`, and every prior fixture decision), **I do not add it to the canonical corpus without the CTO's say-so** — flagged here, not done.
4. **The tolerance itself likely needs a per-shape view**, not one global number — but that is the recalibration review the CTO already reserved for ≥3 fixtures, not this report's call.

## Related

RENDER_DRIFT.md / ADR-0051 (the prose drift class this extends to lists; reconciliations stay observable), PUBLICATION_QUALITY_BAR.md §10 + `RECALIBRATE_PAGE_RATIO_TOLERANCE` (the locked tolerance and its named recalibration condition — this manuscript is its anticipated trigger), LAYOUT_FIDELITY.md Decision 7 (why lists are atomic), TABLE_DUPLICATION.md (the two defects this is explicitly NOT — measured, no tables here), ADR-0050 (why this is a quality defect, not a fidelity violation — no text lost).
