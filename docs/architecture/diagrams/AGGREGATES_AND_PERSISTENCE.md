# Aggregates & Persistence — Level 1 Design Review

**Status:** 🟡 **ROUND 1 — DRAFT. Not approved. No branch, no storage code.** 6 open questions, each with a recommendation and its reasoning.
**Date:** 2026-07-18
**Trigger:** CTO's question after the Domain models landed — *"Quel est l'agrégat racine ?"* — plus a suspicion that `Book` already carries two responsibilities. Both are addressed below; the first is answered differently from the CTO's own intuition, with reasons.

---

## 1. The `Book` conflation — confirmed, with proof

**The suspicion was right.** `BookMetadata` mixes two different lifetimes, and one field settles it beyond argument:

```ts
edition?: string;   // ← a "book" that has an edition field is trying to be one edition
```

Sorting the existing fields by what they actually belong to:

| Belongs to the **work** (stable across renditions) | Belongs to a **rendition** (differs per edition/language/format) |
|---|---|
| `title`, `subtitle`, `author` | **`isbn`** — a hardcover, paperback and ebook of one work each require a *distinct* ISBN |
| `description`, `keywords` | **`language`** — the French and English editions are the same work |
| `authorEmail`, `authorWebsite` | **`edition`**, `publicationDate`, `coverImage` |
| | `publisher`, `copyright`, `license`, `rights` — can differ by territory |

**The ISBN point is not a matter of taste.** ADR-0035 already recorded that KDP requires an ISBN per format. So this system *already knows* renditions differ — while its model puts the ISBN on the thing they share. The CTO's three examples (FR/EN/ES; pocket/hardback/illustrated; 2026/2028 editions) all describe **one work, several manuscripts**, and today's model cannot express that at all.

**Recommendation: record the conflation, do not split it yet.**

Splitting `Book` into `Book` + `Manuscript` today would be speculative: nothing in the product creates a second language or edition, and this project's own restraint precedent — *"a field is added when a real caller needs it, not in anticipation"* — has held since Sprint 5. Building the abstraction before the second case exists means guessing at where the seam goes, and the guess is usually wrong.

**What must be done now, because it is nearly free and expensive later:** make the eventual insertion *additive*. Specifically, `Project` should reference its content through a single field that can later become a collection, and nothing outside the Domain should assume `project.book` is the only manuscript. Question 3 covers this.

---

## 2. The aggregate root — where I disagree with the CTO's intuition

The CTO proposed:

```
Workspace → Projects → Books → Versions → Publication Events
```

**As a containment hierarchy this is exactly right. As an aggregate boundary it would be a serious mistake, and the distinction is the whole point of the question.**

An aggregate in DDD is a **consistency and locking boundary**, not a folder structure. Making `Workspace` the root has three consequences that only appear under real use:

1. **Unbounded size.** Loading a workspace loads every project, every book, every version. An author with forty projects loads forty manuscripts to open one.
2. **Guaranteed contention.** Every edit to any book takes a lock on the whole workspace. The moment Sprint 14 adds collaboration, two people editing two different books block each other — for no reason.
3. **No natural invariant to enforce.** An aggregate exists to protect a rule that must hold atomically. There is no rule that spans two projects. There are several that span one.

**Recommendation: `Project` is the aggregate root. `Workspace` is not an aggregate at all.**

```
Workspace  ← a scope: tenancy, ownership, a query filter. NOT a transactional boundary.
   │  (projects reference it by id; it does not own them)
   ▼
Project ═══════════ AGGREGATE ROOT ═══════════
   ├── Book (+ later, Manuscripts)   ← no identity outside its project
   ├── BookVersion[]                 ← snapshots
   ├── ProjectAsset[]                ← cover, fonts
   └── PublicationEvent[]            ← append-only log
```

**Why `Project` and not `Book`:** `Book` has no meaningful existence outside a project. You cannot version it, publish it, or name it without the project's context. An entity that is never referenced independently is not an aggregate root.

**The invariants `Project` genuinely protects — and this is the test that decides it:**
- A `BookVersion`'s number is sequential *within its project*. Nothing outside can allocate one.
- A `PublicationEvent` may reference a `versionId`, which must exist *in this project*.
- Restoring a version replaces `book` and `settings` together — a half-applied restore is corruption.
- Deleting an asset must not silently break a version that referenced it.

Every one of those spans exactly one project and nothing more. That is the definition of the boundary.

**What this costs, stated honestly:** a Project containing a large book plus fifty versions is itself large. Question 4 addresses that, and it is a real problem — but a bounded one, unlike a workspace.

---

## 3. Open Questions — For CTO Decision

### Question 1 — Is `Project` the aggregate root, and is `Workspace` a non-aggregate scope?
**Recommendation: yes to both**, for the reasons in §2. `Workspace` need not exist as a type until multi-user or licensing requires it (Sprints 14–16); until then a project simply has no workspace, and adding `workspaceId?: string` later is additive.

### Question 2 — Are versions part of the aggregate, or their own?
**Recommendation: part of it — but stored separately (see Question 4).**

They belong to the aggregate because version numbering is a project-level invariant. But an aggregate boundary is about *consistency*, not about what a query returns: a repository may legitimately load a project without materialising fifty snapshots.

### Question 3 — What changes now to keep `Manuscript` additive later?
**Recommendation: one rule, no new types.** Nothing outside the Domain may reach into `project.book` directly; all access goes through the Domain service. Then inserting `Manuscript` later changes one layer instead of every caller.

Also recommend **not** adding `manuscripts: Manuscript[]` speculatively — a collection with exactly one element forever is a lie the code has to keep telling.

### Question 4 — How are large aggregates loaded without loading everything?
**Recommendation: a `ProjectSummary` read model** — id, name, cover reference, updated date, publication state — for the library view, with the full aggregate loaded only when a project is opened. Versions load on demand.

**Why this matters more than it looks:** the library screen is the most-visited view in the product and needs almost none of the data. Loading full aggregates to render a grid of titles is the performance mistake that gets made once and lived with for years.

### Question 5 — What is actually stored: the DOCX bytes, the `Book` AST, or both?
**Recommendation: both, for different reasons.**

- The **AST** is the working state — `Book` already declares itself SERIALIZABLE, so this is free.
- The **original upload** is the only true source. Import is lossy today (ADR-0025: mammoth drops underline; ASTBuilder cannot recover ISBN/description/cover). Discarding the original means a future import-pipeline fix can never be applied retroactively to existing projects.

Storing only the AST would permanently freeze every project at the fidelity of the importer that first read it.

### Question 6 — Which store?
**Recommendation: defer, and spike first** — per ADR-0019/0020/0030/0035's precedent, which has now caught a wrong assumption five times.

**But the shape is already constrained by the answers above**, and a spike should test exactly this: one aggregate loaded and saved whole, a cheap summary projection for the library, and blob storage for assets and original uploads that does not bloat the aggregate. SQLite, Postgres and a document store can all satisfy that; the choice should follow a real measurement, not a preference.

---

## 4. Risks

1. **Splitting `Manuscript` too late is expensive; too early is speculative.** §1 chooses "too late but cheap to insert" — the mitigation is Question 3's access rule, and it only works if it is actually enforced.
2. **The aggregate-root decision is the hardest to reverse in this document.** Getting it wrong surfaces as lock contention under concurrent use, which is precisely when it is most costly to change.
3. **`ProjectSummary` is a second representation of the same data** and can drift from the aggregate. Deriving it on read is safer than maintaining it on write until measurement says otherwise.
4. **Persisting original uploads has a real cost** — a 25MB ceiling per file, times every version an author keeps.
5. **Deletion is unspecified.** Deleting a project with published events destroys the record of a real publication. This needs an explicit answer before storage exists, not after.

---

## Related

- `docs/architecture/diagrams/PRODUCT_OBJECT_MODEL.md` — the approved model this reviews the persistence of
- ADR-0041 Constraint 2 — the stateless prerequisite this unblocks
- ADR-0035 — KDP requires an ISBN per format, the evidence behind §1's conflation finding
- ADR-0025 — mammoth's lossy import, the reason Question 5 keeps original uploads
- `backend/src/domain/models/Project.ts`, `ProjectService.ts` — the models this constrains
