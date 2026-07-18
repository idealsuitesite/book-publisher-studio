# Release Notes — v0.9.0-alpha

**Tag:** `v0.9.0-alpha`
**Date:** 2026-07-18
**Codename:** Publishing Engine

## Summary

This release builds the **Publishing Engine** — the first component in this project's history that sits *downstream* of `Renderer`. `POST /api/manuscripts/publish` takes a real DOCX manuscript and returns a real, itemized `PublishingReport` stating whether that manuscript is ready for submission to Amazon KDP: real required-metadata checks, real page-count bounds, real cover presence, real accepted-interior-format checks, each traced to a requirement verified directly from Amazon's own published documentation.

**The scope boundary held without a single exception:** no KDP account was created, no Amazon API was called, no credentials exist anywhere in the codebase, and no publication event occurs. This release validates and packages; it does not submit (Design Review Decision 5).

A Design Review preceded any code (`docs/architecture/diagrams/PUBLISHING_ENGINE.md`), locking 8 decisions across two formal rounds plus four mid-sprint CTO reviews — each recorded with the reasoning behind it, not just the ruling. Built across 9 commits on `feature/sprint-8-publishing-engine`, merged via PR #13. Full retrospective: `docs/releases/v0.9.0-alpha/SPRINT_8_FINAL_REPORT.md`.

## Features

- **`PublishingTarget`** (Domain port) — a new port operating **after** `Renderer`, not another `Renderer` implementation. Mirrors `Renderer<TOutput>`/`LayoutSelector`'s existing one-method port shape (ADR-0012).
- **`PublishingReport` / `PublishingIssue`** (Domain models) — a real business object (`status`/`target`/`issues`/`warnings`/`artifacts`/`generatedAt`/`duration`/`summary`), not a bare PASS/FAIL boolean. Shaped so a future platform can enrich it without breaking the API.
- **`Packaging` + `PublishingBundle`** — assembles a wholly generic publication package (`{manuscript, cover, metadata, assets, manifest}`) with **zero KDP-specific fields**. `manuscript` stays a `RenderedOutputs` carrying every rendered format, rather than one pre-chosen format, because deciding which format a platform needs is that platform's decision — not `Packaging`'s.
- **`SubmissionValidator` + 4 `PostRenderValidationRule`s** — mirrors `ValidationEngine`/`RuleRegistry`'s exact existing shape (ADR-0027/0028), one pipeline stage later. Closes `VALIDATION_ENGINE.md`'s own Sprint 5 Decision 2 commitment to defer `PostRenderValidation` to Publishing Engine. Each rule is generic: it takes its configuration by constructor rather than hardcoding KDP's values, so a future `KoboRuleProvider` reuses the same rule classes with Kobo's own data.
- **`ValidationRuleProvider` port + `KDPRuleProvider`/`KDPRuleData`** — platform requirements live behind a port as inert data. **No `if (platform === 'kdp')` branch exists anywhere in the engine.**
- **`KDPTarget`** — the only `PublishingTarget` implementation this release, built strictly as a platform *adapter*: it calls `Packaging.assemble()` and `SubmissionValidator.validate()` exactly once each and shapes their combined output, never re-validating, re-packaging, mutating the bundle, or rebuilding metadata.
- **`PublishingUseCase`** (Application) — mirrors `ExportManuscriptUseCase`'s exact shape with one additional responsibility: delegating to `PublishingTarget` once rendering completes.
- **`POST /api/manuscripts/publish`** — a new route, never a field on `/export` (Decision 4): export generates a file, publish prepares a distribution, and one request parameter can't honestly represent that difference. Returns `PublishingResponseDTO` (`packages/shared-types`), named generically so Kobo/Lulu/IngramSpark need no contract or controller change later.
- **`npm run verify-real-publish`** — real-fixture verification tooling, sibling of the existing `verify-real-export`.
- **Tests** — 386 passing, up from 336 (**+50**).

## Real Bugs and Gaps Found During Implementation

Disclosed, not hidden — continuing this project's now eight-sprint pattern (full detail in `SPRINT_8_FINAL_REPORT.md` §4):

1. **A wrong interface shape, caught by the Commit-0 spike before any code was written.** The Design Review's provisional `coverSpec: {minWidthPx, minHeightPx, minDpi}` assumed a fixed-pixel cover — correct for the *eBook* cover, wrong for the *paperback* cover, whose dimensions are **computed** from trim size + page count + paper type via a spine-width formula. Corrected to `paperbackCoverSpec` before implementation. This is exactly what the spike-before-decide discipline (ADR-0019/0020/0030) exists to catch.
2. **An architectural seam caught in CTO review between Commits 0 and 1.** Decision 6 had already isolated KDP's requirements as *data*, but `SubmissionValidator` still referenced that data's concrete name — an implicit platform dependency that would have forced an engine change the moment a second target was added. Fixed by introducing the `ValidationRuleProvider` port (Decision 7, ADR-0036) before any validator code existed.
3. **`PAGE_COUNT_UNKNOWN` on every real manuscript** (ADR-0038, **OPEN**) — found by Commit 7's real-fixture verification, **invisible to 386 passing tests**. `Book.pageCount` is populated only by `BookMetricsCalculator` on the *import* path, while the real page count lives in the `PaginatedBook` that `PublishingUseCase` computes, renders from, and discards. Deliberately **not fixed** in this release — see Known Issues.
4. **One test written against an assumption rather than the code.** A `KDPTarget` test asserted `issues` would be empty for a compliant manuscript; the real behavior correctly includes `WARNING`-severity findings in `issues` while still reporting `PASS`. The test was wrong, not the engine — corrected to assert the real contract.

## Architecture

- **Design Review before code** (`docs/architecture/diagrams/PUBLISHING_ENGINE.md`), approved with one CTO condition — an internal-responsibilities diagram with explicit **OWNS/NEVER** boundaries per component — satisfied before the first line of implementation.
- **`VISION.md`'s original framing was explicitly superseded, not quietly contradicted** (Decision 1). `docs/VISION.md` line 26 treated future platforms as just more `IRenderer` implementations; `PLATFORM_ARCHITECTURE_ROADMAP.md` §2.5 later wanted a post-`Renderer` port. This real documentary tension was surfaced during the review rather than resolved silently, and the CTO ruled explicitly.
- **Decomposed into 6 named components from the start** (Decision 6) — `PublishingUseCase`, `PublishingTarget`, `KDPTarget`, `Packaging`, `SubmissionValidator`, `PublishingReport` — so no single class accumulates the logic as platforms are added.
- **Two standing governance rules locked** — ADR-0036 (platform rules must be encapsulated behind a `RuleProvider` port) and ADR-0037 (every Publishing Engine object is platform-agnostic; platforms depend on the engine, never the inverse).
- **`Renderer<TOutput>`'s contract is unchanged** — everything in this release is new and additive, same "additive over signature-break" discipline as ADR-0022/0027/0029.
- **`main` as a production branch** (ADR-0017) held: built entirely on `feature/sprint-8-publishing-engine`, merged via PR #13.

## Quality Metrics

| Metric | Value |
|---|---|
| Backend tests | 386 passing, 0 failing (up from 336, **+50**), 44 files |
| Backend global coverage | 93.41% statements, 94.14% lines |
| Backend function coverage | 98.91% |
| Backend ESLint | 0 errors, 0 warnings |
| TypeScript | `tsc` clean on `backend/`, `frontend/`, `packages/shared-types` |
| `npm run verify-real-export` | 16/16, re-run and confirmed green on `main` after merge |
| `npm run verify-real-publish` | **4/4** — all 4 canonical fixtures through the real running server, each returning a structurally-validated `PublishingResponseDTO` |
| Frontend automated test suite | **still none** — unchanged from v0.8.0-alpha, disclosed not hidden |

## Known Issues / Deliberate Simplifications

- **Every real manuscript reports `FAIL` on missing `isbn`.** `ASTBuilder` has no DOCX-native signal for `BookMetadata.isbn` (a pre-existing gap since Sprint 5, not introduced here), so `RequiredMetadataFieldsRule` reports a real `ERROR` on all 4 canonical fixtures. This is correct behavior — the engine surfaces the real gap instead of fabricating a pass. Closing it needs an import-pipeline change (a metadata entry surface).
- **`PageCountRule` can never pass today** (ADR-0038, **OPEN**). The rule is correct — it reports "unknown" honestly rather than guessing — but it is fed less than the pipeline already knows. Deferred by explicit CTO decision: closing it means widening `PublishingTarget.prepare()`'s inputs, a **contract evolution** warranting its own Design Review rather than absorption into a validation-only commit. ADR-0038 frames the question and lists four candidate shapes without endorsing one. It also records a distinction any future fix must resolve: `BookMetricsCalculator` yields a word-count *estimate* while `PaginatedBook.pages` is the *real* result — the two will not agree.
- **Bleed, margin, and resolution rules are not built.** `KDPRuleData` carries the real spike-verified values (0.125in bleed, the 5-tier gutter table, 300 DPI minimum), but nothing in the pipeline attaches the `PageLayout` or resolution actually used to `RenderedOutputs`, so there is no real value to validate against. Recorded rather than implemented against an assumed layout.
- **Three KDP-required fields have no `BookMetadata` equivalent** — `Categories` (≤3), `Primary Audience`, `Primary Marketplace` (ADR-0035). Recorded in the requirement-traceability table rather than added speculatively.
- **`POST /api/manuscripts/publish` has no UI.** This release is backend-only; nothing in `frontend/` calls the new endpoint yet.
- **`duration` reads `0` ms in every report.** Real and correct — the post-render publish step (packaging + 4 rules over in-memory data) completes inside `Date.now()`'s 1 ms resolution. It measures `prepare()` only, exactly as `KDPTarget` defines it.

## What This Release Does Not Include

**No real submission to any platform** — no KDP account, no Amazon API call, no credentials, no publication event (Decision 5, held throughout). **No Kobo, Apple Books, Google Play Books, Lulu, or IngramSpark targets** — each is a future `PublishingTarget` + `ValidationRuleProvider` implementation pair, addable without changing the port or the engine. **No `Capability` pattern** (`supportsCover()`/`supportsBleed()`/etc.) — recorded as a future architectural orientation only, explicitly not implemented. **No `FrontMatter`/`BackMatter` activation** — the "natural landing spot" `PLATFORM_ARCHITECTURE_ROADMAP.md` §2.5 reserved for this engine remains reserved; still modeled, still unconsumed.

## Upgrade / Migration Notes

This release is additive at the API level — no existing route's request/response shape changed. `POST /api/manuscripts/publish` is new. `packages/shared-types` gains `PublishingResponseDTO`/`PublishingIssueDTO`; existing exports are untouched. Any consumer of `/api/manuscripts/import`, `/export`, or `/options` is unaffected.

Unlike `/export`'s `format` field (which defaults to `docx`), `/publish`'s `target` field has **no default** — there is no default publishing platform — so a missing or unrecognized `target` returns a real `400`, never a silent fallback.

## Links

- Architecture: `docs/architecture/diagrams/PUBLISHING_ENGINE.md`
- Sprint retrospective: `docs/releases/v0.9.0-alpha/SPRINT_8_FINAL_REPORT.md`
- Evidence trail: `docs/demo/VISIBLE_INCREMENTS.md` (Sprint 8 section)
- Decisions: `docs/DECISIONS.md` (ADR-0035, ADR-0036, ADR-0037, ADR-0038)
- Requirements spike: `backend/spikes/kdp-publishing-spike.ts`
- Current state (living doc): `docs/CURRENT_STATE.md`
- Pull request: #13 (`feature/sprint-8-publishing-engine` → `main`, merge commit `4a4deaa`)
- Previous release: `v0.8.0-alpha` (First Demonstrable Product, `docs/releases/v0.8.0-alpha/ReleaseNotes.md`)
