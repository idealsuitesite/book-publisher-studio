# Sprint 7 — First Demonstrable Product — Design Review

**Status:** ✅ APPROVED (round 2, 2026-07-18) — all 5 open decisions resolved by explicit CTO direction. Ready for implementation once the CTO gives final go-ahead to branch (same gate used for every prior sprint).
**Date:** 2026-07-18 (round 1: 2026-07-18, evidence gathering + 5 open decisions raised; round 2, same day: all 5 resolved)
**Scope:** The proposed Sprint 7 pivot recorded in `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` §4a — the project's first interactive, demonstrable milestone. Corresponds to `docs/VERSIONS.md`'s `v0.8.0-alpha` entry, proposed to move ahead of Plugin System/Editorial AI Engine/Publishing Engine.

**Renamed from "Premium UI/UX" (CTO direction, round 2):** the objective is not primarily visual polish — it is making six sprints of already-built, already-verified backend capability visible and usable for the first time. "Premium UI/UX" undersold that; "First Demonstrable Product" states it directly. `docs/VERSIONS.md`'s `v0.8.0-alpha` row title updates to match once this review's implementation is scheduled.

**Decision Index (CTO direction, 2026-07-18, added after Commit 1):** the 5 locked decisions in §3 below are formally numbered, referenced from here on by number + name (e.g. "Decision 4 was revised") instead of re-quoting a paragraph. The numbers are the same ones §3 already used since round 2 — this index doesn't renumber anything, it names what was already numbered so future Sprint Reports/ADRs can cite it tersely.

| ID | Name | One-line summary |
|---|---|---|
| Decision 1 | Preview Strategy | "Preview" = a full `POST /api/manuscripts/export` re-export, not a new incremental renderer |
| Decision 2 | Stateless Backend | No session, no server-side manuscript cache — every UI action is its own complete round trip |
| Decision 3 | Demo-Minimal Scope | Sprint 7 ships only what the first demonstrable product needs, not `docs/VISION.md`'s full UI ambition |
| Decision 4 | Shared-Types Workspace | `packages/shared-types` — the project's first monorepo/npm-workspace structural change (implemented, ADR-0033) |
| Decision 5 | Options Discovery Endpoint | `GET /api/manuscripts/options`, additive-friendly response shape for future themes/layouts/plugins |

---

## 1. Objectives

Per the CTO's own framing (2026-07-17, reaffirmed 2026-07-18): every engine a demo would need already exists and is real-file-verified — import, theme/typography/layout, PDF/DOCX/EPUB export, layout selection (A4/A5/KDP trim sizes). The gap is visibility, not capability. By the end of this sprint, the CTO should be able to:

1. Launch Book Publisher Studio
2. Import a real DOCX manuscript
3. See the book's structure (chapters, sections, metadata, validation findings)
4. Change the export format (A4, A5, KDP 6×9, …) via `LayoutSelector`
5. Preview the result
6. Export to PDF, DOCX, or EPUB

**Locked (round 2, Decision 3): only what the demo needs, nothing more.** `docs/VISION.md`'s "UI/UX Direction" section names a fuller ambition (live preview, real-time counters, chapter navigation, theme switching, split editor view, print preview, dark/light mode, Atticus/Notion/Linear/Figma-quality interface) — Sprint 7 is explicitly **not** an attempt to build that final application. It builds the first demonstrable product: the narrowest real, working, presentable slice. Everything else in VISION.md's list is deliberately deferred, not silently dropped — see `docs/product/FEATURE_MATRIX.md` for what ships now vs. later.

The user-facing, non-technical version of this objective (what the *user* must be able to do, not what code must exist) is recorded separately in `docs/product/PRODUCT_ACCEPTANCE.md` — that document is the product-level Definition of Done this Design Review's own §7 is written to satisfy.

---

## 2. Current State — Evidence, Not Assumptions

Read directly from `backend/src/presentation/`, `backend/src/application/dto/`, and `frontend/` before writing this review, matching this project's own discipline (ADR-0019/0020/0031's precedent):

| Concern | Current state |
|---|---|
| Backend routes | Exactly two: `POST /api/manuscripts/import` (multipart DOCX → `{ book: BookDTO, report: ImportReportDTO }`) and `POST /api/manuscripts/export` (multipart DOCX + `theme`/`format`/`layout` fields → raw file bytes with a `Content-Type`/`Content-Disposition` header). No other routes exist. |
| Persistence | **None.** Every request is fully stateless — buffer in, buffer/DTO out. Nothing remembers an uploaded manuscript between requests. |
| Live preview | **Does not exist.** There is no endpoint that renders a fast, partial, or HTML preview. The only way to see formatted output today is a full `POST /api/manuscripts/export` round trip (parse → theme → typography → layout → render) returning complete PDF/DOCX/EPUB bytes. |
| Theme/layout discovery | **Hardcoded on both sides.** `getTheme()` only recognizes `'classic'`; `ManualLayoutSelector`'s registry only recognizes `letter`/`a4`/`a5`/`kdp-5x8`/`kdp-5.5x8.5`/`kdp-6x9`. No endpoint lets a client discover these names or their human-readable labels. |
| CORS | Wide open (`app.use(cors())`, no origin restriction) — fine for local dev/demo, not evaluated for anything beyond that here. |
| Frontend scaffold | **Already exists**, git-tracked, untouched `create-next-app` output: Next.js `16.2.10` (App Router, Turbopack default), React `19.2.4`, TypeScript `5.x`, Tailwind CSS `4.x`, ESLint 9 flat config. `frontend/app/page.tsx` is still the default starter page; no Book Publisher Studio-specific code exists yet. `frontend/AGENTS.md` warns this Next.js version has real API/convention differences from most training data — verified directly against `frontend/node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` for this review (Async Request APIs are fully async with no sync fallback; `middleware.ts` is renamed `proxy.ts`; caching APIs changed) rather than assumed. |
| `shared/` directory | Exists at the repo root, empty, not git-tracked. Becomes real in this sprint (Decision 4, below). |
| Node/browser requirements (Next 16) | Node.js ≥20.9.0, TypeScript ≥5.1.0, Chrome/Edge 111+, Firefox 111+, Safari 16.4+ — all compatible with this project's existing backend toolchain. |

---

## 3. Locked Decisions (round 2 — CTO direction, 2026-07-18)

Matching ADR-0019/0020/0029/0030's precedent: recorded as locked, with the rejected alternative and why, not silently dropped.

**Decision 1 — "Preview" means a full re-export, not an incremental live preview.**
Trigger a real `POST /api/manuscripts/export?format=pdf` and render the returned PDF bytes in an embedded viewer (blob URL). **Rejected alternative:** a genuinely fast/incremental preview (would need new backend caching + a lightweight HTML preview renderer, real unscoped work). **Rationale (CTO, verbatim):** the rendering engine already exists, is already tested, is already reliable — reusing it minimizes risk. Instant preview is real, future work, not a Sprint 7 blocker.

**Decision 2 — The backend stays fully stateless. No session.**
Every UI action is its own complete round trip: `Import → Backend → Result`. The frontend re-sends the original file bytes on every export request (kept in browser memory for the session) — there is no server-side manuscript cache, no session id, no TTL to manage. **Rejected alternative:** a backend session endpoint holding the uploaded buffer server-side. **Rationale (CTO, verbatim):** much simpler, and the backend keeping no state is a real architectural property worth preserving deliberately, not just a shortcut.

**Decision 3 — Only what the first demonstrable product needs, not the final application.**
See §1. **Rationale (CTO, verbatim):** don't try to build the final app in Sprint 7 — build the first demonstrable product. Real-time word/page/reading-time counters ship anyway (already computed server-side, `BookDTO.wordCount`/`.pageCount`/`.readingTime`, free to display). Dark/light mode, a full split-editor view, and true live preview are explicitly deferred — tracked in `docs/product/FEATURE_MATRIX.md`, not lost.

**Decision 4 — A real shared-types package, not hand-duplicated types.**
`packages/shared-types` becomes a real, importable TypeScript package. The DTO shapes both `backend/` and `frontend/` need (`BookDTO`, `ImportReportDTO`, `ValidationIssueDTO`, `QualityScoreDTO`, the new options-endpoint response shape from Decision 5) live there as the single canonical source; both `backend/` and `frontend/` depend on it rather than either hand-maintaining a parallel copy. **Rejected alternative (this review's own round-1 recommendation):** frontend hand-writes its own matching interfaces. **Rationale (CTO, verbatim):** absolutely avoid duplication. **Mechanics (this review, not yet CTO-locked in detail — see §6 commit 1):** the repository becomes an npm workspace (root `package.json` gains `"workspaces": ["backend", "frontend", "packages/*"]`); `packages/shared-types` is a new workspace member with zero runtime dependencies (types only); `backend/src/application/dto/*.ts` re-export from (or are moved into) `packages/shared-types` so the backend's own compiler enforces the same contract it publishes — this backend-side wiring is itself a small, additive, low-risk change (ADR-0005's "DTOs are the boundary" principle is unaffected, only *where the type is declared* changes). This is the project's first monorepo-workspace structural change — real enough to warrant its own ADR once implemented (see §6 commit 1's own note).

**Decision 5 — A real discovery endpoint, deliberately shaped for extension.**
`GET /api/manuscripts/options` ships this sprint. **Rejected alternative:** hardcode theme/layout names in the frontend. **Rationale (CTO, verbatim):** even if today it would return something as simple as a flat list, tomorrow it needs to return plugins, themes, and templates without a frontend change — so the response shape is designed for that now, not left as a bare array that would need a breaking change later:
```ts
// packages/shared-types (Decision 4) — additive-friendly by construction:
// each category is its own named array; a future category (plugins, templates)
// is a new key, never a change to an existing one.
interface ManuscriptOptionsDTO {
  themes: Array<{ name: string; label: string }>;
  layouts: Array<{ name: string; label: string; category: 'standard' | 'kdp' }>;
}
```
This mirrors the additive-field discipline this project already applies everywhere else (`StyledBook.blockTypography?`, `PaginatedBook.pageLayout`/`.tableOfContents`, `Theme.runningHead` — ADR-0022/ADR-0027/ADR-0029's shared pattern), applied for the first time to an HTTP response shape instead of a Domain model.

---

## 4. Architecture Impact

```
book-publisher-studio/                (repo root — becomes an npm workspace, Decision 4)
  package.json                          — new: "workspaces": ["backend", "frontend", "packages/*"]
  packages/
    shared-types/                        — new workspace package, types only
      package.json
      src/
        BookDTO.ts, ImportReportDTO.ts, ManuscriptOptionsDTO.ts, ...
  backend/                                — depends on packages/shared-types
    src/application/dto/*.ts               — re-export from (or moved into) shared-types
    src/presentation/routes/
      manuscripts.ts                        — existing, +GET /options (Decision 5)
      export.ts                              — unchanged
  frontend/ (Next.js 16, App Router)      — depends on packages/shared-types
    app/
      page.tsx                              — landing / upload
      manuscript/
        structure/page.tsx                   — chapters/sections tree, metadata, validation issues
        format/page.tsx                       — theme + layout selection (or a single-page flow, see §6)
        preview/page.tsx                       — embedded PDF preview (Decision 1)
    components/
      UploadDropzone, BookStructureView, FormatSelector, ExportPreview, ValidationSummary
    lib/
      api-client.ts                          — thin fetch wrapper, typed against packages/shared-types
```

No changes to `backend/src/domain/` or `application/` business logic — only the new, additive `GET /api/manuscripts/options` route (Decision 5) and where DTO types are declared (Decision 4). This sprint is additive to Presentation only, consuming the Domain/Application layers exactly as they already work (ADR-0012 precedent).

**Data flow for the CTO's 6-step goal:**
```
1. Launch    → next dev (frontend) + npm run dev (backend), 2 processes
2. Import     → drag-drop → POST /api/manuscripts/import → BookDTO + ImportReportDTO in React state
3. Structure   → render BookDTO.mainContent tree + ImportReportDTO.issues/score
4. Format       → GET /api/manuscripts/options (once) populates a selector; selection held in
                   React state, no request yet
5. Preview       → POST /api/manuscripts/export (format=pdf, chosen theme/layout, re-sending the
                   original file, Decision 2) → blob URL → embedded viewer
6. Export         → same request, different format, real browser download for all 3 formats
```

---

## 5. Risks

1. **Next.js 16 is genuinely unfamiliar territory** (`frontend/AGENTS.md`'s own warning, confirmed real against the installed version-16 upgrade doc). Implementation should re-check `frontend/node_modules/next/dist/docs/` against any App Router pattern before writing it — the same "confirmed, not guessed" discipline this project applies to its own Domain code, generalized to a dependency.
2. **This is the project's first monorepo-workspace change** (Decision 4) — a real, first-time structural risk distinct from anything in Sprints 1-6, which never touched root-level `package.json` or cross-package dependencies. Should be verified working (both `backend/` and `frontend/` still build/test/lint cleanly under the workspace) before any feature code depends on it — see §6 commit 1.
3. **"Preview" (Decision 1) undershoots VISION.md's fuller ambition by deliberate choice.** Disclose this explicitly in the Sprint 7 Final Report — don't let the word "preview" imply more than what ships (ADR-0031/ADR-0032's "disclosed, not hidden" precedent).
4. **No auth, no rate limiting, wide-open CORS** — acceptable for a local/demo-only Sprint 7 (VISION.md's own MVP-stage framing), not evaluated for anything beyond that here.
5. **Re-sending the full original file on every format change (Decision 2)** means a large manuscript re-triggers a full parse on every preview — acceptable for demo-sized fixtures, a real UX limit for a much larger real manuscript. Named, not solved.

---

## 6. Commit Plan

1. `chore: convert repo to an npm workspace; scaffold packages/shared-types` — Decision 4's mechanics. Verify `backend/` and `frontend/` both still build/lint/test cleanly under the new workspace structure before anything else. **Write a dedicated ADR for this commit** (the project's first monorepo change, ADR-0033 or next free number) — matching this project's own rule that a real structural decision earns a record, not just a commit message.
2. `feat(backend): GET /api/manuscripts/options` (Decision 5) — additive, no Domain/Application change, own tests, response typed against `packages/shared-types`.
3. `feat(backend): DTOs re-exported from packages/shared-types` — no behavior change, verified via existing test suite staying green.
4. `feat(frontend): API client typed against packages/shared-types` — `lib/api-client.ts`, no UI yet.
5. `feat(frontend): upload flow` — drag-and-drop, `POST /api/manuscripts/import`, loading/error states.
6. `feat(frontend): book structure view` — render `BookDTO.mainContent`, metadata, word/page/reading-time counters.
7. `feat(frontend): validation summary` — render `ImportReportDTO.issues`/`.score`.
8. `feat(frontend): format/layout selector` — populated from commit 2's endpoint.
9. `feat(frontend): export + preview` — `POST /api/manuscripts/export`, blob URL, embedded PDF preview (Decision 1), real download for all 3 formats.
10. Real-file verification pass — the CTO's own 6 steps (`docs/product/PRODUCT_DEMO.md`'s Demo Script), run end to end against `backend/verification/typography-test.docx` and `large-book.docx`, through the actual running UI (`docs/REAL_FIXTURE_POLICY.md` applies to a UI too, not just backend renderers).
11. Screenshots captured per `docs/demo/screenshots/README.md`'s naming convention, for the Sprint 7 Final Report and `docs/product/PRODUCT_DEMO.md`.
12. Docs/ADR reconciliation, Sprint 7 Final Report, `docs/VERSIONS.md`'s `v0.8.0-alpha` row renamed to match §Title.

---

## 7. Acceptance Criteria

Technical (this review's own scope):
- `npm run dev` in `frontend/` and `npm run dev` in `backend/` both start cleanly under the new workspace structure; the frontend successfully calls the backend across the two processes (CORS confirmed working, not assumed).
- A real DOCX from `backend/verification/` can be dragged in, its structure (chapters/sections/metadata) is visibly rendered, and any real validation warnings (`ImportReportDTO.issues`) are visibly shown — not swallowed.
- Selecting a different layout (e.g. KDP 6×9) and re-previewing shows a visibly different-sized PDF, matching Sprint 6's own real, inspected `/MediaBox` behavior.
- All 3 export formats (PDF/DOCX/EPUB) are downloadable from the UI and open without error.
- No backend Domain/Application business logic changed — only the new, additive options route and DTO re-exports.
- `docs/QUALITY_GATE.md`'s Code/Product/Documentation levels all pass (ADR-0032's Engineering Governance Principle).

Product-level (non-technical — see `docs/product/PRODUCT_ACCEPTANCE.md` for the full statement): the user can import, read, understand, change, and export — every one of `docs/product/PRODUCT_DEMO.md`'s Demo Script steps completes without error, using real fixture content, and the resulting screenshots match `docs/demo/screenshots/README.md`'s expected set.

---

## 8. Related

- `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` §4a — the proposal this review formalizes
- `docs/VISION.md` — "UI/UX Direction" §, the fuller ambition this review deliberately scopes down from (Decision 3)
- `docs/VERSIONS.md` — `v0.8.0-alpha`, pending this sprint's implementation to rename and release
- `docs/DESIGN_REVIEW_PROCESS.md` — the process this document follows
- `docs/REAL_FIXTURE_POLICY.md` — applies to this sprint's own verification pass (§6 commit 10)
- ADR-0032 — the Engineering Governance Principle (Code/Product/Documentation) this sprint's Definition of Done is checked against
- `docs/product/PRODUCT_DEMO.md`, `PRODUCT_ACCEPTANCE.md`, `FEATURE_MATRIX.md`, `USER_JOURNEYS.md`, `PERSONAS.md`, `WIREFRAMES.md` — the product-level companions to this technical Design Review
- `docs/demo/screenshots/README.md` — the expected screenshot set this sprint's real-file verification pass produces
- `backend/src/application/dto/ImportResponseDTO.ts`, `ImportReportDTO.ts`, `BookDTO.ts` — the real API shapes this review is built from
- `frontend/node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` — the Next.js 16 evidence behind Risk 1
