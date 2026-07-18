# UI Foundation — Level 2 Design Review

**Status:** ✅ **APPROVED (2026-07-18, round 2).** All 6 round-1 questions resolved by explicit CTO decision, recorded as Locked Decisions 1–6 in §3 below. The CTO also added one acceptance criterion (screenshot archival and comparison, §8) and revised the commit plan to move the frontend test suite earlier, before the large refactor (§7).

**This approves the design. It does not by itself authorize branching or implementation** — per `docs/DESIGN_REVIEW_PROCESS.md`'s two-gate discipline, exercised as two separate events in every prior sprint. Awaiting explicit go-ahead before any branch or code.

**One inconsistency found while integrating the CTO's decisions, flagged rather than silently resolved:** Decision 3 was stated as *"Commits 1 to 6 → no intentional visual change. Then Commit 7 → restyling,"* which matches the **round-1** commit numbering. The CTO's own revised plan (§7) inserts frontend test setup at position 2, shifting everything after it by one — so restyle becomes **Commit 8**, not 7. The *principle* is unchanged and is what has been locked; only the numbers move. §3's Decision 3 and §7 now both read **"Commits 1–7 appearance-neutral, Commit 8 restyles."** If that reading is wrong, it needs correcting before Commit 0.

**Date:** 2026-07-18 (round 1 drafted) / 2026-07-18 (round 2 approved)
**Sprint:** Sprint 9, per ADR-0039's reordered roadmap. Target version `v0.10.0-alpha`.

---

## 1. Objectives

Build the **definitive interface foundation**: a real Design System — reusable components, themes, typography, colours, icons, grid, responsive behaviour, accessibility, navigation.

**The defining constraint, stated first because it governs every decision below: no new business logic.** The backend is not touched. No new endpoint, no new Domain concept, no new capability. Sprint 9 changes *how the existing product looks and is built*, never *what it does*. That makes this the first sprint in the project's history whose success cannot be measured by a new feature working — §8's acceptance criteria are shaped entirely around that problem.

**Deliberately not this sprint (ADR-0039):** the user journey, click counts, error-message quality, guidance, and flow are **Sprint 10 (UX & Workflow)**. UI answers *"what does the software look like?"*; UX answers *"is it pleasant and efficient to use?"*. Question 5 exists because that line is easy to state and hard to hold.

---

## 2. Current State — Evidence, Not Assumptions

Every claim below was confirmed by reading the actual files or running an actual command.

**The entire frontend, measured:** 7 components (`UploadDropzone`, `BookStructureView`, `ValidationSummary`, `FormatSelector`, `PreviewPanel`, `ExportPanel`, `ProgressStepper`) plus `app/page.tsx`, `app/layout.tsx`, `app/globals.css` — **694 lines total**. One route, one page. Dependencies are exactly `next`, `react`, `react-dom`, `shared-types`. No component library, no icon library, no styling utility beyond Tailwind v4 itself.

**There is no design system today.** `app/globals.css` defines exactly two tokens — `--background` and `--foreground` — both from the stock Next.js scaffold. Every other visual decision lives inline in component markup.

**Duplication, counted rather than asserted** (`grep` across `components/*.tsx`): `text-sm` appears **21** times, `border-2` **7**, `rounded-2xl` **6**, `px-8` **6**, and the dark/light pair `border-zinc-700`/`border-zinc-300` **5 times each** — meaning dark mode is hand-maintained per component rather than tokenized. This is small enough to refactor safely and large enough that a second developer would diverge.

**Zero accessibility attributes exist.** `grep` for `aria-*` and `role=` across all 7 components and `app/page.tsx` returns **nothing**. Accessibility is explicitly in this sprint's scope and currently starts from zero.

**A real, shipped defect found while gathering this evidence — disclosed, not silently fixed:** `app/layout.tsx` loads **Geist** and **Geist Mono** from Google Fonts and binds them to `--font-geist-sans`/`--font-geist-mono`; `globals.css` maps those into Tailwind's `--font-sans`/`--font-mono`. But `globals.css` line 25 sets `body { font-family: Arial, Helvetica, sans-serif; }`, and **no component anywhere uses the `font-sans` or `font-mono` classes** (`grep`-confirmed — the only matches are the two `@theme` definitions themselves). **The application therefore downloads two font families on every page load and renders not one character in either.** Leftover scaffold from Sprint 7 Commit 4, never caught because nothing in the pipeline checks which font actually renders. Typography is in this sprint's scope, so this is squarely Sprint 9's to fix.

**No frontend test suite exists** — `frontend/package.json` scripts are exactly `dev`, `build`, `start`, `lint`. No `test` script, no test runner, no component test anywhere. Disclosed since v0.8.0-alpha and tracked in `docs/TODO.md`; **Question 6 asks whether Sprint 9 is where that changes**, because a Design System without tests is a refactoring hazard.

**The backend is untouched by this sprint and stays so:** 386 tests, `POST /api/manuscripts/{import,export,publish}` and `GET /api/manuscripts/options` all unchanged. Sprint 7 Decision 2's stateless architecture is **fully compatible** with Sprints 9 and 10 — no persistence is needed for either, which is part of why ADR-0039 placed them first.

**Product documentation that already exists and must be honoured:** `docs/product/WIREFRAMES.md`, `PERSONAS.md`, `USER_JOURNEYS.md`, `FEATURE_MATRIX.md`, `PRODUCT_DEMO.md` (the official Demo Script), and `PRODUCT_ACCEPTANCE.md` were all written in Sprint 7. **The Demo Script is a hard constraint: it must still pass, unchanged, after this sprint** — that is §8's strongest objective criterion.

---

## 3. Locked Decisions (Round 2, 2026-07-18)

All six round-1 questions are now resolved by explicit CTO decision. Each records the ruling **and** the reasoning behind it, not just the outcome — matching this project's discipline that rationale is what a future contributor actually needs. The original round-1 recommendation is preserved beneath each ruling.

### Decision 1 — Build the primitives; adopt headless libraries only where accessibility is genuinely hard

**Locked.** Do **not** adopt MUI, Chakra, or Mantine.

**The CTO's refinement of the round-1 recommendation, which sharpens it:** rather than leaving "use headless primitives where accessibility is hard" as a judgment call, the split is named explicitly.

| Built in-house (`components/ui/`) | Headless library (Radix UI or React Aria) |
|---|---|
| `Button`, `Card`, `Alert`, `Badge`, `Input`, `Textarea`, `Select` | `Dialog`, `Popover`, `Menu`, `Tooltip`, focus trap |

**CTO's rationale:** the second group are complex accessibility components — focus management, keyboard interaction, ARIA relationships — and hand-rolling them is exactly where accessibility silently fails. The first group is visual surface this product should own.

**A boundary this makes explicit:** `Input`, `Textarea`, and `Select` are in-house, which the round-1 draft had not named. Note that a fully accessible `Select` (listbox keyboard navigation, typeahead) is closer in difficulty to the headless group than to `Button` — **if it proves so during implementation, escalate rather than ship a half-accessible hand-rolled one.** Recorded now so that call is a disclosed escalation, not a silent deviation.

**Explicitly out of scope:** 50 components, 100 variants, a home-grown mini-MUI. Small, stable, reusable.

---

*Round-1 recommendation, preserved:* build a small, owned set of primitives. Do not adopt a component framework.

**Reasoning from the real numbers, not preference:** the entire frontend is 694 lines with 7 components. Adopting a full library (MUI, Chakra, Mantine) would add a dependency substantially larger than the application itself, and impose its design language on a product whose visual identity is precisely what this sprint exists to define. The measured duplication — `rounded-2xl` six times, a hand-repeated dark/light border pair — is a *tokenization* problem, not a "we lack components" problem.

**The middle option, which I think is genuinely the best one:** adopt **headless** primitives (Radix UI or React Aria) for the few components where accessibility is genuinely hard to get right — dialog focus-trapping, listbox keyboard navigation, tooltips — and build everything visual on top. This buys correct ARIA semantics and keyboard behaviour (currently at zero) without importing anyone's aesthetics.

**Honest counter-argument:** any new dependency is a new maintenance surface, and this project has been notably disciplined about that (10 runtime backend dependencies after 8 sprints). A reviewer could reasonably say "build the 5 primitives you need by hand." My concern is that hand-rolled focus management and keyboard interaction is exactly where accessibility silently fails.

### Decision 2 — Interface theming is `AppTheme`, light + dark only, and the name never collides with the Domain's `Theme`

**Locked, validated 100%.**

**CTO's rationale (verbatim):** in this codebase `Theme` already means *the theme of a book*. Reusing that name for the interface would create a lasting confusion. The interface concept is therefore `AppTheme`; the existing Domain `Theme`/`ThemeEngine`/`getTheme`/`ClassicTheme` are untouched and keep their meaning.

Scope this sprint: **light + dark only**, driven by tokens. This is real cleanup rather than new surface — dark mode is currently hand-maintained per component (`border-zinc-700`/`border-zinc-300`, five times each). Custom or user-authored interface themes wait: there is no user-facing setting for them, and `docs/VISION.md`'s Theme Marketplace concept is about *book* themes.

---

*Round-1 question, preserved:* how far do "themes" go this sprint?

The word is ambiguous in this codebase and needs disambiguating before anything is built. **`Theme` already exists as a Domain concept** (`ClassicTheme`, `getTheme`, `ThemeEngine`) meaning *the visual style of the produced book*. The CTO's Sprint 9 scope also lists "themes" meaning *the visual style of the application interface*. **These are unrelated and must never be conflated** — the same word, two entirely different things.

**Recommendation: application themes ship as light + dark only, driven by tokens; and the naming makes the distinction explicit** — `AppTheme` (interface) versus the existing `Theme` (book output), or an equivalent unambiguous pair.

Dark mode is already half-present and hand-maintained (`border-zinc-700`/`border-zinc-300` repeated five times each), so tokenizing it is a real, immediate cleanup rather than new surface. Custom or user-authored interface themes should wait — there is no user-facing setting for it, and `docs/VISION.md`'s Theme Marketplace concept is about *book* themes, not interface ones.

### Decision 3 — Commits 1–7 introduce no intentional visual change; Commit 8 restyles

**Locked.** The CTO called this *"probably the best idea in the whole review"* and made it official policy for the sprint rather than a preference.

**CTO's rationale (verbatim reasoning):** because reference screenshots can then be compared. Otherwise there is never a way to know whether a defect came from the refactoring or from the new design.

**Numbering, reconciled:** stated in round 2 as "Commits 1–6, then 7," matching round-1 numbering. The CTO's own revised plan (§7) inserts test setup at position 2, shifting later commits by one. The locked principle is therefore **Commits 1–7 appearance-neutral, Commit 8 restyles** — the boundary sits immediately before the restyle commit wherever it lands, not at a fixed number.

**One honest nuance this policy needs, or it cannot be enforced as written:** **Commit 7 is responsive behaviour, which necessarily changes appearance at some viewport widths — that is its entire purpose.** "Appearance-neutral" therefore means: *desktop reference screenshots stay pixel-identical through Commit 7; mobile and tablet appearance is expected to change at that commit and only that commit, intentionally.* Without this carve-out, Commit 7 would either violate the rule or force responsive work into the restyle commit, defeating the isolation the rule exists to provide.

---

*Round-1 question, preserved:* does Sprint 9 change any pixel the user sees, or only how it is built?

**This is the sharpest scope question in the review, and I do not think it can be dodged.**

A "Design System sprint" that changes nothing visually is a pure refactor — safe, verifiable, and arguably invisible to any stakeholder. A Design System sprint that also restyles the product delivers something demonstrable but makes "did we break anything?" much harder to answer, with no frontend test suite to lean on.

**Recommendation: allow deliberate visual change, but sequence it — extract tokens and primitives *first* with no visual change, then restyle on top of the proven foundation.** Concretely: the early commits are provably behaviour- and appearance-neutral (screenshot-comparable), and only after the foundation is in place do later commits intentionally change appearance. That way a visual regression in the foundation phase is unambiguous, and visual change afterwards is intentional rather than accidental.

**The real trade-off, stated plainly:** this makes the sprint longer than a pure refactor. The alternative — restyle everything while extracting tokens — is faster but leaves no point at which "nothing should have changed" is a checkable statement.

### Decision 4 — Navigation is a shell only: header, logo, title, placeholder

**Locked.**

**CTO's rationale (verbatim intent):** with exactly one page today, links to Projects, Library, Settings, Home, or Favourites would **all be false**. Building them would ship dead UI and pre-empt decisions belonging to Sprint 10 (UX & Workflow) and Sprint 11 (Workspace), which are the sprints that will know what destinations actually exist.

```
Header
  ├── Logo
  ├── Title
  └── Placeholder (slot for future destinations)
```

Responsive collapse behaviour for this shell is in scope (Commit 6/7); inventing destinations is not.

---

*Round-1 question, preserved:* which navigation, given there is exactly one page today?

The application is currently a single route (`app/page.tsx`) with a vertical panel flow. "Navigation" is in scope, but **there is nowhere to navigate to** — Workspace (projects, recent, favourites) is Sprint 11, and it is the first thing that genuinely needs routing.

**Recommendation: build the navigation *shell* (header, app identity, a slot for future destinations, responsive collapse) but do not invent destinations that do not exist.**

Inventing a sidebar with links to Projects/Library/Settings before those exist would mean shipping dead UI — and Sprint 10 (UX & Workflow) is the sprint that should decide what the real journey needs, informed by real editors. Building the shell now and populating it in Sprints 10–11 respects both boundaries.

### Decision 5 — Sprint 9 builds the components; Sprint 10 decides how they are used

**Locked.** The CTO validated the separation completely: *"Sprint 9 builds the components. Sprint 10 decides how they are used."*

The operational rule: **Sprint 9 owns anything expressible as a reusable token or component; Sprint 10 owns anything expressible as a decision about the user's journey.** So Sprint 9 builds an `Alert` with error/warning/info variants; Sprint 10 decides what each message says and when it appears.

**The consequence that makes this enforceable:** existing wording is **preserved verbatim** unless it is factually wrong — so Sprint 10 reviews real, unchanged text rather than text this sprint quietly rewrote.

---

*Round-1 question, preserved:* where exactly is the UI/UX line, given they are deliberately separate sprints?

Some items are genuinely ambiguous: an error message's *styling* is UI, its *wording* is UX; a loading state's *appearance* is UI, whether a spinner or skeleton better fits the wait is UX.

**Recommendation: Sprint 9 owns anything expressible as a reusable token or component; Sprint 10 owns anything expressible as a decision about the user's journey.** So Sprint 9 builds an `Alert` component with error/warning/info variants; Sprint 10 decides what each message actually says and when it appears.

**Practical consequence worth accepting explicitly:** Sprint 9 will inevitably *touch* wording while restyling components. Recommend the rule be "preserve existing wording verbatim unless it is factually wrong" — so that Sprint 10 reviews real, unchanged text rather than text this sprint quietly rewrote.

### Decision 6 — The frontend test suite is mandatory, and lands *before* the refactor

**Locked, and strengthened beyond the round-1 recommendation.** The CTO went further than "yes": the test commit is **obligatory**, and it moves from position 8 to **position 2** in the commit plan — before the large refactor rather than after it.

**CTO's rationale (verbatim):** without it, the entire UI layer is rewritten with no safety net.

Minimum coverage required:
- component rendering
- variants
- accessibility
- interactions

**Not required:** exhaustive coverage. This is a real safety net for the specific risk this sprint creates, not a testing sprint.

**Amended by ADR-0040 Correction 1 — how the tests actually land:** Commit 2 ships the **harness only** (config, `test` script, one smoke test proving the runner executes); **every commit from 3 onward ships its own tests inline.** A "test suite" commit at position 2 would have almost nothing to test — the `ui/` primitives it would cover do not exist until Commit 3 — so it would either be an empty harness mislabelled as a suite, or force primitives to be written early and collapse two commits into one. Shipping tests alongside each component is also what this project has done in **every one of its 8 prior sprints**: Sprint 8's implementation commits carried 1, 6, 1, 1, and 2 test files respectively, and there has never been a standalone unit-test commit. The round-2 *intent* — a safety net before the large refactor — is preserved and arguably strengthened: by Commit 5, every primitive the refactor consumes already has real tests written against real behaviour rather than anticipated behaviour.

Vitest plus Testing Library, matching `backend/`'s existing Vitest choice so the monorepo keeps one test runner. This closes `docs/TODO.md`'s standing "Frontend automated test suite" backlog item, open since v0.8.0-alpha.

---

*Round-1 question, preserved:* does Sprint 9 introduce the frontend test suite?

**No frontend test exists.** This sprint refactors every existing component with no automated safety net.

**Recommendation: yes — and it is a genuine prerequisite, not an optional extra.** Vitest plus Testing Library would match `backend/`'s existing Vitest choice, keeping one test runner across the monorepo.

**Reasoning:** this project's own recurring lesson (ADR-0019/0020/0031/0032/0038 — **five times**) is that untested paths ship broken and are discovered only by real verification. Sprint 9 rewrites the entire frontend's styling foundation. Doing that with zero automated verification, on the sprint immediately following one whose main finding was "386 passing tests did not catch this," would be difficult to defend.

**Honest counter-argument the CTO should weigh:** adding a test suite is itself substantial work and arguably its own sprint. A defensible alternative is a narrow smoke-test suite this sprint (does each component render, do variants apply) rather than comprehensive coverage — real protection against the specific risk this sprint creates, without turning into a testing sprint.

---

## 4. Architecture Impact

**Backend: zero.** No endpoint, no Domain type, no Application service, no `packages/shared-types` change. `POST /api/manuscripts/{import,export,publish}` and `GET /api/manuscripts/options` are untouched. The 386 backend tests should pass unchanged and unmodified — **if any backend file changes, this sprint has broken its own defining constraint.**

**Frontend, provisional shape:**

```
frontend/
├── app/
│   ├── layout.tsx          ← app shell + navigation (Q4)
│   ├── globals.css         ← design tokens (Q2) — replaces the 2-token scaffold
│   └── page.tsx            ← unchanged in role; restyled (Q3)
├── components/
│   ├── ui/                 ← NEW: the Design System primitives
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Alert.tsx
│   │   ├── Badge.tsx
│   │   └── …
│   └── *.tsx               ← the 7 existing feature components, refactored onto ui/
└── (test setup, pending Q6)
```

**The dependency direction rule ADR-0037 established for the Publishing Engine applies here in its own form:** feature components depend on `ui/` primitives; **`ui/` primitives must never import a feature component or know any domain concept.** A `Button` cannot know what a manuscript is. This keeps the primitives reusable by Sprints 10–17 without carrying Sprint 7's feature assumptions along.

---

## 5. Functional / Technical Specifications

Deliberately sparse and **not locked** — the concrete token set and primitive list depend on §3.

Token categories expected in `globals.css` (replacing today's two-token scaffold): colour (semantic roles — surface, border, text, accent, plus severity colours the existing `ValidationSummary` already needs), typography scale (replacing the 21 hand-written `text-sm`), spacing scale, radius (replacing the 6 hand-written `rounded-2xl`), and elevation.

**Explicitly in scope as a real bug fix, not a feature:** resolve the Geist-versus-Arial contradiction documented in §2 — either use the fonts being downloaded or stop downloading them. Both are defensible; shipping the current state is not.

---

## 6. Risks

1. **No automated safety net for a whole-frontend refactor.** The single largest risk, and exactly what Question 6 exists to address.
2. **Scope creep into UX.** The boundary is real but soft (Question 5). Without an explicit rule, "while I'm restyling this I'll just reword…" is the likely failure mode, and it would quietly pre-empt Sprint 10's decisions.
3. **A sprint with no user-visible feature is hard to declare done.** Question 3's sequencing recommendation and §8's Demo-Script criterion exist to make "done" objective rather than aesthetic.
4. **Adopting a component library would impose someone else's design language** on the sprint whose entire purpose is defining this product's own — Question 1's reasoning.
5. **"Theme" is a genuinely overloaded word in this codebase.** `Theme`/`ThemeEngine`/`getTheme`/`ClassicTheme` already mean *book output style*. Conflating that with interface theming would be a naming error that outlives the sprint — Question 2's naming recommendation is the mitigation.
6. **Visual regressions are invisible to `tsc`, ESLint, and any unit test.** Even with Question 6's suite, "it renders" is not "it looks right." Real browser verification against the Demo Script remains mandatory, exactly as `docs/REAL_FIXTURE_POLICY.md` mandates real-file verification for the backend.
7. **Accessibility starting from literal zero** means it can only be measured as an improvement, not a regression — no baseline exists. Recommend capturing one early (an axe or Lighthouse run against the current UI) so the sprint's claim is a real delta rather than an assertion.

---

## 7. Provisional Commit Plan

**Approved (round 2), with the CTO's own reordering: the frontend test suite moves from position 8 to position 2**, so the safety net exists *before* the large refactor begins rather than after it.

| # | Commit | Appearance |
|---|---|---|
| 0 | **Baseline** — adopt Playwright (ADR-0040 Correction 2), then capture an automated a11y audit + reference screenshots of every Demo Script screen, archived before anything is touched. Analogous to Sprint 8's Commit-0 spike: establish facts before deciding against them. **If Playwright cannot install or run here, that is a blocker to surface immediately, not to work around.** | — |
| 1 | **Design tokens** in `globals.css` (`AppTheme`, light + dark), plus the Geist/Arial fix (§5) | neutral |
| 2 | **Frontend test harness** — Vitest + Testing Library config, a `test` script, and one smoke test proving the runner executes. **Harness only, not a suite** (ADR-0040 Correction 1) | neutral |
| 3 | **`ui/` primitives** — `Button`, `Card`, `Alert`, `Badge`, `Input`, `Textarea`, `Select` (Decision 1), **each shipping its own tests** | neutral |
| 4 | **Accessibility primitives** — `Dialog`, `Popover`, `Menu`, `Tooltip`, focus trap, via headless library (Decision 1), **with their own tests** | neutral |
| 5 | **Refactor the 7 existing components onto `ui/`** — the largest commit; every primitive it consumes already has real tests from Commits 3–4 | neutral |
| 6 | **Navigation shell** — header, logo, title, placeholder (Decision 4) | neutral |
| 7 | **Responsive behaviour**, verified at real breakpoints | **desktop neutral; mobile/tablet intentionally changes** (Decision 3's carve-out) |
| 8 | **Deliberate restyle** — the first commit permitted to change desktop appearance | **intentional change** |
| 9 | **Real-browser verification pass** against the full Demo Script | — |
| 10 | **Docs/ADR reconciliation** | — |

**Decision 3's boundary in this numbering:** Commits 1–7 introduce no intentional *desktop* visual change and stay screenshot-comparable; Commit 8 is the first permitted to. Commit 7 is the single carve-out, and only for mobile/tablet widths.

---

## 8. Provisional Acceptance Criteria

**Approved (round 2)**, with one criterion added by the CTO (the screenshot-archival rule below). Every item independently verifiable against the real running application — not asserted. This sprint needs these more than most, because "it looks better" is not checkable.

- ✓ **`docs/product/PRODUCT_DEMO.md`'s Demo Script passes end to end, unchanged** — the single strongest objective criterion, and the CTO's own reason for approving it: the test is not *"the design is prettier"* but *"the software still works."*
- ✓ **Reference screenshots of every Demo Script screen are archived before the first commit, then compared after every commit that intentionally changes appearance** (CTO-added criterion). This is what makes Decision 3's appearance-neutral policy enforceable rather than aspirational — a diff against Commit 0's baseline is either empty (Commits 1–7, desktop) or intentional (Commits 7 mobile, 8). **Resolved by ADR-0040 Correction 2:** confirmed by checking that neither `playwright` nor `puppeteer` was installed anywhere in this repository, which meant this criterion could not be met at all as originally written. **Playwright is adopted as a `frontend/` dev dependency at Commit 0**, giving a checked-in, re-runnable script that captures real image files — reproducible by anyone on any machine, rather than by one operator in one environment. It serves two locked requirements at once (this criterion, and Commit 9's real-browser verification), which is what justifies the dependency. Sprint 7's finding still stands as the reason the interactive-browser route was rejected: no disk persistence, and blank captures once the page is scrolled.
- ✓ Real DOCX import → structure → validation → layout → preview → export still works in a real browser
- ✓ **Zero backend files changed** (`git diff --stat` verifiable); 386 backend tests pass unmodified
- ✓ No new business logic in the frontend — no new endpoint called, no new domain concept introduced
- ✓ Every `ui/` primitive is free of domain knowledge (grep-verifiable: no `ui/` file imports a feature component or a manuscript type)
- ✓ Measured accessibility improvement against Commit 0's captured baseline — a real delta, not a claim
- ✓ Keyboard navigation works through the entire Demo Script flow
- ✓ Verified at real mobile, tablet, and desktop breakpoints
- ✓ The duplication §2 counted is genuinely reduced — re-run the same `grep`, compare
- ✓ Fonts: whichever way the Geist/Arial contradiction is resolved, the fonts downloaded are the fonts rendered
- ✓ `tsc --noEmit` and ESLint clean across `frontend/`

---

## Related

- **ADR-0039** — the strategic reprioritization that made this Sprint 9, and the reason Editorial AI Engine moved to Sprint 18+
- `docs/product/PRODUCT_DEMO.md` — the Demo Script this sprint must not break (§8's primary criterion)
- `docs/product/WIREFRAMES.md`, `PERSONAS.md`, `USER_JOURNEYS.md` — Sprint 7 product documentation this sprint should honour rather than re-derive
- `docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md` — where the 7 existing components came from; Decision 2's stateless backend, unaffected by this sprint
- ADR-0037 — the dependency-direction principle §4 applies in frontend form (`ui/` must not depend on features)
- ADR-0033 — `packages/shared-types` is transport contracts only; unchanged by this sprint
- `docs/TODO.md` — the frontend-test-suite backlog item Question 6 proposes closing
- `docs/DESIGN_REVIEW_PROCESS.md` — the two-gate discipline this document is the first gate of

---

## Addendum (2026-07-18, CTO-directed) — the Import panel's information hierarchy

**Trigger, in the CTO's own framing:** after real use, the Import panel had grown to show practically the whole table of contents (17 chapters, dozens of sub-sections), forcing scrolling before Validation/Layout/Preview were even reachable. *"Ce n'est pas un bug CSS, c'est un problème de conception de l'interface. Le panneau Import ne doit pas devenir proportionnel à la taille du manuscrit."*

**The principle now locked:** the Import panel answers **"what did I import?"** — title, author, filename, statistics, success state. It never answers "show me the whole book"; those are different needs, and the second belongs to a future structure surface (the Sprint 10+ multi-page interface), not to an import confirmation. **No panel's height may be proportional to manuscript size.**

**Implementation:** the structure list in `BookStructureView` collapses behind a native `<details>` disclosure showing "Structure — N parts"; expanded, it is height-capped (`max-h-64`) and scrolls internally, so even opened it cannot dominate. Native disclosure chosen over a custom toggle for its free, correct semantics — the same reasoning as Commit 3's native `<select>`.

**Baseline note:** this changes `02/03/04` screens on every viewport — an intentional, CTO-ordered change landing before Commit 8's restyle window. Decision 3's process is followed (recapture with attribution in the same commit series), not silently bypassed; the *neutral-through-Commit-7* rule is amended by the CTO's explicit instruction, which this addendum records.
