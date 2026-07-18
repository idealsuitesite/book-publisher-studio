# Feature Matrix

What exists, what's real-file-verified, and what's planned — pulled directly from `docs/VERSIONS.md`/`docs/CURRENT_STATE.md`, not re-derived or guessed. Regenerate this table's status column from those two files if it ever drifts; they remain the source of truth.

| Feature | Status | Since | Notes |
|---|---|---|---|
| DOCX import → structured `Book` model | ✅ Shipped | v0.2.0-alpha | `MammothParser` → `HtmlNormalizer` → `ASTBuilder` |
| Structural validation (title/author/empty-book/empty-chapter) | ✅ Shipped | v0.2.0-alpha | `BookValidator`, now `StructuralRule`'s internal implementation |
| DOCX export | ✅ Shipped | v0.3.0-alpha | `DOCXRenderer`, themed |
| PDF export | ✅ Shipped | v0.4.0-alpha | `PDFRenderer` (PDFKit), real font embedding since v0.5.0-alpha |
| EPUB export | ✅ Shipped | v0.4.1-alpha | `EPUBRenderer` (`epub-gen-memory`) |
| Inline formatting (bold/italic/underline/strikethrough/links/small-caps) | ✅ Shipped | v0.5.0-alpha | `TypographyResolver`, all 3 renderers |
| Drop caps, smart quotes (English), widow/orphan keep-with-next | ✅ Shipped | v0.5.0-alpha | `TypographyResolver` |
| Full validation engine (metadata, heading hierarchy, typography, images, hyperlinks, KDP/EPUB readiness) | ✅ Shipped | v0.6.0-alpha | `ValidationEngine`, 8 rules, `QualityScore` |
| A4/A5/KDP trim-size presets | ✅ Shipped | v0.7.0-alpha | Real published specs, ADR-0030 |
| Selectable page layout per export | ✅ Shipped | v0.7.0-alpha | `LayoutSelector`/`ManualLayoutSelector` |
| Real running head (book/chapter title, not a placeholder) | ✅ Shipped | v0.7.0-alpha | `RunningHead`, PDF + DOCX |
| Chapter opening-page control (force right/left start) | ✅ Shipped | v0.7.0-alpha | `Chapter.openingPageStyle` — not reachable via real DOCX upload yet (`docs/REAL_FIXTURE_POLICY.md`) |
| Chapter page-number reset | ✅ Shipped | v0.7.0-alpha | `Chapter.startPageNumber` — same import-reachability caveat |
| Automatic Table of Contents generation | ✅ Shipped | v0.7.0-alpha | Real `Chapter`/`Section` hierarchy, ADR-0032 — same import-reachability caveat |
| **A visible user interface** | 🔨 In progress | Sprint 7 (proposed `v0.8.0-alpha`) | Everything above exists only behind `curl`/Postman today — this is the gap Sprint 7 closes |
| Live/instant format preview (no re-export) | 📋 Planned, not scoped | — | Deliberately deferred past Sprint 7 (Design Review Decision 1) — needs new backend caching + a fast preview renderer |
| In-app editing / correction of validation findings | 📋 Planned, not scoped | — | `docs/VISION.md`'s Editorial AI Engine — depends on Validation Engine's output (already shipped) |
| One-click KDP/Kobo/Apple Books/Google Play Books publishing | 📋 Planned, not scoped | — | Publishing Engine, `PLATFORM_ARCHITECTURE_ROADMAP.md` §2.5 |
| AI-provider abstraction / third-party plugins | 📋 Planned, not scoped | — | Plugin System, narrowed scope per `PLATFORM_ARCHITECTURE_ROADMAP.md` §2.3 |
| Accounts, cloud sync, collaboration, licensing tiers | 📋 Explicitly deferred | — | Requires a persistence layer that doesn't exist; `docs/VISION.md`'s Product Stage Progression, post-MVP |
| Professional editorial fixture library (novels/technical/academic/magazine/bible/children/poetry/cookbook) | 📋 Deferred | — | `docs/TODO.md` Backlog — was blocked on Sprint 7's scope being fixed; now unblocked, still not started |

## Legend

- ✅ **Shipped** — merged, tagged, real-file-verified per `docs/REAL_FIXTURE_POLICY.md`
- 🔨 **In progress** — Design Review approved, implementation not yet started or underway
- 📋 **Planned, not scoped** — named in `docs/VISION.md`/`docs/TODO.md`/`PLATFORM_ARCHITECTURE_ROADMAP.md`, no Design Review yet
- 📋 **Explicitly deferred** — intentionally out of scope for the current product stage (MVP), not forgotten

## Related

- `docs/VERSIONS.md` — the authoritative version-to-milestone record this table is derived from
- `docs/CURRENT_STATE.md` — sprint-by-sprint detail behind each "Shipped" row
- `docs/product/USER_JOURNEYS.md` — which journeys each feature actually enables
- `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` — the Level 1 map behind every "Planned, not scoped" row
