import type { PageLayout } from '../models/PageLayout';

// Dimensions verified in backend/spikes/kdp-trim-size-spike.ts (ADR-0030) against PDFKit's own
// real runtime A5 page size, cross-checked against ISO 216's 148mm x 210mm. Margins follow
// LetterPageLayout's existing 1in/72pt convention - see A4PageLayout.ts's comment on scope.
export const A5PageLayout: PageLayout = {
  pageSize: 'a5',
  width: 419.53,
  height: 595.28,
  marginTop: 72,
  marginBottom: 72,
  marginLeft: 72,
  marginRight: 72,
};
