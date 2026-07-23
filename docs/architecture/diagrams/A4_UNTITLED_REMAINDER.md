# A4 — the untitled remainder + the "Untitled" EPUB label (measurement report)

**Date:** 2026-07-23 · **Status: MEASUREMENT REPORT — stops at the constats, awaits CTO verdicts. NO
code.** FOUNDER_TRAVERSAL_3 Lot A, item A4. Read-only (SELECT + blob + in-memory import/epub-gen;
never a write). Instrument: `backend/spikes/founder-untitled-remainder.ts`. The duplicate `CHAPTER 8`
stays **out of scope** — the author's content, faithfully reported.

The three questions the CTO posed, each measured distinctly.

## Q3 (the root, measured FIRST because it reframes the rest) — the untitled preamble is an IMPORT artifact, not a promotion one

**Measured false that promotion creates it.** A synthetic document that simply **begins with prose
before the first heading** — no promotion involved — imports (HtmlNormalizer → ASTBuilder) to a
first top-level entry `type=section, title="", level=0`. **ASTBuilder creates an untitled level-0
"preamble" section for any content before the first heading** (`ASTBuilder.ts:100-112`, the
`preamble` branch of `currentTarget()`). `promoteToChapter` does **not** mint it; it (and the
under-structured single-container case) merely **surface** what import already produced.

**Consequence: the defect is older and broader than our operation.** Any manuscript whose body opens
with prose before its first heading carries this untitled section. So the treatment belongs at the
**import/model level**, not inside the promote op. (It is a `section`, level 0 — not a chapter; the
earlier report's "promote-remainder chapter" wording is corrected here: it is the ASTBuilder
preamble, and it is a section.)

## Q1 — what the remainder SHOULD be: measured on the three books, and there is no single answer

The stored state (what each author actually has):
| Book | Untitled top-level entries | Content |
|---|---:|---|
| 1 (under-structured) | **0** | — (his first content was a marker at position 0.01; no preamble survived) |
| 2 (over-structured) | **0** | — (its first heading is at the top) |
| 3 (under-structured) | **1** (a `section`, **755 words**) | first line **"INTRODUCTION"**, then "The Cross: God's Final Answer to Every Claim", then real prose |

- **On book 3 it is a REAL editorial part, not front matter and not junk.** The untitled section's
  own first body line is literally **"INTRODUCTION"**, followed by a descriptive title line and 755
  words of prose. It is **the author's Introduction, left under-structured** — he promoted `CHAPTER 1`
  onward and never promoted the intro, so it stayed in the preamble. Front-matter scent: only a
  short-caps first line ("INTRODUCTION"); **no copyright/ISBN/dedication** signals.
- **No single answer across imports (as the CTO anticipated).** The preamble holds *whatever precedes
  the first heading* — that can be front matter (a title/copyright the import didn't route), a real
  editorial part (book 3's Introduction), or ordinary prose. Hypothesis "valueless artifact" is
  **refuted for book 3** (755 words of real content); "front matter" is **not** what book 3 shows;
  "a real nameable chapter/part" **is**. The right treatment cannot be a fixed guess — it must make
  the remainder **author-nameable**.
- **A promote path already exists for book 3.** The assist (with the new A2 repetition guard) *would*
  propose the "INTRODUCTION" marker sitting in this preamble (unique → kept), so the author can
  already turn it into an Introduction. This ties A4 to B4/B5: the remainder's real content is
  exactly the kind of typed marker the assist recovers.

## Q2 — "Untitled" is a fabricated placeholder, NOT a format/lib necessity (the "Unknown" class)

- **The model is correct.** The auto-TOC **skips empty titles** (`LayoutEngine.ts:437`) — so PDF and
  DOCX never show "Untitled". Only EPUB surfaces it.
- **epub-gen does NOT require a non-empty title.** Measured: generating with `title: ''` **succeeds**
  (no throw), and epub-gen labels that nav entry **"1. "** (its own auto-number prefix with an empty
  title) — it neither breaks nor emits a blank entry. So a non-empty title is **not** a lib necessity.
- **`EPUBRenderer.ts:234` fabricates it:** `title: content.title || 'Untitled'` — a deliberate
  adapter choice ("a non-blank label for the TOC entry"). **This is the same class of defect as the
  "Unknown" chased out in Lot 1** (defect 2): a **software-invented placeholder that reaches the
  author's artifact** (here the EPUB navigation). The format does not demand it; we invent it.

## The interlock (why the three answers are one finding)

The remainder is a **real part** (Q1) → it should carry a **real title** (author-named or its own
"INTRODUCTION" marker promoted), never `"Untitled"` (Q2) and never a bare `"1. "`; and because it is
an **import artifact** (Q3), the fix lives at the **import/model** seam (how a pre-first-heading
preamble is represented and surfaced), not in the promote op or the EPUB renderer alone. Fixing only
the EPUB label would leave a real, un-nameable Introduction sitting untitled in the book.

## Verdicts owed (the report stops here)

| # | Question | Measured | Owed verdict |
|---|---|---|---|
| Q3 | root | the untitled preamble is an ASTBuilder IMPORT artifact (pre-first-heading content), a `section`, broader than promotion | confirm the fix seam is import/model, not the promote op |
| Q1 | what it should be | book 3: a real Introduction (755 w, first line "INTRODUCTION"); books 1/2: none; no single answer | make the remainder **author-nameable** (surface + let him title / promote), never a fixed guess? |
| Q2 | "Untitled" label | epub-gen tolerates an empty title (labels "1. "); `"Untitled"` is our adapter's invention — the "Unknown" class | stop fabricating `"Untitled"`; once the remainder is named it is moot, and if still untitled, omit-from-nav vs derive is the sub-decision |

No production code written. On the CTO's verdicts, the correctif follows — measured-first, its own
atomic commit, his projects strictly read-only. Then B5.
