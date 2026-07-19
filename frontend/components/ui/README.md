# `components/ui/` — Design System primitives

Sprint 9 Commit 3. Seven primitives, each an independently usable unit: implementation, variants, tests, and no dependency on any business component.

## The one rule that must not erode

**A primitive may never import a feature component or know a domain concept.** A `Button` cannot know what a manuscript is; `Alert` cannot import `ValidationIssueDTO`. Dependencies run one way — feature components depend on `ui/`, never the reverse.

This is ADR-0037's dependency-direction principle in frontend form. It is what lets Sprints 10–17 reuse these without inheriting Sprint 7's feature assumptions, and it is grep-verifiable: no file in this directory should import from `../` or from `shared-types`.

## The primitives

| Primitive | Variants | Notes |
|---|---|---|
| `Button` | `primary`, `secondary`, `link` | Defaults to `type="button"` so it cannot accidentally submit a form |
| `Card` | — | Optional `title` turns it into a named landmark |
| `Alert` | `error`, `warning`, `info`, `success` | Live region; errors and warnings announce assertively, the rest politely |
| `Badge` | same four | Deliberately *not* a live region — it labels, it does not announce |
| `Input` | — | `label` is **required** |
| `Textarea` | — | `label` is **required** |
| `Select` | — | `label` is **required**; wraps a native `<select>` |

Variants are derived from real usage, not invented. `Button`'s two are the two styles the product already uses (`PreviewPanel`'s solid button, `ExportPanel`'s outlined ones). The four severities are the ones the backend already produces — `ValidationIssueDTO`'s ERROR/WARNING/INFO/SUGGESTION and `PublishingReport`'s ERROR/WARNING.

## Two deliberate design decisions

**`label` is a required prop on every form control.** An unlabelled input is the most common accessibility defect in web forms, and Commit 0 measured that this application had zero accessibility affordances of any kind. Making the label part of the type means the compiler stops a caller from shipping an unlabelled field — a structural guarantee rather than a review convention someone has to remember.

**`Select` wraps a native `<select>`.** ADR-0040 Correction 1 warned that a fully accessible hand-rolled Select is closer in difficulty to the headless group (`Dialog`, `Popover`, `Menu`, `Tooltip`) than to `Button`, and asked for an escalation rather than a half-accessible component. That warning is about a *custom listbox* — roving focus, typeahead, screen reader announcements, touch behaviour. A native `<select>` gets all of it from the browser, on every platform, including mobile's native picker. The trade-off is that the dropdown list cannot be styled, which this product does not currently need. **If a future sprint needs a styled or multi-select listbox, that is the moment to reach for a headless library** — as a deliberate decision, not an incremental slide into hand-rolling one.

## Disclosed: three primitives have no consumer yet

`Input`, `Textarea`, and `Select` are **not used anywhere in the product today** — the only form control that exists is a radio inside `FormatSelector`. They are built because Decision 1 locked the list and Sprint 10 (UX & Workflow) will need forms.

This is worth stating plainly because it cuts against this project's own restraint precedent — *"a field is added when a real caller needs it, not in anticipation"* (`PUBLISHING_ENGINE.md`, on `BookMetadata`). Their APIs are deliberately minimal so Sprint 10 can extend them rather than fight them, and if a real form reveals the shape is wrong, changing it is cheap while nothing depends on it.

`Button`, `Card`, `Alert`, and `Badge` all have real consumers waiting in the Commit 5 refactor.

## Testing

Every primitive ships its own tests in the same directory (ADR-0040 Correction 1 — this project has never had a standalone test commit). Run them with `npm test`.

Tests assert behaviour through the accessibility tree — `getByRole`, `getByLabelText`, `toHaveAccessibleDescription` — rather than through class names or test ids wherever possible. A test that passes only because a `div` has the right CSS class would not have caught the defect Commit 0 found, where the application's entire upload affordance was invisible to assistive technology.
