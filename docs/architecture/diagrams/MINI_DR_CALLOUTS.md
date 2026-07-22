# Mini Design Review — Callouts (queue item 6, CALLOUTS_SCOPE.md → Option A)

**Status:** ✅ DELIVERED on `feature/callouts` — CTO-approved (2026-07-22, the §1 D1/D4
reconciliation explicitly confirmed), all four §6 commits built and gated (1 `d264ce1`,
2 `02834f0` + the shade tuning `0181d3f`, 3 `493cb44`, 4 = this commit), **AWAITING MERGE on the
CTO's accord.** The shade knob is LOCKED at **0.96** on the CTO's real-page look (0.92 read as a
documentation box; at 0.96 the tint suggests itself — and the CTO kept the tint for Modern over
a rule-only reduction: two themes, two assumed identities). Verified live on faith-alone in the
studio: mark → Callout badge + the chrome in the real exported PDF (black Classic rule, the
author's own bold preserved) → unmark → **Undo restores the badge** → final unmark; zero console
errors; 90 pages held. **Two instruments bit during the build, both on their birth day:** the
legitimate-HIT cache property caught the first draft of `setCallout` bumping `book.updatedAt`
(no other op does — the convention IS the property; fixed, reason recorded in the op), and the
tests-first red run caught everything else before it existed. The callout/drop-cap interaction
is decided ONCE in the resolver (a callout never takes the chapterOpening ornament), pinned by
test. §5's real-gesture verification replaced the unsatisfiable corpus-fixture premise exactly
as amended.
**Date:** 2026-07-22, delivered 2026-07-22
**Inputs:** `CALLOUTS_SCOPE.md` (measured: census 0/0/0/0 on the whole corpus; union extension =
9 exhaustive sites; the C1-trap exit via authoring-first) · the CTO's **four §7 answers, locked
2026-07-22** · the drop-cap chantier as the structural template (`MINI_DR_DROP_CAPS.md`).

---

## 1. The four locked decisions — and one reconciliation stated openly

1. **Chrome family: left rule + very light background tint.** Sober, legible in B&W and colour;
   no bordered boxes. **One treatment, no per-theme chrome families in v1.**
2. **One generic callout, silent chrome.** No note/tip/warning taxonomy (documentation
   vocabulary, not book vocabulary); **no rendered label** — a label would force a language
   decision the product cannot make for its authors. The passage carries its own meaning; the
   chrome distinguishes it, never names it.
3. **Tint derived from the theme accent.** One knob: the author's accent choice (including the
   shipped `accentOverride`) colours everything coloured in their book, callout chrome included.
4. **Print reality: Classic ships tint-free (rule only); Modern carries the tint.** KDP
   interiors are mostly B&W; a printed tint becomes a grey slab. This is the established
   identity split between the two themes (Modern owns the visible accent).

**The D1/D4 reconciliation, stated rather than discovered later:** D1 locks ONE chrome
*mechanism* (left rule + optional light tint — no theme gets a different family); D4 makes the
*tint* the one theme-declared value inside that mechanism. Concretely:
`Theme.presentation.callout = { tint: 'none' | 'accent' }` — Classic `'none'`, Modern
`'accent'`. Same pattern as `titleSpaceBefore` (one mechanism, per-theme values), second
consumer of the `presentation` seam after `dropCap`. **If the CTO reads D1/D4 differently, this
is the line to correct at approval.**

## 2. Model shape — Shape B, locked (scope §4, Part-chantier precedent, third use)

- **`Paragraph.callout?: true`** — additive field, no `Block`-union extension (the 9 measured
  exhaustive sites stay untouched as switches; renderers/resolver read the flag inside their
  existing `paragraph` case). Generic per D2 — no kind enum.
- A callout is a **semantic claim on a paragraph** ("this passage is set off"); its LOOK lives
  entirely in the theme (Q2 held). Set **only by an author action** — nothing in the import path
  writes it (Q1 held; the census proved there is nothing to map anyway).
- **The op:** `BookEditingService.setCallout(book, blockId, on)` — pure, by-id, any-depth walk
  (the `rename` pattern); no-op toggles are rejected as malformed (the front-matter lesson: a
  patch touching nothing is not a snapshot event). `parseMutation` whitelisted **with route
  tests in the same commit** (the `setPartRole` live-gap lesson, twice learned).
- **V1 boundary, disclosed:** single-paragraph callouts. A multi-block callout is a grouping
  question — its own future review (the list-splitting deferral shape). Also out: callouts on
  quotes/lists/headings (the flag lives on `Paragraph` alone; extending it is a future
  decision, not a silent widening — and quote presentation stays behind C1's freeze).

## 3. The chrome, resolved from ONE knob (D3) through one shared module

`domain/services/calloutMetrics.ts` (the `dropCapMetrics` pattern — one arithmetic, every
consumer):

- **Geometry constants (v1, one treatment per D1):** rule width **2pt**, gap rule→text **8pt**,
  vertical padding **6pt** above and below, tint bleed = the full text column width. Values
  final only after the commit-2 screenshot check (the shade-on-real-pages discipline); the
  *structure* (which constants exist) is locked here.
- **`calloutRuleColorOf(theme)`** = the resolved accent (Classic → `#000000`, sober black rule;
  Modern → Prussian blue; an author's `accentOverride` re-inks the rule — D3's "one knob"
  realized literally).
- **`calloutTintOf(theme)`** = `'none'` per the theme's declared policy, else the accent mixed
  toward paper (a fixed lightening ratio, ~92% toward white, tuned once in the screenshot
  check) — **pre-mixed to a concrete hex in this one function**, because DOCX `w:shd` and EPUB
  reader CSS both need a literal colour; PDF uses the same hex (no per-format opacity tricks —
  three formats, one computed colour, PQB-traceable to the theme).

**Per-format native mechanisms (Q3):**

| Format | Mechanism |
|---|---|
| PDF | rule = filled rect at the left margin; tint (when declared) = filled rect behind the padded text block; text at the narrowed column (usableWidth − rule − gap) |
| DOCX | `w:pBdr` left border (the rule) + `w:shd` fill (when tinted) — Word's own paragraph chrome, no frames |
| EPUB | one `.callout` CSS class: `border-left` + `background` (when tinted) + `padding` |

## 4. R2 — the height contract, and the atomicity family's third member

- **Pricing, lock-step:** `estimateBlockHeight` for a callout paragraph = 2×6pt padding +
  `measureHeight(text, narrowedWidth)` — the SAME constants from `calloutMetrics`, the same
  measurer inputs the renderer spends (the subtitle-spacing lock-step pattern). **Measured
  against the renderer during implementation, never derived** — and the §3.1 instrument must
  cover the overcharge direction explicitly (a geometric bound on where the text column starts),
  because `unplannedPageBreaks` is blind to it (`MINI_DR_DROP_CAPS.md` §7 addendum — the lesson
  is one day old and applies verbatim).
- **Atomicity:** a callout paragraph is excluded from Phase B splitting (chrome cannot break
  mid-box in v1) — joining `LIST_SPLITTING_ACROSS_PAGES` and `DROPCAP_PARAGRAPH_ATOMICITY`.
  **The loud test ships IN THE SAME COMMIT as the exclusion** (the drop-cap debt waited months
  for its test; this one is born measured): an over-page callout yields a counted, attributed
  reconciliation, and the same text unmarked splits with zero.
- **Parity byte-stability:** no marked callout exists anywhere real → the corpus renders
  byte-identically; the locked parity numbers must not move. A leak guard asserts an unmarked
  book resolves zero callout chrome under both shipped themes.

## 5. Verification — real manuscript + real author action (the amended premise, CTO-approved)

- **Round-trip on the real fixture:** mark a faith-alone paragraph via the REAL mutation route →
  the DOCX carries `w:pBdr` (and no `w:shd` under Classic), the PDF draws the rule at the
  declared geometry, the EPUB carries the class + CSS; unmark → **byte-identical to the
  pre-mark export** (the `projectExportReflectsEdit` + round-trip-identity pattern). No
  fabricated fixture anywhere.
- **The accent knob proven end to end:** under Modern (or an `accentOverride`), the tint hex in
  all three outputs traces to `calloutTintOf(resolvedTheme)` — one computed colour, three
  formats (PQB §4/§5/§6 colour-traceability applied to the new chrome).
- **Live in the studio:** the block-level `StructureEditor` view (the "Make this a chapter"
  surface) gains a per-paragraph toggle — mark → the living Proof re-inks with the rule; unmark
  → back; undo restores; zero console errors. Verified on faith-alone.
- **Pagination cache:** marking a callout mutates the book → a genuine MISS by construction
  (`md5(book)` key); asserted alongside the existing invalidation tests, with the legitimate-HIT
  property (unmark restores byte-identical content → correct HIT, the Part-chantier honesty).

## 6. Commit plan (one responsibility each; gate green before the next; mid-item stop rule active)

1. **Model + op + route.** `Paragraph.callout?: true` (+ additive DTO/mapper crossing);
   `setCallout` pure op with tests FIRST (semantics, any-depth, malformed-toggle rejection,
   round-trip identity on the real fixture); `parseMutation` whitelist + route tests same
   commit.
2. **Chrome + pricing, lock-step.** `Theme.presentation.callout` (Classic `'none'`, Modern
   `'accent'`); `calloutMetrics.ts`; the three renderers; `estimateBlockHeight` + the Phase-B
   exclusion **with the loud atomicity test in this same commit**; the screenshot check of the
   tint ratio/geometry on real pages (CTO eyes before lock).
3. **The instruments.** Pricing strictly-higher + charged==consumed at volume at the real
   constants; the overcharge-direction geometric bound (teeth proven by probe if the instrument
   is new); parity byte-stability + the zero-chrome leak guard; the cache MISS/legitimate-HIT
   pair; accent-override re-ink.
4. **Studio + live + docs.** The block-view toggle; live faith-alone arc (mark → Proof → three
   exports → unmark → undo); docs reconciliation.

## 7. Risks / open points (named now, not discovered mid-build)

- **The tint ratio is a shade decision** — commit 2 stops for the CTO's screenshot look at the
  real page before the value locks (the Modern-accent precedent). The structure does not wait;
  the exact hex arithmetic might move.
- **Grayscale honesty:** Modern's tint WILL print grey on a B&W interior. D4 accepts this as
  Modern's identity (authors choosing Modern chose visible colour); recorded so nobody reopens
  it as a bug.
- **The block view's density:** the toggle must not bloat the folded Structure station
  (SECTION_FOLDING's D5 — height never proportional to the manuscript); the control lives on
  the block row already rendered, adding no rows.
- **`Paragraph.callout` vs future kinds:** if a taxonomy is ever wanted, `true` upgrades to a
  kind string in a dedicated review; the flag's shape does not foreclose it.

## Related

`CALLOUTS_SCOPE.md` (the measured ground) · `BOOK_PRESENTATION.md` §4 row 3 as amended by this
review (Shape B replaces "NEW Block type"; the fixture premise replaced by §5's
real-gesture proof) · `MINI_DR_DROP_CAPS.md` (the template + the instrument lessons) ·
`PART_LEVEL_STRUCTURE.md` / `CREATE_CHAPTER.md` (the additive-field and producer-ships-with
precedents) · `C1_QUOTE_PRESENTATION_UNBLOCK` (the boundary this must not silently cross).
