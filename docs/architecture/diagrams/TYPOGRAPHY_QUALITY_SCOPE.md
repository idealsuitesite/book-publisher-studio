# TYPOGRAPHY_QUALITY_SCOPE — the cadrage measurement (2026-07-22)

**Status: MEASUREMENT REPORT — stops at the constats, deliberately.** The handoff's own instruction:
the chantier takes its name only after this measurement is read. This report therefore contains
**no options, no chantier name, no priority ranking** — those are the CTO's next decision. No
production code was opened; every instrument is a read-only spike (§7).

> **Outcome (CTO rulings, same day — recorded so this frozen report never misleads):**
> **A** → prerequisite fidelity fix, **DELIVERED AND MERGED** (`MINI_DR_BLOCKLESS_TITLES`,
> `1aeee04`); **B+C** → the taste chantier takes its name: **`TYPOGRAPHY_QUALITY`** — one
> decision, justification WITH real-dictionary hyphenation (never naive, ADR-0024 discipline),
> full Design Review, the dormant §2 residual in the same scope, opening AFTER the founder
> traversal; **D** → consigned as **`LEADING_FIDELITY`** (after B+C, own cadrage); **E** →
> `LIST_SPLITTING_ACROSS_PAGES` amended to today's numbers in `TODO.md`.

**Repo state verified first (not assumed):** `main` at `c1b07ab` — one docs commit ahead of the
handoff's expected `32688bd` (the final session-close pass, `32688bd` is its direct parent); tree
clean, in sync with `origin/main`; backend re-run **795/795** before any measurement.

---

## §0 The premise, re-measured (non-negotiable #7)

What the record says is already delivered — **verified true**:

- **Phase B** (`82326f3`, 2026-07-19) is real and on `main`: line-granular paragraph splitting
  with min-2-lines at BOTH ends of every break (`LayoutEngine.addSplittingText`), title
  keep-with-next (`flushBeforeTitleIfOrphaned`, chapters AND sections), heading-block
  `staysWithNext`.
- **§10.3 value 3** (PUBLICATION_QUALITY_BAR) retired the body-widow hedge on that basis.
- **The guarantee holds where it applies, measured on real pages:** the real-page census (§7
  instrument, uncompressed page-stream parse, faith-alone + pm-notes-fr × 3 themes, 494 real
  pages) found **zero** one-line paragraph stragglers anywhere. Min-2-lines is not just a model
  property; it survives to the rendered page.

Everything below is what lives **outside** that guarantee. Each constat was measured on real
corpus pages; none is assumed.

---

## §1 Constat A — §10.3's heading gate is violated on a real page TODAY (latent defect, raised immediately)

§10.3 value 3 claims: *"headings/titles hard gate 0 — enforced by construction (title
keep-with-next + `staysWithNext`) and measured 0."* **Measured now: 1 violation on a shipped
theme.**

- The real-page census: Classic 0/158, Novel 0/161, pm-notes 0×3 — **Modern 1/158**: real page
  40 carries an 18pt section heading at the very bottom of the text column with **zero** body
  lines beneath it.
- The renderer itself names the mechanism (warning captured):
  `unplanned page break #2 while rendering title "3. The Law Was a Tutor, Pointing to Chri…"` —
  PDFKit broke the page **while drawing the title**.
- **Root cause, verified in the AST and in the code:** `"3. The Law Was a Tutor, Pointing to
  Christ"` is a **blockless titled L2 section** — 1 of faith-alone's 79 sections has zero content
  blocks (probe 4). The LayoutEngine charges a title only through its content's **first block**
  (`flushBeforeTitleIfOrphaned(content, block)` inside `for (const block of content.content)`);
  a blockless section never enters that loop, so its title is **charged at 0** — while every
  renderer draws it. Model +0 / renderer +~38pt (18pt title + Modern's 14/6 title spacing).
- **This is the "blockless-titled *section* shape" named as a deferral at the Part chantier** —
  `LayoutEngine.ts:280-283` even discloses the top-level variant ("the renderer plans no break
  for it — out of scope here, disclosed in PART_LEVEL_STRUCTURE.md"). What was recorded as a
  structural nicety is in fact a live ADR-0051 drift with a §10.3-violating cosmetic effect: the
  uncharged consumption crossed a page boundary on Modern and stranded the heading at the page
  bottom.
- On Classic and Novel the same ~38pt is consumed uncharged but absorbed without crossing a
  boundary — **latent in all themes, visible today in one**. It is the exact class PART_LEVEL's
  prerequisite commit fixed for blockless *chapters*, one level down.

Raised immediately per the queue rule (a latent defect found mid-item is reported before
continuing). Observable today only as an anonymous `unplannedPageBreaks` increment — nothing
gates "this reconciliation stranded a heading."

## §2 Constat B — justification: the renderer supports it, NOTHING produces it

- Census over all four real manuscripts, **positive control passed first** (the instrument
  proves it sees an `align` before any zero counts): **0 of 4,374 blocks** carry `align`
  (faith-alone 681, list-dense 1,608, generated 30, pm-notes 55).
- `PDFRenderer` honours `align: 'justify'` (line 611) and EPUB emits `text-align` — but no
  importer, no theme, no mutation sets `align` anywhere in `src/` (grep + census agree). The
  path is **unreachable from any real book**.
- Consequence: **every exported book ships ragged-left body text in all three formats**, against
  the near-universal book convention (justified). This is a themes/aesthetic decision waiting to
  happen, not a bug — but today it is decided by omission, not by anyone.
- The disclosed pre-break residual (`PDFRenderer.ts:772`: a split paragraph's pre-break line
  renders ragged under justification) is dormant until justification lights; it becomes relevant
  the day it does.

## §3 Constat C — hyphenation: absent, and its absence is measured

- **Zero hyphenation code** in `src/` (grep).
- Cost measured on faith-alone at the kdp-6x9 column (288pt), Gelasio 11pt (all three themes
  share the body face — verified in the theme files, which is why the numbers are identical):
  over **3,551 non-final body lines**: end-of-line slack median **14.2pt (1.4em)**, p90
  **36.6pt (3.6em)**, max **80.0pt (7.8em)**; **46.8%** of lines carry >1.5em slack, **24.4%**
  >2.5em.
- The number reads both ways: today (ragged-left) it IS the visible right-edge raggedness; under
  justification it becomes inter-word stretch — a quarter of all lines would stretch by more
  than 2.5em distributed across their word gaps. Justification (§2) and hyphenation are one
  coupled decision, not two.
- Instrument disclosure: greedy wrap over real embedded-font word widths at the real column
  width — the same greedy model PDFKit's LineWrapper uses; an approximation of, not an
  extraction from, the rendered lines.

## §4 Constat D — leading: the declared 1.4 reaches ONE format of three

- All three themes declare `spacing.lineHeight: 1.4`.
- **EPUB** is the only consumer (`EPUBRenderer.ts:146`, `line-height: 1.4` in the book's CSS).
- **PDF** advances at the font's natural line box: **13.96pt at 11pt = 1.27em** — confirmed on
  the real page bytes, not only via the measurer (modal baseline-to-baseline delta 13.96pt ×
  1,271 samples across 55 body pages; the 21.96pt second mode = line + the flat 8pt
  `paragraphSpacing`). Declared 1.4 would be 15.40pt: **the PDF sets ~9% tighter than the EPUB
  of the same book.**
- **DOCX** emits no line spacing at all → Word's own default (a third value).
- One declared knob, three real behaviours. This quantifies TYPOGRAPHY_TUNING_SCOPE's "leading
  is not a real PDF knob today" — and makes it a cross-format fidelity statement: the theme's
  declared leading is a promise 2 of 3 formats do not keep. (Making PDF honour it is R2-heavy:
  every charged height moves in lock-step — noted as fact, not scoped here.)

## §5 Constat E — the atomicity family: real, layout-dependent, and the recorded number is stale

- **Corpus census:** faith-alone contains **zero** atomic block types (no quote/scripture/list/
  table/image at block level — its images live inline); list-dense has **214 lists**; pm-notes
  **8 lists** (2 taller than half a page); generated none.
- **Live reconciliation cost today, measured across layouts** (list-dense, all three themes
  identical): **kdp-6x9: 0 · letter: 0 · kdp-5x8: 4 unplanned**. The follow-up entry
  `LIST_SPLITTING_ACROSS_PAGES` records "5 reconciliations (> the locked ≤2)" — **that number no
  longer reproduces anywhere**; today's worst is 4, only on the narrowest trim. The debt is
  real, loud (ADR-0051), and **narrow-column-dependent** — invisible at the corpus-parity
  layouts.
- **Faith-alone baseline residuals** (kdp-6x9): Classic 1 (paragraph-136), Novel 1
  (paragraph-135) — the known ±1-line bold-run class; Modern 2, whose second is §1's stranded
  title, not a paragraph residual.
- No atomic block anywhere in the corpus exceeds a full page (0 `>page` everywhere); the
  overflow pressure is entirely "atomic block meets a partially-spent page."

## §6 What this report deliberately does not do

Name the chantier, choose between the constats, or propose designs. Five measured facts are on
the table: **A** a live §10.3 heading-gate violation with a located root cause (the blockless
titled section, the Part-deferral shape); **B** justification decided by omission; **C**
hyphenation absent with a quantified cost coupled to B; **D** a declared leading two formats
ignore; **E** an atomicity debt that is layout-dependent and whose recorded number is stale.
Which of these becomes the typography-quality chantier — and whether A is instead a small
prerequisite fix in the PART_LEVEL lineage — is the CTO's call on reading this.

## §7 Instruments (all read-only, reproducible)

| Probe | What it measures |
|---|---|
| `backend/spikes/typography-quality-probe.ts` | §2 align census (positive control), §4 leading incl. real-byte baseline deltas, §3 slack distribution, §1 real-page heading census, §5 atomicity census — all four corpus files × 3 themes |
| `backend/spikes/typography-quality-probe2.ts` | §1 model-side view of the Modern p40 pages; §5 list-dense across kdp-6x9/kdp-5x8/letter |
| `backend/spikes/typography-quality-probe3.ts` | §1 renderer warning capture (names the title-break) |
| `backend/spikes/typography-quality-probe4.ts` | §1 empty-section census (1 of 79 in faith-alone; 0 elsewhere) |

Run: `npx tsx spikes/typography-quality-probe.ts` (etc.) from `backend/`. In-process only — no
server started, no database touched, no fixture projects created ("live verification leaves no
trace" honoured by construction).
