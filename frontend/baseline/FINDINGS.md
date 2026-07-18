# Sprint 9 Commit 0 — Baseline Findings

Captured 2026-07-18 against the real running application (`npm run baseline`), driving the official Demo Script (`docs/product/PRODUCT_DEMO.md`) with real Chromium and the real canonical fixture `backend/verification/large-book.docx`.

**This is the "before" state.** Every improvement claimed later in Sprint 9 is measured against these numbers, per `UI_FOUNDATION.md` §8's requirement for *"a real delta, not a claim."*

## What was captured

12 real PNGs — 4 Demo Script screens × 3 viewports (desktop 1280px, tablet 768px, mobile 375px) — plus `a11y-baseline.json`.

| Screen | Demo Script step |
|---|---|
| `01-landing` | 1. Launch |
| `02-imported` | 2–4. Import `large-book.docx`, see chapters, see warnings |
| `03-layout-kdp` | 5. Change layout to KDP 6" × 9" |
| `04-preview` | 6. Preview |

Export steps (7–9) produce file downloads rather than a materially different screen, so they are covered by the backend's existing `verify-real-export` (16/16) rather than duplicated here.

## Accessibility baseline — axe-core

**11 violation types across 44 nodes.**

| Violation | Impact | Nodes | Screens |
|---|---|---|---|
| `color-contrast` — elements must meet minimum contrast thresholds | **serious** | 3 each | `02`, `03`, `04` |
| `region` — all page content should be contained by landmarks | moderate | 1 → 10 | all 4 |
| `landmark-one-main` — document should have one main landmark | moderate | 1 | all 4 |

The `region` count rising from 1 on the landing screen to 10 after import is the measurable shape of the problem: every panel added to the page is another unlandmarked region.

## The finding axe could not detect — and the most serious one

**`UploadDropzone` has no file input, no keyboard handler, no `tabIndex`, and no `role`.** It is a bare `<div>` with only `onDragOver`, `onDragLeave`, and `onDrop` (`components/UploadDropzone.tsx:156-177`).

Consequences, confirmed by reading the code rather than inferred:

- **Keyboard users cannot import a manuscript.** There is nothing focusable to activate.
- **Screen reader users cannot import a manuscript.** There is no control to announce.
- **Mouse users who click rather than drag cannot import a manuscript.** There is no click handler and no browse dialog.

Importing is the application's single entry point. Every other feature is unreachable without it, so this is not a degraded experience — it is a complete exclusion.

**Why axe scored 0 violations for it:** automated accessibility tools check the semantics of elements that *exist*. A missing control has no attributes to fail. This is a concrete demonstration that the a11y numbers above are a floor, not a ceiling, and that Sprint 9's accessibility work cannot be considered done by driving those counts to zero.

**Also disclosed:** this is why `scripts/capture-baseline.mjs` synthesizes a real `DataTransfer` drop event instead of using Playwright's `setInputFiles()`. That is not a limitation of the script — it is the script accurately reproducing the only interaction the application actually supports today.

## Typography defect confirmed live

`app/layout.tsx` loads Geist and Geist Mono from Google Fonts; `app/globals.css:25` sets `body { font-family: Arial, Helvetica, sans-serif }`; nothing anywhere uses the `font-sans`/`font-mono` classes that would apply the loaded fonts. **The application downloads two font families on every page load and renders no character in either.** Scheduled for Commit 1 (`UI_FOUNDATION.md` §5).

## How this baseline is used

```bash
npm run baseline           # re-capture (overwrites this directory)
npm run baseline -- --check  # compare against committed images, exit 1 on any drift
```

Per `UI_FOUNDATION.md` Decision 3: **Commits 1–7 must leave every `--desktop` image byte-identical.** Commit 7 (responsive) is the single carve-out and may change `--tablet` and `--mobile` only. Commit 8 is the first permitted to change desktop appearance, at which point the baseline is re-captured deliberately.

A `--check` failure during Commits 1–7 means a real regression, not a stale baseline.

## Environment note

Sprint 7 Commit 12 recorded that this environment could not persist screenshots to disk and returned blank captures once a page was scrolled. Playwright resolves both: real PNG files, full-page captures independent of scroll position, reproducible on any machine (ADR-0040 Correction 2). The Commit-0 blocker risk that decision flagged did not materialize.
