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
 * STARTING POINT, not a lock (CTO): 0.6 is judged on the gestured faith-alone page rendered in
 * Novel at the commit-3 screenshot stop — the page that exposed the subtitle-drop-cap
 * limitation — before it locks.
 */
export const CHAPTER_SUBTITLE_RATIO = 0.6;
