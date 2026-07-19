# Product Experience 1.0 — Design Review

**Status:** 🔵 **ROUND 2 — ARCHITECTURALLY APPROVED (CTO, 2026-07-19: "La revue est approuvée sur le plan architectural… le centre du logiciel est désormais clairement le livre"). Development remains gated on ONE more review: `VISUAL_LANGUAGE.md` (the identity — the CTO's "dernière itération consacrée au langage visuel"). §10 below folds in the CTO's round-2 additions. Zero code until VISUAL_LANGUAGE is validated.**
**Date:** 2026-07-19
**Trigger:** the CTO's product verdict after the studio shipped: *"Vous êtes en train de construire un excellent moteur. Vous n'êtes pas encore en train de construire un logiciel Premium."* Backend 9.8, Domain 9.7, PDF engine 9.5, code 9.8 — **UI/UX Premium 5.5, Expérience 5, Produit 6.** The engine is far ahead of its interface. This review designs the product itself: not UI, not CSS, not components — the software.

**Scope note, said once:** this review **is** Sprint 10 (UX & Workflow) being designed, absorbed forward by CTO direction. It supersedes the remains of `UI_FOUNDATION.md`'s Commit 8 restyle and builds on `HOME_WORKSPACE.md` §0 (stations, Home/Workspace split, the journey), which it keeps and deepens rather than replaces.

---

## 0. Philosophy — the sentence everything else derives from

> **The author works on their book. The studio handles everything else — and shows that it is.**

Five principles, each traceable to a CTO problem (§9 maps all ten):

1. **The book is the center.** Not a pipeline, not a menu of tools — the software is organized around *one author's book*, and every zone answers a question about it. Opening a project must produce the Affinity feeling: *"je travaille sur mon livre"*, never *"je suis dans une démonstration technique."*
2. **Every pixel works.** Density is a feature. A zone with nothing to say shows the book's real facts (pages, words, readiness, history) rather than void. The engine measures a great deal — the interface has been throwing that wealth away.
3. **Show state, not steps.** The author navigates less when they can *see* more. Status is ambient: readiness in the Explorer, facts in the Inspector, progress in the header, engine truth in the status bar.
4. **The engine's power must be visible.** This product embeds real fonts, measures real pages, splits paragraphs typographically, validates against Amazon's actual rules, versions every publication. Today nothing shows it — "un utilisateur pourrait croire que c'est une simple application Web." Surfacing measured facts *is* the premium signal, and it costs no invention: the numbers exist.
5. **Premium = trust, and trust = hierarchy + nuance + honesty.** Five visual weights, layered neutrals instead of black/gray/white, and the product's existing habit of telling the truth (real FAIL reports, honest empty states) kept intact — a premium skin over dishonest data would be the worst trade available.

---

## 1. The CTO's architecture questions, answered

**Quel est le centre du logiciel ?** The **Book**, held by its Project. Concretely: the Workspace's default view is no longer a station — it is the **Book dashboard** (§4.2): état, progression, readiness, dernière publication, prochaine action. Stations become *views of the book* opened from the Explorer.

**Quelles zones sont permanentes ?** Six, never recreated: **Header** (context + primary actions), **Navigation rail** (spaces), **Explorer** (the project's objects), **Workspace** (contextual main view), **Inspector** (contextual facts), **Status bar** (engine truth). §2 specifies each.

**Qu'est-ce qui ne change jamais ?** The six zones' existence, position and roles; the Explorer's object taxonomy; the header's project context; the status bar's engine facts. An author who learns the studio once never relearns it.

**Qu'est-ce qui est contextuel ?** The Workspace's content and the Inspector's content — both driven by the Explorer selection, under one contract: *every Workspace view declares its Inspector content; the Inspector is never empty* (fallback: the book's summary).

**Quelle est la densité visuelle cible ?** §3's rules: no view under ~70% useful content at desktop; action cards ≤ ~120px unless their content requires more; every list slot that could be empty has a defined real-data fallback.

**Quels panneaux doivent être dockables ?** None in this generation — **collapsible and resizable, not dockable** (§6). Reasoned, not dodged.

**Le parcours d'un auteur sur 6 mois ? Plusieurs livres ouverts ? Comparer deux versions ? Publier multi-cibles sans dupliquer ?** §5, each with today's honest floor and the target.

---

## 2. The six permanent zones — contracts, day-one content, growth slots

```
┌────────────────────────────────────────────────────────────────────────────┐
│ HEADER   studio · project · saved-state · version · [Export] [Publish]     │
├──────┬──────────────────┬──────────────────────────────────┬───────────────┤
│ NAV  │ EXPLORER         │ WORKSPACE                        │ INSPECTOR     │
│ rail │ the project's    │ the contextual main view         │ contextual    │
│      │ objects, as a    │ (Book dashboard by default)      │ facts +       │
│      │ tree with status │                                  │ actions       │
├──────┴──────────────────┴──────────────────────────────────┴───────────────┤
│ STATUS   engine truth: backend · version · pages · words · last export     │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Header — "on sait immédiatement où on travaille"

Day one, all real: product name (compact, not a hero) · **project name** · saved-state indicator (● Saved — honest: server-held since Decision 6; becomes autosave's surface in S12) · current **version count** · primary actions **Export** and **Publish** (the two things an author ships with) · Home. Growth slots, in place but only when real: Search (when an index exists), Account (S15 cloud), collaborators (S14). The CTO's exact sketch, minus what would be fictional today.

### 2.2 Navigation rail — spaces, not tools

A thin icon rail for *spaces*: **Home**, **Workspace** (current project), **Publishing** (cross-project publication view — becomes real the day two projects publish), **Settings**. Deliberately small: spaces are few and stable; the *Explorer* is where richness lives. "Projects" and "Library" collapse into Home until the library outgrows one screen — inventing two near-empty spaces would be dashboard-thinking.

### 2.3 Explorer — the domain's objects, with ambient status

The CTO's requirement: un explorateur, pas un menu technique. The tree **is the Domain model**, which is why it can be real on day one:

```
▼ Faith Alone                      ← the project
  ▼ Book
      Structure        15 parts    ← real chapters/sections tree (expandable)
      Styles           Classic     ← the theme + its resolved fonts (real)
      Images           3           ← real image blocks
  ▼ Production
      Layout           KDP 6×9     ← current preset
      Validation       ⚠ 2        ← real rule findings, not just a number
      Preview          214 p.      ← last measured RenderMetrics count
      Exports          PDF·EPUB·DOCX
  ▼ Record
      Publications     1 · KDP
      Versions         14
```

Every node: real object, real count, click → Workspace view + Inspector facts. Nodes with nothing yet (Images 0) show their zero **as information**, not as absence. This replaces the flat station list — the stations survive as the *views* the tree opens.

### 2.4 Workspace — contextual, dense, book-first

Default = **Book dashboard** (§4.2). Other views per Explorer node (§4.3–4.8). Rule inherited from `HOME_WORKSPACE.md`: one view at a time, guidance as status.

### 2.5 Inspector — "il devient vivant"

The contract (the CTO's sixth problem): contextual to the selection, never empty, facts + micro-actions, all real:

| Selected | Inspector shows (all measured/stored today) |
|---|---|
| Book / default | title, author, words, real pages (last metrics), language, source file, updated |
| Layout | trim (mm + inches), margins, **bleed and gutter status (honest: "gutter: not yet applied — ADR-0043")**, KDP compliance range |
| Validation | score by category (structure/metadata/typography/accessibility), top finding, "fix next" |
| Preview | measured page count, layout+theme in force, staleness, generation time |
| Publish | destination, ISBN presence, cover presence, last attempt + result |
| Version (in History) | number, label, date, settings captured, publication link |

### 2.6 Status bar — the engine, visible

Left: backend state, app version. Right, the power made ambient: `214 pages · 39,913 words · PDF 598 ms · fonts embedded`. Real numbers the pipeline already produces and currently discards at the door of the UI.

---

## 3. Density, hierarchy, and the premium visual language

### 3.1 Five weights, enforced

**Primary** (the one thing this view is for) → **Secondary** (its actions) → **Information** (facts) → **Metadata** (counts, dates) → **Context** (ambient status). Every element in every view gets classified during implementation; two adjacent elements of the same weight must justify it. This kills "tout est affiché avec le même poids."

### 3.2 Density rules

- A view is **≥ ~70% useful** at 1280px; the void-filling content is always *real* (facts, history, findings) — density by information, never by decoration.
- Action cards ≤ ~120px (the CTO measured Export at ~300px; it is three buttons and a title).
- Every potentially-empty slot has a defined fallback: History empty → the timeline still shows *Import* (createdAt is an event); Publish never shows a lone button → it shows readiness + destinations + history columns (§4.7).

### 3.3 Color and nuance — direction now, taste with the CTO

The current palette (noir/gris/blanc) reads as a dev tool. Direction locked here; exact values are an approval loop on real screenshots with the CTO (taste is theirs):

- **Layered neutrals**: 4 surface levels (canvas, panel, raised, overlay) in a *warm* neutral ramp — paper-adjacent, this is a **publishing** tool; the UI should feel like a print shop, not a terminal.
- **One working accent** for primary actions and selection (candidate territory: a deep editorial blue or ink-teal — decided on screenshots, not in prose).
- **Semantic hues kept** (success/warn/error) but tuned to the neutral ramp.
- Typography: the UI adopts a real face at last (the Geist removal left system fonts); scale with 5 sizes matching the 5 weights. The *book preview* keeps the theme's own faces — the product's typography and the book's typography are different things and must visibly differ.

Token plan: extend `app-*` (surface-0..3, accent, accent-contrast) — the Commit-2 token layer was built for exactly this second act.

---

## 4. The views, redesigned — every region fed by real data

### 4.1 Home
Keeps `HOME_WORKSPACE.md`'s contract, densified: project cards get a **cover tile** (real cover asset when present; else a typographic tile from title/author — generated, not faked), real stats, activity from real events. No change of concept — Home was right; it was thin.

### 4.2 Book dashboard — the new center (the CTO's sketch, realized)

```
Faith Alone                                    ● Ready for Print: ⚠ 2 items
─────────────────────────────────────────────────────────────────────────────
ÉTAT               PROGRESSION                DERNIÈRE PUBLICATION
214 pages          39,913 words               KDP · FAIL · hier
15 chapters        Score 92/100               → missing ISBN, no cover
Classic · KDP 6×9  4 categories detailed      PROCHAINE ACTION
                                              Add an ISBN (Metadata)
─────────────────────────────────────────────────────────────────────────────
ACTIVITÉ (timeline, most recent first — real events)
```

"Prochaine action" is **derived from real findings** (highest-severity fix), not an AI promise — the Editorial AI slot (S18) plugs in here later.

### 4.3 Layout → presets, not radios
Each of the 6 real layouts becomes a visual preset card: **mini-thumbnail rendered by the real engine** (first page at that trim, cached by settings-hash), real dimensions in mm + inches, real audience notes from `KDPRuleData` (trim, bleed, margin band). The KDP presets carry their platform badge. Selection is visual; the radio dies.

### 4.4 Themes → a gallery that tells the truth
Same card model — **but the registry holds one theme.** The gallery ARCHITECTURE ships with one real card (Classic, real rendered thumbnail) and the theme roadmap becomes explicit product work: designing Elegant/Novel/Academic is *content*, scheduled as its own effort. Seven fake cards would violate the product's spine. (This is the review's most honest constraint; the CTO's list becomes the theme backlog.)

### 4.5 Preview → living
The button dies. Preview regenerates on settings change: debounced, cancellable, stale-shown-dimmed-while-regenerating. Feasibility is measured, not hoped: full pipeline ≈ 600ms on the large fixture (ADR-0041) — acceptable for a debounced background refresh now; S13 (Performance) owns making it instant (incremental render). The Preview view shows the PDF large (the document IS the workspace, Affinity-style) with page navigation; facts move to the Inspector.

### 4.6 Validation → "Ready for Print"
The 8 real rules and 4 real score categories reorganize into the CTO's checklist:

```
Ready for Print                              Professional Score  92
──────────────────────────────
✓ Structure        ✓ Headings       ✓ Typography     ✓ Hyperlinks
⚠ Metadata (2)    ✓ Images         ✓ Styles         ✓ Compliance
```
Each ⚠ expands to its findings with a "fix" affordance (deep-link to the relevant view/field when editable; the ISBN field arrives with metadata editing — flagged as the first *editing* capability the product needs). The bare "60/100" dies.

### 4.7 Publish → an architecture, not a button
Four columns, all real today, built for the multi-target future the Sprint-8 `RuleProvider` port already prepared:

```
READINESS (from last      DESTINATIONS          HISTORY            LAST ERROR
validation, per artifact) KDP  [Validate]       (real attempts,    (most recent
✓ PDF · ✓ EPUB · ⚠ cover  — more arrive with    versions linked)   FAIL detail)
                          their RuleProviders —
```
Only KDP renders today (the only real provider). The *layout* is the promise; empty destination rows are not shown — the column grows as providers land (Kobo etc.), with **shared readiness**: one validation, N destinations read it. That is "sans dupliquer le travail" made structural.

### 4.8 History → a timeline that tells the story
Grouped by day, newest first, from real events: import (createdAt), settings changes (updatedAt deltas — recorded going forward), versions, publications with outcomes. "No versions" dies — a project one hour old already has a story ("Aujourd'hui — Importé depuis Guide.docx · Validation 92 · Aperçu généré"). Compare-versions v1: side-by-side of captured settings + metrics (page counts, scores); content diff is S12's.

---

## 5. The journeys

- **Créer** : Home → import → **Book dashboard** (not a station) — the first screen after import already reads like a book being worked on.
- **Reprendre (l'auteur des 6 mois)** : open → dashboard answers in five seconds: where it stands, what changed, what to do next. *Honest dependency: this journey is a lie until persistence (S11) — this review makes S11 urgent, not optional.*
- **Publier multi-cibles** : validate once → readiness object → each destination consumes it (§4.7).
- **Restaurer / comparer** : timeline → version → Inspector facts → restore (Domain's `restoreVersion` exists; UI lands with S12) · compare = settings+metrics side-by-side now.
- **Plusieurs livres ouverts** : MRU project switcher in the header (real, cheap) now; true multi-tab workspaces deferred to the editor era (S10+) — tabs over view-only workspaces would be ceremony.

## 6. Dockability — decided against, for this generation

Affinity's docking serves *hundreds* of panels; we have two contextual zones with disciplined contracts. Docking costs a windowing framework and buys nothing until panel count grows. **Collapsible + resizable** Explorer/Inspector now; revisit when a real editor multiplies panels (or an Electron shell lands). Recorded so it is a decision, not an omission.

## 7. Implementation staging (after CTO validation — nothing before)

| Phase | Delivers | Depends on |
|---|---|---|
| P1 | Shell v2: header context, nav rail, Explorer, Inspector frame + contracts, status-bar facts | nothing new |
| P2 | Book dashboard · Ready-for-Print · Layout presets (real thumbnails) · theme card | P1 |
| P3 | Living preview · Publish architecture · History timeline | P2; perf note §4.5 |
| P4 | Premium pass: palette (CTO screenshot loop), UI typeface, density audit, five-weights sweep | P1–P3 |

Each phase: full baseline recapture (restyle window open by CTO order), axe re-baseline, demo script updated once at P3. Persistence (S11) should run **in parallel from P2** — §5's core journey needs it.

## 8. Open questions — for the CTO

**Q-A — Palette direction:** warm paper-adjacent neutrals (my recommendation — a publishing tool should feel like print, differentiating from every gray dev-tool) vs cool graphite premium (the Affinity/DaVinci family)? Decided on real screenshots in P4's loop, but the *direction* steers P1.
**Q-B — UI typeface:** one workhorse sans (Inter/Geist class) for the UI, serif reserved to book content (my recommendation), or a serif-led identity? Same screenshot loop.
**Q-C — Theme backlog:** the gallery ships honest with Classic alone; do we schedule theme *design* (Elegant, Novel, Academic…) as its own sprint-level effort? My recommendation: yes, after P2 — themes are product content, not UI chrome, and each needs real typographic design.

## 9. The CTO's ten problems → where each is answered

| # | Problem | Answered in |
|---|---|---|
| 1 | On sent le développeur, pas l'auteur | §0, §4.2 (book dashboard as center) |
| 2 | Tout est séparé; l'auteur travaille sur son livre | §1, §2.3, §4.2 |
| 3 | Le logiciel paraît vide | §3.2 density rules, §4.7, §4.8 |
| 4 | Cartes trop grosses | §3.2 (≤120px), P4 audit |
| 5 | Sidebar pauvre, menu technique | §2.3 Explorer (domain objects) |
| 6 | Panneau droit insuffisant | §2.5 Inspector contract |
| 7 | Header faible | §2.1 |
| 8 | La puissance invisible | §0 P4, §2.6, §4.3 thumbnails, living preview |
| 9 | Couleurs de dev-tool | §3.3 |
| 10 | Pas de hiérarchie visuelle | §3.1 five weights |

## 10. Round 2 — the CTO's additions, adopted

### 10.1 Daily Author Workflow — the missing 95%

The CTO is right that the review over-weighted the ship-path (import → validate → publish) and under-weighted where an author actually lives: *reprendre, chercher, corriger, changer, prévisualiser*. The daily loop, now first-class:

```
Open studio → last project resumes WHERE THE AUTHOR LEFT IT (view + Explorer selection persisted)
   → the dashboard's "what changed / next action" orients in 5 seconds
   → find: Ctrl+K palette or Explorer search jumps to any chapter/image/finding by name
   → fix: finding → deep-link → (editing surfaces as they land) → proof re-inks itself
   → leave: nothing to save, nothing to close — the studio remembers.
```

Requirements this creates: **per-project UI state persisted** (view, selection, scroll — client-side now, project-attached at S11), **Explorer filter/search**, and **resume-where-left** as a hard P1 behavior. The 6-month author (§5) is this loop, iterated.

### 10.2 The engine becomes helpful, not just visible — actionable findings

Every finding gains the CTO's three-part shape: **consequence · action · destination.**
`ISBN absent` → **"Cannot publish to Amazon — an ISBN is required. → Add ISBN (opens Metadata)."**
Contract: validation findings carry an `action` (label + deep-link); the UI never shows a bare defect again. "Corriger automatiquement ?" is admitted only where a fix is genuinely mechanical and reversible — none qualify **today** (honest), and the first candidates (e.g. margin presets) will each name themselves in their own commits. This contract is also the Editorial AI's future socket (S18) — the AI will *propose into* this shape, not invent a new one.

### 10.3 Expert hands — shortcuts and the command palette

Keyboard-first, P1: **Ctrl+K** command palette (actions + objects: chapters, findings, versions — the Radix Dialog's starring role), **Ctrl+1..6** views, **Ctrl+P** Proof, **Ctrl+E** Editions, **Ctrl+Shift+P** Publish, **Ctrl+H** History, `?` shortcut sheet. Every palette entry is a real action — the palette is generated from the same registry the menus use, so it can never lie.

### 10.4 Header v3 — the room's state at a glance
`Faith Alone · ● Saved · v12 · ⚠ Ready for Print (2) · Exported 2 min ago · [Editions] [Publish]` — readiness and last-export join the header as ambient truth. Nothing opens; everything is known.

### 10.5 Timeline at working granularity
History narrates the session, not just the milestones: settings changes, proofs, editions, checks — timestamped to the minute. Requires a real **project event log** (Domain: append-only `ProjectEvent`, written by the actions themselves) — designed with S11/S12 persistence so history survives restarts; until then the timeline shows what the aggregate already knows (import, versions, publications) *without faking the rest*.

### 10.6 Explorer, deepened — the living inventory
Counts the AST already holds, now surfaced: chapters, **citations (quote/scripture blocks), footnotes, tables, images** under Structure; an **Assets** group (fonts actually embedded — real from the theme registry; images; the source manuscript). The Explorer becomes the place where the author *sees their book's body*.

### 10.7 Theme architecture, complete — with one honest resident
Full gallery architecture in P2 (cards, real engine-rendered thumbnails, selection, per-theme Inspector facts) shipping with Classic alone — plus an explicit, *designed* empty slot: "More themes are being set — Classic is the first." The architecture invites; the content backlog (Elegant, Novel, Academic…) is scheduled as design work (Q-C), never mocked.

### 10.8 The biggest absence, named: `EDITOR_EXPERIENCE.md`
The editor is the future core and gets its own full review — writing surface, chapter navigation, inline styles vs theme discipline, autosave semantics, and Writing/Focus modes' final form. Scheduled to open **alongside P3**, so the premium shell and the editor's design mature together without blocking each other. Nothing editor-shaped is mocked before it.

---

## Related

`HOME_WORKSPACE.md` (the navigation layer this deepens), `UI_FOUNDATION.md` (tokens + primitives this builds on; its Commit-8 restyle superseded here), ADR-0039 (Sprint 10 UX — this review is its design), ADR-0041/ADR-0046/ADR-0047 (the persistence urgency §5 raises), ADR-0043 (the gutter honesty in §2.5), `PUBLISHING_ENGINE.md` Decision 7 (the RuleProvider port §4.7 finally makes visible), `docs/product/PERSONAS.md` + `USER_JOURNEYS.md` (to be reconciled to §5 at P3).
