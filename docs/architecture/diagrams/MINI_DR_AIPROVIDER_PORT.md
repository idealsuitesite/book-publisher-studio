# Mini Design Review — the `AIProvider` port as an architectural anchor (interface only)

**Status:** 🟡 MINI DESIGN REVIEW — awaiting CTO approval. **No code written.** A Domain interface commits a *shape*, not just a line of code (the standing rule, `DESIGN_REVIEW_PROCESS.md`), so even this small artifact is reviewed before it is written.
**Date:** 2026-07-21
**Scope (strict, founder-directed):** produce **one** artifact — an empty, provider-agnostic `AIProvider` Domain interface, as an anchor point. **Nothing else.**
**Explicitly out of scope, suspended with the rest** (`NO_PAID_AI_BEFORE_REVENUE`, `EDITORIAL_AI_STRUCTURE_SLICE.md` §3 "items B"): `FakeAIProvider`, any real adapter, secret management, and any wiring into `ASTBuilder` / `ThemeEngine` / a use case. This review authorizes an interface, not a functional brick.

---

## 1. Current state (verified, not assumed)

**The port does not exist in code.** `grep` across `backend/src` for `AIProvider` / `AICompletionRequest` returns **zero** — it lives only as a sketch in `EDITORIAL_AI_ENGINE.md` §5 and `EDITORIAL_AI_STRUCTURE_SLICE.md`. This review therefore decides the shape *before* it is written, which is the point of the exercise.

## 2. The one real tension to name (this project's own rule pulls against this)

`DEVELOPER_HANDBOOK.md`'s port-vs-class rule: introduce a port when **more than one real implementation is plausible AND you have one to validate the shape against** — the discipline that made `ValidationRuleProvider` (Sprint 8) and `Renderer` (Sprint 2) sound, each proven by a real implementation in the same sprint. **An interface with zero implementations is normally the speculative-abstraction anti-pattern this project avoids** (a shape validated by nothing, code with no consumer).

The founder's direction overrides this **deliberately and narrowly**: the value here is the *anchor*, not a working capability — a fixed point the future engine attaches to, declaring the architectural intent (an agnostic AI boundary, ADR-0037) while every implementation stays suspended. This review records it as a **disclosed, deliberate exception**, not an oversight. The mitigation is minimality (§3): the less the shape asserts, the less a real first consumer can later prove wrong.

## 3. The proposed shape (minimal, agnostic — for CTO approval)

A single Domain port with one method and the smallest agnostic request/response that still fits any provider (OpenAI-compatible chat, Anthropic messages, or a local model). No vendor name anywhere (ADR-0037). Placed at `backend/src/domain/ports/AIProvider.ts`, beside `Renderer`, `DocumentParser`, `LayoutSelector`.

```typescript
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionRequest {
  messages: AIMessage[];
  // Agnostic hints only; a concrete adapter maps these to its own provider's params.
  maxTokens?: number;
  temperature?: number;
}

export interface AICompletionResponse {
  text: string;
}

/**
 * Provider-agnostic boundary for AI text completion (ADR-0037: no Domain type names a vendor).
 * ANCHOR ONLY — no implementation exists, none is authorized (NO_PAID_AI_BEFORE_REVENUE). The
 * shape is provisional: the first real adapter may refine it, and that is expected.
 */
export interface AIProvider {
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
}
```

**Why this shape, minimally:**
- `messages[]` (not a bare `prompt`) is the common denominator across chat-style and message-style APIs and local models — the one choice that avoids re-shaping later.
- `text` is the only response field any consumer is certain to need; token usage, finish reasons, and tool calls are deliberately omitted until a real consumer needs them (adding an optional field later is additive, ADR-0022 pattern; removing a speculative one is a break).
- `maxTokens`/`temperature` are optional agnostic hints, not required — an adapter may ignore them.

## 4. Risks
1. **Speculative shape, no consumer to validate it** — the §2 tension. Accepted deliberately (founder direction); mitigated by minimality and an explicit "provisional" doc-comment so a future refinement reads as expected, not as churn.
2. **An exported interface with no implementation and no test** — correct and acceptable: an interface has no behaviour to test, and an unused *export* is not an eslint/tsc error. Coverage is unaffected (types carry none).
3. **The anchor could invite premature wiring** — guarded by the doc-comment and this review's out-of-scope list; the port compiles and sits inert, exactly like `Block.dropCap` did before it had a producer.

## 5. Decisions for the CTO
1. **Approve the shape** in §3 (single `complete`, `messages`/`text`, optional hints) — or direct a different one.
2. **Accept the port-vs-class exception** (an unimplemented port as an anchor, §2) as a disclosed, founder-directed deviation recorded here — or decide the interface should wait until a real implementation can validate it.
3. **Location** `backend/src/domain/ports/AIProvider.ts` — confirm.

## 6. Acceptance criteria (for when the port is written, post-approval)
- The interface exists in Domain; `grep` for any vendor name (`openai`/`anthropic`/`claude`/`gemini`/…) over it returns zero (ADR-0037, script-checkable).
- No implementation, no `FakeAIProvider`, no import of it anywhere in the pipeline.
- `tsc` and `eslint` clean; test count unchanged (nothing to test).

## Related
- ADR-0037 (dependency direction — Domain never names a vendor), ADR-0012 (the `Renderer` port precedent this follows), ADR-0022 (additive-over-breaking, why the response is minimal).
- `EDITORIAL_AI_ENGINE.md` §5 (the original sketch), `EDITORIAL_AI_STRUCTURE_SLICE.md` §3 (the suspended "items B"), `NO_PAID_AI_BEFORE_REVENUE` (`docs/DECISIONS.md`, `docs/TODO.md`) — why everything but this interface stays suspended.
- `DEVELOPER_HANDBOOK.md` port-vs-class rule (the discipline this narrowly, deliberately excepts).
