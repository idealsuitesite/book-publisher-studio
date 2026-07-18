# Product Object Model — Level 1 Design Review

**Status:** ✅ **APPROVED (2026-07-18).** All 7 questions resolved by CTO go-ahead, taking each recommendation as locked. §3 records them as decisions; the reasoning behind each is preserved verbatim rather than summarised, because that reasoning is what a future contributor needs.

**What this approval authorizes, and what it does not.** The Domain models — `Project`, `BookVersion`, `PublicationEvent`, `ProjectAsset` — are authorized now: they are pure, testable, and depend on nothing. **Persistence is not authorized by this document.** Question 5 amends Sprint 7 Decision 2 *in principle*; which store, and the migration/backup/deletion semantics that come with it, still needs Sprint 11's own Level 2 review and a spike, per this project's spike-before-decide discipline (ADR-0019/0020/0030/0035). Building models first is deliberate: it is what Sprint 8 did with ports and models before any implementation, and it means the persistence review will have a real shape to design against rather than an imagined one.

**Date:** 2026-07-18 (round 1 drafted) / 2026-07-18 (approved)
**Trigger:** CTO product review after using the software on a real manuscript. Their own stated priority: *"Je ne développerais pas d'abord de nouvelles fonctionnalités. Je commencerais à réfléchir au modèle objet du produit."*

---

## 1. The problem, stated plainly

The software today is an excellent **pipeline** and not yet a **product**.

A user sees `Import → Structure → Validation → Layout → Preview → Export`. What they do not see is *"I am working on **Le Guide de Jean**."* There is no project, no library, no history, no version — because the object the whole system is built around is a **file**, and a file is not what an author works on.

Every request round-trips a DOCX buffer. Close the tab and everything is gone. That was a deliberate, correct decision for Sprint 7 (Decision 2, stateless), and it is the reason the product cannot yet grow.

**This is not a call to rewrite.** The Domain layer is sound and reusable: the `Book` AST, three renderers, `ValidationEngine`, `LayoutEngine`, `TypographyResolver`, the Publishing Engine, 405 real tests. What is missing sits *above* it. Introducing `Project` does not invalidate `Book`; it gives `Book` somewhere to live.

---

## 2. Current State — Evidence, Not Assumptions

**Confirmed by reading `backend/src/domain/models/Book.ts`:** `Book` already has `id`, `metadata`, `frontMatter`, `mainContent`, `backMatter`, `createdAt`, `updatedAt`, and — notably — **`version: number`**, commented *"For tracking changes"*. Nothing anywhere reads or increments it. The concept was anticipated and never built.

**Confirmed:** `Book.ts`'s own header declares the model **IMMUTABLE** ("transformations return new instances") and **SERIALIZABLE** ("can be saved/loaded to JSON"). Both properties are prerequisites for versioning and persistence, and both already hold.

**Confirmed by `grep` across `backend/src/`:** no database, repository, session or cache. Persistence is not merely absent — it is forbidden by Sprint 7 Decision 2, held without exception through Sprints 8 and 9 (ADR-0041 Constraint 2).

**Confirmed:** `BookMetadata` carries `title`, `author`, `isbn`, `coverImage`, `publisher`, `publicationDate`, `edition`. These are **book** properties, already modelled. The UI currently presents *layout* and *theme* as workflow steps instead of properties — the CTO's observation, and the model already disagrees with the UI.

**Confirmed:** `FrontMatter`/`BackMatter` (title page, copyright page, TOC, bibliography, glossary, index) are fully typed and **entirely unconsumed** by any renderer except `frontMatter.toc`. A large part of what a professional publishing tool must edit is already modelled and unreachable.

**Confirmed:** the frontend is one route (`app/page.tsx`). There is nowhere to navigate because there is nothing to navigate between.

**A real bug already fixed, which this review should learn from:** filenames were decoded as latin1, so `supplémentaire` became `supplÃ©mentaire` and propagated into the title, the AST, every export, and the KDP report. It reached that far because **the filename was standing in for a title that no object owned**. A `Project` with a real, user-set name would have contained the blast radius.

---

## 3. Open Questions — For CTO Decision

### Question 1 — What is a Project, and does it contain one book or many?

**Recommendation: a Project contains exactly one Book, and is the unit of identity, naming and ownership.**

**Reasoning:** the alternative (a Project as a folder of many books) sounds more flexible but buys nothing today and costs clarity — every screen would need to answer "which book?" before it can show anything. A one-to-one Project↔Book keeps the mental model *"a project is the book I am working on, plus everything around it."* Box sets, series and multi-volume works are real, but they are a **Collection of Projects**, addable later without changing this relationship.

**The distinction that matters:** `Book` stays the *content* (AST, chapters, metadata). `Project` is the *work* — name, cover, assets, versions, publication history, settings. Layout and theme become Project-level settings, which is exactly the CTO's observation that they are properties, not steps.

### Question 2 — Does a Book have versions, and what is a version *of*?

**Recommendation: yes — a Version is an immutable snapshot of the `Book` AST plus the settings used to produce it.**

`Book.version: number` already exists, unused. `Book` is already immutable and serializable. The pieces are in place.

**Why the settings must be part of the snapshot:** reproducing an export a year later requires knowing the layout, theme and typography of the day, not today's. A version that stores only content cannot reproduce its own PDF.

**Deliberately recommended against:** full document history with diffs and branching. That is a version-control system, and this product is not one.

### Question 3 — Is a Publication an event or a state?

**Recommendation: an event. `Project.publications` is an append-only log.**

**Reasoning:** "state" cannot answer real questions an author asks — *when did I publish to KDP? which version? did the Kobo one succeed?* A book can be published to several platforms, at different times, from different versions, with different outcomes. A single `status` field flattens all of that into a lie.

This also fits the Publishing Engine already built: `PublishingReport` carries `generatedAt`, `duration`, `target` and `status` — an event record in all but name (ADR-0037). Making publication an event means storing reports rather than inventing a parallel concept.

**Current state is then derived, not stored:** "published to KDP" is *the most recent successful KDP publication event exists*.

### Question 4 — Where do assets live?

**Recommendation: assets belong to the Project, not to the Book, and are referenced by id rather than embedded.**

Today a cover would be a base64 string inside `BookMetadata.coverImage`. That does not survive contact with reality: a 300 DPI print cover is megabytes, and embedding it in every AST serialisation makes every version snapshot enormous.

A `ProjectAsset` (cover, fonts, illustrations) with the `Book` holding references keeps versions small and lets one asset be reused across versions.

**This is where the `Packaging`/`PublishingBundle` work from Sprint 8 already points** — it assembles `{manuscript, cover, metadata, assets, manifest}`, and `assets` is currently always empty precisely because nothing owns them.

### Question 5 — Does this supersede Sprint 7 Decision 2 (stateless), and how far?

**This is the load-bearing question. Nothing else in this review can be built without answering it.**

**Recommendation: amend rather than abandon.** Persist Projects, Versions, Assets and Publication events. Keep every *operation* stateless — import, render, validate and publish remain pure functions of their inputs, exactly as now. What changes is that their inputs and outputs are stored rather than discarded.

This preserves what Decision 2 actually bought (no session affinity, no server-side scratch state, trivially restartable) while removing what it costs (nothing survives a page refresh).

**Deliberately unanswered here:** *which* store. That belongs to Sprint 11's Level 2 review, with a spike, per this project's own spike-before-decide discipline (ADR-0019/0020/0030/0035).

### Question 6 — Does the interface become multi-page, and driven by what?

**Recommendation: yes — and navigation should mirror the object model, not the pipeline.**

The current single page is, as the CTO put it, a prototype of the *flow*. The destinations should be the *nouns*:

```
Library  ──▶  Project ──┬── Manuscript   (structure, chapters, content)
                        ├── Metadata     (title, author, ISBN, description)
                        ├── Design       (layout, theme, cover)
                        ├── Review       (validation findings, interactive)
                        ├── Preview      (page / spread / e-reader / print)
                        └── Publish      (targets, history)
```

**Why nouns rather than steps:** a pipeline is linear and finished; a book is returned to. An author who wants to fix the ISBN three weeks later should not re-enter at "Import" and walk forward.

The existing `ProgressStepper` does not disappear — it becomes a *readiness indicator* on the Project, which is what it already truly measures.

### Question 7 — Does Review become interactive, and what does that require?

**Recommendation: yes, and it is cheaper than it looks.**

The CTO's example — `⚠ ISBN manquant → Corriger` — needs one thing the system does not have: a link from a finding to the place that fixes it. `ValidationIssue` already carries `code` and `location`. A mapping from `code` to a destination (`MISSING_ISBN → Metadata`) turns a report into an assistant.

**The honest constraint:** this only works once metadata is *editable*, which requires Question 5's persistence. Today `ASTBuilder` cannot populate `isbn`/`description`/`coverImage` from a DOCX at all (Risk 4, disclosed since Sprint 5) — so every real import reports them missing with no way to supply them. **That is the single most valuable thing this model unlocks**: an author could finally fix the findings the software has been reporting since Sprint 5.

---

## 4. What this does *not* change

Stated explicitly, because "reprendre depuis la racine" was on the table and the answer is no:

- `Book` and the whole AST — unchanged, and now owned by something
- All three renderers, `ThemeEngine`, `TypographyResolver`, `LayoutEngine` — unchanged
- `ValidationEngine` and its 8 rules — unchanged; its findings become actionable
- The Publishing Engine, ports and `KDPTarget` — unchanged; reports become history
- 405 backend tests — should still pass, and are the safety net for all of the above

The new layer sits above the Domain and depends on it, never the reverse (ADR-0037's rule, applied one level up).

---

## 5. Risks

1. **This is the largest architectural change since Sprint 1.** Sequencing must be strict — model first, persistence second, UI third. Building UI against an unsettled model is how the current single page happened.
2. **Persistence introduces everything a stateless system never had:** migrations, backups, corruption, concurrent edits, deletion semantics, and — once Licensing exists — ownership disputes.
3. **Scope is the real threat.** Library, versions, assets, publication history and interactive review are five products. Sprint 11 should ship the smallest complete slice: create a project, open it, edit metadata, keep it after a refresh.
4. **The `Book.version` field is a trap.** It exists, is unused, and looks like it means what Question 2 proposes. Whoever implements versions must decide deliberately whether to use it or supersede it, not assume.
5. **Professional output quality** — the CTO's request for documents matching what a well-driven `docx` library produces — is a *renderer* concern, largely independent of this model. It should be scoped separately rather than absorbed here, or it will be lost inside a persistence sprint.

---

## 6. Recommended sequence

Not a commit plan — a sprint ordering, for CTO decision:

| Sprint | Work | Gate |
|---|---|---|
| 10 (UX) | Design the navigation and journeys **against this model**, no code | Model approved first |
| 11 | `Project`/`Version`/`Asset` Domain models + persistence spike + the smallest complete slice | Question 5 answered |
| 12 | Versions, autosave, recovery | 11 shipped |
| — | Interactive Review, editable metadata | needs 11 |
| — | Preview modes (spread, e-reader, print) | independent, can slot anywhere |
| — | Professional output quality | independent renderer work, scope separately |

**Sprint 9 (UI Foundation) continues as approved.** Its primitives — `Button`, `Card`, `Alert`, `Input`, `Select` — are exactly what a multi-page product needs, and none of them assume a single page. Commit 4 onward remains valid.

---

## Related

- `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` — the Level 1 engine map this sits beside
- ADR-0041 Constraint 2 — the stateless prerequisite Question 5 must resolve
- ADR-0039 — the reordered roadmap this proposes refining
- `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` Decision 2 — the decision Question 5 amends
- `docs/architecture/diagrams/PUBLISHING_ENGINE.md` — `PublishingReport` as the event record Question 3 builds on; `PublishingBundle.assets`, empty because nothing owns assets (Question 4)
- `backend/src/domain/models/Book.ts` — `version: number`, unused since Sprint 1 (Question 2, Risk 4)
- `docs/product/PERSONAS.md`, `USER_JOURNEYS.md`, `WIREFRAMES.md` — Sprint 7 product docs to reconcile against this model in Sprint 10
