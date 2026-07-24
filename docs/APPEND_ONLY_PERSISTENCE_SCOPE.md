# APPEND_ONLY_PERSISTENCE — cadrage (measured, stopped at findings)

**Status:** **B DR GATED (CTO, 2026-07-24) — building on `feat/append-only-persistence`** (record
correction + 3 amendments folded: explicit `appendVersion` seam + idempotency-under-retry; migration
backfills historical milestones; a read-path positive control; the founder ruled option 3, no open
question). A bounded interlude before AUTHOR_EXPERIENCE M3 (M3 resumes on B's green judge).

> **CTO RULING (2026-07-24).** **Scope: B now, contractually complete; D deferred, never folded into B.**
> B fixes O(v) in both directions and returns the gesture to the engine (~171 ms) without discarding
> anything; D is a retention decision that destroys history and does not ride inside a performance
> chantier. B does not depend on D (head-only findById makes the current cost independent of `v`; D would
> only bound on-disk file weight, not the felt problem). D stays consigned, activatable later if disk
> weight becomes a **measured** subject; its shape depends on the founder's undo-depth answer.
>
> **The founder product question (undo/history depth) is with the founder, through the CTO** — three
> options (keep everything / keep last N / keep last N + permanent automatic milestones like
> publications+exports); the CTO's engineering recommendation is **option 3**. It does NOT block B's DR:
> retention depth is a named parameter defaulting to **keep everything** (B makes retention costless for
> the felt loop); the founder's answer fills the parameter and gates D's eventual shape.
>
> **WITHDRAWN (dated founder decision, recorded so no future session resurrects it):** the earlier-directed
> **"Mark this step" manual milestone gesture** and the **reopening nudge**. Milestones are **automatic**
> (publications/exports) only; neither the manual gesture nor the nudge is built — not in this interlude,
> not in M3/M4. B's model supports milestone-flagged versions **exempt from pruning** (the automatic ones);
> pruning of old unmarked versions is D's job (deferred, silent beyond the undo net); **nothing else.**

## Why it opened now (the trigger, not a new decision)

`APPEND_ONLY_PERSISTENCE` was consigned in the `BATCH_CONFIRM_LATENCY` cadrage (§7) with an explicit
clause: *after correctif A ships, re-measure the real gesture on the founder's book — the measurement
decides B's urgency, not a date.* AUTHOR_EXPERIENCE M2 wired the live edit→visible loop and the raw
end-to-end showed ~529 ms on a synthetic throwaway. The CTO ordered the trigger's real measurement
(Option 3, with a pre-stated decision rule). This is that measurement.

## The measurement (2026-07-24, read-only on a COPY of the founder store — his live file never touched)

The full edit→visible gesture as M2 wired it decomposes into **repository `findById`** (the O(v) term)
**+ engine** (paginate + region render). Transfer is localhost-negligible. On the founder's real
projects:

| project | versions | findById | engine (paginate+region) | full gesture |
|---|---|---|---|---|
| **book 3** (`…d7bticjiw`, 445 pg, a5/classic) | **34** | **1736 ms** | **171 ms** (≤300, HELD) | **1907 ms** |
| control (`…rl9epg36r`) | 2 | 131 ms | — | — |
| **book 3, projected +20 taste-stop edits** | 54 | ~2740 ms | 171 ms | **~2910 ms** |

- **`findById` slope ≈ 50 ms/version** on his real store — his versions are ~1.1 MB each (≈30× the
  throwaway's), so the curve is far steeper than the synthetic 81→541 ms over 15 edits.
- **The engine HELD (171 ms ≤ 300 ms)** even on his 445-page book — the render is not the bottleneck.
- **The full gesture is ~1.9 s now and ~2.9 s projected — NOT sub-second.**

## Decision rule (CTO, pre-stated) → the branch that fired

> If the full gesture stays under the felt bar (engine ≤300 ms held, total comfortably sub-second),
> M3 proceeds and this stays consigned with the measurement attached. If it breaches, this cadrage
> opens before M3.

**BREACH.** engine HELD, but the gesture is ~1.9 s @ v34 and ~2.9 s @ v54 — well over sub-second.
**`APPEND_ONLY_PERSISTENCE` opens before M3.** The reasoning the CTO flagged: M3/M4 are the founder's
judgment sessions; his felt-A verdict must judge our render work, not a persistence tax we already
know how to name.

## The root (both directions are O(v))

The persistence contract is whole-aggregate (ADR-0048): a `Project` carries its entire version log,
each version a full `Book` snapshot.
- **Write is O(v)** — `SqliteProjectRepository.save` DELETEs + re-INSERTs the whole version table + all
  blobs every call (measured in `BATCH_CONFIRM_LATENCY` A3).
- **Read is O(v)** — `findById` deserialises every version blob (measured here: 50 ms/version on the
  founder's store). Every render path (`RenderProjectRegionUseCase`, the full export, `GetProjectUseCase`)
  pays it, because each opens with `repository.findById`.

So a long editing session pays an O(v) tax on **every** edit AND every proof refresh — the exact shape
of a taste-stop session.

## Options (to weigh together — B and D answer the same O(v) term)

- **B — append-only incremental persistence.** Store versions append-only; `findById` loads only the
  head book (+ metadata) for the working state, not every historical blob; `save` appends one version
  instead of rewriting the table. Fixes O(v) in BOTH directions. Touches the whole-aggregate contract
  (ADR-0048) and the shared `projectRepositoryContract` suite — the larger, higher-value change.
- **D — version-log cap (ADR-0046).** Bound `v` (keep the last N versions, evict the oldest). Caps the
  O(v) term without changing the contract — smaller, but it **discards history** past the cap.
- **C (palliative, out) — optimistic UI.** Hides latency, does not remove it; rejected for a fidelity
  product.

**B + D compose:** B removes the per-operation O(v); D bounds retained history independently. The
measured reading leans **B for the felt loop** (it fixes read AND write), with **D as the CTO's
history-retention call**.

## The founder product question (surfaced through the CTO — NOT decided here)

**Undo depth.** Both B (how many versions the head-fast store still lets you walk back) and D (the cap)
turn on a founder decision: *how far back should undo/version-history reach?* A per-keystroke history is
refused (ADR-0046). One-validated-edit-one-version stands (Q2). The open question is the RETAINED DEPTH
and whether old versions are pruned, archived, or offloaded. This is the founder's product call; it
reaches him through the CTO, and it gates B's/D's shape.

## Stop line

Measured; stopped at findings. **NEXT: the CTO's verdicts on B vs B+D and the scope, plus the founder's
undo-depth answer → a Level-2 DR → build → the judge (the O(v) curve goes flat; the felt gesture on the
founder's real book back under the sub-second bar) → M3 resumes.** No code before the gate.
