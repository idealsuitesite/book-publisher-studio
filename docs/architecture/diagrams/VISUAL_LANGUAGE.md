# Visual Language — the Studio's Identity — Design Review

**Status:** 🟡 **ROUND 1 — DRAFT. Not approved. Zero code — this is the review the CTO gates ALL premium development on.**
**Date:** 2026-07-19
**Trigger:** the CTO's final pre-development question: *"Pourquoi un auteur aurait-il envie de passer huit heures par jour dans ce logiciel ?"* `PRODUCT_EXPERIENCE.md` is approved architecturally; what remains is not structure but **identity** — ambiance, palette, typography, rhythm, motion, depth, vocabulary, emotion. Governed by `docs/product/DESIGN_MANIFESTO.md` (the separate manifesto the CTO requested).

**The honest ground rule for this document:** words cannot approve colors. Every concrete value below is a **committed starting proposal** — real enough to build P1 against — and the CTO's taste is the final judge **on rendered screenshots**, through the approval loop §8 defines. What this review locks is the *identity concept* and its *system*; what stays open is calibration.

---

## 1. The identity: **L'Atelier**

One concept, chosen over alternatives and named so every future decision can be tested against it:

> **A writer's studio inside a publishing house.** Paper on the desk, ink in the pen, warm lamp light, brass instruments that measure precisely. Digital, but descended from print.

Why this and not "cool graphite pro" (the Affinity/DaVinci family): those tools process *pixels and footage* — neutral dark suits them. Ours processes **books**. A palette descended from paper and ink is not decoration; it is the product's subject matter, and it instantly differentiates us from every gray developer-looking tool — which is precisely the terminal feeling the Manifesto forbids.

The 8-hours answer, in one line: **warm, low-contrast-but-legible surfaces; one calm accent; keyboard-first speed; motion that narrates; and a studio that remembers where you were.** Comfort is engineered, not hoped for.

---

## 2. Light, surfaces, depth — "des feuilles sur un bureau"

**The depth model: sheets of paper on a desk.** No glassmorphism, no neon glows, no floating cards with heavy drop shadows. Elevation = a sheet laid on another:

| Level | Role | Light mode (proposal) | Dark mode (proposal) |
|---|---|---|---|
| `surface-0` canvas | the desk | `#F6F4EF` warm paper | `#181614` warm charcoal |
| `surface-1` panel | a sheet | `#FBFAF7` | `#201D1A` |
| `surface-2` raised | a sheet on the sheet | `#FFFFFF` | `#282420` |
| `surface-3` overlay | a sheet lifted | `#FFFFFF` + shadow | `#2E2A25` + shadow |

- **Borders**: hairline (1px) in warm neutrals — the current heavy `border-2` chrome retires outside the drop zone.
- **Shadows**: two-layer, soft, *warm-tinted* (never pure black): `0 1px 2px rgba(53,42,30,.06), 0 4px 12px rgba(53,42,30,.08)`. Overlays double it.
- **Texture**: exactly one — an almost-subliminal paper grain (≤2% mono noise) on `surface-0` only. Everything above it is clean. One texture is atmosphere; two is wallpaper.
- **Dark mode is the same room at night**: warm charcoals (stone family), never blue-gray zinc. Ink accent lightens; paper grain disappears (grain on dark reads as dirt).

**Ink (text):** light `#211D19` primary / `#7A7168` muted; dark `#ECE8E1` / `#A69C90`. Never pure black on pure white — the single cheapest fatigue reduction there is.

---

## 3. Color — one accent, semantic warmth

- **Accent — "Encre" (printer's Prussian ink):** `#1D4E68` light / `#7FAECB` dark. Used *only* for: primary action, selection, focus ring, active Explorer node. One accent, used sparingly, is what makes it feel considered; a UI where the accent is everywhere has none.
- **Semantic, tuned to the paper world:** success `#2E6B4F` (deep leaf), warning `#9A6210` (amber ink), error `#A83A32` (brick — serious without alarm-red aggression). Existing severity semantics (never color-only meaning) carry over untouched.
- **The book's own colors stay quarantined**: theme colors render inside proofs/thumbnails only, never bleeding into studio chrome — the studio frames the work like a good gallery wall.

Token mapping: `app-*` grows `surface-0..3`, `ink`, `ink-muted`, `accent`, `accent-ink`; the semantic four are retuned in place. The Commit-2 token layer was built for this second act — the refactor is substitution, not surgery.

---

## 4. Typography — the studio's voice and the book's voice, visibly distinct

- **UI face: IBM Plex Sans** (proposal; the screenshot loop may prefer Source Sans 3). Chosen for: humanist warmth without quirkiness, a superb tabular-numeral set (our UI is full of measured numbers — 214 pages, 39,913 words — and they must set like instrument readings), true multilingual coverage, open license.
- **Scale (5 sizes = the 5 weights, on an 8px baseline):** 22/17/14/12.5/11 — display, view title, body, meta, caption. Line-heights snap to the 8px grid.
- **Numbers are a first-class citizen**: tabular figures everywhere metrics appear; counts never jiggle as they change.
- **The signature move — the book speaks in its own type:** everywhere the studio *names* the book (dashboard title, header project name, library card), the title renders in the manuscript's own theme face (Gelasio for Classic). The studio's sans frames it. This is Manifesto vow 1 made visible, it costs nothing (the fonts are already embedded), and it is the detail an author shows their friends.

---

## 5. Rhythm, breathing, space — "les sensations, pas seulement les panneaux"

- **8px base grid**, with a 4px sub-grid *only* inside dense surfaces (Inspector rows, tables, Explorer).
- **Breathing budget**: panel padding 16–20px; between sections 32px; view top margin 24px. Density (PRODUCT_EXPERIENCE §3.2) and breathing are not enemies — density governs *how much lives in a view*, breathing governs *the space between its groups*. A dense view with correct rhythm feels calm; a sparse view with random gaps feels broken.
- **Vertical rhythm rule**: every heading and row height is a multiple of 8; adjacent panels align their first baseline. This alignment — invisible when right, disquieting when wrong — is most of what "élégant" means.
- **Panel geometry**: Explorer 240px (192 collapsed-to-icons), Inspector 280px, both resizable ±25% with persisted widths. Radius: 8px panels, 6px controls, 10px overlays — one family, no 2xl-vs-lg soup.

---

## 6. Motion — narration, never performance

**Grammar**: micro 120ms · panel 200ms · view 280ms; standard ease-out for entries, ease-in-out for morphs; nothing bounces — this is a print house, not a game. `prefers-reduced-motion` honored globally.

**The narrated moments** (each animation exists to *tell what happened*, the CTO's exact criterion):

| Event | Motion |
|---|---|
| Ready-for-Print completes | checks tick **in sequence**, 40ms stagger — the studio audibly "goes down the list" |
| Living proof regenerates | old page dims 40%, new page **re-inks** (fade, 280ms) — never a blank flash |
| Version created | its timeline entry slides in from the "now" edge |
| Save state | the ● pulses **once** — confirmation, not a heartbeat |
| Explorer counts change | number crossfades — no layout jump |
| View change | 12px slide + fade, directional (deeper = from right) |

**The designed WOW — "la mise en place" (once per project open):** the dashboard doesn't pop into existence; it **sets the desk** — a ~500ms choreography where the book's title (in its own face) settles first, then the real metrics take their places with page/word counts counting up from the actual figures, then Ready-for-Print ticks its list. First-open only per session; instant on every navigation after. The wow is the *engine's real numbers arriving like instruments warming up* — magic made of measurements, which is the only magic this product should ever perform.

---

## 7. Vocabulary — the studio's own voice

**Lexicon (one universe, éditorial):**

| Today (technical) | The studio says | Why |
|---|---|---|
| Preview / Generate Preview | **Proof** (the proof updates itself — no verb needed) | *L'épreuve* — the printing term, exact and beautiful |
| Validation | **Ready for Print** (the check run: *"checking your book…"*) | already won; states an outcome, not a process |
| Export | **Editions** — "Create the PDF edition" | downloads become *editions of the book* |
| Publish | **Publish** (unchanged) | already the right word |
| History | **Story** is too cute — **History** stays, but its content is a *timeline* | restraint is part of voice |
| Import | **Bring in a manuscript** | the studio receives a manuscript; it doesn't ingest a file |

**Copy voice rules**: calm, active, second person, zero technical vocabulary in the author's sight (no formats jargon, no status codes); every error states *what*, *why it matters*, *what to do* — the intelligent-findings contract (PRODUCT_EXPERIENCE round 2) is the same rule applied to the engine. English UI (Q-B locked); this lexicon is designed to translate cleanly into French (*Épreuve, Éditions, Prêt à imprimer*) when i18n arrives.

---

## 8. Modes — Focus, and the room's configurations

The CTO's modes, mapped honestly onto what exists and what is coming:

- **Production** (default today): full room — Explorer, Workspace, Inspector.
- **Publishing**: the room turned toward shipping — Publish view centered, Inspector on destination facts. Real now.
- **Focus**: everything folds but the Workspace (proof or, later, the editor page) — one keystroke in, one out. Real now for Proof; becomes the writing sanctuary when the editor lands.
- **Writing** (with the S10+ editor): reserved, designed with `EDITOR_EXPERIENCE.md` — *not* mocked before.

Modes are zone-configurations, not new screens — which is why they cost little and never lie.

---

## 9. The approval loop (how taste actually gets decided)

1. This review's system → CTO validates the **concept** (L'Atelier, the systems above).
2. P1 builds the shell in the proposed values → **screenshot set to the CTO** (light + dark, Home + dashboard + one dense view).
3. CTO adjusts by naming feelings, not hex codes ("plus chaud", "trop sombre", "l'accent crie") → one calibration round per phase.
4. Locked values graduate into `app-*` tokens; the baseline captures them; drift becomes visible forever after.

Three screenshot-loop questions travel with it: warm-paper vs a *slightly* cooler paper (§2's values lean warm); Plex Sans vs Source Sans 3 (§4); accent depth (§3's Prussian vs a darker slate-ink).

## Related

`docs/product/DESIGN_MANIFESTO.md` (the vows this system serves), `PRODUCT_EXPERIENCE.md` (the architecture this dresses — approved round 2), `UI_FOUNDATION.md` (the token layer §3 extends), ADR-0023 (the embedded fonts §4's signature move reuses), `EDITOR_EXPERIENCE.md` (future review §8 reserves Writing mode for).
