# AUTHOR_EXPERIENCE — the dossier (Lot 3 framing, not yet a Design Review)

**Date:** 2026-07-22 · **Status: FRAMING DOSSIER — the named principles that will govern the
future `AUTHOR_EXPERIENCE` Design Review.** This is the reserved `EDITOR_EXPERIENCE.md` slot
(referenced by PRODUCT_EXPERIENCE §10.8 and VISUAL_LANGUAGE §8), now named `AUTHOR_EXPERIENCE`
after the founder traversal. It is **not** the DR: it records the four principles the founder
locked so a future session designs against a fixed frame rather than re-deriving it.

**Founder-confirmed input (2026-07-24, INCREMENTAL_RENDER P1 taste-stop):** at the P1 taste-stop on the living studio, the founder validated the new PDF.js Proof surface (gaze continuity across a re-ink, selectable text, per-page paint) AND expressed, as a demand, **structure-editing FROM the Proof** — editing the book while looking at the living preview, not only from the Structure station. That is **criterion B (contextual editing)**, and it belongs HERE, not to P1 (whose mandate was criterion A / fluidity by the engine). Consigned as a founder-confirmed requirement the AUTHOR_EXPERIENCE DR must satisfy — it also motivates the live region-fetch wiring P1 deliberately left to this chantier (the Proof-as-its-own-page redesign is where "edit in place, see it re-ink in the region" is built end to end). *(The P1 zoom regression the founder also named was fixed on-branch in P1 commit 7 — NOT deferred here; only the contextual-editing demand is.)*

## §0 Whom it serves and when it opens

`AUTHOR_EXPERIENCE` serves **Author B** (`VISION.md` — the unprepared manuscript, no formatting
effort, satisfied on opening the exported file). Its inputs are the founder-traversal findings the
Lot-1 fixes could not resolve because they are experience/information-architecture, not bugs: the
three "title" fields and the missing book-title editor (defect 4), the author-settable language
field (defect 3), the edition affordance (defect 5), and the measured proof latency (defect 6).

**Sequencing (engraved): `AUTHOR_EXPERIENCE` does NOT open before `STRUCTURE_ASSIST`.** You cannot
design the Structure station before you know what detection deposits into it — the shape of the
suggestions, the confirmation flow, and what the author does next all depend on the
`STRUCTURE_ASSIST` design. So: Lot 1 (done) → the in-progress founder measurements → the
`STRUCTURE_ASSIST` DR (Author B's structure) → **then** this DR, with the four principles below as
its frame. Justification+hyphenation (`TYPOGRAPHY_QUALITY`) and the themes' visual identity remain
their own chantiers, decided or waiting.

## §1 The four named principles (founder-locked, 2026-07-22)

### Principle 1 — The non-encombrement law (CORRECTED 2026-07-23 — the founder's formulation)

> **⚠ CORRECTION (CTO, 2026-07-23, FOUNDER_TRAVERSAL_3).** The version below **replaces** an earlier
> hardened wording ("no useful capability is removed without a measured reason") that put the burden
> of proof on *removal*. The founder's formulation reverses it: **the burden of proof is on KEEPING,
> not on removal.** The earlier boundary (this is interface, not the ADR-0050 content law) still holds.

**Keep what serves a comprehensible purpose; remove what clutters or confuses.** The burden of proof
is on **maintaining** a capability, not on removing it: a control must justify its place, and one
whose consequence the author cannot guess — `Dismiss` is the measured example (two opposite-nature
gestures at the same visual weight, one mutating the book, one not) — **becomes obvious or
disappears.** Hierarchy is a tool, not the only one: ranking a capability under a "More…" affordance,
making it discreet, or revealing it on hover is encouraged where the capability earns its place — but
where it does not, it goes. **Founder validation is required on removals.** (Same spirit as, but now
stronger than, `STRUCTURE_STATION_ERGONOMICS`'s no-action-removed default.)

**Explicit boundary — this is the interface law, not the content law (ADR-0050).** Content is never
removed silently — it is flagged, never discarded. The two share a spirit but are never conflated;
and the author's own right to delete *content* is the separate `CONTENT_DELETION_BY_AUTHOR`
(ADR-0044 amendment, `DECISIONS.md`).

### Principle 2 — Multi-page architecture

**The single station is not a law.** The work spreads across several screens, **each with one
clear object**. Some actions lead to **dedicated pages carrying their own data and tools**, rather
than piling everything into one view. This is not new ground: the studio already has the
precedent — **Layout, Ready for Print, Editions** are each their own destination with their own
purpose. `AUTHOR_EXPERIENCE` generalises that pattern deliberately instead of defaulting to one
crowded station.

### Principle 3 — The Proof as its own dedicated page

The Proof **leaves the stack-under-the-list** and becomes **its own destination**. This is
consistent with the founder's earlier reading — *"the Proof was not the problem, its place was"* —
and it is the occasion to **rethink its rendering**: **first page first, progressive loading**,
against the *measured* slowness of re-rendering hundreds of pages (FOUNDER_TRAVERSAL defect 6 —
the 500 ms debounce + the full `<embed>` reload of a 114-page book is the "several seconds" Author
B felt). A dedicated Proof page is both an information-architecture move and the natural home for
the perceived-performance work.

### Principle 4 — The navigation rule (the condition on the other three)

**Spreading must not scatter.** Principles 2 and 3 distribute the work across pages; this principle
is their guardrail: **each page has an obvious object, and the path between pages is legible.** A
multi-page studio that an author gets lost in is worse than one crowded station. **The mockups,
judged by the founder on screenshots, will settle the balance** — the wireframe/capture review is
where "distributed but not scattered" is verified, the same screenshot-loop discipline every taste
decision in this project has used.

## §1b Design laws engraved 2026-07-23 (FOUNDER_TRAVERSAL_3 — govern B4/B5 and the redesign)

### Law A — "Une ligne, une décision"

**One row, one decision.** The author understands in **one second** what is proposed and what he must
answer. **The software brings the title; the author never retypes what he has already written.** Rare
cases (edit a proposed title, an exceptional override) live behind a **discreet secondary gesture,
never a field on the row.** This is why `TITLE_FROM_FOLLOWING_LINE` (B4) proposes the descriptive line
the author already wrote rather than a marker, and why the D4 "edit the title" affordance — **not
cancelled, located** — is the secondary gesture, not an input on every suggestion row.

### Law B — `CHAPTER_TITLE_PRESENTATION` (a standing constraint — no chantier may close this door)

The author chooses among **three chapter-title treatments**: (1) "Chapter 1" then the title below;
(2) the title alone, large; (3) the name at the head at a size clearly above the subtitles. **Technical
invariant, load-bearing:** the chapter **number is a datum of the chapter, never text inside the
title** — computed by position (`Chapter.number` / `renumberChapters`), auto-renumbered, and **shown
or not by the theme.** Consequence, already live: STRUCTURE_ASSIST proposing "CHAPTER 1" as the
*title text* violates this (the number would print even under treatment 2) — the B4 defect. The model
is already correct; **no current or future chantier may put the number back into the title text.**
Pointer: `DECISIONS.md` (with `CONTENT_DELETION_BY_AUTHOR`, the ADR-0044 amendment, recorded there).

### `UNTITLED_PREAMBLE_NAMEABLE` — a named input this DR must address (FOUNDER_TRAVERSAL_3 A4)

**The problem, measured (`A4_UNTITLED_REMAINDER.md`):** when a manuscript's body begins with prose
before its first heading, ASTBuilder creates an untitled level-0 **preamble section** (`ASTBuilder.ts:100`).
On the founder's book 3 that section is a **real Introduction** (755 words, first body line
"INTRODUCTION"), left under-structured. The fidelity half is fixed (the EPUB no longer prints
"Untitled"; the section is omitted from the nav like PDF/DOCX already do). **The experience half
remains: the author cannot currently SEE or NAME that section** — it exists in the book but has no
title and no affordance to give it one, so it stays silently un-navigable.

**Why it belongs here, not in an isolated fix:** naming it is an *experience* decision — how the
author perceives a titleless leading section and gives it a title — touching the import/model
representation and the Structure-station UI. The doctrine is the same as everywhere: **the software
shows, the author decides** (never a guessed title, never front-matter inference). A measured path
already exists to fold into the design: the section's own first line is a typed marker ("INTRODUCTION")
that the assist — with the A2 repetition guard — **already proposes**, so promoting it is one gesture;
what is missing is that the untitled section not be **invisible** while it waits for the author to act.
The DR decides how it is surfaced (a nameable Structure entry, an assist offer, or both) under
"une ligne, une décision" and `CHAPTER_TITLE_PRESENTATION`.

## §2 What this dossier does NOT do

Design the pages, choose the navigation model, or propose wireframes — those are the DR's work,
after `STRUCTURE_ASSIST`. It fixes the four principles so that DR is checked against them, and so
no session quietly amputates a capability, collapses back to a single station, or reopens the
Proof-in-the-stack without meeting the founder's frame. The founder validates the mockups on
screenshots; that gate is Principle 4's, and it is where this dossier becomes a design.
