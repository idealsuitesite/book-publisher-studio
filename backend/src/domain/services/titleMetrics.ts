/**
 * The chapter-subtitle geometry knob (MINI_DR_SUBTITLE_FIELD §4) — ONE module read by the
 * pagination model and every renderer, the `dropCapMetrics`/`calloutMetrics` pattern: the model
 * and the renderers cannot disagree about the subtitle's size because they run the same ratio
 * against the same title size.
 *
 * The subtitle renders italic at this fraction of its format's own title size (PDF: the 24pt
 * chapter title; DOCX/EPUB: the theme's h1) — one universal treatment (the callout-D1 logic),
 * per-theme values only if the screenshot loop ever demands them.
 *
 * LOCKED at 0.6 — CTO taste stop, 2026-07-22, on the gestured faith-alone page rendered in
 * Novel (the exhibit: `spikes/output/subtitle-novel-p4.png`, the page that exposed the
 * subtitle-drop-cap limitation): "subordonné sans être timide — une seconde ligne de titre,
 * pas une première ligne de prose égarée"; the shared accent binds title and subtitle into one
 * block, the italic alone distinguishes. A future change requires a NEW screenshot loop (the
 * callout-0.96 precedent), never a code-side tweak.
 */
export const CHAPTER_SUBTITLE_RATIO = 0.6;
