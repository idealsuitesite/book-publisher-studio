# Persistence — Sprint 11 — Level 2 Design Review

**Status:** ✅ **APPROVED (CTO feu vert 2026-07-20 on the plan naming persistence as the top priority). This review discharges ADR-0041 Constraint 2 — the governance gate that required Sprint 7 Decision 2 to be formally amended by a Design Review before durable storage exists — and executes ADR-0046's already-approved store recommendation.**
**Date:** 2026-07-20
**Trigger:** the studio now tells a story — resume-where-left, versions, publications, a timeline — that a server restart erases. Every capability added since ADR-0047 has deepened that lie. This review ends it.

---

## 1. The governance act: Sprint 7 Decision 2 is formally amended (ADR-0048)

Decision 2 ("the backend is stateless; every request is a complete round trip") was the right call for a conversion tool and carried this project cleanly through Sprints 7–8. It died in three recorded steps: amended *in principle* when the `Project` aggregate was designed (`AGGREGATES_AND_PERSISTENCE.md`), amended *in code* when import began creating in-memory projects by CTO direction (ADR-0047), and amended *formally now*: **the backend is stateful and durable. Projects survive restarts. This is the product's promise, not a deviation from one.** ADR-0048 is the citable record.

What Decision 2 got right is kept: the *pipeline* stays stateless — parse→render still holds no session, and every export is still a complete computation. State lives in exactly one place: behind `ProjectRepository`.

## 2. The store: SQLite via `node:sqlite` — measured, not preferred (ADR-0046)

Decided by spike, not taste: `list()` 317ms vs 7015ms for JSON-files; crash-mid-write rolls back vs corrupts; zero new dependencies (Node ≥ 23 ships it; v24.18.0 verified on this machine). The spike's schema is adopted with one evolution (§3).

## 3. Schema — the spike's shape, plus the version answer ADR-0046 demanded

ADR-0046's out-of-band finding: a 50-version aggregate weighs **45MB**, because every snapshot copies the whole book. Its instruction: Sprint 11 must treat version growth as a first-class input. The answer — **versions become their own rows, inside the same transaction and the same port contract**:

```sql
PRAGMA journal_mode = WAL;
PRAGMA user_version = 1;              -- schema version; migrations bump it

CREATE TABLE projects (
  id          TEXT PRIMARY KEY,
  aggregate   TEXT NOT NULL,          -- the project JSON, WITHOUT versions and WITHOUT asset bytes
  name        TEXT NOT NULL,          -- summary columns: list() is a SELECT, never a load
  book_title  TEXT NOT NULL,
  author      TEXT NOT NULL,
  version_count INTEGER NOT NULL,
  published_targets TEXT NOT NULL,    -- JSON array, derived at save from the event log
  cover_asset_id TEXT,
  archived_at TEXT,                   -- ADR-0044's filter, indexed
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_projects_listing ON projects (archived_at, updated_at DESC);

CREATE TABLE versions (
  project_id  TEXT NOT NULL,
  id          TEXT NOT NULL,
  number      INTEGER NOT NULL,
  payload     TEXT NOT NULL,          -- the BookVersion JSON (book snapshot + settings)
  PRIMARY KEY (project_id, id)
);

CREATE TABLE blobs (
  project_id  TEXT NOT NULL,
  asset_id    TEXT NOT NULL,
  bytes       BLOB NOT NULL,          -- ADR-0046: embedded blobs cost 58MB/4.9s; never inline
  PRIMARY KEY (project_id, asset_id)
);
```

**Why sharded versions do not break the port**: `findById` still returns the whole aggregate — the port's contract (`AGGREGATES_AND_PERSISTENCE.md` Q1) is about what *callers* may rely on, not about table layout. Sharding buys: `list()` and summary updates never touch version payloads, a future partial-load (Sprint 12's Versions UX, if the 45MB ever bites a real user) becomes a repository-internal change with **zero schema migration**, and each version row writes once and never rewrites (snapshots are immutable, ADR-0001).

**No events table yet, stated plainly**: the `ProjectEvent` log (timeline minute-granularity, PRODUCT_EXPERIENCE §10.5) is *designed to land here* as `events(project_id, at, kind, payload)` in a `user_version=2` migration — but it is Domain-model work first (who writes events, and when), and bolting an empty table on now would be schema-first design. The migration mechanism this review ships (§5) is what makes that later addition a non-event.

## 4. Hydration — the lesson already paid for

`JSON.parse` revives neither `Date` nor `Buffer`, and this project has the scar to prove the stakes: `structuredClone` silently downgraded `Buffer` → `Uint8Array` in the in-memory repository, crashing the first caller that did `.equals()` (ADR-0047). The SQLite layer gets an explicit, tested (de)hydration boundary: Dates serialize as ISO strings and revive by ISO-shape; asset bytes never enter JSON at all (they live in `blobs` and are reattached as real `Buffer`s on load). The hydration is covered by the shared contract suite (§6), which includes the exact `.equals()` round-trip that caught the original defect.

## 5. Operational decisions

- **Path**: `DATABASE_PATH` env; default `backend/data/studio.db` (gitignored). Tests use `:memory:`.
- **Migrations**: `PRAGMA user_version` checked at open; the repository owns its schema and applies forward-only migrations in order. Version 1 creates; nothing exists to migrate *from* (the in-memory store held nothing durable — the one moment such a switch is free).
- **The dev reset route** (`POST /api/dev/reset-projects`) now clears the SQLite store — the baseline capture keeps its determinism; the route still dies in production and its ADR-0047 comment (predicting its own death "when SQLite lands") is amended: it survives, repointed, because the capture still needs it.
- **`InMemoryProjectRepository` lives on** as a first-class port implementation for unit tests — and as the second implementation that keeps the port honest.

## 6. The contract suite — one behaviour, N implementations

The port's behavioural tests become a **shared suite run against BOTH implementations** (`describeProjectRepositoryContract(makeRepo)`): whole-aggregate round trip, Date/Buffer fidelity, caller isolation, summary listing, archived default-exclusion, delete semantics. Sprint 8's discipline (prove the port against a fake before the real implementation exists) graduates: prove every implementation against the same contract, forever. A future Postgres (S15 cloud) implementation starts by passing this suite.

## 7. Risks

1. **`node:sqlite` is Node-API surface** — verified without flags on v24.18.0; CI's Node version must be ≥ its stability line. Checked in the repository's open path with a clear error, not a crash.
2. **WAL leaves `-wal`/`-shm` files** beside the db — gitignore covers the directory.
3. **Concurrent writers**: one process today; WAL + immediate transactions are sufficient. Multi-process is S15's problem and is named, not solved.
4. **The 45MB aggregate still loads whole on `findById`** — sharding positions the fix (partial load) without forcing it; Sprint 12 decides *if* a real user ever feels it.

## 8. Commit plan

| # | Scope |
|---|---|
| 1 | This review + ADR-0048; `data/` gitignored. |
| 2 | Shared contract suite, run against `InMemoryProjectRepository` (green before SQLite exists). |
| 3 | `SqliteProjectRepository` (schema v1, hydration, transactions) passing the same suite. |
| 4 | Wiring: `DATABASE_PATH`, app.ts switch, dev-reset repointed; **restart-survival verification** — import, really restart the server, the project is still there. The money shot. |

**✅ EXECUTED (2026-07-20, all four commits).** Contract suite 14/14 on both implementations; backend 542/542, tsc + eslint clean. The money shot was performed live, not simulated: a real DOCX imported over HTTP, the backend process killed and restarted, `GET /api/projects/:id` returned the whole project, and `POST /api/projects/:id/export` produced a 295KB PDF from source bytes that existed only in SQLite. Baseline `--check` byte-identical twice against the durable store — §5's dev-reset amendment holds. One correction found on the way: commit 1's `data/` gitignore line had been appended without a trailing newline (`~$*.docxdata/`), so it ignored nothing; fixed in commit 4.

## Related

ADR-0041 Constraint 2 (the gate this discharges), ADR-0046 (the spike this executes), ADR-0047 (the in-code amendment + the Buffer lesson §4 institutionalizes), ADR-0044 (`archived_at` indexed), ADR-0048 (the formal amendment), `AGGREGATES_AND_PERSISTENCE.md` (the port this stays faithful to), PRODUCT_EXPERIENCE §10.5 (the events table §3 reserves a migration for).
