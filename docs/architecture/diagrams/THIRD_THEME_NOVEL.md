# Third Theme — "Novel" — Level-2 Design Review (short, the SECOND_THEME shape)

**Status:** ✅ DELIVERED — direction + six sub-decisions CTO-locked, built in 3 commits on
`feature/third-theme-novel` (`170cac4` data+registry · `3e9eb7d` own parity lock, born with the
17 drop-cap openings priced in · `c3103b8` gallery label + loop artifacts), **the screenshot
loop PASSED (§6): accent LOCKED `#6E3B2F`, one known limitation consigned with its exit door.**
A "Novel" was chosen over Academic/Minimal for three ranked reasons (showcases the drop-cap
capability where it typographically belongs; the product's widest audience; completes a
coherent three-theme fan: Classic sober/B&W-safe, Modern contemporary/tinted, Novel
literary/warm). Mechanism = SECOND_THEME's, re-verified in `THIRD_THEME_SCOPE.md` §0.
**Date:** 2026-07-22, delivered 2026-07-22

---

## 1. The six sub-decisions, locked verbatim

1. **Fonts: Gelasio throughout** (headings AND body — `Georgia` both roles) — literary warmth,
   inside the two-face constraint, nothing new embedded.
2. **Drop caps: ON** — `presentation.dropCap = { scope: 'chapterOpening', scale: 2.5 }` (the
   chantier-proven default scale; the screenshot loop adjusts if needed). **The first theme to
   light the capability** — the aspect decision the drop-cap chantier reserved, now taken.
3. **Callouts: rule only** — `presentation.callout = { tint: 'none' }` (printed novels are
   overwhelmingly B&W; Classic's logic).
4. **Running head: `chapterTitle`** — the first theme to use it; the printed-novel convention.
5. **Designed default body: 11pt** like the other two — the own-default identity stays
   Academic's argument, not exercised here.
6. **Accent: warm and sober** — starting point `#6E3B2F` (a russet/sienna family), **the exact
   shade is the screenshot loop's to settle**, never locked in code first.

## 2. The declared values (the loop may move rhythm numbers; the STRUCTURE is fixed)

| Field | Novel | vs Classic / Modern |
|---|---|---|
| fonts | Georgia / Georgia (→ Gelasio) | Classic same; Modern sans headings |
| fontSizes | Classic's scale, body 11 | identical ratios |
| colors | text `#000000`, accent `#6E3B2F` (loop-tuned) | Classic accent=text; Modern Prussian |
| spacing | paragraph 8 · heading 18 · lineHeight 1.4 · **title 22/10** | the generous literary rhythm (Classic 16, 18/8; Modern 12, 14/6) |
| runningHead | show, right, **chapterTitle**, pageNumber, size 9 | first `chapterTitle` consumer |
| presentation | **dropCap chapterOpening @2.5 · callout tint 'none'** | both other themes: dropCap 'none' |

`lineHeight` stays 1.4 ON PURPOSE: the typography scope measured that `spacing.lineHeight` is
NOT a real PDF knob today (it feeds the fallback estimator + EPUB CSS only) — a "larger leading"
identity would be an interface lie in the format that matters most. Named, not fudged; real
leading is the future chantier the typography scope already named.

## 3. Disclosed limitation the first `chapterTitle` consumer inherits

`DOCXRenderer` applies ONE header document-wide (Sprint 6, ADR-0029 Decision 6's honest gap:
per-chapter DOCX sections were not built) — under `content: 'chapterTitle'` Word shows the FIRST
page's resolved title throughout. The PDF does it right per page (`Page.headerFooterTitle`,
realigned by the drift fix); EPUB has no running heads (reader chrome). **Novel ships with this
disclosed**, exactly as the Sprint-6 text anticipated; fixing DOCX per-chapter headers is its
own future slice, not this chantier's silent extension.

## 4. What this chantier owes (from THIRD_THEME_SCOPE §2, unchanged)

Own parity lock on faith-alone — **born WITH the 17 drop-cap openings priced in** (charged ==
consumed under the capability's teeth-proven instruments); own §10.4 WPP row; Classic AND
Modern byte-stability; tri-format proof (Gelasio names + warm accent + native DOCX drop-cap
frames + `::first-letter`-class EPUB CSS + rule-only callout policy); the gallery card appears
by itself (count-agnostic, re-verified); cache = new `themeName` key space, nothing owed.

## 5. Commit plan

1. `NovelTheme` + registry line + the theme-shape assertions (inert for Classic/Modern by
   construction — their locks re-run in the gate).
2. `novelTheme.test.ts` — the parity lock (its own numbers, letter + kdp-6x9) + tri-format
   proof incl. drop caps and the callout policy + Classic/Modern untouched; the §10.4 row in
   `PUBLICATION_QUALITY_BAR.md`.
3. **⛔ the screenshot loop** — real faith-alone pages under Novel (chapter opening with the
   lit drop cap, the running head, the warm accent) rastered for the CTO; the live gallery
   check (third card, Proof re-inks). Values lock only after the CTO's look.

## 6. Screenshot-loop observations (2026-07-22 — the loop's verdicts, on the record)

1. **The accent is LOCKED at `#6E3B2F`** (CTO, on real faith-alone pages): warm and sober,
   sits with Gelasio, flattens to a clean mid-grey in B&W — neither deeper nor redder. The
   parity test's hex comment flipped from "starting point" to locked.
2. **KNOWN LIMITATION, consigned with its exact cause (CTO ruling): the drop cap lands on the
   first paragraph BLOCK whatever its semantic role — a subtitle stored as a paragraph
   receives it.** Seen on faith-alone: INTRODUCTION opens with "The Crisis of Confidence — And
   the Recovery of the Gospel", semantically a subtitle but living in the model as an ordinary
   first paragraph, so the ornament lands there instead of on the first prose paragraph —
   positionally correct by construction, typographically against the convention (no printed
   book drop-caps a subtitle line). **This is not a trigger bug: the data is not what it
   claims to be.** The trigger does exactly what §2/Q1 locked (positional, never inferential)
   over a structure that cannot distinguish subtitle from prose.
   - **What is deliberately NOT done:** a "this paragraph looks like a subtitle, skip it"
     heuristic — that is the inference §2/Q1 forbids, the door closed three times
     (HEURISTIC_STRUCTURE_DETECTION, the callout census, editorial-part detection).
   - **The author's correction paths exist today:** promote the block, move it, or accept the
     effect.
   - **The named exit door, for the future session that reopens this:** `Chapter.subtitle` is
     ALREADY TYPED in the model (and crosses the DTO via `ChapterMapper`) — **nothing populates
     it from import** (verified 2026-07-22: `ASTBuilder` never writes it; the
     FrontMatter-fields-before-Q3 pattern). The future chantier is populating/authoring that
     field (import mapping and/or a structure-editing gesture); once a subtitle is structural,
     the trigger can skip it POSITIONALLY, no inference anywhere. Candidate, not opened.

## Related
`THIRD_THEME_SCOPE.md` (the measured vocabulary) · `SECOND_THEME.md` (the procedure) ·
`MINI_DR_DROP_CAPS.md` (the capability this theme lights) · `PUBLICATION_QUALITY_BAR.md` §10.4.
