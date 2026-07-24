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
| **`Overview` as a first-class landing** (re-judged, §4) | → **candidate removal**: does the workspace open directly? If Overview's facts (word count, progression, next action) find homes in the workspace, the landing goes; else it stays | **founder call** |

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
- **Overview** is re-judged: does a first-class landing still earn its place, or does the workspace
  open directly? A Principle-1 removal candidate for the founder.
**Each page one object; each path legible.** The mockups prove "distributed but not scattered."

## §5 The mockups to produce (the founder's gate) — what each must demonstrate against A–D

**PRODUCED (2026-07-24): `mockups/author-experience-mockups.html`** — the six mockups below, built in the
studio's own palette (both themes) with real corpus content (*Faith Alone*), each carrying the three CTO
gate additions (finding-in-context on the Title-Page object; the provisional-total costume as founder
options; the D8 empty-chapter case as its own image). Assembled for the founder's judgment via the CTO;
**construction is not scoped until his validation on the captures.**

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
1. **CTO gates the decisions (§3–§4) — this document.** Especially D1 (A vs B), D2's v1 scope, D7's
   removal list, and D4's re-sync cadence.
2. **Then the mockups (§5) are produced and the founder validates them on captures** — Principle 4's
   screenshot loop, the same discipline every taste decision in this project has used. Removals need his
   explicit yes (Principle 1).
3. **Only then is construction scoped** (likely as its own sequence of gated commits, each with its
   real-fixture verification and the founder taste-stops D5/D6 name). **Nothing before his images.**

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

**This DR stops at the decisions for the CTO's gate. No mockups, no code until the CTO gates §3–§4 and
the founder validates §5 on captures.**
