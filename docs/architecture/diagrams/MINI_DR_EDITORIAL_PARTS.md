# Mini Design Review — Editorial parts: honest count + presence (Option A of PROOF_EDITORIAL_CONTROL_SCOPE)

**Status:** AWAITING CTO REVIEW — **no code written.** Option A of `PROOF_EDITORIAL_CONTROL_SCOPE.md`, at the CTO's altitude call (2026-07-21): the smallest honest fix, **and it must correct the miscount, not merely add a panel.**
**Date:** 2026-07-21
**Re-verified against current code** (non-negotiable #7): `bookFacts.ts`, the four chapter-count call sites, `Explorer.tsx`, `BookDTO`, `ASTBuilder`/`FrontMatterBuilder` all re-read on `main` today; the faith-alone structure re-extracted. Facts below hold.

---

## 1. The framing the CTO fixed — this is an ADR-0050 fidelity defect, not a missing feature

Today the studio reports **"17 ch"** for `faith-alone`. The book has **15 numbered chapters + an Introduction + a Conclusion** (and an untitled preamble). The displayed figure is not *incomplete* — it is **false**: two real editorial parts are counted as numbered chapters. That is a **fidelity defect (ADR-0050)** — the studio misrepresents the author's manuscript — not merely an absent feature.

**What this mini-review does (Option A, presentation-only):** make the studio's *reporting* faithful — count true chapters as chapters, recognise editorial parts as parts, and show which parts are present or absent. **What it deliberately does NOT do:** it does not populate `frontMatter`/`backMatter`, move any content, change the DTO/model/renderers, or alter the exported PDF. The export still renders Introduction where it sits in the flow. **That boundary is load-bearing — see §6.**

## 2. What changes (all in the frontend presentation layer)

One classifier, one corrected count, one panel — no backend, no DTO, no renderer, no model:

- **A canonical-title classifier** (new `frontend/lib/editorialParts.ts`, or folded into `bookFacts.ts`) scans `book.mainContent`'s **top-level** parts and labels each **chapter** or a recognised **editorial part** (EN/FR).
- **`computeBookFacts` consumes it:** `facts.chapters` counts only true chapters; a new `facts.editorialParts` carries the detected parts (category + the real title + front/back). **This one change corrects every count surface at once** — the miscount flows from a single source (§4).
- **A presence/absence panel** in the **Proof station** (the CTO's "Proof as editorial control" framing), driven by the same classifier: each recognised category shown **present** (✓ + detected title) or **absent** (—).

## 3. The two requirements the CTO locked (verbatim intent)

1. **Canonical-title scan, EN/FR-agnostic — both lists, never English-by-default.** §5.1 fixes the list and the match rule.
2. **Presence/absence panel AND the Explorer count corrected**, so "17 ch" stops lying on a book with identified editorial parts. §5.3/§5.4 fix both, from the same single source.

## 4. Measured inputs

**The miscount has ONE source, feeding FOUR surfaces** — so correcting it once corrects all four (`computeBookFacts` → `facts.chapters`, `bookFacts.ts:75`):

| surface | file:line | shows |
|---|---|---|
| status bar | `AppShell.tsx:67-71` | "N chapters" |
| dashboard | `BookDashboard.tsx:67,70` | "N ch." / "N chapters" |
| Explorer tree | `Explorer.tsx:59` | "N ch" |
| Inspector | `Inspector.tsx:80` | "Chapters: N" |

**Real-fixture evidence** (faith-alone, re-extracted): top-level `[chapter] "INTRODUCTION"` and `[chapter] "Conclusion: Nothing but Faith"` — real editorial parts counted as chapters; `[section] ""` untitled preamble (the same section whose drift `MINI_DR_SUBTITLE_SPACING` just closed); **no bibliography** (present/absent genuinely varies on one real book).

**Decoupling from the model:** Option A is presentation-only, so the panel's recognised-parts list is **not** bound to which `FrontMatter`/`BackMatter` fields exist. The model has no `conclusion` field, yet the panel may still recognise a Conclusion — because A never writes the model. (Populating the model is B/C.)

## 5. Design decisions (recommendations to lock)

### 5.1 The canonical list + match rule (requirement 1)

**Match rule — a lookup, not an inference:** a top-level part is an editorial part iff its title, **up to an optional separator** (`:`, `—`, `–`, `-`) and trimmed, **case-insensitively equals** a canonical name in the **union of the EN and FR lists**. This catches faith-alone's `"INTRODUCTION"` (whole title) and `"Conclusion: Nothing but Faith"` (segment before `:`), and **rejects** `"Chapter One: What Is Faith?"` (segment "Chapter One") and `"Introduction to Quantum Fields"` (no separator; whole title ≠ "Introduction"). The exactness is the false-positive safeguard.

**The list (proposed — the CTO trims/extends; this IS requirement 1):**

| category | placement | EN | FR |
|---|---|---|---|
| dedication | front | Dedication | Dédicace |
| epigraph | front | Epigraph | Épigraphe |
| foreword | front | Foreword | Avant-propos |
| preface | front | Preface | Préface |
| prologue* | front | Prologue | Prologue |
| introduction | front | Introduction | Introduction |
| acknowledgments | front | Acknowledgments, Acknowledgements | Remerciements |
| conclusion* | back | Conclusion | Conclusion |
| epilogue* | back | Epilogue | Épilogue |
| afterword | back | Afterword | Postface |
| appendix | back | Appendix, Appendices | Annexe, Annexes |
| bibliography | back | Bibliography, References | Bibliographie, Références |
| glossary | back | Glossary | Glossaire |
| index | back | Index | Index |
| notes | back | Notes | Notes |
| colophon | back | Colophon | Colophon |
| about the author | back | About the Author | À propos de l'auteur |

*Marked members (prologue/conclusion/epilogue) are the **ambiguous** ones — in fiction they can be narrative chapters. faith-alone's "Conclusion" is a genuine editorial part, so I include them, but flag them as the CTO's most likely trim candidates. **Union matching** (both lists always) satisfies "not English-by-default"; `metadata.language`-gating is a possible refinement, not needed (cross-language collisions among these names are nil).

### 5.2 Where the classifier lives — the frontend, single source

In `bookFacts.ts` (or a sibling it calls), client-side over `book.mainContent` (which already carries titles). **No backend, no DTO, no `frontMatter` population.** Every count surface already reads `computeBookFacts`, so they all correct together — the smallest possible blast radius for "fix the count everywhere."

### 5.3 The corrected count (requirement 2a)

`facts.chapters` counts only parts classified as chapters. The four surfaces then read the honest number with no change of their own. Where useful, a surface may also show the parts (e.g. Explorer "Book" group: `15 ch · 2 parts`) — a display choice to settle, but the *number* is fixed at the source.

### 5.4 The panel (requirement 2b)

In the Proof station: recognised categories grouped front/back, each **present (✓ + real title)** or **absent (—)**. Present rows are honest evidence ("Introduction — detected from 'INTRODUCTION'"); absent rows answer the CTO's literal question ("Bibliography — absent"). This panel is *what makes the count-correction honest* rather than silent (§5.5).

### 5.5 Honesty (ADR-0049) — why a presentation-layer reclassification is not a silent one

ADR-0049: *suggest, never silently assert.* The count changes from 17 to 15+2, which is a reclassification — but it is **not silent**, because the panel shows exactly which parts were detected and from which titles. The author sees the classification and can judge it. The **domain model is unchanged** (they remain chapters in `mainContent`); the frontend adds a *more faithful lens* over it. So A **improves** ADR-0050 fidelity (the reporting becomes truer than the un-detected domain) **without** an ADR-0049 violation (nothing hidden). No persisted author override exists in A — that is Option C.

## 6. The load-bearing scope boundary (the CTO's condition, stated loud)

**A fixes the studio's *reporting* fidelity, not the exported book's *placement*.** After A: the studio says "15 chapters + Introduction + Conclusion (editorial parts)", but the **exported PDF still renders Introduction as the part sitting in position 2 of the flow** — because A touches no renderer. If mispositioning in the export (a bibliography rendered mid-book, front matter after chapter 1) is judged a fidelity defect in its own right, **that is its own scope report (Option B/C territory) — not a silent extension of this mini-review.** Recorded here so the limitation is disclosed, not discovered later.

## 7. Verification plan (for when code is authorised)

- **Real-fixture (the load-bearing proof):** faith-alone's structure → classifier labels INTRODUCTION + Conclusion as editorial parts → `facts.chapters === 15`, `facts.editorialParts` has both with their real titles; panel: introduction present, conclusion present, **bibliography absent**. Asserted on the real corpus structure (jsdom over the real DTO), not a synthetic list.
- **EN/FR:** French titles (Préface / Bibliographie / Annexe) classify from the FR list — proving requirement 1 is not English-only.
- **False-positive guard:** "Chapter One: What Is Faith?" and "Introduction to Quantum Fields" (no separator) stay chapters — the miscount's inverse must not appear.
- **Single-source coverage:** all four count surfaces show the corrected number (or a `bookFacts` unit test proving the one source is correct, the surfaces being thin readers).
- **Frontend suite only** (jsdom); no backend change, so the backend gate is untouched.

## 8. Risks

- **False positive (a real chapter titled exactly a canonical name).** Bounded by whole-segment exact match (§5.1) and disclosed by the panel (§5.5). No persisted override in A; recourse is the future manual chantier (C). The ambiguous list members (§5.1*) are the CTO's trim lever.
- **Reporting/export divergence.** Named in §6 — the studio count and the export placement disagree until B/C. Disclosed, not hidden.
- **List completeness / localisation.** The list is requirement 1 and the CTO's to lock; union matching avoids an English default. A missed part reads as "absent" (a false negative — safe, visible, correctable by extending the list) rather than a wrong assertion.

## 9. What the CTO is asked to lock

1. **The canonical list + the ambiguous trims** (§5.1) — prologue/conclusion/epilogue in or out.
2. **Match rule** — leading-segment exact, union of EN+FR (recommended), vs `metadata.language`-gated.
3. **Count display** — corrected number only, vs also showing "· N parts" beside it (§5.3).
4. **Panel home** — Proof station (recommended), vs also a compact Explorer indicator.
5. **The §6 boundary** — confirm A stays presentation-only, replacement deferred to its own report.

**No code until these are locked.**

## Implementation note (added at build time — the design above is unchanged; this records what the build settled)

Three as-built facts, all CTO-acknowledged:

1. **A bare hyphen is NOT a subtitle separator.** The design listed `-` among the separators; building it showed a bare `-` lives inside canonical names ("Avant-propos", the FR foreword), so splitting on it would silently break that match. The separators are `:`, `—`, `–`, and a **spaced** ` - ` only. Caught while constructing, not in production.
2. **Enumerated parts are a disclosed false NEGATIVE, frozen as a tested property.** Under the CTO-locked exact-segment rule, "Appendix A" / "Annexe 1" have a leading segment ("Appendix A") that is not the bare canonical name, so they read as **chapters** — safe (a false negative, never a false positive), visible, and asserted as *intended* behaviour in `editorialParts.test.ts`. The CTO's ruling: keep the safe false negative; extending the rule to `canonical + short enumerator` is a real rule change to reopen only if a real author with numbered appendices actually hits it — its own small report, not now.
3. **Verified live on faith-alone (the load-bearing proof):** 15 chapters across the Explorer, dashboard and status bar (was 17); the Proof panel shows Introduction present ("INTRODUCTION"), Conclusion present ("Conclusion: Nothing but Faith"), Bibliography **absent**; zero console errors. Screenshot capture hangs on the embedded-PDF Proof (known env issue) — verified via the accessibility tree instead. The §6 boundary held: model and export untouched.

Merged to `main` (`1806809`); frontend 160/160, backend 653/653, tsc + eslint clean.

## Related
`PROOF_EDITORIAL_CONTROL_SCOPE.md` (the measured scope this implements — Option A), ADR-0050 (fidelity is the product — the miscount is its defect; A makes reporting faithful), ADR-0049 (suggest-never-silently-assert — the panel is what keeps the count-correction honest), `HEURISTIC_STRUCTURE_DETECTION` (why canonical top-level titles are a lookup, not the closed 0% inference), `CREATE_CHAPTER.md` / `STRUCTURE_EDITING.md` (author-controlled marking — the Option C this defers to), `bookFacts.ts` (the single count source A corrects), `MINI_DR_SUBTITLE_SPACING.md` (the untitled preamble in §4 is the section whose drift it closed).
