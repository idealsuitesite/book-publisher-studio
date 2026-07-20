/**
 * Provider-agnostic boundary for AI text completion.
 *
 * ANCHOR ONLY (MINI_DR_AIPROVIDER_PORT.md, CTO-approved 2026-07-21). No implementation exists and
 * none is authorized: the whole Editorial AI chantier is SUSPENDED until the first commercial
 * revenue-generating phase (`NO_PAID_AI_BEFORE_REVENUE`, docs/DECISIONS.md). This interface is a
 * fixed architectural point the future engine will attach to — nothing consumes it today.
 *
 * ADR-0037: no Domain type names a vendor. A concrete adapter (OpenAI-compatible chat, Anthropic
 * messages, or a local/self-hosted model) maps these agnostic shapes to its own provider's params.
 *
 * The shape is PROVISIONAL. Per MINI_DR_AIPROVIDER_PORT.md §2bis, when the suspension lifts it MUST
 * be revalidated against a real implementation (even a FakeAIProvider alone, no paid adapter)
 * BEFORE any wiring into the pipeline — never assumed correct because it compiled on paper first.
 */

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

export interface AIProvider {
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
}
