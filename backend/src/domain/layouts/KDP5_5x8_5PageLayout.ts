import type { PageLayout } from '../models/PageLayout';

// Dimensions verified in backend/spikes/kdp-trim-size-spike.ts (ADR-0030): KDP's own published
// 5.5in x 8.5in paperback trim size ("popular for fiction", KDP's own words), converted at exact
// 72pt/inch. Margins follow LetterPageLayout's existing 1in/72pt convention - see A4PageLayout.ts's
// comment on scope.
export const KDP5_5x8_5PageLayout: PageLayout = {
  pageSize: 'kdp-5.5x8.5',
  width: 396,
  height: 612,
  marginTop: 72,
  marginBottom: 72,
  marginLeft: 72,
  marginRight: 72,
};
