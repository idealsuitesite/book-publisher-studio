/**
 * KDP/platform trim-size spike — Sprint 6, Commit 0 (per PROFESSIONAL_LAYOUT_ENGINE.md §3/§8,
 * ADR-0029). Throwaway exploratory script, NOT part of the layered src/ architecture and NOT
 * covered by the test suite. Run manually via `npx tsx spikes/kdp-trim-size-spike.ts`.
 *
 * Answers the question the Design Review explicitly refused to guess: exact point dimensions for
 * new `PageLayout` presets (A4, A5, KDP-relevant trim sizes), sourced from real published specs,
 * matching the ADR-0019/0020 spike-before-decide precedent.
 *
 * Two independent verification methods, not a single trusted source:
 *   1. A4/A5 — instantiate a REAL PDFKit document with `size: 'A4'|'A5'` (the exact library
 *      PDFRenderer already depends on) and read back its own computed `doc.page.width/height` in
 *      points. This is PDFKit's own real runtime output, not a value copied from its source or a
 *      README - the same "verify against real output" discipline as pdfkit-spike.ts.
 *   2. KDP trim sizes — Amazon KDP publishes trim sizes in inches, not points, and ships no
 *      library constant to verify against. Fetched directly from KDP's own published help page
 *      (https://kdp.amazon.com/en_US/help/topic/GVBQ3CMEQW3W2VL6, "Set Trim Size, Bleed, and
 *      Margins", accessed 2026-07-17) rather than a third-party summary - cross-checked against a
 *      second independent listing (kdpprintcover.com/faq/kdp-trim-sizes-available/) which agreed
 *      on 15 of 16 sizes and disagreed only on one (8.25"x11" vs. 8.27"x11.69" as the 16th "large
 *      format" size); the direct KDP fetch was re-run a second time and returned 8.27"x11.69" both
 *      times, so that value is treated as authoritative here - a real, disclosed discrepancy, not
 *      silently resolved by picking whichever number "looks rounder."
 *      Converted to points at the standard, unambiguous 72pt/inch (same unit PDFKit and this
 *      project's own `LetterPageLayout` already use for a US-inches trim size: 8.5in*72=612,
 *      11in*72=792) - exact arithmetic, not re-rounded.
 *
 * Scope decision (not guessed - see findings below): of KDP's 16 published paperback trim sizes,
 * this spike identifies exactly 3 as "KDP-relevant" for a first `PageLayout` preset set - the 3
 * KDP's own help page and independent guides repeatedly single out by name as the common sizes an
 * actual author would pick (most non-fiction: 6x9; popular fiction: 5.5x8.5; compact/mass-market
 * fiction: 5x8) - not all 16, which would be unused surface area with no current caller, the same
 * restraint already applied to `RunningHead` (ADR-0029 Risk 5) and `ValidationContext` (Sprint 5).
 * The remaining 13 are recorded below for a future session to add on demand, not guessed now.
 */
import PDFDocument from 'pdfkit';

const PT_PER_INCH = 72;

interface KdpSize {
  name: string;
  widthIn: number;
  heightIn: number;
  note: string;
}

// Full 16-size KDP paperback catalog, as published, for the record (not all implemented this
// sprint - see scope decision above). Source: kdp.amazon.com/en_US/help/topic/GVBQ3CMEQW3W2VL6.
const KDP_ALL_SIZES: KdpSize[] = [
  { name: '5x8', widthIn: 5, heightIn: 8, note: 'regular; compact/mass-market fiction' },
  { name: '5.06x7.81', widthIn: 5.06, heightIn: 7.81, note: 'regular' },
  { name: '5.25x8', widthIn: 5.25, heightIn: 8, note: 'regular' },
  { name: '5.5x8.5', widthIn: 5.5, heightIn: 8.5, note: 'regular; popular for fiction' },
  { name: '6x9', widthIn: 6, heightIn: 9, note: 'regular; most common trim size for books in the U.S. (KDP’s own words)' },
  { name: '6.14x9.21', widthIn: 6.14, heightIn: 9.21, note: 'large' },
  { name: '6.69x9.61', widthIn: 6.69, heightIn: 9.61, note: 'large' },
  { name: '7x10', widthIn: 7, heightIn: 10, note: 'large' },
  { name: '7.44x9.69', widthIn: 7.44, heightIn: 9.69, note: 'large' },
  { name: '7.5x9.25', widthIn: 7.5, heightIn: 9.25, note: 'large' },
  { name: '8x10', widthIn: 8, heightIn: 10, note: 'large' },
  { name: '8.25x6', widthIn: 8.25, heightIn: 6, note: 'large (landscape)' },
  { name: '8.25x8.25', widthIn: 8.25, heightIn: 8.25, note: 'large (square)' },
  { name: '8.5x8.5', widthIn: 8.5, heightIn: 8.5, note: 'large (square)' },
  { name: '8.5x11', widthIn: 8.5, heightIn: 11, note: 'large; coloring/workbooks/puzzle books' },
  { name: '8.27x11.69', widthIn: 8.27, heightIn: 11.69, note: 'large; A4-equivalent international non-fiction (re-fetched twice, consistent - see header note on the 16th-size discrepancy)' },
];

// The 3 selected as this sprint's actual PageLayout presets (scope decision above).
const KDP_SELECTED = ['5x8', '5.5x8.5', '6x9'];

function inchesToPoints(inches: number): number {
  return Math.round(inches * PT_PER_INCH * 100) / 100;
}

function run(): void {
  const results: string[] = [];

  // 1. A4/A5 - verified against a REAL PDFKit document's own computed page size, not a copied
  // constant. This is the exact library PDFRenderer instantiates today.
  const a4Doc = new PDFDocument({ size: 'A4', autoFirstPage: true });
  const a4Width = a4Doc.page.width;
  const a4Height = a4Doc.page.height;

  const a5Doc = new PDFDocument({ size: 'A5', autoFirstPage: true });
  const a5Width = a5Doc.page.width;
  const a5Height = a5Doc.page.height;

  // Cross-check against ISO 216's own defined mm values (210x297 for A4, 148x210 for A5),
  // independently converted at the same 72pt/25.4mm-per-inch ratio, to confirm PDFKit's runtime
  // output isn't using some other rounding convention.
  const mmToPt = (mm: number): number => Math.round(((mm * PT_PER_INCH) / 25.4) * 100) / 100;
  const a4WidthFromIso = mmToPt(210);
  const a4HeightFromIso = mmToPt(297);
  const a5WidthFromIso = mmToPt(148);
  const a5HeightFromIso = mmToPt(210);

  const a4Agrees = a4Width === a4WidthFromIso && a4Height === a4HeightFromIso;
  const a5Agrees = a5Width === a5WidthFromIso && a5Height === a5HeightFromIso;

  results.push(
    `A4: PDFKit's own real runtime output is ${a4Width}x${a4Height}pt. Independently computed ` +
      `from ISO 216's defined 210mm x 297mm at 72pt/25.4mm: ${a4WidthFromIso}x${a4HeightFromIso}pt. ` +
      `Agreement: ${a4Agrees ? 'EXACT MATCH' : 'MISMATCH - do not ship without reconciling'}.`
  );
  results.push(
    `A5: PDFKit's own real runtime output is ${a5Width}x${a5Height}pt. Independently computed ` +
      `from ISO 216's defined 148mm x 210mm at 72pt/25.4mm: ${a5WidthFromIso}x${a5HeightFromIso}pt. ` +
      `Agreement: ${a5Agrees ? 'EXACT MATCH' : 'MISMATCH - do not ship without reconciling'}.`
  );

  if (!a4Agrees || !a5Agrees) {
    throw new Error('A4/A5 verification mismatch - resolve before writing PageLayout presets.');
  }

  // 2. KDP trim sizes - exact-arithmetic inch->point conversion, full catalog for the record.
  results.push(`KDP full published catalog (16 sizes, source: kdp.amazon.com, see header):`);
  for (const size of KDP_ALL_SIZES) {
    const w = inchesToPoints(size.widthIn);
    const h = inchesToPoints(size.heightIn);
    const selected = KDP_SELECTED.includes(size.name) ? ' [SELECTED for PageLayout this sprint]' : '';
    results.push(`  - ${size.name}in -> ${w}x${h}pt (${size.note})${selected}`);
  }

  console.log('\n=== KDP/platform trim-size spike findings ===\n');
  for (const r of results) console.log(`- ${r}`);
  console.log(
    '\nDecision: A4Layout/A5Layout use PDFKit’s own verified 595.28x841.89 / 419.53x595.28 ' +
      'pt. KDP5x8Layout/KDP5_5x8_5Layout/KDP6x9Layout use exact 72pt/inch conversion of KDP’s ' +
      'own published inch dimensions: 360x576 / 396x612 / 432x648 pt. No value in this decision ' +
      'was guessed - see PROFESSIONAL_LAYOUT_ENGINE.md §3 for the "confirmed, not resolved by ' +
      'review" prerequisite this spike closes.'
  );
}

run();
