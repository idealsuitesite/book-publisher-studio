# FOUNDER_TRAVERSAL_2 — the four findings of the founder's second traversal (measurement report)

**Date:** 2026-07-23 · **Status: MEASUREMENT REPORT — stops at the constats, awaits CTO verdicts.**
The founder ran a second manuscript through the studio during the Lot-1 session ("The Secret Of
Spiritual Protection", project `1784760982271-w4n3yjxxw`) and surfaced four findings. All measured
**read-only** (SELECT + in-memory probes, never a write; his project is untouched, AS FOUND). These
findings **inform `STRUCTURE_ASSIST`; they are not fixed inside it** — some may become separate
upstream correctifs (CTO's call). Instruments: `backend/spikes/founder2-*.ts`.

Key context measured first: unlike his first manuscript (0 Word headings, undetectable structure),
**this DOCX carries real Word heading styles** — mammoth emits **237 heading elements**, and the
import faithfully builds **127 top-level entries**. So this traversal is the OPPOSITE regime from
the first: not under-structured, but heavily OVER-structured.

## Finding 1 — Body composition: PROVEN. Hypothesis A confirmed (priority 1)

The founding proof of the Author-B strategy (the engine composes; what was missing was structure).
Measured by rendering the stored book under Classic and Modern and reading the real PDF font faces:

- **The body prose — ~219,894 characters — is set in embedded `Gelasio-Regular`**, the theme's
  declared body face, at the body size. The body is genuinely, correctly typeset in the theme's
  own embedded font — not a fallback, not garbled.
- **Classic vs Modern body: the same face, essentially identical** (219,894 vs 219,893 chars). The
  two themes **differ in the HEADINGS and the accent, not the body**: Classic headings are
  `Gelasio-Bold` (8,051 chars); Modern headings are `Inter-Bold` (7,421) + `Inter-Regular`. Full
  bytes differ (2,157,615 vs 2,179,180) from the heading face + accent, never the body.
- So the body **inherits the theme's typography and composes correctly**; the Classic/Modern body
  looks identical only because these two themes deliberately share the Gelasio body face (a fact
  about the themes, not a defect). **Hypothesis A holds: composition was never the problem —
  structure was.** This is why the whole Author-B strategy (and `STRUCTURE_ASSIST`) is the right
  axis: give the engine clean structure and it already produces a well-composed book.

**Verdict-ready:** proven, no defect. Enters the dossier as the founding measurement.

## Finding 2 — `ProtectionFOREWORD`: a real import/normalization defect, localized (priority 2)

The book title and "FOREWORD" print concatenated with no boundary. Localized precisely:

- In the AST: top-level chapter [0] is titled **`The Secret Of Spiritual ProtectionFOREWORD`**.
- Upstream, mammoth's raw HTML for that heading is:
  `<h1><strong>The Secret Of Spiritual Protection<br /><br />FOREWORD</strong></h1>`
- So the DOCX put the title and "FOREWORD" in **one heading paragraph separated by `<br /><br />`**
  (soft line breaks), and **the normalizer flattens `<br>` in heading text WITHOUT preserving a
  boundary**, merging "Protection" + "FOREWORD" → "ProtectionFOREWORD".
- **Reproducible on a fresh import through today's code** (`founder2-render-probe.ts`) — a live
  import defect, not the founder's manual editing and not a render-side adjacency.

**Locus: the normalizer's heading-text extraction (a lost word boundary at `<br>`).** It is a real
fidelity defect — two distinct words corrupted into one — regardless of whether the author's
one-paragraph-with-breaks structure was ideal. **Candidate fix (separate, upstream of
`STRUCTURE_ASSIST`):** treat a `<br>` inside heading text as a boundary (insert a space) when
flattening. **Awaiting the CTO's verdict** on whether to open it now as its own small correctif.

## Findings 3 & 4 — Over-segmentation and the intro/text offset: ONE situation, faithfully imported (priority 3)

Measured together, and — per the TABLE_DUPLICATION lesson (never assume a shared cause without
proof) — the shared root is **proven, not assumed**:

- **29 top-level 0-word chapters** (finding 3). Of these, **27 are standalone `CHAPTER n`
  headings** the author styled as their OWN `Heading 1` paragraphs in Word (`<h1>CHAPTER 1</h1>`,
  `<h1>CHAPTER 2</h1>`, … — measured in the raw HTML, incl. a duplicate `CHAPTER 3`), plus a couple
  of bare `INTRODUCTION`/`CONCLUSION`. The rest of the over-segmentation is real chapter titles
  whose own body is empty because their prose lives one level down under `Heading 2` sections.
- **The import is FAITHFUL** — the fresh re-import reproduces the same 127-entry structure. This
  over-segmentation is **the author's own Word structure** (marker heading + title heading +
  section headings), **not an import split or defect.**
- **Finding 4 (intro/text offset)** is the RENDERING face of the same root: each empty `CHAPTER n`
  and each empty-body title renders as a content-less title, offsetting the actual prose (which is
  under the `Heading 2` sections) from the chapter it belongs to. **Finding 3 (structural) and
  finding 4 (rendering) are two faces of one situation — the over-segmented source — not two
  independent defects.** *Honest caveat:* I could not inspect the founder's "image 5", so I cannot
  fully exclude a distinct render-spacing issue layered on top; the structural over-segmentation is
  what is measured and reproducible.

**Strategic consequence for `STRUCTURE_ASSIST` (the reason these were measured before building):**
the two traversals reveal that structure problems are **bidirectional**:
- **Traversal 1 — UNDER-structured** (0 chapters; the ALL-CAPS `CHAPTER 1` markers were plain body
  text the importer dropped). `STRUCTURE_ASSIST` as scoped (suggest chapters on a 0-chapter book)
  addresses this.
- **Traversal 2 — OVER-structured** (127 entries; the `CHAPTER n` markers are their own empty
  headings). Suggestion does **not** solve this — it needs a CLEANUP/MERGE notion (recognise
  `CHAPTER n` + the following title as ONE chapter, collapse the empty marker).

So these findings become **real test cases for the `STRUCTURE_ASSIST` invariant**: running the
suggester over this over-segmented book must **never make it worse** (never add structure to an
already-(over-)structured book without an authorial act), and the design should decide whether the
cleanup/merge of `CHAPTER n` markers is in `STRUCTURE_ASSIST`'s scope or a sibling capability.
**Awaiting the CTO's verdict** on that scope question before building.

## Summary of verdicts owed

| # | Finding | Measured locus | Owed verdict |
|---|---|---|---|
| 1 | Body composition | proven, no defect | none — enters the dossier |
| 2 | `ProtectionFOREWORD` | normalizer flattens `<br>` in heading text, reproducible | open a separate upstream correctif now, or defer? |
| 3+4 | Over-segmentation + offset | the author's own Word structure, faithfully imported | is cleanup/merge in `STRUCTURE_ASSIST`'s scope, or a sibling? + confirm 3≡4 or investigate image 5 |

No production code written. Reports first, CTO verdicts next, then `STRUCTURE_ASSIST` is built with
these as its test cases.
