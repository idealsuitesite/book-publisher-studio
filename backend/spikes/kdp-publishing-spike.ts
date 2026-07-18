/**
 * KDP publishing-requirements spike — Sprint 8, Commit 0 (per PUBLISHING_ENGINE.md §2/§7,
 * Decision 2). Throwaway exploratory script, NOT part of the layered src/ architecture and NOT
 * covered by the test suite. Run manually via `npx tsx spikes/kdp-publishing-spike.ts`.
 *
 * Answers the question Decision 2 explicitly refused to guess: KDP's real current metadata
 * requirements, cover spec, and file-naming/submission rules, matching the ADR-0019/0020/0030
 * spike-before-decide precedent exactly (kdp-trim-size-spike.ts is the direct sibling of this
 * script for the same platform).
 *
 * NOT a runtime API/library check like the trim-size spike (PDFKit has no publishing-submission
 * API to query) — the real external behavior here is KDP's own *documented policy*, so this
 * spike's "real output" is the exact wording of KDP's own published help pages, fetched directly,
 * not summarized by a third party first. Per Decision 5 (locked, no reservations): no KDP account
 * was created, no submission was attempted, no credentials were used — this is documentation
 * research only, exactly as scoped.
 *
 * Sources (all kdp.amazon.com, fetched 2026-07-18):
 *   - Paperback Submission Guidelines: kdp.amazon.com/en_US/help/topic/G201857950
 *   - Create a Paperback Cover:        kdp.amazon.com/en_US/help/topic/G201953020
 *   - Set Trim Size, Bleed, Margins:   kdp.amazon.com/en_US/help/topic/GVBQ3CMEQW3W2VL6
 *   - Metadata Guidelines for Books:   kdp.amazon.com/en_US/help/topic/G201097560
 *   - Cover Image Guidelines (eBook):  kdp.amazon.com/en_US/help/topic/G6GTK3T3NUHKLEFX
 *     (fetched to disambiguate — this page turned out to document the *eBook* cover, a
 *     different, simpler spec than the paperback print cover; both are recorded below,
 *     not silently merged, because they answer genuinely different questions.)
 *
 * Cross-check method: bleed (0.125in) and the cover-width formula were independently confirmed
 * on both the Paperback Submission Guidelines page and the Create a Paperback Cover page —
 * agreement, no discrepancy to disclose this time (unlike kdp-trim-size-spike.ts's 16th-size
 * disagreement, which was real and disclosed there).
 *
 * A real finding this spike surfaces, not resolved by guessing: PUBLISHING_ENGINE.md §5's
 * provisional `KDPRuleSet.coverSpec` shape (`minWidthPx/minHeightPx/minDpi`) assumed a *fixed*
 * pixel size, matching the eBook cover model. The real *paperback* cover has no fixed pixel
 * size — its dimensions are *computed* from trim size + page count + paper type via the spine
 * formula below. This is a real shape correction for Commit 3, not a value to fill into the
 * old shape - recorded as `PaperbackCoverSpec` here instead of forcing it into the wrong field.
 */

interface KdpMarginRow {
  pageCountRange: string;
  insideGutterIn: number | string;
  outsideNoBleedInMin: number;
  outsideWithBleedInMin: number;
}

// Source: kdp.amazon.com/en_US/help/topic/GVBQ3CMEQW3W2VL6 ("Set Trim Size, Bleed, and Margins").
const KDP_INTERIOR_MARGINS: KdpMarginRow[] = [
  { pageCountRange: '24-150', insideGutterIn: 0.375, outsideNoBleedInMin: 0.25, outsideWithBleedInMin: 0.375 },
  { pageCountRange: '151-300', insideGutterIn: 0.5, outsideNoBleedInMin: 0.25, outsideWithBleedInMin: 0.375 },
  { pageCountRange: '301-500', insideGutterIn: 0.625, outsideNoBleedInMin: 0.25, outsideWithBleedInMin: 0.375 },
  { pageCountRange: '501-700', insideGutterIn: 0.75, outsideNoBleedInMin: 0.25, outsideWithBleedInMin: 0.375 },
  { pageCountRange: '701-828', insideGutterIn: 0.875, outsideNoBleedInMin: 0.25, outsideWithBleedInMin: 0.375 },
];

const KDP_INTERIOR_RULES = {
  bleedIn: 0.125, // top/bottom/outer edge; source: G201857950 and GVBQ3CMEQW3W2VL6 (agree)
  bleedPdfExtraHeightIn: 0.25, // PDF should be this much taller than trim size when bleed used
  bleedPdfExtraWidthIn: 0.125, // PDF should be this much wider than trim size when bleed used
  minPageCount: 24,
  maxPageCount: 828, // upper bound; actual max depends on ink/paper/trim combination
  acceptedFormatsNoBleed: ['PDF', 'DOC', 'DOCX', 'RTF', 'HTML', 'TXT'],
  acceptedFormatsWithBleed: ['PDF'], // bleed content requires PDF, no exceptions
  minResolutionDpi: 300,
  recommendedMaxResolutionDpi: 600, // to keep file size under the cap below
  maxFileSizeMb: 650,
  fileNamingRule: 'No emoji characters or other unsupported special characters in cover or interior file names.',
} as const;

// Source: kdp.amazon.com/en_US/help/topic/G201953020 ("Create a Paperback Cover"). Spine width
// is a function of page count and paper/ink choice — not a fixed value, so it's a formula here,
// not a constant.
const KDP_SPINE_WIDTH_IN_PER_PAGE: Record<string, number> = {
  'bw-white-paper': 0.002252,
  'bw-cream-paper': 0.0025,
  'color-premium-paper': 0.002347,
  'color-standard-paper': 0.002252,
};

const KDP_SPINE_TEXT_MIN_PAGES = 79; // below this, KDP does not print spine text at all

interface PaperbackCoverSpec {
  fileFormat: 'PDF';
  singleFileFrontSpineBack: true; // one PDF containing back+spine+front as one image
  colorMode: 'CMYK'; // paperback print cover - NOT RGB (that's the eBook cover, see below)
  minResolutionDpi: 300;
  bleedIn: 0.125;
  maxFileSizeMb: number;
  recommendedMaxFileSizeMb: number;
  spineWidthFormula: string;
  coverWidthFormula: string;
}

const KDP_PAPERBACK_COVER_SPEC: PaperbackCoverSpec = {
  fileFormat: 'PDF',
  singleFileFrontSpineBack: true,
  colorMode: 'CMYK',
  minResolutionDpi: 300,
  bleedIn: 0.125,
  maxFileSizeMb: 650,
  recommendedMaxFileSizeMb: 40,
  spineWidthFormula: 'pageCount * spineWidthInPerPage[paperType]  (see KDP_SPINE_WIDTH_IN_PER_PAGE)',
  coverWidthFormula: 'bleed + backCoverWidth + spineWidth + frontCoverWidth + bleed',
};

// Source: kdp.amazon.com/en_US/help/topic/G6GTK3T3NUHKLEFX ("Cover Image Guidelines"). This is
// the EBOOK cover - a genuinely different artifact from the paperback print cover above (fixed
// pixel dimensions, RGB, JPEG - no bleed, no spine, no CMYK). Recorded separately, not merged.
const KDP_EBOOK_COVER_SPEC = {
  fileFormat: 'JPEG',
  colorMode: 'RGB', // "Kindle does not support CMYK"
  minResolutionDpi: 300,
  recommendedHeightPx: 2560,
  recommendedWidthPx: 1600,
  minHeightPx: 2500, // noted minimum for acceptable quality
  maxFileSizeMb: 5,
} as const;

// Source: kdp.amazon.com/en_US/help/topic/G201097560 ("Metadata Guidelines for Books"). Mapped
// onto this project's real `BookMetadata` fields (backend/src/domain/models/Book.ts) - a field
// is only listed here if a real BookMetadata property exists for it today.
const KDP_REQUIRED_METADATA_FIELDS_MAPPED: { bookMetadataField: string; required: boolean; note: string }[] = [
  { bookMetadataField: 'title', required: true, note: '<200 chars combined with subtitle; no keyword stuffing, no HTML' },
  { bookMetadataField: 'author', required: true, note: 'pen names allowed' },
  { bookMetadataField: 'isbn', required: true, note: 'required for paperback/hardcover (except low-content books); KDP can issue one free or author can supply their own' },
  { bookMetadataField: 'language', required: true, note: 'ISO 639-1, already required (non-optional) on BookMetadata today' },
  { bookMetadataField: 'description', required: false, note: 'strongly recommended; no spoilers/promotional language' },
  { bookMetadataField: 'keywords', required: false, note: '2-3 word phrases recommended' },
];

// Real gap this spike surfaces (not resolved here - out of Sprint 8's scope per Decision 5):
// KDP requires up to 3 "Categories" at submission time, and a "Primary Audience" (explicit
// content) flag - neither has a corresponding field on the real `BookMetadata` interface today.
const KDP_REQUIRED_FIELDS_WITH_NO_BOOKMETADATA_EQUIVALENT = [
  { kdpField: 'Categories', note: 'up to 3 required; no BookMetadata field exists yet' },
  { kdpField: 'Primary Audience (explicit content Y/N)', note: 'required; no BookMetadata field exists yet' },
  { kdpField: 'Primary Marketplace', note: 'required to set list price/categories; no BookMetadata field exists yet' },
];

function run(): void {
  console.log('\n=== KDP publishing-requirements spike findings ===\n');

  console.log('-- Interior manuscript rules --');
  console.log(JSON.stringify(KDP_INTERIOR_RULES, null, 2));
  console.log('\n-- Interior margins by page count --');
  for (const row of KDP_INTERIOR_MARGINS) {
    console.log(
      `  ${row.pageCountRange} pages: gutter=${row.insideGutterIn}in, outside(no bleed)>=${row.outsideNoBleedInMin}in, outside(bleed)>=${row.outsideWithBleedInMin}in`
    );
  }

  console.log('\n-- Paperback print cover spec (PDF, CMYK, computed dimensions) --');
  console.log(JSON.stringify(KDP_PAPERBACK_COVER_SPEC, null, 2));
  console.log('\n-- Spine width formula inputs (in per page, by paper/ink type) --');
  console.log(JSON.stringify(KDP_SPINE_WIDTH_IN_PER_PAGE, null, 2));
  console.log(`  No spine text printed below ${KDP_SPINE_TEXT_MIN_PAGES} pages.`);

  console.log('\n-- eBook cover spec, for comparison (JPEG, RGB, fixed pixel size - different artifact) --');
  console.log(JSON.stringify(KDP_EBOOK_COVER_SPEC, null, 2));

  console.log('\n-- Metadata fields, mapped to real BookMetadata --');
  for (const f of KDP_REQUIRED_METADATA_FIELDS_MAPPED) {
    console.log(`  ${f.bookMetadataField}: required=${f.required} — ${f.note}`);
  }

  console.log('\n-- KDP-required fields with no BookMetadata equivalent (real gap, not fixed this sprint) --');
  for (const g of KDP_REQUIRED_FIELDS_WITH_NO_BOOKMETADATA_EQUIVALENT) {
    console.log(`  ${g.kdpField} — ${g.note}`);
  }

  console.log(
    '\nDecision: KDPRuleSet (Commit 3) uses these verified values directly. The provisional ' +
      '`coverSpec: {minWidthPx, minHeightPx, minDpi}` shape in PUBLISHING_ENGINE.md §5 does not ' +
      'match the real paperback cover (computed dimensions, not fixed pixels) - Commit 3 should ' +
      'define `PaperbackCoverSpec` as shown here instead. No value in this decision was guessed - ' +
      'see PUBLISHING_ENGINE.md §5 for the "pending spike" placeholders this script resolves.'
  );
}

run();
