# Personas

Grounded in `docs/VISION.md`'s own stated audience ("authors, publishers, educators, universities, and independent creators... global, not tied to any single audience, language, or region") — these are not invented fresh, they're the same audience VISION.md has named since before any sprint numbering existed, made concrete enough to check a feature or a demo scenario against.

## 1. The Independent Author

Writes and self-publishes their own book, typically to Amazon KDP, sometimes to Kobo/Apple Books/Google Play Books too. Works alone or with a freelance editor. Cares about: getting a manuscript from Word into a correctly-sized, correctly-formatted print-ready PDF and a clean EPUB without hiring a formatter or fighting Word's own page layout. Sensitive to trim-size correctness (a wrong physical size is a real printing defect, not a cosmetic one) and to whether "Page 1" lands on the right side of a spread for a print run. Today's Sprint 6 work (KDP trim sizes, `openingPageStyle`) exists specifically for this persona; Sprint 7 is the first time this persona could plausibly use the product without reading source code.

## 2. The Small Press / Independent Publisher

Handles multiple authors' manuscripts, needs consistent house formatting across titles, and cares about validation (does this manuscript have a title, an author, no empty chapters, no broken structure) before it goes anywhere near a printer or a distributor. This persona is the primary audience for `ValidationEngine`'s findings (Sprint 5) and for exporting the same manuscript to more than one trim size without redoing layout work by hand. Less tolerant than the Independent Author of a tool that silently drops content or formatting (see ADR-0025/0026's real-world stakes) — correctness matters more than polish to this persona specifically.

## 3. The Educator / Institution

Produces course materials, manuals, or academic texts — often with heavier structural demands (tables, footnotes, a real Table of Contents, sometimes multi-part documents) than a novel. This persona is the reason `docs/TODO.md`'s Backlog names technical/academic fixtures explicitly (tables, footnotes) and is the natural first audience once a heavier fixture category (`large-book.docx`-style manuscripts, or eventually a dedicated `fixtures/academic/` set — see `docs/TODO.md`'s deferred fixture-library idea) gets built out. Automatic Table of Contents generation (Sprint 6) exists specifically for this persona's document shape.

## What these personas are not (yet)

None of the three personas above are collaborating with co-authors in real time, managing licenses/subscriptions, or working through a cloud-synced account — `docs/VISION.md`'s own Product Stage Progression explicitly defers all of that past MVP. A persona for those needs (an Enterprise-tier team, a licensing administrator) is real but not relevant until a persistence layer exists — not invented here ahead of that.

## Related

- `docs/VISION.md` — the source these personas are grounded in, not diverged from
- `docs/product/USER_JOURNEYS.md` — each persona's concrete path through the product
- `docs/product/FEATURE_MATRIX.md` — which features exist today for which persona
