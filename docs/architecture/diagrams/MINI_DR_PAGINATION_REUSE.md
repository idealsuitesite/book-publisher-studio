# Mini Design Review — Pagination reuse on a colour-only refresh (Option 2 of PERFORMANCE_SCOPE)

**Status:** ✅ CTO-APPROVED (2026-07-21) — **feu vert for commits**, four §7 questions locked (see below). Option 2 of `PERFORMANCE_SCOPE.md`; Option 1 (parsed-font cache) was **closed on evidence** by `backend/spikes/pdfkit-font-cache-spike.ts`, and Option 3 (render micro-optimisation) stays out of scope (it touches the R2-locked renderer and needs its own targeted measurement).

**The four §7 questions, CTO-locked (2026-07-21):**
1. **Cache abstraction — port + one in-memory implementation.** Consistent with the DI discipline, and unlike the structure editor (one good implementation → concrete class), a future multi-process/distributed environment could legitimately want a second store (Redis) — the port keeps that door open at no cost today.
2. **LRU cap — 16.** Reasonable for low-concurrency alpha use; easy to raise later if real usage justifies it, no over-sizing now.
3. **Format omitted from the key — confirmed.** Geometry is shared by construction (one `LayoutEngine`), so a DOCX export may legitimately reuse PDF-path geometry.
4. **Build.** ~10%/refresh on a repeated drag-loop is a real perceptible gain for an author tuning their accent live, the build cost is modest and bounded, and the saving accumulates on exactly the gesture just made possible (live accent + immediate preview) — a multiplier on the experience just built. **The §5 invalidation tests are where the CTO wants the most attention at closure, the `pages[]` with/without-accent invariance test above all — it is the ultimate guarantee the §3 trap never recurs silently.**
**Date:** 2026-07-21
**Re-verified against current code** (non-negotiable #7), on `main` at `b0cfaf0`: the shared render tail (`ExportManuscriptUseCase.renderBook`), its project caller (`ExportProjectUseCase`), `ThemeEngine.applyTheme`, `PaginatedBook`/`Page`, `PDFRenderer`'s title colour, `ProjectService` (`updateSettings`/`replaceBook`/`updatedAt`), and the composition root (`app.ts`) were all read, not assumed. Two facts below **contradicted the naive design** and are the reason this review exists in this shape (§3).

---

## 0. The honest headline first (so approval is informed)

The Proof refresh stays **render-bound**. Measured on the real singleton wiring (`backend/spikes/performance-hotpath-probe.ts`, faith-alone, kdp-6x9): a refresh is **paginate ~50 ms + render ~380 ms ≈ 430 ms**, and **render is not cached** (it must redraw with the new colour). This review removes the **pagination** portion only: a cache *hit* rebuilds the cheap tail (~5 ms) + computes the key (~3.5 ms, measured) and skips paginate, so a refresh drops to **≈ 388 ms — about 42 ms (~10%) saved, not half.** The justification is **refresh frequency**, not single-shot size: the accent picker is a drag-to-tune control, and 42 ms × many drags is the real win (CTO decision, `PERFORMANCE_SCOPE.md` §5 revised weighing). If the CTO judges ~10% per-refresh insufficient to justify the machinery in §4, that is a legitimate reason to decline — the number is put here so the decision is made on it, not on the stale ~215 ms.

---

## 1. What changes

A per-process **pagination cache** on the project render path: the geometry a colour-only change cannot move (`Page[]` + generated `tableOfContents`) is computed once per (book-content, theme, layout) and reused across accent changes, which re-colour but never re-flow. **Backend-only, transparent** — the frontend already refetches the Proof on an accent change (`proofRefreshKey` includes `accentOverride`, MINI_DR_PER_THEME_ACCENT); this just serves that refetch faster. No new endpoint, no model geometry change, no parity re-lock (the cached geometry is *identical* to what paginate would recompute — §3).

## 2. Proposed decisions (for the CTO to lock)

1. **What is cached is geometry, not the styled book.** The cache value is `{ pages: Page[]; tableOfContents?: TOCEntry[] }` — both accent-invariant. It is **not** the `StyledBook`/`TypesetBook`, because that carries the accent colour (§3). On a hit, the fresh typeset (new accent) is paired with the cached geometry.
2. **The key excludes accent by construction, and is a content hash — because `updatedAt` cannot serve.** `Book` has no `updatedAt`; `Project.updatedAt` is bumped by `updateSettings` on **every** setting change *including accent* (`ProjectService.ts:128`), so it is unusable as a geometry key. And `project.book` is deserialised fresh from SQLite each request, so object identity (a `WeakMap`) does not survive the reload. The key is therefore **`md5(serialise(book)) : themeName : layoutName`** — stable across reloads, changed by any structure/content edit (a new book → new hash) or theme/layout change, and **independent of accent** (accent is a setting, not in `book`, and not added to the key). Measured cost: **~3.5 ms on the 530 KB faith-alone AST** (`JSON.stringify` 2.2 ms + md5 1.4 ms), well under the ~50 ms it saves.
3. **The key is an explicit allowlist, and completeness IS the R2 safety argument (CTO's chief ask).** Reuse is sound only while nothing outside `(book, themeName, layoutName)` moves geometry. Today accent is the only per-project override and it is proven colour-only (MINI_DR_PER_THEME_ACCENT). **A future geometry-affecting setting (e.g. a per-theme spacing override) MUST be added to the key**, and the tests in §5 fail loudly if the geometry ever diverges under a reused key. Named obligation, not a hope.
4. **Cache the project path only; the raw-bytes route is never cached.** `ExportManuscriptUseCase.execute` (one-shot uploads, no stable identity, no reuse benefit) passes no cache and is byte-for-byte unchanged. Only `ExportProjectUseCase` supplies it.

## 3. The load-bearing property — why reuse is sound, and the trap it avoids

**The trap (found by reading, not assumed):** the accent colour is baked into the `PaginatedBook` in **two** places — `ThemeEngine.applyTheme` writes `color: theme.colors.accent` into `blockStyles` (`ThemeEngine.ts:47`), and `PDFRenderer` reads `theme.colors.accent` for the title at draw time from the carried `styledBook.theme` (`PDFRenderer.ts:546`; `render()` takes only `{ language }`, no theme). **So reusing a cached `PaginatedBook` verbatim would render the OLD accent** — silently defeating the change we set out to accelerate.

**Why the design is sound anyway:** `Page[]` carries only block-ids, page assignment, line-splits, running-head titles and blank-page counts (`PaginatedBook.ts:5-36`) — **no colour**. It is a pure function of geometry-affecting inputs, which are *identical* between an accent-A and an accent-B typeset (accent moves no glyph width, line height or spacing — proven both ways in MINI_DR_PER_THEME_ACCENT). So on a hit we **rebuild the cheap colour-carrying tail fresh** (`resolveTheme(newAccent)` → `applyTheme` → `resolve`, ~5 ms) and pair that new typeset with the cached `pages`. The renderer then draws the cached geometry in the new colour — exactly the intended change, nothing stale. The cached geometry equals what `paginate` would recompute, so **no parity re-lock** (unlike any geometry change).

## 4. The plan (blast radius, all bounded — proposed, pending approval)

- **`PaginationCache` port + `InMemoryPaginationCache` (bounded LRU).** A small interface (`get(key): Geometry | undefined`, `set(key, geometry)`) so the Application layer depends on an abstraction, not an infrastructure concrete (the project's DI discipline); one in-memory implementation, size-capped (§7 Q2). Constructed once in `app.ts` (a server singleton, like the shared `PdfKitTextMeasurer`).
- **`renderBook` gains an optional `paginationCache?: PaginationCache` (6th param, after `accentOverride`).** Present → compute the key, `get` (hit: reuse geometry; miss: `paginate` then `set`). Absent → paginate as today (raw-bytes path, unchanged).
- **`ExportProjectUseCase`** builds the key (`serialise(project.book)` hashed, + `settings.themeName` + `settings.layoutName`) and passes the singleton cache in. Nothing else in its signature changes.
- **No frontend change.** The Proof already refetches on an accent change.

## 5. Verification plan — the cache-key invalidation tests are the explicit scope requirement (CTO)

The CTO's requirement, verbatim intent: *a test that proves a real change of structure, theme or layout invalidates the cache — not only a test that the accent case reuses it.* All four:

- **Reuse + recolour (the win, done safely):** render a project with accent A, then accent B (same book/theme/layout). Assert (a) the second render is a **cache hit** (spy/metric on the cache), (b) the output shows **accent B**, not A (title `fillColor` extracted from the PDF), (c) geometry **identical** (page count and `pages` deep-equal). Proves reuse never stales the colour.
- **Structure change INVALIDATES:** render → reorder a chapter through the real mutation route (`EditBookUseCase`, a new `book` → new hash) → render. Assert a **miss**, re-paginated, output reflects the new order.
- **Theme change INVALIDATES:** render with theme X → change `themeName` → render. Assert a **miss** (different geometry).
- **Layout change INVALIDATES:** render with layout A → change `layoutName` → render. Assert a **miss**.
- **Accent-geometry-invariance, at `pages[]` level (the precondition):** the same book paginates to **deep-equal `pages`** with and without an accent override — strengthening MINI_DR_PER_THEME_ACCENT's page-count check to the array the cache actually reuses. If a future change ever breaks this, this test fails loudly (the §2.3 obligation, enforced).
- **Raw-bytes path unchanged:** an `/api/manuscripts/export` render passes no cache and is byte-identical to today.
- **Live:** in the studio, drag the accent on faith-alone repeatedly → the Proof re-inks each time in the right colour; a structure edit still re-flows. (Screenshot may hang on the embedded PDF — fall back to the accessibility tree / network, as in prior chantiers.)

## 6. Risks (named, not hidden)

- **The prize is ~10%/refresh, not half** — the refresh stays render-bound (§0). Accepted on frequency grounds; named so approval is on the real number.
- **Key incompleteness = silent stale geometry (the R2 class).** If a geometry-affecting input is ever left out of the key, a reused `pages` would misrender without a parity test noticing — the exact drift RENDER_DRIFT closed. Mitigated by the explicit allowlist (§2.3), the invalidation tests (§5), and the pages-deep-equal invariance test that fails if accent (or anything reused-under-key) ever moves geometry.
- **Format-independence of the key (§7 Q3).** Geometry is shared across PDF/DOCX/EPUB by design (one `LayoutEngine`, PDF-metric pagination reused knowingly, `app.ts:60-64`), so the key omits format and a DOCX export could reuse PDF-derived `pages` — correct, but a decision to confirm.
- **Memory.** Content-hash keys accumulate across edits; bounded by the LRU cap (§7 Q2). A stale entry for an old book edit is never *served* (its hash never recurs) — it only occupies a slot until evicted.
- **Hash cost on very large books.** ~3.5 ms at 530 KB; grows with book size. Still far below the pagination it guards, but if a future book is an order of magnitude larger, re-measure (the key cost must stay << the paginate cost or the option loses its point).

## 7. Open questions for the CTO

1. **Cache abstraction — port + one in-memory impl (recommended, keeps Application depending on an abstraction, matches the DI discipline) or a plain concrete class (YAGNI, one impl today)?** I lean port-with-one-impl; the structure-editing chantier deliberately chose a concrete service for its case (Q1 there), so this is a genuine per-case call.
2. **LRU cap** — propose **16 entries** (a handful of active projects × a couple of theme/layout combos). A number to lock.
3. **Format in the key** — confirm the geometry is shared across formats so the key omits format (§6), or restrict the cache to the PDF/project path.
4. **Scope of "accept the ~10%"** — is a ~42 ms/refresh saving on a drag-to-tune loop worth the port + cache + invalidation-test surface, or should Option 2 also be parked until a real user reports the accent loop feeling slow (the Option-4/5 "await a real signal" treatment)? This review is ready to build if yes; it is equally a clean place to stop if the honest number changes the call.

## Implementation note (added at build time — the design above is unchanged; this records what the build settled)

Built on `feature/pagination-reuse` in three commits, gate green at each (backend 674 → **686** tests, tsc + eslint clean throughout).

- **Commit 1 — the port + LRU.** `PaginationCache` port (`domain/ports`) storing `{ pages, tableOfContents }`; `InMemoryPaginationCache` (bounded LRU, default cap 16, insertion-ordered Map, get promotes, set evicts oldest). 5 unit tests (hit/miss, overwrite, eviction, **LRU-not-FIFO**, cap≥1).
- **Commit 2 — `renderBook` reuse.** Optional `paginationCache?` 5th param; a hit reuses the cached `pages` paired with the **fresh new-accent typeset** (the §3 recolour, not restale). The key is `md5(JSON.stringify(book)) : themeName : JSON.stringify(pageLayout)` — a free `paginationKey` export — **accent absent by construction**. 6 tests, the two R2-critical ones front and centre: reuse-and-re-ink (paginate called once, the new accent reaches the renderer, `pages` deep-equal) and the **`pages[]` accent-invariance precondition** (two very different accents, and override-vs-none, paginate to deep-equal pages); plus no-cache-paginates-each-time, cache-output-neutral, key-excludes-accent/changes-on-theme-layout-content.
- **Commit 3 — wiring.** One `InMemoryPaginationCache` singleton in `app.ts`, passed to `ExportProjectUseCase` (the raw-bytes `/export` route stays uncached, §2.4). Integration test with a `paginate` spy — **the CTO's closure requirement**: accent-only change → hit; structure, theme and layout change → each a miss (re-paginate); accent again on the settled state → hit.
- **Verification.** `verify-real-export` **16/16** (raw-bytes path unaffected). Live smoke through the real wired server (`backend/spikes/live-pagination-cache-smoke.ts`): import → export → PATCH accent → export → structure reorder → export, all 200, **no server errors**, and the accent change produced **different PDF bytes** (273 231 → 273 874) — the observable proof the cached geometry was **re-inked, not served stale** (the §3 trap, confirmed absent in production).
- **The four §2 decisions all shipped as locked**, each covered by a test named above; the **§3 trap is guarded by the `pages[]`-invariance test** (the CTO's stated priority), which fails loudly if accent — or anything else reused under the key — ever moves geometry.

**Status: complete on `feature/pagination-reuse`, all green, awaiting the CTO's merge decision** (merge authority is the CTO's, GR-1). `CURRENT_STATE.md`/`TODO.md`/`VERSIONS.md` reconcile **after** merge, not before.

## Related
`PERFORMANCE_SCOPE.md` (the measured scope — Option 2, and Option 1's evidence-based closure), `MINI_DR_PER_THEME_ACCENT.md` (accent is colour-only / geometry-invariant — the proof this reuse rests on; `proofRefreshKey` already refetches on an accent change), ADR-0052 (the shared `renderBook`/`publishBook` tail — the seam the cache enters), ADR-0051 / RENDER_DRIFT.md (the silent-drift class the key-completeness guard exists to prevent), `PaginatedBook.ts` (the geometry-only `Page` the cache stores), `app.ts` (the singleton-wiring seam, and why the measurer is already amortised).
