# Merge-to-`main` Checklist

Formalizes what ADR-0017 (`main` as a production branch) implied but didn't spell out as gate criteria. Every merge from a feature branch into `main` must satisfy all of these — not a suggestion list, a gate.

See `docs/QUALITY_GATE.md` for the broader per-commit checklist this merge-specific gate is drawn from (Real Fixture Verification, no stray TODOs, ADR/doc sync, public-API-unchanged) — this file stays focused on what's specifically required at merge time.

## Required for every merge

- [ ] **Build passes** — `npm run build` (backend), zero TypeScript errors
- [ ] **Tests pass** — `npm test -- --run`, 0 failing. New code has tests; don't merge coverage regressions in silently
- [ ] **Lint passes** — `npm run lint`, 0 errors (warnings are tracked, not blocking — see `docs/TODO.md`'s Quality Sprint item, but don't add *new* warnings beyond what's already tracked)
- [ ] **Coverage thresholds hold** — Domain >90%, global >80% (`npm run test:coverage`), matching the bar set in Phase 2's Definition of Done
- [ ] **CI is green** — `.github/workflows/backend-ci.yml` passing on the PR/branch, not just locally

## Conditional — only if applicable, but don't skip the check

- [ ] **`docs/REAL_EXPORT_CHECKLIST.md` completed and attached to the PR** if the change touches `DOCXRenderer`, `PDFRenderer`, `EPUBRenderer`, `ThemeEngine`, `LayoutEngine`, `TypographyResolver`, the `Renderer` port, `ExportManuscriptUseCase`, or (per `docs/REAL_FIXTURE_POLICY.md`, broadened post-Sprint-6) the import pipeline or Table of Contents generation. This project has already missed 4 real bugs (PDF "Page 6 of 4", empty EPUB, PDFKit infinite pagination, permanently-empty TOC on real import — ADR-0031) that synthetic fixtures alone did not catch — all four were only found by exporting a real manuscript through the running dev server (or, where the HTTP round trip can't reach the changed field, a direct real-pipeline composition) and inspecting the actual output. `npm test` passing is necessary but never sufficient for this category of change. See `docs/REAL_EXPORT_CHECKLIST.md` for the required steps and template, and `docs/REAL_FIXTURE_POLICY.md` for the full trigger scope.
- [ ] **ADR written** if the change makes an architectural decision (new pattern, new dependency, a trade-off that could reasonably have gone another way). Not every change needs one — a bug fix doesn't. A new port, a new engine, a naming convention, a layering rule: yes.
- [ ] **Release Notes updated** if user-facing/API behavior changes (new endpoint, changed response shape, new export format). Internal refactors with no behavior change don't need this.
- [ ] **`docs/CURRENT_STATE.md` updated** with real, verified numbers (test count, coverage) — not asserted, checked. This project has a documented history of doc claims drifting from reality; don't add to it.
- [ ] **`docs/TODO.md` updated** — move completed items to Done, add anything newly discovered
- [ ] **`docs/VERSIONS.md` updated** if the merge completes a milestone (new tag)

## Process

- [ ] Feature developed on a dedicated branch (`feature/...`), not directly on `main` (ADR-0017)
- [ ] Design reviewed against the relevant ADR(s) before implementation started, not after
- [ ] Commits are atomic and use Conventional Commit messages (established pattern: `feat(...)`, `fix(...)`, `chore(...)`, `refactor(...)`, `docs(...)`)

## What this checklist does not require

- 100% coverage (91.56%/87.23% is the current bar, not perfection)
- Fixing pre-existing warnings as a condition of an unrelated merge (that's its own tracked task)
- A design doc for every trivial change — proportionality matters; this checklist exists to prevent another `159a49b3`-style silent divergence, not to add ceremony to small fixes
