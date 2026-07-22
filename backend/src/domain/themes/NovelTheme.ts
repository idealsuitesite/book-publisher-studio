import type { Theme } from '../models/Theme';

// The third Book Presentation theme (THIRD_THEME_NOVEL.md, CTO direction A "Novel",
// 2026-07-22). The literary interior: Gelasio throughout, a generous title rhythm, the
// printed-novel running head — and, the defining choice, **the first theme to LIGHT the
// drop-cap capability** (`MINI_DR_DROP_CAPS`): every chapter opens on a real tri-format
// drop cap, the aspect decision that chantier shipped dark and reserved for a theme.
//
// The three-theme fan this completes (CTO reasoning, ranked): Classic = sober, B&W-safe;
// Modern = contemporary, visible accent, tinted callouts; Novel = literary, ornamented, warm.
//
// The accent shade is a SCREENSHOT-LOOP decision (the #1D4E68 and callout-0.96 precedents):
// #6E3B2F is the warm russet STARTING POINT, judged on real pages before it locks. lineHeight
// stays 1.4 on purpose — spacing.lineHeight is not a real PDF knob today (typography scope,
// measured), so a "larger leading" identity would lie in the format that matters most.
export const NovelTheme: Theme = {
  name: 'novel',
  fonts: {
    heading: 'Georgia', // -> embedded Gelasio; literary warmth, both roles serif (CTO sub-decision 1)
    body: 'Georgia',
  },
  fontSizes: {
    h1: 28,
    h2: 22,
    h3: 18,
    h4: 16,
    h5: 14,
    h6: 12,
    body: 11, // deliberately the shared default (CTO sub-decision 5) — the own-default identity stays Academic's argument
    small: 9,
  },
  colors: {
    text: '#000000',
    accent: '#6E3B2F', // warm and sober (CTO sub-decision 6) — the exact shade is the screenshot loop's
  },
  spacing: {
    paragraphSpacing: 8,
    headingSpacing: 18, // more generous than Classic's 16 — the literary breathing room
    lineHeight: 1.4,
    titleSpaceBefore: 22, // the generous title rhythm (Classic 18/8, Modern 14/6), above > below held
    titleSpaceAfter: 10,
  },
  runningHead: {
    show: true,
    position: 'right',
    content: 'chapterTitle', // the printed-novel convention — the FIRST consumer of this value
    pageNumber: true,
    uppercase: false,
    size: 9,
  },
  presentation: {
    // THE defining difference: drop caps ON at chapter openings, the chantier-proven scale
    // (CTO sub-decision 2). Classic and Modern stay 'none' — their parity locks are untouched;
    // Novel's own lock is born WITH the ornament priced in.
    dropCap: { scope: 'chapterOpening', scale: 2.5 },
    // Rule-only callouts (CTO sub-decision 3): printed novels are overwhelmingly B&W — the
    // Classic logic, with the rule inked in Novel's warm accent.
    callout: { tint: 'none' },
  },
};
