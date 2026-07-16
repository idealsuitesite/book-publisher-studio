# Vision — Book Publisher Studio (2-3 Year Horizon)

This document describes what Book Publisher Studio should become, not what exists today. `docs/CURRENT_STATE.md` is the source of truth for what's actually built; this file exists so every sprint can be checked against where the product is headed, not just what's next on a list.

## Mission (recap)

Professional publishing software — import, analyze, structure, format, and export books — for authors, publishers, educators, universities, and independent creators. Global, not tied to any single audience, language, or region. Competes with Atticus on UX and AI-powered workflow.

## Target Architecture (end state)

The Clean Architecture / Hexagonal / DDD foundation already in place (Domain → Application → Infrastructure/Presentation, ports and adapters, `UseCase<TRequest,TResponse>` everywhere) does not change as the product grows — new capability is added as new Domain services, new ports, new Infrastructure adapters, and new plugins, never by bending the existing layers. Concretely, the target Domain layer includes:

- **Book AST** (built) — the single source of truth every feature below reads from or writes to
- **Typography Engine** — widow/orphan control, hyphenation, smart quotes, drop caps, ligatures, small caps, keep-with-next rules, Bible-verse formatting
- **Layout Engine** — pagination, margins, headers/footers, chapter-opening-page rules, TOC generation, print optimization
- **Theme Engine** — themes as independent, swappable packages (fonts, sizes, colors, spacing, per-block styles, layout + typography bundled per theme)
- **Validator Engine** — today's `BookValidator` is structural-only; the full version adds readability scoring, completeness scoring, and typography-issue detection
- **Plugin System** — sandboxed, versioned plugins operating on the Book AST

None of these exist yet except the Book AST and a structural `BookValidator`. Building them is Sprint 2-4 work (see Roadmap below).

## Export Targets

**Now:** DOCX, PDF, EPUB, HTML, Markdown
**Later:** Kindle, Apple Books, Kobo, Lulu, IngramSpark, Amazon KDP — each a new `IRenderer` implementation behind the same port, no Domain changes required

## Plugin System (design now, build later)

Plugins operate on a `Book` and return either an updated `Book` or a list of validation issues — never partial mutations, never side effects outside what they're explicitly given. Planned first-party plugins: Bible Reference verification, Translation, AI Proofreading, Grammar checking, Index Generator, Glossary builder, ISBN validation, QR code generation, marketing-asset export extensions.

## Theme Marketplace

Themes are already scoped as independent packages (Classic, Modern, Academic, Novel, Minimal, Premium, Dark, Theology, ...). Once the Theme Engine exists, this becomes a distribution point: free themes ship with the product, premium/community themes are installable packages — the same mechanism as the plugin system, just themed. This is a monetization surface, not just a styling feature (see Licensing below).

## AI Features — Explicitly Not MVP

The architecture must stay extensible for these; none should be built before Sprint 6+, and none should force Domain or Application code to know about any specific AI provider:

- Rewrite, grammar, translation assistance
- Book/chapter summarization
- Bible-verse verification, theology-consistency checking
- Cover generation, illustration generation
- Marketing-asset generation, metadata generation, SEO generation

Each of these should land as a Plugin, not as a new Domain concept — the plugin interface already anticipated this (`AIProofreadingPlugin`, `TranslationPlugin`, etc. were named as examples when the plugin system was first designed).

## Licensing & Commercial Model — Design Now, Activate Later

No database, no auth, and no payment processing exist yet — none of this is built. The shape it should take when it is:

| Tier | Books | Pages/book | Formats | Themes | Plugins | Cloud | Collaborators |
|---|---|---|---|---|---|---|---|
| Free | 1 | 50 | PDF, DOCX | Classic, Minimal | none | 0 GB | 0 |
| Starter | 5 | 300 | + EPUB | + Modern, Academic | Bible Reference, Glossary | 5 GB | 1 |
| Professional | 100 | 1000 | + HTML, Kindle | + Premium, Dark | + Index Generator, Translation | 100 GB | 5 |
| Enterprise | ∞ | ∞ | + custom | all | all | ∞ | ∞ |

A `LicenseEngine` (Domain) checks feature flags before an export/plugin runs; a `Subscription` record (Infrastructure, once a database exists) tracks plan, activation, and renewal. Feature flags should be remotely configurable so plan changes don't require a deploy. None of this is scoped for Sprint 2-5.

## Collaboration & Cloud

Multi-user collaboration and cloud sync are Enterprise-tier, post-MVP features requiring a persistence layer that doesn't exist yet (see `BASELINE_v0.1.md` §6: "Commit 20+: Multi-user collaboration (persistence layer)"). Not scoped until the licensing model above has a real backend to attach to.

## UI/UX Direction

Once Sprint 5 (Premium UI) starts: interface quality inspired by Atticus, Notion, Linear, Figma, Apple, and Adobe — not a developer tool aesthetic. Concretely: drag-and-drop manuscript import, live preview, instant formatting feedback, real-time word count/page count/reading time, chapter navigation, theme switching, a split editor view, print preview, dark and light mode, rounded corners and generous spacing over dense utilitarian layouts.

## Observability & Production Readiness

Structured logging, metrics collection, error tracking, and health checks (`Logger`, `MetricsCollector`, `ErrorTracker`, `HealthCheck`) were designed in an earlier architecture pass but nothing is implemented — there's no deployed service to observe yet. This becomes relevant once there's a real backend serving real users (Beta stage, see below), not before.

## Product Stage Progression

```
MVP → Beta → Public Beta → Commercial Launch → Enterprise
```

- **MVP** (Sprint 1-5, in progress): import pipeline, rendering engines, DOCX/PDF/EPUB export, validator, typography engine, premium UI. No accounts, no payments, no cloud.
- **Beta**: real users, no billing yet. First point where observability (above) and basic error tracking start to matter.
- **Public Beta**: licensing tiers activate (Free/Starter tiers only), feature flags live, first persistence layer (accounts, saved books).
- **Commercial Launch**: full licensing tiers, payment processing, Professional/Enterprise plans, plugin marketplace, theme marketplace.
- **Enterprise**: collaboration, cloud sync, custom licensing, dedicated support.

Every sprint plan in `docs/TODO.md` and `docs/ROADMAP.md` should be checkable against which stage it belongs to. Building Enterprise-stage features (collaboration, licensing enforcement, telemetry) during the MVP stage is scope creep against this vision, not progress — that's why they're repeatedly marked "explicitly deferred" rather than silently built early.

## What This Document Is Not

Not a spec to implement literally, feature-by-feature, right now. Not a commitment to exact tier pricing, exact plugin names, or exact theme names — those are illustrative of shape, not final. It's a check: before starting a sprint, does the work move the product toward this, or away from it?
