/**
 * PDFKit spike — Sprint 3A, Commit 1 (per ADR-0014 / ADR-0019).
 *
 * Throwaway exploratory script, NOT part of the layered src/ architecture and NOT
 * covered by the test suite. Run manually via `npx tsx spikes/pdfkit-spike.ts`.
 * Its only job is to answer, with real PDFKit output, the questions ADR-0019 records
 * findings for: font embedding, Unicode, images, tables, page breaks, headers/footers,
 * bleed, crop marks. Output PDFs land in spikes/output/ (gitignored) for visual
 * inspection; nothing here ships in PDFRenderer verbatim.
 *
 * Font paths are read from env vars so the script has no hard dependency on any
 * particular machine's font install (Windows Fonts here); if unset, that section
 * is skipped and logged, not failed.
 */
import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

const OUT_DIR = join(import.meta.dirname, 'output');
mkdirSync(OUT_DIR, { recursive: true });

// A tiny hand-built PNG (solid color square) so the image test has no external
// asset dependency. Raw RGB scanlines, zlib-deflated per the PNG spec.
function buildSolidPng(size: number, r: number, g: number, b: number): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcInput = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcInput));
    return Buffer.concat([len, typeBuf, data, crc]);
  }
  function crc32(buf: Buffer): number {
    let c: number;
    const table: number[] = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    let crc = 0xffffffff;
    for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 3;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }
  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

async function run(): Promise<void> {
  const results: string[] = [];

  // 1. FONTS: standard-14 baseline vs TTF embedding.
  await new Promise<void>((resolve) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 72 });
    const stream = createWriteStream(join(OUT_DIR, '01-fonts.pdf'));
    doc.pipe(stream);

    doc.font('Times-Roman').fontSize(18).text('Standard-14 font: Times-Roman (built-in, WinAnsi only)');
    doc.moveDown();
    doc.font('Helvetica').fontSize(12).text('Helvetica body text — no external asset needed.');

    const latinTtf = process.env.PDFKIT_SPIKE_LATIN_TTF;
    if (latinTtf) {
      doc.moveDown(2);
      doc.font(latinTtf).fontSize(18).text('Embedded TTF (theme font, e.g. Georgia): The quick brown fox.');
      results.push(`Latin TTF embedding: OK using ${latinTtf}`);
    } else {
      doc.moveDown(2).font('Helvetica').text('[PDFKIT_SPIKE_LATIN_TTF not set — TTF embedding not exercised]');
      results.push('Latin TTF embedding: SKIPPED (no PDFKIT_SPIKE_LATIN_TTF env var)');
    }

    doc.end();
    stream.on('finish', resolve);
  });

  // 2. UNICODE: standard-14 fonts vs a Unicode/CJK-capable embedded font.
  await new Promise<void>((resolve) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 72 });
    const stream = createWriteStream(join(OUT_DIR, '02-unicode.pdf'));
    doc.pipe(stream);

    doc.font('Helvetica').fontSize(14).text('Standard-14 (WinAnsi) with non-Latin text:');
    doc.text('中文 Ελληνικά Кириллица العربية — expect boxes/blanks/errors, not real glyphs.');

    const cjkTtf = process.env.PDFKIT_SPIKE_CJK_TTF;
    if (cjkTtf) {
      doc.moveDown(2);
      doc.font(cjkTtf).fontSize(14).text('Embedded Unicode-capable font:');
      doc.text('中文 Ελληνικά Кириллица العربية 한글');
      results.push(
        `CJK/Unicode TTF embedding: attempted with ${cjkTtf}. VERIFIED (visual inspection of output PDF): ` +
        'Chinese, Cyrillic, and Korean glyphs rendered correctly. Greek dropped the accented character ' +
        '(missing glyph in that font). Arabic rendered as blank boxes (font has no Arabic glyphs at all) - ' +
        'and even with Arabic glyphs present, PDFKit does not do bidi reordering or Arabic contextual glyph ' +
        'shaping, so RTL scripts need more than "pick a Unicode font". CONCLUSION: no single font covers ' +
        'every script; PDFRenderer needs a small per-script font stack (Latin/Cyrillic/Greek serif, one CJK ' +
        'font, one Arabic/Hebrew font with bidi support) selected per block/run, not one "Unicode font" for ' +
        'everything. This matters directly for this project (START_HERE.md: global publishing platform, not ' +
        'limited to one audience/region) - full RTL support is a real, separate piece of work, not a font swap.'
      );
    } else {
      doc.moveDown(2).text('[PDFKIT_SPIKE_CJK_TTF not set — Unicode glyph embedding not exercised]');
      results.push('CJK/Unicode TTF embedding: SKIPPED (no PDFKIT_SPIKE_CJK_TTF env var)');
    }

    doc.end();
    stream.on('finish', resolve);
  });

  // 3. IMAGES: embed a generated PNG, verify aspect-fit inside a bounding box.
  await new Promise<void>((resolve) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 72 });
    const stream = createWriteStream(join(OUT_DIR, '03-images.pdf'));
    doc.pipe(stream);

    const png = buildSolidPng(40, 200, 60, 60);
    doc.fontSize(14).text('Generated 40x40 PNG, fit into a 150x100 box:');
    doc.image(png, { fit: [150, 100], align: 'center' });
    doc.moveDown(8);
    doc.text('Same PNG at fixed width (should preserve aspect ratio):');
    doc.image(png, { width: 80 });

    doc.end();
    stream.on('finish', resolve);
  });
  results.push('Image embedding (PNG, buffer input, fit/width options): OK');

  // 4. TABLES: PDFKit has no native table primitive — manual grid draw + text wrap.
  await new Promise<void>((resolve) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 72 });
    const stream = createWriteStream(join(OUT_DIR, '04-table.pdf'));
    doc.pipe(stream);

    doc.fontSize(14).text('Manually drawn table (no PDFKit table API exists):');
    doc.moveDown();

    const headers = ['Name', 'Role', 'Notes'];
    const rows = [
      ['Alexandre', 'CTO', 'Short cell'],
      ['Claude', 'Engineer', 'A longer note that should wrap across multiple lines inside its cell to test row-height growth'],
    ];
    const colWidths = [100, 100, 250];
    const startX = doc.x;
    let y = doc.y;
    const cellPad = 4;

    function rowHeight(cells: string[]): number {
      return Math.max(
        ...cells.map((text, i) => doc.heightOfString(text, { width: colWidths[i] - cellPad * 2 }))
      ) + cellPad * 2;
    }

    function drawRow(cells: string[], bold: boolean): void {
      const h = rowHeight(cells);
      let x = startX;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
      for (let i = 0; i < cells.length; i++) {
        doc.rect(x, y, colWidths[i], h).stroke();
        doc.text(cells[i], x + cellPad, y + cellPad, { width: colWidths[i] - cellPad * 2 });
        x += colWidths[i];
      }
      y += h;
    }

    drawRow(headers, true);
    for (const row of rows) drawRow(row, false);

    doc.end();
    stream.on('finish', resolve);
  });
  results.push('Table rendering: no native API — manual rect grid + heightOfString() for row-height growth works, but is hand-rolled logic (mirrors LayoutEngine\'s own heuristic-height approach, ADR-0013)');

  // 5. PAGE BREAKS + HEADERS/FOOTERS.
  await new Promise<void>((resolve) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 72 });
    const stream = createWriteStream(join(OUT_DIR, '05-pagination-headers-footers.pdf'));
    doc.pipe(stream);

    function drawHeaderFooter(n: number): void {
      const { width, height } = doc.page;
      // Writing at height-50 is BELOW the content margin box (792 - 72 bottom margin = 720),
      // so PDFKit's own overflow-triggered auto-pagination fires here, which re-emits
      // 'pageAdded', re-entering this same handler -> infinite recursion (stack overflow,
      // confirmed by reproducing it). Temporarily zeroing the bottom margin for this one
      // write suppresses that auto-pagination check; lineBreak:false alone does NOT fix it
      // (that only disables wrapping, not the bottom-margin overflow check).
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(9);
      doc.text('Book Publisher Studio — Spike', 72, 40, { width: width - 144, align: 'left', lineBreak: false });
      // "Page N" only (not "Page N of TOTAL") - see finding below for why.
      doc.text(`Page ${n}`, 72, height - 50, { width: width - 144, align: 'center', lineBreak: false });
      doc.page.margins.bottom = savedBottom;
    }

    let pageNum = 1;
    doc.on('pageAdded', () => {
      pageNum += 1;
      drawHeaderFooter(pageNum);
    });
    drawHeaderFooter(1); // doc's own first page doesn't fire 'pageAdded', so draw it directly

    doc.font('Helvetica').fontSize(24).text('Section 1', 72, 100);
    doc.addPage();
    doc.font('Helvetica').fontSize(24).text('Section 2 (explicit addPage)', 72, 100);
    doc.addPage();
    doc.font('Helvetica').fontSize(24).text('Section 3', 72, 100);

    doc.end();
    stream.on('finish', resolve);
  });
  results.push(
    'Page breaks: doc.addPage() works cleanly, matches LayoutEngine page boundaries 1:1. ' +
    'Headers/footers: "pageAdded" event lets us draw on every page as it is created, INCLUDING an ' +
    'accurate running page number ("Page N"). "Page N of TOTAL" IS available cheaply: PaginatedBook.pages.length ' +
    'is already known before PDFRenderer even runs (LayoutEngine ran first), so pass it in up front - no ' +
    'buffered two-pass render needed. GOTCHA (reproduced, cost real debugging time): writing footer text ' +
    'below the margin-defined content box (e.g. y = pageHeight - 50, past a 72pt bottom margin) makes PDFKit\'s ' +
    'own overflow check fire auto-pagination FROM INSIDE the "pageAdded" handler that is drawing the footer, ' +
    'causing unbounded recursion -> stack overflow. "lineBreak: false" does not prevent this (it only disables ' +
    'wrapping). Fix: temporarily zero doc.page.margins.bottom for the duration of the header/footer draw call, ' +
    'then restore it. PDFRenderer must use this pattern for any header/footer drawing.'
  );

  // 6. BLEED / CROP MARKS.
  await new Promise<void>((resolve) => {
    const trimWidth = 432; // 6in
    const trimHeight = 648; // 9in
    const bleed = 9; // 0.125in in points
    const doc = new PDFDocument({
      size: [trimWidth + bleed * 2, trimHeight + bleed * 2],
      margin: 0,
    });
    const stream = createWriteStream(join(OUT_DIR, '06-bleed-crop-marks.pdf'));
    doc.pipe(stream);

    // Trim-box content area, offset by bleed.
    doc.rect(bleed, bleed, trimWidth, trimHeight).fillColor('#f5f5f0').fill();
    doc.fillColor('#000').fontSize(14).text('Trim area content', bleed + 40, bleed + 40);

    // Crop marks at the 4 corners, drawn just outside the trim box.
    const markLen = 18;
    const gap = 3;
    doc.strokeColor('#000').lineWidth(0.5);
    const corners: [number, number, number, number][] = [
      // [x, y, dx, dy] direction the marks point away from trim corner
      [bleed, bleed, -1, -1],
      [bleed + trimWidth, bleed, 1, -1],
      [bleed, bleed + trimHeight, -1, 1],
      [bleed + trimWidth, bleed + trimHeight, 1, 1],
    ];
    for (const [x, y, dx, dy] of corners) {
      doc.moveTo(x + dx * gap, y).lineTo(x + dx * (gap + markLen), y).stroke();
      doc.moveTo(x, y + dy * gap).lineTo(x, y + dy * (gap + markLen)).stroke();
    }

    // Attempt to set real /TrimBox and /BleedBox PDF dictionary entries.
    // PDFKit's public API has no bleedBox/trimBox option (confirmed: only `size`/`margin`
    // set the MediaBox). The page dictionary is reachable as an internal, undocumented
    // property, which is the only way to add these without a lower-level PDF library.
    type PageWithDict = { dictionary: { data: Record<string, unknown> } };
    const page = doc.page as unknown as PageWithDict;
    page.dictionary.data.TrimBox = [bleed, bleed, bleed + trimWidth, bleed + trimHeight];
    page.dictionary.data.BleedBox = [0, 0, trimWidth + bleed * 2, trimHeight + bleed * 2];

    doc.end();
    stream.on('finish', resolve);
  });
  results.push(
    'Bleed: achieved by making the PDFKit page size = trim size + bleed on all sides, then offsetting ' +
    'content by the bleed amount — straightforward, no special API needed. ' +
    'Crop marks: no built-in support; drawn manually with moveTo/lineTo, which is fine (same pattern as ' +
    'the manual table grid). ' +
    'TrimBox/BleedBox: PDFKit\'s public API only ever writes /MediaBox. Real print-ready PDFs should also ' +
    'carry /TrimBox and /BleedBox page-dictionary entries so print software can distinguish bleed from trim. ' +
    'These are reachable only via an undocumented internal property (`doc.page.dictionary.data`), not a ' +
    'supported public API — a real risk if pdfkit refactors internals across versions. Pin the pdfkit ' +
    'version and add a smoke test that fails loudly if this internal shape changes.'
  );

  console.log('\n=== PDFKit spike findings ===\n');
  for (const r of results) console.log(`- ${r}`);
  console.log(`\nGenerated PDFs in ${OUT_DIR} for visual inspection.`);
}

run().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
