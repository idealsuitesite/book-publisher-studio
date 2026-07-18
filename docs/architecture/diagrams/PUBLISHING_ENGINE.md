# Publishing Engine — Level 2 Design Review

**Status:** ✅ APPROVED (2026-07-18) — conditional sign-off, condition satisfied same day. The CTO's completed verdict: *"Je signerais cette Review avec une seule réserve : Le terme 'Publishing Engine' est encore un peu trop large. Avant la première ligne de code, je demanderais à Claude d'ajouter un diagramme montrant clairement les responsabilités internes (orchestrateur, validation, packaging, rapport, cible de publication)... En dehors de ce point, la démarche est rigoureuse... C'est exactement le rôle attendu d'une Design Review de niveau 2."* The requested Internal Responsibilities Diagram (with explicit OWNS/NEVER boundaries per component) is in §3, immediately below Decision 6. Commit 0 (the KDP spike) was then explicitly authorized and completed (ADR-0035).
**Update (same day, before Commit 1):** reviewing Commit 0's findings, the CTO added one more requirement before any implementation code is written — Decision 7 below (`ValidationRuleProvider` port, no platform conditionals in the engine) and ADR-0036 (the standing governance rule this locks in). The CTO's exact instruction: *"Le Publishing Engine ne doit contenir aucune logique spécifique à KDP. Toute règle dépendante d'une plateforme doit être isolée derrière des interfaces dédiées (RuleProvider, Specification ou équivalent), afin que Kobo, Apple Books, Lulu et IngramSpark puissent être ajoutés sans modifier le cœur du moteur."* Commit 1 is authorized to proceed with this requirement incorporated.
**Update (Commit 1 review, same day):** Commit 1 (`PublishingTarget` + `PublishingReport`/`PublishingIssue`) is approved. Two follow-ups locked before Commit 2: `PublishingReport` is enriched (`artifacts`/`generatedAt`/`duration`/`summary`, ADR-0037), and `prepare()` is documented as Sprint 8's only operation, not necessarily `PublishingTarget`'s final API (Decision 1 note). Decision 8 generalizes Decision 7's dependency-direction rule to every Publishing Engine object, applied immediately to Commit 2's `PublishingBundle` shape. Commit 2 is authorized to proceed with these requirements incorporated.
**Update (Commit 2 review, same day):** Commit 2 (`Packaging` + `PublishingBundle`) is approved in full — "aucune hypothèse KDP," `RenderedOutputs` kept unpicked, the disclosed-gap cover test all cited as exactly right. `PublishingBundle`'s five fields are documented (§5). Before Commit 3, the CTO re-confirmed the exact hierarchy Decision 7 already locked, in diagram form: *"`SubmissionValidator` → `ValidationRuleProvider` → `PostRenderValidationRule` → `KDPRuleProvider`, et jamais `SubmissionValidator` → `KDPRuleProvider`."* No new decision — Commit 3 implements Decision 7 exactly as already written, and this confirmation is recorded so the constraint's re-statement has its own citable trail. A `Capability` pattern (`PublishingTarget.supportsCover()`/`supportsBleed()`/`supportsISBN()`/etc.) is recorded as a future architectural orientation only — explicitly not implemented this sprint, matching `prepare()`'s API-evolution note (Decision 1) as a second, related example of planned-not-guessed future evolution.
**Update (Commit 3 review, same day):** Commit 3 (`SubmissionValidator` + rule family + `ValidationRuleProvider`/`KDPRuleProvider`/`KDPRuleData`) is approved. Before Commit 4, the CTO required the full pipeline chain be respected exactly — *"Renderer → RenderedOutputs → Packaging → PublishingBundle → SubmissionValidator → PublishingReport → KDPTarget"* — and that `KDPTarget` be built as a genuine platform adapter: receives a bundle and a report's raw findings, applies KDP-specific shaping, produces a publication-readiness result; never re-validates, never mutates the `PublishingBundle`, never rebuilds metadata, never re-packages. Commit 4 is authorized on this condition.
**Update (Commit 4 review, same day):** Commit 4 (`KDPTarget` + `createKDPTarget()`) is approved — `prepare()` calls `Packaging.assemble()` and `SubmissionValidator.validate()` exactly once each and shapes their output into a `PublishingReport`; three dedicated tests assert this ("calls `Packaging.assemble()` exactly once," "calls `SubmissionValidator.validate()` exactly once, with the exact bundle Packaging produced," "uses `SubmissionValidator`'s findings verbatim — never adds, drops, or re-derives an issue") using spy collaborators, not just inspection.
**Update (Commit 4 review / Commit 5 confirmation, same day):** Commit 4 approved (see above). The CTO confirmed the exact pipeline for Commit 5: *"Controller → PublishingUseCase → Renderer (ou Export existant) → RenderedOutputs → KDPTarget.prepare() → PublishingReport,"* with `PublishingUseCase` never containing KDP rules, never packaging, never calling `SubmissionValidator` directly, never knowing rule detail — an Application layer that orchestrates Domain components exactly as `ExportManuscriptUseCase` already does. Built to that exact shape: renders one PDF via the existing `Renderer<Buffer>` port, then delegates everything else to `PublishingTarget.prepare()`.
**Update (Commit 5 review / Commit 6 confirmation, same day):** Commit 5 (`PublishingUseCase`) is approved. The CTO required Commit 6 stay strictly in the Presentation layer — *"Controller → PublishingUseCase → PublishingReport → DTO → HTTP Response,"* the controller only receiving the request, calling the use case, mapping the response, returning the DTO; never a `PublishingBundle`, never a direct `KDPTarget`/`SubmissionValidator`/`Packaging` call — and that the HTTP contract be named generically now, `PublishingResponseDTO`, not `KDPPublishingResponse`, so Kobo/Lulu/IngramSpark need no controller change later. Built to that exact shape: `PublishingReportMapper` is the only place a `PublishingReport` becomes a DTO; `PublishController` never imports `KDPTarget`/`SubmissionValidator`/`Packaging` (grep-confirmed empty).
**Date:** 2026-07-18 (round 1) / 2026-07-18 (round 2 decisions) / 2026-07-18 (approved) / 2026-07-18 (Decision 7 added, Commit 1 authorized) / 2026-07-18 (Decision 8 added, Commit 2 authorized) / 2026-07-18 (Commit 3 authorized) / 2026-07-18 (Commit 4 authorized) / 2026-07-18 (Commit 5 authorized) / 2026-07-18 (Commit 6 authorized)
**Sprint:** Sprint 8 — confirmed as this sprint's target by explicit CTO direction, following Sprint 7's release (`v0.8.0-alpha`).

---

## 1. Objectives

Close the gap between what this project has always said it would do (`docs/VERSIONS.md`'s own `v0.9.0-alpha`-and-later roadmap has named "Kindle / Kobo / Lulu / IngramSpark / Amazon KDP export targets" since Sprint 4) and what actually exists today: three format renderers (PDF/DOCX/EPUB) that produce generically correct output, and zero platform-specific packaging. Prepare a finished book for distribution to at least one real platform — real metadata requirements, real cover specs, real pre-submission validation — not just "export a PDF and hope it's accepted."

This is genuinely new territory, not an extension of an existing engine (unlike Sprint 6's Professional Layout Engine, which extended `LayoutEngine`). `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` §2.5 mapped this at Level 1 (2026-07-17, approved) without deciding implementation detail — that's this document's job.

---

## 2. Current State — Evidence, Not Assumptions

Every claim below was confirmed by reading the actual code or the actual docs, not inferred from a name.

**`docs/VISION.md`'s original framing (confirmed via `grep`, no dedicated "Publishing Engine" section exists in that document at all):**
> "**Later:** Kindle, Apple Books, Kobo, Lulu, IngramSpark, Amazon KDP — each a new `IRenderer` implementation behind the same port, no Domain changes required" (`docs/VISION.md` line 26)

This treats every platform as **just another format**, at the same architectural level as PDF/DOCX/EPUB today — no separate engine, no post-render step, no new port. **Superseded by Decision 1 below.**

**`PLATFORM_ARCHITECTURE_ROADMAP.md`'s later framing (§2.5):** a `PublishingTarget` port, analogous to `Renderer<TOutput>` but operating **after** rendering. **This is the framing Decision 1 locks.**

**Confirmed by reading `backend/src/domain/models/Book.ts` directly, not assumed:**
- `FrontMatter` (`cover`/`titlePage`/`copyrightPage`/`dedication`/`toc`/`preface`/`foreword`/`introduction`/`acknowledgments`) and `BackMatter` (`bibliography`/`glossary`/`index`) are real, fully-typed interfaces on `Book`.
- `grep`-confirmed: **zero** references to `frontMatter`, `backMatter`, `titlePage`, `copyrightPage`, `bibliography`, or `glossary` in any of `DOCXRenderer.ts`, `PDFRenderer.ts`, `EPUBRenderer.ts`. Only `frontMatter.toc` is consumed anywhere (Sprint 6's automatic TOC generation).
- `BookMetadata` already carries `isbn`/`issn`/`coverImage`/`copyright`/`license`/`publicationDate` — real fields a platform submission would need — but `ASTBuilder` never populates most of them from a real DOCX import (Sprint 5's `MetadataRule` already flags this on every real import). Publishing Engine inherits this gap; it doesn't cause it and can't fix it alone.

**Confirmed by reading `ExportManuscriptUseCase.ts` directly:** the current pipeline is `parse → normalize → build → theme → typography → paginate → render(Buffer)`. Nothing downstream of `this.renderer.render(...)` exists today.

**Confirmed by reading `ExportController.ts` directly:** `POST /api/manuscripts/export` today takes `theme`/`format`/`layout` and returns raw rendered bytes. No platform concept exists anywhere in the current HTTP surface.

**A real, already-decided dependency, not new to this review:** `docs/architecture/diagrams/VALIDATION_ENGINE.md`'s own Decision 2 (Sprint 5, approved) explicitly deferred `PostRenderValidation` to "likely `Publishing Engine`." **This is the commitment Decision 3 below closes.**

**A real, unreconciled backlog overlap, confirmed by reading `docs/TODO.md` directly:** the Backlog section independently lists "Kindle / Kobo / Lulu / IngramSpark / Amazon KDP export targets" (line 188) alongside the Level-1-mapped Publishing Engine item — reconciled by Decision 2 below (KDP first, others become future `PublishingTarget` implementations, same list).

---

## 3. Locked Decisions (Round 2, 2026-07-18)

Each decision below records the CTO's own stated reasoning, not just the outcome — matching this project's own discipline that "a round that changes nothing is still worth recording" and that rationale, not just the ruling, is what a future contributor needs.

### Decision 1 — `PublishingTarget` is a new Domain port, not another `Renderer<TOutput>` implementation

**Locked.** `VISION.md`'s original "just another `IRenderer`" framing is superseded.

**CTO's rationale (verbatim reasoning):** `Renderer` today does exactly one thing — `Book → Renderer → PDF/DOCX/EPUB`. Publishing Engine does something categorically different — `Book → Renderer → Output → PublishingTarget → Validation → Packaging → PublishingReport`. These are two completely different responsibilities: one produces a file, the other prepares and validates a *distribution*. Conflating them into one port would force every `Renderer` implementation (including the 3 that only ever need to produce bytes) to carry distribution concerns that don't belong to them.

**API-evolution note (CTO, Commit 1 follow-up, 2026-07-18):** `prepare()` is Sprint 8's only operation on `PublishingTarget`, not necessarily this port's final shape. A future split into `validate()`/`package()`/`publish()` as the engine matures is anticipated, not ruled out — recorded here so that evolution, if it happens, is a planned interface change with its own Design Review, not a surprise breaking change discovered mid-sprint. Mirrored as a code comment directly on the interface (`backend/src/domain/ports/PublishingTarget.ts`).

**Future direction, not implemented (CTO, Commit 2 follow-up, 2026-07-18) — a `Capability` pattern:** the CTO flagged a second, related future evolution for `PublishingTarget`, explicit that this is orientation only, no code: a `Capabilities` query surface (`supportsCover()`, `supportsBleed()`, `supportsMetadata()`, `supportsISBN()`, `supportsFixedTrim()`, or similar) so KDP, Kobo, and Apple Books can each declare what they actually support without the engine encoding platform differences anywhere in its own logic. Not designed or scheduled — recorded so a future Design Review adding a second real `PublishingTarget` implementation starts from this note instead of rediscovering the need. No `Capability` type exists anywhere in `src/` as of this ADR.

### Decision 2 — Amazon KDP only for Sprint 8; a real spike is required first

**Locked.** Kobo, Apple Books, Lulu, and IngramSpark are explicitly out of scope for this sprint — each becomes a future `PublishingTarget` implementation (`KoboTarget`, `AppleBooksTarget`, `LuluTarget`, `IngramTarget`) added later without touching the port itself, per Decision 6's decomposition below. A real Commit-0 spike (`backend/spikes/kdp-publishing-spike.ts`) verifying KDP's actual current metadata requirements, cover image spec, and file-naming/submission rules is required before any `KDPTarget`/`KDPRuleSet` code is written — matching the ADR-0019/0020/0030 precedent exactly, confirmed necessary by the CTO alongside this decision.

### Decision 3 — `PostRenderValidation` belongs to Publishing Engine, as a new rule family (not `ValidationEngine`)

**Locked.**

**CTO's rationale:** `ValidationEngine` validates the **manuscript** (the `Book` AST, pre-render). Publishing Engine validates the **rendered output** (post-render — real page count, real embedded-font validity, real EPUB structural validity, real KDP-specific compliance). These are two different things being validated, at two different pipeline stages, by two different engines — not a duplication, a genuinely new rule family living in Publishing Engine, orchestrated the same way `ValidationEngine` orchestrates `ValidationRule`s (mirrors `RuleRegistry`'s existing shape, per Decision 6's `SubmissionValidator` component below), closing `VALIDATION_ENGINE.md`'s Decision 2 open commitment without moving it into `ValidationEngine` itself.

### Decision 4 — A new route, `POST /api/manuscripts/publish` — never a field on `/export`

**Locked.**

**CTO's rationale:** Export and Publish are two completely different Use Cases. `Export → generates a file.` `Publish → prepares a distribution.` A single request parameter can't honestly represent that difference — `/export`'s contract (raw bytes, generic `Content-Type`) is correct for what it does and shouldn't grow a platform-aware branch. `/publish` returns something structurally different: a real `PublishingReport` (and, later, a packaged submission bundle), not a file stream.

### Decision 5 — No real KDP submission in Sprint 8. Validation and packaging only.

**Locked, 100%, no reservations stated.**

**CTO's explicit boundary (verbatim):** Sprint 8 must **NOT**: create a KDP account, call Amazon, send a book, or use any credentials. Sprint 8 must **only** produce a `PublishingReport` — PASS / FAIL / Warnings. No remote API calls, no authentication, no real publication event, under any circumstance this sprint.

### Decision 6 (new, CTO-initiated) — Publishing Engine is decomposed into 5 named components from the start, not a single monolithic class

**Locked.** The CTO's own stated concern: a first draft that mixes validation, packaging, KDP-specific rules, orchestration, and reporting into one undifferentiated "Publishing Engine" would need refactoring the moment a second platform (Kobo, Apple Books, Lulu) is added. Decomposing now, even with only one real target, means future platforms are new implementations of an existing shape, not a rewrite of the core — the same reasoning that has governed every port this project has built (`Renderer<TOutput>`, `LayoutSelector`).

The CTO's own component list, mapped onto this project's existing Clean Architecture layering (Domain/Application/Infrastructure — the mapping itself is this document's contribution, not restated from the CTO's message, which named the components but not their layer):

| Component | Layer | Shape, mirroring an existing precedent in this codebase |
|---|---|---|
| `PublishingTarget` | Domain — **port** | One method, e.g. `prepare(book: Book, renderedOutputs: RenderedOutputs): PublishingReport` — mirrors `Renderer<TOutput>`/`LayoutSelector`'s existing port shape (ADR-0012) |
| `KDPTarget` | Domain — **concrete class, only implementation this sprint** (resolved, Commit 4 — no Infrastructure-level I/O needed, same conclusion `KDPRuleProvider` already reached) | Implements `PublishingTarget`; calls `Packaging` and `SubmissionValidator` exactly once each and shapes their combined output into a `PublishingReport` — a platform adapter, never a replacement for either (CTO requirement, Commit 3→4 review) |
| `Packaging` | Domain (pure) or Infrastructure (if real file I/O is needed for a submission bundle) | Assembles a `PublishingBundle` (book file + cover file + metadata) from the `Book` + a `Renderer`'s output — a data-shaping step, not validation |
| `SubmissionValidator` | Domain — **concrete class**, orchestrates a rule registry | Mirrors `ValidationEngine`/`RuleRegistry`'s exact existing shape (ADR-0027/0028) — runs a `PostRenderValidationRule[]` obtained from a constructor-injected `ValidationRuleProvider` (Decision 7), never referencing any platform-specific data by name. This is Decision 3's rule family, named per the CTO's own naming here |
| `PublishingReport` | Domain — **model** | Mirrors `ValidationReport`/`QualityScore`'s existing shape — `status: 'PASS' \| 'FAIL'`, `issues: PublishingIssue[]`, `warnings: string[]` |
| `PublishingUseCase` | Application — **use case** | Mirrors `ExportManuscriptUseCase`'s exact existing shape (`UseCase<TRequest, TResponse>`) — orchestrates the existing pipeline (parse→normalize→build→theme→typography→paginate→render) then hands the result to `PublishingTarget.prepare()` |
| `ValidationRuleProvider` | Domain — **port** (new, Decision 7) | One method, `getRules(): PostRenderValidationRule[]` — mirrors `PublishingTarget`/`Renderer<TOutput>`/`LayoutSelector`'s existing port shape (ADR-0012); more than one real implementation is plausible the moment Kobo/Apple Books/Lulu/IngramSpark are added, matching `docs/DEVELOPER_HANDBOOK.md`'s port-vs-class rule |
| `KDPRuleProvider` | Domain — **concrete class, only implementation this sprint** (new, Decision 7; corrected from a provisional "Infrastructure" label — Commit 3 confirmed no file I/O is needed, same conclusion `ManualLayoutSelector` already reached for `LayoutSelector`) | Implements `ValidationRuleProvider`; wraps `KDPRuleData` (ADR-0035's verified spike values, §5) and constructs the real `PostRenderValidationRule` instances from it |

**A KDP-specific consequence of this decomposition, folded in from the CTO's separate risk note below (§6), refined by Decision 7:** KDP's own real requirements (cover spec, required metadata fields, file-naming rules) live in an isolated, swappable `KDPRuleData` — data, not hardcoded conditionals inside `KDPTarget`/`SubmissionValidator` — so a future KDP spec change is a data update, not an engine change. Mirrors this project's existing registry pattern (`getTheme`, `ManualLayoutSelector`'s registry) rather than inventing a new one. `SubmissionValidator` itself never references `KDPRuleData` or `KDPRuleProvider` by name — see Decision 7.

### Decision 7 (new, CTO-initiated, locked before Commit 1) — Platform-specific rules are injected via a `ValidationRuleProvider` port, never referenced directly by name

**Locked.** Decision 6's original `SubmissionValidator` shape described it as using `KDPRuleSet` "as data" — correct that it's data, not logic, but the CTO's review of Commit 0's findings caught a real remaining seam: even as pure data, `SubmissionValidator` still had to reference that data's concrete name, which becomes an implicit dependency on "which platform" the moment a second target (Kobo, Apple Books) is added — precisely the drift Decision 6 was written to prevent.

**CTO's rationale (verbatim structure):**
```
PublishingTarget
   |
   v
ValidationRuleProvider  (port)
   |
   v
KDPRuleProvider   (Amazon)      <- only implementation this sprint
KoboRuleProvider  (Kobo)        <- future
AppleBooksRuleProvider (Apple)  <- future
LuluRuleProvider  (Lulu)        <- future
IngramRuleProvider (IngramSpark) <- future
```
*"Aucun `if(platform=="kdp")` n'apparaîtra dans le moteur."*

**Resolution:** `ValidationRuleProvider` becomes a new Domain port (§5). `SubmissionValidator` is constructor-injected with one and calls exactly one method, `getRules()` — it never imports or switches on a platform name. `KDPTarget` (Decision 6) is the only place in the codebase that knows it is wiring `KDPRuleProvider` specifically; `SubmissionValidator` and `PublishingUseCase` stay platform-agnostic by construction, not by convention or code-review vigilance. The raw verified data is renamed from `KDPRuleSet` to `KDPRuleData` (§5) to make the distinction explicit: `KDPRuleData` is inert data (ADR-0035's spike output); `KDPRuleProvider` is the concrete class that turns that data into `PostRenderValidationRule[]` behind the port.

**New governance ADR (CTO-requested):** ADR-0036 records this as a standing architectural rule for the whole engine, not a one-sprint choice — platform-specific publishing requirements must never be hardcoded as conditionals inside the Publishing Engine's orchestration classes; they must be encapsulated behind a `RuleProvider`-shaped port, one concrete implementation per platform.

### Requirement Traceability Table (CTO-requested, locked before Commit 1)

KDP's requirements (ADR-0035) mapped against the real `BookMetadata` interface (`backend/src/domain/models/Book.ts`), so a future `KoboRuleProvider`/`AppleBooksRuleProvider`/`LuluRuleProvider` addition can immediately see per-field gaps across platforms instead of re-deriving them from scratch each time. Extend this table with a new column per platform as each is added — it's meant to stay the one place cross-platform metadata gaps are visible at a glance.

| KDP Requirement | Exists in `BookMetadata`? | Status |
|---|---|---|
| Title | ✅ | shipped |
| Author | ✅ | shipped |
| ISBN | ✅ | shipped |
| Language | ✅ | shipped |
| Description | ⚠️ optional field exists, not required by KDP either | shipped (optional both sides) |
| Keywords | ⚠️ optional field exists, recommended not required by KDP | shipped (optional both sides) |
| Categories (≤3) | ❌ no field | backlog — ADR-0035's disclosed gap |
| Primary Audience (explicit content Y/N) | ❌ no field | backlog — ADR-0035's disclosed gap |
| Primary Marketplace | ❌ no field | backlog — ADR-0035's disclosed gap |

None of the ❌ rows block Sprint 8 (Decision 5 scopes this sprint to validation/packaging only, and `SubmissionValidator` can report "not verifiable — no `BookMetadata` field" as a `WARNING` rather than silently skipping the check). They are recorded here, not added to `BookMetadata` speculatively, per this project's own restraint precedent (`RunningHead`, ADR-0029 Risk 5; `ValidationContext`, Sprint 5) — a field is added when a real caller needs it, not in anticipation.

### Decision 8 (new, CTO-initiated, locked before Commit 2) — Publishing Engine domain objects are platform-agnostic; platforms depend on the engine, never the inverse

**Locked.** Reviewing Commit 1, the CTO generalized Decision 7's rule-provider-specific pattern into a standing principle covering every object the engine defines, not just validation rules.

**CTO's rationale (verbatim principle):** *"Les objets du Publishing Engine ne doivent jamais dépendre d'une plateforme spécifique. Les plateformes (KDP, Kobo, Apple Books, etc.) dépendent du Publishing Engine, jamais l'inverse."*

**Applied immediately to Commit 2's `PublishingBundle` (CTO's explicit example):** the Bundle must stay a wholly generic publishing package — `{manuscript, cover, metadata, assets, manifest}` — with zero knowledge of KDP or any other platform. `KDPTarget` (Commit 4) will *use* `PublishingBundle`; `PublishingBundle` will never know `KDPTarget` exists. Same directional rule already true of `PublishingTarget`↔`KDPTarget` (Decision 1/6) and `ValidationRuleProvider`↔`KDPRuleProvider` (Decision 7) — Decision 8 states it once, generally, so every future engine object (not just the ones already named) is built to the same standard without needing its own decision each time.

**New governance ADR (CTO-requested):** ADR-0037 records this as the general form of the dependency-direction principle Decision 7/ADR-0036 already applied narrowly to rule injection — the engine defines the abstractions, platforms are always the dependent side.

### Internal Responsibilities Diagram (CTO-requested, round-2 sign-off condition)

The CTO's one reservation on this Review: *"Publishing Engine"* as a name is still too broad, and without an explicit map of internal responsibilities, one class risks absorbing all the logic over successive sprints — exactly what happened to no component yet in this codebase, and what this diagram exists to prevent. Every box below has an explicit **OWNS** (what it is allowed to do) and **NEVER** (what it must delegate) boundary. No box may grow into another box's NEVER list without a new ADR.

```
                        ┌───────────────────────────────┐
                        │   PublishingUseCase            │
                        │   (Orchestrator, Application)  │
                        │                                │
                        │ OWNS  : sequencing the existing│
                        │         pipeline (parse→        │
                        │         normalize→build→theme→ │
                        │         typography→paginate→   │
                        │         render) then handing    │
                        │         the result to a         │
                        │         PublishingTarget        │
                        │ NEVER : validation rules,        │
                        │         packaging mechanics,     │
                        │         KDP-specific logic       │
                        └───────────────┬────────────────┘
                                         │ calls .prepare()
                                         ▼
                        ┌───────────────────────────────┐
                        │   PublishingTarget (port)      │
                        │   Domain                       │
                        │                                │
                        │ OWNS  : the contract for "which │
                        │         platform" — one method  │
                        │         signature, no KDP-       │
                        │         specific detail          │
                        │ NEVER : HOW validation or        │
                        │         packaging work           │
                        │         internally (that's the   │
                        │         implementation's job)    │
                        └───────────────┬────────────────┘
                                         │ implemented by
                                         ▼
                        ┌───────────────────────────────┐
                        │   KDPTarget                    │
                        │   Infrastructure                │
                        │                                │
                        │ OWNS  : wiring Packaging +      │
                        │         SubmissionValidator     │
                        │         together for the KDP    │
                        │         platform specifically   │
                        │ NEVER : the content of the       │
                        │         rules themselves (that's │
                        │         KDPRuleProvider's job,   │
                        │         Decision 7)               │
                        └──────┬─────────────────┬────────┘
                               │                  │
                 uses          │                  │  uses
                               ▼                  ▼
        ┌───────────────────────────┐  ┌───────────────────────────┐
        │   Packaging                │  │   SubmissionValidator      │
        │   Domain/Application       │  │   Domain/Application       │
        │                            │  │                            │
        │ OWNS  : assembling book +  │  │ OWNS  : running             │
        │         cover + metadata   │  │         PostRenderValidation│
        │         into one bundle    │  │         Rules obtained from │
        │         ready to submit    │  │         an injected         │
        │                            │  │         ValidationRuleProvider│
        │ NEVER : deciding whether   │  │         (Decision 7)         │
        │         the bundle is      │  │ NEVER : file assembly,       │
        │         valid              │  │         knowing which        │
        │                            │  │         platform it validates│
        └────────────┬───────────────┘  └──────────────┬─────────────┘
                      │                                 │
                      └───────────────┬─────────────────┘
                                       ▼
                        ┌───────────────────────────────┐
                        │   PublishingReport              │
                        │   Domain (pure data model,      │
                        │   mirrors ValidationReport/      │
                        │   QualityScore)                  │
                        │                                  │
                        │ OWNS  : the PASS/FAIL/Warnings   │
                        │         data shape only           │
                        │ NEVER : any logic — no methods    │
                        │         beyond simple accessors,  │
                        │         no validation, no          │
                        │         decision-making            │
                        └───────────────────────────────┘
```

**Zoom-in: `SubmissionValidator`'s platform-agnostic dependency (Decision 7)** — where "using KDPRuleSet as data" in an earlier draft actually resolves, now that it's a port:

```
      ┌───────────────────────────────┐
      │   SubmissionValidator          │  (from diagram above)
      │   constructor-injected with:   │
      └───────────────┬─────────────────┘
                       ▼
      ┌───────────────────────────────┐
      │   ValidationRuleProvider (port)│  Domain
      │                                 │
      │ OWNS  : one method,             │
      │         getRules(): PostRenderValidationRule[]
      │ NEVER : any platform-specific   │
      │         value or logic itself   │
      └───────────────┬─────────────────┘
                       │ implemented by
                       ▼
      ┌───────────────────────────────┐
      │   KDPRuleProvider                │  Infrastructure — only
      │                                   │  implementation this sprint
      │ OWNS  : turning KDPRuleData       │
      │         (ADR-0035's verified      │
      │         values) into concrete     │
      │         PostRenderValidationRule  │
      │         instances                 │
      │ NEVER : anything SubmissionValidator│
      │         does with the rules once  │
      │         returned                  │
      └───────────────────────────────────┘

Future: KoboRuleProvider, AppleBooksRuleProvider, LuluRuleProvider, IngramRuleProvider —
each a new ValidationRuleProvider implementation. Zero changes to SubmissionValidator.
```

**Why this shape satisfies the CTO's concern:** `PublishingUseCase` cannot grow KDP-specific conditionals without visibly reaching past its own OWNS line into `KDPTarget`'s territory — a code reviewer (human or automated) can check each new line of logic against the box it landed in. `KDPRuleData` as inert data, reached only through the `ValidationRuleProvider` port (Decision 7), means the single most likely source of future logic-creep — Amazon changing its spec, or a second platform's rules leaking into `SubmissionValidator` — is contained to a data update or a new provider class, never a change to the engine's own code, per Risk 5 below.

---

## 4. Architecture Impact

Updates `PLATFORM_ARCHITECTURE_ROADMAP.md` §3's dependency diagram's final stage from a placeholder box to the decomposed shape locked by Decision 6:

```
                    ┌──────────▼──────────┐
                    │   Renderer port       │  (built: DOCX/PDF/EPUB, Sprints 2-3B)
                    └──────────┬──────────┘
                    ┌──────────▼──────────┐
                    │  PublishingUseCase     │  Application layer, orchestrates below
                    └──────────┬──────────┘
                    ┌──────────▼──────────┐
                    │ PublishingTarget port │  NEW — KDPTarget (Sprint 8, only impl)
                    └──────────┬──────────┘
                 ┌─────────────┼─────────────┐
      ┌──────────▼──────────┐   ┌──────────▼──────────┐
      │      Packaging        │   │  SubmissionValidator  │  uses ValidationRuleProvider
      │  (book+cover+metadata)│   │  (PostRenderValidation │  (port, Decision 7) -> KDPRuleProvider
      │                        │   │   rule family)         │  -> KDPRuleData (isolated data)
      └──────────┬──────────┘   └──────────┬──────────┘
                    └─────────────┬─────────────┘
                    ┌──────────▼──────────┐
                    │   PublishingReport     │  PASS / FAIL / Warnings
                    └────────────────────┘
```

`Renderer<TOutput>`'s existing contract is unchanged — everything above is new and additive (same "additive over signature-break" discipline as ADR-0022/ADR-0027/ADR-0029). `POST /api/manuscripts/publish` (Decision 4) is the new Presentation-layer entry point calling `PublishingUseCase`.

---

## 5. Functional / Technical Specifications

Structural shapes locked now (they don't depend on any KDP-specific real value); KDP's actual rule *content* (`KDPRuleData`'s real data) was pending the Decision-2 spike — now resolved (Commit 0, ADR-0035, `backend/spikes/kdp-publishing-spike.ts`), per this project's own "confirmed, not guessed" discipline. One structural shape below is corrected as a direct consequence of the spike's findings (see the note after `KDPRuleData`). A second shape change follows Decision 7: `KDPRuleSet` is renamed `KDPRuleData` and is no longer referenced directly by `SubmissionValidator` — it's reached only through the new `ValidationRuleProvider` port and `KDPRuleProvider` implementation below.

```typescript
// Domain port
interface PublishingTarget {
  prepare(book: Book, renderedOutputs: RenderedOutputs): PublishingReport;
}

interface RenderedOutputs {
  pdf?: Buffer;
  epub?: Buffer;
  docx?: Buffer;
}

// Domain model - enriched per CTO's Commit-1 follow-up (ADR-0037): artifacts/generatedAt/
// duration/summary let a future platform enrich the report without breaking this API. Nothing
// below names or assumes any platform (Decision 8).
interface PublishingReport {
  status: 'PASS' | 'FAIL';
  target: string; // e.g. 'kdp'
  issues: PublishingIssue[];
  warnings: string[];
  artifacts: string[]; // identifiers/filenames of what was produced; empty until Commit 2/4 populate it
  generatedAt: Date;
  duration: number; // milliseconds
  summary: string; // one-line human-readable result
}

interface PublishingIssue {
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

// Domain model (new, Commit 2, Decision 8) - entirely generic, no KDP concept anywhere.
// "manuscript" stays a RenderedOutputs (not one pre-chosen format) because deciding which
// rendered format a given platform actually wants is a platform-specific decision (KDPTarget's
// job in Commit 4), not Packaging's - Packaging only assembles what it was given.
interface PublishingBundle {
  manuscript: RenderedOutputs;
  cover?: Buffer; // decoded from Book.metadata.coverImage.base64 when present; undefined otherwise (Risk 4's disclosed gap)
  metadata: BookMetadata;
  assets: Buffer[]; // reserved for future platforms (e.g. separate marketing images); always empty this sprint - no real caller needs it yet
  manifest: PublishingBundleManifest;
}

interface PublishingBundleManifest {
  formatsIncluded: ('pdf' | 'epub' | 'docx')[];
  hasCover: boolean;
  assembledAt: Date;
}
```

**`PublishingBundle`'s five fields (CTO-requested, Commit 2 follow-up, 2026-07-18)** — documented explicitly so a future platform addition doesn't drift the meaning of any field:

| Field | Role |
|---|---|
| `manuscript` | Every rendered output `Packaging` was given (`RenderedOutputs`) — not one pre-chosen format; the consuming `PublishingTarget` decides which one it needs |
| `cover` | The cover image, decoded to bytes, when the book has one — `undefined`, not fabricated, when it doesn't (today's real state for any DOCX import, Risk 4) |
| `metadata` | The book's real `BookMetadata`, unchanged — the same object `Book.metadata` already is, not a copy or a platform-shaped projection |
| `assets` | Reserved for supplementary files a future platform might need (e.g. separate marketing images) — always empty this sprint, no real caller needs it yet |
| `manifest` | A structural inventory of what the bundle actually contains (`formatsIncluded`, `hasCover`, `assembledAt`) — descriptive only, no validation logic |

```typescript
// Domain service (Packaging) - pure, no file I/O (Decision 6's "Domain (pure)" branch: nothing
// this sprint needs real file I/O for a submission bundle - everything stays in-memory Buffers,
// consistent with Decision 5's no-real-submission boundary).
interface Packaging {
  assemble(book: Book, renderedOutputs: RenderedOutputs): PublishingBundle;
}

// Domain model (Commit 3) - what a PostRenderValidationRule reads. bundle gives access to
// manifest/cover/metadata already assembled by Packaging (Commit 2) - no rule re-derives them.
interface PostRenderValidationContext {
  book: Book;
  bundle: PublishingBundle;
}

// Domain service contract (SubmissionValidator) - mirrors RuleRegistry/ValidationEngine exactly.
// `name` mirrors ValidationRule's exact shape (domain/services/validation/ValidationRule.ts).
interface PostRenderValidationRule {
  readonly name: string;
  evaluate(context: PostRenderValidationContext): PublishingIssue[];
}

// Domain port (new, Decision 7) - the only thing SubmissionValidator depends on for
// platform-specific behavior. Mirrors PublishingTarget/Renderer<TOutput>/LayoutSelector's
// existing one-method port shape.
interface ValidationRuleProvider {
  getRules(): PostRenderValidationRule[];
}

// KDPRuleData - inert data, not logic. Real values verified by the Commit-0 spike (ADR-0035).
// Never imported by SubmissionValidator directly - only KDPRuleProvider (below) touches it.
interface KDPRuleData {
  requiredMetadataFields: (keyof BookMetadata)[]; // ['title', 'author', 'isbn', 'language']
  interiorSpec: {
    minResolutionDpi: number; // 300
    bleedIn: number; // 0.125
    marginsByPageCount: { maxPages: number; gutterIn: number; outsideMinIn: number }[];
    minPageCount: number; // 24
    maxPageCount: number; // 828
    acceptedFormats: ('pdf' | 'epub' | 'docx')[]; // ['pdf', 'docx'] - epub isn't a KDP paperback interior format
  };
  // Corrected by the Commit-0 spike: the paperback cover has no fixed pixel size - it's PDF,
  // CMYK, computed from trim size + page count + paper type, unlike the fixed-pixel eBook cover
  // the original minWidthPx/minHeightPx/minDpi shape assumed.
  paperbackCoverSpec: {
    fileFormat: 'PDF';
    colorMode: 'CMYK';
    minResolutionDpi: number; // 300
    bleedIn: number; // 0.125
    spineWidthInPerPage: Record<string, number>; // by paper/ink type
    spineTextMinPages: number; // 79
  };
}

// Domain (corrected from a provisional "Infrastructure" label - no file I/O needed) - the only
// ValidationRuleProvider implementation this sprint (Decision 7). Wraps KDPRuleData and turns it
// into the 4 real PostRenderValidationRule instances Commit 3 built: RequiredMetadataFieldsRule,
// PageCountRule, CoverPresenceRule, InteriorFormatAvailabilityRule - each generic (takes its
// config via constructor, not hardcoded), reusable by a future KoboRuleProvider with Kobo's own
// values. This is where "if(platform=='kdp')" would have leaked in without Decision 7.
class KDPRuleProvider implements ValidationRuleProvider {
  constructor(private readonly data: KDPRuleData = KDP_RULE_DATA) {}
  getRules(): PostRenderValidationRule[] {
    return [
      new RequiredMetadataFieldsRule(this.data.requiredMetadataFields),
      new PageCountRule(this.data.interiorSpec.minPageCount, this.data.interiorSpec.maxPageCount),
      new CoverPresenceRule(),
      new InteriorFormatAvailabilityRule(this.data.interiorSpec.acceptedFormats),
    ];
  }
}
```

**Known scope boundary, disclosed not hidden:** Commit 3's 4 rules check only what `PostRenderValidationContext` (`book` + `bundle`) actually carries — required metadata, page count bounds, cover presence, accepted interior format. Bleed/margin/resolution checks from `KDPRuleData.interiorSpec` and `paperbackCoverSpec` are **not** implemented this sprint — the current render pipeline doesn't attach which `PageLayout` or resolution was used to `RenderedOutputs`, so there is no real value to check them against yet. Recorded here rather than faked with an assumed layout, per this project's own "confirmed, not guessed" discipline (same posture as Risk 4's metadata gap).

**Presentation:** `POST /api/manuscripts/publish` (Decision 4) — multipart DOCX + `target` field (only `'kdp'` valid this sprint, mirrors `ExportController`'s existing `resolveFormat`-style validation) → `PublishingUseCase.execute()` → JSON `PublishingReport`, not a file stream.

---

## 6. Risks

1. **Reversing `VISION.md`'s own original architectural framing (Decision 1) is a bigger call than a typical Level 2 review makes** — flagged explicitly, now locked by explicit CTO decision rather than left as a recommendation.
2. ~~No real KDP spike exists yet~~ **Resolved (Commit 0, 2026-07-18, ADR-0035)** — `backend/spikes/kdp-publishing-spike.ts` verified real cover/interior/metadata requirements directly from `kdp.amazon.com`'s own published pages. One shape correction surfaced: `coverSpec` is now `paperbackCoverSpec` (§5), reflecting that paperback cover dimensions are computed, not fixed pixels.
3. **Scope creep into real automated submission** — closed by Decision 5's explicit, unambiguous boundary.
4. **`ASTBuilder` still can't populate ISBN/description/cover-image from a real DOCX** — any KDP-readiness check this engine runs against a real imported manuscript will, today, always fail on metadata completeness (same category as Sprint 5/6's own disclosed, unfixed import-pipeline gaps). Real, not a defect this engine introduces.
5. **KDP's real specifications change over time, independent of this project's release cycle (CTO-added risk).** The engine must never hardcode KDP's current requirements as logic. Decision 6/7's isolation — `KDPRuleData` as inert data, reached only through the `ValidationRuleProvider` port — is the mitigation: a future spec change is a data update to `KDPRuleData`, not a code change to the engine, and a future platform's *different* rules can't leak into `SubmissionValidator` even by accident, since it never references any platform-specific type by name. This is now a locked architectural constraint (Decision 6, hardened by Decision 7 and ADR-0036), not just a stated intent.
6. **`PostRenderValidationContext` carries less than the pipeline actually knows — `PageCountRule` can never pass today (found by Commit 7's real-fixture verification, disclosed not fixed).** `PageCountRule` reports `PAGE_COUNT_UNKNOWN` on every real fixture, including `large-book.docx`. Confirmed by reading the code, not assumed: `Book.pageCount` is populated only by `BookMetricsCalculator`, which runs only on the **import** path (`ImportManuscriptUseCase`), never on the export/publish path. Meanwhile the **real** page count does exist in the publish pipeline — `LayoutEngine.paginate()` produces a `PaginatedBook` with real `pages` that `PublishingUseCase` computes, renders from, and then discards, since only `book` and the rendered PDF reach `PublishingTarget.prepare()`. The rule itself is correct (it reports "unknown" honestly rather than guessing); it is simply fed less than is available. **Deliberately not fixed in Commit 7**: threading real pagination data into `PostRenderValidationContext` changes Publishing Engine behavior, and Commits 7–8 are validation/documentation only by explicit CTO direction. Closing it means widening `PublishingTarget.prepare()`'s inputs (or `RenderedOutputs`) — an interface change warranting its own decision, consistent with Decision 1's API-evolution note. Recorded as a real, known, assumed gap.

---

## 7. Commit Plan

Approved by the CTO as "very prudent," matching their own stated order (Spike → Port → Validation → API → Tests → Documentation). Refined into concrete commits now that Decision 6's decomposition is locked:

1. ✅ **Commit 0 — KDP publishing-requirements spike** (`backend/spikes/kdp-publishing-spike.ts`, 2026-07-18, ADR-0035) — real metadata requirements, real cover spec, real file-naming/submission rules, matching ADR-0019/0020/0030
2. ✅ **Commit 1 — `PublishingTarget` port + `PublishingReport`/`PublishingIssue` models** (Domain, 2026-07-18) — `backend/src/domain/ports/PublishingTarget.ts`, `backend/src/domain/models/PublishingReport.ts` (also holds `RenderedOutputs`, the port's second parameter type)
3. ✅ **Commit 2 — `Packaging` + `PublishingBundle`/`PublishingBundleManifest`** (Domain, 2026-07-18) — `backend/src/domain/models/PublishingBundle.ts`, `backend/src/domain/services/Packaging.ts` (+7 tests) — assembles book + cover + metadata into a generic `PublishingBundle` — `{manuscript, cover, metadata, assets, manifest}`, zero KDP knowledge, per Decision 8/ADR-0037. Cover decoded from a real embedded `base64` image when present (Risk 4's gap means this is `undefined` for any real current import — tested explicitly)
4. ✅ **Commit 3 — `SubmissionValidator` + `PostRenderValidationRule` family + `ValidationRuleProvider` port + `KDPRuleProvider`/`KDPRuleData`** (Domain, 2026-07-18) — 4 real rules (`RequiredMetadataFieldsRule`, `PageCountRule`, `CoverPresenceRule`, `InteriorFormatAvailabilityRule`, +20 tests), real values from the spike, isolated behind the provider port per Decision 6/7/Risk 5 — no platform conditionals in `SubmissionValidator`. Bleed/margin/resolution checks disclosed as not implemented this sprint (§5) — no render-pipeline data to check them against yet
5. ✅ **Commit 4 — `KDPTarget` + `createKDPTarget()`** (Domain, 2026-07-18) — `backend/src/domain/services/publishing/KDPTarget.ts`, `createKDPTarget.ts` (+9 tests) — the only `PublishingTarget` implementation this sprint, calls `Packaging` and `SubmissionValidator` exactly once each, never re-validates/mutates/re-packages (CTO requirement, verified by dedicated "consumer, never a replacement" tests using spy collaborators)
6. ✅ **Commit 5 — `PublishingUseCase`** (Application, 2026-07-18) — `backend/src/application/use-cases/PublishingUseCase.ts` (+5 tests, including the canonical `typography-test.docx` real-fixture regression) — mirrors `ExportManuscriptUseCase`'s exact shape (same 6 pipeline dependencies), one line different at the end: renders to PDF then calls `PublishingTarget.prepare(book, { pdf })` instead of returning the buffer. Never imports `Packaging`/`SubmissionValidator`/`KDPRuleProvider` (grep-confirmed empty)
7. ✅ **Commit 6 — `POST /api/manuscripts/publish`** route (Presentation, 2026-07-18) — `PublishingResponseDTO`/`PublishingIssueDTO` (`packages/shared-types`, deliberately generic naming per CTO requirement, not `KDPPublishingResponse`), `PublishingReportMapper`, `PublishController`, `routes/publish.ts`, wired in `app.ts` (+9 tests, including the canonical `typography-test.docx` real-fixture regression). Controller only receives the request, calls `PublishingUseCase.execute()`, maps the result, returns the DTO — never builds a `PublishingBundle`, never calls `KDPTarget`/`SubmissionValidator`/`Packaging` directly (grep-confirmed empty). Unlike `/export`'s format defaulting, an unknown/missing `target` is a real 400 — there is no default platform
8. ✅ **Commit 7 — Real-file verification pass** (2026-07-18) — `backend/scripts/verify-real-publish.ts` + `npm run verify-real-publish`, sibling of `verify-real-export.ts`, per `docs/REAL_FIXTURE_POLICY.md` (which names Publishing Engine work as in scope). **4/4 canonical fixtures passed**: each returned a real, structurally-validated `PublishingResponseDTO` with `artifacts: ["pdf"]`, all reporting a real `FAIL` on the known `isbn` gap — the correct outcome, never a fabricated `PASS`. **No engine code changed.** Surfaced one real gap, disclosed not fixed (Risk 6 below). Full evidence: `docs/demo/VISIBLE_INCREMENTS.md`
9. ✅ **Commit 8 — Docs/ADR reconciliation** (2026-07-18), per every prior sprint's own closure discipline. **No behavior change, no new business code.** ADR-0038 opened (the deferred pagination-metrics question, framed not answered, per CTO direction); `ADR_INDEX.md`, `CURRENT_STATE.md` (new Sprint 8 section, real test counts from vitest's JSON reporter, 4 new Known Issues, Git Status), `TODO.md` (Publishing Engine marked done, KDP backlog narrowed, ADR-0038 added), `PLATFORM_ARCHITECTURE_ROADMAP.md` §2.5 + §4 open question + the `PostRenderValidation` note, `VALIDATION_ENGINE.md`'s Decision 2 commitment closed, `VERSIONS.md` annotated. **PR/merge/tag/`VERSIONS.md` flip deliberately excluded** — separate `docs/RELEASE_CHECKLIST.md` steps requiring their own authorization

---

## 8. Acceptance Criteria

Reinforced by explicit CTO checklist (2026-07-18) — Sprint 8 is accepted only if **all** of the following are true, each independently verified against the real running application, not asserted:

- ✓ A real DOCX is imported
- ✓ A real PDF is generated
- ✓ A real EPUB is generated
- ✓ Real KDP validation is executed (`SubmissionValidator` + `KDPRuleProvider`, real findings against a real manuscript, with zero platform conditionals inside `SubmissionValidator` itself — Decision 7)
- ✓ A detailed `PublishingReport` is produced (real itemized PASS/FAIL/Warnings, not a hardcoded success)
- ✓ No Amazon dependency exists anywhere in the code path
- ✓ No authentication of any kind is implemented or required
- ✓ No remote API call is made to any publishing platform
- ✓ No real publication occurs, under any circumstance
- ✓ The architecture is extensible to Kobo, Apple Books, and Lulu **without modifying any public interface** — a future `KoboTarget` implements the same `PublishingTarget` port unchanged

---

## Related

- `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` §2.5 — the Level 1 map this Level 2 review implements
- `docs/VISION.md` line 26 — the original framing Decision 1 supersedes
- `docs/architecture/diagrams/VALIDATION_ENGINE.md` Decision 2 — the `PostRenderValidation` commitment Decision 3 closes
- `docs/TODO.md` — the overlapping "Kindle/Kobo/Lulu/IngramSpark/Amazon KDP export targets" Backlog item this review reconciles
- ADR-0012 (`Renderer` is a port, `ThemeEngine`/`LayoutEngine` are concrete classes) — the port-vs-class precedent `PublishingTarget`/`KDPTarget`'s shape follows
- ADR-0027/ADR-0028 (`ValidationEngine`/`RuleRegistry` shape) — the precedent `SubmissionValidator` mirrors exactly (Decision 3/6)
- ADR-0019/ADR-0020/ADR-0030 — the spike-before-decide precedent Decision 2 follows
- ADR-0035 — the Commit-0 spike's verified KDP requirements, consumed as `KDPRuleData` (§5)
- ADR-0036 — the standing governance rule Decision 7 locks (platform rules must be encapsulated behind a `RuleProvider` port, never hardcoded in the engine)
- ADR-0037 — the standing governance rule Decision 8 locks (every Publishing Engine domain object is platform-agnostic; platforms depend on the engine, never the inverse)
- `backend/src/domain/models/Book.ts` — `FrontMatter`/`BackMatter`, the real, currently-unconsumed Domain scaffolding this engine would finally activate
