# FOUNDER_LOT1_DEFECTS — measurement report for the six founder-traversal defects

**Date:** 2026-07-22 · **Status: MEASUREMENT REPORTS — no production code.** One measured constat
per defect, each ending in a verdict-ready summary (locus, live-vs-already-fixed, the proposed
principle where the CTO asked to validate one). **Correctifs wait for the CTO's verdicts**; each
will then be its own atomic commit, gate at every step. All probes are read-only; the founder
project (`1784744671298-h9o6o9tn2`) was never modified. Instruments listed in §7.

Repo verified first: `main` at `0fc8314`, tree clean but for the standing `HARNESS_CLEANUP_PATH`
line in `TODO.md` (previous turn, no dedicated commit). Backend re-run 806/806 earlier this
session.

---

## Defect 1 — `TITLE_FROM_FILENAME` — **ALREADY FIXED on `main`; the founder's project carries pre-fix data**

**What the founder saw:** the title page printed `Without religious performance.ldocx` — the
filename, extension included.

**Measured (three ways):**
- **Static:** `ASTBuilder.buildMetadata` (ASTBuilder.ts:321) sets
  `title = doc.metadata.title ?? titleFromFileName(fileName) ?? ''`. `titleFromFileName`
  (ASTBuilder.ts:357) strips the trailing extension. The import path passes no `metadata.title`
  (`ImportManuscriptUseCase.ts:38` sends only `fileName`), so `titleFromFileName` runs.
- **On the founder's own bytes:** re-running the *current* pipeline on his stored source blob
  produces `title = "Without religious performance"` (extension stripped). `titleFromFileName(
  "Without religious performance.ldocx")` returns `"Without religious performance"`.
- **Live, against the running server:** importing his bytes as `…​.ldocx` returns **HTTP 400
  "Only DOCX files are allowed"** — the current `&&` upload filter (`validationMiddleware.ts:29`,
  name must end in `.docx` AND mime must match) rejects `.ldocx` outright. Importing the same
  bytes as `…​.docx` returns 200 with `title = "Without religious performance"` (stripped).

**Why the founder still has the extension:** his stored title is identical across all 10 version
snapshots, from v#1 — so it entered at his original import. Two current fixes prevent it today:
the `&&` filter (would reject his `.ldocx` at the door) and the effective extension strip. The
filter's own comment records it was changed *from* `||` (mime-or-name), and under `||` a
`.ldocx`+docx-mime file passed. **Conclusion: his import ran against a server predating these
fixes.** Current `main` does not reproduce the defect — this is the `FRONT_MATTER_PRE_Q3_MIGRATION`
pattern (an old import keeps old data; re-import under current code yields the corrected title).

**Verdict-ready summary.** Locus: none on `main` — already fixed. Question for the CTO: the
migration stance for pre-fix projects (the `FRONT_MATTER_PRE_Q3_MIGRATION` precedent leaves them
as-is, workaround = re-import). No correctif proposed; only a decision on whether pre-fix
projects deserve a one-time backfill (precedent says no).

---

## Defect 2 — `PLACEHOLDER_METADATA_PRINTS` — **LIVE** (the principle to validate is here)

**What the founder saw:** `Unknown` on the title page and `© 2026 Unknown` on the copyright page.

**Measured — the placeholder census (all paths that can reach a rendered page):**
- **Root:** `ASTBuilder.buildMetadata` defaults **`author: 'Unknown'`** (ASTBuilder.ts:322) — a
  literal placeholder written as if it were real metadata. Live import confirms `author =
  "Unknown"`.
- **Propagation:** `FrontMatterBuilder` is in fact **correctly designed** — its own doc comment
  (FrontMatterBuilder.ts:18–21) states the exact principle the CTO wants: *"a field is emitted
  only when the metadata to fill it genuinely exists… a copyright page asserting © undefined is
  worse than no line at all, because it looks authored."* But its guards test
  `author?.trim()`, and the value **is** present — it's the placeholder `'Unknown'`. So:
  - `titlePage` is emitted (title OR author present — author always is) with `author: "Unknown"`.
  - `copyrightPage.text = "© 2026 Unknown"` (FrontMatterBuilder.ts:61, `© {year} {author}`).
- **Latent placeholders** the same mechanism hides, found by reading FrontMatterBuilder:
  `titlePage.title` fallback `'Untitled'` (line 47) and `titlePage.author` fallback
  `'Unknown author'` (line 49) — currently unreachable *because* the ASTBuilder default fires
  first, but they become the next placeholder the moment the root default is fixed.

**The finding in one line:** the principle "an empty field never prints" is **already the
FrontMatterBuilder's design**; it is **defeated upstream** by `ASTBuilder` converting *missing*
author into *present-placeholder* `'Unknown'`. The fix locus is the ASTBuilder defaults, and the
FrontMatterBuilder fallbacks must be neutralised in the same breath or they inherit the role.

**Proposed principle to validate (CTO asked):** *a metadata field the author never supplied is
absent, not a placeholder string — it never reaches a rendered page, and stays visible in the
validation report as the thing to supply.* Concretely: `author`/`title`/`language` default to
`undefined` at the AST boundary, not to `'Unknown'`/`''`/`'fr'`; FrontMatterBuilder then already
does the right thing (omits the author line, omits the copyright page when no author/copyright
exists). **Awaiting the CTO's validation of this principle before any code.**

**Verdict-ready summary.** Locus: `ASTBuilder.buildMetadata` defaults (+ the two FrontMatterBuilder
fallbacks). Live. One atomic correctif once the principle is approved; the validation report
already names `MISSING_*` so the author is still told.

---

## Defect 3 — `LANGUAGE_HARDCODED_FR` — **LIVE, and it is not a detector that stumbled**

**What the founder saw:** an English manuscript detected as French.

**Measured:** there is **no detection**. `ASTBuilder.buildMetadata` sets **`language: 'fr'`
unconditionally** (ASTBuilder.ts:323) — a hardcoded constant, no input consulted. Live import of
the founder's English bytes returns `language = "fr"`; so would any manuscript in any language.
The honest answer to "d'où vient la détection, sur quoi elle a trébuché" is: it never existed;
the value is a literal.

**Blast radius (measured downstream consumers of `metadata.language`):** it feeds PDF/DOCX/EPUB
render context and `language` attributes (`EPUBRenderer`, `Renderer` context), typography
(smart-quote/locale behaviour in `TypographyResolver`), and validation. So the wrong constant
reaches the exported artifacts and the EPUB's declared language — a real fidelity leak (an EPUB
that declares `fr` on English content).

**Two honest sub-questions for the verdict** (not decided here): (a) is the fix a real detector
(e.g. a lightweight franc-style n-gram over the extracted text) or a safe default (e.g. `en`, or
`undefined` + an author-set field)? A detector is itself a small chantier with its own accuracy
bar — and note the `HEURISTIC_STRUCTURE_DETECTION` lesson about measuring before believing. (b)
Whichever, the author must be able to correct it (there is no language editor today — the same
missing-editor family as defect 4).

**Verdict-ready summary.** Locus: `ASTBuilder.ts:323`. Live, with a real export-fidelity
consequence. The correctif's *shape* (detector vs default vs author-set) is a CTO call; the
minimal honest floor is: stop asserting a language the manuscript never declared.

---

## Defect 4 — `TITLE_FIELDS_DECOUPLED` — **LIVE (the bug), and an information-architecture truth (Lot 3)**

**What the founder saw:** he renamed the title; the Proof didn't reflect it.

**Measured — the data path, end to end:**
- **The Proof follows the ADR-0052 rule** (the CTO asked to verify this explicitly): it re-renders
  the **stored** book. `proofRefreshKey` (bookFacts.ts:18) =
  `layout/theme/accent/typography/updatedAt`, and the workspace re-inks the Proof whenever that
  key changes (`projects/[id]/page.tsx:209–211`). Every book mutation bumps `updatedAt`, so a
  **persisted** title edit *would* show in the Proof. **The Proof is not the loss point.**
- **There are three decoupled "title" fields**, and only one is what the Proof's title page
  renders:
  1. `project.name` — the library/workspace label. Editable via a project rename
     (`ProjectService.rename`, whose own comment says it renames the project *"without touching
     the book's own title"*).
  2. `book.metadata.title` — the canonical book title. **No UI edits this at all** (grep: no
     endpoint, no control).
  3. `frontMatter.titlePage.title` — **what the title page in the Proof shows.** Editable *only*
     via the `FrontMatterEditor` (Structure station), behind a "Save title page" button that
     requires both title and author non-empty.
- **The founder's stored state:** all three fields are still `"Without religious performance.ldocx"`,
  identical across all 10 versions. So **no title rename persisted anywhere.** Chapter renames
  *did* persist (chapter 2 is a promoted first sentence), which proves the structure-rename path
  works — the title is a different surface.

**Where the data was lost (measured conclusion):** not in the Proof (it correctly renders stored
content) and not in a broken persist path (chapter renames persist). The loss is that **the title
the author can reach and the title the Proof renders are not the same control**: renaming the
*project* (the visible label) legitimately never touches the title page, and the *canonical* book
title has no editor at all — the only way to change the printed title is a buried Structure-station
form. This is an IA/decoupling defect, not a render bug.

**Residual uncertainty, flagged honestly:** the stored artifact cannot tell us the founder's exact
gesture (project rename vs an unsaved FrontMatterEditor edit), because nothing persisted.
Confirming his precise action would need either his account or a reproduction — and reproduction
must **not** touch his project. Recommend the verdict include which gesture to reproduce on a
throwaway import.

**Verdict-ready summary.** Locus: the field decoupling + the missing canonical-title editor. The
immediate Lot-1 bug: give the printed title a single obvious editing surface (candidate: let the
FrontMatterEditor title, or a header rename, write the canonical title and the title page
together). The deeper "what *is* the title, to an author" is Lot 3 (`AUTHOR_EXPERIENCE`).

---

## Defect 5 — `EDITION_BUTTON_STATE` — **LIVE, UI state (function is correct)**

**What the founder saw:** clicking "PDF edition" appeared to select all three editions.

**Measured:** `ExportPanel` (ExportPanel.tsx) renders three buttons — "PDF edition", "DOCX
edition", "EPUB edition". `handleDownload(format)` sets `exportingFormat = format`, and **every**
button carries `disabled={exportingFormat !== null}` (line 67). So clicking one button disables
all three while that single export runs; the clicked one shows "Exporting…", the other two go to
their disabled style. **Functionally only the clicked format is produced** (one round trip, one
download — the founder did not get three files). The defect is that the *disabled* visual of the
two untouched buttons reads as *selected/affected* — an ambiguous state, not a wrong action.

**Verdict-ready summary.** Locus: `ExportPanel` button state. The function (one export at a time)
is intended; the affordance (disabled-looks-like-selected across all three) is the defect. Small
Lot-1 correctif (e.g. only the in-flight button changes state; or a clearer "exporting…" scope).
The broader "what is an edition, and how do you ask for one" is a Lot-3 affordance question.

---

## Defect 6 — `THEME_SWITCH_LATENCY` — **LIVE, but the locus is the frontend, not the backend**

**What the founder saw:** choosing a theme takes "several seconds".

**Measured (on his real ~114-page book, stored, read-only):** the **backend** proof hot path —
theme resolve + paginate + render, i.e. a full cache-miss re-pagination (a theme change is a
legitimate cache MISS) — is **~270–450 ms** steady-state per switch (theme ≈6–10 ms, paginate
≈30–55 ms, render ≈240–400 ms; 114 pages, ~230 KB PDF). That is **not** several seconds.

**So where do the seconds go?** Not backend pagination/render. The remaining cost is downstream of
the API: the HTTP round trip, the ~230 KB PDF over the wire, and — the likely dominant term — the
**browser re-rendering a 114-page PDF proof** on every switch. The founder's book being large is
what makes this visible; a short book would not feel slow. Locus = the frontend proof rendering,
not the pagination engine (which S13 already measured and left load-bearing).

**Honest limit of this measurement:** I measured the backend precisely and reasoned the frontend
term from the payload size and page count; I did not instrument the browser PDF render (doing so
on the founder's project would mutate it — forbidden). Recommend the verdict authorise a
frontend-side measurement on a throwaway/demo project to confirm the 114-page render is the cost.

**Verdict-ready summary.** Locus: frontend proof rendering (backend is ~300 ms, fine). This is a
perceived-performance question — Lot 3 (`AUTHOR_EXPERIENCE`) territory (progressive/first-page
proof, or not re-rendering all pages on a re-ink). No backend correctif indicated.

---

## §7 Instruments (all read-only; the founder project untouched)

| Probe | Measures |
|---|---|
| `backend/spikes/founder-title-lang-probe.ts` | Defects 1 & 3: `titleFromFileName` in isolation + current pipeline on the founder's stored bytes |
| `backend/spikes/founder-aggregate-probe.ts` | The stored aggregate: current book metadata, front matter (title/copyright), settings |
| `backend/spikes/founder-version-titles-probe.ts` | Title/author/lang across all 10 version snapshots (dates the `.ldocx`) |
| `backend/spikes/founder-live-import-probe.ts` | Live server: `.ldocx` → 400, `.docx` → stripped title; throwaway deleted (no trace) |
| `backend/spikes/founder-theme-timing-probe.ts` | Defect 6: backend theme-switch render timing on the founder's real book |

All in-process or one throwaway-then-deleted import; the store's four projects (founder + 3 demo)
are intact and unmodified.
