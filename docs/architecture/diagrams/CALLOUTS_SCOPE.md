# Callouts — Scope Report (queue item 6)

**Status:** ✅ CLOSED — the §7 taste stop was ANSWERED by the CTO the same day (the four
decisions: rule+light tint, one generic callout with silent chrome, accent-derived tint,
Classic tint-free/Modern tinted) and the chantier DELIVERED via `MINI_DR_CALLOUTS.md`
(Option A as recommended, Shape B as recommended), merged to `main` 2026-07-22 (`9f66930`).
The census and the C1-trap analysis below remain the measured ground of record.
**Date:** 2026-07-22
**Format precedent:** `TYPOGRAPHY_TUNING_SCOPE.md` / `GUTTER_SCOPE.md` — measure, lay the options,
stop where the founder decides.

---

## 0. The premises, re-measured (non-negotiable #7)

The standing plan is `BOOK_PRESENTATION.md` §4 row 3 (2026-07-21): *NEW `Block` type `'callout'`
(+ DTO + mappers); themed chrome (background/border/padding); padding + border enter
`estimateBlockHeight`; tri-format; **corpus fixture must contain one**.* Three of its premises
needed re-measurement; two survived, one is now **unsatisfiable as written**:

1. **"No import mapping in v1" (§6 Q1, CTO-locked) — SURVIVES, and the census below strengthens
   it.** Nothing real to map exists even if we wanted to.
2. **"NEW `Block` type" — RE-MEASURED, now the expensive shape.** Since the row was written, the
   Part chantier measured a `Content`-union extension at 60 sites/20 files and chose an additive
   field instead (`Chapter.partOpener`, Shape B) — and shipped it. The same measurement for the
   `Block` union today: **9 exhaustive-switch sites** (`_exhaustive: never` in BlockMapper,
   BookMetricsCalculator, LayoutEngine ×2, TypographyResolver, PDF/DOCX/EPUB renderers) **+ DTO +
   mappers + every frontend consumer of `BlockDTO`** (the block-aware `StructureEditor` view).
   §4 options below.
3. **"Corpus fixture must contain one" — UNSATISFIABLE WITHOUT FABRICATION.** See §1. The CTO has
   already refused a fabricated fixture once, in writing (`C1_QUOTE_PRESENTATION_UNBLOCK`,
   `REAL_FIXTURE_POLICY.md`). The verification premise must be amended, not quietly met with a
   synthetic file (§3).

## 1. The census, measured (`backend/spikes/callout-census-spike.ts`)

Across the whole real corpus (4 manuscripts, 2,152 paragraphs): **0 tables of any shape (so 0
1×1 "callout boxes"), 0 label paragraphs ("NOTE:", "IMPORTANT:", EN/FR variants), 0 shouting-case
lead-ins, 0 quote/scripture blocks** (re-confirming the quote census on the grown corpus).
Word-native shading and text boxes are not even visible signals — mammoth surfaces neither
(measured in the heuristic-detection chantier), so their absence is *unknowable*, stated as such.

**Conclusion: no real manuscript we have carries callout-shaped content the pipeline can see.**
Nothing to detect (Q1 vindicated), nothing to fixture from import alone (§0.3).

## 2. Current state (verified in code, not remembered)

- **Zero callout code anywhere** (`FORMATTING_TOOLS_AUDIT.md`, re-grepped today: the word appears
  only in design documents).
- **The presentation seam EXISTS since this morning:** `Theme.presentation` (born with
  `presentation.dropCap`, merged `aa5ac9b`). A callout's chrome would be its **second consumer**
  — `Theme.presentation.callout` — through the same one-seam pattern (`resolveTheme` passthrough
  already pinned by test).
- **The authoring foundation EXISTS:** the generic mutation route (`POST /:id/structure` →
  `parseMutation` whitelist → `EditBookUseCase` → `BookEditingService` pure op), snapshot + undo
  for free, live-Proof re-ink, and the `StructureEditor` as the surface. `setPartRole` /
  `promoteToChapter` are the exact precedents (each shipped WITH its route tests — the live-gap
  lesson).
- **Styled quotes (C1) are FROZEN and stay frozen.** Callout chrome must not silently deliver
  quote presentation through the back door: quote/scripture rendering is untouched by this
  chantier, whatever is decided.

## 3. The C1 trap — and why this chantier escapes it (the load-bearing argument)

C1 froze because **nothing real exercises it and no producer exists**: a presentation capability
for a block type no real import produces and no author can create. The census (§1) shows callouts
in the same starting position — **but callouts were never scoped as import-fed.** §6 Q1 locked
"callouts render when the AST carries them; authoring creates them" back when authoring was a
future hope. Authoring now exists and has already escaped this exact trap once: `promoteToChapter`
made chapters reachable from a REAL 0-chapter manuscript by a REAL author gesture, verified live
and locked by round-trip tests on real fixtures.

**The verification premise, amended accordingly (replacing §0.3's impossible fixture):** the
real-fixture proof is *a real manuscript + a real author action* — mark a paragraph of imported
faith-alone as a callout in the studio, see the chrome in the living Proof and in all three
exports, unmark it, byte-identical again. Locked by a round-trip test through the real mutation
route on the real fixture (the `projectExportReflectsEdit` pattern), never by a fabricated DOCX.

## 4. The model shape — two options, one measured recommendation

- **Shape A — `Block` union member `'callout'`** (§4 row 3 as written): a container block with its
  own text/inlines and `kind`. Cost measured today: 9 exhaustive sites + DTO/mappers + frontend
  consumers; every future walker pays the eleventh case forever. Buys: multi-paragraph callouts
  someday (not in any v1 need).
- **Shape B — additive field on `Paragraph`: `callout?: 'note' | 'tip' | 'warning'`** (naming per
  §7). The `partOpener`/`role` precedent, third use: zero union churn, the resolver/renderers
  read it inside their existing `paragraph` case, DTO crossing additive, the marking op is a
  by-id `BookEditingService` walk (rename's pattern). A callout IS a semantic claim about a
  paragraph ("this is an aside of kind K"), while its LOOK stays in the theme — exactly the
  content/presentation split Q2 locked (and `PartRole` §2b already embodies).
- **Recommendation: Shape B.** V1 scope = single-paragraph callouts, disclosed; a multi-block
  callout (grouping) would be its own future review, the same deferral shape as list-splitting.

## 5. Render mechanisms + R2 (each format's native path, per Q3)

| Format | Native mechanism | R2 |
|---|---|---|
| PDF | padded text in a tinted/ruled box (`doc.rect` fill/stroke + inset text column) | **the real R2 surface**: padding top/bottom + border + the narrowed wrap width priced in `estimateBlockHeight` in LOCK-STEP with the renderer (the subtitle-spacing pattern), measured against the renderer, never derived (the list-prefix/drop-cap lesson); the geometric-bound instrument class now exists to copy |
| DOCX | native paragraph shading + borders (`w:shd`, `w:pBdr`) | none — Word reflows (ADR-0045 asymmetry) |
| EPUB | a CSS class box (background/border/padding) | none — reflowable |

Chrome colours resolve from the theme (accent-derived tint or declared values — §7); every colour
traceable to the theme per PQB §5/§4/§6. Splitting: a callout paragraph should be **atomic**
(chrome cannot break mid-box in v1) — the third member of the atomicity family
(`LIST_SPLITTING_ACROSS_PAGES`, `DROPCAP_PARAGRAPH_ATOMICITY`), same treatment: excluded from
Phase B, overflow observable, disclosed not hidden, its own test from day one (the debt lesson —
this time the loud test ships WITH the capability, not owed for months).

## 6. The two ways to run item 6 — recommendation

- **Option A — build it, authoring-first** (recommended): 4-commit shape mirroring the drop-cap
  chantier — (1) model field + marking op + route (tests first), (2) theme chrome value + the
  three renderers + pricing lock-step, (3) instruments (pricing measured, atomicity loud, parity
  byte-stability — no marked callout ⇒ zero bytes moved), (4) studio control + live on
  faith-alone + docs. Ships **lit but empty**: real chrome values in the themes, invisible until
  an author marks a paragraph (unlike drop caps, the trigger is the author, not the theme — so
  no dark-shipping question arises; parity is stable by construction).
- **Option B — freeze like C1.** Honest only if the CTO judges the authoring gesture itself
  low-value (no user has asked). Costs nothing now; but unlike C1 there is no missing
  precondition — the producer is buildable today with existing machinery.

## 7. ⛔ THE TASTE STOP — the visual direction (the CTO's call, nothing below is decided)

1. **The chrome family.** (a) Left accent rule + light background tint (sober, academic — the
   Classic temperament); (b) full border box; (c) background tint alone, no rule. Per-theme
   variation allowed (e.g. Classic = rule+tint, Modern = tint with accent-coloured rule)?
2. **The kinds and their labels.** One generic callout, or the note/tip/warning triad? Does the
   box render a LABEL line ("NOTE") — and if so, who translates it (the book's `language` is in
   metadata) — or is the chrome silent (no label, v1)?
3. **The tint source.** Derived from the theme accent (one knob, consistent with the accent
   override), or independent declared colours per kind?
4. **Print reality.** Callout tints must survive grayscale print (KDP interior is
   often B&W) — is a tint-free variant (rule only) the safer Classic default?

**Nothing proceeds past this line without the CTO's visual direction.** After the call: mini
Level-2 review (`MINI_DR_CALLOUTS.md`) locking the §4 shape + §5 R2 plan + the §7 answers, then
the commit sequence.

## Related

`BOOK_PRESENTATION.md` §4 row 3 + §6 Q1/Q2/Q3 (the locks this report re-measured) ·
`FORMATTING_TOOLS_AUDIT.md` (the zero-code baseline) · `C1_QUOTE_PRESENTATION_UNBLOCK` (the trap
§3 escapes) · `MINI_DR_DROP_CAPS.md` (the presentation seam + the instrument lessons) ·
`PART_LEVEL_STRUCTURE.md` (the Shape-B precedent) · `REAL_FIXTURE_POLICY.md` (why §0.3 could not
be met as written) · `backend/spikes/callout-census-spike.ts` (§1's instrument).
