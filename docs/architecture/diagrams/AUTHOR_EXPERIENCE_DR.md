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
  `mainContent` (and/or promote the `FrontMatter` slots into ordered content). *Cost:* touches the
  aggregate and **every consumer** — pagination, all three renderers, TOC, `orderByRole`, the mutation
  ops, `bookFacts`; a migration for stored books; broad blast radius. *Risk:* highest; "nothing breaks"
  becomes expensive to guarantee.
- **Option B — a projected read model (RECOMMENDED).** A Domain service projects the immutable `Book`
  into one ordered **`EditorialSkeleton`** — an interface listing every editorial object (front matter,
  parts, chapters, back matter) with `{type, title, place, sourceRef}` — assembled from `mainContent`
  order + `role` tags + `FrontMatter`. The left panel renders THAT one surface; every editing gesture
  maps to an EXISTING mutation (`setPartRole`, `reorderChapters`, `rename`, the create ops) or to D2's
  new front-matter mutation. *Cost:* one new read-model service + its mapping; the model and its
  consumers are untouched. *Risk:* lowest; **ADR-0001 holds by construction (Book immutable), nothing
  that exists breaks.** The "stitch three models" fragility is contained in ONE tested projection, not
  scattered through the panel.

**Recommendation: Option B.** It makes the editorial part a first-class *object the UI and the menu act
on* — the founder's Axis-1 intent — without a risky aggregate migration, honouring "nothing breaks."
**Fallback, decided only if measured:** if a real ordering need appears that the projection cannot
express (e.g., a dedication that must interleave with `mainContent` order rather than compose as front
matter), a **bounded, additive** model extension for that one need — never the full Option-A migration
on spec. The CTO gates A-vs-B.

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
- **The physical-total re-sync policy** (the disclosed P1 approximation): the caller holds `total` from
  a full render; an edit that changes pagination re-syncs on the next full render. The DR decides the
  cadence — a full render on **geometry** changes (theme/layout), region renders on **content** edits
  (the distinction P1's `proofRefreshKey` already exposes) — so the footer's "of N" is never stale
  beyond a content edit's own page delta, self-correcting.
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
Per the corrected non-encombrement law and the gap §5: the **proposal strip** collapses into the
skeleton's own confirm affordances; the **old structure list** goes (the skeleton replaces it);
**`Ready for Print` as a separate station dissolves** — its metadata inputs move **beside the skeleton**
(where they serve the author composing the book), its validation findings surface **in context**; the
**large Layout blocks** become **compact menus**. `Dismiss` (the measured two-opposite-gestures example)
becomes obvious or disappears. **Every removal is a founder decision on the mockups** — the DR proposes
the list; the screenshots settle it.

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
Nothing is built before the founder validates these on captures. The DR commits to producing:

1. **The three-panel workspace (steady state, a real book).** Demonstrates **D** (one legible surface,
   the disappearances realised) and **B** (the "Convert to…" menu on a centre selection). Capture: a
   populated skeleton left, a chapter open centre, the Proof re-inking right.
2. **The edit→re-ink loop (a before/after pair).** Demonstrates **A** and **C**: an edit in the centre,
   the right-panel region re-inking in place, scroll/zoom held. The capture must show the *same page*
   before and after, the gaze preserved — the felt proof of the P1 engine wired.
3. **The populated skeleton on import (the entry door).** Demonstrates the differentiator: a raw DOCX →
   the suggesters' filled skeleton, three-gesture scaling. Shows an empty/degenerate object surfaced as
   incomplete with the gentle collapse offer (**D8**).
4. **Add-a-type (dedication / preface).** Demonstrates **D2**: the add gesture, the composed section,
   and its tri-format render — the dead field filled end to end.
5. **Theme selection by rendered page.** Demonstrates **D5**: real-page thumbnails, the separator and
   chapter-opening shown as theme-controlled, the three title treatments — the founder's taste-stops.
6. **The navigation map.** Demonstrates **Principle 4 / §4**: the station set after the merges, each
   page's one object, the paths — "distributed, not scattered."

Each mockup is annotated with the criterion it answers and the removals it embodies, so the founder
judges the *frame*, not just the pixels.

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
