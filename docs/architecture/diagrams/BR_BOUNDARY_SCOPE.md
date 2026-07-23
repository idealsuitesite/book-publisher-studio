# BR_BOUNDARY_SCOPE — the `<br>` boundary-loss scope measurement (before the correctif)

**Date:** 2026-07-23 · **Status: SCOPE MEASUREMENT — reported before coding `fix/heading-br-boundary`**
(CTO condition 1: measure ALL the places `<br>` is flattened without a boundary, not just titles —
"fix the class, not the specimen"). Read-only. Instrument:
`backend/spikes/br-boundary-scope-probe.ts`.

## §1 The class is confirmed — every text-extraction site loses the `<br>` boundary

The normalizer extracts block text through cheerio `.text()` (plain path) and an inline walker that
**skips `<br>` as an empty tag** (`if (!text) return`). Both drop `<br>` to nothing, jamming the
text on either side. Synthetic proof (`Alpha<br/>Bravo` etc.):

| Site | normalizer path | result | boundary |
|---|---|---|---|
| heading (`h1`) | `.text()` (HtmlNormalizer:38) | `AlphaBravo` | LOST |
| heading `<br><br>` | `.text()` | `AlphaBravo` | LOST (both dropped) |
| paragraph (plain) | inline walker (:162) | `CharlieDelta` | LOST |
| paragraph (rich runs) | inline walker | `EchoFoxGolf` | LOST |
| list item | `.text()` (:113) | `HotelIndia` | LOST |
| table cell | `.text()` (:100) | `JulietKilo` | LOST |
| quote | `.text()` (:128/162) | `LimaMike` | LOST |

So it is a **class-wide fidelity defect**, not a title quirk.

## §2 The real scope — the title is 1 of HUNDREDS; the body is where it hurts

`<br>` occurrences in real manuscripts (mammoth HTML, per element type):

| Manuscript | total `<br>` | where |
|---|---|---|
| faith-alone-styled | 0 | — |
| art-of-captivating-list-dense | 42 | `p`:16, `li`:18 |
| generated-unstyled-3060w | 0 | — |
| pm-notes-unstyled-fr | 2 | `p`:1 |
| **founder-1 "Without religious…"** | **328** | **`p`:215** |
| **founder-2 "The Secret…"** | **234** | **`h1`:1, `p`:185** |

**The `ProtectionFOREWORD` heading (finding 2) is a single `h1` occurrence; the founder's books
carry 215 and 185 `<br>` in `<p>` — hundreds of body sentences jammed together** (measured earlier
verbatim in founder-1: `"…with discipline.Others with consistency.Some with sacrifice."` — each
inter-sentence line break dropped with no space). Finding 1 proved the body COMPOSES correctly
(embedded Gelasio); this proves the body's TEXT CONTENT is corrupted at every soft line break.
The severity is far above the title specimen.

## §3 The double-`<br>` decision (CTO condition 2) — for the CTO to settle

Today `<br><br>` yields **no** space (both dropped). A naive "one space per `<br>`" would yield a
**double space** (`Alpha  Bravo`). So the fix must **collapse a run of `<br>` (plus surrounding
whitespace) to a single boundary.** The open question the CTO flagged:

- **(a) single space** — replace each `<br>`-run with one space. Minimal, restores the word/sentence
  boundary, correct for REFLOWABLE text (the layout engine re-wraps; a soft line break between
  sentences is not a hard break in a justified paragraph). Titles become one line (acceptable; it
  ends `ProtectionFOREWORD` → `Protection FOREWORD`).
- **(b) preserve a real break** in the model — carry a newline in the title/paragraph text and have
  the renderers honour it. Higher fidelity to the author's line intent, but a bigger change (the
  title/paragraph models and all three renderers must handle intra-text newlines), and for body
  paragraphs it would force ragged one-sentence-per-line output, which is usually *not* what a
  reflowable book wants.

**Recommendation:** **(a) single space**, the minimal fidelity fix that stops the corruption, in
ALL extraction sites (the class). Preserving line breaks is a separate, richer question (a candidate
for `AUTHOR_EXPERIENCE`/typography, not this fidelity correctif). **Awaiting the CTO's decision
before coding `fix/heading-br-boundary`.**

## §4 The correctif — DELIVERED (CTO option a, `f6e38d2`)

One atomic commit, tests first, at the CLASS level: a **single helper `collapseLineBreaks(html)`**
(HtmlNormalizer.ts) applied ONCE to the raw HTML before parsing, so no `<br>` survives into the
tree and every site — present or future — is covered by construction. A run of `<br>` plus
surrounding whitespace collapses to exactly one space: `<br><br>` → one space (never two),
`word <br> word` → `word word`. Tests pin all seven sites in both directions + the non-regression
guard (a `<br>`-free paragraph is byte-identical). Real-fixture verified: founder-2's title is now
`…Protection FOREWORD`; the founder books' body jams drop from hundreds to ~2 residual (non-`<br>`
patterns); a 0-`<br>` file (faith-alone) is untouched — **proven by the whole corpus parity suite
staying green**. Backend 829/829, tsc + eslint clean, pushed.

**Deferred (not this correctif):** preserving an *intentional* line break as a real break in the
model (option b) — a richer typography/`AUTHOR_EXPERIENCE` question, out of scope for the fidelity
fix.

## §5 The measured corpus consequence + the gate-coverage lesson (recorded 2026-07-23)

§4's "proven by the whole corpus parity suite staying green" is TRUE but **incomplete**, and the
gap taught a real lesson. The **byte-parity suite is a PDF-geometry lock on 0-`<br>` fixtures**
(faith-alone), so it is **blind by construction** to a word-count change on a `<br>`-bearing file.
There WAS such a change, and it is the fix working correctly:

- **`art-of-captivating-list-dense.docx`: 9,280 → 9,322 words (+42).** The fixture carries **exactly
  42 `<br>` tags**, and the count rose by **exactly 42** — one faithful word recovered per break, the
  un-jamming the correctif exists to do. `9,322` is the correct post-fix count; `9,280` was the
  pre-fix jammed count.
- **The stale assertion.** This count is asserted by `verify-real-import` — a **server-only**
  harness (it needs a running server, `npm run verify-real-import`). The `<br>` merge re-ran the
  **in-suite** parity byte-locks but **did not re-run the server-only harnesses**, so the assertion
  kept the pre-fix `9_280` and slept on `main`. It surfaced later, at the STRUCTURE_ASSIST
  post-merge **live** gate (which runs the three harnesses), and was **re-locked to the measured
  truth `9_322` with full attribution in the fixture comment** (`6ac3c89`) — a re-lock, not a
  softening (the assertion stays exact `===`; the number moves to what the fix correctly produces).

**The lesson (`HARNESS_RERUN_AFTER_EXTRACTION_CHANGE`, TODO named follow-up):** a fidelity fix that
changes **text extraction** — word/character/sentence boundaries — can leave a server-only harness
assertion stale even when the in-suite byte-parity stays green, because the two instruments measure
different things. **Any extraction-changing fix must re-run the live `verify-real-*` harnesses, not
only the in-suite suite.** The `<br>` fix was itself correct throughout; only its verification was
incomplete.
