# Editorial AI — Minimal Structure-Normalization Slice: Investigation & Cost Estimate

> **⛔ FROZEN by `NO_PAID_AI_BEFORE_REVENUE` (founder constraint, 2026-07-21).** The chiffrage below **still holds, unchanged** — but spike A itself is now gated by a **cost constraint** (no dependency on a paid AI API before the product generates revenue), not only by ADR-0039's strategic priority. `spike/editorial-structure-detection` stays on its branch: **not run, not deleted**, no key, no network call. Nothing is closed permanently — the `AIProvider` port is agnostic by design and a local/self-hosted model reopens this path with no re-architecture. See `docs/DECISIONS.md` → Governance Record `NO_PAID_AI_BEFORE_REVENUE`.

**Status:** INVESTIGATION Design Review / CHIFFRAGE for the CTO to carry to the founder. **No code. No sprint commitment. Not a reopening of the full Editorial AI Engine** — Grammar / Style / Humanization / AIRewrite / Readability / Consistency / Citation all remain at Sprint 18+ (ADR-0039), no exception. This document answers exactly one question: **what does the minimal structure-normalization slice really cost, isolated from the rest of the engine?**
**Date:** 2026-07-20 (session), grounded in the code on `main` at `04b1ffa`. Founder feu vert received (per CTO directive 2026-07-21).
**Parent:** `EDITORIAL_AI_ENGINE.md` (the full engine, deferred). This slice reuses that draft's already-reconciled infrastructure decisions and narrows the *service* to one.

---

## 1. The slice, precisely

Detect a paragraph that is really an **unmarked heading** — an isolated line the author set in all-caps or bold instead of applying a Word heading style — and **propose** its reclassification as a heading. Never silent: surfaced as an explorable finding (ADR-0049), applied only on the author's confirmation. Nothing else. No prose rewriting, no grammar, no style.

- **Pipeline position:** on the `Book` AST after import (`ASTBuilder` output), before `ThemeEngine`. The rendering pipeline stays deterministic and untouched — the LLM runs at review time, produces a suggestion, and only a confirmed suggestion mutates the (deterministic) AST into a new `Book` (immutability, `Book.ts`).
- **Provider-agnostic** by construction (`VISION.md` §AI Features): the slice depends on an `AIProvider` port; no Domain/Application file names a vendor (ADR-0037 applies unchanged).
- **Explorable, never silent** (ADR-0049): a `POSSIBLE_UNMARKED_HEADING`-class finding, in the same "a screen may only show an error it can name" channel the import path already uses.

---

## 2. The one fact that dominates the cost (re-measured, directive-#2 discipline)

**This slice is the exact problem `HEURISTIC_STRUCTURE_DETECTION` closed on evidence at precision 0.0%.** That chantier measured (spikes on `spike/heuristic-structure`, `TODO.md`): the formatting properties that survive import are precisely the ones a real author never uses to mark a heading; the best heuristic rule scored **precision 0.0% / recall 0.0%** against the only ground truth available (faith-alone's 17 real `Heading 1`), and the raw-OOXML avenue was closed too (12pt for all 2,660 paragraphs — the size isn't in the source).

**The slice's entire value rests on one unmeasured hypothesis:** that an LLM *reading the actual text* — "THE POWER OF HABIT" alone on a line reads as a title to a language model, regardless of what formatting survived — clears ADR-0049's usability threshold (**under 5% false positives, as a suggestion never as silent truth**) where the formatting-attribute heuristic scored zero. This is genuinely a *different mechanism* (semantics, not surviving attributes), so it is plausible. **Plausible is not measured**, and this project's own discipline — the very rule added this session (`DESIGN_REVIEW_PROCESS.md`, "re-verify before building") — says the number is the gate, not the intuition.

**Therefore the cost is spike-gated.** The dominant line item is not the build; it is the measurement that tells you whether to build at all.

### Re-verification performed for this estimate (directive #2)
- **Still zero AI / outbound-HTTP code on `main`** — `grep` for provider names / `fetch(` / `axios` / `https.request` returns only a `CLAUDE.md` comment reference; `EDITORIAL_AI_ENGINE.md` §2's core claim holds. The four "firsts" (network, secret, cost, non-determinism) are all still genuinely first.
- **No structured change model exists** — `ValidationIssue.suggestion?: string` is a free-text hint only (`Book.ts`); there is no diff / accept-reject / reclassification model. The explorable-findings *channel* exists (ADR-0049, `UNSTRUCTURED_MANUSCRIPT` / `EMPTY_HEADING_DROPPED` codes, `ImportReportMapper`), so surfacing is partly built; the *structured suggestion* is not.

---

## 3. Cost decomposition — the honest shape of "minimal"

"Minimal scope" narrows the **service** to one. It does **not** reduce the **infrastructural floor**: any Editorial-AI slice, however small, crosses the four thresholds once. The founder should hear this plainly — the tiniest LLM feature is not a tiny change.

| Layer | What it costs | Sizing |
|---|---|---|
| **A. Prerequisite spike (the gate)** | Run the real corpus's unstyled manuscripts (`generated-unstyled-3060w`, `pm-notes-unstyled-fr`, `art-of-captivating`) through **one** LLM with a structure-classification prompt; measure precision/recall against ground truth (faith-alone's 17 real headings as positive control). Answers the §2 question against ADR-0049's <5% bar. Throwaway; needs a provider key + a few thousand tokens. | **~1 spike.** Decisive on its own. |
| **B. Fixed infrastructure (paid once by ANY slice)** | `AIProvider` port + `FakeAIProvider` (deterministic, drives all CI) + one real adapter + secret management (`dotenv`, `.env`, honest degradation when absent) + the determinism-boundary guarantee + the stateless suggest/apply round trip with a content-hash guard. This is `EDITORIAL_AI_ENGINE.md`'s Commits 1–3, 5–8 minus the service. | **~7–8 commits.** Not reducible by narrowing scope. |
| **C. Marginal service (the actual slice)** | A structure-classification prompt + a `StructureSuggestion` model (paragraph → heading-level reclassification, self-contained per Q3) + wiring to the existing explorable-findings channel + the author-confirmation UX (frontend). | **~2–3 commits + frontend.** Small — *if* B is paid and A cleared. |

**Total, conditional:** if the spike (A) clears ADR-0049's threshold, the build is **B + C ≈ a full small sprint (~10–11 commits) plus a frontend confirmation surface**. If the spike does not clear it, the slice is **closed on evidence at the cost of A alone** — exactly how `HEURISTIC_STRUCTURE_DETECTION` closed, and the same money-saving outcome the re-verification rule exists to produce.

---

## 4. Strategic note for the founder (disclosed, not scoped)

If the spike clears the bar, this same mechanism is a **keystone**, not a toy: an LLM that reads text to classify structure is also the mechanism that could reopen the *value* of `HEURISTIC_STRUCTURE_DETECTION` (closed for heuristics, not for semantics) and satisfy `C1_QUOTE_PRESENTATION_UNBLOCK` condition 2 (semantic detection making the `quote` path reachable from a real unstyled DOCX — today measured at zero quotes across the whole corpus). One narrow, well-measured slice de-risks a whole class of later work. That is upside to weigh, not scope to commit now.

Conversely, if the spike fails, the founder learns — cheaply, before any sprint — that structure detection is out of reach for *both* mechanisms this project can try, which is itself a decision-grade result.

---

## 5. Constraints this slice must hold (carried from the full review, non-negotiable at any scope)
- **Provider-agnostic** (`VISION.md` §AI Features) — the rule does not relax because the scope is small.
- **Deterministic rendering pipeline** — the slice sits between import and `ThemeEngine`, never inside a renderer; CI runs on `FakeAIProvider` with zero network, zero keys.
- **Explorable errors** (ADR-0049) — a suggestion, confirmed by the author, never a silent correction.

---

## 6. The recommendation (this is the chiffrage answer)

**Spike first, and let the number decide.** The real cost of the minimal slice is: **one throwaway spike to measure whether an LLM clears ADR-0049's <5%-false-positive bar on real unstyled manuscripts — a bar the heuristic alternative scored 0.0% against — followed, only if it clears, by a bounded ~10–11-commit build that pays the full four-firsts infrastructural cost that any Editorial-AI slice must pay once.** No sprint should be committed, and no resequencing decided, before the spike's number exists. That number is the single input the founder's decision actually turns on, and it is cheap to obtain.

---

## Related
- `EDITORIAL_AI_ENGINE.md` — the full engine (deferred, Sprint 18+); this slice reuses its infra decisions (§4 diagram, the `AIProvider`/`EditorialSuggestion` shapes, the stateless suggest/apply round trip).
- `TODO.md` → `HEURISTIC_STRUCTURE_DETECTION` (closed at 0.0% for heuristics) and `C1_QUOTE_PRESENTATION_UNBLOCK` condition 2 (what a working semantic detector would unblock).
- ADR-0049 (explorable errors — the suggestion-never-silent pattern), ADR-0039 (the strategic deferral this slice is measured *ahead of*), ADR-0037 (provider-agnostic dependency direction).
- `DESIGN_REVIEW_PROCESS.md` — "re-verify a cited ADR before building on it," the rule this estimate applied to its own foundations.
