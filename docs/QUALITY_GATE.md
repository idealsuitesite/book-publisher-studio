# Quality Gate

The official checklist before every significant commit — not just before a PR merges (that's `docs/MERGE_CHECKLIST.md`'s narrower, merge-specific gate). This document exists so the checklist is codified in project governance instead of something that has to be remembered fresh in every session. It is the operational form of ADR-0032's **Engineering Governance Principle**: no feature is done until it is validated simultaneously at the Code, Product, and Documentation levels — see that ADR for the full rationale.

## The checklist

```
□ Build PASS            — npm run build, 0 TypeScript errors
□ Lint PASS              — npm run lint, 0 errors/warnings
□ Tests PASS             — npm test, 0 failing, 0 skipped without a documented reason
□ Coverage ≥ threshold   — npm run test:coverage (Domain >90%, global >80%, ADR-0006)
□ verify-server PASS     — npm run verify-server (real port, real route, real fixture — never assumed)
□ verify-real-export PASS — npm run verify-real-export (16/16 canonical-fixture checks)
□ Real Fixture Verification PASS (where applicable) — docs/REAL_FIXTURE_POLICY.md
□ No TODO introduced     — a TODO comment is a deferred decision with no owner; either do it, or write it down in docs/TODO.md with real scope, not leave a comment nobody will search for
□ ADRs synchronized      — a real architectural decision made this commit has an ADR; an existing ADR this commit contradicts has been updated or superseded, not silently ignored
□ Documentation synchronized — docs/CURRENT_STATE.md/docs/TODO.md reflect what actually shipped, with real verified numbers, not asserted ones
□ Public API unchanged (or the change is disclosed) — a route's request/response shape, a port's public method signature, or an exported type's public surface didn't silently change; if it did, it's called out in the commit message and, if user-facing, in Release Notes
```

Not every item applies to every commit — a docs-only commit has nothing to verify-real-export against. "Not applicable" is a valid answer; "I didn't check" is not.

## Why this is a gate, not a suggestion list

Every item above maps to something this project has already gotten wrong at least once:

| Item | What went wrong before it existed |
|---|---|
| Real Fixture Verification | Four real bugs (ADR-0019 6B/6C, ADR-0020 addendum, ADR-0031 bug 2) shipped past 100% synthetic-fixture test coverage |
| verify-server | A real-export check was once reported against the wrong port, never actually checked against the server's own startup log (`docs/DEVELOPMENT_WORKFLOW.md`'s "Server verification" section) |
| ADRs synchronized | `docs/architecture/diagrams/BASELINE_v0.1.md`'s stale test-count claim went unnoticed until ADR-0010 |
| Documentation synchronized | Same class of drift — `docs/MERGE_CHECKLIST.md` was written specifically to stop `CURRENT_STATE.md` claims from silently diverging from reality |
| No TODO introduced | Not yet a caught incident in this project, but the same failure mode as an ADR gap: a decision deferred with no record of *why* or *by when* |

## Three levels of validation

Introduced alongside this gate, matching the natural boundary between "does the code work in isolation," "does it work against real content," and "is it safe to ship":

**Level 1 — Development** (every local iteration, before any commit)
- Build
- Lint
- Unit tests

**Level 2 — Product** (before a commit is considered feature-complete, or before opening a PR)
- `npm run verify-server`
- `npm run verify-real-export`
- Real Fixture Verification against the relevant professional fixture(s), once `docs/REAL_FIXTURE_POLICY.md`'s fixture library exists (see that policy's "worked examples")

**Level 3 — Release** (before tagging a version)
- Coverage thresholds re-confirmed on the merged `main`, not just the feature branch
- Performance (no formal budget yet — flagged here as a placeholder until one exists; not a blocking gate today)
- Documentation reconciliation (`CURRENT_STATE.md`, `TODO.md`, `VERSIONS.md`)
- ADRs finalized for the release
- Changelog / Release Notes written (`docs/releases/<version>/ReleaseNotes.md`)
- Version tagged, matching `docs/VERSIONS.md`'s own "tag only after it's actually pushed" rule

This maps directly onto the existing sprint-closure pattern already used for every sprint in this project (Design Review → implementation commits, each green at Level 1 → real-file verification pass at Level 2 → tag/release-notes/docs pass at Level 3) — this document names the three levels explicitly rather than leaving the boundary implicit.

## Test taxonomy this gate assumes

See `docs/TESTING_STRATEGY.md` for the functional-vs-rendering and structural-vs-rendering test taxonomies referenced implicitly by "Tests PASS" and "Real Fixture Verification PASS" above.

## Related

- `docs/MERGE_CHECKLIST.md` — the narrower, merge-to-`main`-specific gate (every item here that's also there should stay consistent; this document is the broader per-commit discipline, that one is the PR-merge discipline)
- `docs/REAL_FIXTURE_POLICY.md` — the policy "Real Fixture Verification PASS" enforces
- `docs/REAL_EXPORT_CHECKLIST.md` — the process/template for a real-file pass
- `docs/TESTING_STRATEGY.md` — the test taxonomy this gate's test-related items assume
