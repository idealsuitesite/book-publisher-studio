# FOUNDER_TRAVERSAL_3 — the founder's third traversal (measurement report + CTO verdicts)

**Date:** 2026-07-23 · **Status: MEASURED + CTO VERDICTS RENDERED. NO production code yet — this
document plus the joint probe is the groundwork; the correctifs follow in the engraved sequence.**
All measured **read-only** on the founder's projects (SELECT + blob read + in-memory
import/suggest/paginate/validate; never a write; his projects untouched, AS FOUND). Repo state:
`main @ 74706af`, in sync bar this consignation.

**The manuscript:** book 3, project `1784812181217-cy7m12l0w`, **"Rachat et expiation bibliques 2"**
(~1.1 MB aggregate, v=22). Decisive fact measured first: **it imports UNDER-structured — one entry,
45,816 words, no detected chapters.** So the findings are about the **STRUCTURE_ASSIST** "Make
chapter" panel (he built its 23 chapters himself over 22 versions), not cleanup.
Instruments: `backend/spikes/founder3-measure.ts`, `backend/spikes/founder-hierarchy-signals.ts`.

**n=1 → n=3.** With books 1, 2 and 3 the founder now gives us **three real manuscripts in three
regimes** (under-structured / over-structured / under-with-recurring-subheadings) — the most honest
structure corpus the project has had. Every signal below is measured across all three.

## §0 The founder's constat (relayed by the CTO — honest provenance, no invented quotes)

Each sentence treated as data. Verbatim (CTO-quoted): on the sub-chapters — *« les sous-chapitres
numérotés de 1 à 6 ne sont pas supposés devenir des chapitres séparés ; ils doivent former une
continuité »*; and the design decision — *le logiciel ne doit jamais faire retaper à l'auteur ce
qu'il a déjà écrit*. Relayed findings: the button state (a click seems to activate every button,
several seconds before returning control); the Proof not following edits in the Structure station;
the exported TOC carrying "CHAPTER 8" twice and an "Untitled" entry; and the Lot-C experience items.

**The CTO's own correction to a measurement he had ordered:** the panel does **not** invent "Conclusion"
eleven times. Those occurrences are **in the founder's document, one per chapter ending, and remain
proposed because he has not confirmed them. The suggester is FAITHFUL.** So the measurement is not
"failing precision" but `REPEATED_EDITORIAL_MARKERS` — repetition as an unexploited signal (§2 A2).

## §1 The lot mapping (the CTO's numbering)

- **Lot A — defects of the NEW code (our regressions, priority):** A1 `SUGGESTION_BUTTON_STATE`,
  A2 `PROOF_NOT_LIVE_DURING_EDIT`, A3 `TOC_DUPLICATE_AND_UNTITLED`.
- **Lot B — the hierarchy, cadrages stopped at the constats:** B4 `TITLE_FROM_FOLLOWING_LINE`,
  B5 `SUBCHAPTER_PROMOTION`.
- **The reframed measurement `REPEATED_EDITORIAL_MARKERS`** — the "correction préalable": faithful
  suggester, repetition the signal. It yields the immediate A2-repetition-guard verdict (below) and
  feeds B5.
- **Lot C — consigned for `AUTHOR_EXPERIENCE`, not measured now** (§4).

## §2 Lot A — measured findings + verdicts

### A1 — `SUGGESTION_BUTTON_STATE` — TWO distinct defects under one name (CTO: do not confuse them)
- **The button-state defect (fix now).** Both new panels (`StructureSuggestionsPanel`,
  `CleanupSuggestionsPanel`) drive EVERY control from **one shared `busy` flag** (`disabled={busy}`
  on Make/Collapse-all, the per-item action, AND Dismiss). One operation disables every button — the
  **`EDITION_BUTTON_STATE` regression** (Lot-1 defect 5) in a new place. **VERDICT: fix now — only
  the in-flight button changes state.** Narrow, our own regression.
- **The latency (a separate chantier).** The compute is NOT the cost — `ValidationEngine.validate`
  runs **1–7 ms**. The cost is **I/O × N**: each confirmation is a full round-trip that saves the
  whole **~1.1 MB aggregate** + re-fetches; "Make/Collapse all" runs these **sequentially, one per
  marker** (56 on book 3). **VERDICT: this is architectural — consigned `BATCH_CONFIRM_LATENCY`
  (batch apply / optimistic update), its own DR, never improvised inside a button-state fix. One
  commit, one intention.**

### A2 — `REPEATED_EDITORIAL_MARKERS` — the repetition guard now, the sub-section path in B5
**Corrected framing (CTO): the suggester is FAITHFUL — the 56 proposals and the 26 "Conclusion" are
real, exactly what the document contains.** The earlier "≈25 false positives / 54% precision" was a
mis-interpretation (it assumed the suggester erred) and is withdrawn; a precision percentage here is
a misleading metric. What the measurement reveals is an **unexploited signal — repetition.**

**Measured across the three books (`founder-hierarchy-signals.ts`, R1):**
| Book | Canonical name | Count | Positions (0=start … 1=end) | Reading |
|---|---|---:|---|---|
| 1 | Foreword / Introduction / Conclusion | 1 each | 0.01 / 0.03 / 0.88 | UNIQUE, at front/back → **true editorial parts** |
| 3 | Introduction | 1 | 0.00 | UNIQUE, front → **true editorial part** |
| 3 | Conclusion | **26** | 0.06, 0.09, 0.13 … 0.40+ | **DISTRIBUTED → a recurring section title (sub-structure)** |

- **The signal is DEDUCTIVE, not heuristic:** a book has **one** Conclusion; twenty-six occurrences
  *prove* a sub-structure. Frequency AND position agree — unique names sit at the extremes (front/back
  matter), the 26 are spread through the body. Conforms to the positional/never-inferential doctrine.
- **VERDICT (immediate, narrow):** a canonical editorial name that appears **N>1** times ceases to be
  proposed as a chapter. **Two conditions:** the threshold is **N>1** (a thing there can be only one
  of — not an arbitrary tuned cutoff), and the guard is **tested both ways** (a unique occurrence
  stays proposed; multiple occurrences do not). **What the guard then does with those 26 lines
  (nothing, or propose them as sub-sections) is B5, not this correctif.**
- Guard validated on the corpus: it keeps all **4 unique** parts (book 1 ×3, book 3 ×1) and drops
  exactly the **26** — zero true parts lost.

### A3 — `PROOF_NOT_LIVE_DURING_EDIT` — mechanism exonerated, it is AUTHOR_EXPERIENCE (no fix here)
- The refresh key IS fine: a confirmation flows `onEdited → setProject`; `replaceBook` bumps
  `project.updatedAt` (ProjectService.ts:103); `proofRefreshKey` includes it → the key changes on
  every confirmation. ADR-0052 holds.
- The real cause is the **single-station architecture**: the Proof (`PreviewPanel`) renders **only**
  under `view === 'proof'`; Structure is `view === 'structure'` — mutually exclusive (project page
  266 / 284). The Proof is not mounted during editing, so there is nothing to update "live"; it
  re-inks on navigation. **VERDICT: confirmed AUTHOR_EXPERIENCE (the founder's principle 3 — the
  Proof as its own dedicated page). Resolved by the redesign, never a rustine here.**

### A4 — `TOC_DUPLICATE_AND_UNTITLED` — two origins, two treatments
- **"CHAPTER 8" twice = the author's content, faithfully reported.** Two top-level chapters both
  titled "CHAPTER 8" (identical 1,413 words); his own numbering skips 2 and 9 and doubles 8. The
  auto-TOC reports exactly what is there. **VERDICT: out of scope — we do not correct what he wrote.**
- **"Untitled" = OUR defect.** The first entry has an empty title / 755 words — the **preamble the
  first `promoteToChapter` left behind** (the unstructured import was one untitled container; promoting
  the first marker kept the pre-marker text as an untitled chapter). The model auto-TOC skips empty
  titles (LayoutEngine.ts:437), but **`EPUBRenderer.ts:234` prints `content.title || 'Untitled'`** —
  a placeholder that reaches the author, **the same class as the "Unknown" we chased out** (Lot-1
  defect 2). **VERDICT: measure FIRST what this remainder should be — a legitimate untitled chapter
  the author should be able to name, front matter, or nothing at all — and report before coding.**

## §3 Lot B — the hierarchy (cadrages, stopped at the constats)

### B4 — `TITLE_FROM_FOLLOWING_LINE` — and the number-in-title defect it corrects
**The founder's law:** the software must never make the author retype what he already wrote — when the
document carries "CHAPTER 1" followed by the real title, propose the **descriptive title**, not the
marker.

- **The pairing is highly reliable (`founder-hierarchy-signals.ts`, R2):** book 1 **11/11 = 100%**,
  book 3 **28/29 = 97%** of `CHAPTER n` markers are immediately followed by a title-shaped line
  ("CHAPTER 1" → "The Illusion of Spiritual Progress"; "CHAPTER 1" → "THE BLOOD THAT CRIES FOR
  JUSTICE"). Over-structured book 2 has 0 (its markers are headings, not body).
- **A live contradiction this promotes to a DEFECT (CTO):** STRUCTURE_ASSIST proposes the **marker
  text as the title** (`StructureSuggester` → `classifyMarker`'s `label`, which for a numbered marker
  is "CHAPTER 1") — **the number inside the title text.** STRUCTURE_CLEANUP already does the opposite
  (keeps the descriptive title, number auto-computed). Two sibling chantiers **contradict on the same
  book**, and the newly-engraved `CHAPTER_TITLE_PRESENTATION` law (the number is a chapter datum,
  never text in the title) makes the assist's behaviour **faulty, not merely perfectible**: an author
  who picks "title only, no number" would still see "CHAPTER 1" printed, because the number is stuck
  in the text. **The model is already correct** (`Chapter.number` is a datum, `renumberChapters`
  computes it by position); the fault is one line — the suggester's `proposedTitle`.
- **VERDICT: this chantier corrects the number-in-title.** If the following line is a real title, it
  is proposed; if not, the marker is NOT proposed as a title (what to propose then is a verdict on
  the measurement). Cadrage only for now.

### B5 — `SUBCHAPTER_PROMOTION` — the third structural form, its DR to open after A1+A2
- **Measured (R1/R3):** the sub-structure the founder means is the **repeated editorial names** (26
  "Conclusion", the repetition signal above) **plus 33 ALL-CAPS descriptive sub-headings** ("THE
  BLOOD ON THE DOORPOSTS", …) currently invisible to the taxonomy. There are **no literal "1."/"A."
  numbered lines** — the founder's "numbered 1 to 6" describes the per-chapter sub-run, not literal
  numbering.
- **Signals, ranked:** (1) **repetition** — the strongest, deductive, already proven (a recurring
  canonical name is sub-structure); (2) **position** — a heading in a run after a `CHAPTER n` marker
  is that chapter's sub-item; (3) lexical form. Feasibility of a "make **sub-section** rather than
  chapter" proposal is **high on signal 1**; the descriptive subs need more than lexical signal.
- **VERDICT: open the B5 Design Review AFTER the A1 and A2 correctifs.** Three lines engraved in
  advance: **same invariant** (propose, never impose; byte-identical after a discarded proposal);
  **repetition as the principal signal, measured, never guessed**; **the gesture counter as the
  judge.** The DR states n=3 (the three real regimes) as the corpus, and n=3 is still small — precision
  re-measured as more real books arrive.

## §4 The design laws engraved with these verdicts (consigned in their homes)

Transmitted by the CTO from his exchanges with the founder; each filed where it governs:
- **"Une ligne, une décision"** (`AUTHOR_EXPERIENCE.md`, the governing law for B5): the author
  understands in one second what is proposed and what to answer; the software brings the title, the
  author never retypes what he already wrote; rare cases live behind a **discreet secondary gesture,
  never on the row.** (This situates D4 — edit-title is the rare case → the secondary gesture, not a
  field on every row. D4 is not cancelled, it is located.)
- **Non-encombrement, the founder's formulation** (`AUTHOR_EXPERIENCE.md`, **correcting the hardened
  principle 1** I had written): keep what serves a comprehensible purpose; remove what clutters or
  confuses; **the burden of proof is on KEEPING, not on removal.** A button whose consequence the
  author cannot guess (`Dismiss`) becomes obvious or disappears. **Founder validation required on
  removals.**
- **`CHAPTER_TITLE_PRESENTATION`** (`AUTHOR_EXPERIENCE.md` + `DECISIONS.md` pointer): three
  author-chosen treatments ("Chapter 1" then the title below; title alone, large; the name at the
  head at a size clearly above subtitles). Technical invariant: **the number is a chapter datum,
  never text in the title** — computed by position, auto-renumbered, shown or not by the theme.
  **Nothing in a current chantier may close this door** (it is the lens for B4).
- **`CONTENT_DELETION_BY_AUTHOR`** (`DECISIONS.md`, **an amendment to ADR-0044**): the author must be
  able to delete — no content should become oppressive over time. Double-confirm for an edited work →
  trash 7 days → permanent deletion; the trash holds whole books only; within a book, restoration is
  undo/versions with re-import as last resort. **Distinct from ADR-0050** (which forbids the software
  deleting content on its own initiative). Resolves `HARNESS_CLEANUP_PATH` (the missing DELETE route
  the harness cleanup worked around with raw SQL).

**D4 exposure verified (item 4 sub-question):** the suggestion panels expose **only** Make/Collapse +
Dismiss — **no title-edit affordance exists** (no input/onChange/contentEditable). "Edit the title"
is DR-planned only, and per "une ligne, une décision" belongs behind the secondary gesture.

## §5 Lot C — consigned for `AUTHOR_EXPERIENCE`, not measured now

The `Collapse`/`Dismiss` semantics (two opposite-nature gestures at the same visual weight); **the
D4 revision — a dismissal must survive navigation**; the old structure pushed to the bottom;
`Ready for Print` static when it should carry author/ISBN/language input rather than duplicate it;
Title & Copyright deserving its own page; the `front`/`back`/`+ Part` roles never explained; the
two-book limit on Home; button fluidity.

## §6 The engraved sequence (CTO)

**A1 button-state fix ✅ → A2 repetition-guard fix ✅ → A4 measure (what the remainder should be) →
B5 Design Review.** `BATCH_CONFIRM_LATENCY` and Lot C consigned. Each correctif measured-first, its
own atomic commit, his projects strictly read-only, no fabricated fixtures.

**✅ A1 + A2 MERGED to `main` (`--no-ff` `d0c78b0`, 2026-07-23).** A1 (`f00fc6e`) — the shared-`busy`
flag became a Set of in-flight keys; only the in-flight button changes state, pinned by test in both
panels (Dismiss stays live, synchronous); latency deferred to `BATCH_CONFIRM_LATENCY`. A2 (`7a3ecbf`)
— the `N>1` repetition guard, bilateral test + synthetic CI lock (real-book proof in the probe,
`PRIVATE_MANUSCRIPT_FIXTURES`); book 3 56→30 (26 "Conclusion" dropped, unique "Introduction" kept,
`CHAPTER n` incl. the author's dup 8 untouched). **Post-merge gate: backend 868/868, frontend
225/225, tsc + eslint(src) + builds clean; live harnesses 4/4 · 16/16 · 4/4** (store restored to its
7 real projects, no trace; founder idle 125 min). **NEXT: A4 measure, then the B5 DR.**
