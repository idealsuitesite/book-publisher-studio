# Demo Screenshots

Real captures from `docs/product/PRODUCT_DEMO.md`'s Demo Script, taken once Sprint 7 is implemented and run against a real manuscript (`backend/verification/large-book.docx`, the Demo Script's own fixture). These screenshots become source material for GitHub's own README, this project's documentation, a future product website, and anything shown to investors/partners/authors/editors — they must be real captures of the real running product, never mocked.

**Status (Commit 12, 2026-07-18): the Demo Script was run for real, all 6 shots captured, and no files could be written to this directory.** This environment's Browser pane has no mechanism to persist a captured screenshot to disk — the same limitation first disclosed at Commit 4 and held as a standing, CTO-accepted decision through the whole sprint (in-conversation proof is sufficient; do not block the sprint on it; do not fabricate a file). The captures exist in the session transcript that produced this update: `01-home` (empty state, real), `02-import` (real `large-book.docx`, 15 chapters, real stats), `03-validation` (real `typography-test.docx`, the real 4 warnings), `04-layout` (KDP 6"×9" selected, confirmed via `checked:true` on the real radio input), `05-preview` (real embedded PDF, "Estimated pages: 75" — exact match to an independent `curl` cross-check), `06-export` (all 6 `ProgressStepper` steps real-✓, 3 real downloads confirmed via network + on-disk file validation). A real, committed PNG set for this directory remains a genuine open item — see `docs/releases/v0.8.0-alpha/SPRINT_7_FINAL_REPORT.md` §6/§7, same status this gap has held since Commit 4, not newly discovered here.

**Below: the original pre-implementation spec**, followed exactly for the real captures above (viewport 1280px wide, page height resized per shot to avoid a scroll-position rendering bug discovered during capture — full detail in `docs/demo/VISIBLE_INCREMENTS.md`'s Commit 12 entry).

## Expected set

| File | Demo Script step | Shows |
|---|---|---|
| `01-home.png` | 1. Launch | The upload screen, empty state |
| `02-import.png` | 2-3. Import, see chapters | The structure view after a successful import, real chapter list visible |
| `03-validation.png` | 4. See the warnings | The validation findings panel, with real warnings visible (use the secondary scenario fixture, `typography-test.docx`, per `docs/product/PRODUCT_DEMO.md` — `large-book.docx` alone may not carry the same warnings) |
| `04-layout.png` | 5. Change A4 → KDP | The format/layout selector mid-change, or before/after comparison |
| `05-preview.png` | 6. Preview | The embedded preview showing the real, correctly-sized KDP result |
| `06-export.png` | 7-9. Export PDF/EPUB/DOCX | The export confirmation state, or all three downloaded files visible |

## Capture instructions (once Sprint 7 ships)

1. Run the Demo Script exactly as written in `docs/product/PRODUCT_DEMO.md`, against a real running `frontend/`+`backend/` (not a static mock).
2. Capture at a consistent viewport size (document the exact size here once decided during implementation).
3. Use real fixture content (`backend/verification/large-book.docx` primary, `typography-test.docx` for the validation-findings screenshot) — never a fabricated or edited manuscript.
4. Save as PNG, named exactly as the table above, directly in this directory.
5. Do not retouch, crop out real content, or stage a state the product can't actually reach through the documented Demo Script.

## Related

- `docs/product/PRODUCT_DEMO.md` — the Demo Script these screenshots are captured from
- `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` §6 commit 11 — where this capture happens in the sprint's own commit plan
