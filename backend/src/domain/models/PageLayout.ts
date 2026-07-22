export interface PageLayout {
  pageSize: 'letter' | 'a4' | 'a5' | 'kdp-5x8' | 'kdp-5.5x8.5' | 'kdp-6x9';
  width: number;
  height: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
}

/**
 * The GUARANTEED binding-side (inside/gutter) margin of a layout, in points
 * (MINI_DR_GUTTER_VALIDATION §2.1 — the "inside-margin notion in the model").
 *
 * A derivation, deliberately NOT a stored field: margins are symmetric and unmirrored today, so
 * the binding side alternates — on a recto (odd) page the inside is the LEFT margin, on a verso
 * the RIGHT — and the guarantee that holds on *every* page is the minimum of the two. A stored
 * `insideMargin` the renderer never applies would be a lie in the model.
 *
 * THE ONE SEAM TO UPDATE when real inside/outside mirroring lands (GUTTER_SCOPE §4 option 2,
 * explicitly not built now): that future review replaces this min() with the real inside value,
 * and every consumer (today: the KDP MarginComplianceRule) follows without change.
 */
export function insideMarginOf(layout: PageLayout): number {
  return Math.min(layout.marginLeft, layout.marginRight);
}
