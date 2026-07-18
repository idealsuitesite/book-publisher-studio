# Product Acceptance

This document does not talk about code. It states, from the user's point of view only, what success looks like for Sprint 7 — the product-level companion to `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md`'s technical acceptance criteria (that document's §7 is written to satisfy this one, not the other way around).

## The user must be able to

- ✓ **Import** — bring their own real manuscript into the product, without help, without an error they can't understand
- ✓ **Read** — see what their manuscript actually contains: its chapters, its length, its structure — accurately, not approximately
- ✓ **Understand** — know whether anything is wrong with their manuscript before they commit to an export, in plain language, not a stack trace
- ✓ **Change** — pick a different page format and see that choice actually reflected in the result, not just accepted silently
- ✓ **Export** — walk away with a real file, in the format they asked for, that opens correctly and looks correct

## What "done" means for each

- **Import is done** when a real `.docx` from `backend/verification/` (or any structurally similar manuscript) can be dragged into the product and its structure appears within a few seconds, with no unhandled error state.
- **Read is done** when the chapter list, word count, and page/reading-time estimates shown match what the manuscript actually contains — not placeholder or stale data.
- **Understand is done** when a manuscript with a real, known issue (e.g. `typography-test.docx`'s missing-ISBN warning, already confirmed real in Sprint 5) shows that issue in the product, in the same words `ValidationEngine` already produces, not swallowed or generic.
- **Change is done** when picking a different trim size and re-previewing produces a visibly different result — the same real difference Sprint 6 already proved at the API level (a KDP 6×9 export is a different physical size than a Letter export, inspected, not assumed).
- **Export is done** when the resulting PDF, DOCX, and EPUB files are real, complete, and open without error in a normal PDF viewer, Word, and an EPUB reader respectively — not just "the request returned 200."

## What this document is not

Not a technical checklist (see `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` §7 for that), not a full UX specification (see `docs/product/WIREFRAMES.md`), not a claim that Sprint 7 delivers `docs/VISION.md`'s complete UI/UX ambition (see `docs/product/FEATURE_MATRIX.md` for what's deferred). It is the single question every Sprint 7 commit should be checkable against: **does this still let the user import, read, understand, change, and export?**

## Related

- `docs/product/PRODUCT_DEMO.md` — the concrete Demo Script this acceptance statement is verified against
- `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` — the technical Design Review this document sits above
- ADR-0032 — the Engineering Governance Principle (Code/Product/Documentation); this document is the user-facing half of "Product"
