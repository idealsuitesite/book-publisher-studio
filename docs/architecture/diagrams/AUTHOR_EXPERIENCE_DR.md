# AUTHOR_EXPERIENCE — Level-2 Design Review

**Date:** 2026-07-24 · **Status: DESIGN REVIEW — AWAITING THE CTO'S GATE ON THE DECISIONS (§3–§4). No
mockups, no code yet.** The process is engraved (§6): the CTO gates the DECISIONS here first; only then
are the mockups produced and judged by the founder on captures; **nothing is built before his
validation on the images** (non-negotiable #4).

This is the largest chantier of the project — the information-architecture redesign of the studio for
Author B. It carries the CTO's seven axis verdicts (`AUTHOR_EXPERIENCE_GAP.md` §8), the founder's four
design laws (`AUTHOR_EXPERIENCE.md`), and the inputs P1 handed forward. It is grounded in what is
already engraved and **re-verified against the current post-P1-merge code, not re-read** (#7, §1).

---

## §0 Mandate, whom it serves, when it opens

**Serves Author B** (`VISION.md`): the unprepared manuscript, no formatting effort, satisfied on
opening the exported file. **The difference (§6 of the gap, re-confirmed): our left skeleton arrives
already filled by the three suggesters** (assist / cleanup / subchapter) from a raw DOCX — the
reference product (Atticus/Vellum) *requires* a styled Word file; we build what it assumes given.

**The four founder acceptance criteria are the gate the mockups are judged against:**
- **A — Fluidity.** Every change appears immediately. **Engine-proven by P1** (region render 31 ms;
  edit→visible 155 ms hot on the founder's book 3); this DR *wires* it into the living surface.
- **B — Contextual editing.** Edit the book from where you see it (the Proof), not only a separate
  station. **Founder-confirmed at the P1 taste-stop — his instinct, now a requirement.**
- **C — Preview always visible.** The living Proof is a permanent surface, not a stack under a list.
- **D — Impression of simplicity.** The payoff of the typed skeleton + themes-as-systems + the
  disappearances.

**Sequencing — the gates ahead of this DR are discharged:** STRUCTURE_ASSIST/CLEANUP/SUBCHAPTER shipped
(the skeleton's populator); **P2 (`BATCH_CONFIRM_LATENCY`) merged** (one snapshot / one save per batch);
**P1 (incremental render) merged and CLOSED** (criterion A reachable by the engine, founder-validated).
The DR opens now, exactly as the CTO's re-engraved sequence required.

## §1 Re-verification of the foundation (#7 — measured against current `main`, not trusted)

The gap dossier is dated 2026-07-23 (pre-P1/P2). Every load-bearing fact was re-checked against the
merged code before building on it:

| Axis / fact | Re-verified on current `main` | Consequence for this DR |
|---|---|---|
| 1 — editorial part is a **label, not an object** | `classifyEditorialTitle` + `EDITORIAL_CATEGORIES` (frontend); `FrontMatter.dedication/preface/foreword/introduction/acknowledgments` typed in `Book.ts` | still true → D1 must make it a first-class object |
| 2 — front-matter parts **typed-but-dead** | `FrontMatterBuilder.build` sets only `titlePage`/`copyrightPage`; no builder/renderer for the rest | still true → D2 (v1 dedication + preface) |
| 3 — number/title **already separated** | `Chapter.number` computed, `Chapter.subtitle` shipped, Structure list splits them | still true → D6 is surface + a theme chooser, not model |
| 4 — 15 convert/organise ops, **no Insert** | `parseMutation` whitelist enumerated; no insert-element / split-at-cursor / convert-to-Part | still true → Insert stays OUT (`INSERT_ELEMENTS`) |
| 5 — Theme is a **system, chosen by name** | `Theme` = fonts/fontSizes/colors/spacing/runningHead/dropCap/callout; 3 themes; name-list selection | still true → D5 (thumbnails + separators/opening into the theme) |
| 6 — justification/hyphenation **blocked** | `align:'justify'` modelled but unused; hyphenation absent from the model | still true → Axis 6 stays behind `TYPOGRAPHY_QUALITY` |
| 7 — living preview | **CHANGED by P1**: `renderPageRange` + `GET /:id/region` + `PdfProof` exist; but `PreviewPanel`/`page.tsx` still call `exportProject` (full) — **the live region-fetch is unbuilt** | D4 wires the proven engine into the surface |

**No premise this DR builds on was contradicted by the re-measurement.** The one material change is the
right one: Axis 7's prerequisite is discharged — the engine exists, the wiring is this DR's.

## §2 The engraved shape (the frame the decisions fill)

**Three panels, one object each** (the founder's frame, `AUTHOR_EXPERIENCE.md` Principle 2 + the gap §7):
- **LEFT — the typed editorial skeleton.** The complete editorial order as first-class, navigable,
  reorderable objects: Title Page · Copyright · Dedication · TOC · Parts · Chapters · Acknowledgments ·
  About the Author. **Arrives populated by the suggesters** on import; the author confirms, never types
  scaffolding from scratch.
- **CENTRE — the editable document.** The manuscript as a document (not a list row): a chapter's
  non-editable number header with its editable title-field below, the prose, the conversions acting on
  the selection ("Convert to…"). This is where **criterion B** lives.
- **RIGHT — the living Proof.** Permanent, always visible, re-inking in milliseconds on the region the
  author touched (criterion A + C), with the zoom controls P1 shipped.

**Three-gesture scaling.** From a raw import, three gestures bring a book to a confirmed skeleton (the
suggesters' "Make all" per family). The design must preserve that: the skeleton is not empty
scaffolding to fill by hand.

**Distributed, not scattered** (Principle 4). The three panels are one workspace; work that earns its
own destination (Editions, a dedicated Proof route for the full read) is a legible path away, never a
maze.

## §3 The decisions (Level-2 — the CTO gates these; taste decisions deferred to the mockups)

Ordered by the CTO's stated importance. Each names the measured cost; where a genuine fork exists the
DR **recommends** and the CTO gates.

### D1 — The editorial skeleton as a first-class object (Axis 1, "the heart of the chantier")
**The problem (re-verified):** the skeleton is split across three representations — chapters in
`mainContent`, editorial parts *recognised by title* in `mainContent`, front matter in `FrontMatter`,
and five typed-but-dead `FrontMatter` slots. None of them *is* the skeleton; a left panel that stitched
three models would be fragile and the author would feel it.

**Two options, measured:**
- **Option A — extend the model.** Introduce an editorial-part node as a first-class content type in
  `mainContent` (and/or promote the `FrontMatter` slots into ordered content).
  - **What it breaks (the measured blast radius — every reader of the aggregate's shape must change):**
    `LayoutEngine.paginate` (a new content type in the walk); **all three renderers** (`PDFRenderer`,
    `DOCXRenderer`, `EPUBRenderer` — each iterates `mainContent`/`FrontMatter` by their current shapes);
    TOC generation; `orderByRole`; the mutation ops in `BookEditingService` (they assume today's shape);
    `bookFacts`/`computeBookFacts`; **the persistence contract** (`SqliteProjectRepository` serialises
    the aggregate — a shape change is a stored-book **migration** for the 9 real projects) and the shared
    `projectRepositoryContract` suite; the corpus parity byte-locks (a shape change re-flows nothing but
    must be proven not to). *Risk: highest.* "Nothing breaks" becomes a large, migration-bearing promise.
- **Option B — a projected read model (RECOMMENDED).** A Domain service `projectEditorialSkeleton(book)`
  returns one ordered, immutable **`EditorialSkeleton`** — every editorial object (front matter, parts,
  chapters, back matter) as `{ type, title, place, sourceRef }`, assembled from `mainContent` order +
  `role` tags + `FrontMatter`. The left panel renders THAT one surface.
  - **Real cost (measured against the tree):** ONE new pure Domain read-model + its unit tests, and a
    frontend consumer; **zero consumers of the aggregate change** — pagination, the three renderers, TOC,
    `orderByRole`, persistence, the ops all keep today's shapes. ADR-0001 holds *by construction* (the
    projection reads the immutable `Book`; it never becomes part of it).
  - **THE LOAD-BEARING INVARIANT — a single write path (this is what makes B a *unification*, not a
    fourth representation).** `EditorialSkeleton` is **derived and READ-ONLY: it has no setters.** Every
    skeleton gesture dispatches one of the **existing 15 mutations** (+ D2's `addFrontMatterSection`)
    against the `Book` through `EditBookUseCase`; the Book changes, and the projection is **re-derived**
    from it. There is **no code path that writes into the projection** — `project(book)` is a pure
    function, one direction only. *If the panel could edit the projection directly, it would be a fourth
    representation drifting from the model — precisely the fragility we are removing.* The invariant is
    mechanical, not a convention: the read-model type is exported without mutators, and the only writer of
    book state remains `EditBookUseCase` (guarded by a test that the projection module imports no mutation
    and exposes no setter).
  - **The chantier judge for D1 (CTO gate addition, 2026-07-24) — two tests, complementary:** (i) the
    **setter-lock** above forbids writing INTO the projection; (ii) a **projection-coherence** test proves
    the read follows the write in both directions of the cycle — for **every mutation type** applied to a
    real `Book` (gesture → op → `EditBookUseCase` → new `Book`), `projectEditorialSkeleton(book)` **reflects
    the change** (a rename shows the new title, a reorder the new order, a promote the new object, a
    `setPartRole` the new place). The single write path is only a unification if the projection always
    mirrors the model it derives from; this test is that guarantee.

**Recommendation: Option B.** It makes the editorial part a first-class *object the UI and the menu act
on* — the founder's Axis-1 intent — with the single-write-path invariant guaranteeing it is one
representation over the model, not a new store of truth; and it avoids the migration-bearing blast radius
of A while honouring "nothing breaks." **Fallback, decided only if measured:** if a real ordering need
appears that the projection cannot express (e.g., a dedication that must interleave with `mainContent`
order rather than compose as front matter), a **bounded, additive** model extension for that one need —
never the full Option-A migration on spec. **The CTO gates A-vs-B, and the single-write-path invariant
is part of what B commits to.**

### D2 — Add-a-type that composes AND renders (Axis 2, v1 = dedication + preface)
Five dead types at once is five builders and three renderers. **v1: dedication and preface** (the two
most-asked, measured on real books where possible). Each needs, together (else it re-creates the dead
field it was meant to fill): (a) an **add mutation** (`addFrontMatterSection` — the first Insert-shaped
op admitted here, narrowly, because a preface with no path is the most visible author-side hole and it
is composition, not the arbitrary content-creation `INSERT_ELEMENTS` defers); (b) a **builder** path in
`FrontMatterBuilder`; (c) **tri-format render** in PDF/DOCX/EPUB. The remaining three types follow the
same proven pattern later. The `CONTENT_DELETION_BY_AUTHOR` right (ADR-0044 amendment) covers removing
one.

### D3 — Contextual editing from the Proof (criterion B — the founder's confirmed demand)
The centre document panel carries the "Convert to…" menu acting on the **selection**; the existing 15
ops already cover make-chapter / make-section / merge-up / collapse / set-placement / retitle /
make-subtitle. **The one model step is D1** (the selection can target an editorial object, not just a
block). The founder's demand — *edit while looking at the living preview* — is met by the centre+right
pairing: a gesture in the centre re-inks the affected region in the right panel (D4). **No new
conversion is invented here** (Insert is out); B is a UI build on D1 + the existing ops.

### D4 — Wire criterion A/C into the living surface (the region-fetch loop P1 left here)
P1 proved the engine (region render 31 ms) and shipped the surface (`PdfProof`) but left the frontend
still full-rendering. This DR wires it:
- **The Proof fetches the visible region** (`GET /:id/region?start&end&total`) on an edit and on scroll,
  repainting only the touched page(s) — the measured **4× edit loop** becomes the felt loop.
- **The physical-total re-sync policy — and what the author SEES in between (the fidelity crux).** The
  region render gives the *visible pages*; the WHOLE-BOOK facts — the total ("447 p."), the TOC, the
  page-thumbnails — are only known from a full render. A content edit can change the total by its own
  page delta, and **the region path deliberately never recomputes it** (that is the performance win). So
  the DR must answer not just the cadence but the honesty: *between the edit and the re-sync, does the
  screen show a frozen-but-dated total, or a false one?*
  - **Cadence.** A **geometry** change (theme/layout — `proofRefreshKey`'s non-`updatedAt` parts) does a
    full render (the total is authoritative). A **content** edit region-renders immediately for the felt
    loop, and schedules a **background full render on edit-pause** to re-establish the exact
    total/TOC/thumbnails. That pause debounce is a **consigned-revisable value** (CTO gate addition) — a
    measured-reasonable default at the outset, adjustable at the founder taste-stop, exactly like the
    500 ms re-ink debounce; it is not fixed here.
  - **The honest state — never a confidently-wrong N (ADR-0050/0051 doctrine).** Between a content edit
    and its background re-sync, the whole-book total is **shown as PROVISIONAL, not asserted as current**:
    the last full render's number, visibly marked (dimmed / "≈" / "updating…") until the background full
    render lands, then shown crisp. The region page's OWN footer ("Page n") is exact per page (it comes
    from the region render); it is only the WHOLE-BOOK denominator that is marked provisional. **A stale
    "447" presented as true is a small fidelity lie and is forbidden** — the screen either marks it
    provisional or holds it, but never dresses an unverified number as final. (Mockup 2 must show this
    provisional state, §5.)
- **First-page-first / progressive loading** and the **Proof as a permanent panel** (Principle 3):
  the Proof leaves the stack, the visible window paints first, the rest streams on scroll.
- **`COLD_RENDER_FIRST_OPEN`** (consigned by P1) is the one remaining welcome-latency term; the DR may
  fold in a warm-up-on-open lever or keep it consigned — a measured call, not a promise drawn now.

### D5 — Themes chosen on a rendered page; separators + opening into the theme (Axis 5)
**Real-page thumbnails**: the author picks a graphic *language* on an engine-rendered sample page, not a
name from a list — the founder's formula. **In the same movement**, the two dimensions that escape the
theme today move INTO it: the **ornamental separator** (today a per-block `Divider.style`) and the
**chapter first-page/opening** typography become theme values — "a theme that does not control its
separators is not a complete system." The three `CHAPTER_TITLE_PRESENTATION` treatments are a **theme**
choice. **All three (thumbnail language, separator, opening, title treatment) are founder taste-stops on
the mockups**, not decided here.

### D6 — The document-centre title surface (Axis 3)
The number/title separation exists; the change is the **surface**: a non-editable `Chapter {number}`
header with the editable title-field **below** it in the document centre (not an inline list row), and
the author-facing chooser for the three title treatments (D5's theme decision, surfaced here).
**`CHAPTER_TITLE_PRESENTATION` is load-bearing and inviolable: the number is a datum, never text in the
title** — no surface in this DR may put it back.

### D7 — The disappearances (Principle 1 — burden of proof on KEEPING; founder validates removals)
The nominative list, each with **where its function goes** — because a removal whose function goes
nowhere is a loss, not a simplification (the burden of proof is on KEEPING, not on removing):

| Removed today | Its function → destination | Kind |
|---|---|---|
| **The proposal/suggestion strip** (assist/cleanup/subchapter as a top banner) | → the confirm affordance moves **onto each skeleton object** ("une ligne, une décision" on the row it concerns); the "Make all" per family stays as a skeleton-level action | **moved** (into the skeleton) |
| **The old Structure list** (`StructureEditor`'s row list) | → **replaced** by the left skeleton (D1), which IS the structure, now document-centric | **moved** (function is the skeleton) |
| **`Ready for Print` as a separate station** | → its **metadata inputs** (author, ISBN, language, description) move **beside the skeleton** (where the author composing the book needs them); its **validation findings** surface **in context** on the object they concern (a missing-author flag on the title-page object), not on a separate page | **moved** (split to two homes) |
| **The large Layout blocks** (full-width theme/format panels) | → **compact menus** reachable from the workspace; the theme choice becomes the D5 real-page thumbnails | **moved** (compacted) |
| **`Dismiss`** (the measured two-opposite-gestures defect — a mutating and a non-mutating gesture at equal weight) | → **made obvious or removed**: a suggestion the author does not want is declined by a clearly-labelled, non-mutating gesture distinct in weight from the confirming one; if it cannot be made unambiguous it goes | **clarified or removed** |
| **`Overview` as a first-class landing** | → **REMOVED (founder ruling 2026-07-24)**: the studio opens directly into the workspace; every Overview fact is re-homed (the §4 table), none dropped | **removed, re-homed** |

**No entry above is a pure loss** — each function is re-homed or consciously judged. **Every removal is a
founder decision on the mockups** (Principle 1); the DR proposes this list, the screenshots settle it,
and anything whose function cannot be re-homed is kept, not dropped.

### D8 — Impossible-by-gentleness (the `EMPTY_CHAPTER_FROM_STRUCTURE_EDIT` input)
P1's constat: the *current* screen let the founder create an empty "INTRODUCTION" chapter, a
sentence-as-title chapter, and chapter-number gaps — **without friction**. The new screen makes these
**impossible by gentleness, not by blocking** (the founder's doctrine — suggest, never impose):
- **Empty chapter:** the skeleton shows an empty editorial object as visibly incomplete and the suggesters
  offer to collapse it (STRUCTURE_CLEANUP already targets empty markers) — the author is *led* away from
  it, never hard-stopped.
- **Sentence-as-title:** "une ligne, une décision" + *the software brings the title* — the author
  confirms a proposed title, he does not retype a paragraph into a title field; `TITLE_FROM_FOLLOWING_LINE`
  (B4) is the proposal, so a whole sentence is not the default title.
- **Number gaps:** the number is computed by position and auto-renumbered (`renumberChapters`); the
  author never types a number, so gaps cannot be authored.
This is a **design constraint on the mockups**, not new blocking logic: the gentle path is the default,
the friction path is discreet.

> **TERRAIN VALIDATION of the datum law (D6/D8) — recorded 2026-07-24, M1-C2, CTO-directed.** The read
> studio was verified live (read-only) on the founder's real 30-chapter book 3. His manuscript's chapter
> *titles* are literally **"CHAPTER 1", "CHAPTER 3", "CHAPTER 8" (twice), "CHAPTER 10"…** — a numbering
> his own text got wrong — while the skeleton's **computed numbers ran a clean 1..30 underneath them**.
> This is the on-real-data demonstration of the law **"the number is a datum, never the author's text"**
> (`CHAPTER_TITLE_PRESENTATION`): the day the read studio first lit up, real founder data proved *why* the
> number must be computed and never echoed from the title. No synthetic fixture manufactures this — it is
> the founding-proof answer for anyone who later questions the datum/title separation. (Verified on
> `…d7bticjiw` v34; the projection is `projectEditorialSkeleton`, the surface `EditorialWorkspace`.)

**Explicitly OUT of this chantier** (consigned, not forgotten): **`INSERT_ELEMENTS`** (insert a Part /
split at a cursor / a new imported-absent element — content creation, its own chantier; D2's
`addFrontMatterSection` is the one narrow composition exception); **Axis 6 justification + hyphenation**
(behind `TYPOGRAPHY_QUALITY`, the CTO's standing one-decision ruling); the **themes' visual identity**
(each theme's own taste work); the full **five dead front-matter types** (D2 ships two, the rest follow
the proven pattern).

## §4 The navigation model (Principle 4 — the guardrail on §3)
The station set today: Overview · Structure · Ready-for-Print · Layout · Proof · Editions · History.
**The merged-state proposal (the DR's, for the founder's screenshot verdict):**
- The **three-panel workspace** (skeleton · document · Proof) becomes the primary surface — it absorbs
  Structure, the Proof-in-the-stack, and Ready-for-Print's metadata inputs.
- **Layout** shrinks to a compact theme/format chooser (D5's thumbnails) reachable from the workspace.
- **Editions** stays its own destination (publish is a distinct object — precedent honoured).
- **History** stays (versions/undo).
- **Overview** is **REMOVED (founder ruling)**: the studio opens **directly into the workspace**.
**Each page one object; each path legible.** The founder validated this map (2026-07-24): **7 stations → 4**
(Workspace · Look · Editions · History).

**The Overview re-homing table (founder ruling — nothing dropped, everything re-homed):**

| Overview fact today | → New home |
|---|---|
| **Word count** ("45,816 words") | → the **workspace header** (a quiet running fact) |
| **Next action** ("Book author is required →") | → the **skeleton's confirm-affordances + the in-context findings** (the workspace shows what to do next on the object it concerns) |
| **Progression / quality score** ("/100") | → surfaced as the **in-context findings** themselves (the score *is* the open findings) + a compact header meter; no separate page |
| **Last publication** ("None yet.") | → **Editions** (publish's own destination) |
| **Title · source file · updated-at** (inspector facts) | → the **workspace header / a details affordance** |

A removal is a simplification only if the function lands somewhere; each row above lands. **Opening
straight into the work is itself the point** — Author B meets his book, not a dashboard about it.

## §5 The mockups to produce (the founder's gate) — what each must demonstrate against A–D

**VALIDATED by the founder (2026-07-24): all six mockups.** `mockups/author-experience-mockups.html` —
built in the studio's own palette (both themes) with real corpus content (*Faith Alone*), the three CTO
gate additions carried. **The two delegated decisions are ruled by the founder:**
- **Provisional-total costume = Option B, the "≈" form** ("Page 23 of ≈ 156"). Consigned-revisable like
  the re-ink / re-sync debounces — a chosen default, movable later.
- **`Overview` is REMOVED — the studio opens directly into the workspace.** Its facts are re-homed, none
  dropped (the re-homing table is in §4). Word count → the workspace header; the "next action" → the
  skeleton's confirm-affordances + the in-context findings; last publication → Editions; the rest → the
  workspace header / a details affordance.

With the gate passed, **the construction plan (§8) is produced for the CTO's gate**; the build branches
at that gate.

Nothing is built before the founder validates these on captures. **A note on honesty first: a still
capture cannot prove criterion A (fluidity) — motion and milliseconds are not visible in an image.** So
no mockup *claims* felt speed from a picture; the A-facing mockup shows the **mechanism** that produces
fluidity and carries the **measured** number, and the felt A is settled where it was for P1 — the
founder's **live** taste-stop on the running studio, not a screenshot. The DR commits to producing:

1. **The three-panel workspace (steady state, a real book).** — Criterion **D** (one legible surface,
   the disappearances of D7 realised) + **B** (the "Convert to…" menu open on a centre selection).
   Judgeable on a still: is it one calm surface, is the menu where the eye is? Capture: populated
   skeleton left, a chapter open centre, the Proof right. **It also shows a CONCRETE finding IN CONTEXT
   (CTO gate addition — the Ready-for-Print split is D7's most structural move, so its result is SHOWN,
   not asserted): the `MISSING_AUTHOR` flag sitting ON the Title-Page object in the skeleton, and the
   metadata inputs beside the skeleton — the two homes the dissolved `Ready for Print` station splits
   into, made visible exactly where a finding appears.**
2. **The edit→re-ink loop — a before/after PAIR (criterion A's mechanism, and C).** Two frames of the
   **same page**: (a) before an edit, (b) after, with the right-panel region re-inked **in place** and
   the scroll/zoom position identical between the frames. What the still proves is the *mechanism* —
   in-place region repaint, gaze preserved — annotated with the **measured** engine figure (155 ms
   edit→visible on book 3, region render 31 ms). It also shows the **provisional whole-book total**
   (D4) while the background full render is pending — never a false N. **The exact costume of the
   provisional state (dimmed / "≈" / "updating…") is presented as OPTIONS for the founder to pick (CTO
   gate addition), not pre-decided — the DR imposes the STATE, the founder chooses its dress.** *Felt
   fluidity itself is the founder's live stop, stated as such on the mockup.*
3. **The populated skeleton on import — the entry door AND the D8 image (a founder-real case).** A raw
   DOCX → the suggesters' filled skeleton, three-gesture scaling (the differentiator). **This is the D8
   capture, and it earns its own image because it is exactly what bit the founder:** it shows an empty
   "INTRODUCTION" object surfaced as **visibly incomplete** with the **gentle collapse offer** beside it
   (led away, not blocked), a proposed title the author *confirms* rather than a sentence he retypes,
   and computed chapter numbers with no gap to author — the three `EMPTY_CHAPTER_FROM_STRUCTURE_EDIT`
   artifacts made impossible-by-gentleness, shown on one screen.
4. **Add-a-type (dedication / preface) — criterion B / D2.** The add gesture, the composed section, and
   a strip of its **tri-format** render (PDF/DOCX/EPUB) — the dead field filled end to end.
5. **Theme selection by rendered page — D5, the founder's taste-stops.** Real-page thumbnails (a graphic
   language, not a name), with the separator and the chapter-opening visibly theme-controlled and the
   three title treatments shown.
6. **The navigation map — Principle 4 / §4.** The station set after the merges, each page's one object,
   the paths between — "distributed, not scattered," judgeable as a map.

Each mockup is annotated with the criterion it answers and the removals it embodies, so the founder
judges the *frame*, not just the pixels — and criterion A is honestly split: mechanism on the still,
felt speed on the live studio.

## §6 Process and the gate
1. **CTO gated the decisions (§3–§4) — DONE (2026-07-24).** D1 Option B (+ the single-write-path invariant
   and the projection-coherence test), D2–D8; the three gate additions folded in.
2. **The mockups (§5) were produced and the founder VALIDATED them on captures — DONE (2026-07-24).** All
   six; the two delegated decisions ruled (provisional costume = "≈"; Overview removed, re-homed).
3. **Construction is now scoped (§8) for the CTO's gate** — a sequence of gated commits, each with its
   judge and real-fixture verification, the founder taste-stops marked, milestoned so every increment is
   a working studio. **The build branches at the CTO's gate on §8; nothing is coded before it.**

**Standing rules carried in:** ADR-0001 (Book immutable — D1 honours it), `CHAPTER_TITLE_PRESENTATION`
(the number is a datum — D6 inviolable), the non-encombrement law (burden on keeping, founder validates
removals — D7), real-fixture verification for any render/pagination touch (D2/D4/D5), the three
self-stops, and the cadence directive (autonomy inside the approved sequence, approvals at the gates).

## §7 Scope boundaries and consignments (one place)
- **IN:** D1 skeleton object (read-model recommended) · D2 dedication+preface (compose + tri-format) ·
  D3 contextual editing (criterion B) · D4 live region-fetch loop + Proof-as-permanent-panel (criteria
  A/C) · D5 theme thumbnails + separators/opening into the theme (taste) · D6 document title surface ·
  D7 disappearances · D8 impossible-by-gentleness.
- **OUT / consigned:** `INSERT_ELEMENTS`; Axis 6 (`TYPOGRAPHY_QUALITY`); the other three dead types
  (after D2 proves the pattern); themes' visual identity; `COLD_RENDER_FIRST_OPEN` (P1 consignment,
  D4 may fold a warm-up or keep it consigned — measured call).
- **Carried inputs discharged here:** criterion-B demand (D3), `EMPTY_CHAPTER_FROM_STRUCTURE_EDIT` (D8),
  the P1 live-wiring hand-off (D4), the CTO's seven axis verdicts (D1–D6, §4).

**This DR's decisions are gated (§6) and the mockups are founder-validated. Construction is scoped in §8
below, for the CTO's gate. The build branches at that gate.**

## §8 Construction plan (for the CTO's gate — the largest build of the project)

**The governing constraint: every commit leaves a WORKING studio — never a broken intermediate.** The new
workspace is built **additively beside the existing stations**, which stay as a working fallback until the
new surface fully carries their function; only then (M4) does the old world dissolve. Grouped into four
**milestones, each of which is itself a shippable working studio.**

**Order — dependency-true, with the divergences from the CTO's expected order named (he invited them):**
the expected order (D1 → shell → D3/D4 → D2 → D5/D6 → D7/D8+nav) is dependency-sound and largely kept.
Four refinements the dependencies (or the "never-broken" rule) demand:
1. **The "workspace shell" is split** — skeleton+document (read) then the Proof panel — too large for one
   coherent commit; each sub-commit is a working *read* studio.
2. **D8 is designed in from the start, wired late** — "confirm-not-retype", computed numbers, and
   "incomplete object surfaced" are properties of how the skeleton + confirm flow are built (M1–M2), not a
   final bolt-on; only the *gentle-collapse wiring* is a late commit. D8 is not purely last.
3. **D7's removals are staged, old stations last** (kept per the CTO's instinct, with the reason stated):
   the function **re-homing** (metadata, findings) lands first (M4-C11); the old stations are **removed
   only after** the new surface is proven (C12) — they are the working safety net until then.
4. **D2's backend is dependency-independent** and *could* move to M0 to de-risk tri-format early; kept in
   M3 adjacent to its UI for "one commit, one intent" unless the CTO prefers the early de-risk.

**CTO GATE — GRANTED on this §8 (2026-07-24).** Verdicts on the four named divergences, then two folded
conditions:
- **Divergence 1 (shell split C2–C3): ACCEPTED.** A three-panel shell in one commit carries two intentions;
  the read-studio milestone is coherent as M1.
- **Divergence 2 (D8 designed-in from M1, gentle-collapse wired late): ACCEPTED — better than the expected
  order.** Confirm-not-retype and computed numbers are properties of the skeleton's grammar, not features to
  add; only the collapse-offer UI is late-bindable. **Requirement folded in: M1's judge asserts the
  designed-in properties — no title-retype path exists, no authorable number — so they are locked before the
  wiring commit (C13), not at it.**
- **Divergence 3 (re-home before remove): ACCEPTED without reservation.** C11 lands the functions in their
  new homes; C12 removes the old stations only after the new surface carries them — the migration pattern
  that never strands the founder.
- **Divergence 4 (D2 backend placement): KEEP IN M3.** The de-risk argument is real but weak — tri-format
  render is well-trodden (three renderers, the pattern proven from title/copyright pages), not novel risk.
  One-commit-one-intent adjacent to its UI wins. A tri-format surprise in the C6 commit is a **self-stop
  case (a)** (premise contradicted by measurement), not a reason to have built it early on spec.

**Two folded gate conditions (written into the milestones below):**
- **(1)** The M4 felt-A live stop content is **pre-agreed here, not improvised at M4** — the checklist is at
  C15 (from the founder's own history; his session, his books, no script beyond the list).
- **(2)** M4 carries a **rollback line** for C12 (removing working stations) — stated at C12.

**Every render / pagination / model touch verifies on a REAL manuscript** (corpus `faith-alone`; the
founder books via read-only probe, never committed — `PRIVATE_MANUSCRIPT_FIXTURES`). Standing rules apply
throughout: ADR-0001 (Book immutable), `CHAPTER_TITLE_PRESENTATION` (number is a datum), the
non-encombrement law (removals already founder-validated on the mockups), the three self-stops, the
cadence directive, gated commits pushed founder-idle.

### Milestone 0 — Foundation (backend only; the studio is unchanged and working)
| # | Commit | Judge / verification | Taste-stop |
|---|---|---|---|
| C1 | **D1 — `projectEditorialSkeleton(book)`** pure Domain read-model + its **two locked tests**: (i) **setter-lock** (the module exports no mutator, imports no mutation), (ii) **projection-coherence** (for every mutation type applied to a real `faith-alone` Book via `EditBookUseCase`, the projection reflects it). | Both tests green; the existing backend/frontend suites unchanged (nothing consumes it yet → studio untouched). Real fixture: `faith-alone`. | — |

*M0 ships the foundation everything left-renders from, with the single-write-path guarantee locked, and
changes no studio behaviour.*

### Milestone 1 — The workspace reads (frontend; new workspace coexists with the old stations)
| # | Commit | Judge / verification | Taste-stop |
|---|---|---|---|
| C2 | **The workspace shell + left skeleton + centre document (READ/navigate).** Renders `projectEditorialSkeleton` (left) and the selected object's content (centre), read-only. A new primary view; old stations intact. | Renders a real book's skeleton + document; frontend suite; axe (a11y); Visible-Increment (a human sees it). **Divergence-2 lock (CTO condition): the judge asserts the designed-in D8 properties — the skeleton exposes NO title-retype path and NO authorable chapter number (the number is a computed datum, `CHAPTER_TITLE_PRESENTATION`)** — so these grammar properties are locked here in M1, before C13's collapse wiring. Live on `faith-alone`. | — |
| C3 | **The right Proof panel, permanent** — reuse `PdfProof` + the existing FULL render (region wiring is C5). The Proof leaves the stack (Principle 3, placement half). | Proof renders in-panel; scroll/zoom (P1) intact; frontend suite. Live. | — |

*M1 ships a working three-panel studio you can read and navigate; editing still available via the old
Structure station (the safety net).*

### Milestone 2 — The workspace edits, and comes alive
| # | Commit | Judge / verification | Taste-stop |
|---|---|---|---|
| C4 | **D3 — contextual editing.** The "Convert to…" menu on the centre/skeleton selection dispatches the **existing 15 ops** via `EditBookUseCase` (D1 lets it target an editorial object). Criterion **B**. | An op from the workspace changes the STORED book and the export reflects it (the `projectExportReflectsEdit` precedent) — real fixture `faith-alone` through the route; route tests; frontend suite. **Graven gate point 1 (CTO, M2): the single write path holds under real usage** — every skeleton/centre gesture dispatches an op through `EditBookUseCase`; the UI never mutates the projection or the book directly (M0's coherence test asserts the property; M2 must not build a bypass). | — |
| C5 | **D4 — the live region-fetch loop.** `PdfProof` fetches `GET /:id/region` on a **content** edit (full render on **geometry** change), the **"≈" provisional total** (founder-ruled) shown until a **background full render on edit-pause** (debounce consigned-revisable) re-syncs it — never a false N. Criterion **A/C**. | Scroll preserved across an edit under **Playwright**. **Graven gate point 2 (CTO, M2): "never a falsely-confident N" affirmed BY TEST** — a frontend test proves that between the edit and the background re-sync the whole-book denominator carries the "≈" provisional mark (never a stale N dressed as final), and this test exists before the milestone gate closes. **Graven gate point 3 (CTO, M2): the M2 judge RE-MEASURES the real end-to-end gesture in the new studio** — edit → region re-inked, gaze kept — so P1's 155 ms is re-confirmed **in its final habitat** (through this UI on edited book 3), not assumed to transfer. Real fixture: book 3 probe. | (felt-A live stop deferred to M4, on the finished loop) |

*M2 ships the fluid, editable workspace — criterion A wired end to end; the old stations still present.
Its three graven gate points (CTO, 2026-07-24) are no new scope — the M0/M1 invariants now applying under
real use: (1) the single write path holds live, (2) the never-a-false-N honesty is test-affirmed, (3) the
155 ms is re-measured in the final habitat, not presumed transferred.*

> **M2 CLOSED — graven gate point 3 SETTLED by the A/B attribution (CTO ruling 2026-07-24).** A raw
> end-to-end reading first showed the post-edit region GET at **~529 ms** on the `tsx` dev server — over
> the 300 ms bar. Per the doctrine (self-stop case a: *attribute the measurement before optimizing*), the
> ENGINE was decomposed and A/B'd, tsx vs compiled, on real `faith-alone` (engine-only, comparable to
> P1's 155 ms baseline; `spikes/region-ab-timing.ts`):
> - **ENGINE (paginate + region render): tsx 87 ms · compiled 96 ms** — both **≤ 300 ms and ≤ P1's
>   155 ms** (faith-alone 155 pg < book-3 445 pg). The engine TRANSFERRED to the final habitat, on both
>   runtimes; the interpreter tax on the engine is negligible (tsx pre-compiles via esbuild). Full render
>   ~350–375 ms → region **~10× faster**. **Graven gate point 3 is met.**
> - **The 529 ms was NEVER the engine.** The region GET HTTP latency GROWS with the version-log count —
>   measured **81 ms @ 0 versions → 153 @ 5 → 250 @ 10 → 541 @ 15** — because `RenderProjectRegionUseCase`
>   (like every render path) calls `repository.findById`, which deserialises the whole version-accumulating
>   aggregate (ADR-0046: 45 MB @ 50 versions). This is **runtime-independent** (compiled or tsx, the load is
>   the same) and is the already-consigned **`APPEND_ONLY_PERSISTENCE`** / version-log-cap cost, not a render
>   regression and not specific to the region loop.
>
> **Both numbers recorded (CTO requirement 2).** The **compiled engine (96 ms)** is the shipping-truth basis
> for the ≤ 300 ms threshold — cleared. The **dev-mode engine (87 ms)** is what the founder's `tsx` sessions
> run today — also cleared. **The felt-A caveat for the M4 stop, stated plainly:** the founder's *felt*
> edit-loop latency degrades with his session's edit count (the `findById` version-load tax, 81 → 541 ms over
> 15 edits) — **build-independent**, so a production build does NOT fix it; only `APPEND_ONLY_PERSISTENCE`
> (append-only save / a version-log cap) does. **Recommendation flagged to the CTO: consider pulling
> `APPEND_ONLY_PERSISTENCE` forward before the M4 felt-A stop**, since a long editing session is exactly
> when the founder judges criterion A. The render engine itself is not the bottleneck; the persistence
> contract is.

### Milestone 3 — Compose and surfaces (the founder taste-stops land here)

**PROGRESS (2026-07-25): C6 + C7 DONE + gated green.** C8–C10 remain; the M3 INPUTS below fold into them. Resume at C8.
> - **C6 (`c4b4318`)** — D2 dedication + preface composed + tri-format rendered.
> - **C7 (`4bb7f79`)** — the D2 add-front-matter affordance (verified live: a composed preface surfaces in the skeleton + renders in the Proof, 31→32 pages) + the two P1-defects: **typed human errors** (`lib/structure-errors.ts`, one author-language sentence per transport code, never the raw string; `ApiErrorCode` reconciled with the routes' real codes — #7) and the **visible promote-undo** (an undo bar at the gesture's result; the newest version is the pre-edit snapshot, O(1) after the flip). Frontend 255/255, tsc + eslint clean, backend tsc clean.

| # | Commit | Judge / verification | Taste-stop |
|---|---|---|---|
| C6 ✅ | **D2 backend — `addFrontMatterSection`** (whitelisted + route test, the `setPartRole` lesson) + `FrontMatterBuilder` **dedication + preface** + **tri-format render** (PDF/DOCX/EPUB). **DONE `c4b4318`:** the mutation routes through the flipped `appendVersion`; `composeDedication`/`composePreface` own the shape; canonical order title→copyright→dedication→toc→preface→body matches the skeleton's `FRONT_MATTER_SLOTS` (composed sections surface in the read-model for free). | ✅ backend 958/958, tsc + eslint clean both sides, `verify-real-export` 16/16 (throwaway, zero trace); tri-format render on real bytes (both appear ahead of the body; preface reaches the EPUB nav); coherence presence + route 200/400 asserted. | — |
| C7 | **D2 UI — the "＋ Add front-matter…" affordance** in the skeleton → the composed section appears in the skeleton and the Proof. | Add via the workspace, it renders live; frontend suite. | — |
| C8 | **D5 backend — separators + chapter-opening INTO the theme** (`Divider.style` → theme value; a chapter-opening theme field; renderers consume them). A model/renderer touch. | **Real-fixture render parity** (corpus byte-locks re-locked WITH attribution — the RENDER_DRIFT discipline); tri-format. | — |
| C9 | **D5 UI — real-page thumbnails** (engine-rendered sample pages) for theme selection; Layout shrinks to this compact chooser. | Thumbnails render real pages; frontend suite. | **Founder: the graphic language, separator, opening.** |
| C10 | **D6 — the document title surface** (non-editable number header + editable title below) + the **three-treatment chooser** (a theme value; the number stays a datum — `CHAPTER_TITLE_PRESENTATION` inviolable). | The three treatments render true tri-format; the number never enters the title text (the standing gate test). | **Founder: the title treatment.** |

*M3 ships composition (dead types filled) and the theme-as-a-page surfaces; the founder's visual
taste-stops are taken on the living studio. Still a working studio with the old stations present.*

#### M3 INPUTS — founder traversal, his first v2 session (2026-07-24, folded in by the CTO)

The founder ran his first real session on the migrated v2 store (studio activated from `feat/author-experience`; the persistence flip served every gesture — attributed clean, `EDIT` versions written with metadata columns populated, `integrity_check: ok`). His traversal produced M3 inputs, prioritized. **These fold into M3; nothing is pulled forward from M4.**

**P1-DEFECTS (fix within/before M3 — these are the "unable to return / wondering what it did" class):**
1. **Raw `promoteToChapter` error surfaced to the author** — the OLD consigned defect (`EMPTY_CHAPTER_FROM_STRUCTURE_EDIT` neighbourhood), now **founder-hit** in the wild. Requirement: **typed, human errors only** — the author never sees a raw error string / stack; a failed gesture explains itself in his language.
2. **The promote gesture needs a visible UNDO affordance in the workspace.** The mechanic exists and is now cheap (`restoreVersion` → `getVersion`, O(1) after the flip); the **affordance does not**. A gesture must be visibly returnable from where it was made.
3. **A static, non-selectable "Conclusion" block** — **attribute first** (render artifact? an empty/blockless title? a Proof text-layer gap?) before any fix, per the real-fixture discipline.

**M3 REQUIREMENTS (fold into the C6–C10 commits):**
1. **The Proof FOLLOWS the edit** — on a re-ink, scroll to and briefly highlight the changed region (a D4/C5 refinement carried into M3's living studio, so the author's eye is taken to what changed).
2. **The conversion menu FOLLOWS the selection** — the "Convert to…" gestures appear contextually at/near the selected object, not in a fixed panel. **Criterion B, literally** (contextual editing from the document).
3. **The Front/Body/Back placement control is renamed/clarified with a VISIBLE effect** — the founder **misread it as a title-style control; the misreading IS the finding**. Additionally: **his exploratory placement clicks EACH created a version** — attribution confirms **7 `"before set part role"` versions** in one session, several seconds apart (21:25:02, 21:25:12 …), i.e. exploration taxed the version log. **Review whether a no-op `setPartRole` (same role re-applied) should version at all** — an exploratory click that changes nothing should not create an undo point.

**FOUNDER RULINGS (recorded):**
- **Light theme is the default; dark lives in settings.**
- **New M3 acceptance criterion:** *"No gesture leaves the author wondering what it did, or unable to return."* This governs the P1-defects and requirement 1 above; it is a milestone gate, not a nicety.
- **The old stations' clutter is answered by their M4 dissolution — confirmed, NO early action.** C12 is not pulled forward; the coexistence-until-proven discipline holds.

*Store baseline after his session: **10 projects, 99 versions, 4 milestones**, `user_version=2` — the 10th is his new book-3 copy `1784927363074-6t6pypzon` "Rachat et expiation bibliques 2 (1)" (v8). The pre-migration backup was released (retention rule discharged: successful v2 session confirmed).*

### Milestone 4 — The old world dissolves; one studio (removals last, felt-A stop at the end)
| # | Commit | Judge / verification | Taste-stop |
|---|---|---|---|
| C11 | **D7 re-home — metadata beside the skeleton; findings IN CONTEXT** on their object (the `MISSING_AUTHOR`-on-Title-Page pattern), dissolving `Ready for Print`'s two jobs into the workspace. | A real finding appears on the right object; the metadata inputs edit the book; frontend suite. Real fixture. | — |
| C12 | **D7 remove — the old Structure station + the Proof-in-the-stack** (now fully in the workspace); the workspace is the primary surface. | The studio works with the old stations gone; nothing a station did is unreachable (the §7/§4 re-homing realised). **Rollback line (CTO condition 2):** C12 is the only commit that removes working stations. If the C15 felt-A founder stop fails after removal, the revert path is **`git revert` of C12 alone** — restoring the old stations while the workspace (C2–C11, C13–C14) persists alongside them, back to the M1 coexistence state; the founder is never stranded. (Designed now; the day it is needed is the wrong day to design it.) | — |
| C13 | **D8 — the gentle-collapse wiring.** An empty editorial object is surfaced incomplete (built since M1) and offers **collapse via the existing cleanup suggester** — led away, never blocked. | The founder's empty-`INTRODUCTION` case (read-only probe) surfaces incomplete + offers collapse; a synthetic empty-chapter CI test. | — |
| C14 | **Navigation — open directly into the workspace; Overview REMOVED, 7 → 4 stations**, its facts re-homed per the §4 table (word count → header, etc.). | A fresh open lands in the workspace; the re-homing table realised; frontend suite; axe. | — |
| C15 | **The chantier judge + docs reconciliation.** Full suites, tsc, eslint, builds, `verify-real-*` on a throwaway server (zero trace, store restored). | All green; headers reconciled to CLOSED. | **Founder: the felt-A live taste-stop on the finished studio** — the whole edit→see loop, the criterion he can only judge alive (as P1). **Checklist pre-agreed (CTO condition 1), his session, his books, no script beyond the list:** (1) import a raw manuscript; (2) three-gesture skeleton — the raw manuscript scaffolds into a confirmable editorial skeleton in three gestures; (3) contextual edit from the centre document; (4) watch the region re-ink with the gaze kept (criterion A, P1's engine through the UI); (5) the "≈" provisional total resolving to a crisp N; (6) add a dedication (D2 compose); (7) export and open the file (the fidelity end-stop — the product is the file). |

*M4 ships the finished single studio; the felt-A founder stop is the closing gate before merge.*

> **M4 also carries the product-name rename to `Unveil`** (founder decision 2026-07-24, recorded in
> `AUTHOR_EXPERIENCE.md` §PN) — the studio is baptized when it becomes one. **Scope: display-name
> surfaces ONLY** (workspace header, browser-tab title, user-visible package *display* names, and any
> export-metadata product stamp — do a **read-only check of what the renderers stamp at M4**, not before).
> Repo paths / package identifiers / internal `book-publisher-*` names are OUT of scope. The rename commit
> is **additionally gated on the founder's own trademark/domain confirmation** — it does not ship on my
> word alone. A dedicated M4 commit alongside C14 (the navigation/open-into-workspace change), not folded
> into it.

**Branch:** created at the CTO's gate on this §8 (the preventive rule — the branch point IS the gate).
**Milestone re-verification:** at each milestone boundary the full gate runs (both suites, tsc, eslint,
builds, `verify-real-*` zero-trace) so a milestone is never merged half-working. **~15 commits, 4
milestones, each a working studio.** **Nothing is coded before the CTO gates §8.**

**OWED at the M3 boundary gate (CTO, 2026-07-25) — a Playwright pass over the C7 surfaces.** The C7
browser verification confirmed rendering + the live result (a composed preface in the skeleton, the Proof
31→32) but NOT the untested inch: the real click on the add-form's **Add** firing the real dispatch, the
**undo bar** appearing after a versioning edit and its click restoring, and a **typed error** rendering on
a forced failure. The MCP browser pane fought coordinate/React-synthetic-event compositing (the P1 lesson:
the MCP pane doesn't composite while Playwright headless does), so these three interaction paths get a
real-Chromium **Playwright** pass at the M3 boundary — where the milestone's real-browser judge already
lives — not a per-commit re-litigation of C7.

**Added to that same boundary Playwright pass (CTO, 2026-07-25) — a VIEWPORT SWEEP (founder-attributed).**
During the C7 browser-piloted verification the founder observed the workspace rendering **doubled** in the
driven window — two skeletons, two PREFACE forms, two title bars side by side — which **self-corrected when
he resized**. Likely an automated-browser-context artifact (the MCP pane re-mounting during rapid
resize/navigate; note CSS reflow cannot *create* DOM nodes, so a pure width defect cannot produce a second
skeleton) — **but it is ruled out, not assumed away.** The sweep: render the workspace at several widths
(narrow → ultra-wide) and assert **exactly ONE `nav[aria-label="Editorial skeleton"]`, ONE
`article[aria-label="Document"]`, ONE `region[aria-label="Proof"]`** in the DOM at each. The assertion is
**structural (count the panels), not visual.** **If clean at every width → record as an automated-browser
artifact, closed. If any width doubles the DOM → a real defect: attribute and fix BEFORE the taste-stops**
(the founder judges surfaces; a surface that can double is not ready for judgment).
