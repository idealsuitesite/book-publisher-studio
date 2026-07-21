# The Proof as Editorial Control — Scope Report (measured, no code)

**Status:** 📋 SCOPE REPORT — read-only, measured on `faith-alone` (real corpus). No production code opened (the `GUTTER_SCOPE.md` / `SUBTITLE_SPACING_SCOPE.md` format: measure and locate the gap; the CTO decides whether a chantier follows, and at what altitude).
**Date:** 2026-07-21. A new idea (CTO), ahead of per-theme fine-tuning.
**The CTO's question, verbatim in intent:** does the living Proof surface whether the *editorial parts* — preface / bibliography / annex (and their kin) — are **present or not**?
**Instrument:** reading `Book` (the model), `ASTBuilder` / `FrontMatterBuilder` (import), `BookDTO` / `bookFacts.ts` (transport + facts), `Explorer.tsx` (the tree), the validation rule set; plus a real-structure extraction of `faith-alone`.

---

## §0 — The measured answer: **No, at three layers — and worse, present parts are miscounted as chapters**

The living Proof does not surface whether editorial parts are present, and neither does any other studio surface. The gap is not one missing view — it is a **three-layer void**, each layer measured:

1. **Detection (import) — the parts are never identified.** `ASTBuilder.build` sets `frontMatter: {}` and `backMatter: {}` on every import (`ASTBuilder.ts:138,140`). The only thing that ever fills front matter is `FrontMatterBuilder`, which synthesises **exactly two** members from metadata — `titlePage` and `copyrightPage` (`FrontMatterBuilder.ts:32-37`) — and its own header states the rest is "entirely unconsumed." So `preface`, `foreword`, `introduction`, `acknowledgments`, `dedication`, `bibliography`, `appendices`, `glossary`, `index`, `colophon` are **never populated from a real manuscript**.
2. **Transport (DTO) — the parts cannot cross to the frontend.** `BookDTO` carries `metadata` + `mainContent` only (`BookDTO.ts:7-14`). There is **no `frontMatter`/`backMatter` field on the DTO at all** — so even if import populated them, the studio could not see them.
3. **Surfacing (studio) — no surface has the concept.** `computeBookFacts` counts chapters/sections/images/citations/footnotes/tables (`bookFacts.ts:60-93`); the Explorer's "Book" group renders exactly those (`Explorer.tsx:52-66`). **No editorial-part notion exists anywhere in the frontend** (grep: zero matches for preface/bibliography/foreword/… across `frontend/`). Validation is the same: **zero** rules reference any editorial part (grep over `domain/services/validation/`) — it flags missing *metadata* (ISBN/description/cover) and the `UNSTRUCTURED_MANUSCRIPT` state, never "no preface / no bibliography."

**The Proof itself** renders the exported PDF, whose front matter is only what `FrontMatterBuilder` synthesises (a title page and a copyright page, when metadata exists) — so the Proof shows those two, plus every editorial part **flattened into the chapter flow**, indistinguishable from a chapter.

## §1 — Real-fixture evidence: `faith-alone` has editorial parts, and they are silently absorbed

Extracted from the real corpus manuscript (its true top-level structure, not a synthetic fixture):

| # | as imported | what it really is |
|---|---|---|
| 1 | `[section] ""` — 12 blocks | an **untitled preamble** (dedication / epigraph / front-matter block). *This is the same untitled section behind the empty-title ADR-0051 drift just closed — cross-confirmed.* |
| 2 | `[chapter] "INTRODUCTION"` | an **editorial front-matter part** (`FrontMatter.introduction` exists in the model) — imported as an ordinary chapter |
| 3–17 | `[chapter] "Chapter One…"` … `"Chapter Fifteen…"` | the 15 real chapters |
| 18 | `[chapter] "Conclusion: Nothing but Faith"` | an **editorial closing part** (afterword/conclusion) — imported as a chapter |

**What the author is told today:** the Explorer reports **"17 ch"**. The book actually has **15 numbered chapters + an Introduction + a Conclusion + an untitled preamble.** The editorial parts are not merely un-surfaced — they are **miscounted as chapters**, and their presence-or-absence is invisible.

**And absence is real too:** `faith-alone` has **no bibliography** (a theology book that cites scripture constantly but carries no formal reference section). So the very state the CTO wants surfaced genuinely varies across one real book: *introduction present, conclusion present, bibliography absent* — and nothing in the studio says any of it.

## §2 — The model already affords this (this is filling a hole, not inventing one)

`FrontMatter` and `BackMatter` have been **fully typed since Sprint 1** and are almost entirely unconsumed:
- `FrontMatter`: `cover`, `titlePage`, `copyrightPage`, `dedication`, `toc`, `preface`, `foreword`, `introduction`, `acknowledgments` (`Book.ts:74-84`).
- `BackMatter`: `appendices`, `bibliography`, `glossary`, `index`, `colophon` (`Book.ts:362-368`) — with real sub-shapes (`Bibliography.entries: BibEntry[]`, `GlossaryTerm`, `IndexEntry`).

So a chantier here does **not** design a new model — it fills types that already exist. The work is: *identify* parts at import, *carry* them on the DTO, *render* them in the right place, and *surface* their presence. Nothing in the domain shape has to change.

## §3 — Why this is NOT the closed `HEURISTIC_STRUCTURE_DETECTION` problem (measured distinction, with caveats)

Detecting *chapter boundaries* in an unstyled manuscript is closed on evidence at **0% precision** — the signal an author uses to mark a heading does not survive import (`HEURISTIC_STRUCTURE_DETECTION`). **Editorial-part identification is a different problem with a genuinely reachable signal:** editorial parts carry **canonical titles**. `faith-alone`'s "INTRODUCTION" and "Conclusion" match a known-name list *exactly*, at the top level, where chapter-boundary detection had nothing to read. A title-keyword scan of top-level parts is not the intractable problem — it is a lookup.

**But it must be measured and caveated, not assumed** (the lesson of that same lineage):
- **False positives:** a legitimate chapter titled "Introduction to Quantum Fields" would match "introduction." Detection must be a *suggestion*, never a silent assertion — the ADR-0049 explorable-finding pattern ("this looks like an Introduction — confirm?"), not an automatic reclassification.
- **Localisation:** the known-name list is language-specific. The founder writes in French and a French corpus fixture exists (`pm-notes-unstyled-fr.docx`); Préface / Introduction / Bibliographie / Annexe / Glossaire / Index / Remerciements / Conclusion / Postface must be in scope, not just English.
- **Presence ≠ placement:** a title match tells you a part is *present*; it does not, by itself, move that part from `mainContent` into `frontMatter`/`backMatter`. Surfacing presence and *reclassifying* content are two different amounts of work (see §4).

This connects directly to the manual-structure-editing doctrine: just as the CTO chose **author-controlled** chapter creation over 0%-precision inference, editorial-part identity could be author-marked (or suggest-then-confirm), never silently guessed.

## §4 — Three altitudes a chantier could take (for the CTO to weigh — none opened here)

- **A — Surface-only presence checklist (smallest).** A read-only panel (in the Proof or the Explorer's "Book" group) listing the editorial parts and whether each is *present or absent*, driven by a title-keyword scan of `mainContent`'s top-level parts — **suggested, honestly labelled** ("detected", ADR-0049 style). No model change, no DTO `frontMatter`, no renderer change, no reclassification. **Answers the CTO's literal question at the lowest blast radius.** Cost: a client-side (or thin backend) scan + one panel; risk is purely the heuristic's honesty (false pos/neg, disclosed).
- **B — Detect + reclassify at import (largest).** Populate `frontMatter`/`backMatter` from detection, carry them on a widened `BookDTO`, render them in their correct positions (front matter before chapter 1, back matter after the last), and surface them in the Explorer. Blast radius spans **import → DTO → all three renderers → frontend**, and reclassification is a semantic assertion about real content (the false-positive risk becomes a *rendering* change, not just a label). Its own Level-2 review, minimum.
- **C — Manual marking (author-controlled, no heuristic).** Extend the manual `StructureEditor` so an author marks a top-level part as preface / bibliography / annex / … ; no detection guess, zero false positives, surfaced once marked. Still needs the DTO + render wiring of B, but replaces the detection risk with an author action — the exact trade the create-chapter chantier already made.

These are genuinely different options with different blast radii and different risk shapes — which is the signature of a decision that needs a **Design Review**, not a mini-review, *if* the CTO wants B or C. Option A alone is small enough to be a mini-review on its own.

## §5 — Recommendation

A **real, measured gap** with **real-fixture evidence** (`faith-alone`: introduction + conclusion flattened as chapters, a bibliography genuinely absent, a preamble untitled), sitting on a model that **already affords** the parts. The answer to the CTO's question is a clean **"no, at three layers"** — worth closing, but **not a one-value fix** like subtitle spacing: it spans detection, transport, rendering and surfacing.

**Recommend the CTO first choose the altitude**, because it changes everything downstream:
- If the goal is literally *"does the Proof tell me a part is present or missing?"* → **Option A**, a small **mini Level-2 review** (one honest detection scan + one presence panel), no model/DTO/renderer change.
- If the goal is *editorial parts as first-class, correctly placed in the book* → **Option B or C**, its own **Level-1 → Level-2 Design Review**, with the detection-vs-manual choice (and the localisation list) as locked questions before any code.

**Not opened here; measure done; awaiting the CTO's altitude call. No code before that.**

## Related
`HEURISTIC_STRUCTURE_DETECTION` (closed at 0% — why *this* signal is different: canonical titles vs unstyled boundaries), `CREATE_CHAPTER.md` / `STRUCTURE_EDITING.md` (the author-controlled-over-inference doctrine Option C extends), ADR-0049 (explorable findings — "suggest, never silently assert", the pattern any detection here must follow), ADR-0052 / Q3 (`FrontMatterBuilder` synthesising title/copyright on the project path — the only front matter that exists today), `MINI_DR_SUBTITLE_SPACING.md` (the untitled-preamble section in §1 is the one whose drift that chantier closed), `GUTTER_SCOPE.md` (this report's measure-first format).
