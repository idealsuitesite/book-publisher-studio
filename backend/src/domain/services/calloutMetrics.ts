/**
 * The callout chrome geometry and colours, computed ONCE and consumed by the pagination model
 * and all three renderers (MINI_DR_CALLOUTS §3 — the `dropCapMetrics` pattern: one arithmetic,
 * every consumer; the model and the renderers cannot disagree because they run the same numbers).
 *
 * ONE mechanism (CTO decision D1): a left rule plus an optional very light background tint. The
 * tint policy is the single theme-declared value (`Theme.presentation.callout.tint` — Classic
 * 'none' for B&W-print safety, Modern 'accent'; decision D4). Everything colour-bearing derives
 * from the resolved accent (decision D3: one knob — an author's `accentOverride` re-inks the
 * chrome too). No kinds, no labels (decision D2).
 */

import type { Theme } from '../models/Theme';

/** The rule's width, in points. */
export const CALLOUT_RULE_PT = 2;
/** Breathing room between the rule and the text, in points (also DOCX's `w:space`). */
export const CALLOUT_GAP_PT = 8;
/** Vertical padding above and below the text, inside the chrome, in points. */
export const CALLOUT_PAD_V_PT = 6;

/**
 * How far the tint is mixed from the accent toward paper white (0 = raw accent, 1 = white).
 * THE SHADE KNOB — its value locks only after the CTO's look at real rendered pages
 * (MINI_DR_CALLOUTS §7, the Modern-accent screenshot precedent).
 */
export const CALLOUT_TINT_TOWARD_PAPER = 0.92;

/** Horizontal space the chrome reserves before the text column starts. */
export function calloutTextIndentPt(): number {
  return CALLOUT_RULE_PT + CALLOUT_GAP_PT;
}

/** The rule's colour: the theme's resolved accent — never an independent colour (D3). */
export function calloutRuleColorOf(theme: Theme): string {
  return theme.colors.accent;
}

/**
 * The background tint as a LITERAL hex, or null when the theme declares none. Pre-mixed here —
 * not expressed as opacity — because DOCX `w:shd` and reader CSS both demand a concrete colour;
 * one computed value keeps the three formats on the same ink instead of three divergent
 * opacity interpretations.
 */
export function calloutTintOf(theme: Theme): string | null {
  if (theme.presentation?.callout?.tint !== 'accent') return null;
  const accent = theme.colors.accent.replace(/^#/, '');
  const mix = (channel: number): number => Math.round(channel + (255 - channel) * CALLOUT_TINT_TOWARD_PAPER);
  const toHex = (v: number): string => v.toString(16).padStart(2, '0');
  const r = mix(parseInt(accent.slice(0, 2), 16));
  const g = mix(parseInt(accent.slice(2, 4), 16));
  const b = mix(parseInt(accent.slice(4, 6), 16));
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
