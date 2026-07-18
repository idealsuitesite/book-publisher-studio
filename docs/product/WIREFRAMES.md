# Wireframes

Text/structural wireframes for Sprint 7's screens, matching this project's existing documentation style (ASCII pipeline diagrams throughout `docs/DECISIONS.md`/`docs/architecture/diagrams/*.md`) rather than pixel-perfect visual mockups — visual design detail belongs to implementation, not this Design Review companion. Each screen maps directly to `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` §4's component list and to one step of `docs/product/PRODUCT_DEMO.md`'s Demo Script.

## 1. Home / Upload (Demo Script step 2)

```
┌──────────────────────────────────────────────────────┐
│  Book Publisher Studio                                │
│                                                        │
│           ┌──────────────────────────────┐            │
│           │                                │            │
│           │   Drag a .docx here            │            │
│           │   or click to browse            │            │
│           │                                │            │
│           └──────────────────────────────┘            │
│                                                        │
│                                    [ Choose file ]     │
└──────────────────────────────────────────────────────┘
```
Empty state only. On drop/select: loading state while `POST /api/manuscripts/import` resolves, then navigates to Structure.

## 2. Structure View (Demo Script steps 3-4)

```
┌──────────────────────────────────────────────────────┐
│  ← Back           My Book Title                        │
│  ────────────────────────────────────────────────────  │
│  12,450 words · 48 pages · ~52 min read                │  ← BookDTO.wordCount/.pageCount/.readingTime
│  ────────────────────────────────────────────────────  │
│  ⚠ 2 warnings   ✓ Score 78/100          [see details]   │  ← ImportReportDTO.issues / .score
│  ────────────────────────────────────────────────────  │
│  Chapters                                                │
│    1. Introduction                                        │
│    2. Getting Started                                      │
│       2.1 Installation                                      │
│    3. Advanced Topics                                        │
│  ────────────────────────────────────────────────────      │
│  Format:  [ Letter ▾ ]   Theme: [ Classic ▾ ]     [ Preview ]│  ← GET /api/manuscripts/options
└──────────────────────────────────────────────────────┘
```
The chapter tree renders `BookDTO.mainContent` (Chapter/Section, nested). The warnings/score panel renders `ImportReportDTO.issues`/`.score` (Sprint 5). The format/theme selector is populated by `GET /api/manuscripts/options` (Design Review Decision 5), not hardcoded.

## 3. Validation Detail (expansion of the warnings panel above)

```
┌──────────────────────────────────────────────────────┐
│  ⚠ Validation findings                          [ × ]  │
│  ────────────────────────────────────────────────────  │
│  WARNING   Missing ISBN                                  │
│  WARNING   Missing cover image                            │
│  ────────────────────────────────────────────────────      │
│  Metadata     ▓▓▓▓▓▓░░░░  60/100                              │
│  Structure    ▓▓▓▓▓▓▓▓▓▓  100/100                              │
│  Typography   ▓▓▓▓▓▓▓▓▓▓  100/100                              │
└──────────────────────────────────────────────────────┘
```
Each finding is one `ValidationIssueDTO`; the per-category bars are `QualityScoreDTO`'s subscores (Sprint 5).

## 4. Preview (Demo Script steps 6-7)

```
┌──────────────────────────────────────────────────────┐
│  ← Back to structure        Format: KDP 6×9  Theme: Classic │
│  ────────────────────────────────────────────────────      │
│  ┌────────────────────────────────────┐                    │
│  │                                        │  ← embedded PDF   │
│  │         [ rendered PDF page ]           │     viewer,       │
│  │                                        │     blob URL       │
│  │                                        │     (Decision 1)   │
│  └────────────────────────────────────┘                    │
│                                                        │
│  [ Export PDF ]   [ Export DOCX ]   [ Export EPUB ]         │
└──────────────────────────────────────────────────────┘
```
Changing Format/Theme here re-triggers `POST /api/manuscripts/export` (Decision 1: full re-export, not incremental) and replaces the embedded preview. The three export buttons trigger the same endpoint with a different `format`, saved as a real browser download.

## 5. Export confirmation (Demo Script steps 7-9, transient)

```
┌──────────────────────────────────────────────────────┐
│  ✓ my-book.pdf downloaded                               │
└──────────────────────────────────────────────────────┘
```
A transient toast/notification per export — no dedicated page.

## Explicitly not wireframed (deferred, Design Review Decision 3)

Dark/light mode toggle, a split editor view, in-app correction of validation findings, account/login screens — none of these are Sprint 7 scope; see `docs/product/FEATURE_MATRIX.md` for their status.

## Related

- `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` §4 — the component/route structure these wireframes map to
- `docs/product/PRODUCT_DEMO.md` — the Demo Script each screen corresponds to a step of
- `docs/demo/screenshots/README.md` — real screenshots replace these wireframes once Sprint 7 ships
