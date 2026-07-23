# FOUNDER_TRAVERSAL_3 — the founder's third traversal (measurement report)

**Date:** 2026-07-23 · **Status: MEASUREMENT REPORT — stops at the constats, awaits CTO verdicts. NO
production code, nothing corrected.** All measured **read-only** on the founder's projects (SELECT +
blob read + in-memory import/suggest/paginate/validate; never a write; his projects untouched, AS
FOUND). Repo state at measurement: `main @ c4102e3`, in sync.

**The manuscript:** book 3, project `1784812181217-cy7m12l0w`, **"Rachat et expiation bibliques 2"**
— his largest (stored aggregate ~1.1 MB, **v=22**, he has been actively structuring it). Measured
first, the decisive fact: **the source imports UNDER-structured — one top-level entry, 45,816 words,
no detected chapters.** So book 3 is the **assist's** regime (like book 1), not cleanup's. The
founder built its 23-chapter structure himself across 22 versions using the **STRUCTURE_ASSIST**
"Make chapter" panel — which is where the Lot-A findings live. Instrument:
`backend/spikes/founder3-measure.ts`.

## §0 The founder's constat (relayed by the CTO — provenance honest, no invented quotes)

The findings below are as the CTO relayed them; each sentence is treated as data. One is **verbatim**
(the CTO quoted it): on the sub-chapters — *« les sous-chapitres numérotés de 1 à 6 ne sont pas
supposés devenir des chapitres séparés ; ils doivent former une continuité »*. The others are the
CTO's description of what the founder saw:
- a click on `Collapse` / `Dismiss` / `Make chapter` seems to activate every button, several seconds
  before returning control;
- the panel proposed "Conclusion" eleven times in a row (≈46 suggestions);
- the Proof does not reflect edits while he works in the Structure station;
- the exported TOC carries "CHAPTER 8" twice and an "Untitled" entry;
- the numbered sub-chapters must form a continuity, not separate chapters (the verbatim above);
- the Lot-C experience items (§4).

## §1 The lot mapping

- **Lot A — the defects of the NEW code (priority: our own regressions):** `SUGGESTION_BUTTON_STATE`
  (A1), `SUGGESTION_PRECISION_ON_BOOK_3` (A2), `PROOF_NOT_LIVE_DURING_EDIT` (A3),
  `TOC_DUPLICATE_AND_UNTITLED` (A4).
- **Lot B — the third structural form (the most important finding):** `SUBCHAPTER_PROMOTION` (B5) —
  cadrage only, stopped at the constats.
- **Lot C — consigned for `AUTHOR_EXPERIENCE`, NOT measured now** (§4).

## §2 Lot A — measured findings

### A1 — `SUGGESTION_BUTTON_STATE` — the `EDITION_BUTTON_STATE` pattern reappeared, + real I/O latency
- **The pattern is the same, confirmed in code.** Both new panels (`StructureSuggestionsPanel`,
  `CleanupSuggestionsPanel`) drive EVERY control from **one shared `busy` flag** — `disabled={busy}`
  on "Make all"/"Collapse all", the per-item action, AND "Dismiss". A single ongoing operation
  disables (visually changes) every button at once — exactly the `EDITION_BUTTON_STATE` defect
  (Lot-1 defect 5) in a new place: one flag, all controls. (Dismiss is itself synchronous — it only
  reads disabled because it shares the flag.)
- **Why the latency (measured):** the compute is NOT the cost — `ValidationEngine.validate` on book 3
  runs in **1–7 ms**. The cost is **I/O × N**: each confirmation is a full HTTP round-trip that
  loads, snapshots, mutates, and **saves the whole ~1.1 MB aggregate**, then `GetProjectUseCase`
  re-serialises it AND the panel re-fetches its suggestions (the `refreshKey` effect). "Make all" /
  "Collapse all" runs these **sequentially, one per marker** — on book 3's 56 assist proposals that
  is **56 sequential ~1.1 MB-persist round-trips**, the "several seconds" (and the shared `busy`
  holds every button disabled for the whole run).

### A2 — `SUGGESTION_PRECISION_ON_BOOK_3` — the n=1 re-measurement the DR disclosure owed
Measured with the **assist** suggester on the fresh import (the "Make chapter" panel, book 3 being
under-structured):
- **56 proposals**, 30 distinct titles. **Repeated: "Conclusion" ×26**, "CHAPTER 8" ×2. Kind split:
  **27 editorial, 29 numbered-chapter.**
- **The precision failure, named:** a real book has **one** Conclusion. The 26 "Conclusion" proposals
  are the author's **per-chapter conclusion sub-heading** typed as plain text (26 in the body,
  measured); the assist's editorial taxonomy matches the NAME wherever it appears and proposes each
  as a book chapter → **~25 chapter-level FALSE POSITIVES from "Conclusion" alone**. Book-chapter
  precision here is ≈ 30/56, far below book 1's 100%.
- **This is exactly what the DR's n=1 disclosure required re-measuring** (`STRUCTURE_ASSIST_DR.md`
  §8): the taxonomy is safe on a book that names each editorial part once; it over-fires on a book
  that uses an editorial NAME as a recurring sub-heading. Measured, not assumed. **Not corrected —
  reported.**

### A3 — `PROOF_NOT_LIVE_DURING_EDIT` — the refresh key MOVES; the Proof is a separate station
- **The refresh key is fine (measured in code).** A confirmation flows `onEdited → setProject` on the
  project page; `replaceBook` bumps `project.updatedAt` (ProjectService.ts:103); `proofRefreshKey`
  includes `updatedAt` (bookFacts.ts) → the key changes on every confirmation. ADR-0052 holds.
- **The real cause is the station architecture.** The Proof (`PreviewPanel`) renders **only** under
  `view === 'proof'`; the Structure station is `view === 'structure'` — **mutually exclusive**
  (project page lines 266 / 284). While the author edits structure the Proof is **not mounted**, so
  there is nothing to update "live"; it re-inks with the fresh key when he navigates to it. So the
  finding is TRUE as stated but is **not a broken key** — it is the single-station layout. **This is
  `AUTHOR_EXPERIENCE` territory** (Lot 3 principle 3: the Proof as its own dedicated page,
  first-page-first), not a mechanical bug to patch here.

### A4 — `TOC_DUPLICATE_AND_UNTITLED` — two distinct origins, the TOC itself faithful
- **"CHAPTER 8" twice = SOURCE duplication (the TOC is faithful).** The current structure carries two
  top-level chapters both titled "CHAPTER 8" (entries 7 & 8, **identical 1,413 words**), and the
  author's own numbering is inconsistent (1, 3, 4…7, **8, 8**, 10, … — CHAPTER 2 and 9 absent). He
  typed "CHAPTER 8" twice in the body and promoted both; the auto-TOC reports exactly what is there.
  Origin: the manuscript/author, **not** a TOC or operation defect.
- **"Untitled" = an untitled chapter created by the promote OPERATION, surfaced by EPUB.** The first
  top-level entry has an **empty title** and 755 words. It is the **remainder of the assist's
  `promoteToChapter`**: the unstructured import was a single container with **no title**; promoting
  the first marker left the pre-marker preamble as an **untitled top-level chapter** (kept because it
  has content, CREATE_CHAPTER §9.3). The model auto-TOC **skips empty titles** (LayoutEngine.ts:437),
  so it is not in the auto-TOC — but **`EPUBRenderer.ts:234` labels it `content.title || 'Untitled'`**,
  which is the "Untitled" the founder saw in the EPUB navigation. Origin: an operation-created
  untitled chapter (the untitled import's promote remainder), not a duplicated source title.

## §3 Lot B — `SUBCHAPTER_PROMOTION` (cadrage, stopped at the constats)

**The third structural form, measured.** Book 3's sub-structure is typed as plain body text (the
manuscript carries no heading styles — `HEURISTIC_STRUCTURE_DETECTION` closure holds). Measured in
the body:
- **0 literal "1."/"1)"/bare-numbered sub-heading lines** — so the founder's "numbered 1 to 6" is
  **not present as literal numbering**; it is his description of the per-chapter sub-run.
- **26 "Conclusion" sub-heading lines** (the over-promoted editorial name) and **34 ALL-CAPS
  descriptive sub-headings** (e.g. "THE WORLD OF SPIRITUAL CLAIMS", "THE BLOOD ON THE DOORPOSTS"),
  plus a typed "PART I". These are the real sub-chapters he means — the ones that "must form a
  continuity", not separate chapters.
- **The distinguishing signals available (the cadrage's core question):**
  1. **Lexical form** — `CHAPTER n` (a chapter marker) vs an editorial NAME vs a descriptive
     ALL-CAPS sub-heading. `CHAPTER n` is a strong chapter signal; a lone descriptive heading is not.
  2. **Repetition** — an editorial name that recurs (26× "Conclusion") is **provably sub-structure**:
     a book has one Conclusion, so N>1 means per-chapter. This is the **strongest, most reliable
     signal**, and it is exactly what the assist currently ignores.
  3. **Position** — a heading sitting in a **run after a `CHAPTER n` marker** is a sub-item of that
     chapter (continuity), not a peer chapter. Needs the chapter context to read.
- **Feasibility (measured, not designed):** a "propose **make sub-section** rather than **make
  chapter**" path is **feasible at high precision on signal 2** (repeated editorial name → group as
  the chapter's sub-section) and plausibly on 1+3; the descriptive ALL-CAPS subs are currently
  **invisible** to the suggester (not in the taxonomy) — so today they are neither promoted (good)
  nor offered as sub-sections. **n=1 still: this is one manuscript; the achievable precision must be
  re-measured as more real books arrive** (the same discipline the assist DR fixed). **No design
  here — signals and feasibility only, as instructed.**

## §4 Lot C — consigned for `AUTHOR_EXPERIENCE`, NOT measured now

Recorded verbatim from the directive, untouched, for the Lot-3 DR: the `Collapse`/`Dismiss` semantics
to make obvious (two opposite-nature gestures at the same visual weight — one mutates the book, one
does not); **rejection persistence — the CTO REVISES D4: a dismissal must survive navigation (to be
handled in the DR)**; the old structure pushed to the bottom; `Ready for Print` being static when it
should carry author/ISBN/language input rather than duplicate it; Title & Copyright deserving its own
page; the `front`/`back`/`+ Part` roles never explained; the two-book limit on Home; button fluidity.

## §5 Verdicts owed (the report stops here)

| # | Item | Measured | Owed verdict |
|---|---|---|---|
| A1 | `SUGGESTION_BUTTON_STATE` | shared `busy` disables all buttons (EDITION_BUTTON_STATE pattern); latency = N sequential ~1.1 MB-persist round-trips, not compute | fix now (per-item disabled state + batch/optimistic apply)? or fold the batch-latency into a perf pass? |
| A2 | `SUGGESTION_PRECISION_ON_BOOK_3` | assist 56 proposals, "Conclusion" ×26 = ~25 chapter-level false positives; the n=1 re-measurement | how to curb repeated-editorial-name over-firing — the Lot-B sub-section path, or a repetition guard? |
| A3 | `PROOF_NOT_LIVE_DURING_EDIT` | refresh key moves; Proof is a separate station (not a bug) | confirm it is `AUTHOR_EXPERIENCE` (multi-page Proof), not a fix here |
| A4 | `TOC_DUPLICATE_AND_UNTITLED` | CHAPTER 8 ×2 = source duplication (TOC faithful); "Untitled" = promote-remainder untitled chapter, labelled by EPUBRenderer | any fix owed (e.g. name/flag an untitled promote-remainder), or author's content to fix? |
| B5 | `SUBCHAPTER_PROMOTION` | signals measured: repetition is the strongest; a "make sub-section" path is feasible on it; n=1 | open its own DR (the third form), on which signals, after the Lot-A verdicts? |

No production code written. On the CTO's verdicts, the Lot-A correctifs and the Lot-B design follow —
each measured-first, in its own atomic commit.
