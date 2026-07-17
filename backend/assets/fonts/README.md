# Embedded PDF Fonts

Real, redistributable font files embedded into PDF output by `PdfFontRegistry`
(`backend/src/infrastructure/fonts/PdfFontRegistry.ts`) — resolves ADR-0019 finding 1
(PDFKit ships no font data of its own) and ADR-0021/0023 (font policy decision). Committed
directly to the repo, not fetched at build or render time — a clone + `npm install` is
enough to produce identical PDF output; CI/CD and Claude Code sessions never need network
access to render a PDF.

## Families

| Family | Role | Official source | Version fetched | License | Styles present |
|---|---|---|---|---|---|
| **Gelasio** | Serif (replaces Georgia — ADR-0019 finding 1, ADR-0021) | [Google Fonts, `ofl/gelasio`](https://github.com/google/fonts/tree/main/ofl/gelasio) | v14 | SIL Open Font License 1.1 | Regular, Bold, Italic, BoldItalic |
| **Inter** | Sans-serif | [Google Fonts, `ofl/inter`](https://github.com/google/fonts/tree/main/ofl/inter) | v20 | SIL Open Font License 1.1 | Regular, Bold, Italic, BoldItalic |
| **JetBrains Mono** | Monospace | [JetBrains/JetBrainsMono](https://github.com/JetBrains/JetBrainsMono), `fonts/ttf/` | `master` branch at integration time, corresponds to release `v2.304` | SIL Open Font License 1.1 (confirmed via the repo's own `OFL.txt` — **not** Apache 2.0 as originally assumed in the Sprint 4 design review; corrected here) | Regular, Bold, Italic, BoldItalic |

**Integration date:** 2026-07-17 (Sprint 4, commit 6 — Typography Resolution Pipeline).

Each family's own `*-OFL.txt` file in this directory is the license text fetched directly
from that family's official repository at integration time — not retyped or summarized.

## Why only 4 styles per family

`PdfFontRegistry`/`PDFRenderer` only ever request Regular/Bold/Italic/BoldItalic combinations
(`TypeRun.bold`/`.italic`, resolved by `TypographyResolver`) — no other weights (e.g. Light,
SemiBold, ExtraBold) are used anywhere in the rendering pipeline, so they aren't fetched.
Google Fonts' `ofl/gelasio` and `ofl/inter` only ship variable-font builds in their main
directory (no static per-weight files) — the 4 static instances here were obtained via
Google Fonts' CSS API (which serves static-instance `.ttf` files derived from the variable
font, not the variable font itself) rather than the repo tree directly.

## Updating a font later

1. Confirm the new source is still the family's official upstream and still under a
   redistributable license (SIL OFL, Apache 2.0, etc.) — don't assume a license carries
   over between major versions without checking.
2. Replace the 4 `.ttf` files for that family (same naming: `{Family}-Regular.ttf`,
   `-Bold.ttf`, `-Italic.ttf`, `-BoldItalic.ttf`) and the corresponding `*-OFL.txt`.
3. Update the version/date in the table above.
4. `PdfFontRegistry` needs no code change unless the family's *name* or the pattern that
   should route to it (`FontFamilyDefinition.match`) changes.
5. Run `npm test` (in particular `PdfFontRegistry.test.ts` and `PDFRenderer.test.ts`), then
   `npm run verify-real-export` against a real server to confirm the new font actually
   embeds and renders — do not trust a green unit-test suite alone for a font-asset change
   (`docs/CLAUDE.md`'s Real Export Policy).

## Adding a new family (e.g. a future Noto family for RTL/CJK support, ADR-0019 finding 2)

Add one new entry to the `FAMILIES` array in `PdfFontRegistry.ts` (name, a `match` pattern,
and the 4 file names) and the 4 `.ttf` files + license text here — no other code changes
needed. `PDFRenderer` never references a font file path directly; it only calls
`PdfFontRegistry.resolve()`.
