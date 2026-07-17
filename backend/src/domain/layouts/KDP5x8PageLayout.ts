import type { PageLayout } from '../models/PageLayout';

// Dimensions verified in backend/spikes/kdp-trim-size-spike.ts (ADR-0030): KDP's own published
// 5in x 8in paperback trim size, converted at exact 72pt/inch. Margins follow LetterPageLayout's
// existing 1in/72pt convention - see A4PageLayout.ts's comment on scope (real KDP gutter/bleed
// tables by page count are a separate, not-yet-scoped concern).
export const KDP5x8PageLayout: PageLayout = {
  pageSize: 'kdp-5x8',
  width: 360,
  height: 576,
  marginTop: 72,
  marginBottom: 72,
  marginLeft: 72,
  marginRight: 72,
};
