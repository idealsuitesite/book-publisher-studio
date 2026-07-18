# Design Review Process

The process this project has followed for every sprint since Sprint 2 (Rendering Engine), formalized here for the first time rather than re-derived each session. Nothing in this document changes existing practice — it names a pattern already visible across `docs/architecture/diagrams/*.md` and `docs/DECISIONS.md`.

## When a Design Review is required

Any change that:
- Introduces a new Domain service, port, or engine
- Chooses between two or more genuinely different architectural approaches (a new class vs. extending an existing one, a port vs. a concrete class, library A vs. library B)
- Changes a public signature already relied on by more than one caller
- Was explicitly requested by the CTO as a new capability, not a bug fix

A bug fix, a refactor with no behavior change, or a small addition that obviously extends an already-decided pattern does not need one.

## The two levels

**Level 1 — Platform-wide map** (`docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md`): fixes the *shape* of the target architecture — responsibilities, dependencies, and pipeline ordering across every engine still to be built — before any single engine's detailed design starts. Done once, reused by every subsequent Level 2 review instead of re-litigating boundaries each time. Not required again unless a new engine category is proposed that the existing map doesn't cover.

**Level 2 — Per-engine design** (`docs/architecture/diagrams/<ENGINE_NAME>.md`, one file per engine): the actual detailed design for one sprint's scope. Follows a consistent shape across every engine this project has built so far:

1. **Objectives** — what gap this closes, referencing `docs/VISION.md`'s original target scope where one exists.
2. **Current state, evidence not assumptions** — read the actual code before writing the review (`TYPOGRAPHY_ENGINE.md`, `VALIDATION_ENGINE.md`, `PROFESSIONAL_LAYOUT_ENGINE.md` all open with this). A claim like "renderer X doesn't do Y" must be confirmed by reading `X`'s source, not assumed from its name.
3. **Locked decisions** — one per architectural question, each with its own rationale, often across multiple review rounds with the CTO. A round that changes nothing is still worth recording ("confirmed unchanged").
4. **Architecture impact** — how this changes the pipeline diagram, what's additive vs. a signature break (this project's strong preference: additive fields over signature breaks, see ADR-0022/ADR-0027/ADR-0029's shared pattern).
5. **Functional / technical specifications** — locked public interfaces, written before implementation, not derived from it afterward.
6. **Risks** — named explicitly, including deliberate scope-narrowing accepted as a real tradeoff (not hidden as an oversight).
7. **Commit plan** — one responsibility per commit, in dependency order, ending with a real-file verification pass and a docs/ADR reconciliation pass.
8. **Acceptance criteria** — concrete, inspectable outcomes ("a real DOCX exported to A4 shows X"), not just "tests pass."

A **spike** (`backend/spikes/*.ts`, throwaway, not part of `src/`, not test-covered) is a hard prerequisite before any Level 2 review locks a decision that depends on real external behavior — a third-party library's actual capabilities (ADR-0019 PDFKit spike, ADR-0020 EPUB library spike) or real published specs this project doesn't control (ADR-0030 KDP trim-size spike). "Confirmed, not guessed" applies to this project's own upstream code too (ADR-0031/ADR-0032's lesson) — a Design Review's own wording can encode an unverified assumption about existing code just as easily as about a library.

## The approval gate

A Level 2 review is not implementation-ready until it says **✅ APPROVED** with a date, following explicit CTO review — often across multiple rounds, each resolving open questions raised in the previous one (`PROFESSIONAL_LAYOUT_ENGINE.md`'s "round 2" is typical, not exceptional). No branch is created and no code is written before this gate closes. This project's CTO has been consistent about this: an approved Design Review with "no code yet, no branch yet" is a normal, expected state to leave a session in (see `docs/CURRENT_STATE.md`'s history across Sprints 4-6) — approval of the design and approval to start implementing are two separate, sequential gates, not one.

## After approval: implementation discipline

- Branch from `main` (ADR-0017) — never implement directly on `main`.
- Small, atomic, Conventional-Commit-message commits, one responsibility each, green build/lint/test before the next starts (`docs/QUALITY_GATE.md`'s Level 1 gate, every commit).
- A real, disclosed gap found mid-implementation (a design assumption that turns out wrong once real code or real files are involved) gets fixed immediately as its own commit and disclosed in an ADR, not silently patched over or deferred without a record — ADR-0023, ADR-0026, and ADR-0031/ADR-0032 are this project's own precedent for exactly this.
- Real Fixture Verification (`docs/REAL_FIXTURE_POLICY.md`) before the sprint is considered feature-complete, not just before merge.
- Docs/ADR reconciliation, PR, review, merge, tag, Release Notes — see `docs/RELEASE_CHECKLIST.md` for the exact closure sequence.

## Related

- `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` — the current Level 1 map
- `docs/architecture/diagrams/VALIDATION_ENGINE.md`, `PROFESSIONAL_LAYOUT_ENGINE.md`, `TYPOGRAPHY_ENGINE.md` — worked Level 2 examples
- `docs/QUALITY_GATE.md` — the per-commit gate implementation must clear
- `docs/RELEASE_CHECKLIST.md` — what happens after implementation, before a version is considered released
- `docs/REAL_FIXTURE_POLICY.md` — the verification discipline a Design Review's own commit plan must account for
- ADR-0017 (`main` as a production branch), ADR-0019/ADR-0020 (spike-before-decide precedent)
