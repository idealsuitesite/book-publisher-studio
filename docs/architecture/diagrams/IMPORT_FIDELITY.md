# Import Fidelity — Targeted Design Review (CTO-ordered, freeze in effect)

**Status:** ✅ **APPROVED (CTO verdict 2026-07-20) with two amendments: the zero-chapter publication block targets the KDP action specifically and is documented as provisional pending `ValidationProfile`; the word threshold lives in one named, documented constant. ADR-0049 records the state as an architecture decision. Commit 1 executed (see §4).** Per CTO direction (2026-07-20): all new engine work (Validation evolution, Editorial AI, Layout) is **frozen** until the import pipeline is proven reliable on real, varied manuscripts. This review is deliberately short: root cause, correct error contract, real tests. Not a manifesto.
**Date:** 2026-07-20
**Trigger:** the CTO imported a real manuscript and saw `0 chapters` on a ~150-page book with Structure scored **100/100**, then Proof failing with *"Project not found"*. Same defect family as the `<s>` and `.trim()` bugs: fidelity loss at import, discovered downstream instead of at the door.

---

## 1. Evidence — every number below was reproduced live, not guessed

| Fixture (real files from `backend/uploads/`) | What the pipeline did |
|---|---|
| `Project Management notes.docx` (23KB, 121 paragraphs, **zero Word Heading styles** — only `Paragraphedeliste`, headings faked with bold runs) | Mammoth: 47 `<p>`, 19 `<strong>`, **zero `<h1>-<h6>`** → ASTBuilder: everything into **one anonymous level-0 section** → `statistics.chapters: 0` → **Structure 100/100**. No warning anywhere. |
| `Faith_Alone_Professional_KDP_Kobo.docx` (2.9MB, ~40k words ≈ 150 engine pages, real `Heading 1/2` styles) | **17 chapters detected correctly**, titles intact, word count byte-faithful (39,913 = 39,913). The pipeline works when Word styles exist. |
| Same file, detail | Mammoth emits **18 h1 — one is empty** (`""`, a blank Heading-1 paragraph in the real manuscript). The empty heading is silently absorbed; 17 chapters result. No disclosure. |
| *"Project not found"* | Reproduced live today: after `POST /api/dev/reset-projects`, `GET /api/projects/<stale-id>` → `404 {"error":"Project not found"}`. All four `ProjectsController` handlers share this one string. The CTO's occurrence (2026-07-15, ten re-uploads of the same file in 20 minutes in `uploads/`) predates SQLite: the in-memory store lost every project on any `tsx watch` restart. |

**No content loss was found in either file** (word counts match mammoth's own output). The loss is *structural* (chapters) and *informational* (the product doesn't say so).

## 2. Root cause, component by component

1. **`MammothParser` (Infrastructure)** — mammoth maps only Word's semantic `Heading N` styles to `<h1>-<h6>`; that is its documented contract, and it honored it. A manuscript styled *visually* (bold, size, centering) yields zero headings. **Not a library bug.**
2. **`ASTBuilder` (Domain)** — no headings in, so its preamble rule puts all content into one untitled section. Deterministic and correct *given its input contract* — but it silently represents "I found no structure" as a normal-looking book. The state exists; nothing names it.
3. **`BookValidator` / `StructuralRule` (Domain)** — `checkStructure` errors only on `mainContent.length === 0`; every chapter-level check is behind `isChapter`. A one-anonymous-section book therefore skips them all → **Structure 100/100 with zero chapters**. This is the scoring incoherence the CTO flagged.
4. **The error contract (Presentation, both sides)** — every `findById` miss returns the same untyped `"Project not found"`. Pre-S11 the dominant cause was in-memory data loss (structurally fixed by SQLite, ADR-0048; restart survival proven live). What remains is the contract debt: one string for N causes, no error code, no recovery action, and `resume-where-left` happily routes into the 404.

**Classification (the CTO's demanded triage): an algorithm/contract problem.** Not the library (mammoth is faithful to its spec), not parameters (no knob exists). The pipeline lacks (a) a named "unstructured" state, (b) honesty in the score, (c) a typed error contract, (d) any fallback for visually-styled manuscripts.

## 3. The correct error contract

Typed error codes over HTTP, one UI message + one recovery action each. Additive to the DTOs (`error` string kept for compatibility, `code` added):

| Code | HTTP | UI message | Recovery action |
|---|---|---|---|
| `PROJECT_NOT_FOUND` | 404 | "This project is no longer in your library." | Button → Home; **clear the stale resume-where-left entry** |
| `EMPTY_STRUCTURE` | 422 on export/publish *when we choose to block* — see Q2 | "No chapters were detected in this manuscript." | Link → Structure station |
| `RENDER_FAILED` | 500 | "The Proof could not be generated." | Retry (exists) + the real cause logged server-side |
| `IMPORT_PARSE_FAILED` | 422 | "This file could not be read as a manuscript." | Re-import guidance |

Rule going forward (candidate ADR): **a screen may only show an error it can name.** Generic strings from `catch` blocks are a defect, not a message.

## 4. The fix — five commits, smallest honest scope

| # | Scope |
|---|---|
| 1 | **Name the state.** New validation issue `UNSTRUCTURED_MANUSCRIPT` (severity ERROR) when a book above a small word threshold has zero chapters; `EMPTY_HEADING_DROPPED` (WARNING) when normalization absorbs an empty heading. Structure score reflects them — 0 chapters can never score 100 again. |
| 2 | **Say it in the UI.** Import report + Structure station + status bar show "0 chapters detected — needs review" as a *blocking-styled* state, not a neutral count. Dashboard's "next action" points at it (it is by definition the top finding). |
| 3 | **Typed error contract** (§3) backend + frontend, including the stale-resume cleanup. |
| 4 | **Internal references leave the UI.** "Gutter: not yet applied (ADR-0043)" and "Recto/verso: planned" become "Coming soon" phrasing; ADR ids never render for end users (they stay in docs/code). |
| 5 | **The real-manuscript harness: `verify-real-import`.** *(CTO addition: the "18 h1 → 17 chapters, empty heading absorbed" case becomes a permanent assertion, not a discovery note.)* A corpus of varied real files (styled EN, unstyled FR-Word notes, bold-faked headings, empty headings; grown over time) with per-file assertions: expected chapter count, word-count fidelity vs mammoth's own output, and *expected findings* (the unstyled file must assert `UNSTRUCTURED_MANUSCRIPT` fires). This regression class becomes impossible to reintroduce silently. |

**✅ Commit 1 EXECUTED (2026-07-20, ADR-0049).** `UNSTRUCTURED_MANUSCRIPT` (ERROR, in `BookValidator` behind the named `UNSTRUCTURED_WORD_THRESHOLD = 2000`) + `EMPTY_HEADING_DROPPED` (`NormalizationDiagnostic` channel on `NormalizedDocument`, import-time evidence) + explorable-error semantics (`ValidationEngine.EXPLORABLE_ERROR_CODES`: the ERROR caps the score and will gate KDP, but the import still creates the project — the CTO's Q1 decision needed this distinction, discovered at implementation: a plain ERROR would have 422'd the import and destroyed the evidence). Proven live through the real server: a 3,060-word headingless DOCX → status success, project created, structure **75**/overall 35, the ERROR named with its suggestion; the real 1,424-word notes file stays silent (below threshold — a small single-flow document is legitimate, exactly the Q3 semantic); Faith_Alone → 17 chapters, the empty-h1 warning present, no false positive. Backend 552/552, tsc + eslint clean.

**✅ Commit 2 EXECUTED (2026-07-20).** The state now lives on every surface that shows chapter counts, always read from the real report (`unstructuredFinding()` — the UI never re-derives it from counts, because only the validator knows the threshold): Explorer "0 ch — needs review" (warn-styled), status bar "0 chapters — needs review" (error ink), Structure station `role="alert"` banner carrying the backend's own message + suggestion, and the dashboard's "Prochaine action" — which needed zero code, because it already derives from the highest-severity finding; the data change alone pointed it at the fix. Verified in the real browser on a real headingless import (screenshots in session); baseline byte-identical twice consecutively (the journey fixture is structured — no intentional visual change on baseline screens). Frontend 138/138, build + lint clean. One bonus find for commit 3: the workspace's not-found screen still says "Projects currently live in memory — after a server restart the library starts empty," which SQLite made false — that copy dies with the typed error contract.

**Deliberately NOT in this review** (scoped, not forgotten):
- **Heuristic heading detection** (promote bold/short/isolated paragraphs to headings) — real feature, real risk of *false* chapters, which is worse fidelity loss than none. It needs its own short review with the corpus from commit 5 as its measuring stick. The honest state (commits 1-2) is the prerequisite either way.
- **Manual structure correction post-import** ("this paragraph is a chapter title") — the right product answer, but it is AST *editing*, a new capability with its own semantics (identity, re-validation, versioning). Own review, after the honest state exists.
- **Multi-volume architecture** (CTO point 5) — a Level-1 review of the object model (`Book` ↔ `Volume`), to be scheduled before Sprint 12 code accumulates further; nothing in this fix pre-empts it.

## 5. Open questions for the CTO

1. **Severity of `UNSTRUCTURED_MANUSCRIPT`:** recommend **ERROR** (it breaks TOC, running heads, chapter-based pagination downstream) — but *non-blocking for Proof*: the author may still preview the anonymous flow. Blocking would hide the very output that helps them understand the problem.
2. **Should export/publish hard-block on zero chapters?** Recommend: export allowed (a proof is diagnostic), **publish blocked** (KDP submission of a structureless book is never intended).
3. **Word threshold for "this should have chapters":** recommend ~2,000 words (below that, a single-flow document — an essay, an article — is legitimate).

## Related

ADR-0004 (sequential pipeline this stays inside), ADR-0025 (prior mammoth limitation, same family), ADR-0031/0032 (real-file bugs that built `REAL_FIXTURE_POLICY.md`), ADR-0043 (the UI reference commit 4 removes), ADR-0048 (persistence — the fix that already closed the *data-loss* cause of "Project not found"), `REAL_FIXTURE_POLICY.md` (commit 5 is its next escalation).
