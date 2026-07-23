# SUBCHAPTER_PROMOTION — Design Review (full, Level 2) — B5

**Date:** 2026-07-23 · **Status: VALIDATED (CTO, 2026-07-23) — D1–D4 answered, cleared for
construction.** FOUNDER_TRAVERSAL_3 Lot B, item B5 — the third structural form. Built on the
**measured** foundation of traversal 3, the third member of the `STRUCTURE_ASSIST` /
`STRUCTURE_CLEANUP` family, on the **same doctrinal invariant**. The §2 restraint (the 34 descriptive
sub-headings have no deductive signal and are EXCLUDED, not heuristicised — `HEURISTIC_STRUCTURE_DETECTION`
honoured on a new case) is CTO-endorsed; `DESCRIPTIVE_SUBHEADING_DETECTION` consigned, opened only if
a signal is ever measured.

## §1 The law this serves, and the founder's constat

**The author's sub-chapters must form a continuity, not become separate chapters.** Verbatim
(FOUNDER_TRAVERSAL_3 §0): *« les sous-chapitres numérotés de 1 à 6 ne sont pas supposés devenir des
chapitres séparés ; ils doivent former une continuité »*. Concretely, on book 3 the author typed a
**"Conclusion"** sub-heading at the end of **every chapter** (26 of them, measured) plus descriptive
sub-headings within chapters — content that belongs **under** its chapter as a section, not beside it
as a peer chapter. `STRUCTURE_ASSIST` recovers chapters; this chantier recovers the level **below** a
chapter without inflating the chapter count.

**The founder's design laws are the frame** (`AUTHOR_EXPERIENCE.md`): *une ligne, une décision*; the
software brings the title, the author never retypes; the chapter **number is a datum, never text in
the title** (`CHAPTER_TITLE_PRESENTATION`).

## §2 The problem, measured (the foundation — never guessed)

Instrument: `backend/spikes/founder-hierarchy-signals.ts` (one probe, three readings, **n=3**).

- **Repetition is the strongest, DEDUCTIVE signal** (R1). A book has exactly one Conclusion; so a
  canonical editorial name appearing **N>1** times is a recurring **section** title, not N chapters.
  Measured across three real books: book 1 — Foreword/Introduction/Conclusion each ×1 at positions
  0.01 / 0.03 / 0.88 (true parts); book 3 — Introduction ×1 @0 (true), **Conclusion ×26** distributed
  0.06–0.40+ (sub-structure). Frequency AND position agree. **Zero true parts lost** by the N>1 rule.
- **The A2 guard already identifies them** (shipped `7a3ecbf`): a repeated canonical editorial name
  is dropped from the CHAPTER proposals. **B5 decides what BECOMES of them** — today they simply
  vanish from the offer; the founder's continuity is not yet built.
- **The marker→title pairing is reliable** (R2): 100% (book 1) / 97% (book 3) of `CHAPTER n` markers
  are followed by a title-shaped line — the same structural reading that feeds `TITLE_FROM_FOLLOWING_LINE`.
- **What is NOT reliably distinguishable, measured:** the **descriptive** ALL-CAPS sub-headings (34 in
  book 3, e.g. "THE BLOOD ON THE DOORPOSTS"). They are not in the taxonomy and, lexically, look like
  chapter titles — there is **no deductive signal** separating a descriptive sub-heading from a
  chapter title on an unstyled manuscript (`HEURISTIC_STRUCTURE_DETECTION`'s closure holds). **They
  are out of B5 v1's scope** — proposing them as sub-sections would be guessing, which the doctrine
  forbids.

**So B5 v1 is scoped to the ONE proven signal: the repeated canonical editorial name.** Narrow,
deductive, measured — the same "start narrow, widen only on measurement" discipline the assist's D3 used.

## §3 The doctrinal invariant — UNCHANGED (tested at both poles)

Identical to the family: **propose, never impose.** The sub-chapter suggester produces a **read-only
proposal**; only an author action mutates the Book; **running the suggester and discarding the
proposal leaves the Book byte-identical** — the mechanical property, tested at both poles (a book with
recurring editorial sub-headings → proposes; a book without → silent). `PRIVATE_MANUSCRIPT_FIXTURES`
holds: synthetic poles committed, the real n=3 proof in the probe.

## §4 Success is a NUMBER — the gesture counter (the judge)

On book 3: the author has **26 recurring "Conclusion" sub-headings**. Without B5, making each a proper
sub-section is 26 manual gestures (and today no clean path — promoteToChapter would wrongly make each
a top-level chapter, re-inflating the count the A2 guard just corrected). **With B5, one gesture** —
"make these 26 a per-chapter sub-section" — with per-item dismiss for exceptions. The chantier ships
WITH the freshly-measured gesture-counter probe (the RENDER_DRIFT 284→246 / assist 14→1 / cleanup
29→1 analogue) or it is not done.

## §5 Mechanism (proposed — the open decisions are §6)

1. **A pure `SubchapterSuggester`** (Domain, mirror of the family): reads a Book whose chapters exist
   and whose bodies contain recurring editorial markers; returns `SubchapterSuggestion[]` — each names
   the block to demote, the canonical label (Conclusion), and the **parent chapter** it falls within.
   It reuses the shared `structureTaxonomy` and the **repetition count** (N>1) as the trigger. Never
   mutates.
2. **The operation — a "promote to sub-section" the model does not yet have.** `promoteToChapter`
   creates a TOP-LEVEL chapter (CREATE_CHAPTER scoped nested blocks OUT of round 1). B5 needs to carve
   a **Section under a chapter** from an in-chapter body block: the marker's text becomes the section
   title, the following blocks (until the next marker/section boundary) become its content. This is a
   **new mutation** (or an extension of the promote op to a section target) — flagged as D1.
3. **Where it runs:** after chapters exist (the author has promoted them via the assist), on demand in
   the Structure station. The recurring markers are then inside chapter bodies.
4. **The studio:** a proposal checklist under *une ligne, une décision* — "This 'Conclusion' repeats
   in every chapter; make each a section of its chapter?" Confirm-all + per-item dismiss. Silent when
   no recurring editorial marker exists.

## §6 Decisions (CTO, 2026-07-23 — SETTLED)

- **D1 — a NEW `promoteToSubsection` mutation, NOT an extension of `promoteToChapter`.** ✅ The two
  produce things of different nature (a top-level entry vs a child section); giving the existing op a
  "section target" would put two intentions under one name (the project's constant: one op, one
  intention, one typed guard). **But REUSE CREATE_CHAPTER's split logic rather than duplicate it** (as
  cleanup reused `removePartOpener`'s removal mechanism). **Two conditions:** (1) a **named typed
  guard** — refuse if the block is not inside a chapter, refuse if the target chapter does not exist,
  **tested both ways**; (2) a test pinning that **the following prose migrates correctly into the new
  section and nothing is lost** — the cousin's `.sections` lesson, applied preemptively.
- **D2 — repetition-only for v1.** ✅ The deductive signal, nothing else; widen only on measurement.
  The descriptive sub-headings are deferred (`DESCRIPTIVE_SUBHEADING_DETECTION`).
- **D3 — one source of truth.** ✅ The A2 guard and B5 are two faces of one recognition — the guard
  suppresses the wrong (chapter) proposal, B5 makes the right (sub-section) one. **The repetition
  computation is SHARED, not duplicated** (two thresholds that could diverge would be a latent defect).
  **Test:** the SAME input produces a chapter-side suppression AND a sub-section-side proposal — never
  one without the other.
- **D4 — gated on chapters existing.** ✅ An on-demand Structure-station action, never offered on the
  raw unstructured import (that moment is the assist's).

## §6b The rendering requirement (CTO, 2026-07-23 — a mandatory end-stop, touches the founder directly)

Book 3 will turn **26 "Conclusion" into sections**. Beyond the gesture counter (26→1, the judge of
labour saved), **the rendered page is the judge of the result.** Verify on REAL pages that tri-format
rendering handles an end-of-chapter section correctly: it **does not break pagination**, **does not
steal the next chapter's drop cap** (the Novel-theme case), and **does not appear in the TOC as if it
were a chapter**. This ships with the chantier — the gesture counter AND a real book-3 page rendered
with its sections are the two mandatory stops.

## §7 Disclosures

- **n=3 is still small.** The repetition signal is deductive (a book has one Conclusion), so it does
  not depend on corpus size the way a heuristic would — but the *breadth* of canonical names that
  recur as sub-headings is measured on three books only. The suggester stays narrow (the taxonomy's
  canonical set) and widens only on measurement.
- **Descriptive sub-headings are honestly out of scope** (§2) — no deductive signal on an unstyled
  manuscript; proposing them would be the guessing the doctrine forbids.
- **The invariant carries both poles as fixtures** (§3); the real n=3 proof stays in the probe
  (`PRIVATE_MANUSCRIPT_FIXTURES`).
- **This is a proposal.** No code until the CTO validates D1–D4, the repetition-only scope, and the
  gesture-counter judge as the success metric.
