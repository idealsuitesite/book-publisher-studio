# Sprint 8 Final Report — Publishing Engine

**Version:** `v0.9.0-alpha`
**Merge commit:** `4a4deaa` (PR #13)
**Date:** 2026-07-18
**Branch:** `feature/sprint-8-publishing-engine` (deleted after merge)

---

## 1. Initial Objectives

Close the gap between what this project has promised since Sprint 4 (`docs/VERSIONS.md` has named "Kindle / Kobo / Lulu / IngramSpark / Amazon KDP export targets" that long) and what actually existed: three format renderers producing generically correct output, and **zero** platform-specific packaging.

The objective was to prepare a finished book for distribution to one real platform — real metadata requirements, real cover specs, real pre-submission validation — rather than "export a PDF and hope it's accepted."

This was genuinely new territory, not an extension of an existing engine. Sprint 6 extended `LayoutEngine`; Sprint 8 built the first component ever to sit *downstream* of `Renderer`.

---

## 2. What Was Delivered

Nine commits, each adding exactly one responsibility, none revisiting an earlier decision:

| # | Commit | Delivered |
|---|---|---|
| 0 | `baa48ac` | KDP requirements spike (ADR-0035) — real cover/interior/metadata specs from 5 `kdp.amazon.com` pages |
| 1 | `2c5e434` | `PublishingTarget` port + `PublishingReport`/`PublishingIssue`/`RenderedOutputs` (Domain) |
| — | `ff3fad5` | `PublishingReport` enriched (`artifacts`/`generatedAt`/`duration`/`summary`); Decision 8/ADR-0037 locked |
| 2 | `86e0116` | `Packaging` + `PublishingBundle`/`PublishingBundleManifest` — generic, zero KDP knowledge |
| 3 | `5abd067` | `SubmissionValidator` + 4 `PostRenderValidationRule`s + `ValidationRuleProvider` port + `KDPRuleProvider`/`KDPRuleData` |
| 4 | `99f0df7` | `KDPTarget` + `createKDPTarget()` — platform adapter |
| 5 | `68be289` | `PublishingUseCase` (Application) |
| 6 | `9133931` | `POST /api/manuscripts/publish` + `PublishingResponseDTO` + `PublishingReportMapper` (Presentation) |
| 7 | `6a7dc89` | `verify-real-publish` tooling + 4/4 real-fixture pass — **no engine code changed** |
| 8 | `70992f1` | Docs/ADR reconciliation — **documentation only** |

Plus `b874e02` (Decision 7 + ADR-0036, locked mid-sprint before any validator code existed).

**The 4 real validation rules**, each generic — configuration by constructor, not hardcoded — so a future `KoboRuleProvider` reuses the same classes with Kobo's own data:

| Rule | Finding | Severity |
|---|---|---|
| `RequiredMetadataFieldsRule` | missing `title`/`author`/`isbn`/`language` | ERROR |
| `PageCountRule` | outside KDP's real 24–828 range | ERROR (unknown → WARNING) |
| `CoverPresenceRule` | no cover image | WARNING |
| `InteriorFormatAvailabilityRule` | neither PDF nor DOCX rendered | ERROR |

---

## 3. ADRs Created This Sprint

| ADR | Title | Status |
|---|---|---|
| ADR-0035 | KDP Publishing-Requirements Spike Findings | APPROVED |
| ADR-0036 | Platform-Specific Publishing Rules Must Be Encapsulated Behind a `RuleProvider` Port | APPROVED |
| ADR-0037 | Publishing Engine Domain Objects Are Platform-Agnostic; Platforms Depend on the Engine, Never the Inverse | APPROVED |
| ADR-0038 | Publishing Engine Cannot See `LayoutEngine`'s Real Pagination Metrics | **OPEN** — deferred |

ADR-0036 and ADR-0037 are *engineering governance principles* in the sense ADR-0032 established: standing rules for all future work, not one-sprint choices.

ADR-0038 is deliberately **OPEN**, not APPROVED. At CTO direction it *frames* a question rather than answering it, recording the confirmed gap, the constraints any answer must respect, and four candidate shapes without endorsing one.

---

## 4. Real Bugs and Gaps Found During the Sprint

**1. A wrong interface shape, caught by the spike before any code was written.** The Design Review's provisional `coverSpec: {minWidthPx, minHeightPx, minDpi}` assumed a fixed-pixel cover. Real KDP documentation says that's the **eBook** cover; the **paperback** cover is a PDF, CMYK, with dimensions *computed* from trim size + page count + paper type via a spine-width formula (`pageCount × 0.002252`–`0.0025` depending on paper). Corrected to `paperbackCoverSpec` before implementation. Exactly what spike-before-decide (ADR-0019/0020/0030) exists to prevent.

**2. An architectural seam, caught in CTO review between Commits 0 and 1.** Decision 6 had already isolated KDP's requirements as *data* — but `SubmissionValidator` still had to reference that data by its concrete name, an implicit dependency on "which platform" that would have forced an engine change the moment a second target appeared. This was the exact drift Decision 6 was written to prevent, surviving one layer down. Fixed by introducing the `ValidationRuleProvider` port (Decision 7, ADR-0036) *before* any validator code existed — a design correction, not a refactor.

**3. `PAGE_COUNT_UNKNOWN` on every real manuscript** (ADR-0038, **OPEN**) — the sprint's most significant finding, and **invisible to 386 passing tests**. Found only by Commit 7's real-fixture pass. `Book.pageCount` is populated only by `BookMetricsCalculator` on the *import* path; the real page count lives in the `PaginatedBook` that `PublishingUseCase` computes, renders from, and then discards, since only `book` and the rendered bytes reach `prepare()`. The rule is correct — it reports "unknown" honestly rather than guessing. Deferred deliberately (see §6).

**4. A test written against an assumption rather than the code.** A `KDPTarget` test asserted `issues` would be empty for a compliant manuscript. The real contract includes `WARNING`-severity findings in `issues` while still reporting `PASS`. The test was wrong, not the engine — corrected to assert real behavior, and the reasoning recorded in the test itself.

**This is the fifth sprint in which real-file verification caught something synthetic fixtures did not** (ADR-0019, ADR-0020, ADR-0031, ADR-0032, now ADR-0038). The pattern is now unambiguous enough that `docs/REAL_FIXTURE_POLICY.md`'s Publishing-Engine scope line — written *before* this sprint — proved correct on its first application.

---

## 5. Final Metrics

| Metric | Sprint 7 close | Sprint 8 close | Δ |
|---|---|---|---|
| Backend tests | 336 | **386** | +50 |
| Test files | 33 | **44** | +11 |
| Statement coverage | 92.88% | **93.41%** | +0.53 |
| Function coverage | — | **98.91%** | — |
| ESLint errors/warnings | 0 | **0** | — |
| `verify-real-export` | 16/16 | **16/16** | — |
| `verify-real-publish` | n/a | **4/4** | new |

All re-verified on `main` after merge, not only on the feature branch (`docs/RELEASE_CHECKLIST.md` step 1).

---

## 6. Deliberately Deferred to Future Work

- **Exposing `LayoutEngine`'s real pagination metrics to the Publishing Engine** (ADR-0038, **OPEN**). Closing it means widening `PublishingTarget.prepare()`'s inputs — modifying an internal API, enriching transported objects, propagating a new value across layers. That is a **contract evolution**, not a small correction, and Sprint 8's objective was to *create* a Publishing Engine, not to *modify the rendering pipeline*. A future fix must also decide *which* page count to validate against: `BookMetricsCalculator` yields a word-count **estimate**, `PaginatedBook.pages` the **real** result — they will not agree.
- **Bleed, margin, and resolution rules.** `KDPRuleData` carries the real verified values, but the pipeline attaches no `PageLayout`/resolution data to `RenderedOutputs` to check them against. Not faked against an assumed layout.
- **Real submission to KDP.** No account, no API, no credentials, no publication event — Decision 5, held without exception.
- **Kobo, Apple Books, Google Play Books, Lulu, IngramSpark.** Each is a future `PublishingTarget` + `ValidationRuleProvider` pair, addable without touching the port or the engine.
- **A `Capability` pattern** (`supportsCover()`/`supportsBleed()`/`supportsISBN()`/…) — recorded as future architectural orientation only. No `Capability` type exists anywhere in `src/`.
- **Frontend for `/publish`.** Sprint 8 was backend-only.
- **`Categories`/`Primary Audience`/`Primary Marketplace` on `BookMetadata`** — three KDP-required fields with no Domain equivalent (ADR-0035). Recorded in the traceability table rather than added speculatively.

---

## 7. Residual Risks

1. **Every real manuscript fails KDP readiness on `isbn`.** Pre-existing since Sprint 5 (`ASTBuilder` has no DOCX-native signal), not introduced here. The engine reports the real gap rather than fabricating a pass — correct, but it means the endpoint cannot yet return `PASS` for any real import. Closing it requires an import-pipeline metadata entry surface.
2. **`PageCountRule` is permanently non-passing** until ADR-0038 is resolved. A `WARNING`, never an `ERROR`, so it never blocks a report.
3. **Still no frontend test suite** — unchanged from v0.8.0-alpha, and unchanged by this backend-only sprint. Tracked in `docs/TODO.md`.
4. **`KDPRuleData` will drift as Amazon changes its specs.** Mitigated by design (Decision 6/7: data behind a port, not conditionals in the engine), so a spec change is a data update. The mitigation is structural, but the *detection* is manual — nothing alerts us when Amazon changes a requirement. Re-running `backend/spikes/kdp-publishing-spike.ts` is the documented remedy.
5. **Only one `PublishingTarget` implementation exists**, so the port's extensibility is argued from design, not yet demonstrated by a second real implementation. The `ValidationRuleProvider` abstraction *is* proven independently — `SubmissionValidator`'s test suite drives it with a fake provider containing no KDP class at all.

---

## 8. Lessons Learned

**Real-file verification earned its place again — the fifth time.** ADR-0038's gap passed 386 tests, full type-checking, and lint. It surfaced the moment a real DOCX went through a real server. The policy that mandated that pass was written *before* this sprint and named Publishing Engine explicitly; it paid off on first use.

**Reviewing between commits caught what reviewing at the end would have missed.** The `ValidationRuleProvider` seam (ADR-0036) was found after Commit 0 and before Commit 1 — when fixing it cost a design edit rather than a refactor of a written validator. The same is true of the enriched `PublishingReport` and of `PublishingBundle`'s shape, both locked before their implementing commit.

**Asserting shape rather than success made the verification honest.** `verify-real-publish` deliberately never asserts `PASS` — a green result would indicate a bug, given the known `isbn` gap. Writing the check to demand success would have forced either a fake fixture or a weakened rule. Verifying *structure* let the real `FAIL` stand as the correct answer.

**Naming a contract generically before needing it costs nothing.** `PublishingResponseDTO` rather than `KDPPublishingResponse` was a five-second decision at CTO direction; it means the whole HTTP contract and controller survive the arrival of Kobo unchanged.

**A deferral is a decision, and deserves a record.** ADR-0038 is `OPEN` rather than absent. The gap, the constraints, the candidate shapes, and the estimate-vs-real subtlety are all captured while the context is fresh — instead of leaving a future session to rediscover them from a puzzling warning.

---

## 9. Links

- Release notes: `docs/releases/v0.9.0-alpha/ReleaseNotes.md`
- Design Review: `docs/architecture/diagrams/PUBLISHING_ENGINE.md`
- Evidence trail: `docs/demo/VISIBLE_INCREMENTS.md` (Sprint 8 section)
- Decisions: `docs/DECISIONS.md` (ADR-0035, ADR-0036, ADR-0037, ADR-0038)
- Requirements spike: `backend/spikes/kdp-publishing-spike.ts`
- Verification tooling: `backend/scripts/verify-real-publish.ts`
- Level 1 map: `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` §2.5
- Pull request: #13 (merge commit `4a4deaa`)
- Previous sprint: `docs/releases/v0.8.0-alpha/SPRINT_7_FINAL_REPORT.md`
