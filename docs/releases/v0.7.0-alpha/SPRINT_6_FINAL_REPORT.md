# Sprint 6 Final Report — Professional Layout Engine

**Sprint:** Sprint 6 ("Professional Layout Engine")
**Branch:** `feature/sprint-6-professional-layout-engine`
**Date:** 2026-07-17 (single-day sprint, commit 0 spike + 10 implementation commits + 2 disclosed fix commits)
**Status:** ✅ Complete, merged, and released. PR #11 merged (`eb05beb`), tagged `v0.7.0-alpha`.
**Target version:** `v0.7.0-alpha` (see `docs/VERSIONS.md` and `docs/releases/v0.7.0-alpha/ReleaseNotes.md`).

---

## 1. Initial Objectives

From the Design Review (`docs/architecture/diagrams/PROFESSIONAL_LAYOUT_ENGINE.md`, ADR-0029) and the CTO's locked scope (`docs/architecture/diagrams/SPRINT_6_KICKOFF.md`):

1. Close the gap between what `LayoutEngine` did before this sprint (pagination estimate + heading keep-with-next only) and what `docs/VISION.md` has always described as its target scope: pagination, margins, headers/footers, chapter-opening-page rules, TOC generation, print optimization.
2. Give real headers/footers a Domain-level concept, closing a real, evidence-confirmed gap where the only implementation was PDF-specific, ad hoc, and showed a hardcoded literal string instead of the actual book's title.
3. Activate two `Chapter` fields declared since before this review but never read by anything: `openingPageStyle` and `startPageNumber`.
4. Automatically generate a Table of Contents from headings — `FrontMatter.toc`/`TableOfContents`/`TOCEntry` were fully modeled but nothing populated them.
5. Introduce the extension point for future automatic layout selection (`LayoutSelector`), without building the heuristic itself yet.

---

## 2. What Was Delivered

**Architecture:** `LayoutEngine` extended, not replaced (ADR-0029 Decision 1) — running headers, footers, page numbering, TOC generation, and `Chapter.openingPageStyle`/`startPageNumber` are all computed *during* pagination, from data pagination already produces. `LayoutEngine.paginate()`'s public signature is unchanged throughout.

| Commit | Delivered |
|---|---|
| 0 | KDP/platform trim-size spike (`backend/spikes/kdp-trim-size-spike.ts`) — real published specs, not guessed |
| 1 | `A4PageLayout`/`A5PageLayout`/`KDP5x8PageLayout`/`KDP5_5x8_5PageLayout`/`KDP6x9PageLayout` presets |
| 2 | `LayoutSelector` port + `ManualLayoutSelector` (only implementation this sprint) |
| 3 | `ExportController` uses `LayoutSelector`, replaces hardcoded `LetterPageLayout` |
| 4 | `Theme` gains `RunningHead` type (additive); `ClassicTheme` populated |
| 5 | `LayoutEngine` resolves per-page header/footer content (`Page.headerFooterTitle`) |
| 6 | `PDFRenderer` consumes resolved header/footer, drops the hardcoded `'Book Publisher Studio'` string |
| 7 | `DOCXRenderer` gains header/footer support (new capability — none existed before) |
| 8 | `LayoutEngine` honors `Chapter.openingPageStyle` (blank-page insertion for right/left starts) |
| 9 | `LayoutEngine` honors `Chapter.startPageNumber` |
| 10 | `PaginatedBook.tableOfContents` — automatic TOC generation from headings post-pagination, rendered as real front-matter content in both `PDFRenderer` and `DOCXRenderer` |
| 11 | E2E real-file verification pass (`docs/REAL_EXPORT_CHECKLIST.md`) |

**Also delivered, not originally itemized as its own numbered commit — found necessary while implementing the plan above, fixed immediately (ADR-0031):**
- `PaginatedBook.pageLayout` — neither renderer had ever actually consumed a `PageLayout` for real page geometry before this sprint; `LayoutEngine.paginate()` discarded its own `layout` parameter after using it for pagination math. Without this fix, every new `PageLayout` preset from commit 1 would have had zero effect on real rendered output.
- `LayoutEngine.buildTableOfContents()` corrected to walk `Chapter`/`Section` titles (not just content-level `Heading` blocks) — real DOCX imports never produce content-level `Heading` blocks; every real heading is structurally consumed into a `Chapter`/`Section` boundary by `ASTBuilder`. Found during commit 11's real-file verification against `large-book.docx`.

---

## 3. ADRs Created This Sprint

| ADR | Title | Status |
|---|---|---|
| 0029 | Professional Layout Engine — Extension Strategy, RunningHead, and LayoutSelector | Written during the Design Review, before any code |
| 0030 | KDP/Platform Trim-Size Spike Findings (Sprint 6, Commit 0) | New — records the spike's verified values and method |
| 0031 | Two Real Bugs Fixed During Sprint 6 Real-File Verification (Explicit Scope Exception) | New — the `PageLayout`-consumption gap and the TOC `Heading`-vs-`Chapter`/`Section`-title gap |

---

## 4. Design-Review Gaps Found and Resolved Mid-Sprint

Unlike Sprint 5 (no real-file bugs, three design questions) and more like Sprint 4 (real bugs found via real-file verification, ADR-0026), this sprint found **two real, would-have-shipped-broken bugs**, both fixed immediately rather than deferred (ADR-0031, full detail there):

1. **Neither renderer consumed `PageLayout` at all** (found before any real-file test, while reading `PDFRenderer.ts`/`DOCXRenderer.ts` to wire `RunningHead` support) — `PDFRenderer` hardcoded Letter-equivalent geometry; `DOCXRenderer`'s section had no `page` property, silently defaulting to `docx`'s own Letter-equivalent. This gap existed since Sprint 2/3A and was invisible until this sprint gave the codebase its first real `PageLayout` values beyond `LetterPageLayout`.
2. **Automatic TOC generation produced a permanently empty TOC on every real import** (found during commit 11's real-file verification against `large-book.docx`, 15 real chapters) — the Design Review's own wording ("walks all Heading blocks") assumed content-level `Heading` blocks are how a real book's heading hierarchy shows up; reading `ASTBuilder.ts` and testing against real content proved otherwise.

Both are exactly the failure mode `docs/REAL_EXPORT_CHECKLIST.md` exists to catch — neither was visible to `npm test` (328/328 passing throughout both discoveries) or to any synthetic-fixture unit test written before the real-file pass.

**A third, smaller finding, fixed inline during commit 5's own test-writing (not deferred, not its own ADR):** an ordering bug in `LayoutEngine`'s chapter-title attribution — reassigning `currentTopLevelTitle` before flushing the closing page mislabeled a chapter's last page with the *next* chapter's title. Caught by commit 5's own new tests before it shipped, fixed in the same commit.

---

## 5. Final Metrics

| Metric | Value |
|---|---|
| Tests | **328 passing, 0 failing** (up from 282 at Sprint 6's start — +46 tests) |
| Global coverage | **92.78%** statements |
| Domain coverage | **93.75%** statements |
| ESLint | **0 errors, 0 warnings** |
| TypeScript | strict mode, 0 compiler errors |
| `npm run verify-server` | ✅ passing (port 5000 read from the server's own startup log, not assumed) |
| `npm run verify-real-export` | ✅ **16/16 checks** (4 canonical fixtures × import + export-docx/pdf/epub) |
| Real HTTP export inspection | A4 PDF → real `/MediaBox [0 0 595.28 841.89]`; KDP 6×9 PDF → real `/MediaBox [0 0 432 648]`; A5 DOCX → real `<w:pgSz w:w="8390" w:h="11905"/>`; unknown `layout` → real HTTP 400 |
| Real-pipeline composition inspection (real fixtures, `compress:false` — the only way to inspect the HTTP route's production `compress:true` output, same established limitation as `ExportManuscriptUseCase.test.ts`) | Real book title (not the old hardcoded string) in the PDF running head and DOCX `header1.xml`; real `PAGE`/`NUMPAGES` DOCX field codes; `startPageNumber:101` on a real imported chapter → real footer `Page 101 of`; automatic TOC against `large-book.docx`'s 15 real chapters → 15 real TOC entries with correct resolved page numbers, TOC page actually renders |

**Full completed checklist:** to be included verbatim in the PR description per `docs/REAL_EXPORT_CHECKLIST.md`'s own template.

---

## 6. Deliberately Deferred to Future Work

- **`AutomaticLayoutSelector`** — named and designed for (ADR-0029 Decision 5), not built. `ManualLayoutSelector` remains the only `LayoutSelector` implementation.
- **13 of KDP's 16 published trim sizes** — only `5x8`/`5.5x8.5`/`6x9` shipped as presets (ADR-0030's scope decision); the rest are recorded in the spike script for future demand.
- **`RunningHead.font`/`.separator`** — accepted by the type, not yet consulted by either renderer; no theme populates them yet (ADR-0029 Risk 5).
- **DOCX per-chapter `RunningHead.content: 'chapterTitle'`** — a single `Header`/`Footer` applies to the whole DOCX document; true per-chapter alternation needs splitting into multiple Word sections, not built this sprint. Doesn't affect `ClassicTheme`, whose `'bookTitle'` content is constant document-wide regardless.
- **DOCX `Chapter.startPageNumber`** — Word's `PageNumber.CURRENT`/`TOTAL_PAGES` fields are section-wide; a per-chapter reset needs the same multi-section splitting as the item above.
- **`TOCEntry.children` nesting** — every generated entry is a flat, level-annotated list item; nesting rules (which headings are "children" of which) aren't specified anywhere in the design.
- **A very long TOC overflowing its own PDF page** — falls into the same pagination-estimate-drift bucket as any other PDFKit overflow (ADR-0013), not specially handled.
- **`Chapter.openingPageStyle`/`startPageNumber`/`frontMatter.toc.generateAutomatically` reachable through the real DOCX import pipeline** — `ASTBuilder` has no DOCX-native signal to populate any of the three from real content (same category of gap as Sprint 5's `isbn`/`description`/`coverImage` finding). Disclosed in `docs/REAL_EXPORT_CHECKLIST.md`'s Sprint 6 instance; the natural home for closing this is the already-scoped future "Import Fidelity" sprint (`docs/TODO.md`).
- **`Editorial AI Engine`, `Plugin System`, `Publishing Engine`** — mapped at Level 1 only (`PLATFORM_ARCHITECTURE_ROADMAP.md`); no Level 2 design, no code, no Sprint assignment.

---

## 7. Residual Risks

1. **`AutomaticLayoutSelector` not existing yet is a real, accepted risk** (same category as `ValidationContext`'s reserved fields, Sprint 5) — worth revisiting if no second `LayoutSelector` implementation ever materializes.
2. **`RunningHead`'s 8 fields are locked before any second theme besides `ClassicTheme` exists to exercise them** — `position`/`separator`/`uppercase`/`font`/`size` have no current consumer variety to validate the shape against.
3. **Blank-page insertion, header/footer resolution, and TOC generation all interact within the same `paginate()` pass** — get the internal ordering wrong and the features could disagree with each other. Carefully sequenced (`startPageNumber` before `openingPageStyle`'s parity check; blank pages excluded from the body's own page-number sequence and from TOC page-number resolution) and covered by dedicated tests, but this is real complexity worth flagging for whoever touches this method next.
4. **A generated TOC's page is deliberately excluded from the body's own page-number sequence** (PDF: via the `PageOwner` `'blank'` path; DOCX: as unnumbered front matter) — `LayoutEngine` computed body page numbers without reserving room for a TOC page, so keeping it out of that sequence avoids corrupting body numbering, but this is a real, disclosed simplification, not a fully general front-matter-pagination model.
5. **The three Chapter/FrontMatter-level fields this sprint activates (`openingPageStyle`, `startPageNumber`, `generateAutomatically`) are not reachable through the real HTTP import→export round trip** (§6) — fully correct and covered by real-library (not mocked) unit tests, and verified once via real-pipeline composition with programmatic field overrides, but never exercised by `npm run verify-real-export`'s automated 16-check pass, since nothing in that pass can set these fields from real DOCX content either.
6. **`ManualLayoutSelector`'s registry is a string-keyed `Record`, same shape as `getTheme()`'s** — a future preset added without updating both the registry and `PageLayout.pageSize`'s union type would silently fall through to `UnknownLayoutError` rather than a compile-time error. Same category of risk this codebase already accepts elsewhere (`ValidationEngine`'s `RULE_CATEGORY` lookup, Sprint 5).

---

## 8. Lessons Learned

1. **A shared Domain change (`PaginatedBook`) silently reaching every renderer, unverified, is a recurring failure mode in this codebase** — Sprint 4's Typography Engine found the same shape of gap (three renderers never handled inline formatting at all until that sprint gave them real data to consume), and this sprint found it again (`PageLayout` never actually reaching rendered output). The lesson generalizes: whenever a Domain model gains a field intended for renderer consumption, explicitly verify each renderer actually reads it, not just that the field exists and pagination math uses it internally.
2. **Real-file verification caught a bug a synthetic fixture structurally could not have caught.** The empty-TOC bug (ADR-0031, bug 2) exists because `ASTBuilder`'s real import behavior (headings become `Chapter`/`Section` boundaries) differs from what a hand-built test fixture naturally represents (a `Heading` block sitting in `content[]`, exactly matching the Domain model's own type definition). No amount of unit testing against synthetic `Chapter`/`Heading` objects could have exposed this — only walking output actually produced by the real import pipeline could.
3. **A design review's own wording can encode an unverified assumption just as easily as an implementation can.** "Walks all Heading blocks" was a reasonable reading of the `Book` domain model in isolation, but the Design Review never checked it against `ASTBuilder`'s actual behavior — the same class of gap ADR-0019/0020's spike-before-decide discipline exists to prevent for *external library* behavior, but that discipline hadn't previously been applied to this codebase's *own* prior pipeline stages. Worth generalizing: "confirmed, not guessed" should extend to claims about this project's own upstream code, not just third-party dependencies.
4. **A test that fails on first write is doing its job.** Commit 5's `currentTopLevelTitle` ordering bug and commit 10's TOC test failures were both caught by newly-written tests before any real-file verification was needed — cheaper feedback than the two ADR-0031 bugs, which required an actual real-file pass to surface. Both classes of catch mattered this sprint; neither substitutes for the other.
5. **Disclosing an unreachable-via-HTTP scope boundary honestly, rather than silently claiming coverage that doesn't exist, is worth the extra paragraph.** `openingPageStyle`/`startPageNumber`/TOC generation are fully real, fully tested against real rendering libraries — but `docs/REAL_EXPORT_CHECKLIST.md`'s completed instance says explicitly that the full HTTP round trip can't exercise them, rather than implying it was tried and passed.

---

## 9. Links

- Design Review: `docs/architecture/diagrams/PROFESSIONAL_LAYOUT_ENGINE.md`
- Sprint charter: `docs/architecture/diagrams/SPRINT_6_KICKOFF.md`
- Decisions: `docs/DECISIONS.md` (ADR-0029, ADR-0030, ADR-0031)
- Spike: `backend/spikes/kdp-trim-size-spike.ts`
- Current state (living doc): `docs/CURRENT_STATE.md`
- Backlog: `docs/TODO.md`
- Previous release: `v0.6.0-alpha` (`docs/releases/v0.6.0-alpha/ReleaseNotes.md`, `SPRINT_5_FINAL_REPORT.md`)
- This report precedes formal `ReleaseNotes.md` for `v0.7.0-alpha`, written once the tag is cut and the PR merges (per `docs/VERSIONS.md`'s "Released only after the tag is pushed" rule).
