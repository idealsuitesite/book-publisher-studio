# Project Lifecycle — Archiving and Deletion — Level 2 Design Review

**Status:** 🟡 **ROUND 1 — DRAFT. Not approved. No branch, no code.**
**Date:** 2026-07-18
**Trigger:** `AGGREGATES_AND_PERSISTENCE.md` Risk 5, flagged in the port itself when `ProjectRepository` was written:

> deleting a project with publication events destroys the record of a real publication that actually happened. Until that is decided, implementations should treat this as a genuine delete and callers should not offer it in the UI.

**This review must close before the storage spike (Question 6), not after.** Whether the product distinguishes archiving from deletion determines whether the schema carries a nullable `archivedAt` and whether every listing query filters. Deciding it after a store is chosen means a migration over real author data — the one class of change this project has no way to rehearse.

---

## 1. Objectives

Answer three things and stop:

1. What happens to publication history when an author deletes a project.
2. Whether deletion and archiving are one operation or two.
3. What the persistence port must expose for either — as narrowly as possible.

Out of scope: undo/trash retention windows, per-user quotas, and anything requiring accounts. Those belong to Sprint 14 (Collaboration) and Sprint 16 (Licensing), and deciding them here would lock choices against requirements that do not exist yet.

---

## 2. Current state — evidence, not assumptions

**`delete()` is a genuine, immediate delete.** `InMemoryProjectRepository.delete()` calls `Map.delete`. Nothing is retained, nothing is filtered, no state survives.

**The aggregate boundary means deletion is total.** `Project` holds `versions`, `publications`, and `assets` — including, since commit `75728c1`, the `'source'` asset carrying the **original uploaded DOCX**. Deleting a project therefore destroys the author's own source document, not merely derived data.

**Nothing calls `delete()` today.** Confirmed by grep across `backend/src` — the only callers are its own tests. **No UI path reaches it.** This is why the question can still be answered cheaply: there is no existing behaviour to preserve and no stored data to migrate.

**Publication events are already append-only and already record failures** (`ProjectService.recordPublication`). The history this review is protecting is real, structured, and complete.

---

## 3. The actual problem: one word covering two intentions

Framing this as "keep history or destroy it" is what makes it look unresolvable. The real finding is that **two different user intentions currently share one verb**:

| The author means | Frequency | What they expect |
|---|---|---|
| "This is finished — get it out of my way." | common | It stops cluttering the library. Nothing is lost. |
| "This was a mistake — remove it." | rare | It is genuinely gone, including the file I uploaded. |

Serving both with a single destructive `delete()` fails the common case badly: an author tidying a finished, published book loses the record that they published it. Serving both with a single soft delete fails the rare case in a worse way — data the author believes erased persists indefinitely, which is a liability, and every query must then remember to filter or it leaks.

**Once the two intentions are separated, the dilemma mostly evaporates.** Archiving absorbs the common case, and the publication record survives because *the project survives*. Deletion stays a real deletion and stays honest.

---

## 4. Proposed decisions

### Decision 1 — Archiving and deletion are two distinct operations

**Archive** — reversible. Sets `archivedAt`. The project leaves the library view; versions, publications, assets and source are untouched. Restorable.

**Delete** — irreversible. Removes the whole aggregate, source DOCX included.

### Decision 2 — Deletion is not blocked, however much history exists

A published project can be deleted. The project belongs to the author, and refusing on the grounds that they published something once is paternalism dressed as data stewardship. Amazon holds its own record of what was published; ours is a convenience for the author, not a ledger they owe us.

This also keeps the product defensible under a right-to-erasure request. A "delete" that quietly retains is the shape that causes real trouble later.

### Decision 3 — Archiving is a state change on the aggregate, so **the port gains no method**

```ts
// ProjectService
archive(project: Project): Project    // sets archivedAt
restore(project: Project): Project    // clears it
```

Persisted through the existing `save()`. No `archive()` on `ProjectRepository`, no second table, no lifecycle knowledge in the persistence layer.

**That this works without widening the persistence boundary is itself evidence about the aggregate decision.** A lifecycle change that required new port surface would have suggested the boundary was drawn wrong; this one is absorbed by whole-aggregate save exactly as `AGGREGATES_AND_PERSISTENCE.md` §2 predicted.

### Decision 4 — Only `list()` changes, and archived projects are excluded by default

```ts
list(options?: { includeArchived?: boolean }): Promise<ProjectSummary[]>;
```

Default-exclude is the safe direction: a caller that forgets the flag shows too few projects, which is visible and reported. Default-include would leak archived projects into every library view, which looks like a bug in the archive feature rather than in the caller.

`ProjectSummary` gains `archivedAt?: Date` so a caller listing with `includeArchived` can distinguish them without loading aggregates.

### Decision 5 — Before a deletion that destroys successful publications, offer the record as an export

A small, self-contained file the author keeps: title, targets, dates, outcomes.

**We own the offer, not the retention.** This is what makes Decision 2 sit right — the history is not lost to the author, it stops being ours to hold. It also avoids the pattern where a product justifies indefinite storage as being "for the user's benefit".

The export is a *prompt*, never a precondition. An author who wants the thing gone must be able to get it gone.

### Decision 6 — Deletion requires typed confirmation only when publications exist

A draft with no publication events deletes on a normal confirm. A project with successful publications requires typing its name.

Friction proportional to what is actually lost. Uniform friction trains authors to click through it, which is how the safeguard stops working on the one project where it mattered.

---

## 5. Open questions — for CTO decision

**Question 1 — is `archivedAt` sufficient, or is a `status` enum better?**
*Recommendation: `archivedAt?: Date`.* It answers "archived?" and "when?" in one field, matches `createdAt`/`updatedAt` already on the model, and adds no state machine. A `status` enum invites unbounded growth (`draft`/`active`/`archived`/`published`/`trashed`) where `published` is already derivable from the event log and would then have two contradictory sources.

**Question 2 — should archiving be automatic after a period of inactivity?**
*Recommendation: no.* An author who has not opened a manuscript in six months has not abandoned it — long gaps are normal in book writing. Software that tidies away a work in progress on its own is software the author stops trusting with the next one.

**Question 3 — should deleting be offered in the UI at all before persistence exists?**
*Recommendation: yes, once this review is approved.* With `InMemoryProjectRepository`, everything is lost on restart anyway; the greater risk is shipping a library with no way to remove a mis-imported file, which forces a server restart as the workaround.

**Question 4 — what happens to a project's `'source'` asset on archive?**
*Recommendation: retained, unchanged.* Archiving loses nothing by definition, and the source exists precisely so a future importer fix can be reapplied (`AGGREGATES_AND_PERSISTENCE.md` Question 5). Dropping the largest asset on archive would quietly make archiving lossy — a different operation than the one described to the author.

---

## 6. Risks

1. **`archivedAt` is a filter every future query must respect.** Sprint 11 (Workspace) and Sprint 14 (Collaboration) both add project queries; each is a chance to forget it. Mitigation: default-exclude (Decision 4), and a repository test asserting archived projects never appear in a default `list()`.
2. **Authors may use archive as a trash and expect deletion.** If archiving is presented as "Remove", storage grows without bound and consent is muddled. Mitigation: the UI must name the two operations by what they do — *Archive* and *Delete* — never a shared euphemism.
3. **This review commits to real deletion before a real store exists.** A future store with backups or replicas makes "genuinely gone" harder than `Map.delete`. Mitigation: this is an explicit input to the storage spike — backup retention becomes a selection criterion rather than a discovery.

---

## 7. Commit plan

| # | Scope |
|---|---|
| 0 | This review, approved. New ADR recording archive-vs-delete and the pre-spike sequencing. |
| 1 | `Project.archivedAt`, `ProjectService.archive()`/`restore()`, `ProjectSummary.archivedAt`, tests. |
| 2 | `list()` options + default-exclude; `InMemoryProjectRepository` honours it; the Risk-1 regression test. |
| 3 | Publication-record export (Decision 5), Domain-side, format-agnostic. |
| 4 | UI: distinct Archive and Delete, typed confirmation when publications exist (Decision 6), export offered. |

Commit 4 depends on `Project` being wired into the import pipeline — currently unstarted. If that has not happened, commits 0–3 still stand alone and leave the port correct for whenever the UI arrives.

---

## Related

`AGGREGATES_AND_PERSISTENCE.md` Risk 5 (the flag this closes) and §2 (the aggregate boundary Decision 3 relies on), `ProjectRepository` (the port comment to be replaced on approval), ADR-0001 (immutability — `archive()` returns a new Project like every other operation), ADR-0041 (persistence prerequisite; this review is sequenced before its spike), `PRODUCT_OBJECT_MODEL.md` (Project as the unit of work).
