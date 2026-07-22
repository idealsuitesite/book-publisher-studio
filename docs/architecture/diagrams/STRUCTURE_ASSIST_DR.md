# STRUCTURE_ASSIST — Design Review (full, Level 2)

**Date:** 2026-07-22 · **Status: DESIGN REVIEW — proposal, awaiting CTO approval before any code**
(non-negotiable #4). The core of the founder's dream, opened by his own traversal
(`FOUNDER_TRAVERSAL_1.md` Lot 2, `STRUCTURE_ASSIST_SCOPE.md`). This is a full DR, not a mini: it
introduces a new capability (structure suggestion) governed by a doctrinal invariant.

## §1 The law this serves (engraved)

**The author spends neither time nor energy to obtain a professional document.** The founder
imported a ~114-page book that arrived with **zero** detected chapters and hand-built its
structure across 10 versions — exactly the labour the product exists to remove.

This is **Author B** made concrete (`VISION.md` — the unprepared manuscript, no formatting effort,
satisfied on opening the exported file). STRUCTURE_ASSIST is the capability that lets Author B skip
the structure work entirely; the success criterion is the real exported file, not a green pipeline.

**In-progress inputs (founder's second traversal, "The Secret Of Spiritual Protection", live):**
the founder is measuring further symptoms on a fresh manuscript — a `ProtectionFOREWORD`-style
title concatenation, chapters reporting 0 words, an introduction/text offset, and a confirmed-good
body composition. These feed this DR before it is built (the engraved sequence's measurement step
between Lot 1 and this review); they are to be measured read-only, never by mutating the founder's
live project.

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

## §5 Success is a NUMBER — the gesture counter (the 284→246 of this chantier)

The metric is not "feels smart" but **how many author gestures it takes to structure the founder's
real book**:

- **Today (measured):** the manuscript is 3,028 blocks. Fully structuring it means finding each of
  the ~6–7 typed markers (`FOREWORD`, `INTRODUCTION`, `CHAPTER 1…4`) *among 3,028 blocks* and
  clicking "Make this a chapter" on each — **≈ 6–7 promote gestures plus the hunt**. The founder,
  in practice, made only 3 and stopped — the labour is real enough to abandon.
- **With the assist (target):** the suggester proposes all ~6–7 boundaries at once; the author
  reviews and **confirms in 1 gesture** (with per-candidate dismiss/edit for the exceptions). The
  one prose-title boundary he genuinely authored stays a manual add — correctly.
- **The locked success criterion:** the gesture count to reach the founder's intended structure
  drops from **≈7 (+ hunting 3,028 blocks) to ≈1**, measured by a committed probe over his real
  manuscript (the analogue of RENDER_DRIFT's 284→246). The DR ships with that measurement or it is
  not done.

## §6 Proposed mechanism (for CTO decision, not yet built)

1. **A pure suggestion service** (Domain, no infrastructure): input a `Book` with unstructured
   content, output `StructureSuggestion[]` — each `{ blockId, proposedTitle, category?, evidence }`.
   It matches standalone body paragraphs against the shared taxonomy (canonical names + numbered
   patterns), exact-segment discipline, curated to avoid the recurring-artifact trap the scope
   measured ("Next Step" fired 19× — a curated list, not raw keyword soup).
2. **A read-only API** surfacing the proposal (never a mutation) — the ADR-0049 explorable-finding
   shape, evidence attached.
3. **The studio review UI** (Structure station): the proposal as a checklist; confirm-all /
   per-item confirm / edit-title / dismiss. Each confirmation calls the EXISTING `promoteToChapter`
   (no new mutation surface — the CREATE_CHAPTER capability already exists and is proven).
4. **The invariant test** (§3) and the **gesture-counter probe** (§5) ship with it.

## §7 Open questions for the CTO (the DR's decision points)

- **D1 — the shared taxonomy list's ownership and contents:** confirm extending
  `EDITORIAL_CATEGORIES` with numbered-chapter patterns is right, and whether the list moves to a
  shared location (it is frontend-only today; the suggester is Domain/backend).
- **D2 — where suggestion runs:** at import (offer immediately on a 0-chapter book, the
  `UNSTRUCTURED_MANUSCRIPT` moment) vs on demand in the Structure station. The scope suggests the
  import moment is the natural one (it is exactly when the founder hit the wall).
- **D3 — numbered-pattern breadth:** `CHAPTER n` / `Chapitre n` / `Part n` / roman numerals /
  "Chapter One" (spelled) — how wide, measured against false positives on real manuscripts.
- **D4 — the confirmation granularity** (confirm-all vs per-item) and whether a dismissed
  candidate is remembered.

## §8 Disclosures

- **n=1 for the semantic signal.** The founder's manuscript is a strong existence proof that the
  semantic avenue is real and recoverable; it is **not** a calibrated rule. The suggester's
  precision must be re-measured as more real manuscripts enter the corpus (the same discipline the
  closure demanded of its own avenues, and the page-ratio tolerance of its threshold). The DR's
  precision claims are bounded to what this one manuscript shows.
- **Not every manuscript types its markers.** The founder did; others may not. The assist helps
  where the author left a textual trace and is silent (honestly) where none exists — it never
  invents structure, so a manuscript with no markers simply gets no suggestions, not wrong ones.
- **This is a proposal.** No code is written until the CTO approves the invariant (§3), the metric
  (§5), the taxonomy approach (§4), and the open questions (§7).
