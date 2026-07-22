# STRUCTURE_ASSIST_SCOPE — the cadrage (measure only, stops at findings)

**Date:** 2026-07-22 · **Status: MEASUREMENT REPORT — no design, no chantier name yet.** Lot 2 of
FOUNDER_TRAVERSAL_1. Measured on the founder's real DOCX (his stored source bytes, read-only). The
doctrinal constraint is engraved before any finding: **the result would be suggested, never
imposed (ADR-0049)** — this report measures whether that is reachable and re-verifies the
`HEURISTIC_STRUCTURE_DETECTION` closure against its own real text (non-negotiable #7). It proposes
no algorithm and no design.

## §0 Why this manuscript is the right instrument

The founder is the ground truth: he imported a ~114-page book that arrived with **zero detected
chapters**, then manually built structure (`promoteToChapter`, 10 versions). What he did by hand
is exactly what an assist would propose. And his file is a *real* style-less manuscript from a
*real* author — the material the `REAL_FIXTURE_POLICY` demands and the semantic half of detection
never had.

## §1 The typographic closure holds — re-verified on this file (non-negotiable #7)

`HEURISTIC_STRUCTURE_DETECTION` was closed on evidence: without Word heading styles, the signals
that survive mammoth's conversion carry no heading information. Re-measured on the founder's DOCX:

- **HTML `<h1>–<h6>` elements: 0.**
- **Paragraph style names exposed: 0** (empty set).
- **Runs with a `fontSize`: 0 of 5,475** (490 bold runs, 0 all-caps *runs*).

Identical mechanism to the closure's three fixtures, now confirmed on a fourth real manuscript.
The author wrote plain paragraphs; there is nothing typographic to detect. **The closure stands
for the typographic avenue — nobody should reopen *that* believing a better formatting heuristic
exists here.** This is the part the closure got right, re-proven.

## §2 The semantic avenue the closure left unmeasured is WIDE OPEN here

The closure explicitly deferred "the *semantic* half (quotes, dialogue… probably suffers the same
mechanism, but **probably is not measured**)." This manuscript measures it — for structure — and
the result is the opposite of the typographic one:

**The founder typed his structure as literal ALL-CAPS text.** Extracted from the converted text
(3,030 paragraphs):
- **27 standalone ALL-CAPS lines**, including `FOREWORD`, `INTRODUCTION`, `CHAPTER 1`,
  `CHAPTER 2`, `CHAPTER 3`, `CHAPTER 4`.
- **19 lines matching structural keywords** (`FOREWORD` / `INTRODUCTION` / `CHAPTER n` / …).

These markers are **invisible to heading-style detection** (there is no style — they are
capitalised prose) and **glaring to a text/pattern reader**. `CHAPTER 1` alone on its line is an
unambiguous authorial chapter marker. The importer dropped them to body paragraphs precisely
*because* the pipeline only makes chapters from HTML headings — so the founder had to hand-promote
the structure he had already written in words. **An assist reading the text, not the formatting,
would have proposed the structure he clearly intended.**

## §3 What a suggester recovers — measured, with the honest failure mode

A crude two-part measurement against the founder's own boundaries:

- **Generic "short line" detection FAILS, measured:** 2,682 of 3,030 paragraphs are ≤8 words
  (his book is written in short, near-aphoristic lines), giving a naive short-line suggester
  **~0.1% precision** — useless. This is the measured warning: a generic layout heuristic drowns.
- **Pattern/keyword + standalone-ALL-CAPS SUCCEEDS:** the `FOREWORD / INTRODUCTION / CHAPTER n`
  markers are a small, high-precision candidate set (~6–7 real markers among the 27 ALL-CAPS
  lines; the keyword set's few false hits are a recurring `Next Step` artifact from text the
  founder pasted, not a structural marker — itself a signal the candidate set must be curated,
  not raw).
- **The one genuinely unrecoverable boundary:** the founder also promoted a *body sentence*
  ("Spiritual growth is one of the most misunderstood pursuits…") to a chapter title. No detector
  can flag prose as a heading, and it should not try. This is the correct limit of suggestion:
  propose the obvious typed markers; the author adds the rest. **Recall is bounded by authorial
  intent that leaves no textual trace — and that is fine, because the author is present.**

So the measured shape: a suggester keyed on **explicit textual markers** (chapter/part/section
keywords, standalone all-caps, numbered patterns) is high-precision on this manuscript; a generic
short-line/whitespace heuristic is not. n=1 for the semantic measurement — the same corpus-growth
caution as the page-ratio tolerance; a strong existence proof, not yet a calibrated rule.

## §4 Why suggestion clears the bar the closure rejected (ADR-0049)

The closure rejected detection as **silent truth**: "a false chapter accepted silently is worse
than an honest '0 chapters detected', because the first invites misplaced trust." Its CTO
threshold (<5% false positives) was a bar for *silent* acceptance.

**Confirmed-suggestion is a different instrument, and the difference is doctrinal, not cosmetic:**
- Under ADR-0049's explorable-findings pattern, the assist would say *"we found 'CHAPTER 1',
  'CHAPTER 2', … — make these chapters?"* and the author confirms, edits, or dismisses each.
  Nothing enters the book as truth without an authorial act.
- The closure's fatal failure — a silently-accepted false chapter inviting misplaced trust — **cannot
  occur** when every candidate is confirmed. A false candidate costs the author one dismissal,
  not a corrupted structure they trust.
- Therefore the *precision bar for a suggestion is lower than the <5%-FP bar for silent truth*,
  and the manuscript shows the achievable precision (on curated markers) is high anyway. The
  question the assist must answer is not "is it certain?" but "is it worth proposing?" — a
  fundamentally cheaper bar that ADR-0049 already blessed for import findings.

**The line to hold (engraved):** suggestion never becomes silent import. The moment a detector's
output enters the book without an authorial confirmation, it is the thing the closure forbade.
The whole value is the human gate.

## §5 What this report deliberately does not do

Name the chantier, choose a detector, design the confirmation UI, or set a precision target. Five
measured facts are on the table: **(1)** typographic detection is still closed here (0 styles, 0
sizes, 0 headings); **(2)** the author wrote his structure as explicit ALL-CAPS text the pipeline
threw away; **(3)** a marker/keyword suggester recovers those at high precision while a generic
short-line one fails at ~0.1%; **(4)** one boundary (a promoted body sentence) is correctly beyond
any suggester; **(5)** confirmed-suggestion clears the doctrinal bar the silent-guess closure
rejected, because the author is the gate. Whether this becomes the `STRUCTURE_ASSIST` chantier,
and in what shape, is the CTO's next decision on reading this. n=1 — the semantic signal should be
re-measured as more real manuscripts arrive, exactly as the closure asked for its own avenues.

## §6 Instrument

`backend/spikes/founder-structure-assist-probe.ts` — read-only on the founder's stored bytes:
heading-survival (mammoth `transformDocument` + HTML `<h1-6>`), textual signal census (short /
ALL-CAPS / keyword lines), and a naive suggester's recall/precision against the founder's own
titles. Reproducible; the founder project is never modified.
