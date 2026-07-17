import type { PageLayout } from '../models/PageLayout';

// Dimensions verified in backend/spikes/kdp-trim-size-spike.ts (ADR-0030) against PDFKit's own
// real runtime A4 page size, cross-checked against ISO 216's 210mm x 297mm. Margins follow
// LetterPageLayout's existing 1in/72pt convention - real KDP-style bleed/gutter tables are a
// separate, not-yet-scoped concern, not silently assumed correct for print here.
export const A4PageLayout: PageLayout = {
  pageSize: 'a4',
  width: 595.28,
  height: 841.89,
  marginTop: 72,
  marginBottom: 72,
  marginLeft: 72,
  marginRight: 72,
};
