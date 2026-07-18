# Demo Screenshots

Real captures from `docs/product/PRODUCT_DEMO.md`'s Demo Script, taken once Sprint 7 is implemented and run against a real manuscript (`backend/verification/large-book.docx`, the Demo Script's own fixture). **No files exist in this directory yet** — this README documents the expected set and naming convention so implementation knows exactly what to capture, and so nobody adds placeholder or fabricated images in the meantime. These screenshots become source material for GitHub's own README, this project's documentation, a future product website, and anything shown to investors/partners/authors/editors — they must be real captures of the real running product, never mocked.

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
