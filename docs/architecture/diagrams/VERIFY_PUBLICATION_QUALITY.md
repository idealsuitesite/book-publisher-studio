# verify-publication-quality — DOCX §4 Verifiability Assessment (Chantier B, step 1)

**Status:** ASSESSMENT / COME-BACK for CTO decision. **No harness code written.** This is B's mandated first step: *"if a criterion proves unverifiable as written, come back with the proposed proxy rather than implementing blind."* Five of the ten DOCX §4 criteria hit that clause.
**Date:** 2026-07-20 (session), grounded in the code and fixtures on `main` at `33b3b32`.
**Scope:** DOCX only (`PUBLICATION_QUALITY_BAR.md` §4). PDF §5 and EPUB §6 are out of scope for B.

---

## 0. Criterion count — RESOLVED: all ten, no subset

The chantier originally said *"the eight criteria."* **Resolved by the CTO (2026-07-21): there is no chosen subset — all ten count** (the 9 numbered §4 rows + the "Colors and alignment (DOCX)" criterion). "Eight" was a mis-read of the table, not a deliberate selection. `verify-publication-quality` covers all ten, each carrying its own verdict — *verifiable-now* / *disclosed-gap* / *disclosed-out-of-scope* — and none is dropped. **This question is closed.**

---

## 1. The corpus reality, measured (this is the load-bearing finding)

B says "against the real corpus." The real corpus is the four import-fidelity manuscripts in `backend/verification/corpus/` (`verify-real-import.ts`). Probed directly (`unzip` of each `word/document.xml` / parts):

| Corpus file | Chapters | Tables | Images | Hyperlinks | Real footnotes |
|---|---|---|---|---|---|
| `faith-alone-styled.docx` | 17 (H1/H2) | 0 | 0 | 0 | **0** (footnotes.xml holds only separator/continuationSeparator; 0 `footnoteReference`) |
| `art-of-captivating-list-dense.docx` | 0 | 0 | 0 | 0 | 0 |
| `pm-notes-unstyled-fr.docx` | 0 (bold-faked) | 0 | 0 | 0 | 0 |
| `generated-unstyled-3060w.docx` | 0 | 0 | 0 | 0 | 0 |

**The corpus exercises headings, lists, inline formatting, fonts and colors. It contains no tables, no images, no hyperlinks, and no footnotes at all.** It was built to prove *import structural fidelity*, not to exercise every DOCX feature — so four §4 criteria have no real data to run against.

Separately, the older `verify-real-export` fixtures in `backend/verification/` do cover some of this: `tables.docx` (2 tables), `images.docx` (2 images), `typography-test.docx` (inline formatting). **No fixture anywhere in the repo contains a hyperlink.**

---

## 2. Verifiability matrix (all evidence on `main` at `33b3b32`)

| # | Criterion | Renderer emits the inspected artifact? | Real coverage | Verdict |
|---|---|---|---|---|
| 1 | Heading styles present & nested vs AST | ✅ real `HeadingLevel.HEADING_1..6` + theme-overridden default styles (`DOCXRenderer.ts:55-74, 370-383, 398-411`) | ✅ faith-alone | **Verifiable as written** |
| 2 | Bold/italic/underline/strike round-trip | bold/italic/strike ✅; underline emitted (`:95`) but **import drops it** — mammoth's default omits `<w:u>` (ADR-0025), so it never reaches the AST to round-trip | ⚠️ partial (`typography-test.docx`) | **Proxy needed** |
| 3 | Footnotes: refs vs defs, no orphans | ❌ rendered as **inline `[N] ` body paragraphs** (`:465-474`) — no Word footnote refs/defs to count | ❌ 0 in corpus | **Unverifiable as written** |
| 4 | Lists ordered/unordered nested | ✅ (`:442-453`) | ✅ art, pm-notes | **Verifiable as written** |
| 5 | Tables: column count & cell content | ✅ `Table/TableRow/TableCell` (`:455-463`) | ❌ 0 in corpus | **Coverage gap** |
| 6 | Images placed, correct resolution | ✅ `ImageRun`, real format+size (`:476-501`) | ❌ 0 in corpus | **Coverage gap** |
| 7 | Hyperlinks: internal anchors + external URLs | external ✅ `ExternalHyperlink` (`:101`); **internal anchors ❌ unimplemented** (no bookmark/anchor machinery) | ❌ 0 anywhere in repo | **Unverifiable (no coverage + partial impl)** |
| 8 | Font per theme, no silent fallback | ✅ theme fonts into `styles.xml`/runs (`:55-74, 392`) | ✅ faith-alone | **Verifiable as written** |
| 9 | No paragraph fragmentation | ✅ DOCX never splits a paragraph (`startsWithContinuation` skipped, `:269-275`) | ✅ all | **Verifiable as written** |
| C | Colors resolve to theme values in `styles.xml` | ✅ accent → heading styles (`:59`); body color from style (`:394`) | ⚠️ Classic is all-black | **Needs a non-black theme — see note** |

**Implementation status — COMPLETE (all ten have a verdict; 599/599, tsc + eslint clean).** Eight criteria are implemented and green in `backend/src/infrastructure/renderers/publicationQuality.docx.corpus.test.ts`; two are disclosed gaps with no runnable fixture anywhere in the repo (not fabricated). Final verdict table:

| §4 | Verdict | Fixture / basis (measured) |
|---|---|---|
| 1 headings | ✅ green | `faith-alone`: heading paras == chapters+sections (96 == 17+79) |
| 2 underline | ✅ green (split) | `typography-test` real round-trip (bold/italic/strike) + **synthetic** `<w:u/>` emission, labelled synthetic |
| 3 footnotes | ⚠️ disclosed gap | inline-`[N]` proxy accepted; 0 `footnoteReference` repo-wide, no fixture fabricated |
| 4 lists | ✅ green | `art`: `<w:numPr>` == AST list items (1067) |
| 5 tables | ✅ green | `tables.docx`: `<w:tbl>`==2, `<w:tc>`==18, + a real cell's text |
| 6 images | ✅ green | `images.docx`: `word/media/`==2, `<w:drawing>`==2 |
| 7 hyperlinks | ⚠️ disclosed (external-only + gap) | 0 hyperlink repo-wide; internal anchors out of scope |
| 8 fonts | ✅ green | `faith-alone`: theme fonts in `styles.xml` + body runs |
| 9 no-frag | ✅ green | `faith-alone`: body paras == AST paragraphs (681) |
| C colours | ✅ green (2 halves) | non-black mechanism + negative control **and** Classic `accent === text` invariant (CTO decision 6) |

> **The colours trap — found while implementing, recorded not smoothed over.** The Classic theme is all-black: `colors.accent === colors.text === #000000` (`ClassicTheme.ts`). A black *fallback* is therefore indistinguishable from the theme's real black, so "the accent appears in `styles.xml`" cannot fail for the right reason — it passes whether or not the renderer honoured the theme. Criterion C is meaningful only against a **non-black theme** (exactly why `accentColors.triformat.test.ts` uses a synthetic `#1D4E68`, never Classic). C therefore moves from "ready now" to the decision pile: export the corpus under a non-black theme for this check, or assert C only under such a theme. This is §3's honest-property rule catching a would-be meaningless gate before it shipped — the same discipline this whole assessment exists to serve.

---

## 3. Proposed proxies for the five that need a decision

- **§4.2 underline.** Import cannot carry underline (ADR-0025), so a real-corpus round-trip cannot cover it. **Proxy:** round-trip bold/italic/strike on `typography-test.docx`; verify underline **export-side** on a synthetic AST run (assert `<w:u/>` present when `TypeRun.underline` is set). Splits one criterion into a round-trip half (real) and an export-emission half (synthetic), each honest about what it proves.
- **§4.3 footnotes.** The DOCX renderer flattens footnotes to inline `[N] ` paragraphs — a real, pre-existing rendering choice, not a bug introduced here. "Count refs vs defs" cannot run. **Proxy options for the CTO to pick:** (a) assert one `[N] `-prefixed paragraph per AST footnote node and disclose "DOCX footnotes are inline" as a known limitation; (b) treat native Word footnotes (`footnotes.xml` + `footnoteReference`) as a renderer upgrade that must ship *before* this criterion is testable, and defer the criterion until then. Either way, needs a real footnote-bearing fixture — the corpus has none.
- **§4.5 tables / §4.6 images.** The renderer emits both correctly; the corpus just doesn't exercise them. **Proxy:** run these two criteria against the existing real fixtures `tables.docx` / `images.docx`, OR (cleaner, per `REAL_FIXTURE_POLICY.md`) fold a real manuscript that actually contains tables and images into the corpus. Recommend the harness accept a per-criterion fixture set rather than one corpus, so a criterion runs against a file that exercises it.
- **§4.7 hyperlinks.** No fixture in the repo has a hyperlink, and internal anchors are unimplemented. **Proxy:** verify external-URL relationships against a new real fixture containing links; **disclose internal anchors as out of scope** until cross-reference support exists (its own future work), rather than assert a capability the renderer does not have.

---

## 4. The decisions this come-back needed — ALL RESOLVED (CTO, 2026-07-21)

*All six below were decided by the CTO and are implemented; see the verdict table in §2. Preserved here as the record of what was asked and answered.*


1. **Which "eight"?** Confirm the criterion set (§0).
2. **Corpus vs. per-criterion fixtures.** "The real corpus" cannot cover tables/images/footnotes/hyperlinks. Approve running `verify-publication-quality` against a **per-criterion fixture set** (import corpus for structure/lists/fonts/colors; `tables.docx`/`images.docx` and new link/footnote fixtures for the rest), or direct that real manuscripts covering those features be added to the corpus first.
3. **Footnotes (§4.3):** proxy (a) inline-`[N]` assertion + disclosed limitation, or (b) defer behind native-footnote renderer support.
4. **Hyperlinks (§4.7):** external-only verification + internal anchors disclosed out of scope — confirm.
5. **Underline (§4.2):** approve the round-trip + export-side split.

**Recommendation:** the four genuinely ready criteria (1, 4, 8, 9) are `verify-publication-quality`'s first slice — **§4.8 fonts already shipped green** on the real corpus this session (`feature/verify-publication-quality-docx`); 1, 4, 9 follow on the same pattern — while deciding 1–5 above, plus the added colours-theme question (§2 note), for the rest. This keeps B moving without implementing any criterion blind or dishonestly.

---

## Evidence index
- `backend/verification/corpus/*.docx` — the four real manuscripts; feature probe in §1 (reproducible via `unzip -p <f> word/document.xml`).
- `backend/verification/{tables,images,typography-test}.docx` — the proxy fixtures.
- `DOCXRenderer.ts` — line refs per criterion in §2.
- `HtmlNormalizer.ts:167,169` — `<u>`→underline and `<a>`→link mapping (import side).
- ADR-0025 (mammoth drops underline), ADR-0026 (strikethrough fixed) — `docs/DECISIONS.md`.
- `PUBLICATION_QUALITY_BAR.md` §4, §7, §10 — the spec and its locked calibration (pagination/structure only; DOCX criteria still await this harness).
