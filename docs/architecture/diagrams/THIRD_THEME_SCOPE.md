# Third Theme — Scope Report (queue item 7)

**Status:** 🟡 MEASURED — **STOPPED AT THE TASTE DECISION (§5, the aesthetic direction), as the
queue directive requires.** No production code opened; every claim below re-verified in code
today (non-negotiable #7).
**Date:** 2026-07-22
**The CTO's framing, which this report serves:** *the cadrage must first establish what the
pipeline can really express today, because THAT defines the space of aesthetic directions to
choose from — not the other way round.*

---

## 0. The Modern precedent, re-measured

`SECOND_THEME.md`'s mechanics all still hold, re-verified: a theme is declarative data; the
registry is one line (`getTheme.ts` `THEMES`); `listThemeNames()` feeds the options endpoint;
the Layout-station gallery is **theme-count-agnostic** (maps `options.themes`, still shows the
honest "More themes are being set." slot — a third registry entry becomes a card with zero
frontend work). The engines are untouched by a new theme (ADR-0029). What HAS changed since
Modern's birth is the vocabulary — §1, the heart of this report.

## 1. What the pipeline can express TODAY — the third theme's vocabulary

**A third theme is born into a language roughly twice the size Modern was.** At Modern's birth
(2026-07-21) a theme declared: two font roles, eight sizes, two colours (accent freshly consumed
tri-format), four spacing values, a running head. Since then, chantier by chantier:

| Knob (new since Modern) | What a theme can now say | Source |
|---|---|---|
| `spacing.titleSpaceBefore/After` | its own chapter/section TITLE rhythm (asymmetric, above > below) — Classic 18/8, Modern 14/6 | subtitle-spacing chantier |
| `presentation.dropCap` (`scope`, `scale`) | **light REAL tri-format drop caps on chapter openings** — PDF band / Word-native frame / EPUB float, one arithmetic; both shipped themes declare `'none'`, so a third theme would be **the first to turn the capability on** | drop-cap chantier (`aa5ac9b`) |
| `presentation.callout.tint` (`'none' \| 'accent'`) | whether an author's callouts carry the accent-derived wash (Modern) or the print-safe bare rule (Classic) | callouts chantier (`9f66930`) |
| its **designed default body size** | "standard" always means THE THEME'S OWN default (the §2.1 offset interpretation the CTO validated for exactly this future case) — a third theme may legitimately ship body 10.5 or 12 and keep its identity under every preset | typography tuning |
| the `accentOverride` interplay | the theme's accent is a *starting point* the author can re-ink — and since callouts, the accent re-inks chrome too (one knob, D3) | accent + callouts chantiers |

**The hard constraint, unchanged: three embedded faces** (`PdfFontRegistry`, ADR-0023, all SIL
OFL): **Gelasio** (serif), **Inter** (sans), **JetBrains Mono** (role-reserved for monospace —
effectively TWO book faces). A genuinely new typeface = embedding (4 variants) + re-measuring
the drop-cap `capHeight` plausibility range for that face + a licensing check — **its own
decision line if wanted (the Radix precedent), recommend reuse** (Modern's own §3
recommendation, twice proven).

**Deliberately NOT in the vocabulary — named so no direction silently assumes them:**
quote/scripture presentation (C1, FROZEN — a "Bible/Theology" theme's defining feature is
therefore not expressible yet; that historic candidate from `Theme.ts`'s comment stays out of
this menu honestly); chapter-opener typography and TOC indentation (Part-chantier deferrals);
per-heading-level font families (`resolveHeading` accepts the level, no theme can vary by it
yet); locale-aware quote glyphs.

## 2. What a third theme owes (the Modern procedure, plus the new obligations)

1. The `Theme` object + one registry line; gallery card appears by itself (§0).
2. **Its own parity lock** on faith-alone (never reusing Classic's or Modern's numbers) and its
   own §10.4 WPP calibration row — the `PUBLICATION_QUALITY_BAR` pattern Modern established.
   *(Note: this adds a theme dimension row; `RECALIBRATE_PAGE_RATIO_TOLERANCE` stays blocked on
   its own FIXTURE condition — 2 of 3 corpus manuscripts — a third theme does not unblock it.)*
3. **Classic AND Modern byte-stability** — purely additive, their locks unmoved.
4. Tri-format proof (fonts/accent/spacing in PDF+DOCX+EPUB output, the `accentColors.triformat`
   pattern) — and, NEW: **if the theme lights drop caps, its parity numbers are born WITH the
   ornament priced in** (charged==consumed under the capability's own instruments — the pricing
   machinery exists and is teeth-proven; the new lock simply captures ITS numbers), and its
   callout tint policy is asserted like Classic's/Modern's in `calloutChrome.test.ts`.
5. The pagination-cache key already carries `themeName` — a third theme is new key space, no
   cache work owed.
6. The CTO screenshot loop on real pages before any shade/value locks (the Modern accent and
   callout-tint precedents — twice this session the real page moved a value).

## 3. Sizing (for the record, not the decision)

Modern shipped as data + registry + its own locks in 3 steps (`e5954e9`). The third theme is
the same shape **plus** the two §2.4 additions if drop caps are lit. No engine work anywhere in
sight; the cost centre is the VERIFICATION (locks + calibration + screenshot loop), exactly as
it should be.

## 4. Risks

- **The aesthetic is subjective** — the screenshot loop with the CTO calibrating, now with two
  precedents (Modern's `#1D4E68`, the callout 0.96).
- **A drop-cap-lit theme changes what "byte-stability" guards**: Classic/Modern keep
  `scope:'none'` and their locked numbers; the NEW theme's own lock includes its drop caps from
  day one. The §3.3 leak guard stays theme-scoped — no cross-contamination, stated now.
- **A new typeface would smuggle real work** (embedding + capHeight range + license) — kept out
  unless the CTO explicitly opens that line.

## 5. ⛔ THE TASTE STOP — the aesthetic direction (the CTO's call; a menu, not a pick)

The two SECOND_THEME directions that lost to Modern survive, each now *richer* than when first
offered, plus the minimal direction. For each: what it would concretely declare.

- **A — "Novel"** (the book-interior direction, SECOND_THEME §4-B enriched): Gelasio throughout;
  generous title space (e.g. 22/10) and slightly larger leading rhythm; `chapterTitle` running
  head (the first theme to use it — Classic/Modern both run `bookTitle`); **drop caps ON**
  (`chapterOpening`, the classic literary ornament — the first theme to light `aa5ac9b`);
  callouts `tint:'none'` (print-sober); accent = text or a deep warm tone. *The direction that
  showcases the newest capability where it typographically belongs.*
- **B — "Academic"** (SECOND_THEME §4-C enriched): Inter headings over a **denser** Gelasio body
  (designed default body 10.5 — the first theme to exercise the its-own-default identity);
  uppercase running head with page numbers; **callouts `tint:'accent'`** (the note/aside is this
  genre's natural furniture); no drop caps; a restrained cool accent.
- **C — "Minimal"**: Inter throughout (the first sans-BODY resident); tight spacing; pale
  accent; no ornaments anywhere (`dropCap 'none'`, callout `tint:'none'` — the rule alone).
- **D — a fourth direction the CTO names.** *(A "Bible/Theology" direction is named and
  deliberately NOT offered: its defining feature — scripture presentation — is C1-frozen and
  out of vocabulary; offering it would sell what the pipeline cannot express.)*

Sub-decisions the direction carries (answered by the pick or separately): the font roles within
the two-face constraint · drop caps on/off (and the scale if on) · callout tint policy · running
head content/casing · the designed default body size · the accent's starting shade (screenshot
loop refines).

**Nothing proceeds past this line without the CTO's direction.** After the call: a short
Level-2 review (the SECOND_THEME shape), then data + locks + the screenshot loop.

## Related

`SECOND_THEME.md` (the procedure this repeats, §4's surviving directions) · `MINI_DR_DROP_CAPS.md`
/ `MINI_DR_CALLOUTS.md` (the new vocabulary's sources) · `PUBLICATION_QUALITY_BAR.md` §10.4 (the
per-theme calibration owed) · `PdfFontRegistry.ts` (the two-book-faces constraint) ·
`MINI_DR_TYPOGRAPHY_TUNING.md` §2.1 (the theme-default identity argument, now exercisable) ·
`C1_QUOTE_PRESENTATION_UNBLOCK` (why Bible/Theology stays out of the menu).
