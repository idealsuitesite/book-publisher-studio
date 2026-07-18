# Verification Fixtures

Permanent, canonical `.docx` inputs for real-export verification (`docs/REAL_EXPORT_CHECKLIST.md`, `docs/DEVELOPMENT_WORKFLOW.md`'s "Which fixture to use"). Not automated-test fixtures — those live under `src/test-utils/` and are covered by `npm test`. These exist so every session verifies real rendering output against the exact same known documents, instead of searching `backend/uploads/` for whatever happens to be there or generating a throwaway file each time.

| File | Purpose |
|---|---|
| `typography-test.docx` | **Default fixture for most real-export checks.** Headings, a nested section, bold/italic/underline/strikethrough runs (including a combined bold+italic run), straight quotes/apostrophes (smart-quote verification), bullet items, and a long paragraph (pagination/drop-cap sanity). |
| `large-book.docx` | 15 chapters × 20 paragraphs — pagination and performance verification on a genuinely large document. |
| `images.docx` | Two embedded images (real PNG bytes, not placeholders) at different sizes. |
| `tables.docx` | Two tables of different sizes (2 and 4 columns). |

All four verified to round-trip correctly through the real import pipeline (`MammothParser` → `HtmlNormalizer` → `ASTBuilder`) before being committed — confirmed chapter/section structure, inline bold/italic detection, image count, and table count all match what each fixture is meant to exercise.

## Regenerating

Not run automatically. Only regenerate a fixture if its content genuinely needs to change, and note why in the commit message:

```bash
npx tsx verification/generate-fixtures.ts
```

See `generate-fixtures.ts` for exactly what each file contains.
