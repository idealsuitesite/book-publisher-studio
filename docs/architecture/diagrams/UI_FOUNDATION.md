# UI Foundation — Level 2 Design Review

**Status:** 🟡 **ROUND 1 — DRAFT. Not approved. No branch, no code.** 6 open questions posed below, each with a recommendation and its reasoning, all left open for explicit CTO decision — the same process followed for Sprints 5–8.
**Date:** 2026-07-18
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

## 3. Open Questions — For CTO Decision

None are locked. Each records a recommendation and why.

### Question 1 — Build the component library, or adopt one?

**Recommendation: build a small, owned set of primitives. Do not adopt a component framework.**

**Reasoning from the real numbers, not preference:** the entire frontend is 694 lines with 7 components. Adopting a full library (MUI, Chakra, Mantine) would add a dependency substantially larger than the application itself, and impose its design language on a product whose visual identity is precisely what this sprint exists to define. The measured duplication — `rounded-2xl` six times, a hand-repeated dark/light border pair — is a *tokenization* problem, not a "we lack components" problem.

**The middle option, which I think is genuinely the best one:** adopt **headless** primitives (Radix UI or React Aria) for the few components where accessibility is genuinely hard to get right — dialog focus-trapping, listbox keyboard navigation, tooltips — and build everything visual on top. This buys correct ARIA semantics and keyboard behaviour (currently at zero) without importing anyone's aesthetics.

**Honest counter-argument:** any new dependency is a new maintenance surface, and this project has been notably disciplined about that (10 runtime backend dependencies after 8 sprints). A reviewer could reasonably say "build the 5 primitives you need by hand." My concern is that hand-rolled focus management and keyboard interaction is exactly where accessibility silently fails.

### Question 2 — How far do "themes" go this sprint?

The word is ambiguous in this codebase and needs disambiguating before anything is built. **`Theme` already exists as a Domain concept** (`ClassicTheme`, `getTheme`, `ThemeEngine`) meaning *the visual style of the produced book*. The CTO's Sprint 9 scope also lists "themes" meaning *the visual style of the application interface*. **These are unrelated and must never be conflated** — the same word, two entirely different things.

**Recommendation: application themes ship as light + dark only, driven by tokens; and the naming makes the distinction explicit** — `AppTheme` (interface) versus the existing `Theme` (book output), or an equivalent unambiguous pair.

Dark mode is already half-present and hand-maintained (`border-zinc-700`/`border-zinc-300` repeated five times each), so tokenizing it is a real, immediate cleanup rather than new surface. Custom or user-authored interface themes should wait — there is no user-facing setting for it, and `docs/VISION.md`'s Theme Marketplace concept is about *book* themes, not interface ones.

### Question 3 — Does Sprint 9 change any pixel the user sees, or only how it is built?

**This is the sharpest scope question in the review, and I do not think it can be dodged.**

A "Design System sprint" that changes nothing visually is a pure refactor — safe, verifiable, and arguably invisible to any stakeholder. A Design System sprint that also restyles the product delivers something demonstrable but makes "did we break anything?" much harder to answer, with no frontend test suite to lean on.

**Recommendation: allow deliberate visual change, but sequence it — extract tokens and primitives *first* with no visual change, then restyle on top of the proven foundation.** Concretely: the early commits are provably behaviour- and appearance-neutral (screenshot-comparable), and only after the foundation is in place do later commits intentionally change appearance. That way a visual regression in the foundation phase is unambiguous, and visual change afterwards is intentional rather than accidental.

**The real trade-off, stated plainly:** this makes the sprint longer than a pure refactor. The alternative — restyle everything while extracting tokens — is faster but leaves no point at which "nothing should have changed" is a checkable statement.

### Question 4 — Which navigation, given there is exactly one page today?

The application is currently a single route (`app/page.tsx`) with a vertical panel flow. "Navigation" is in scope, but **there is nowhere to navigate to** — Workspace (projects, recent, favourites) is Sprint 11, and it is the first thing that genuinely needs routing.

**Recommendation: build the navigation *shell* (header, app identity, a slot for future destinations, responsive collapse) but do not invent destinations that do not exist.**

Inventing a sidebar with links to Projects/Library/Settings before those exist would mean shipping dead UI — and Sprint 10 (UX & Workflow) is the sprint that should decide what the real journey needs, informed by real editors. Building the shell now and populating it in Sprints 10–11 respects both boundaries.

### Question 5 — Where exactly is the UI/UX line, given they are deliberately separate sprints?

Some items are genuinely ambiguous: an error message's *styling* is UI, its *wording* is UX; a loading state's *appearance* is UI, whether a spinner or skeleton better fits the wait is UX.

**Recommendation: Sprint 9 owns anything expressible as a reusable token or component; Sprint 10 owns anything expressible as a decision about the user's journey.** So Sprint 9 builds an `Alert` component with error/warning/info variants; Sprint 10 decides what each message actually says and when it appears.

**Practical consequence worth accepting explicitly:** Sprint 9 will inevitably *touch* wording while restyling components. Recommend the rule be "preserve existing wording verbatim unless it is factually wrong" — so that Sprint 10 reviews real, unchanged text rather than text this sprint quietly rewrote.

### Question 6 — Does Sprint 9 introduce the frontend test suite?

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

Shape only — **not approved**, contingent on §3. Ordered so the appearance-neutral work lands before any deliberate visual change (Question 3).

0. **Commit 0 — accessibility + visual baseline.** Capture the current state before touching anything: an automated a11y audit and reference screenshots of every Demo Script screen. Analogous to Sprint 8's Commit-0 spike — establish facts before deciding against them.
1. **Commit 1 — design tokens** in `globals.css`, plus the Geist/Arial fix (§5).
2. **Commit 2 — `ui/` primitives**, appearance-neutral: `Button`, `Card`, `Alert`, `Badge`, and whatever the audit shows is genuinely repeated.
3. **Commit 3 — accessibility primitives** (Question 1's headless-library decision applies here).
4. **Commit 4 — refactor the 7 existing components onto `ui/`**, still appearance-neutral and screenshot-comparable.
5. **Commit 5 — navigation shell** (Question 4).
6. **Commit 6 — responsive behaviour**, verified at real breakpoints.
7. **Commit 7 — deliberate restyle** (the first commit permitted to change appearance).
8. **Commit 8 — frontend test suite** (Question 6; earlier if the CTO makes it a prerequisite, which I recommend).
9. **Commit 9 — real-browser verification pass** against the full Demo Script.
10. **Commit 10 — docs/ADR reconciliation.**

---

## 8. Provisional Acceptance Criteria

Every item independently verifiable against the real running application — not asserted. This sprint needs these more than most, because "it looks better" is not checkable.

- ✓ **`docs/product/PRODUCT_DEMO.md`'s Demo Script passes end to end, unchanged** — the single strongest objective criterion
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
