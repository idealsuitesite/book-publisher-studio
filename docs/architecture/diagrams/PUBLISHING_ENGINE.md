# Publishing Engine — Level 2 Design Review

**Status:** ✅ APPROVED (2026-07-18) — conditional sign-off, condition satisfied same day. The CTO's completed verdict: *"Je signerais cette Review avec une seule réserve : Le terme 'Publishing Engine' est encore un peu trop large. Avant la première ligne de code, je demanderais à Claude d'ajouter un diagramme montrant clairement les responsabilités internes (orchestrateur, validation, packaging, rapport, cible de publication)... En dehors de ce point, la démarche est rigoureuse... C'est exactement le rôle attendu d'une Design Review de niveau 2."* The requested Internal Responsibilities Diagram (with explicit OWNS/NEVER boundaries per component) is in §3, immediately below Decision 6. Commit 0 (the KDP spike) was then explicitly authorized and completed (ADR-0035).
**Update (same day, before Commit 1):** reviewing Commit 0's findings, the CTO added one more requirement before any implementation code is written — Decision 7 below (`ValidationRuleProvider` port, no platform conditionals in the engine) and ADR-0036 (the standing governance rule this locks in). The CTO's exact instruction: *"Le Publishing Engine ne doit contenir aucune logique spécifique à KDP. Toute règle dépendante d'une plateforme doit être isolée derrière des interfaces dédiées (RuleProvider, Specification ou équivalent), afin que Kobo, Apple Books, Lulu et IngramSpark puissent être ajoutés sans modifier le cœur du moteur."* Commit 1 is authorized to proceed with this requirement incorporated.
**Date:** 2026-07-18 (round 1) / 2026-07-18 (round 2 decisions) / 2026-07-18 (approved) / 2026-07-18 (Decision 7 added, Commit 1 authorized)
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
| `KDPTarget` | Domain or Infrastructure — **concrete class, only implementation this sprint** | Implements `PublishingTarget`; internally calls `Packaging` and `SubmissionValidator`. Port-vs-class placement follows `docs/DEVELOPER_HANDBOOK.md`'s existing judgment rule once Decision 2's spike confirms whether KDP-specific logic needs any Infrastructure-level I/O (file packaging) or stays pure |
| `Packaging` | Domain (pure) or Infrastructure (if real file I/O is needed for a submission bundle) | Assembles a `PublishingBundle` (book file + cover file + metadata) from the `Book` + a `Renderer`'s output — a data-shaping step, not validation |
| `SubmissionValidator` | Domain — **concrete class**, orchestrates a rule registry | Mirrors `ValidationEngine`/`RuleRegistry`'s exact existing shape (ADR-0027/0028) — runs a `PostRenderValidationRule[]` obtained from a constructor-injected `ValidationRuleProvider` (Decision 7), never referencing any platform-specific data by name. This is Decision 3's rule family, named per the CTO's own naming here |
| `PublishingReport` | Domain — **model** | Mirrors `ValidationReport`/`QualityScore`'s existing shape — `status: 'PASS' \| 'FAIL'`, `issues: PublishingIssue[]`, `warnings: string[]` |
| `PublishingUseCase` | Application — **use case** | Mirrors `ExportManuscriptUseCase`'s exact existing shape (`UseCase<TRequest, TResponse>`) — orchestrates the existing pipeline (parse→normalize→build→theme→typography→paginate→render) then hands the result to `PublishingTarget.prepare()` |
| `ValidationRuleProvider` | Domain — **port** (new, Decision 7) | One method, `getRules(): PostRenderValidationRule[]` — mirrors `PublishingTarget`/`Renderer<TOutput>`/`LayoutSelector`'s existing port shape (ADR-0012); more than one real implementation is plausible the moment Kobo/Apple Books/Lulu/IngramSpark are added, matching `docs/DEVELOPER_HANDBOOK.md`'s port-vs-class rule |
| `KDPRuleProvider` | Infrastructure — **concrete class, only implementation this sprint** (new, Decision 7) | Implements `ValidationRuleProvider`; wraps `KDPRuleData` (ADR-0035's verified spike values, §5) and constructs the real `PostRenderValidationRule` instances from it |

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

// Domain model
interface PublishingReport {
  status: 'PASS' | 'FAIL';
  target: string; // e.g. 'kdp'
  issues: PublishingIssue[];
  warnings: string[];
}

interface PublishingIssue {
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

// Domain service (SubmissionValidator) - mirrors RuleRegistry/ValidationEngine exactly.
// Constructor-injected with a ValidationRuleProvider (Decision 7) - never references any
// platform-specific type by name.
interface PostRenderValidationRule {
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

// Infrastructure - the only ValidationRuleProvider implementation this sprint (Decision 7).
// Wraps KDPRuleData and turns it into concrete PostRenderValidationRule instances
// (e.g. a MinResolutionRule, a BleedRule, a GutterMarginRule, a RequiredMetadataFieldsRule) -
// this is where "if(platform=='kdp')" would have leaked in without Decision 7.
class KDPRuleProvider implements ValidationRuleProvider {
  constructor(private readonly data: KDPRuleData) {}
  getRules(): PostRenderValidationRule[] {
    throw new Error('implemented in Commit 3');
  }
}
```

**Presentation:** `POST /api/manuscripts/publish` (Decision 4) — multipart DOCX + `target` field (only `'kdp'` valid this sprint, mirrors `ExportController`'s existing `resolveFormat`-style validation) → `PublishingUseCase.execute()` → JSON `PublishingReport`, not a file stream.

---

## 6. Risks

1. **Reversing `VISION.md`'s own original architectural framing (Decision 1) is a bigger call than a typical Level 2 review makes** — flagged explicitly, now locked by explicit CTO decision rather than left as a recommendation.
2. ~~No real KDP spike exists yet~~ **Resolved (Commit 0, 2026-07-18, ADR-0035)** — `backend/spikes/kdp-publishing-spike.ts` verified real cover/interior/metadata requirements directly from `kdp.amazon.com`'s own published pages. One shape correction surfaced: `coverSpec` is now `paperbackCoverSpec` (§5), reflecting that paperback cover dimensions are computed, not fixed pixels.
3. **Scope creep into real automated submission** — closed by Decision 5's explicit, unambiguous boundary.
4. **`ASTBuilder` still can't populate ISBN/description/cover-image from a real DOCX** — any KDP-readiness check this engine runs against a real imported manuscript will, today, always fail on metadata completeness (same category as Sprint 5/6's own disclosed, unfixed import-pipeline gaps). Real, not a defect this engine introduces.
5. **KDP's real specifications change over time, independent of this project's release cycle (CTO-added risk).** The engine must never hardcode KDP's current requirements as logic. Decision 6/7's isolation — `KDPRuleData` as inert data, reached only through the `ValidationRuleProvider` port — is the mitigation: a future spec change is a data update to `KDPRuleData`, not a code change to the engine, and a future platform's *different* rules can't leak into `SubmissionValidator` even by accident, since it never references any platform-specific type by name. This is now a locked architectural constraint (Decision 6, hardened by Decision 7 and ADR-0036), not just a stated intent.

---

## 7. Commit Plan

Approved by the CTO as "very prudent," matching their own stated order (Spike → Port → Validation → API → Tests → Documentation). Refined into concrete commits now that Decision 6's decomposition is locked:

1. ✅ **Commit 0 — KDP publishing-requirements spike** (`backend/spikes/kdp-publishing-spike.ts`, 2026-07-18, ADR-0035) — real metadata requirements, real cover spec, real file-naming/submission rules, matching ADR-0019/0020/0030
2. **Commit 1 — `PublishingTarget` port + `PublishingReport`/`PublishingIssue` models** (Domain)
3. **Commit 2 — `Packaging`** (assembles book + cover + metadata into a `PublishingBundle`)
4. **Commit 3 — `SubmissionValidator` + `PostRenderValidationRule` family + `ValidationRuleProvider` port + `KDPRuleProvider`/`KDPRuleData`** (real values from the spike, isolated behind the provider port per Decision 6/7/Risk 5 — no platform conditionals in `SubmissionValidator`)
5. **Commit 4 — `KDPTarget`** (the only `PublishingTarget` implementation this sprint, wires `Packaging` + `SubmissionValidator`)
6. **Commit 5 — `PublishingUseCase`** (Application layer, mirrors `ExportManuscriptUseCase`)
7. **Commit 6 — `POST /api/manuscripts/publish`** route (Presentation)
8. **Commit 7 — Real-file verification pass** against canonical fixtures, per `docs/REAL_FIXTURE_POLICY.md`
9. **Commit 8 — Docs/ADR reconciliation**, per every prior sprint's own closure discipline

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
- `backend/src/domain/models/Book.ts` — `FrontMatter`/`BackMatter`, the real, currently-unconsumed Domain scaffolding this engine would finally activate
