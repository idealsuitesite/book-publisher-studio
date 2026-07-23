# STRUCTURE_CLEANUP — Design Review (full, Level 2)

**Date:** 2026-07-23 · **Status: PROPOSED — awaits CTO validation before construction.** The named
sibling of `STRUCTURE_ASSIST` (`STRUCTURE_ASSIST_DR.md` §9): the OVER-structured pole. Built on the
same foundation, the same doctrinal invariant, and the two founder books as the two poles.

This DR is written on the CTO's verdicts over the cadrage (`STRUCTURE_CLEANUP_SCOPE.md`), which
measured the founder's book 2 read-only and found that the sibling DR's one-line §9 assumption —
"reuses the existing merge op `mergeChapterIntoPrevious`" — is **measured false and destructive**.
The cadrage precedes the DR for exactly this reason.

---

## §1 The law it serves, and the bidirectional truth (the inverse of the assist)

**The author spends neither time nor energy to obtain a professional document** — Author B
(`VISION.md`), success judged on the real exported file. STRUCTURE_ASSIST gave the UNDER-structured
author his chapters from the markers he typed as body text; STRUCTURE_CLEANUP gives the
OVER-structured author a clean book from the redundant empty headings he styled by hand.

**The bidirectional problem, now both halves designed:**
- **Traversal 1 — UNDER-structured** → STRUCTURE_ASSIST: propose chapters from typed markers (built,
  merged `2c40d71`).
- **Traversal 2 — OVER-structured** → STRUCTURE_CLEANUP (this DR): the author styled `CHAPTER n` as
  its OWN empty `Heading 1`, separate from the real chapter title. The book imports faithfully as
  127 top-level entries, **29 of them empty markers**. Suggestion cannot help; the inverse operation
  — collapse the redundant empty markers — is needed.

The two are inverses and do not share a chantier ("one commit, one intent" at the chantier scale).
They **share the invariant, the author-as-gate doctrine, the test harness, and the `PRIVATE_MANUSCRIPT_
FIXTURES` policy** — they differ in the operation.

## §2 The problem, measured (the cadrage's constats, re-stated as the DR's premise)

Instrument: `backend/spikes/structure-cleanup-cadrage.ts` (read-only, fresh re-import through today's
pipeline = the stored aggregate; the founder's project untouched). All numbers reproduce in one
command.

- **The book:** "The Secret Of Spiritual Protection" — **127 top-level entries.**
- **Two disjoint forms, quantified (the CTO's "two forms, two treatments" confirmed):**
  - **Pattern A — 29 empty MARKER headings** (0 own words AND 0 sections; the title is a marker).
    **Cleanup targets.** Zero "other empty" residue.
  - **Pattern B — 61 real titles whose prose lives one level down under `Heading 2`** (0 *own*
    words but section-bearing). **NOT cleanup targets — legitimate structure.** A chapter whose
    words are attributed to its child sections is not empty; it is correctly structured.
- **Pattern A splits again (the discipline compounds):**
  - **A1 — 27 numbered-chapter markers** (`CHAPTER 1`…`CHAPTER 26`, with `CHAPTER 3` duplicated).
  - **A2 — 2 editorial markers** (`INTRODUCTION`, `CONCLUSION`).
- **Every marker's collapse target is a prose-bearing chapter** (Constat 2): 28/29 followed by a
  pattern-B real title with `Heading 2` prose, 1 (`CONCLUSION`) by a real title with body prose. So
  the operation's title-and-section handling is load-bearing.
- **The silence pole holds** (Constat 6): book 1 (under-structured) has **0 empty markers** → cleanup
  proposes nothing. Its markers are BODY TEXT (assist's job), never empty headings.

## §3 The doctrinal invariant — TESTED, not asserted (unchanged from the sibling, both poles)

**Proposal-confirmed, never silent mutation.** Identical to STRUCTURE_ASSIST §3, mirrored to the
removal direction:

- The cleanup pass produces a **read-only proposal** — a list of collapse candidates, each with the
  evidence (the marker text and the real title it would fold into), the ADR-0049 honest-finding
  shape. It **never** calls a mutation.
- Only an author action (confirm one, confirm all, dismiss) invokes the mutation(s). The detector
  and the mutator are separate; the test proves the detector touches no `Book`.
- **A test pins that running the detector over a manuscript and discarding the proposal leaves the
  Book byte-identical** — the "no silent mutation" invariant made mechanical.

**The BIDIRECTIONAL clause — tested on synthetic poles (committed), real in the probe:**
- **On the OVER-structured pole:** the detector PROPOSES the empty-marker collapses; the author
  CONFIRMS; discarding the proposal leaves the Book byte-identical.
- **On the UNDER-structured pole (book 1, now assisted):** the detector finds **~nothing** — its
  markers are body text, not empty headings — and discarding its (empty) proposal leaves the Book
  byte-identical. Cleanup never *adds* structure and never touches a legitimately-structured book.
- So byte-identical-after-discard holds in **both regimes**. This is the mirror of the assist's
  bidirectional clause; together the two chantiers prove neither helps one author by harming another.

**`PRIVATE_MANUSCRIPT_FIXTURES` holds (SETTLED, CTO 2026-07-23).** The invariant is tested
MECHANICALLY on **synthetic** poles (committed, CI-repeatable, depending on no private file) AND
behaviourally on the real founder books in the probe (never committed). The founder's manuscripts are
NOT versed to `backend/verification/corpus/`; a versement would be his explicit decision, never a
chantier side effect.

## §4 The correction of the sibling DR's §9 — `mergeChapterIntoPrevious` is MEASURED FALSE (the record)

**So that no future session ever rereads "reuses `mergeChapterIntoPrevious`" without immediately
seeing it is wrong and why.** `STRUCTURE_ASSIST_DR.md` §9 said, in one line the CTO had validated,
that cleanup "reuses the existing merge op (`mergeChapterIntoPrevious`)". Simulated in memory on the
first real pair (`INTRODUCTION` [empty] + `JESUS CHRIST, OUR PASSOVER` [0 own words, 1 section /
458 words]), that op produces **two defects**:

1. **WRONG SURVIVOR.** It merges the real title INTO the marker, so the surviving chapter keeps the
   title **`INTRODUCTION`** (the marker) and demotes the real title to a body paragraph. Across the
   29 markers this keeps the wrong title on every one.
2. **DATA LOSS — an ADR-0050 violation.** It builds `content = [...prev.content, titleBlock,
   ...chapter.content]`: it concatenates only `.content` and **never `.sections`** (`BookEditingService.ts:294`).
   The following chapter's `Heading 2` sections are **silently dropped** — on the 28 section-bearing
   pairs, the book's prose. A mass content destruction, exactly what ADR-0050 (Fidelity Is the
   Product) forbids, introduced by a design sentence nobody had measured.

**This is non-negotiable #7 paying off on a line the CTO himself had approved** — an ADR/decision
records what was true when written, not a standing guarantee; the cited op was re-measured against the
actual code, and it failed.

**The correct operation is not a merge — it is REMOVE the empty marker** (§6). The marker is fully
empty (0 words, 0 sections), so nothing needs merging *into* anything; removing it and letting the
following real chapter flow up and auto-number is faithful and lossless. `STRUCTURE_ASSIST_DR.md` §9
is annotated with a pointer to this section.

## §5 Success is a NUMBER — the gesture counter (the 29→1 of this chantier), and it is stronger than the assist's

`backend/spikes/structure-cleanup-cadrage.ts` §Q4:

- **Cleanup targets: 29 empty markers.**
- **By hand today: there is NO clean manual gesture at all.** The exposed mutations
  (`StructureMutation.ts`) offer no chapter-removal — the only candidates are
  `mergeChapterIntoPrevious` (lossy + wrong survivor, §4) and `removePartOpener` (rejects a
  non-divider). So an author facing these 29 markers **cannot repair his book today** through any
  correct gesture.
- **With cleanup: 1 gesture** ("Collapse all markers"), plus a per-exception dismiss — the **29→1**
  of this chantier (the RENDER_DRIFT 284→246 / assist 14→1 analogue).
- **The point, stated plainly (CTO): this is STRONGER than the assist's 14→1.** The assist reduced a
  painful-but-possible labour; cleanup makes possible a repair that is **impossible today**. Say it
  as such — not "fewer clicks" but "a book the author currently cannot fix, fixed in one gesture."

**The locked rule:** the chantier ships WITH the freshly-measured gesture-counter probe (the
RENDER_DRIFT 284→246 analogue) or it is not done.

## §6 Mechanism

### §6.1 The read-only detector — a `CleanupSuggester` (mirror of `StructureSuggester`)

A pure Domain service, no infrastructure: input a `Book`, output `CleanupSuggestion[]`. It walks
**top-level entries** and flags an entry that is:
- an **empty marker** — `classifyMarker(title)` matches (reusing the shared `structureTaxonomy` from
  the assist — one taxonomy, CTO-owned) AND the entry has **0 content blocks AND 0 sections**;
- **immediately followed by a real title** (the collapse target).

Each suggestion carries `{ markerId, markerText, kind: 'numbered' | 'editorial', targetChapterId,
targetTitle, evidence }`. The detector NEVER mutates the Book (§3). It stays SILENT on a
legitimately-structured book (book 1: 0 empty markers).

### §6.2 The operation — REMOVE the empty marker (option (a): generalize `removePartOpener`'s mechanism)

Per the CTO's verdict on Constat 3, option **(a)**: generalize the proven removal *mechanism* of
`removePartOpener` — "remove a blockless top-level entry, let followers flow up, renumber" — whose
only fault is a too-narrow guard. Concretely:
- Extract the shared splice+`renumberChapters` tail into a private helper `removeTopLevelAt(book,
  index, now)`; `removePartOpener` and the new op both call it (the mechanism generalized, not
  duplicated).
- A new mutation **`collapseMarker(book, chapterId, now)`** with a **STRICT guard** (CTO condition 1):
  it refuses anything that is **not 0 words AND 0 sections**, with a **typed named refusal** (the
  `ContentNotFoundError` / `CONTENT_NOT_FOUND` pattern the subtitle op uses), surfaced at the route
  as a named code, never a 500. It also refuses a `partOpener` (a divider is removed by its own op)
  and refuses the first entry (no forward flow needed, but the guard keeps intent clean).
- **The op removes the marker only — it never touches the following chapter**, so the following
  chapter's title AND its `.sections` survive by construction. This is the anti-defect of §4:
  removal cannot drop sections because it does not read them.

### §6.3 A1 vs A2 — two markers, two confirmations (the CTO's verdict on Constat 3 second point)

- **A1 (numbered markers, 27):** confirm = `collapseMarker(markerId)`. The following chapter flows
  up and `renumberChapters` gives it the correct number. `CHAPTER 1`'s redundant text vanishes; the
  chapter becomes number 1 by position. **One mutation.**
- **A2 (editorial markers, 2 — `INTRODUCTION`, `CONCLUSION`):** removal alone would let the following
  chapter become "Chapter 1", losing the author's editorial intent (CTO). Confirm = **`collapseMarker(markerId)`
  + `rename(targetChapterId, canonicalLabel)`** — the following chapter is renamed to the marker's
  canonical editorial label (`Introduction`/`Conclusion`, looked up from the marker text via the
  shared taxonomy). **Two mutations, both existing/generalized — no third mutation surface.**

**Why Form 1 (rename to the editorial name), measured (`structure-cleanup-a2-form-probe.ts`), the
proposal the CTO rules on:**

| Form | count exclusion | Proof editorial panel row | placement | new infrastructure |
|---|---|---|---|---|
| **Form 1** — rename following chapter to `Introduction`/`Conclusion` | ✅ (title canonical) | ✅ `Introduction/front` | ✅ | **none** |
| Form 2 — keep the real title + `setPartRole(front/back)` | ✅ (role-tagged) | ❌ `(none)` — panel is title-based | ✅ | a new editorial-category tag on the model |

`computeBookFacts` (`bookFacts.ts:106-119`) excludes a part from the chapter count if it is
role-tagged OR title-canonical, but it emits a Proof editorial **panel row** only `if (category)` —
i.e. only when the **title** is canonical. So Form 2 (keeping a non-canonical real title) is
excluded-but-**UNLABELED**: the editorial part never shows as present, the exact class of reporting
defect `MINI_DR_EDITORIAL_PARTS` fixed. Closing that gap needs a NEW editorial-category tag on the
model — new infrastructure, out of a marker-collapse chantier. **Form 1 reuses the title-based
machinery end to end with zero new infrastructure — proposed.**

- **Disclosed cost of Form 1:** it replaces the following chapter's descriptive title (`JESUS CHRIST,
  OUR PASSOVER`) with `Introduction`. **Optional taste enhancement (a CTO stop, not decided here):**
  preserve the descriptive title as the chapter's `subtitle` (the `Chapter.subtitle` field exists,
  `MINI_DR_SUBTITLE_FIELD`) so both survive — title `Introduction`, subtitle `JESUS CHRIST, OUR
  PASSOVER`. Small, in-scope, but a taste call; I propose Form 1 plain and defer the subtitle variant
  to the CTO's ruling.

### §6.4 The studio (Structure station)

The proposal as a checklist, mirroring the assist's panel: **confirm-all AND per-item** (the ≈1
gesture target + per-exception dismiss). A dismissed candidate is remembered in the editing session
(undo-able), not beyond it. Silent when there is nothing to collapse (the under-structured pole).

### §6.5 Where it runs

On demand in the Structure station (an already-imported over-structured book — where the founder
is). Not offered at the `UNSTRUCTURED_MANUSCRIPT` import moment: that moment is the assist's (a
0-chapter book); an over-structured book is not 0-chapter, so cleanup is a Structure-station action.

## §7 Decisions (folding the CTO's verdicts; the A2 form the one stop owed on a measured proposal)

- **D1 — scope: pattern-A only.** ✅ Cleanup collapses the 29 empty markers, full stop. Pattern B
  (61 legitimately-structured titles) is left alone. The deeper 3-tier re-nesting is a **named
  observation, NOT a consigned chantier** (§8) — murky, uncertain gain, no proof the author wants it
  undone; not opened.
- **D2 — the operation: option (a).** ✅ Generalize `removePartOpener`'s removal mechanism into a
  shared helper; a new `collapseMarker` op with a strict typed guard (0 words AND 0 sections, refused
  both ways), removing the marker only so the following chapter's `.sections` survive by construction.
  **Not** `mergeChapterIntoPrevious` (§4).
- **D3 — A2 keeps its editorial identity: Form 1 (rename to the canonical name), measured, proposed.**
  Reuses the title-based machinery end to end; Form 2 needs new infrastructure (§6.3). **This is the
  stop the CTO renders on the measured proposal.** The subtitle-preservation variant is offered as a
  taste sub-decision.
- **D4 — duplicate title out of scope, robustness required.** ✅ Two distinct chapters sharing a
  title (`CHAPTER 3` ×2 → two `THE PASSOVER IN EGYPT`) is a content decision for the author;
  renumber resolves the number collision (they become 3 and 4), the title duplication remains and is
  not the collapse's job. The detector must be **robust to repeats** — a repeated marker and a
  repeated title never crash and never mis-pair a marker with the wrong title (pinned by test on the
  real indices 40 and 58, §9).
- **D5 — confirmation granularity:** ✅ confirm-all AND per-item; dismissed candidate remembered in
  the session, not beyond (the assist's D4, mirrored).

## §8 Disclosures

- **n=1 for the over-structured signal.** The founder's book 2 is a strong existence proof; it is not
  a calibrated rule. The detector's precision is re-measured as more real over-structured manuscripts
  enter the probe. The strict empty-marker guard (0 words AND 0 sections + a taxonomy match) is
  conservative by design: it proposes only what is provably a redundant empty heading.
- **The deeper re-nesting is a NAMED OBSERVATION, not a chantier (CTO).** Several pattern-B entries
  are numbered sub-topics the author promoted to the top level (a 3-tier hierarchy flattened). Undoing
  that is a much larger, murkier problem with uncertain gain and no proof the author wants it undone.
  **It is not opened, not consigned as a chantier — recorded here only so a future session does not
  rediscover it as new.** Cleanup is marker-collapse, nothing more.
- **A2 Form 1 replaces a descriptive title with the editorial name** (§6.3) — disclosed, with the
  subtitle-preservation option offered to the CTO.
- **Editorial-titled entries recur at top level in this book** (many `INTRODUCTION`/`CONCLUSION`
  headings inside the flattened hierarchy, most with content). The A2 treatment targets **only the 2
  empty editorial markers** (the strict pattern-A guard) — never every editorial-titled entry. The
  strict guard (0 words AND 0 sections) is exactly what keeps the content-bearing ones untouched.
- **Both founder books remain the probe fixtures of the bidirectional invariant** (behavioural);
  the committed invariant test uses **synthetic** poles (`PRIVATE_MANUSCRIPT_FIXTURES`).

## §9 The tests that ship with it (or the chantier is not done)

1. **The bidirectional invariant test — synthetic poles, committed.** An over-structured synthetic
   book (empty `CHAPTER n` markers + real titles with sections) and an under-structured one; the
   detector proposes on the first, is silent on the second, and **discarding the proposal leaves the
   Book byte-identical in both** (§3).
2. **The section-survival test — the regression guard that would have caught the cousin (CTO
   condition 2).** After `collapseMarker` on an empty marker whose following chapter carries `Heading
   2` sections, a test pins that the following chapter's `.sections` and their words are **byte-identical**
   to before the collapse. This is the explicit guard against §4's defect reappearing — it must exist
   in the new op even though removal is section-safe by construction.
3. **The strict-guard test, both directions (the subtitle `CONTENT_NOT_FOUND` pattern):**
   `collapseMarker` accepts an empty marker and **refuses** — with the typed named error — a
   non-empty entry (has content) and a section-bearing entry (has sections), each asserted.
4. **The robustness test on repeats (D4), on the real shape:** a fixture reproducing the duplicate
   `CHAPTER 3` at two positions with the same following title; the detector pairs each marker with its
   OWN following title, never crashes, and renumber yields consecutive numbers.
5. **The freshly-measured 29→1 gesture-counter probe** (`structure-cleanup-cadrage.ts`) ships as the
   committed instrument (the RENDER_DRIFT 284→246 analogue).

No production code is written until the CTO validates this DR — the operation (D2), the A2 Form-1
proposal (D3, the one measured stop owed), the scope boundary (D1), robustness (D4), and the tests
(§9). On validation, the build is atomic gated commits on the same foundation as STRUCTURE_ASSIST.
