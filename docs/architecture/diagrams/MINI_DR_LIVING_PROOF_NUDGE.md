# Mini Design Review — First-open Proof nudge (Option B of LIVING_PROOF_VISIBILITY_SCOPE)

**Status:** AWAITING CTO REVIEW — **no code written.** Option B of `LIVING_PROOF_VISIBILITY_SCOPE.md`, CTO-approved in principle (2026-07-21) with three points locked; **the health guard is part of the locked scope, not a later addition — it is the correction condition.**
**Date:** 2026-07-21. The last item in the queue.
**Re-verified against current code** (non-negotiable #7): the view-init / resume-where-left logic (`page.tsx:37-73`), the loading gate (`:170-176`), and the health signal (`unstructuredFinding`, `bookFacts.ts`) re-read on `main` today (`03a5094`).

---

## 1. What changes

On the **first open of a project**, when the book is **healthy**, the workspace lands on the **Proof** station — the author sees their rendered book once, at the moment "that's my book" lands hardest — and thereafter the app resumes wherever they navigate, exactly as today. A first open of an **unhealthy** book (0 chapters / `UNSTRUCTURED_MANUSCRIPT`) lands on the **Overview** as today, so the author gets the actionable next step ("Make this a chapter"), never an empty Proof.

## 2. The three points, CTO-locked (verbatim intent)

1. **Option B, not A.** A first-open-only nudge, tracked by its own flag — not "Proof as the fallback default", which would re-fire whenever a project has no saved view (more cases than the true first open, depending on how the bit expires). B is precise about intent: *first contact, not a permanent default in disguise.* The one extra stored bit is a negligible cost for that precision.
2. **Render cost accepted as-is** — ~600ms at first contact (ADR-0041). This is exactly the cost S13 (Performance) will remove later; not this chantier's job to hide or work around.
3. **Health-guard fallback is mandatory — the correction condition, not an option.** An author who imports a 0-chapter manuscript and lands on an empty Proof instead of the actionable banner would get the worst message at the worst moment — the inverse of everything the create/split-a-chapter chantier just built. The nudge must not fire on an unhealthy book.

## 3. Mechanism

- **A dedicated flag, distinct from resume-where-left.** Today: `bps.view.<id>` holds the last view (written on every navigation); absent → default `'dashboard'`. Add `bps.proofNudged.<id>` (boolean), set the first time the nudge is *evaluated to completion* (§4.1) so it never fires twice.
- **The nudge fires iff ALL hold:** no saved `bps.view.<id>` (a returning author's saved view ALWAYS wins — the nudge never overrides it), the nudge flag is unset, and the book is healthy (§4.2). Then: view ← `'proof'`, flag ← set.
- **Decided after the project loads, with no flash.** The health signal lives on `project.report`, which loads async — it is not available in the lazy `useState` initializer. But the workspace shows "Opening project…" until `project && facts` are ready (`page.tsx:170-176`), so the nudge is resolved as the project becomes available and the **first station rendered is already the Proof** — never a dashboard-then-proof flash. (The flash-freedom is a verification gate, §5.)

## 4. Two design points inside the locked scope (recommendations to lock)

### 4.1 An unhealthy first open DEFERS the nudge; it does not consume it
If the first open is unhealthy, land on the Overview and **leave the flag unset**, so the **first HEALTHY open** nudges — the author sees their book the first time it is worth seeing (e.g. right after they create a chapter and the manuscript becomes structured). The alternative (consume the flag on any first open, healthy or not) would spend the one "wow" on a broken import and never show the Proof nudge at all. **Recommend defer.** (Flag is set only when the nudge actually fires.)

### 4.2 "Healthy" = the book will render — i.e. not `UNSTRUCTURED_MANUSCRIPT`
The guard's job is "will the Proof show a real book, not an empty/error page?". The render-meaningful blocker is the ADR-0049 `UNSTRUCTURED_MANUSCRIPT` state (`unstructuredFinding(report)`) — a 0-chapter book. **Warnings that do not block rendering (missing ISBN, missing cover) must NOT suppress the nudge** — the Proof renders fine; ISBN is a publish-time concern, and suppressing the author's first sight of their book over a missing ISBN would defeat the feature. **Recommend: nudge iff `!unstructuredFinding(report)`.** A hard render failure is separately handled by `PreviewPanel`'s own RENDER_FAILED degradation (ADR-0049) — out of the nudge's decision, which cannot predict it.

## 5. Verification plan

- **Healthy first open → Proof, once.** First open of a healthy project lands on `'proof'` and sets the flag; a **second** open resumes the last saved view (NOT the Proof again).
- **Returning author's saved view always wins.** With `bps.view.<id>` set, the nudge never fires, regardless of the flag — the author is never pulled away from where they work.
- **Unhealthy first open → Overview, deferred.** A `UNSTRUCTURED_MANUSCRIPT` project's first open lands on `'dashboard'` (the actionable banner), flag unset; after it becomes structured, the next open nudges to `'proof'`. (§4.1.)
- **No flash** — the first station painted is the resolved target, never dashboard-then-proof (§3). Asserted, not eyeballed.
- **Live:** import a healthy manuscript → lands on Proof; import the real 0-chapter `generated-unstyled-3060w.docx` → lands on Overview with the "needs review" banner, not an empty Proof.

## 6. Risks

- **Flash (dashboard before proof)** — the async-health wrinkle (§3). Closed by resolving the view within the load gate and asserting no flash (§5).
- **Nudge firing more than once** — the bit must persist correctly (the same class as the Phase-3 D5 stale-key trap). Closed by the "second open resumes" test.
- **`FIRST_SCREEN_ERROR` interaction** — that recovery removes `bps.view.<id>` for a project that 404s and routes home; it does not reopen, so a leftover `bps.proofNudged.<id>` is harmless (recommend clearing it alongside for tidiness, but it changes no behaviour).
- **Scope creep** — this is Option B only. Dashboard thumbnails (C) and a persistent preview pane (D) are each their own report, not folded in.

## 7. What the CTO is asked to lock
1. **§4.1** — unhealthy first open **defers** the nudge (recommended) vs consumes it.
2. **§4.2** — "healthy" = `!unstructuredFinding` (recommended) vs a stricter no-warnings bar.
3. Confirm the mechanism (§3) and the no-flash requirement (§5) as gates.

**No code until these are locked.**

## Related
`LIVING_PROOF_VISIBILITY_SCOPE.md` (the measured scope — Option B), `FORMATTING_TOOLS_AUDIT.md` (the gap), ADR-0041 (the ~600ms render cost accepted in point 2), ADR-0049 / `CREATE_CHAPTER.md` (the `UNSTRUCTURED_MANUSCRIPT` state the health guard honours — the actionable banner the nudge must not replace), `STRUCTURE_EDITING_PHASE3.md` D5 (the persisted-bit discipline §6 mirrors), `bookFacts.ts` (`unstructuredFinding`, the health signal), `PreviewPanel.tsx` (the Proof the nudge lands on; its own RENDER_FAILED degradation).
