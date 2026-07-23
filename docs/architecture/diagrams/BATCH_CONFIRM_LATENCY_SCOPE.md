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
