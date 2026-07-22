# Chapter.subtitle — Scope Report (the door named at THIRD_THEME_NOVEL §6)

**Status:** 🟡 MEASURED — **STOPPED AT THE DECISIONS (§6), as always.** No production code
opened; the census spike is the only artifact.
**Date:** 2026-07-22
**Why now (CTO):** the limitation is visible in a theme DELIVERED today — Novel drop-caps the
subtitle line of any manuscript whose chapter opens on a subtitle-stored-as-paragraph; closing
it makes Novel truly complete rather than "complete with an asterisk". Context cost is at its
lowest today.

---

## 0. The door's premises, re-verified (non-negotiable #7)

All three hold, and one is sharper than consigned: `Chapter.subtitle` is typed (`Book.ts`) and
DTO-crossed (`ChapterMapper`); nothing populates it (`ASTBuilder`: zero writes); **and nothing
RENDERS it either** — the only `.subtitle` any renderer draws is the front-matter title page's
(`PDFRenderer:473`), and `titleHeightOf` charges the title alone. **Consequence that sizes the
chantier: populating the field without rendering + pricing it would make the moved text VANISH
from every export — an ADR-0050 violation by construction.** This is populate + render
(tri-format) + price (lock-step), not a data-only patch.

## 1. The import signal, measured (`subtitle-style-census-spike.ts`)

Raw-OOXML `pStyle` census over the whole corpus: **zero "Subtitle"/"Sous-titre" styles
anywhere.** The styled French book (faith-alone) uses `Titre1` (18 → the chapters), `Titre2`
(78 → the sections), one `Titre` — and its subtitle lines live among the **747 unstyled
paragraphs** (cross-proof: the line arrives as a `Paragraph` block in the AST — that is where
Novel's drop cap lands).

**Reading, precise on both edges:**
- A Word paragraph **style name** IS a structural signal when present — mapping
  `p[style-name='Subtitle']` at import would be Q1-CLEAN (a declared authorial act, not
  formatting inference; unlike everything HEURISTIC_STRUCTURE_DETECTION closed).
- But **no real manuscript we have carries it** — building the mapping now ships untestable on
  real material (the C1 trap; the exact reason the callout census killed import mapping there).

## 2. The two population paths

- **The author's gesture (the producer that ships WITH the capability — fourth use of the
  pattern):** `markAsSubtitle(blockId)` — the paragraph's text moves into its top-level
  chapter's `subtitle`, the block leaves `content`; inverse `clearSubtitle(chapterId)` puts it
  back as the first paragraph. The `setCallout`/`promoteToChapter` machinery end to end
  (pure op → `parseMutation` whitelist WITH route tests same commit → snapshot/undo →
  StructureEditor row affordance). Two disclosed edges, both with precedents: **inline
  formatting is lost** (title fields are plain text — the promoteToChapter disclosure), and
  **subtitle words leave the word count** (title words are not counted today — consistency,
  disclosed, not silent).
- **The import mapping:** NOT now (§1). Named unblock, C1-style: *a real manuscript carrying a
  genuine Subtitle style enters the corpus* → the styleMap line + the same rendering path,
  testable on real material that day.

## 3. The trigger needs NO change — better than "skip"

Once the subtitle line leaves `content[0]`, the chapter's first block IS the first prose
paragraph, and the drop cap lands there **by the existing positional rule, untouched**. Nothing
to skip, nothing to special-case: the fix is the data becoming what it claims to be — exactly
the exit the CTO's consigne predicted, minus even the "skip" (the field is not a block, so
position alone resolves it).

## 4. Render + price — the R2 surface, bounded

- **PDF:** `renderTitle` draws the subtitle under the title; **`titleHeightOf` charges it in
  the same expression, lock-step** — the exact seam MINI_DR_SUBTITLE_SPACING built (flat
  spaces + measured heights, charged == consumed by construction). This is the one real R2
  edge; it inherits a proven pattern and its parity discipline.
- **DOCX:** a subtitle paragraph after the H1 (Word's own Title/Subtitle convention);
  **EPUB:** an element + CSS under the h1. Both reflow — no R2.
- **Parity locks UNTOUCHED:** population is gesture-only, fresh imports carry no subtitle —
  the corpus renders byte-identically; Novel/Classic/Modern locks unmoved. The capability
  ships **lit-but-empty** (the callout pattern): real rendering, invisible until an author
  acts. A gestured-book test locks the new numbers on the real fixture via the mutation route
  (the `projectExportReflectsEdit` pattern).

## 5. Cache and facts

A gesture is a book edit → hash MISS by construction; clear restores byte-identical content →
legitimate HIT (the §3.6 property, fourth application — asserted in the standing scenario).
`bookFacts`/status surfaces don't count titles today; the moved line's words drop out of
`wordCount` — stated in §2, one line in the mini-DR's disclosure list.

## 6. ⛔ THE DECISIONS (the CTO's, nothing below proceeds)

1. **Population: authoring-first only** (recommended — §1's zero census; the import styleMap
   is a NAMED unblock, not built dark), or also build the import mapping now despite zero real
   material?
2. **The rendered subtitle's look** — taste-adjacent, screenshot-loop for exact values as
   always. Recommendation: italic, ~60% of the title size, set under the title inside the same
   title block (the front-matter title-page precedent visually); per-theme values only if the
   loop demands them (one treatment first — the callout D1 logic).
3. **`clearSubtitle` semantics:** reinsert as first paragraph (recommended — round-trip
   identity, undo-friendly) vs clear-only.
4. **The gesture's UI wording** on the block row (e.g. "Make this the chapter subtitle" beside
   "Make this a chapter" / "Set off as callout") — the row already carries the pattern.

## Related

`THIRD_THEME_NOVEL.md` §6 (the consigned limitation this closes) · `MINI_DR_SUBTITLE_SPACING.md`
(the lock-step seam §4 extends) · `CREATE_CHAPTER.md` / `MINI_DR_CALLOUTS.md` (the gesture
pattern, third and fourth uses) · `C1_QUOTE_PRESENTATION_UNBLOCK` (the named-unblock shape §2
reuses) · `backend/spikes/subtitle-style-census-spike.ts` (§1's instrument).
