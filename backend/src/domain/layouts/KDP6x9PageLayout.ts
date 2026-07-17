import type { PageLayout } from '../models/PageLayout';

// Dimensions verified in backend/spikes/kdp-trim-size-spike.ts (ADR-0030): KDP's own published
// 6in x 9in paperback trim size ("the most common trim size for books in the U.S.", KDP's own
// words), converted at exact 72pt/inch. Margins follow LetterPageLayout's existing 1in/72pt
// convention - see A4PageLayout.ts's comment on scope.
export const KDP6x9PageLayout: PageLayout = {
  pageSize: 'kdp-6x9',
  width: 432,
  height: 648,
  marginTop: 72,
  marginBottom: 72,
  marginLeft: 72,
  marginRight: 72,
};
