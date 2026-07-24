# APPEND_ONLY_PERSISTENCE — Design Review (Level 2, option B)

**Date:** 2026-07-24 · **Status: WRITTEN — AWAITING THE CTO'S GATE.** Scope ruled by the CTO: **B now,
contractually complete; D (version-log cap) deferred, never folded into B.** A bounded interlude before
AUTHOR_EXPERIENCE M3 (M3 resumes on a green judge). Cadrage: `docs/APPEND_ONLY_PERSISTENCE_SCOPE.md`.

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

### D3 — Writing is append-only, atomic with the head update
A snapshot **appends ONE version row** (its full payload) and updates the head aggregate **in ONE
transaction**. No `DELETE`-all. Mechanically: `save` writes the head aggregate (one book, ~1.1 MB — the
head changed, inherent) and, for any version the in-memory Project carries **with a loaded `book`** that is
**not already stored**, `INSERT`s its payload (append; existing rows are immutable and untouched —
`INSERT OR IGNORE` on the stable `(project_id, id)` key). A findById-loaded Project's index versions carry
no `book`, so they are skipped; only the freshly-created snapshot (book present) is appended. **Write cost
becomes O(1)** (head + one appended version). Requirement (b) is §4.

### D4 — The schema migration (v1 → v2), first-class
The `versions` table gains metadata columns so findById reads the index WITHOUT the payload:
`ALTER TABLE versions ADD COLUMN label TEXT; ADD COLUMN created_at TEXT; ADD COLUMN source_asset_id TEXT;`
then **backfill** each existing row's columns from its parsed payload; `PRAGMA user_version = 2`. The heavy
`payload` column stays, read only by `getVersion`. Additive and reversible (§5).

### D5 — Milestone-flag MODEL SUPPORT + the retention parameter (D's foundation, D deferred)
B builds the **model support** the CTO ruled, not the pruning: a version can be a **milestone** — flagged
**automatically** when a publication or export references it (the events the system already records). A
milestone version is **exempt from any future pruning**. B stores this flag; **B prunes nothing**
(retention default = **keep everything**). The **retention depth `N`** is a **named, consigned-revisable
parameter**, unset (∞) until the founder rules. When D later activates, it prunes old **unmarked** versions
silently beyond the last-N undo net, milestones kept forever — **nothing else** (see the withdrawal below).

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

"A consistency boundary that can be torn in half is not one" (ADR-0048). B keeps this **absolutely**: the
head-aggregate update AND the version append are **one `BEGIN IMMEDIATE … COMMIT`** — on any failure,
`ROLLBACK` leaves the store byte-identical (head not advanced, version not appended). The append never
leaves a version referencing a head that was not written, nor a head advanced past a version that was not
appended. A crash mid-write rolls back (SQLite WAL, ADR-0046). This is asserted by a contract test:
"a save that throws after the head write leaves versions AND head unchanged" (both implementations).

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
   render byte-identically (the corpus/real-book parity discipline). **The chantier judge includes: "the
   founder's store migrated, intact, and byte-verified on his books"** (§6), run on a copy, then — on the
   CTO's word, founder idle — the real store, backed up.

## §6 The chantier judge (requirement d)

- **The O(v) curve is FLAT** — `findById` median is ~constant across version count, **measured on the real
  migrated store** (the cadrage instrument re-run: findById @ v34 ≈ findById @ v2, both ~head-load time,
  not ~1736 ms).
- **The full gesture on his book 3 is back under the sub-second bar** — engine (~171 ms) + head-only
  findById, measured end-to-end as M2 wired it.
- **Undo / history is functionally UNCHANGED for the author** — restore any version reproduces exactly
  today's result (a real round-trip test: edit → undo → byte-identical head); the Timeline shows the same
  versions.
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
- **The founder's undo-depth question** (keep-everything / last-N / last-N+milestones — engineering
  recommendation option 3) is **with the founder, through the CTO**. It does **not block this DR**: retention
  depth is a named parameter defaulting to keep-everything (B makes retention costless for the felt loop);
  the founder's answer fills the parameter and gates D's eventual shape.
- **Nothing else rides in the interlude** — M3 resumes on the green judge.

## §9 Proposed build sequence (gated commits, each a working store)

1. **The model + port** — `BookVersion.book?`/`.settings?` optional + `milestone?`; `ProjectRepository.getVersion`;
   the `projectRepositoryContract` evolution written FIRST (the contract is the spec). Both repos made green.
2. **Sqlite read/write** — findById head+index; `getVersion`; append-only atomic `save` (§3/§4).
3. **The migration** (§5) — schema v2 + backfill + backup/verify, dry-run on a copy, the migration test.
4. **Application wiring** — `restoreVersion` via `getVersion` in `EditBookUseCase`; Timeline reads the index;
   `GetProjectUseCase`/the region path now O(1) on load. (The `ProjectDTO.skeleton` projection is unaffected —
   it reads the head book, D1 of AUTHOR_EXPERIENCE.)
5. **The judge** (§6) — the flat-curve re-measure on the migrated real store (backup-protected), the sub-second
   gesture, the undo round-trip, full harnesses.

**NEXT: the CTO's gate on this DR → branch at the gate → build §9 → judge → M3 resumes. No code before the gate.**
