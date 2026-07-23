# STRUCTURE_ASSIST — Design Review (full, Level 2)

**Date:** 2026-07-22 · **Updated 2026-07-23** with the CTO's decisions (D1–D4 settled, the
bidirectional invariant, `STRUCTURE_CLEANUP` named as the sibling capability) · **Status: DR
RE-SUBMITTED for CTO re-validation before any code** (non-negotiable #4 — a Design Review that
moved is re-validated; these decisions change the *nature* of the chantier, they do not merely
adjust it). The core of the founder's dream. Full DR, not a mini: a new capability (structure
suggestion) governed by a doctrinal invariant.

## §1 The law this serves, and the bidirectional truth the two traversals revealed

**The author spends neither time nor energy to obtain a professional document.** This is **Author
B** made concrete (`VISION.md` — the unprepared manuscript, no formatting effort, satisfied on
opening the exported file). The success criterion is the real exported file, not a green pipeline.

**The two founder traversals proved the structure problem is BIDIRECTIONAL** — the single most
important finding for this DR, and the reason it was re-validated before building:
- **Traversal 1 — UNDER-structured** (`FOUNDER_TRAVERSAL_1.md`): a ~114-page book with **zero**
  detected chapters; the author had typed `CHAPTER 1…4 / FOREWORD / INTRODUCTION` as plain ALL-CAPS
  body text the importer dropped, and hand-built structure across many versions. **This is what
  STRUCTURE_ASSIST solves** — suggest the chapters the author already marked in words.
- **Traversal 2 — OVER-structured** (`FOUNDER_TRAVERSAL_2.md`): a book with real Word headings,
  imported faithfully as **127 top-level entries incl. 29 empty chapters** — the author styled
  `CHAPTER n` as its OWN empty heading, separate from the real title. **Suggestion does NOT solve
  this** — it needs the INVERSE operation, cleanup/merge. Named here as `STRUCTURE_CLEANUP` (§9), a
  sibling capability, built after, on the same invariant.

So STRUCTURE_ASSIST is **one half of a bidirectional problem, and the other half is named and
expected** — no future session may believe this chantier covers the over-structured case. Both
founder manuscripts are the fixtures of the bidirectional invariant test (§3).

**Prerequisite fixes done first (the fidelity defects the traversals surfaced, cleared before
building on the pipeline):** the metadata-honesty Lot 1, and — the gravest — the class-wide `<br>`
boundary corruption (`BR_BOUNDARY_SCOPE.md`, hundreds of jammed body sentences behind a perfect
compositor). The author's text is no longer corrupted; STRUCTURE_ASSIST builds on a clean base.

## §2 The problem, measured (from the scope report, re-stated as the DR's premise)

- **Typographic detection is closed and stays closed** (re-verified on the founder's file:
  0 heading styles, 0 fontSize, 0 `<h1-6>` — `HEURISTIC_STRUCTURE_DETECTION`, non-negotiable #7).
- **The author wrote his structure as literal ALL-CAPS text** the importer threw away: `FOREWORD`,
  `INTRODUCTION`, `CHAPTER 1…4` — 27 standalone ALL-CAPS lines, invisible to heading-style
  detection, glaring to a text reader. The pipeline dropped them to body paragraphs because it
  only makes chapters from HTML headings.
- **A marker/keyword suggester recovers these at high precision; a generic short-line heuristic
  fails (~0.1%)** — the manuscript is written in short lines, so "short = heading" drowns.
- **One boundary is unrecoverable and should be** — a promoted body *sentence* ("Spiritual growth
  is one of the most misunderstood pursuits…"); no detector should flag prose. The author adds it.

## §3 The doctrinal invariant — TESTED, not asserted (the load-bearing decision)

**Suggestion-confirmed, never silent import.** The `HEURISTIC_STRUCTURE_DETECTION` closure
rejected detection as *silent truth* (a false chapter accepted silently invites misplaced trust).
Confirmed-suggestion is a different instrument and clears a lower bar **because the author is the
gate** (ADR-0049 explorable findings): a false candidate costs one dismissal, not a corrupted
structure.

**The invariant, written as a property the test suite must hold:** *no output of the suggester
ever enters the Book without an explicit authorial act.* The moment a detected boundary mutates
the Book without a confirmation, it is exactly what the closure forbade. Concretely:
- The suggestion pass produces a **read-only proposal** (a list of candidate boundaries with the
  evidence that triggered each — the ADR-0049 "honest evidence" shape, like
  `DetectedEditorialPart.detectedTitle`). It **never** calls a mutation.
- Only an author action (confirm one, confirm all, edit, dismiss) invokes the EXISTING
  `promoteToChapter` mutation. The suggester and the mutator are separate; the test proves the
  suggester touches no `Book`.
- **A test pins that running the suggester over a manuscript and discarding the proposal leaves
  the Book byte-identical** — the "no silent import" invariant made mechanical.

**The BIDIRECTIONAL clause (CTO, 2026-07-23) — tested on BOTH founder books as fixtures:**
- **On the UNDER-structured book (traversal 1):** the suggester PROPOSES the typed markers, the
  author CONFIRMS; and — the invariant — discarding the proposal leaves the Book byte-identical
  (nothing enters without the authorial act).
- **On the OVER-structured book (traversal 2):** the suggester must **NEVER worsen it** — it does
  not add structure to a book that already (over-)has it; it stays effectively silent (the markers
  are already headings, not buried body text), and discarding its proposal leaves the Book
  byte-identical. Adding suggestions to an already-structured book is the failure this clause
  forbids. (Collapsing the over-structure is `STRUCTURE_CLEANUP`'s job, §9 — not this suggester's.)
- So the byte-identical-after-discard property holds in **both regimes**, and the two manuscripts
  are the two poles the test pins. This is the clause that stops STRUCTURE_ASSIST from becoming a
  chantier that helps one author and harms another.

## §4 What the existing canonical recognition already covers (measured FIRST, per the CTO)

Before proposing anything new, the DR measured `frontend/lib/editorialParts.ts`
(MINI_DR_EDITORIAL_PARTS):

- **The list:** `EDITORIAL_CATEGORIES` — 17 categories (dedication, epigraph, foreword, preface,
  prologue, introduction, acknowledgments, conclusion, epilogue, afterword, appendix,
  bibliography, glossary, index, notes, colophon, about-the-author).
- **The languages:** EN **and** FR names, lowercased, matched as a union ("never English-by-default",
  CTO-locked). E.g. `foreword`/`avant-propos`, `bibliography`/`bibliographie`.
- **The match:** exact **leading-segment** equality (title up to a `:`/`—`/`–`/` - ` subtitle
  separator), so "Conclusion: Nothing but Faith" matches but "Introduction to Quantum Fields" and
  "Chapter One: …" do not — the safeguard against absorbing a real chapter.
- **Role or label? — a LABEL, presentation-only.** It drives the honest chapter count and the
  Proof presence panel; it **never mutates the Book**, never populates front/back matter, never
  moves content, and it only classifies **top-level titles that already exist**. It does not turn
  a body paragraph into a chapter, and it does not set the export placement role (that is the
  separate, author-driven `setPartRole`).

**Consequence for the design (reuse before invention):** STRUCTURE_ASSIST does **not** invent a
taxonomy. It reuses `EDITORIAL_CATEGORIES` (the EN+FR canonical list) and the exact-match
discipline, and **extends** it in exactly two measured ways the existing module does not cover:
1. **Numbered chapters** (`CHAPTER 1`, `Chapitre 3`, `Part II`) — a pattern, not an editorial
   name; absent from `EDITORIAL_CATEGORIES` by design (that module is editorial parts only).
2. **Detection on BODY PARAGRAPHS**, not just existing top-level titles — the assist reads the
   unstructured flow where the markers are buried, which the classifier (top-level-only) never does.
   The output of a confirmed suggestion is a real **role** (an actual chapter, via
   `promoteToChapter`) — the step the presentation-only classifier deliberately never takes.

The taxonomy the assist proposes is therefore: **{ the 17 canonical editorial names, EN+FR } ∪
{ numbered-chapter patterns, EN+FR }** — one shared, CTO-owned list, extending a list the product
already trusts.

**D1 DECIDED (CTO):** extend `EDITORIAL_CATEGORIES` with the numbered-chapter patterns, and
**relocate the list where BOTH the Domain suggester and the frontend read it.** Constraint: if it
travels through `shared-types` it stays **pure transport data — no runtime logic** (the monorepo
rule); if the match logic must live with it, it is a Domain resource the frontend consumes. The
implementation DR picks the exact home; **the list is ONE, owned by the CTO.** (Today the list +
`classifyEditorialTitle` live frontend-only; the suggester is Domain — so the move is real, not
cosmetic.)

## §5 Success is a NUMBER — the gesture counter (the 284→246 of this chantier)

The metric is not "feels smart" but **how many author gestures it takes to structure the founder's
real book**:

- **The shape:** without assist, structuring the under-structured book means finding each typed
  marker among thousands of blocks and clicking "Make this a chapter" on each — several promote
  gestures plus the hunt (the founder made only a few and stopped — the labour is real enough to
  abandon). With assist, the suggester proposes all the boundaries at once; the author **confirms
  in ≈1 gesture** (with per-candidate dismiss/edit for exceptions). The prose-title boundary the
  author genuinely wrote stays a manual add — correctly.
- **⚠ The number is RE-MEASURED on the current state, never cited from yesterday (non-negotiable #7
  applied to my own measurement, CTO).** The earlier "≈7 / 3,028 blocks" figure is STALE: book 1
  has since gained the `<br>` corrections (its block/text shape changed) AND the founder edited it
  live (10 → 19 versions). The committed gesture-counter probe therefore measures on a **fresh
  re-import of the current source through today's pipeline** (the unstructured state an author
  actually starts from), not the founder's edited aggregate and not a remembered constant. It
  reports both poles: the under-structured book's before/after gesture count, AND — the
  bidirectional check — that the over-structured book yields **≈0 useful suggestions** (its
  structure already exists; the assist correctly proposes little to nothing).
- **The locked rule:** the DR ships WITH this freshly-measured probe (the RENDER_DRIFT 284→246
  analogue) or it is not done.

## §6 Mechanism (D2 & D4 folded in)

1. **A pure suggestion service** (Domain, no infrastructure): input a `Book` with unstructured
   content, output `StructureSuggestion[]` — each `{ blockId, proposedTitle, category?, evidence }`.
   It matches standalone body paragraphs against the shared taxonomy (canonical names + numbered
   patterns), exact-segment discipline, curated to avoid the recurring-artifact trap the scope
   measured ("Next Step" fired 19× — a curated list, not raw keyword soup).
2. **A read-only API** surfacing the proposal (never a mutation) — the ADR-0049 explorable-finding
   shape, evidence attached.
3. **Where it runs (D2 DECIDED):** at the **`UNSTRUCTURED_MANUSCRIPT` moment on import** (offered
   immediately on a 0-chapter book — exactly where the founder hit the wall) **AND on demand in the
   Structure station** (for an already-imported book). **Import PROPOSES, never executes** — the
   0-chapter import still creates the project and shows the offer; nothing is structured without
   the author's confirmation.
4. **The studio review UI** (Structure station): the proposal as a checklist. **Confirmation
   granularity (D4 DECIDED): confirm-ALL and per-item, both** — confirm-all delivers the ≈1-gesture
   target; per-item dismiss/edit handles the exceptions (e.g. the prose title the author promoted by
   hand). **A dismissed candidate is remembered in the editing session** (undo-able), **not beyond
   it** — consistent with the existing version model. Each confirmation calls the EXISTING
   `promoteToChapter` (no new mutation surface — CREATE_CHAPTER is proven).
5. **The bidirectional invariant test (§3) and the freshly-measured gesture-counter probe (§5) ship
   with it** — or the chantier is not done.

## §7 Decisions (D1–D4 settled by the CTO)

- **D1 — shared taxonomy:** ✅ extend `EDITORIAL_CATEGORIES` with numbered-chapter patterns;
  relocate to where Domain + frontend both read it (pure transport data if via `shared-types`, no
  runtime logic; else a Domain resource). One list, CTO-owned. (§4)
- **D2 — where it runs:** ✅ at the `UNSTRUCTURED_MANUSCRIPT` import moment (propose, never execute)
  AND on demand in the Structure station. (§6.3)
- **D3 — numbered-pattern breadth:** ✅ **start NARROW** — `CHAPTER n` / `Chapitre n` / spelled
  ("Chapter One") EN+FR, the forms the founder's manuscript actually carries. `Part n` / roman
  numerals only if MEASURED without false positives on real manuscripts — each added pattern is
  measured against the false-positive risk before it enters (the closure's lesson; n=1 today, no
  widening on hypothesis).
- **D4 — confirmation granularity:** ✅ confirm-all AND per-item; dismissed candidate remembered in
  the editing session, not beyond. (§6.4)

## §8 Disclosures

- **n=1 for the semantic signal.** The founder's manuscript is a strong existence proof that the
  semantic avenue is real and recoverable; it is **not** a calibrated rule. The suggester's
  precision must be re-measured as more real manuscripts enter the corpus (the same discipline the
  closure demanded of its own avenues, and the page-ratio tolerance of its threshold). The DR's
  precision claims are bounded to what this one manuscript shows.
- **Not every manuscript types its markers.** The founder did; others may not. The assist helps
  where the author left a textual trace and is silent (honestly) where none exists — it never
  invents structure, so a manuscript with no markers simply gets no suggestions, not wrong ones.
- **The bidirectional test carries both books as fixtures.** The under-structured manuscript
  (traversal 1) and the over-structured one (traversal 2) are the two poles the invariant test pins
  — the assist proposes on the first, stays silent-and-harmless on the second, byte-identical after
  a discarded proposal in both. Measured on their CURRENT source (re-imported through today's
  pipeline), never a stale figure (§5).
- **This is a re-submitted proposal.** No code is written until the CTO re-validates the moved DR —
  the bidirectional invariant (§3), the freshly-measured metric (§5), the taxonomy relocation (§4,
  D1), the mechanism (§6, D2/D4), the narrow-first patterns (D3), and the named sibling `STRUCTURE_
  CLEANUP` (§9).

## §9 `STRUCTURE_CLEANUP` — the sibling capability (named, scoped, NOT built here)

Named so no session ever believes STRUCTURE_ASSIST covers the over-structured case. It is the
**inverse** operation, and inverses must not share a chantier ("one commit, one intent" at the
chantier scale).

- **The problem it owns (traversal 2):** a book imported from an over-structured Word file — the
  author styled `CHAPTER n` as its own EMPTY heading, separate from the real chapter title
  (measured: 29 empty top-level chapters, 27 standalone `CHAPTER n`). The render offset the founder
  saw (image 5) is those empty title-chapters occupying their own pages (§3≡4 proven in
  `FOUNDER_TRAVERSAL_2.md`).
- **The operation:** recognise an empty `CHAPTER n` marker immediately followed by a real title and
  **propose to COLLAPSE them into one chapter** ("`CHAPTER 1` and the next title look like one
  chapter — merge?"). It REMOVES structure where the assist ADDS it.
- **Same invariant, same gate:** it too only PROPOSES — never merges without an authorial act — and
  discarding its proposal leaves the Book byte-identical. It shares the invariant test harness and
  the author-as-gate doctrine, and reuses the existing merge op (`mergeChapterIntoPrevious`).
- **Built AFTER STRUCTURE_ASSIST**, on the same foundation. The two founder books remain the test
  cases of the two chantiers.
