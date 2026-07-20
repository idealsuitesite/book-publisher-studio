# Session Bootstrap

Read in this order:

1. [START_HERE.md](START_HERE.md)
2. [CURRENT_STATE.md](CURRENT_STATE.md)
3. [TODO.md](TODO.md)
4. [DECISIONS.md](DECISIONS.md)
5. [VERSIONS.md](VERSIONS.md)

Then summarize:

- Current version
- Current branch
- Architecture
- Completed work
- Next task

Wait for approval before writing code.

## Usage

At the start of a new session, say:

> Read docs/SESSION_BOOTSTRAP.md and follow it.

This replaces repeating the same startup instructions every session. If a task is already mid-flight (e.g. resuming a specific commit in an ongoing sprint), say so explicitly after the summary — `CURRENT_STATE.md`'s "Next Session Preparation" section should already point at it, but state it isn't a substitute for saying what you actually want done next.

---

## Session end — reconcile the documents BEFORE closing (CTO rule, 2026-07-21)

A session does not end when the code is merged. It ends when the documents a *fresh* session will
read are true. **Before closing, check which documents the session made stale and update them.**

Why this is a rule and not a habit: no Claude session carries memory into the next one. Everything
that survives does so because it is text on disk. A handoff document asserting in the present tense
something the session made false is the one failure that breaks a clean restart — and it is
invisible from inside the session that caused it.

**The checklist, in order of how badly staleness hurts:**

1. **`CURRENT_STATE.md`** — reading step 2 of this file. Its header and executive brief must state what `main` really carries, which branches really hold unmerged work, and what the next task is. **Rebuild these from `git log`, not from memory of the session.**
2. **`TODO.md`** — its header is the authoritative statement of what is merged; named follow-ups must reflect anything locked, closed or newly owed.
3. **`DECISIONS.md`** — every decision, *and every reversal of one*, with the reasoning that produced it. A reversal recorded only in a conversation is lost.
4. **Design Reviews in `docs/architecture/diagrams/`** — a frozen review that still describes as pending something now shipped will mislead whoever reopens it.
5. **`ADR_INDEX.md`, `VERSIONS.md`, `CLAUDE.md`** — usually untouched; check rather than assume.

**Two failure modes, both seen in practice:**
- Updating a document that was already correct. Verify staleness before editing — and when a search returns zero, suspect the *pattern* before concluding absence. (A `grep` for `ADR-0050` returned 0 against a table whose rows read `| 0050 |`; acting on that zero created a duplicate.)
- Deferring the reconciliation to "next session". There is no next session that remembers.
