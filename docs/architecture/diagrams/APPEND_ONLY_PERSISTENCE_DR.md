# APPEND_ONLY_PERSISTENCE — Design Review (Level 2, option B)

**Date:** 2026-07-24 · **Status: GATED — the CTO granted the gate, one record correction + three amendments
folded in (below); building on `feat/append-only-persistence`.** Scope: **B now, contractually complete;
D (version-log cap) deferred, never folded into B.** A bounded interlude before AUTHOR_EXPERIENCE M3 (M3
resumes on a green judge). Cadrage: `docs/APPEND_ONLY_PERSISTENCE_SCOPE.md`.

> **CTO GATE (2026-07-24) — granted, with a record correction + three amendments (all folded above):**
> - **Record correction:** the founder HAS ruled (option 3 — recent-N undo net + automatic milestones
>   forever, his manual-mark/nudge extension withdrawn). The DR must not say "until he rules": the retention
>   *shape* is ruled; the effective behavior after B is keep-everything only because **pruning is D, deferred**
>   (B ships model support + `N` as a consigned-revisable parameter). **No open founder question remains.** (§2 D5, §8)
> - **Amendment 1 — the append mechanism is EXPLICIT, not inferential** (a dedicated `appendVersion` seam,
>   not diffing), with the **idempotency-under-retry** twin of atomicity tested. (§2 D3, §4)
> - **Amendment 2 — the migration backfills HISTORICAL milestones** (his `v32 "publication"` flagged), asserted
>   in the migration verification. (§5)
> - **Amendment 3 — a read-path positive control:** `getVersion` on a sampled set returns books byte-identical
>   to v1's eager load captured PRE-migration, licensing the lazy path against the old truth directly. (§6)

## §0 Mandate — the measured problem

The AUTHOR_EXPERIENCE M2 live loop exposed, and the Option-3 probe on the founder's **real store**
(read-only, on a copy) confirmed: the render engine is fine (**171 ms ≤ 300 ms** on his 445-page book 3),
but the felt edit→visible gesture is **~1.9 s now / ~2.9 s projected @ v54** — a **persistence tax**, not
a render cost. Its shape is **O(v)** — cost grows with the version count — and it is paid on **every edit
and every proof refresh**, because each opens with `repository.findById`.

**B removes the O(v) term in both directions and returns the felt gesture to the engine (~171 ms), while
discarding nothing.** This DR designs B contractually complete.

## §1 The current contract (measured facts, not assumed)

The aggregate is whole (ADR-0048): a `Project` carries its head book, its settings, and its full version
log. The store already SHARDS versions into their own rows (`versions(project_id, id, number, payload)`;
`payload` = the whole `BookVersion` JSON, **including a full `Book` snapshot** ~1.1 MB each on the founder's
store). But:

- **`findById` is O(v) on READ** — after loading the head aggregate (which already contains `project.book`,
  the current book — `ProjectService.currentBook` returns `project.book`, never a version), it **eagerly
  loads and hydrates EVERY version's full payload** (`SELECT payload FROM versions … ORDER BY number`).
  The render/edit path needs only the head; it pays for all N version books. **This is the 1736 ms.**
- **`save` is O(v) on WRITE** — it `DELETE`s all version rows then re-`INSERT`s all of them every call
  (measured in `BATCH_CONFIRM_LATENCY` A3). One edit rewrites the whole log.
- **The port PROMISES the whole aggregate** — `ProjectRepository.findById`'s doc: *"'Whole' is the
  contract: a caller that receives a Project may rely on its versions."* Amending that promise is the
  load-bearing contract change (§3).

## §2 The decisions (Level-2 — the CTO gates these)

### D1 — The loaded aggregate carries a version INDEX, not version books
`findById` returns the head Project — `project.book` (current), settings, assets — plus a **lightweight
version index**: `{ id, number, label, createdAt, sourceAssetId }` per version, **without the `Book`
payload**. `BookVersion.book` (and `.settings`) become **optional/lazy** on the model: present on a version
you deliberately load (D2), absent on the index findById returns. The current book is unaffected — it was
never in the version log. **Read cost becomes O(1) in version weight** (head book + N tiny metadata rows).

### D2 — Reading a version's book is an explicit, on-demand port method
A new port method **`getVersion(projectId, versionId): Promise<BookVersion | undefined>`** loads ONE
version's full payload. `restoreVersion` (undo) moves from a pure `ProjectService` function to an
Application step: `EditBookUseCase` loads the target version's book via `getVersion`, sets it as the new
head, and saves (a fresh snapshot of the pre-undo head is taken first, exactly as today — undo loses
nothing). **Undo pays one version's load, not N.** The Timeline (history list) needs only the index D1
already provides — no payload load to render the list.

### D3 — Writing is append-only, atomic with the head update — via an EXPLICIT seam (not inference)
The repository must be **told** what is new, never left to diff the aggregate's version list against the
table (inference invites double-appends on retry — CTO amendment 1). The seam is a **dedicated port
method `appendVersion(project, version): Promise<void>`**: it writes the head aggregate (one book, ~1.1 MB —
the head changed, inherent) **and** appends **that ONE named version's** payload, **in ONE transaction**.
`save(project)` is **narrowed to the head only** — aggregate + assets — and **never touches version rows**.
So version creation flows exclusively through `appendVersion`; there is no diffing, no DELETE-all.

- **The Application seam:** `EditBookUseCase` (and import, and undo) takes the snapshot, then calls
  `appendVersion(project, theNewVersion)` — the repository knows the new version because it is handed it.
  A pure settings change (no new version) calls `save`.
- **Idempotency under retry (CTO amendment 1 — atomicity's twin):** the append is idempotent on the stable
  version id — `INSERT … ON CONFLICT (project_id, id) DO NOTHING`. So the failure-retry path yields exactly
  ONE version: a call that fails **before** COMMIT rolls back (nothing appended) → the retry appends once;
  a call that committed but whose ack was lost → the retry (same version id) is a no-op. **Asserted by a
  contract test on both repos:** "an `appendVersion` that throws after the append but before commit, retried
  with the same version, yields exactly one version, and the head is written exactly once."

**Write cost becomes O(1)** (head + one appended version). Requirement (b) atomicity is §4; this decision is
its idempotency twin.

### D4 — The schema migration (v1 → v2), first-class
The `versions` table gains metadata columns so findById reads the index WITHOUT the payload:
`ALTER TABLE versions ADD COLUMN label TEXT; ADD COLUMN created_at TEXT; ADD COLUMN source_asset_id TEXT;
ADD COLUMN milestone INTEGER NOT NULL DEFAULT 0;` then **backfill** each existing row's metadata columns
from its parsed payload; `PRAGMA user_version = 2`. The heavy `payload` column stays, read only by
`getVersion`. **The backfill flags HISTORICAL milestones (CTO amendment 2):** his store already holds the
events option 3 protects — book 3's **`v32 "publication"`** is literally one — so the backfill sets
`milestone = 1` on every existing version whose label matches the **automatic publication/export labels**
(the exact label set confirmed by a read-only check of the publish/export snapshot code at build time —
e.g. `"publication"`), so his history is **milestone-correct from day one**, not only going forward.
Additive and reversible (§5).

### D5 — Milestone-flag MODEL SUPPORT + the retention parameter (D's foundation, D deferred)
**The retention shape is RULED, not open: the founder chose option 3** — a **recent-N undo net + automatic
milestones (publications/exports) kept forever** — with his own extension (a "Mark this step" gesture +
reopening nudge) **explicitly withdrawn by him** (recorded below). So B builds the **model support** for
that ruled shape, not the pruning: a version can be a **milestone** — flagged **automatically** when a
publication or export produces it — and a milestone is **exempt from any future pruning**. B stores this
flag; **B prunes nothing.** The **effective behavior after B is keep-everything, because pruning itself is
D, and D is deferred** — not because the shape is undecided. The undo-net depth **`N`** ships as a **named,
consigned-revisable parameter** that D activates; until then it is inert (∞). When D later activates, it
prunes old **unmarked** versions silently beyond the last-N net, milestones kept forever — **nothing else**.
**No open founder question remains on this chantier.**

**WITHDRAWN (dated founder decision, 2026-07-24 — recorded so no future session resurrects it):** the
earlier-directed **"Mark this step" manual milestone gesture** and the **reopening nudge** are **withdrawn**.
Milestones are automatic (publications/exports) only. Neither the manual gesture nor the nudge is built —
not in this interlude, not in M3/M4.

## §3 The ADR-0048 amendment (requirement a — the contract evolves consciously)

ADR-0048 established the whole-aggregate contract. This DR **amends it, reasoned and recorded**: `findById`
returns the head aggregate + a **version index**, not the version payloads; a version's book is loaded
on demand via `getVersion`. The reasoning: the whole-aggregate promise was a *simplicity* choice (one load,
no "which book?"), correct when version books were few; measured at the founder's real scale it is an O(v)
tax on every gesture. The head book — the thing every render/edit actually needs — is unchanged and still
loads whole; only the *history payloads* become lazy. The amendment is recorded as an ADR-0048 addendum in
`DECISIONS.md`, and **`projectRepositoryContract` evolves WITH the contract, not around it** (§7): the
suite's "findById returns whole versions" assertions become "findById returns the version index; getVersion
returns the payload", asserted identically against both implementations.

## §4 Torn-aggregate atomicity (requirement b — re-treated explicitly)

"A consistency boundary that can be torn in half is not one" (ADR-0048). B keeps this **absolutely**:
`appendVersion`'s head-aggregate update AND the version append are **one `BEGIN IMMEDIATE … COMMIT`** — on
any failure, `ROLLBACK` leaves the store byte-identical (head not advanced, version not appended). It never
leaves a version referencing a head that was not written, nor a head advanced past a version that was not
appended. A crash mid-write rolls back (SQLite WAL, ADR-0046). Asserted by a contract test on both
implementations: "an `appendVersion` that throws after the append but before commit leaves versions AND
head unchanged" — and its idempotency twin (D3): retried with the same version, exactly one version results.

## §5 The real-store migration (requirement c — first-class)

The founder's store is **93 MB — 10 projects, book 3 in THREE copies (v34/v22/v2)**. The migration is a
first-class deliverable, not a `migrate()` side note:
1. **Backup before** — copy `studio.db` (+ `-wal`, `-shm`) to a timestamped backup; the migration refuses
   to run if the backup step failed.
2. **Migration proven reversible** — v2 is additive (new columns; the `payload` column is untouched), so
   reverting = ignore the new columns / restore the backup. A dry-run on a COPY (the cadrage's proven
   method) validates the backfill before the real run.
3. **Verified after** — post-migration, every project `findById` + `getVersion(each version)` reconstructs
   the SAME `BookVersion` objects as pre-migration (byte-compare the hydrated payloads); the head books
   render byte-identically (the corpus/real-book parity discipline); **and the historical-milestone
   backfill is asserted — book 3's `v32 "publication"` (and every automatic-labeled version) is flagged
   `milestone = 1`, non-milestone edits are not** (CTO amendment 2). **The chantier judge includes: "the
   founder's store migrated, intact, and byte-verified on his books, milestones correct"** (§6), run on a
   copy, then — on the CTO's word, founder idle — the real store, backed up.

## §6 The chantier judge (requirement d)

- **The O(v) curve is FLAT** — `findById` median is ~constant across version count, **measured on the real
  migrated store** (the cadrage instrument re-run: findById @ v34 ≈ findById @ v2, both ~head-load time,
  not ~1736 ms).
- **The full gesture on his book 3 is back under the sub-second bar** — engine (~171 ms) + head-only
  findById, measured end-to-end as M2 wired it.
- **Undo / history is functionally UNCHANGED for the author** — restore any version reproduces exactly
  today's result (a real round-trip test: edit → undo → byte-identical head); the Timeline shows the same
  versions.
- **The lazy read path is licensed against the OLD truth directly (CTO amendment 3 — a read-path positive
  control):** BEFORE migrating the copy, capture — via v1's eager `findById` — the full books of a sampled
  set of his historical versions; AFTER migration, `getVersion` on that same sample returns books
  **byte-identical** to the captured pre-migration originals. This licenses D2's on-demand path against v1's
  eager load directly, not transitively through the post-migration round-trip.
- **Full harnesses green** — backend suite (incl. the evolved `projectRepositoryContract` on BOTH repos),
  frontend suite, tsc + eslint + builds, `verify-real-*` on a throwaway store (zero trace), the real store
  migrated + byte-verified on a backup-protected copy.

## §7 The contract suite + the in-memory twin evolve with the contract

`projectRepositoryContract.ts` is the ONE behavioural suite both `SqliteProjectRepository` and
`InMemoryProjectRepository` pass. It evolves in lock-step: findById-returns-index, getVersion-returns-payload,
append-only-not-rewrite, atomic-head+version. **`InMemoryProjectRepository` implements the SAME amended
contract** (its findById returns the index shape, getVersion the payload) so a test double never drifts from
the real store's behaviour — the whole reason the shared suite exists (ADR-0048).

## §8 Scope boundaries

- **D (version-log cap) is DEFERRED, never folded into B** — B fixes O(v) for the felt loop (head-only read
  makes the current cost independent of `v`); D would only bound the on-disk file weight, which is not the
  felt problem. D activates later if disk weight becomes a **measured** subject; its shape depends on the
  founder's undo-depth answer.
- **The manual "Mark this step" gesture + the reopening nudge are WITHDRAWN** (§2 D5) — not built.
- **The founder's undo-depth question is CLOSED — he ruled option 3** (recent-N net + automatic milestones
  forever; his manual-mark/nudge extension withdrawn). B ships the model support for that shape; the
  effective behavior after B is keep-everything only because pruning is **D (deferred)**. No founder input
  is outstanding on this chantier.
- **Nothing else rides in the interlude** — M3 resumes on the green judge.

## §9 Proposed build sequence (gated commits, each a working store)

1. **The model + port** — `BookVersion.book?`/`.settings?` optional + `milestone?`; `ProjectRepository.getVersion`
   and `appendVersion`; the `projectRepositoryContract` evolution written FIRST (the contract is the spec),
   **including the idempotency-under-retry test** (D3) and the atomicity test (§4). Both repos made green.
   **✅ DONE + green — `feat/append-only-persistence` `524fe12`** (the additive port; findById/save still
   eager, unchanged; backend 944/944). `BookVersion.book?`/`.settings?` stay REQUIRED for now — they become
   optional at the flip (step 2), where a findById-loaded version carries no book.
2. **Sqlite read/write (the FLIP)** — findById head+index; `getVersion`; `save` narrowed to head-only;
   version creation routed through `appendVersion` (§3/§4).
3. **The migration** (§5) — schema v2 (incl. `milestone`) + metadata backfill + **historical-milestone
   backfill** (amendment 2) + backup/verify + the **read-path positive control** (amendment 3, sample
   captured pre-migration); dry-run on a copy, the migration test.
4. **Application wiring** — version creation routed through `appendVersion`; `restoreVersion` via `getVersion`
   in `EditBookUseCase`; Timeline reads the index; `GetProjectUseCase`/the region path now O(1) on load. (The
   `ProjectDTO.skeleton` projection is unaffected — it reads the head book, D1 of AUTHOR_EXPERIENCE.)
5. **The judge** (§6) — the flat-curve re-measure on the migrated real store (backup-protected), the sub-second
   gesture, the undo round-trip, full harnesses.

> **RESUME ORDER — the fresh session's FIRST move (CTO sequencing note, 2026-07-24):** run the **migration
> dry-run on a COPY of the founder store BEFORE writing the flip (step 2)**, and **capture amendment 3's
> pre-migration sample from the v1 eager `findById` path at the same time**. The dry-run costs little,
> licenses the migration mechanics early, and — if the 93 MB store holds any surprise (a malformed historical
> version, an encoding oddity in his oldest projects) — you meet it **while `findById` still works the old
> way**, not after the flip has changed what "loading a project" means. Discover on the copy, then flip with
> knowledge. So the effective order is: **step 1 (done) → the step-3 dry-run + amendment-3 capture on a copy →
> step 2 (the flip) → step 3 (the migration proper) → step 4 → step 5 (judge).**

**NEXT (fresh session): the dry-run-on-copy + amendment-3 capture → the flip → the migration → the wiring →
the judge → M3 resumes.** Step 1 is done; the additive foundation de-risks the rest.
