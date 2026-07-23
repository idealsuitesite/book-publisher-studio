# STRUCTURE_CLEANUP — cadrage (measurement report, stops at the constats)

**Date:** 2026-07-23 · **Status: CADRAGE — stops at the constats, awaits the CTO's verdicts. NO
production code. No definitive chantier shape or name locked before the CTO reads.**

The named sibling of `STRUCTURE_ASSIST` (`STRUCTURE_ASSIST_DR.md` §9): the OVER-structured pole. The
CTO ordered the cadrage first — measure the founder's book 2 (read-only), stop at findings, do not
assume a shared cause (the TABLE_DUPLICATION discipline), and let the §5 gesture counter judge here
too. This report answers the four measured questions and flags where §9's provisional framing is
**measured false** — precisely the reason a cadrage precedes the DR.

**Instrument:** `backend/spikes/structure-cleanup-cadrage.ts` — read-only. Fresh re-import of the
stored blob bytes through **today's** pipeline (non-negotiable #7, the §5 discipline — never a stale
figure), cross-checked against the stored aggregate. The founder's project
(`1784760982271-w4n3yjxxw`, "The Secret Of Spiritual Protection") is untouched, AS FOUND. Book 1
(`1784744671298-h9o6o9tn2`) measured for the silence pole. Every number below reproduces in one
command.

Cross-check: fresh re-import and stored aggregate BOTH report **127 top-level entries** — the founder
has not edited book 2 since import; the measurements describe the real object.

---

## Constat 1 — the pattern split is REAL and QUANTIFIED, and it is not the split §9 assumed

The CTO's hypothesis was that the 0-word chapters are two distinct forms. **Confirmed, and measured
exactly** — but the boundary falls in a different place than the traversal-2 prose implied:

| Form | Count | What it is | Cleanup target? |
|---|---:|---|---|
| **Pattern A** — empty MARKER heading | **29** | 0 own words AND 0 sections; the title is a marker (`CHAPTER n` or a bare editorial name) the author styled as its own empty `Heading 1` | **yes** |
| **Pattern B** — real title, prose one level down | **61** | 0 *own* words but carries `Heading 2` sections that hold the prose | **NO** — legitimate structure |
| Other empty (0-word non-marker title) | **0** | — | — |

- **The 29 "0-word chapters" from traversal 2 are ALL pattern A** (markers) — there is **zero**
  "other empty" residue. Traversal 2's rough "27 CHAPTER n + a couple bare + the rest are real
  titles" conflated two disjoint sets; measured precisely, the 29 are markers **only**, and the
  "real titles whose prose lives under Heading 2" are a **separate, larger** population of **61**
  that were never in the 29 (they have sections, so they were never 0-word-0-section).
- **The two forms demand two treatments, and pattern B must be LEFT ALONE.** A pattern-B entry
  (`THE HOLINESS OF GOD…` with its `Heading 2` prose) is a correctly-structured chapter whose word
  count is 0 only because the words are attributed to its child sections. Collapsing it would be the
  TABLE_DUPLICATION error — treating two causes as one. **Cleanup touches pattern A only.**

**A second split INSIDE pattern A (two forms again — the discipline compounds):** the 29 markers are
not homogeneous:
- **A1 — numbered-chapter markers: 27** (`CHAPTER 1` … `CHAPTER 26`, with `CHAPTER 3` duplicated).
- **A2 — editorial markers: 2** (`INTRODUCTION`, `CONCLUSION`).

These likely need **different** collapse outcomes (Constat 3): removing a `CHAPTER n` marker lets the
following chapter auto-number correctly, but removing the `INTRODUCTION` marker and letting its
following chapter become "Chapter 1" would **lose the editorial identity** the author intended. Do
not assume A1 and A2 collapse the same way.

**A deeper layer, flagged NOT scoped:** several pattern-B entries are themselves numbered
sub-topics promoted to the top level (`1. THE HOLINESS OF…`, `3. THE ORIGIN OF SACRIFICE…` — each a
top-level entry carrying 2 `Heading 2` sections). The author flattened a 3-tier hierarchy
(chapter → numbered section → sub-point) into the top level. **Re-nesting that is a much larger,
murkier problem than marker-collapse and is a different chantier if it is ever one at all** — the
marker-collapse (the 29 pattern-A) is the bounded, high-confidence win; the 61-entry re-nesting is
explicitly out of this cadrage.

## Constat 2 — every marker's collapse target is a prose-bearing chapter, not an empty stub

What immediately FOLLOWS each of the 29 empty markers (the thing a collapse would fold it into):

- **28 of 29 → a pattern-B real title whose prose is under `Heading 2`** (`CHAPTER 1` → `THE
  HOLINESS OF GOD…` [0 own words, 1 section]).
- **1 of 29 → a real title with prose in its own body** (`CONCLUSION` → `JESUS CHRIST, OUR PASSOVER`
  [1191 own words, 0 sections]).
- **0 → another marker, 0 → an empty stub.**

So the collapse target always carries the real chapter — its title, and its prose (in sections for
28, in body for 1). **This is what makes the operation's title-and-section handling load-bearing**
(Constat 3): whatever op runs must keep the following chapter's real title AND its `Heading 2`
sections intact.

## Constat 3 — §9's "reuse `mergeChapterIntoPrevious`" is MEASURED FALSE (the central finding)

§9 provisionally said cleanup "reuses the existing merge op (`mergeChapterIntoPrevious`)". Simulated
in memory on the first pair (`INTRODUCTION` [empty marker] + `JESUS CHRIST, OUR PASSOVER` [0 own
words, 1 section / 458 words]), the existing op produces **two defects**:

1. **WRONG SURVIVOR.** `mergeChapterIntoPrevious(realTitle)` merges the real title INTO the marker,
   so the surviving chapter keeps the title **`INTRODUCTION`** (the marker) and demotes the real
   title `JESUS CHRIST, OUR PASSOVER` to a body paragraph. The cleanup wants the opposite — keep the
   real title, drop the redundant marker.
2. **DATA LOSS.** The op builds `content = [...prev.content, titleBlock, ...chapter.content]` — it
   concatenates only `.content` and **never `.sections`**. The real title's 1 `Heading 2` section
   (458 words) is **silently dropped**. On the 28 section-bearing pairs this would discard the
   book's prose.

**Therefore the operation cleanup needs is NOT a merge — it is REMOVE the empty marker.** The marker
is fully empty (0 words, 0 sections, Constat 1), so nothing needs merging *into* anything: removing
it and letting the following real chapter flow up and auto-number is faithful and lossless. The
marker's `CHAPTER n` text is redundant with the chapter number `renumberChapters` already assigns.

**No existing mutation does this.** `removePartOpener` is the exact structural shape needed — "remove
a blockless top-level entry, let followers flow up, renumber" — but it is **guarded to
`partOpener` dividers only** (`BookEditingService.ts:341`). So the honest options, to RAISE to the
CTO rather than decide (the shared-types precedent from `STRUCTURE_ASSIST`):
- **(a)** generalize the `removePartOpener` pattern into a "remove an empty marker chapter" op —
  honors the *spirit* of §9's "no new mutation surface" (reuse the proven removal mechanism), even
  though the specific op §9 cited (`mergeChapterIntoPrevious`) is the wrong one; **or**
- **(b)** a new dedicated `collapseMarker` mutation.
- Either way, **A2 (editorial markers) needs more than removal** — the following chapter should
  inherit `Introduction`/`Conclusion` as its title (a rename, or an editorial tag), not silently
  become a numbered chapter (Constat 1).

**This is the reason the cadrage precedes the DR:** §9's one-line "reuse `mergeChapterIntoPrevious`"
would, if built as written, have kept every wrong title and dropped the prose of 28 chapters.

## Constat 4 — the duplicate CHAPTER 3: two full chapters, a number collision the renumber resolves, a title duplication it does not

Two `CHAPTER 3` markers, at top-level indices **40 and 58**, each followed by a `THE PASSOVER IN
EGYPT` real title — but with **different** sub-content (the first's sections vs the second's are
distinct word counts). So the author has **two full chapters both labelled `CHAPTER 3`**, not one
marker typed twice.

At cleanup (remove both markers):
- **The number collision is resolved automatically** — `renumberChapters` renumbers the two
  surviving `THE PASSOVER IN EGYPT` chapters to consecutive numbers (they become 3 and 4), and
  everything after shifts by one. The author's inconsistent hand-numbering (two 3s, running to 26)
  is corrected by the auto-numbering the removal enables.
- **The title duplication REMAINS** — two chapters titled `THE PASSOVER IN EGYPT`. Marker-collapse
  neither creates nor resolves this; whether those two are truly one chapter split in two, or two
  distinct chapters, is a **content** decision for the author, **not** the mechanical collapse's job
  (out of scope, flagged). **What cleanup must guarantee: robustness** — a repeated marker and a
  repeated title must not crash the detector or mis-pair a marker with the wrong title.

## Constat 5 — the §5 gesture counter: 29 → 1, and today there is NO clean manual path at all

- **Cleanup targets: 29 empty markers.**
- **By hand today: effectively impossible to do cleanly.** The exposed mutations
  (`StructureMutation.ts`) offer no chapter-removal — the only candidates are
  `mergeChapterIntoPrevious` (lossy + wrong survivor, Constat 3) and `removePartOpener` (rejects a
  non-divider). So an author facing these 29 markers has **no correct manual gesture** today; the
  "29 by hand" is the hypothetical *if* a correct remove-op existed, one gesture per marker plus the
  hunt through 127 entries.
- **With cleanup: 1 gesture** ("Collapse all markers"), plus a per-exception dismiss — the **29→1**
  of this chantier (the RENDER_DRIFT 284→246 / assist 14→1 analogue).
- **Judge:** the number is honest and large, and unlike the assist it fixes a state the author cannot
  currently repair at all. Contingent, of course, on the correct op (Constat 3).

## Constat 6 — the silence pole holds: cleanup is silent on the under-structured book

Book 1 (under-structured, now `STRUCTURE_ASSIST`'s pole): **1 top-level entry, 0 empty markers →
cleanup proposes nothing.** Its markers are BODY TEXT (assist's job), never empty headings, so the
cleanup detector correctly finds nothing. **The bidirectional pole is confirmed from the cleanup
side:** cleanup PROPOSES on the over-structured book and is SILENT on the under-structured one —
the mirror image of the assist's poles.

---

## The engraved lines (restated from the sibling DR, to carry into the full DR unchanged)

- **Same invariant, both poles.** The cleanup PROPOSES, never removes/merges without an authorial
  act; discarding the proposal leaves the `Book` **byte-identical**. Tested at both poles — proposes
  on the over-structured (book 2), silent on the under-structured (book 1, Constat 6).
- **A read-only detector + the author as gate** — a `CleanupSuggester` (mirror of `StructureSuggester`)
  walks top-level entries, flags empty markers whose following sibling is a real title, attaches the
  evidence (ADR-0049 shape); only a confirmation invokes the mutation. The suggester touches no `Book`.
- **`PRIVATE_MANUSCRIPT_FIXTURES` holds** — the invariant is tested MECHANICALLY on **synthetic**
  poles (committed, CI-repeatable) AND behaviourally on the real founder books in the probe (never
  committed). The founder's manuscripts are NOT versed to the corpus. Same policy as the assist.
- **Reuse over invention** — but the specific op to reuse is the `removePartOpener` *removal
  mechanism*, not `mergeChapterIntoPrevious` (Constat 3). Which of (a)/(b) is a CTO decision.

## Verdicts owed (the cadrage stops here)

| # | Constat | Owed verdict |
|---|---|---|
| 1 | 29 pattern A (markers, split 27 numbered / 2 editorial) vs 61 pattern B (leave alone); a deeper 61-entry re-nesting flagged out of scope | confirm the scope boundary: cleanup = pattern-A marker-collapse only; re-nesting is separate/not-now |
| 3 | `mergeChapterIntoPrevious` keeps the wrong title AND drops sections — the operation is REMOVE-empty-marker | choose (a) generalize `removePartOpener` vs (b) new `collapseMarker`; and how A2 editorial markers keep their identity |
| 4 | duplicate `CHAPTER 3` = two full chapters; renumber resolves the number collision, title duplication remains (author's content decision) | confirm the title-duplication is out of scope; require detector robustness to repeats |
| 5 | 29 → 1; no clean manual path exists today | confirm the gesture-counter judge as the chantier's success metric |
| 6 | silence pole holds (book 1: 0 markers) | none — enters the DR as a fixture pole |

No production code written. On the CTO's verdicts, the full Level-2 Design Review follows — the
operation chosen, the `CleanupSuggester` + confirmation mechanism, the bidirectional invariant test
on synthetic poles, and the freshly-measured 29→1 gesture-counter probe shipped with it (or it is
not done).
