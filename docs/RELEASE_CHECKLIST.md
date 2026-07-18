# Release Checklist

The step-by-step closure sequence run after every sprint's PR merges, followed identically six times so far (Sprints 2 through 6, plus the Quality Sprint). This is `docs/QUALITY_GATE.md`'s "Level 3 — Release" turned into concrete, ordered steps.

## Sequence

1. **Sync and re-verify on `main`** — never assume the merge succeeded cleanly or that the branch you're looking at is current:
   ```bash
   git fetch origin && git checkout main && git pull origin main
   ```
   Then re-run the full Level 1 + Level 2 gate **on `main`, not the feature branch** — a merge can behave differently from the branch it came from (a conflict resolved differently than expected, a stale local cache):
   ```bash
   npm run build && npm run lint && npm test && npm run test:coverage
   npm run verify-server && npm run verify-real-export
   ```
   All of this must be green before proceeding — a red re-verification on `main` means something is wrong with the merge itself, not just cause to skip ahead.

2. **Tag the version** at the merge commit, annotated (not lightweight) with a one-line summary:
   ```bash
   git tag -a vX.Y.Z-alpha -m "<one-line summary>. See docs/releases/vX.Y.Z-alpha/ReleaseNotes.md."
   ```

3. **Write `docs/releases/<version>/ReleaseNotes.md`** — Summary, Features, any real bugs found and fixed during the sprint (with their ADR), Architecture notes, Quality Metrics table, Known Issues/Deliberate Simplifications, What This Release Does Not Include, Upgrade/Migration Notes, Links. See any existing `docs/releases/*/ReleaseNotes.md` for the exact shape — this project's releases have used a consistent structure since `v0.6.0-alpha`.

4. **Flip `docs/VERSIONS.md`'s row to ✅ Released**, filling in the real tag and merge commit — never before the tag is actually pushed (this file's own standing rule, in place since `v0.2.0-alpha`).

5. **Reconcile `docs/CURRENT_STATE.md` and `docs/TODO.md`** with real, verified numbers (test count, coverage) — not asserted, checked against the actual `npm run test:coverage` output from step 1. Move the sprint from "IN PROGRESS" to a dedicated completed section; update "Next Session Preparation" and "Git Status".

6. **Push `main`, the tag, and the docs commit:**
   ```bash
   git push origin main
   git push origin vX.Y.Z-alpha
   ```

7. **Delete the merged feature branch, local and remote:**
   ```bash
   git branch -d feature/<name>
   git push origin --delete feature/<name>
   ```

## A real failure mode this checklist accounts for

A docs-update commit pushed to the feature branch immediately before a merge can race the merge action itself — if the merge (a "Merge pull request" click, or an auto-merge trigger) captures the branch tip *before* that last push lands, the merged `main` silently ends up missing it, with no error anywhere. This happened once in this project (Sprint 6: a small "PR opened" status-wording commit didn't make it into PR #11's merge). **Step 1's re-verification on `main` is exactly what catches this** — re-read the actual files on `main` after the merge rather than trusting that whatever you last pushed to the feature branch made it in. If a gap is found, fold the missing content directly into this closure pass's own commit rather than trying to recover or cherry-pick the orphaned one.

## Related

- `docs/QUALITY_GATE.md` — the 3-level validation framework this checklist is Level 3 of
- `docs/DESIGN_REVIEW_PROCESS.md` — what happens before implementation, upstream of this checklist
- `docs/VERSIONS.md` — "Updating this file" section, the standing rule step 4 follows
- `docs/releases/v0.7.0-alpha/ReleaseNotes.md` — the most recent worked example of this sequence
