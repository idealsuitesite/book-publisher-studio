# AUTHOR_EXPERIENCE — the dossier (Lot 3 framing, not yet a Design Review)

**Date:** 2026-07-22 · **Status: FRAMING DOSSIER — the named principles that will govern the
future `AUTHOR_EXPERIENCE` Design Review.** This is the reserved `EDITOR_EXPERIENCE.md` slot
(referenced by PRODUCT_EXPERIENCE §10.8 and VISUAL_LANGUAGE §8), now named `AUTHOR_EXPERIENCE`
after the founder traversal. It is **not** the DR: it records the four principles the founder
locked so a future session designs against a fixed frame rather than re-deriving it.

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

### Principle 1 — The non-removal law, Sense 1, with pruning

No **useful capability** is removed without a **measured reason and the founder's validation**.
But hierarchy is not removal: **ranking a capability under a "More…" affordance, making it
discreet, or revealing it on hover is encouraged**, not a suppression — density is solved by
layout, never by amputation (the same spirit as `STRUCTURE_STATION_ERGONOMICS`'s no-action-removed
law). **Removing what only adds clutter is permitted — with validation.** A capability that earns
its place stays reachable; a capability that only crowds the screen may go, once measured and
confirmed.

**Explicit boundary — do not confuse this with the content law.** This principle governs *interface
capabilities*. The *content* law is separate and lives in ADR-0050: **content is never removed
silently — it is flagged, never removed** (a missing field is surfaced in validation, not
discarded; an editorial part absent from the export is reported, not deleted). The two laws share
a spirit but must never be conflated: one is about what the UI offers, the other about what the
book carries.

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

## §2 What this dossier does NOT do

Design the pages, choose the navigation model, or propose wireframes — those are the DR's work,
after `STRUCTURE_ASSIST`. It fixes the four principles so that DR is checked against them, and so
no session quietly amputates a capability, collapses back to a single station, or reopens the
Proof-in-the-stack without meeting the founder's frame. The founder validates the mockups on
screenshots; that gate is Principle 4's, and it is where this dossier becomes a design.
