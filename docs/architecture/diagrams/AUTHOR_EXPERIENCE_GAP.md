# AUTHOR_EXPERIENCE — the gap cadrage (measurement report, stops at the constats)

**Date:** 2026-07-23 · **Status: GAP CADRAGE — CTO VERDICTS RENDERED (§8, 2026-07-23). Still NO design,
NO production code — the DR does not open until P2 then P1 are built.** Étape 1 of the CTO directive:
measure what the product already has and what is really missing, across the seven axes; design nothing.
All measured **read-only** against `main @ febf427`. The founder's projects are untouched. **The
verdicts inverted the CTO's own sequence: P2 (`BATCH_CONFIRM_LATENCY`) then P1 (incremental render)
are now built BEFORE the Design Review — one does not draw a promise the engine cannot hold (§8).**

**The governing principle (founder, §1):** *the book is an editorial structure, not a sequence of
pages.* The author manipulates objects he understands — a preface, a dedication, a chapter, an
afterword — never pages or settings. **Our model already carries this architecture; what is missing
is the screen that shows it.** This cadrage measures exactly how true that last sentence is, axis by
axis.

**The four acceptance criteria (founder, verbatim — the gate a mockup must pass, §2):** A. Fluidity
(everything instant, no screen feels technical); B. Contextual editing (the menu changes with the
selection, very little noise); C. Preview (the render always visible, every change appears
immediately); D. An impression of simplicity over a very sophisticated engine.

---

## §3 The seven-axis gap table

### Axis 1 — A typed editorial skeleton (the left panel)
- **Exists.** `EDITORIAL_CATEGORIES` (frontend/lib/editorialParts.ts) — 17 canonical names EN+FR,
  each with a front/back placement. `classifyEditorialTitle` matches a top-level title's leading
  segment. `computeBookFacts` (bookFacts.ts) already **excludes** editorial parts from the chapter
  count and lists them present/absent, recognising a part **either** by canonical title **or** by a
  `role` tag. `setPartRole` sets `role: 'front' | 'back'` (export placement via `orderByRole`).
- **The gap.** The recognition is **presentation-only, a LABEL not a role** (MINI_DR_EDITORIAL_PARTS,
  re-confirmed): it drives a count and a panel, it never makes an object. And the skeleton is split
  across **three** representations — chapters live in `mainContent`, editorial parts are *recognised*
  in `mainContent` by title, front matter (title page, copyright) lives in `FrontMatter`, and the
  typed `FrontMatter` slots (dedication, preface, foreword, introduction, acknowledgments) are
  **typed-but-dead** (Book.ts, unbuilt/unrendered — see Axis 2). **There is no single model surface
  that IS "the editorial skeleton"** — Title Page · Copyright · Dedication · TOC · chapters ·
  Acknowledgments · About the Author — as first-class, navigable, reorderable objects. The left panel
  needs one representation; today it would have to stitch three.

### Axis 2 — Adding an editorial type that composes itself
- **Exists.** `FrontMatterBuilder` composes a **title page** and a **copyright page** from
  `book.metadata` (existing entries always win; a field emits only when its metadata exists).
  `editFrontMatter` edits those two. `setPartRole` + `orderByRole` place a tagged part front/back.
- **The gap.** *"Add a preface"* has **no path.** `FrontMatterBuilder` builds only title/copyright;
  **dedication / preface / foreword / introduction / acknowledgments are typed in `FrontMatter` but
  no builder fills them and no renderer draws them** — measured: `DOCXRenderer`/`EPUBRenderer`
  consume `front.titlePage` and `front.copyrightPage` only (+ the auto-TOC). So a type cannot
  **self-add** (no mutation to insert a front-matter section) nor **self-compose** (no builder, no
  render path). The nearest workaround — a chapter tagged `role: 'front'` — is a numbered chapter in
  the front, not a composed preface.

### Axis 3 — Number / title separation (mostly there)
- **Exists — more than expected.** `Chapter.number` is computed by position (`renumberChapters`),
  `Chapter.subtitle` is shipped, and `CHAPTER_TITLE_PRESENTATION` is engraved (the number is a datum,
  never text). **The Structure station ALREADY separates them**: it renders a static `Chapter
  {number}:` prefix beside an `EditableTitle` field (StructureEditor.tsx:573-574) — the author edits
  the title, never the number.
- **The gap.** Two things, both screen-side, not model-side: (1) the layout is **inline in a list
  row** (`Chapter 1:` beside the field), not the founder's measured pattern of a **non-editable
  header with the editable title-field below it** in a document-centric surface; (2) the three
  `CHAPTER_TITLE_PRESENTATION` treatments (number-then-title / title-only / large-name) are a
  **theme** decision with no author-facing chooser yet. The model is ready; the editing surface is not.

### Axis 4 — Conversions from the selection ("Convert to…")
- **Exists.** `promoteToChapter` (paragraph → chapter), `promoteToSubsection` (in-chapter marker →
  section), `mergeChapterIntoPrevious` (chapter → back into the previous), `collapseMarker` (empty
  marker → collapsed), `setPartRole` (front/back/main), `rename`, `markAsSubtitle`/`clearSubtitle`,
  `insertPartOpener`/`removePartOpener`, `setCallout`, `editFrontMatter`. Together these already cover
  a real "Convert to…": make-chapter, make-section, merge-up, collapse, set-placement, retitle,
  make-subtitle.
- **The gap.** Three conversions have **no op**: (1) **make-this-a-Part** — `insertPartOpener` inserts
  an *empty divider*, there is no "convert this heading into a Part opener"; (2) **split at the
  cursor** — every create op splits at a whole *block*; there is no mid-paragraph or arbitrary-point
  split; (3) **insert a new element** — no mutation adds content that was not imported (a new
  dedication, an image, a pull-quote, a preface): the create ops only *carve* from existing blocks.
  So "Convert to…" is well-covered; **"Insert…"** barely exists.

### Axis 5 — Themes as systems (a system already, chosen by name)
- **Exists.** `Theme` carries, together: `fonts` (heading + body), `fontSizes` (h1–h6, body, small),
  `colors` (text, accent), `spacing` (paragraph, heading, lineHeight, title before/after), a full
  `runningHead` presentation, `presentation.dropCap` (scope + derived scale), `presentation.callout`
  (tint). Three resident themes (Classic/Modern/Novel), a per-project `accentOverride` and
  `typographyOverride` that are colour/preset-only and **R2-free** — personalisation that already
  **cannot destroy the theme** (proven both ways). So a theme genuinely controls titles, drop caps,
  body, headers and callouts **at once** — it is a system, not fifty knobs.
- **The gap.** Two: (1) two theme dimensions the founder names are **not** yet theme-driven — the
  **ornamental separator** is a per-block `Divider.style` (line/space/asterisks), not a theme value,
  and the **chapter first-page** style has no theme field (only the structural `ownsBarePage`; opener
  typography is a consigned deferral); (2) **selection is by NAME** — the Layout station picks a theme
  from a labelled list; there is **no real-page thumbnail** (engine-rendered preset thumbnails are a
  long-standing deferred candidate). The founder wants to choose a graphic language on a rendered page,
  not a word.

### Axis 6 — Per-element settings (partly modelled, partly blocked)
- **Exists in the model.** `Paragraph` carries `align` ('left'|'center'|'right'|'justify'), `style`
  ('normal'|'first'|'hanging' — first-line indent / hanging), `spaceBefore`/`spaceAfter`/`lineHeight`,
  `dropCap`, `keepWithNext`/`keepLinesTogether`. `Theme.spacing` holds the body/heading/line spacing.
  `RunningHead` holds header/footer presentation. `Divider.style` holds three ornamental separators.
- **The gap, and the hard link to `TYPOGRAPHY_QUALITY`.** **Justification** — `align: 'justify'`
  exists but **0 of 4,374 real blocks carry it** (TYPOGRAPHY_QUALITY_SCOPE: ragged-left "decided by
  nobody"); **hyphenation is ABSENT from the model entirely.** The CTO has already ruled these ONE
  decision (the body justifies, with real-dictionary hyphenation, a full DR) — so **exposing
  justification/hyphenation per element is blocked behind `TYPOGRAPHY_QUALITY`**, not a UI question.
  Indentation-vs-spacing is modelled per-paragraph but spacing is theme-level (a per-element spacing
  override would be new). Headers/footers are theme-level (`RunningHead`), not per-element. Separators
  exist per-block but are not offered.

### Axis 7 — Living preview: the HARD prerequisite (criterion A is unreachable by drawing alone)
- **Measured cost.** The living Proof (`PreviewPanel`) re-runs the **entire pipeline on the whole
  book** on every `settingsKey` change: 500 ms debounce → `exportProject(id, 'pdf')` (a full
  server-side render, ~600 ms on the large fixture, ADR-0041; the founder's measured "several seconds"
  = debounce + ~730 ms export + full `<embed>` reload of a 114-page PDF) → the **entire** `<embed>` is
  replaced. **There is no incremental rendering** — the whole book is regenerated and the whole
  preview reloaded for a one-word change. And each structure confirmation **persists the whole ~1.1 MB
  aggregate** and re-fetches (`BATCH_CONFIRM_LATENCY`, measured this traversal).
- **The gap, named as a prerequisite.** **Criterion A (fluidity, "every change appears immediately")
  and criterion C (preview always visible, instant) cannot be reached by drawing** — they require two
  real chantiers, prerequisites not finishes: **(P1) incremental rendering** (render/repaginate only
  the affected region or the visible page, not the whole book) and **(P2) `BATCH_CONFIRM_LATENCY`**
  (batch persistence / optimistic apply). Without P1 and P2, no mockup can satisfy A — the CTO's own
  ruling, confirmed by measurement.

---

## §4 The acceptance criteria against the measurement

- **A. Fluidity — BLOCKED by prerequisites.** Unreachable until P1 (incremental render) + P2
  (`BATCH_CONFIRM_LATENCY`) exist. The single most load-bearing finding of this cadrage.
- **B. Contextual editing — reachable, and mostly a UI + one recognition-to-role step.** The
  conversions exist (Axis 4); the selection→menu is a UI build; the one real model step is turning the
  editorial *label* into an editable *object* (Axis 1) so the menu can act on it.
- **C. Preview always visible — reachable in placement, blocked in instantness.** The Proof already
  exists and re-inks; making it a permanent right panel is UI, but "every change immediately" shares
  A's prerequisites.
- **D. Impression of simplicity — reachable, and it is the payoff** of the typed skeleton (Axis 1) +
  themes-as-systems (Axis 5) + the disappearances (§5).

## §5 What disappears (founder's decision, restated for the design)
The proposal strip to triage, the old structure beneath the new, `Ready for Print` as a separate
station (its information goes where it serves — the metadata inputs beside the skeleton), the large
Layout blocks (formats become compact menus). Each removal must meet the corrected non-encombrement
law (burden of proof on **keeping**, founder validation on removals — `AUTHOR_EXPERIENCE.md` §1).

## §6 The entry door — our difference, not a feature
The founder's frame: the left skeleton **arrives already filled by our three suggesters** (assist /
cleanup / subchapter) from a raw manuscript. The reference product (Atticus/Vellum) *requires* a
styled Word file; we build what it assumes given. This is measured true this very session — the
founder brought an unstructured DOCX, the assist gave him 23 chapters, cleanup and subchapter did the
rest. The skeleton is not empty scaffolding to fill; it is **populated on import**.

## §7 Verdicts owed (this cadrage stops here)

| Axis | Measured state | Owed verdict |
|---|---|---|
| 1 skeleton | label not role; split across 3 representations | make the editorial part a first-class object — where (unify mainContent + FrontMatter + role)? |
| 2 add-a-type | title/copyright compose; the rest typed-but-dead | build the missing builders + render paths + an "add" mutation, or scope v1 to a subset? |
| 3 number/title | already separated in the Structure list | confirm the document-centre surface + the 3-treatment chooser is the DR's, not new model |
| 4 conversions | "Convert to…" covered; "Insert…" barely exists | is Insert (Part / split / new element) in this chantier or its own? |
| 5 themes | a system already; chosen by name | build page-thumbnail selection + move separators/chapter-open into the theme, or defer? |
| 6 per-element | modelled; justification/hyphenation blocked | confirm Axis 6 waits on `TYPOGRAPHY_QUALITY` (the CTO's standing ruling) |
| 7 preview | whole-book re-render per change | confirm P1 (incremental render) + P2 (`BATCH_CONFIRM_LATENCY`) are prerequisites, sequenced BEFORE the DR |

**Sequence (CTO):** this cadrage → the CTO's verdicts → the Design Review (three panels, the
scaling constraint, the entry-door differentiator) → mockups → the founder's validation on captures →
construction. **Nothing is coded before that.**

---

## §8 CTO verdicts (2026-07-23) — rendered on the §7 table, and a sequence inversion

**The load-bearing move: the sequence is inverted, assumed.** Axis 7's measurement decided the order.
The living Proof re-renders the *whole* book per change; criterion A (everything instant) is **not
reachable by drawing**, and a mockup that promised it would lie. So **P2 then P1 are built BEFORE the
Design Review opens** — a reversal of the CTO's own earlier "DR next" sequence, recorded here because
a reversal that lives only in a conversation is lost. *One does not draw a promise the engine cannot
keep.*

- **Axis 7 — CONFIRMED, prerequisites, and re-ordered: P2 first, then P1.** Both are real chantiers
  sequenced ahead of the DR, each with its **own measured cadrage** first. **P2 = `BATCH_CONFIRM_LATENCY`**
  is the shortest path to the fluidity the founder asks for → its cadrage is `BATCH_CONFIRM_LATENCY_SCOPE.md`
  (done). **P1 = incremental rendering: do NOT presume the form.** "Render only the affected region"
  is *one* hypothesis among several — the visible page only, a progressive first-page-first render, or
  a partial repagination are different candidates with different costs. **Cadrage measured first, as
  always** — P1's shape is not decided here.

- **Axis 1 — the editorial part becomes a first-class object. This is the heart of the chantier.**
  The skeleton is split across three representations and none of them *is* the skeleton; a left panel
  that stitched three models would be fragile and the author would feel it. **Direction: one surface
  carrying the complete editorial order — chapters and parts together, each with a type and a place.**
  *Where exactly* — extend `mainContent` with an editorial type, or introduce a unified view above the
  three — **is the DR's to decide, with the measured cost of each option.** Constraint: **ADR-0001
  holds, the Book stays immutable, and nothing that exists breaks.**

- **Axis 2 — build the missing paths, restricted v1.** "Add a preface" with no path is the most
  visible author-side hole. But five dead types at once is five builders and three renderers. **v1:
  dedication and preface** (the two most asked-for; measured on real books where possible). The rest
  follow the same pattern once proven. **A type that is added must compose AND render tri-format** —
  else it re-creates the dead field it was meant to fill.

- **Axis 3 — CONFIRMED: the DR's, not the model's.** The number/title separation already exists. The
  choice of the three treatments is a **theme** choice with a founder taste-stop.

- **Axis 4 — "Insert" is its own chantier, NOT this one.** Convert covers the current need. Inserting
  a *new* element (a Part, an image, a cursor-point split) is content **creation**, a different nature
  from structuring. **Consigned `INSERT_ELEMENTS`.**

- **Axis 5 — real-page thumbnails: YES, in the DR.** Exactly the founder's formula — the author picks
  a graphic *language*, not fifty parameters; choosing by a *name* betrays that philosophy.
  **Separators and chapter-opening move INTO the theme in the same movement** — a theme that does not
  control its separators is not a complete system.

- **Axis 6 — CONFIRMED, blocked behind `TYPOGRAPHY_QUALITY`.** Nothing to expose before the
  justification-with-hyphenation decision is built.

**Re-engraved sequence (CTO):** cadrage P2 → correctif P2 → cadrage P1 → chantier P1 → the
AUTHOR_EXPERIENCE Design Review (carrying these verdicts) → mockups → founder validation on captures →
construction. **Start with cadrage P2 — the shortest path to the fluidity he asks for.** Push when the
founder is idle.
