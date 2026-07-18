# Premium UI/UX — Design Review (Proposed Sprint 7)

**Status:** DRAFT — round 1, awaiting CTO review. Not approved. No branch, no code until this closes.
**Date:** 2026-07-18
**Scope:** The proposed Sprint 7 pivot recorded in `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` §4a — the project's first interactive, demonstrable milestone. Corresponds to `docs/VERSIONS.md`'s `v0.8.0-alpha` "Premium UI/UX" entry, proposed to move ahead of Plugin System/Editorial AI Engine/Publishing Engine, pending this review's approval.

---

## 1. Objectives

Per the CTO's own framing (2026-07-17): every engine a demo would need already exists and is real-file-verified — import, theme/typography/layout, PDF/DOCX/EPUB export, layout selection (A4/A5/KDP trim sizes). The gap is visibility, not capability. By the end of this sprint, the CTO should be able to:

1. Launch Book Publisher Studio
2. Import a real DOCX manuscript
3. See the book's structure (chapters, sections, metadata, validation findings)
4. Change the export format (A4, A5, KDP 6×9, …) via `LayoutSelector`
5. Preview the result
6. Export to PDF, DOCX, or EPUB

`docs/VISION.md`'s existing "UI/UX Direction" section (written before any sprint numbering existed) names a fuller ambition — drag-and-drop import, live preview, instant formatting feedback, real-time word/page count, chapter navigation, theme switching, split editor view, print preview, dark/light mode, Atticus/Notion/Linear/Figma-quality interface. This review scopes what's achievable against **today's actual backend API** (§2) as Sprint 7, and explicitly separates it from VISION.md's longer-term ambition where the two diverge (§3, Decision 3).

---

## 2. Current State — Evidence, Not Assumptions

Read directly from `backend/src/presentation/`, `backend/src/application/dto/`, and `frontend/` before writing this review, matching this project's own discipline (ADR-0019/0020/0031's precedent):

| Concern | Current state |
|---|---|
| Backend routes | Exactly two: `POST /api/manuscripts/import` (multipart DOCX → `{ book: BookDTO, report: ImportReportDTO }`) and `POST /api/manuscripts/export` (multipart DOCX + `theme`/`format`/`layout` fields → raw file bytes with a `Content-Type`/`Content-Disposition` header). No other routes exist. |
| Persistence | **None.** Every request is fully stateless — buffer in, buffer/DTO out. Nothing remembers an uploaded manuscript between requests. A "change format, see new preview" interaction must either resend the original file bytes on every request, or the backend needs new short-lived session state (see §3 Decision 2). |
| Live preview | **Does not exist.** There is no endpoint that renders a fast, partial, or HTML preview. The only way to see formatted output today is a full `POST /api/manuscripts/export` round trip (parse → theme → typography → layout → render) returning complete PDF/DOCX/EPUB bytes. |
| Theme/layout discovery | **Hardcoded on both sides.** `getTheme()` only recognizes `'classic'`; `ManualLayoutSelector`'s registry only recognizes `letter`/`a4`/`a5`/`kdp-5x8`/`kdp-5.5x8.5`/`kdp-6x9`. No endpoint lets a client discover these names or their human-readable labels — a frontend would have to hardcode the same list, duplicated from `backend/src/domain/services/ManualLayoutSelector.ts` and `backend/src/domain/themes/getTheme.ts`. |
| CORS | Wide open (`app.use(cors())`, no origin restriction) — fine for local dev/demo, not evaluated for anything beyond that here. |
| Frontend scaffold | **Already exists**, git-tracked, untouched `create-next-app` output: Next.js `16.2.10` (App Router, Turbopack default), React `19.2.4`, TypeScript `5.x`, Tailwind CSS `4.x`, ESLint 9 flat config. `frontend/app/page.tsx` is still the default starter page; no Book Publisher Studio-specific code exists yet. `frontend/AGENTS.md` warns this Next.js version has real API/convention differences from most training data — verified directly against `frontend/node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` for this review (Async Request APIs are fully async with no sync fallback; `middleware.ts` is renamed `proxy.ts`; caching APIs changed) rather than assumed. |
| `shared/` directory | Exists at the repo root, empty, not git-tracked (no files inside it are committed). A plausible location for TypeScript types shared between `backend/` and `frontend/` (see §3 Decision 4), currently unused. |
| Node/browser requirements (Next 16) | Node.js ≥20.9.0, TypeScript ≥5.1.0, Chrome/Edge 111+, Firefox 111+, Safari 16.4+ — all compatible with this project's existing backend toolchain (already on a recent Node/TypeScript). |

---

## 3. Open Questions — Confirmed, Not Resolved by This Draft

Matching ADR-0019/0020/0029/0030's precedent: these need a real CTO decision, not a guess.

**Decision 1 — What does "preview" mean for Sprint 7?**
- **Option A (minimal, uses only what exists today):** "Preview" = trigger a real `POST /api/manuscripts/export?format=pdf` and render the returned PDF bytes in an embedded viewer (`<iframe>`/`<object>` with a blob URL, or a client-side PDF.js viewer). Every format/theme change re-triggers a full export round trip. Simple, zero new backend work, but not "instant" — a real DOCX export of `large-book.docx` takes a perceptible amount of time (parse + render), and there is no partial/incremental update.
- **Option B (matches VISION.md's fuller ambition):** A genuinely fast, incremental preview — would require new backend capability (at minimum, caching the parsed `Book`/`StyledBook` so a format change doesn't re-run `MammothParser`/`ASTBuilder` from scratch, and likely a lightweight HTML preview renderer distinct from the PDF/DOCX/EPUB renderers, since none of those are fast enough or HTML-native for live re-render on every keystroke/toggle). This is real, unscoped backend work beyond "build a UI on what exists."
- **This review's recommendation:** Option A for Sprint 7 — it satisfies the CTO's own stated 6-step goal (§1) without inventing new backend scope, and is honest about not yet being VISION.md's "live preview, instant formatting feedback." Option B, if wanted, is its own future Design Review with its own backend commits, not folded into "build the UI."

**Decision 2 — How does the frontend re-supply the manuscript across requests, given the backend is stateless?**
- **Option A:** Keep the originally-uploaded `File` object in browser memory (React state) for the session; every subsequent export request re-sends it as part of a new multipart request alongside the newly-chosen `theme`/`format`/`layout`. No backend change needed. Lost on page refresh — acceptable for a demo, not for a real product.
- **Option B:** A new, minimal backend session endpoint (`POST /api/manuscripts/session` → an opaque id, holding the uploaded buffer server-side for some TTL) so subsequent requests can reference the id instead of re-uploading. Real new backend surface, first departure from "fully stateless."
- **This review's recommendation:** Option A for Sprint 7 — no backend change, and the interaction (re-send the file client-side) is invisible to the end user regardless of which option is chosen.

**Decision 3 — How much of `docs/VISION.md`'s "UI/UX Direction" ships in Sprint 7 vs. later?**
The CTO's own 6-step goal (§1) is narrower than VISION.md's full list (drag-and-drop, live preview, real-time word/page/reading-time counters, chapter navigation, theme switching, split editor view, print preview, dark/light mode). This review's recommendation: Sprint 7 ships drag-and-drop import, structure view, format/layout switching, preview-via-export (Decision 1 Option A), and PDF/DOCX/EPUB export — the CTO's literal 6 steps. Real-time word/page/reading-time counters are already computed server-side (`BookDTO.wordCount`/`.pageCount`/`.readingTime` from `ImportResponseDTO`) and can be displayed for free without new work, so are included. Dark/light mode, a full split-editor view, and print preview beyond "view the exported PDF" are deferred to a later UI sprint unless the CTO wants them pulled in now.

**Decision 4 — Do frontend and backend share TypeScript types, or does the frontend define its own?**
- **Option A:** Frontend hand-writes its own TypeScript interfaces matching `BookDTO`/`ImportReportDTO`/etc. Zero coupling between the two `package.json`s/build systems, but the shapes can silently drift (a `backend/` DTO change wouldn't be caught by the frontend's compiler).
- **Option B:** Move (or re-export) the DTO interfaces into `shared/`, imported by both `backend/` and `frontend/` (would need `shared/` to become a real workspace package — npm/pnpm workspaces, or a simple path-based TypeScript project reference). Real build-tooling work, not just a code change.
- **This review's recommendation:** Option A for Sprint 7 (lower setup cost, and the DTOs involved — `BookDTO`, `ImportReportDTO`, `ValidationIssueDTO`, `QualityScoreDTO` — are all small and stable), with `shared/` revisited once a second consumer of the same types exists or drift actually causes a real bug (matching this project's own "don't build for a hypothetical," ADR-driven-by-evidence discipline).

**Decision 5 — Theme/layout discovery: hardcode in the frontend, or add a backend endpoint?**
- **Option A:** Frontend hardcodes the known theme (`classic`) and layout names (`letter`/`a4`/`a5`/`kdp-5x8`/`kdp-5.5x8.5`/`kdp-6x9`) with human-readable labels, matching what `ManualLayoutSelector`/`getTheme()` already accept. Breaks silently (a 400 from the backend) if the backend's registry changes without the frontend being updated in lockstep.
- **Option B:** A new `GET /api/manuscripts/options` (or similar) endpoint returning the live registry contents (names + labels) — real new backend surface, but removes the duplication and the silent-drift risk.
- **This review's recommendation:** Option B — small, low-risk backend addition (a thin read of `ManualLayoutSelector`'s/`getTheme()`'s own registries, no new business logic), and removes a real, easy-to-forget duplication point between two codebases that don't share types (per Decision 4 Option A). Flagged as its own small commit in §6.

---

## 4. Architecture Impact

```
frontend/ (Next.js 16, App Router)
  app/
    page.tsx                — landing / upload
    manuscript/
      [uploaded-in-memory]/
        structure/page.tsx  — chapters/sections tree, metadata, validation issues
        format/page.tsx     — theme + layout selection (or a single-page flow, see §6)
        preview/page.tsx    — embedded PDF preview (Decision 1, Option A)
  components/
    UploadDropzone
    BookStructureView
    FormatSelector
    ExportPreview
    ValidationSummary
  lib/
    api-client.ts            — thin fetch wrapper around the 2 existing routes + the new
                                 options route (Decision 5)
    types.ts                  — hand-written DTO-matching interfaces (Decision 4, Option A)

backend/ (unchanged except Decision 5's new route, additive)
  presentation/
    routes/
      manuscripts.ts          — existing, +GET /options (new, Decision 5)
      export.ts                — unchanged
```

No changes to `backend/src/domain/`, `application/`, or `infrastructure/` beyond the new `GET /api/manuscripts/options` route (Decision 5) — this sprint is additive to Presentation only, consuming the Domain/Application layers exactly as they already work. This matches ADR-0012's precedent (a new consumer of an existing pipeline needs no new pipeline).

**Data flow for the CTO's 6-step goal:**
```
1. Launch          → next dev (frontend) + npm run dev (backend), 2 processes
2. Import           → drag-drop → POST /api/manuscripts/import → BookDTO + ImportReportDTO in React state
3. See structure     → render BookDTO.mainContent tree + ImportReportDTO.issues/score
4. Change format      → GET /api/manuscripts/options (once, Decision 5) populates a selector;
                         selection stored in React state, no request yet
5. Preview            → POST /api/manuscripts/export (format=pdf, chosen theme/layout,
                         re-sending the original file per Decision 2) → blob URL → <iframe>
6. Export              → same request, different format, saved via a real browser download
                         (the same blob, or a fresh request for docx/epub)
```

---

## 5. Risks

1. **Next.js 16 is genuinely unfamiliar territory for this project and for typical AI-assistant training data** (`frontend/AGENTS.md`'s own warning, confirmed real by reading the installed version-16 upgrade doc for this review). Implementation should re-check `frontend/node_modules/next/dist/docs/` against any App Router pattern before writing it, matching the same "confirmed, not guessed" discipline this project applies to its own domain code (ADR-0031/0032's lesson generalized to a dependency, not just internal code).
2. **"Preview" (Decision 1) undershoots VISION.md's stated ambition if Option A ships.** A future session or the CTO could reasonably expect "live preview" to mean something faster/more interactive than "re-run a full export and embed the PDF." This review recommends disclosing that gap explicitly in the Sprint 7 Final Report, not letting the word "preview" imply more than what ships (matching ADR-0031/ADR-0032's "disclosed, not hidden" precedent for scope decisions).
3. **No auth, no rate limiting, wide-open CORS** — acceptable for a local/demo-only Sprint 7 (per VISION.md's own MVP-stage framing: "No accounts, no payments, no cloud"), but this review does not evaluate what changes before this is ever exposed outside a local machine. Explicitly out of scope here, not silently assumed safe forever.
4. **Re-sending the full original file on every format change (Decision 2, Option A)** means a large manuscript re-triggers a full parse on every preview — acceptable for a demo with `backend/verification/`-sized fixtures, a real UX problem for a much larger real manuscript. Named, not solved, here.
5. **`GET /api/manuscripts/options` (Decision 5) is new backend surface added specifically to serve the frontend** — small, but worth flagging that "UI work" isn't strictly presentation-only once discoverability is involved; this is why it's called out as its own commit in §6, not folded silently into frontend work.

---

## 6. Commit Plan (draft — subject to CTO revision before approval)

1. `chore(frontend): confirm frontend/ scaffold builds and runs (npm install, npm run dev, npm run build) against the current Next.js 16 toolchain` — verification-first, matching this project's spike-before-build discipline; no Book Publisher Studio code yet.
2. `feat(backend): GET /api/manuscripts/options` — Decision 5, additive, no Domain/Application change, own tests.
3. `feat(frontend): API client + hand-written DTO types` (Decision 4, Option A) — `lib/api-client.ts`, `lib/types.ts`, no UI yet.
4. `feat(frontend): upload flow` — drag-and-drop, `POST /api/manuscripts/import`, loading/error states.
5. `feat(frontend): book structure view` — render `BookDTO.mainContent`, metadata, word/page/reading-time counters (free, already in the DTO).
6. `feat(frontend): validation summary` — render `ImportReportDTO.issues`/`.score`.
7. `feat(frontend): format/layout selector` — populated from commit 2's new endpoint.
8. `feat(frontend): export + preview` — `POST /api/manuscripts/export`, blob URL, embedded PDF preview (Decision 1, Option A), real download for all 3 formats.
9. Real-file verification pass — the CTO's own 6 steps, run end to end against `backend/verification/typography-test.docx` and `large-book.docx`, through the actual running UI, not just each piece in isolation (`docs/REAL_FIXTURE_POLICY.md` applies here too: a UI is exactly the kind of change that should be checked against real content, not just component-level tests).
10. Docs/ADR reconciliation, Sprint 7 Final Report.

---

## 7. Acceptance Criteria

- `npm run dev` in `frontend/` and `npm run dev` in `backend/` both start cleanly; the frontend successfully calls the backend across the two processes (CORS confirmed working, not assumed).
- A real DOCX from `backend/verification/` can be dragged in, its structure (chapters/sections/metadata) is visibly rendered, and any real validation warnings (`ImportReportDTO.issues`) are visibly shown — not swallowed.
- Selecting a different layout (e.g. KDP 6×9) and re-previewing shows a visibly different-sized PDF, matching Sprint 6's own real, inspected `/MediaBox` behavior.
- All 3 export formats (PDF/DOCX/EPUB) are downloadable from the UI and open without error.
- No backend Domain/Application code changed except the new, additive `GET /api/manuscripts/options` route.
- `docs/QUALITY_GATE.md`'s Code/Product/Documentation levels all pass, including a frontend-appropriate interpretation of "Product" (the CTO's own 6 steps actually exercised end to end, not just backend `verify-real-export`).

---

## 8. Related

- `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` §4a — the proposal this review formalizes
- `docs/VISION.md` — "UI/UX Direction" §, the fuller ambition this review deliberately scopes down from (Decision 3)
- `docs/VERSIONS.md` — `v0.8.0-alpha` "Premium UI/UX," pending this review's approval to become Sprint 7
- `docs/DESIGN_REVIEW_PROCESS.md` — the process this document follows
- `docs/REAL_FIXTURE_POLICY.md` — applies to this sprint's own verification pass (§6 commit 9)
- ADR-0032 — the Engineering Governance Principle (Code/Product/Documentation) this sprint's Definition of Done is checked against
- `backend/src/application/dto/ImportResponseDTO.ts`, `ImportReportDTO.ts`, `BookDTO.ts` — the real API shapes this review is built from
- `frontend/node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` — the Next.js 16 evidence behind Risk 1
