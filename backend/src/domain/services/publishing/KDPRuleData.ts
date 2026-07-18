import type { BookMetadata } from '../../models/Book';

export interface KDPMarginRow {
  maxPages: number;
  gutterIn: number;
  outsideMinIn: number;
}

export interface KDPRuleData {
  requiredMetadataFields: (keyof BookMetadata)[];
  interiorSpec: {
    minResolutionDpi: number;
    bleedIn: number;
    marginsByPageCount: KDPMarginRow[];
    minPageCount: number;
    maxPageCount: number;
    acceptedFormats: ('pdf' | 'epub' | 'docx')[];
  };
  paperbackCoverSpec: {
    fileFormat: 'PDF';
    colorMode: 'CMYK';
    minResolutionDpi: number;
    bleedIn: number;
    spineWidthInPerPage: Record<string, number>;
    spineTextMinPages: number;
  };
}

// Real values verified by the Commit-0 spike (backend/spikes/kdp-publishing-spike.ts, ADR-0035),
// transcribed directly from that spike's findings - not re-derived here. Inert data, never
// imported by SubmissionValidator directly - only KDPRuleProvider touches it (Decision 7).
export const KDP_RULE_DATA: KDPRuleData = {
  requiredMetadataFields: ['title', 'author', 'isbn', 'language'],
  interiorSpec: {
    minResolutionDpi: 300,
    bleedIn: 0.125,
    marginsByPageCount: [
      { maxPages: 150, gutterIn: 0.375, outsideMinIn: 0.25 },
      { maxPages: 300, gutterIn: 0.5, outsideMinIn: 0.25 },
      { maxPages: 500, gutterIn: 0.625, outsideMinIn: 0.25 },
      { maxPages: 700, gutterIn: 0.75, outsideMinIn: 0.25 },
      { maxPages: 828, gutterIn: 0.875, outsideMinIn: 0.25 },
    ],
    minPageCount: 24,
    maxPageCount: 828,
    // KDP's accepted paperback interior formats (PDF/DOC/DOCX/RTF/HTML/TXT), intersected with
    // what this engine's Renderer<TOutput> can actually produce (pdf/epub/docx) - epub is not a
    // KDP paperback interior format at all (it's Kindle's separate ebook format).
    acceptedFormats: ['pdf', 'docx'],
  },
  paperbackCoverSpec: {
    fileFormat: 'PDF',
    colorMode: 'CMYK',
    minResolutionDpi: 300,
    bleedIn: 0.125,
    spineWidthInPerPage: {
      'bw-white-paper': 0.002252,
      'bw-cream-paper': 0.0025,
      'color-premium-paper': 0.002347,
      'color-standard-paper': 0.002252,
    },
    spineTextMinPages: 79,
  },
};
