# Editorial AI Engine — Level 2 Design Review

**Status:** ⏸️ **DEFERRED to Sprint 18+ by explicit CTO strategic decision (2026-07-18, ADR-0039) — deferred, not rejected, and deliberately not withdrawn.** This round-1 draft stands exactly as written: the 6 open questions, the real code evidence, and the accept/reject-versus-stateless tension all remain valid and will save the future session that picks this up.

**Why deferred (CTO's reasoning):** the Editorial AI Engine is a very high-value feature, but not indispensable for shipping a usable product. Waiting until real users are actually using Book Publisher Studio allows the AI to be designed from **observed needs rather than assumed ones** — which is precisely what Question 4 (*which of the 8 services actually ship?*) could not answer from documents alone. Sprints 9–17 now target product completeness first; see ADR-0039 for the full reordered roadmap.

**What a future session should know before reopening this:** the six questions below were drafted against the codebase as of 2026-07-18. By Sprint 18 the answers to Questions 3 and 6 will likely have changed — Sprint 11 (Workspace) and Sprint 12 (Autosave) are expected to introduce the persistence layer whose absence forces Question 3's stateless workaround, and Sprint 16 (Licensing) may introduce the secret management Question 6 has to invent from scratch today. **Re-verify §2's evidence before trusting it**; every claim there is timestamped to a codebase that will have moved.

**Original round-1 status, preserved:** 🟡 ROUND 1 — DRAFT. Not approved. No branch, no code. 6 open questions posed below, each with a recommendation and the reasoning behind it, all left open for explicit CTO decision, matching the process followed for Sprints 5–8.
**Date:** 2026-07-18 (round 1 drafted) / 2026-07-18 (deferred, ADR-0039)
**Sprint:** Originally proposed for Sprint 9 — **now Sprint 18+**. Question 1 (Editorial AI Engine versus Plugin System) is answered by ADR-0039: **neither, for now** — both move to the strategic backlog, Plugin System behind Editorial AI at Sprint 19+.

---

## 1. Objectives

Turn the manuscript — and Validation Engine's diagnostics about it — into **intelligent editorial recommendations** the author can accept or reject: grammar and language correction, style and readability improvement, consistency checking, humanization, rewriting.

This is the first sprint in this project's history that would introduce **non-determinism, outbound network calls, per-request cost, and secret management**. Every engine built so far is a pure function of its input. That difference, not the feature list, is what makes this review hard — and it is why the questions below are weighted toward boundaries rather than capabilities.

---

## 2. Current State — Evidence, Not Assumptions

Every claim below was confirmed by reading the actual code or running an actual command, not inferred from a document.

**Confirmed by `grep` across all of `backend/src/` (excluding tests):**
- **Zero** references to `openai`, `anthropic`, `claude`, `gemini`, `mistral`, `deepseek`, `llm`, or `aiprovider`. No AI code of any kind exists.
- **Zero** outbound HTTP capability — no `fetch(`, no `axios`, no `node-fetch`, no `https.request`. **This backend has never made an outbound network call.**
- Runtime dependencies are exactly: `cheerio`, `cors`, `docx`, `domhandler`, `epub-gen-memory`, `express`, `mammoth`, `multer`, `pdfkit`, `shared-types`. Nothing that could reach an LLM.

**Confirmed by reading `backend/src/index.ts` and `package.json`:** the only environment variable read anywhere is `process.env.PORT`. **`dotenv` is not a dependency, and no `.env` file exists.** There is no secret-management mechanism of any kind.

**Confirmed by reading `backend/src/domain/models/Book.ts`:** `ValidationIssue.suggestion?: string` exists — but it is a free-text hint, not a structured change proposal. There is **no suggestion model, no diff model, no accept/reject model, and no revision/version model** anywhere in the Domain.

**Confirmed by reading `Book.ts`'s own header comment:** *"This model is IMMUTABLE — transformations return new instances."* Any accept/reject workflow must produce new `Book` instances, never mutate in place.

**Confirmed by `grep` across `backend/src/application/` and `backend/src/domain/`:** no database, no repository, no session, no cache — **no persistence layer of any kind exists.**

**Confirmed by reading `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` Decision 2 (approved, and held without exception through Sprint 8):** *"No session, no server-side manuscript cache — every UI action is its own complete round trip."* **This is the constraint Question 3 exists to resolve.**

**Confirmed by reading the Level 1 map (`PLATFORM_ARCHITECTURE_ROADMAP.md` §2.2/§2.3):**
- The pipeline position is **already reconciled** — `Parser → Normalizer → ASTBuilder → Validation Engine → Editorial AI Engine → Theme Engine → …`. This updates `docs/VISION.md`'s older diagram, which omitted `ASTBuilder` and Validation Engine. **No tension here; already settled in 2026-07-17's approved Level 1 review.**
- The Plugin System overlap is **already reconciled** — AI-provider abstraction is "one *mechanism* the broader plugin system needs, not a competing definition," to be built as a focused port by its first real consumer. **§2.3 states explicitly: "Not this sprint or the next."**

**Confirmed by reading `docs/VISION.md`'s Editorial AI Engine section:** 8 capabilities and 8 named services (`GrammarService`, `StyleService`, `HumanizationService`, `ReadabilityService`, `ConsistencyService`, `AIRewriteService`, `CitationService`, `SuggestionsService`) are scoped. VISION itself calls this *"realistically its own Sprint 6/7"* — i.e. a full sprint for a **fraction** of it, not all of it. **Question 4 exists because shipping all 8 in one sprint is not credible.**

**Confirmed by real measurement (`docs/demo/VISIBLE_INCREMENTS.md`, Sprint 7 Commit 10):** the largest real manuscript this repository has ever processed is **39,913 words / 17 chapters**. The largest canonical fixture (`large-book.docx`) is 12,030 words. **Question 5 exists because 39,913 words is far beyond a single LLM request for most providers**, and no chunking strategy exists anywhere.

**A real precedent that directly constrains this sprint:** Sprint 8's Decision 5 forbade *any* real external API call, account, or credential — and that boundary held through nine commits. **Question 2 is the direct analogue**, and it deserves the same explicit ruling rather than an assumption.

---

## 3. Open Questions — For CTO Decision

None of these are locked. Each records a recommendation and why, matching Sprint 8's round-1 shape.

### Question 1 — Is Sprint 9 the Editorial AI Engine, or the Plugin System?

**Recommendation: Editorial AI Engine.**

**Reasoning, from the documents rather than preference:** the Level 1 map already rules on this. §2.3 says the Plugin System is *"Not this sprint or the next — no Design Review scheduled yet,"* and that AI-provider abstraction should be built as a focused port by *"whichever engine's Design Review implements this first (most likely Editorial AI Engine, since it's the first real consumer)."* Building the Plugin System first would mean designing an abstraction with **no real consumer to validate it against** — the opposite of the discipline that made `ValidationRuleProvider` work in Sprint 8, where the port was proven by a real implementation in the same sprint.

**The honest counter-argument, stated rather than hidden:** Editorial AI Engine is substantially riskier than anything built so far (network, cost, non-determinism, secrets — all four new). Plugin System is not obviously *lower* risk though: `docs/VISION.md` scopes it as *"sandboxed, versioned plugins,"* and sandboxing untrusted code is a hard security problem, arguably harder than calling an API. Neither is a soft landing after Sprint 8.

### Question 2 — Does Sprint 9 make a real LLM call, or none at all?

**This is the Decision-5 analogue and the single most consequential question in this review.**

**Recommendation: build the `AIProvider` port and ship two implementations — one real, one deterministic — but make the deterministic one the default everywhere except an explicitly-enabled manual verification.**

Concretely: a `FakeAIProvider` returning fixed, realistic responses drives **all** tests and CI (no network, no key, no cost, fully deterministic), while one real provider adapter proves the port against a real API. This mirrors Sprint 8 exactly, where `SubmissionValidator` was proven against a fake `ValidationRuleProvider` containing no KDP class at all, *and* `KDPTarget` was proven against the real one.

**Why not "no real call at all" (the strict Sprint-8 analogue):** Sprint 8 could produce a genuinely useful artifact — a real `PublishingReport` — without ever contacting Amazon, because KDP's rules are published documentation. There is no equivalent here: an Editorial AI Engine that never calls an LLM produces *nothing real*. The sprint would ship an untested abstraction.

**Why not "real calls everywhere":** that makes the test suite non-deterministic, network-dependent, and metered — violating `docs/TESTING_STRATEGY.md`'s foundations and making CI dependent on a paid third party.

**Consequence if approved:** this sprint introduces secret management for the first time (Question 6) and a Commit-0 spike becomes mandatory (§7).

### Question 3 — How does accept/reject survive a stateless backend?

**A real, load-bearing tension between two already-locked decisions — surfaced rather than silently resolved.**

`docs/VISION.md` capability #3 requires *"Word-track-changes-style: propose a change, never silently apply it; the author decides."* That is inherently a two-round-trip workflow: request A returns suggestions, request B accepts one. **Sprint 7 Decision 2 (locked, held through Sprint 8) forbids the server remembering anything between them**, and no persistence layer exists to change that.

**Recommendation: keep the backend stateless; make every suggestion self-contained.**

A suggestion carries enough information to be applied independently — a stable target locator (chapter/block id), the original text, and the proposed replacement. The client holds the suggestion set it received and sends back the ones it accepts. `POST /api/manuscripts/apply-suggestions` takes the manuscript plus the accepted suggestions and returns a new `Book`. Statelessness is preserved exactly, and the immutability rule is respected by construction (a new `Book` out, never a mutation).

**The real cost, disclosed:** payloads grow (the manuscript is re-sent with each round trip, exactly as `/export` and `/publish` already do), and a suggestion could be applied against a manuscript that has since changed client-side. That second risk needs an explicit answer — the honest options are a content hash on the target block, or accepting the risk this sprint and documenting it. **I recommend the content hash**, because silently applying a change to the wrong paragraph is a data-corruption bug, not a UX annoyance.

### Question 4 — Which of the 8 envisioned services actually ship?

**Recommendation: exactly one — `ConsistencyService` — plus the full port/suggestion/apply infrastructure around it.**

**Reasoning:** the sprint's real work is the *architecture* — the `AIProvider` port, the suggestion model, the accept/reject round trip, secret handling, chunking. Building that with **one** service proves the whole shape end to end. Adding a second service adds capability but validates nothing new architecturally, and every prior sprint that stayed narrow (Sprint 8: one platform; Sprint 6: three trim sizes of sixteen) shipped cleanly.

**Why `ConsistencyService` specifically:** of the 8, it is the one whose checks (double spaces, unclosed quotes, unmatched parentheses, empty chapters, inconsistent heading levels) are **verifiable without a human judgment call** — I can assert a real result in a real test. `HumanizationService` or `StyleService` outputs can only be evaluated subjectively, which makes "did this work?" unanswerable by any automated gate this project has.

**A genuine alternative worth the CTO's consideration:** `GrammarService` is the more *demonstrable* choice for a stakeholder demo, and closer to what an author would ask for first. It is also harder to verify objectively. This is a product-versus-verifiability trade-off, and it is the CTO's call, not mine.

**Explicitly recommended against this sprint:** `AIRewriteService` and `HumanizationService` — both rewrite the author's prose wholesale, the highest-blast-radius operations in the entire feature set, and the worst place to discover a bug in a brand-new accept/reject mechanism.

### Question 5 — How is a manuscript larger than the context window handled?

**Recommendation: chunk per `Chapter`, and cap the sprint's scope at manuscripts that chunk cleanly.**

The real numbers: the largest real manuscript processed here is **39,913 words across 17 chapters** — roughly 2,300 words per chapter, comfortably inside any modern context window, while the whole manuscript is not. `Book`'s existing `Chapter` structure gives a natural, already-modeled boundary; no new segmentation concept is needed.

**Disclosed limitation of that approach:** chapter-level chunking cannot detect *cross-chapter* inconsistencies (a term defined in chapter 2 and contradicted in chapter 9). For `ConsistencyService`'s within-chapter checks this is acceptable; it would **not** be acceptable for a future `CitationService`. Recommend recording it as a known boundary rather than solving it now.

### Question 6 — Where do API keys live, and what happens when one is absent?

**No secret-management mechanism exists today** — confirmed: only `process.env.PORT` is read anywhere, `dotenv` is not installed, no `.env` file exists.

**Recommendation:** read the key from an environment variable via `dotenv` (a new dev dependency), never commit any key, add `.env` to `.gitignore`, and — importantly — **degrade honestly when the key is absent**: the endpoint returns a clear "AI provider not configured" error rather than failing obscurely or silently falling back to the fake provider. A silent fallback would mean a misconfigured production deployment quietly returning fabricated suggestions, which is materially worse than an error.

**Also needs an explicit ruling:** whether the repository ever holds a real key at all, or whether real-provider verification is a manual, local-only step the CTO runs. Given this project has never had a secret, **I recommend local-only** and no key in CI.

---

## 4. Architecture Impact (provisional — depends entirely on §3)

```
      Parser → Normalizer → ASTBuilder → Validation Engine
                                                  │
                                                  ▼
                                    ┌──────────────────────────┐
                                    │  EditorialAIUseCase       │  Application
                                    │  (orchestrator only)      │
                                    └────────────┬─────────────┘
                                                  ▼
                                    ┌──────────────────────────┐
                                    │  ConsistencyService       │  Domain
                                    │  (the one service, Q4)    │
                                    └────────────┬─────────────┘
                                                  ▼
                                    ┌──────────────────────────┐
                                    │  AIProvider (port)        │  Domain — NEW
                                    └────────────┬─────────────┘
                                    ┌────────────┴─────────────┐
                                    ▼                            ▼
                        ┌────────────────────┐      ┌────────────────────┐
                        │ FakeAIProvider      │      │ <Real>AIProvider    │
                        │ deterministic,      │      │ Infrastructure,     │
                        │ drives ALL tests    │      │ real network call   │
                        └────────────────────┘      └────────────────────┘

                          produces ──▶ EditorialSuggestion[]  (Domain — NEW)
                                              │
                                              ▼
                        POST /api/manuscripts/suggest    → suggestions
                        POST /api/manuscripts/apply-suggestions → new Book
```

`Renderer`, `PublishingTarget`, `ValidationRuleProvider`, and the whole rendering pipeline are **unchanged** — everything above is new and additive, the same discipline as ADR-0022/0027/0029/0036.

**The dependency direction rule ADR-0037 locked for Publishing Engine applies here identically:** no Editorial AI domain object may reference a specific AI vendor. `EditorialSuggestion`, `ConsistencyService`, and `AIProvider` stay provider-agnostic; only the concrete adapter knows which vendor it is.

---

## 5. Functional / Technical Specifications (provisional)

Deliberately sparse — these shapes depend on §3's answers and are **not** locked. Recording them only so the questions above are concrete rather than abstract.

```typescript
// Domain port (new) - the only thing any service depends on for AI capability.
interface AIProvider {
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
}

// Domain model (new) - a self-contained change proposal (Question 3's shape).
interface EditorialSuggestion {
  id: string;
  targetBlockId: string;        // stable locator into the Book AST
  targetContentHash: string;    // guards against applying to changed content
  originalText: string;
  proposedText: string;
  rationale: string;
  category: 'grammar' | 'style' | 'consistency' | 'readability';
}
```

**Presentation (provisional):** `POST /api/manuscripts/suggest` returns `EditorialSuggestion[]`; `POST /api/manuscripts/apply-suggestions` takes the manuscript plus accepted suggestions and returns a new `Book`. Both stateless, matching `/export` and `/publish`.

---

## 6. Risks

1. **First non-deterministic component in a codebase built on determinism.** `docs/VISION.md` is explicit that the rendering pipeline must stay deterministic. Mitigated structurally by position (upstream of rendering, per the already-reconciled Level 1 ordering) and by Question 2's fake-provider-drives-all-tests recommendation — but it is a genuine first for this project.
2. **First outbound network call, first API key, first per-request cost.** Three new operational concerns at once, none of which this repository has any precedent for.
3. **Quality is not objectively assertable for most of the 8 services.** Question 4's recommendation is shaped primarily by this: a sprint whose acceptance criteria cannot be verified is a sprint that cannot honestly be called done.
4. **Scope is the largest single threat.** `VISION.md` names 8 services and calls the whole thing *"realistically its own Sprint 6/7"* — meaning one sprint for part of it. Attempting more than one service risks a sprint that ends with everything half-built.
5. **Applying a suggestion to changed content could corrupt the manuscript.** Question 3's content-hash recommendation exists specifically to make this fail loudly instead of silently.
6. **Provider APIs change, and pricing changes.** ADR-0036's precedent applies directly: keep vendor specifics behind the port and out of the engine, so a provider swap is a new adapter, not an engine change.
7. **The `PageCountRule` lesson (ADR-0038) is likely to repeat here.** A passing test suite will not prove the AI path works — only a real call against a real manuscript will. `docs/REAL_FIXTURE_POLICY.md` should be extended to cover this engine explicitly, the same way it already names Publishing Engine.

---

## 7. Provisional Commit Plan

Shape only — **not approved**, and contingent on §3.

0. **Commit 0 — AI provider spike** (`backend/spikes/ai-provider-spike.ts`), before any engine code: real API shape, real latency against a real chapter, real token limits versus this repo's real 39,913-word manuscript, real cost per call. Matching the ADR-0019/0020/0030/0035 precedent, which has now caught a wrong assumption **four times**, including once in Sprint 8.
1. **Commit 1** — `AIProvider` port + `AICompletionRequest`/`AICompletionResponse` (Domain).
2. **Commit 2** — `EditorialSuggestion` model (Domain).
3. **Commit 3** — `FakeAIProvider` (deterministic) + its tests.
4. **Commit 4** — `ConsistencyService` against the port, driven entirely by the fake provider.
5. **Commit 5** — the real provider adapter (Infrastructure) + secret handling.
6. **Commit 6** — `EditorialAIUseCase` (Application).
7. **Commit 7** — `POST /api/manuscripts/suggest`.
8. **Commit 8** — `POST /api/manuscripts/apply-suggestions` + the content-hash guard.
9. **Commit 9** — real-fixture verification pass.
10. **Commit 10** — docs/ADR reconciliation.

---

## 8. Provisional Acceptance Criteria

Every item must be independently verifiable against the real running application — not asserted. Sprint 8's criteria were reinforced by an explicit CTO checklist; these are a starting point for the same treatment.

- ✓ A real DOCX is imported and a real `EditorialSuggestion[]` is produced
- ✓ Every suggestion is traceable to a real, locatable block in the real manuscript
- ✓ Accepting a suggestion produces a **new** `Book` — the original is never mutated
- ✓ Rejecting a suggestion changes nothing
- ✓ Applying a suggestion to changed content **fails loudly**, never silently corrupts
- ✓ The entire test suite runs with **zero** network calls and **zero** API keys
- ✓ A real LLM call is proven to work at least once, against a real manuscript
- ✓ No Domain or Application file references any specific AI vendor (grep-verifiable, ADR-0037)
- ✓ Missing configuration produces a clear error, never a silent fallback to fabricated output
- ✓ The rendering pipeline remains byte-for-byte deterministic and unaffected

---

## Related

- `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` §2.2 (Editorial AI Engine, pipeline position already reconciled) and §2.3 (Plugin System, "not this sprint or the next")
- `docs/VISION.md` — the Editorial AI Engine section (8 capabilities, 8 services, accept/reject requirement) and the provider-agnostic ground rule
- `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` Decision 2 — the stateless-backend constraint Question 3 must satisfy
- `docs/architecture/diagrams/PUBLISHING_ENGINE.md` Decision 5 — the no-real-external-calls precedent Question 2 is the analogue of; Decisions 6/7 — the decomposition and provider-port patterns this review reuses
- ADR-0036 / ADR-0037 — the two standing governance rules that apply to this engine unchanged
- ADR-0038 (**OPEN**) — the deferred pagination-metrics question; unrelated to this engine but still open
- ADR-0012 — the port-vs-class precedent `AIProvider` follows
- `docs/REAL_FIXTURE_POLICY.md` — should be extended to name this engine, per Risk 7
- `docs/TESTING_STRATEGY.md` — the determinism foundations Question 2 protects
