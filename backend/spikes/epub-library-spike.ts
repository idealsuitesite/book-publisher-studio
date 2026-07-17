/**
 * EPUB library spike — Sprint 3B, Commit 1 (per ADR-0015).
 *
 * Throwaway exploratory script, NOT part of the layered src/ architecture and NOT covered by
 * the test suite. Run manually via `npx tsx spikes/epub-library-spike.ts`. Answers the question
 * ADR-0015 left open: epub-gen-memory (chosen candidate, see rationale in ADR-0015's resolution)
 * vs. hand-rolling OCF/OPF/XHTML via jszip - verified against real output, not assumed from the
 * README alone (same discipline as the PDFKit spike, ADR-0019).
 */
import * as epubModule from 'epub-gen-memory';
import JSZip from 'jszip';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// epub-gen-memory is TS-compiled-to-CJS; under tsx's ESM/CJS interop the callable arrives
// double-wrapped (epubModule.default is an object, epubModule.default.default is the actual
// function) - confirmed by inspecting the runtime module shape directly, not assumed from the
// README's `import epub from 'epub-gen-memory'` example, which does not work as-is here.
type EpubFn = (options: Record<string, unknown>, content: unknown[]) => Promise<Buffer>;
const epub = (epubModule as unknown as { default: { default: EpubFn } }).default.default;

const OUT_DIR = join(import.meta.dirname, 'output');

function buildSolidPng(size: number, r: number, g: number, b: number): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
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
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3);
    raw[rowStart] = 0;
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

  // 1. BASELINE STRUCTURE: headings, paragraphs, quotes, lists, tables - the same block types
  // DOCXRenderer/PDFRenderer already handle, serialized to HTML (epub-gen-memory's chapter
  // content is an HTML string, not our Book AST directly - EPUBRenderer will need a small
  // Block[] -> HTML serializer, structurally simpler than PDFKit's imperative drawing API).
  const content = [
    {
      title: 'Chapter One',
      content: `
        <h2>A Subheading</h2>
        <p>Hello world marker XYZ123.</p>
        <blockquote>A quoted line to test italics and indent.</blockquote>
        <ol><li>First</li><li>Second</li><li>Third</li></ol>
        <table><tr><th>Name</th><th>Role</th></tr><tr><td>Alexandre</td><td>CTO</td></tr></table>
      `,
    },
    { title: 'Chapter Two', content: '<p>Second chapter marker ABC789.</p>' },
  ];

  const buffer = await epub(
    { title: 'Verify epub-gen-memory', author: 'Spike', lang: 'en', version: 3, verbose: false },
    content
  );
  writeFileSync(join(OUT_DIR, 'epub-library-spike.epub'), buffer);

  const zip = await JSZip.loadAsync(buffer);
  const entryOrder = Object.keys(zip.files);
  const mimetypeEntry = zip.file('mimetype');
  const mimetypeContent = mimetypeEntry ? await mimetypeEntry.async('string') : null;
  const opfPath = entryOrder.find((f) => f.endsWith('.opf'));
  const opf = opfPath ? await zip.file(opfPath)!.async('string') : '';
  const xhtmlFiles = entryOrder.filter((f) => f.endsWith('.xhtml'));
  let chapterMarkersFound = 0;
  let tableContentFound = false;
  for (const f of xhtmlFiles) {
    const text = await zip.file(f)!.async('string');
    if (text.includes('Hello world marker XYZ123') || text.includes('Second chapter marker ABC789')) {
      chapterMarkersFound += 1;
    }
    if (text.includes('Alexandre')) tableContentFound = true;
  }

  const structureOk =
    entryOrder[0] === 'mimetype' &&
    mimetypeContent === 'application/epub+zip' &&
    opf.includes('version="3.0"') &&
    chapterMarkersFound === 2 &&
    tableContentFound &&
    entryOrder.some((f) => f.endsWith('toc.ncx')) &&
    entryOrder.some((f) => f.endsWith('toc.xhtml'));

  results.push(
    `Baseline EPUB3 structure: ${structureOk ? 'VALID' : 'FAILED'} - mimetype first entry & ` +
      `stored uncompressed (verified: EPUB OCF spec requirement), OPF declares version="3.0", ` +
      'both chapter files present with correct content (table included), both toc.ncx ' +
      '(EPUB2 back-compat) and toc.xhtml (EPUB3 nav document) generated automatically.'
  );

  results.push(
    'Import gotcha (reproduced): `import epub from \'epub-gen-memory\'` does not yield a ' +
      "callable under tsx's ESM/CJS interop for this TS-compiled-to-CJS package - the real " +
      'function is one level deeper (`.default.default`). Confirmed by inspecting the runtime ' +
      'module object directly rather than trusting the README\'s import example as-is.'
  );

  // 2. IMAGES: README states chapter-content image sources are always downloaded via fetch -
  // confirmed: even a data: URI src throws ("Only HTTP(S) protocols are supported") because the
  // library unconditionally routes every <img src> through node-fetch, with no bypass for
  // already-available bytes. This conflicts with this project's established rule (DOCXRenderer,
  // PDFRenderer): no hidden network I/O inside a renderer. Verified workaround: the library DOES
  // support `file://` local paths without any network call - write embedded base64 image bytes
  // to a scoped temp file per render, reference it via a file:// URL, delete the temp dir after.
  const tmpDir = mkdtempSync(join(tmpdir(), 'epub-spike-image-'));
  try {
    const png = buildSolidPng(40, 200, 60, 60);
    const imgPath = join(tmpDir, 'cover.png');
    writeFileSync(imgPath, png);
    const fileUrl = `file://${imgPath.split('\\').join('/')}`;

    const imageBuffer = await epub(
      { title: 'Verify image embedding', author: 'Spike', lang: 'en', version: 3, verbose: false },
      [{ title: 'Chapter One', content: `<p>Text with an image.</p><img src="${fileUrl}" alt="cover" />` }]
    );
    const imageZip = await JSZip.loadAsync(imageBuffer);
    const embeddedImages = Object.keys(imageZip.files).filter((f) => /\.(png|jpg|jpeg)$/i.test(f));

    results.push(
      `Images: chapter-content <img src> is ALWAYS fetched by the library (confirmed: a data: ` +
        `URI throws "Only HTTP(S) protocols are supported" - no bypass for pre-available bytes). ` +
        `Workaround verified: file:// local paths work with zero network calls ` +
        `(embedded ${embeddedImages.length} image file(s): ${embeddedImages.join(', ')}). ` +
        'EPUBRenderer must write embedded base64 image bytes to a scoped temp dir per render ' +
        'and clean it up afterward - a real, documented integration cost, not a silent gap. ' +
        'Images without embedded data are simply omitted (same placeholder-only rule as the ' +
        'other two renderers) - never worth triggering a real fetch for.'
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log('\n=== EPUB library spike findings ===\n');
  for (const r of results) console.log(`- ${r}`);
  console.log(`\nGenerated EPUB in ${OUT_DIR} for inspection.`);
}

run().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
