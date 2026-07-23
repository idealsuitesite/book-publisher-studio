# BATCH_CONFIRM_LATENCY — cadrage (measured; stops at the constats)

**Status:** cadrage, awaiting CTO verdicts. **No production code written.** This is P2 of the
AUTHOR_EXPERIENCE Axis-7 sequence (`AUTHOR_EXPERIENCE_GAP.md` §Axis 7): the CTO re-engraved the order
so **P2 → P1 precede the Design Review** — a mockup must not promise a fluidity the engine cannot
hold. This report measures P2 so its correctif is decided on numbers.

**Instrument:** `backend/spikes/batch-confirm-latency-cadrage.ts` (read-only w.r.t. the real store — a
throwaway temp SQLite DB, a committed corpus fixture `generated-unstyled-3060w.docx`, 40 numbered
markers injected so the REAL `promoteToChapter` batch runs; the founder's real book measured N≈56).
Run: `npx tsx spikes/batch-confirm-latency-cadrage.ts`. Numbers below are one representative run on
this machine — the *shape* (super-linear), not the absolute ms, is the finding.

---

## §1 What the studio does today

`StructureSuggestionsPanel.promote` (and the cleanup/subchapter twins) loops the N suggestions and,
per marker, issues **one** `POST /:id/structure` → `EditBookUseCase.execute` →
`ProjectService.snapshot()` + apply + `repository.save()`. "Make all chapters" runs these **N times,
sequentially, each awaiting the previous** (reverse document order so each split stays flat).

The compute is not the cost. The promote op and `ValidationEngine` are sub-10 ms. The cost is three
amplifiers stacked on top of each other, each multiplying by N.

## §2 The three amplifiers (measured)

**A1 — N sequential round-trips (the frontend loop).** Each confirm is a full HTTP round-trip the
next one waits on. The backend-only measurement below already reaches ~1 s at N=40; the real studio
adds N network round-trips on top of that — this is the founder's measured "several seconds".

**A2 — N snapshots: the version log grows by N in ONE gesture.** `ProjectService.snapshot` stores
`book: project.book` — a **whole-book copy** (measured **≈35 KB** per version on this 3,060-word
fixture; **≈1.1 MB** on the founder's real book). "Make all" appends N of them for a single author
intention, contradicting the Q2 principle already on the books ("one validated command = one version,
never one keystroke", `EditBookUseCase` header).

**A3 — `save()` rewrites the WHOLE version table + all blobs on every call.**
`SqliteProjectRepository.save` does `DELETE FROM versions` then re-`INSERT` **every** version (each
payload a whole-book JSON) and `DELETE FROM blobs` + re-insert **all** asset bytes — every save. So
per-save cost is **O(v)** in the current version count, and across a batch where v climbs 0→N it is
**O(N²)** in serialization. This is the dominant term, and it hurts even a lone edit (§3, sweep S).

## §3 The measurements

**Current batch, N=40 (backend only, no HTTP):**
- **total 1076 ms** (mean 26.9 ms/op)
- per-op **rises** 8.7 ms (first) → ~40–65 ms (late) — the O(v) whole-table save, an area-under-a-
  rising-curve, i.e. super-linear
- version log **0 → 40** (one per confirm); DB file **100 KB → 6.6 MB** for a *tiny* book

**Ceiling — the SAME 40 promotions as one gesture (one snapshot, one save):**
- **total 7.2 ms** · versions **1** · DB **197 KB**
- i.e. **~150× faster, 40× fewer versions, ~33× smaller** on disk — and it removes A1 entirely (one
  round-trip)

**Sweep S — one single confirm at growing pre-existing history (isolates A3):**

| pre-existing versions v0 | one confirm | db after |
|---|---|---|
| 0 | 5.4 ms | 237 KB |
| 10 | 22.9 ms | 974 KB |
| 30 | 43.9 ms | 2.4 MB |
| 60 | 134.7 ms | 6.8 MB |

A3 is not a batch-only problem: a book that has accumulated a session's history pays it on **every**
edit. On the founder's ~1.1 MB book each version is ~30× heavier than this fixture's, so both the ms
and the megabytes scale accordingly.

## §4 Options (costs stated; the cadrage does not choose)

**Option A — a batch mutation (one gesture → one snapshot → one save).** A new mutation carrying the
N block ids, applied server-side in a single snapshot + single save; the frontend sends one call.
- **Kills A1 and A2 outright; reduces A3 to a single O(v) rewrite.** Reaches the measured 7 ms ceiling.
- Cost: one new `StructureMutation` variant (shared-types) + one `EditBookUseCase` case + a domain
  batch op (loop `promoteToChapter` over one Book in memory) + `parseMutation` route whitelisting
  (the `setPartRole` lesson) + tests. Bounded; does **not** touch the persistence contract.
- **Consequence to rule on:** undo granularity changes for "Make all" — the batch becomes **one** undo
  point, not N. This is coherent with Q2 (one gesture = one version); the per-item "Make chapter"
  button stays one-version. Surfaced, not hidden.
- Leaves standing: A3's O(v) cost for a *single* edit on a long-history book (sweep S).

**Option B — incremental persistence (append-only version write).** `save()` appends only the new
version row (and skips rewriting unchanged blobs) instead of delete-all/reinsert-all.
- Drops per-save from **O(v) to O(1)** — helps **every** edit, batch or not (sweep S → ~flat).
- Cost: changes `SqliteProjectRepository.save` semantics and the whole-aggregate contract
  (`PERSISTENCE.md` §3), the shared `projectRepositoryContract` suite, and the "torn aggregate =
  no aggregate" transaction reasoning. Higher blast radius, foundational payoff. **Composes with A.**

**Option C — optimistic UI (frontend).** Paint the change immediately, persist in the background.
- Hides latency; fixes nothing in the engine; mid-batch error recovery is messy; a long-history book
  still stalls the *next* real interaction. A palliative over a heavy engine, not a fix. Recorded for
  completeness; not a standalone answer to criterion A.

**Option D — version-log cap / pruning (ADR-0046 territory).** Bounding v bounds A3. But it is a
data-retention / undo-depth decision with its own tradeoffs — consign, do not fold in here.

## §5 The measured reading (for the CTO's verdict, not a decision)

- **A is the surgical, bounded, low-risk fix** that reaches the 7 ms ceiling and removes the N round-
  trips — it answers the founder's actual complaint ("Make all" stalls) and is "one commit, one
  intention" as `FOUNDER_TRAVERSAL_3.md` anticipated.
- **B is the deeper fix** for the O(v) save A leaves standing (a single edit on a long-session book).
  Higher risk, its own decision. A and B compose; B is not a prerequisite for A.

## §6 Verdicts owed (this cadrage stops here)

1. **Correctif shape:** A alone (batch mutation) now, with B consigned? A + B together? Or A now / B
   after its own cadrage? (The measured reading leans A-now; B is the CTO's risk call.)
2. **Undo granularity:** confirm "Make all" = one undo point is acceptable (Q2-coherent), or must each
   marker stay individually undoable?
3. **Scope of the batch op:** the three suggesters (assist / cleanup / subchapter) each have a "…all"
   gesture — does the batch mutation cover all three poles in one shape, or only the assist first?

**Sequence (CTO, re-engraved):** cadrage P2 (this) → CTO verdicts → correctif P2 → cadrage P1 →
chantier P1 → the AUTHOR_EXPERIENCE Design Review → mockups → founder validation → construction.
**Nothing is coded before the verdicts above.**

---

## §7 Correctif A — the mini-DR record and the build (2026-07-23)

**Status: BUILT on `feat/batch-confirm-latency` (3 gated commits), gate green, awaiting the CTO's word
to merge (gate 5 / GR-1). Not on `main`.**

### CTO verdicts (on §6)
1. **Shape — A now; B consigned with its OWN cadrage, never folded into A.** A is bounded, does not
   touch the persistence contract, reaches the measured ceiling, answers the founder's real complaint.
   B is real (sweep S proves it) but its cadrage must weigh **B and D together** — an O(1) append save
   and a version-log cap are two answers to the same O(v) term; deciding them apart risks redundant
   work or a retention decision smuggled inside a perf chantier. → consigned **`APPEND_ONLY_PERSISTENCE`**
   (`TODO.md`): B+D as one cadrage, **undo depth a PRODUCT question for the founder**, not settled by
   technique. **Trigger:** after A ships, re-measure the real gesture on the founder's book — if a
   unitary edit on a long session stays under the felt threshold, B waits; else it rises. The
   measurement decides urgency, not a date.
2. **Undo — "Make all" = ONE undo point. Confirmed** (Q2 applied; the founder's "une ligne, une
   décision" — the gesture is a decision, its undo is a decision). Two guardrails: the version **label
   says what it was** ("Convert all — N chapters created", never generic); and the coarse undo is
   acceptable **because the fine inverse gesture exists** — the per-item button stays one-gesture-one-
   version, and the family carries the inverse (cleanup re-glues a chapter unduly created).
3. **Scope — ONE shape covering all three poles, one op type per batch.** Building assist-only would
   leave cleanup/subchapter with the measured defect and invite a divergent second implementation.
   Two firm constraints: **(a)** a batch carries a **single op type** (never mixed — no UI gesture
   produces a mixed batch; accepting it would be generality without a client); **(b)** each pole keeps
   its **engraved order law applied SERVER-SIDE** — `SUBSECTION_APPLY_ORDER` (reverse document order,
   greedy splits) is computed by the server from the book and locked by test per pole, **not inherited
   from the deleted frontend loop.** This is where the correctif could break silently; it is guarded.

### CTO amendments
- **Amendment 1 — atomicity both ways.** Beyond "a bad id → typed CONTENT_NOT_FOUND, never a 500", the
  real property: a batch that fails mid-course leaves the book **byte-identical** and the version log
  at **+0**. Success ⇒ +1 version, failure ⇒ +0. Locked by assertion (domain: input untouched;
  use-case + route: +0 and stored book unchanged), not assumed.
- **Amendment 2 — a verification (not work).** Confirmed the pushed ADR-0054 consignation contains the
  Approval-Cadence directive ALONE — no "authority chain" / CTO-sole-channel content anywhere
  (`git show origin/main:docs/DECISIONS.md` checked). A directive retracted before transmission never
  reached the registry; nothing to retract.

### The three registry validations (CTO)
- The inactivity check + documented push were correct, incl. the residual-servers-vs-write-activity
  distinction.
- The **two-order test on `collapseMarker`** converts "documented order-independent" into a measured
  property — kept even though it looks redundant; it is what licenses trusting the doc.
- The **coarse-undo line** ("acceptable because the fine inverse exists") is recorded here.

### The design, as built
- `StructureMutation` gains `{ type:'batchApply', op, ids }` — one `op` field makes a mixed batch
  inexpressible (constraint a, structural).
- `BookEditingService.applyBatch` — the order law is the server's (`documentOrderIndex` → reverse for
  the greedy ops; collapse order-free); a pure reduce, so atomicity is inherent (amendment 1).
- `EditBookUseCase.batchApply` — ONE snapshot (descriptive label) + ONE save.
- `parseMutation` whitelists it with route tests, same commit (the standing setPartRole lesson).
- The three panels each send ONE call; per-item buttons unchanged (guardrail 2ii).

### The judge (gate)
Instrument `backend/spikes/batch-confirm-latency-cadrage.ts`, extended to the shipped path:
- **Real `batchApply`, N=40: 4.6 ms, ONE version**, label "Convert all — 40 chapters created", db
  197 KB — vs the current N-sequential path ~1776 ms / 40 versions / 6.6 MB. **The ceiling is reached.**
- **Founder-book probe (read-only, book 3): N=30** (the A2 repetition guard already drops the 26
  "Conclusion" repeats — the traversal-3 56→30; those go to the subchapter panel) → **65.6 ms, ONE
  version, 30 chapters created**, in a throwaway temp repo. **The founder's stored project was never
  written** (store verified: 8 projects, mtime unchanged).
- **Bidirectional invariant intact** (the suggester purity tests stay green; the batch never touches
  the suggester). **Full live harnesses** re-run against a throwaway server (spare port, temp
  `DATABASE_PATH`, discarded): **verify-real-import 4/4 · verify-real-export 16/16 · verify-real-publish
  4/4** — the correctif touches only structure-editing, not the import/export/publish path.
- **Gate: backend 905/905, frontend 230/230, tsc + eslint(src)/eslint + builds clean.** Taste-stop:
  none (mechanics, not aspect) — the founder judges the result by feeling "Make all" become instant.
