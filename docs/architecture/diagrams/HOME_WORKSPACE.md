# Home & Workspace — the Entry Experience — Level 2 Design Review

**Status:** ✅ **ROUND 2 — APPROVED for implementation (CTO, 2026-07-19: "Tu as mon feu vert pour implémenter tes choix en prenant en compte mes réflexions"). Round 2 incorporates the CTO's three reflections — the pipeline metaphor, the Home/Workspace separation, and the navigation-first framing — as §0 below.**
**Date:** 2026-07-19
**Trigger:** the CTO's product judgment after real use: *"Vous ne construisez pas un convertisseur DOCX → PDF. Vous construisez un Book Publisher Studio."* The current screen — a title and a drop zone — reads as a technical demo, not a professional tool. The instruction is explicit: rebuild the entry architecture so it can evolve for years, rather than polishing an import page that will be replaced entirely.

This review answers the CTO's four functional questions in order, then derives structure from the answers — never the reverse.

---

## 0. Round 2 — the navigation review (CTO reflections, answered)

### "Est-ce que le pipeline vertical est encore la bonne métaphore ?" — No, and here is precisely why

The vertical pipeline was the right metaphor for what the product *was*: a **conversion** — one input, one pass, one output, done. A project tool is not a conversion; it is a **place the user returns to**. Three properties of the pipeline break under that shift:

1. **A pipeline implies completion.** Steps imply an end state, but an author revisits Validation after editing, regenerates Preview after a layout change, publishes twice. There is no "done" to walk toward — there is a book to work on.
2. **A pipeline implies order.** The stepper enforces a sequence that stops being true after the first pass: on reopening a project, the user's next action is *whatever the book needs*, not "step 1".
3. **A pipeline grows vertically without bound** — the CTO's own observation. Validation, Layout, Preview, Publish are each becoming screens; stacked, they already outgrew one page (the Import-panel fix was the first symptom, treated locally; this is the systemic treatment).

**The replacement metaphor: stations, not steps.** The Workspace shows ONE section at a time — Manuscript, Validation, Layout, Preview, Publish, History — selected from the workspace navigation. What the pipeline got *right* (guidance for a first pass) survives as **status, not sequence**: each station shows its state in the nav (validation score, layout chosen, preview generated, publications count), so a new project still reads naturally top-to-bottom while nothing is ever locked. Guidance without a straitjacket. The `ProgressStepper` retires; its job is absorbed by station status.

### "Home et Workspace : deux contextes complètement différents" — adopted as the review's sharpest line

| | **Home** answers | **Workspace** answers |
|---|---|---|
| Question | *Quels projets ? Que fais-je aujourd'hui ? Que viens-je de publier ?* | *Sur quel livre je travaille ?* |
| Object | the **library** (many projects) | **one book** |
| Never shows | any book's content | any other project |
| URL | `/` | `/projects/:id` |

The round-1 draft still let import's results render where import happened — a Home concern bleeding into Workspace. Corrected: **import lives on Home and ends with a redirect**; everything about the imported book (structure, validation, all of it) is Workspace, reached by navigation, never inlined into Home.

### The complete journey — every arrow real, every future sprint with a slot

| Journey step | URL | Backed by (today) | Future sprints that plug in here |
|---|---|---|---|
| Open the studio | `/` | `GET /api/projects` | Cloud login (S15), Licensing (S16) |
| Import → project created | `/` → redirect | `POST /api/manuscripts/import` (ADR-0047) | Autosave adopts the project (S12) |
| Open a project | `/projects/:id` | `GET /api/projects/:id` (**built by this review**) | Collaboration presence (S14) |
| Manuscript station | section | book from the project aggregate | the real editor (S10 UX) |
| Validation station | section | validation **computed on read** from the stored book | Editorial AI (S18+) |
| Layout station | section | `PATCH /api/projects/:id/settings` (**built**) | more themes/layouts |
| Preview station | section | `POST /api/projects/:id/export` (**built**) | incremental preview (S13 perf) |
| Publish station | section | `POST /api/projects/:id/publish` (**built**) | more targets (Kobo…), real submission |
| History station | section | versions + publication log from the aggregate | Versions UX (S12), restore |
| Back Home | `/` | navigation | — |

**The durability decision underneath the table (Decision 6, new): Workspace operations run from the STORED project source, not from a browser-held `File`.** Today's Preview/Export re-upload the just-imported file — which works only in the session that imported it and would silently break "Continuer". The project retains its source bytes precisely so work can resume (`AGGREGATES_AND_PERSISTENCE.md` Q5); these endpoints are that retention finally earning its keep. This is the "logique, durable" architecture the CTO asked for: the browser holds an id, the system holds the book.

*Section navigation is client-side state within `/projects/:id` this round; deep-linkable per-section URLs (`/projects/:id/validation`) are a mechanical upgrade recorded for the sprint that first needs to share such a link.*

---

## 1. The four functional questions, answered

### Q1 — Quel est le premier objet du logiciel ?

**The Project — and this is already true everywhere except the screen.** `PRODUCT_OBJECT_MODEL.md` (approved) made the project the unit of work; ADR-0047 wired it in: **every successful import already creates a real `Project`**, retains its source, and `GET /api/projects` already lists the library. The Domain, Application and Presentation-API layers all know the first object is a project. **The UI is the last layer that still believes the first object is a DOCX.** This review is not inventing a concept — it is letting the screen catch up with the architecture.

### Q2 — Quelles sont les premières actions de l'utilisateur ?

Grounded in what the backend really does today, no fiction:

| Action | Backed by | Notes |
|---|---|---|
| **Importer un manuscrit** (= créer un projet) | `POST /api/manuscripts/import` (creates the project, ADR-0047) | Today, import IS create. The button says what the user gets: a new project. |
| **Continuer un projet récent** | `GET /api/projects` (real) + `GET /api/projects/:id` (**to build** — the port's `findById` exists, no route yet) | The one real gap this review scopes. |
| ~~Créer un projet vide~~ | nothing | **Deliberately absent.** No Domain path creates a bookless project; offering the button would be the first fictional screen. It arrives when a real editor (Sprint 10+) can fill an empty book. |

### Q3 — Quelles informations doivent être visibles dès l'ouverture ?

Everything below comes from **one existing endpoint** (`GET /api/projects` → `ProjectSummaryDTO[]`) — visible information is exactly the information the system already holds:

- **Projets récents**: name, book title, author, version count, `updatedAt` — the summary read model built for precisely this (`AGGREGATES_AND_PERSISTENCE.md` Q4).
- **Dernières publications**: `publishedTargets` per project — derived server-side from the real publication log, failures excluded.
- **Statistiques**: N projets, Σ versions, cibles publiées distinctes — client-side folds over the same payload. No stats endpoint is invented for numbers a list already carries.

**Disclosed limitation, on the surface it affects:** the store is in-memory (ADR-0047) — the library empties on restart. The Home must not hide this: an empty library shows the honest first-run state ("Importez votre premier manuscrit"), which doubles as the restart state until Sprint 11 wires SQLite (ADR-0046). A fake-persistent look would be the lie this project doesn't tell.

### Q4 — Comment préparer le futur sans créer d'écrans fictifs ?

**The rule that resolves the tension: zones are structure, screens are features. The shell's zones all exist from day one; a screen exists only when a real endpoint feeds it.** The CTO asked for both permanence of zones *and* no fictional screens — this is how both hold:

| Shell zone | Day-one content (all real) | What arrives later, without restructuring |
|---|---|---|
| **Header** | identity (name + tagline), global action (Importer) | account/cloud (Sprint 15), collaboration presence (14) |
| **Navigation** | Studio (home) · the active project | Projects list view, Versions (12), Publications |
| **Workspace** | Home (library) or the current import→export flow | the real editor (Sprint 10 UX), per-project workspace |
| **Properties** | *collapsed/absent on Home*; on a project: the real `ProjectSettings` (layout/theme — real, stored since ADR-0047) | metadata editing, version panel |
| **Status bar** | backend reachability (real `/api/health`), app version (real `VERSIONS.md` value) | sync state (15), background jobs (13) |

Nothing in the table requires a placeholder screen: every named future arrival lands **inside an existing zone**. That is the CTO's "architecture d'interface qui pourra évoluer pendant plusieurs années", made concrete.

---

## 2. Proposed decisions

### Decision 1 — The Home is the project library, and the import flow becomes a destination, not the identity

`/` renders: identity block, the two real actions, recent projects, publications, statistics — the CTO's own sketch, restricted to real data. The current stepper flow (import → structure → validation → layout → preview → export) moves intact under the shell as the **project workspace** — it is not rebuilt, it is *re-homed*. Reaching it: "Importer un manuscrit" (new project) or "Continuer" (existing project, via the new `GET /api/projects/:id`).

### Decision 2 — An `AppShell` layout component owns the five zones

Header / Nav / Workspace / Properties / Status as a real layout component (CSS grid), with the zone rule from Q4. Left-aligned application layout, not centred landing-page layout — the CTO's "penser application, pas page web". Built on the existing `ui/` primitives and tokens; no new dependency.

### Decision 3 — `GET /api/projects/:id` is the review's one backend addition

`ProjectRepository.findById` exists and is tested; the route, controller and a `ProjectDTO` (aggregate → transport, versions/publications summarized, asset **bytes never serialized** — ADR-0046 measured what embedded blobs cost) are the missing Presentation slice. "Continuer" hydrates the workspace from the stored project: book structure, settings (layout/theme restored as the stored `ProjectSettings` — they were made real properties for exactly this moment).

### Decision 4 — The Demo Script and baseline are superseded, by explicit CTO direction, at the restyle window

`UI_FOUNDATION.md` §8 made the unchanged Demo Script a hard constraint and Commit 8 the first restyle commit. This redesign **is** that restyle, CTO-ordered. Consequences owned up front: `PRODUCT_DEMO.md` gets a new script (launch → Home → import → workspace → export → return to Home → library shows the project), the baseline is recaptured to the new screens, and both changes land in the same commit series as the UI they describe — Decision 3 of `UI_FOUNDATION.md` is amended by this review, not silently bypassed.

### Decision 5 — Accessibility inherits, not regresses

The shell's zones map to landmarks (`header`, `nav`, `main`, `aside`, `footer`/status) — the axe baseline's standing `region` violations (41 nodes) should *fall* when panels acquire real landmarks. The Sprint 9 Commit 4 primitives (Dialog/Menu/Tooltip) find their first product consumers here (project actions menu, destructive-action confirmations when they arrive).

---

## 3. Open questions — for CTO decision

**Q-A — does the workspace URL encode the project (`/projects/:id`) now, or stay stateful?**
**✔ LOCKED: `/projects/:id` now** (CTO feu vert, 2026-07-19; §0's journey table depends on it). Deep-linking a project is what makes the browser's back button, refresh and future collaboration links work; retrofitting URLs onto a stateful workspace is the expensive order. The id is meaningless after a restart today — disclosed, and fixed by Sprint 11, not by avoiding URLs.

**Q-B — French or English UI text?**
**✔ LOCKED: English** (CTO, 2026-07-19: the product will serve far more anglophones than francophones).

*The original recommendation said French, and it was wrong twice over — recorded rather than edited away.* It reasoned from "the CTO writes French" instead of from the market, and it missed evidence already in the codebase: **the existing UI is entirely English** ("Import complete", "Generate Preview", "Validation" — grep-confirmed). French-now would have meant translating an English UI into French for a majority-anglophone audience, then translating it back when i18n arrives.

What this decision does **not** touch, stated so it never gets conflated: **UI language ≠ manuscript language.** The product's handling of French (and every other) manuscript content is governed by the Unicode invariant and is unaffected — an anglophone UI publishing *Le Guide de Jean* flawlessly is exactly the product. French becomes the **first translation target** when a real i18n layer arrives (locale files, a later sprint); until then the discipline that keeps that retrofit mechanical is simply consistent sentence-case English strings living in components, which is already the codebase's habit.

**Q-C — does the Properties zone render on Home at all?**
**✔ LOCKED: no** — absent on Home, present in the Workspace (CTO feu vert, 2026-07-19; §0's context separation makes this a corollary, not a style choice). An empty right rail on a library screen is dead space wearing a zone's name; the zone's *slot* in the grid exists either way, which is all the evolution needs.

---

## 4. Risks

1. **This is the sprint's restyle budget, spent.** After it, Commits 6–7 (nav shell, responsive) partially merge into this work — the commit plan below reconciles with `UI_FOUNDATION.md`'s rather than running two plans.
2. **The in-memory library will read as a bug** ("my projects vanished"). Mitigated by the honest empty state (Q3) and by Sprint 11's priority already being persistence.
3. **`GET /api/projects/:id` returns an aggregate** — the first endpoint to do so. The DTO must summarize versions (count + labels, not full book snapshots) or a 45MB aggregate (ADR-0046's measurement) walks onto the wire.

---

## 5. Commit plan (after approval — the CTO's message asks for the review first; implementation follows their go)

| # | Scope |
|---|---|
| 0 | This review approved; `UI_FOUNDATION.md` Decision 3 amendment recorded (ADR). |
| 1 | `AppShell` (five zones, landmarks) + routing; current flow re-homed under it unchanged. |
| 2 | Home: identity, real actions, recent projects + publications + stats from `GET /api/projects`. |
| 3 | Backend: `GET /api/projects/:id` + `ProjectDTO`; "Continuer" hydrates the workspace. |
| 4 | Status bar (health + version); Properties zone in workspace showing real `ProjectSettings`. |
| 5 | New Demo Script in `PRODUCT_DEMO.md`; baseline recaptured; axe re-baselined; docs reconciled. |

---

## Related

`PRODUCT_OBJECT_MODEL.md` (the object this UI finally surfaces), ADR-0047 (import creates a project — the fact making Q1 real), `AGGREGATES_AND_PERSISTENCE.md` Q4 (the summary read model the Home consumes), ADR-0046 (why the aggregate DTO must not carry blobs; the persistence this UI's honesty depends on), `UI_FOUNDATION.md` §8 + Decision 3 (the constraints Decision 4 supersedes with attribution), ADR-0039 (UI Sprint 9 / UX Sprint 10 split — this review straddles the boundary deliberately, as the CTO's instruction reprioritizes the entry experience "avant d'ajouter de nouvelles fonctionnalités").
