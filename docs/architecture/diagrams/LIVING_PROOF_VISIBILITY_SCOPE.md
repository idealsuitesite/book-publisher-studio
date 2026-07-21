# Living-Proof Default Visibility — Scope Report (measured, no code)

**Status:** 📋 SCOPE REPORT — read-only, measured on `main` (`35a4626`). No production code opened (the `GUTTER_SCOPE.md` / `PER_THEME_TUNING_SCOPE.md` format: measure and locate the gap; the CTO decides whether a chantier follows, and at what altitude).
**Date:** 2026-07-21. The last item in the CTO's confirmed queue.
**The gap it measures** (`FORMATTING_TOOLS_AUDIT.md` §1, Living Proof row): the living Proof is *"visible but **not the default view** (Overview is); a non-technical author must navigate to it to notice it."*
**Instrument:** reading the project workspace's view-initialisation (`app/projects/[id]/page.tsx`), the Overview (`BookDashboard`), and the Proof (`PreviewPanel`).

---

## §0 — The measured state: the book's rendered pages are one navigation away from first contact

- **On opening a project the default view is `'dashboard'` (Overview)** — `page.tsx:50-58`: a lazy initial read of resume-where-left (`localStorage 'bps.view.<id>'`), falling back to `return 'dashboard'` when nothing is saved. `setView` writes the key on every navigation (`:63-73`).
- **The Overview is an instant TEXT summary** (`BookDashboard.tsx`): the title in the book's voice + three stat cards (État = pages/chapters, Progression = score with a link to Validation, plus Dernière publication and Prochaine action). It is fast, actionable — and shows **none of the actual rendered book**.
- **The Proof is a separate station** (`'proof'`, `PreviewPanel`): the living, auto-regenerating PDF — the one surface that shows the author their real book, page count read from the produced PDF's own bytes, re-inking on any settings/structure/accent change. It costs a **full pipeline render (~600ms on the large fixture, ADR-0041; S13 owns making it instant)** and is reached only by navigating (Explorer "Proof" / Ctrl+5).

**So the single most convincing surface — the author's book, rendered — is not what they land on.** A non-technical author's first contact is a text dashboard; they must know to click "Proof" to see the point of the product.

## §1 — What bounds every option: resume-where-left, and render cost

Two measured facts shape the whole decision:

1. **The default only fires on a project with NO saved view** (effectively first open). Returning authors resume exactly where they left (`page.tsx:52-53`). So "make the Proof the default" is a **first-impression** change, not a permanent relocation — its blast radius is bounded to the first open of each project, and it never traps a returning author away from where they work.
2. **Any default-Proof option makes project-open render a PDF.** The Overview is instant; the Proof is ~600ms (ADR-0041). At alpha, on the corpus fixtures, that is tolerable, but it is a real cost the instant dashboard does not pay — and it is the thing S13 (Performance) is chartered to remove, not this chantier.

## §2 — A measured nuance that any option must handle: the unhealthy book

The Overview earns its default for **broken imports**: a 0-chapter/`UNSTRUCTURED_MANUSCRIPT` manuscript or a render failure surfaces the dashboard's **Prochaine action** ("0 chapters — needs review", "ISBN not set") — the useful first contact. Landing such a project on the Proof first shows an **empty or errored** proof instead (the `PreviewPanel` does degrade gracefully — RENDER_FAILED gets its own words + Try again, ADR-0049 — but a broken proof is a weaker first contact than an actionable next step). **So a default-Proof option likely wants to fall back to the Overview when the book has blocking findings** — else the intended "wow" becomes a "what's wrong". This is the one real design question, not a detail.

## §3 — The options (for the CTO to weigh — none opened here)

- **A — Proof as the fallback default** (`page.tsx:57` `return 'dashboard'` → `'proof'`, for a project with no saved view), **guarded by §2** (fall back to Overview when the book is unhealthy). One-line view-init change + the health guard. Bounded by §1 (first open only). Cost: first open renders a PDF (§1.2).
- **B — First-open-only nudge to Proof** (land on the Proof once per project, then resume normally thereafter). The gentlest: the author sees their book once, and the app then remembers wherever they choose to work. Same health guard (§2). Distinguishing "never opened" from "opened, chose Overview" needs one more stored bit than today's single key.
- **C — Embed a Proof preview on the Overview** (a first-page thumbnail on the dashboard, keeping it the default). Shows the book *and* keeps the instant, actionable dashboard — but rendering a thumbnail on the dashboard either makes it render a PDF (losing its instant-ness) or needs the **cached engine-rendered thumbnail endpoint** already noted as its own backlog item (PRODUCT_EXPERIENCE §4.3). Bigger, and dependent on that endpoint.
- **D — Persistent side-preview** (a proof pane visible beside every station). The largest UX change — a new permanent zone, its own render-lifecycle and layout work. Its own review, not a "default visibility" tweak.

## §4 — Recommendation

The audit frames this as a **light** change, and §1 confirms it: the default only affects first contact, and resume-where-left already protects returning authors. The lowest-blast-radius honest answers are **A or B** — a change to the view-init logic plus the **§2 health guard** (the one genuine design decision) — surfacing the product's most convincing surface at first contact without trapping anyone or breaking the broken-import experience. **C** (dashboard thumbnail) is heavier and gated on the cached-thumbnail endpoint; **D** (persistent pane) is its own review. Recommend a **mini Level-2** for **A or B**, locking three things before code: which option (A vs B), the render-cost acceptance at alpha (§1.2), and the unhealthy-book fallback (§2).

**Not opened here; measure done; awaiting the CTO's go and altitude. No code before that.**

## Related
`FORMATTING_TOOLS_AUDIT.md` (the gap — Living Proof "not the default view"), `PRODUCT_EXPERIENCE.md` §4.3/§10.1 (the Proof station + resume-where-left, and the cached-thumbnail endpoint Option C would need), ADR-0041 (the ~600ms render cost §1.2 weighs), ADR-0049 (the explorable-error state §2's health guard would honour; `PreviewPanel`'s RENDER_FAILED handling), `MINI_DR_PER_THEME_ACCENT.md` (the Proof re-ink coupling this builds on), `GUTTER_SCOPE.md` (this report's measure-first format).
