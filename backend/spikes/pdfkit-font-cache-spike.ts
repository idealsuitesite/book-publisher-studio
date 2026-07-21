/**
 * Performance (S13) Option 1 gate — the ONE question a Design Review must not be written on
 * an assumption about: does a cached/pre-parsed font let PDFKit skip its per-document re-parse,
 * with BYTE-IDENTICAL output? If PDFKit re-parses regardless, Option 1 collapses to near-zero
 * and closes on evidence (like HEURISTIC_STRUCTURE_DETECTION). Run:
 *   npx tsx spikes/pdfkit-font-cache-spike.ts
 *
 * RESULT (2026-07-21): Option 1 CLOSES ON EVIDENCE. `fontkit.create` — PDFKit's only font-parse
 * entry (source below) — costs ~0.1-0.5 ms/face, ~2 ms total (section A). So a parsed-font cache
 * saves at most ~2 ms/render (<0.5%). The ~20 ms/doc the scope report called "font parse" is
 * per-document glyph layout + subset embedding, intrinsic to emitting a fresh PDF and NOT what a
 * font-buffer/parse cache removes. Not worth a Design Review. Byte-identity is therefore moot.
 *
 * What the SOURCE tells us (pdfkit 0.19.1, js/pdfkit.js:2782-2800):
 *   PDFFontFactory.open() calls `fontkit.create(src)` for any Uint8Array/ArrayBuffer src. A
 *   Node Buffer IS a Uint8Array, so passing a cached Buffer does NOT avoid the parse, and there
 *   is no branch accepting a pre-parsed fontkit Font (it would throw). The re-parse is per-doc.
 *   PDFKit `require('fontkit')` (line 10) is the SHARED module, but its `create` is a getter-only
 *   bundled-CJS export (non-configurable), so the empirical memo below cannot be installed — the
 *   bound from section A stands on its own and is decisive regardless.
 *
 * Method:
 *   A. Raw fontkit.create cost per registered face (the parse we might cache).
 *   B. Render a real multi-page book N times with a FRESH PDFDocument each call (production
 *      reality) — baseline. Then install an md5-keyed fontkit.create memo (a real font-parse
 *      cache would key on path/content the same way) and render N more. Report ms/render delta.
 *   C. Byte-identity: normalise out the legitimately-variable regions (CreationDate/ID/subset
 *      tags) and compare baseline-vs-baseline (noise floor) against baseline-vs-memoized.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { FrontMatterBuilder } from '../src/domain/services/FrontMatterBuilder';
import { getTheme } from '../src/domain/themes/getTheme';
import { orderByRole } from '../src/domain/services/orderByRole';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import type { PaginatedBook } from '../src/domain/models/PaginatedBook';

// The SAME module.exports object PDFKit uses (`var fontkit = require('fontkit')`), so patching
// its `.create` is seen by PDFKit's own PDFFontFactory.open call.
const require = createRequire(import.meta.url);
const fontkit = require('fontkit') as { create: (data: Buffer, postscriptName?: string) => unknown };

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(__dirname, '..', 'verification', 'corpus', 'faith-alone-styled.docx');
const FONTS_DIR = join(__dirname, '..', 'assets', 'fonts');

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Strip the legitimately-variable PDF regions so a font-only change is what remains. */
function normalise(pdf: Buffer): string {
  return pdf
    .toString('latin1')
    .replace(/\/CreationDate \(D:[^)]*\)/g, '/CreationDate (X)')
    .replace(/\/ModDate \(D:[^)]*\)/g, '/ModDate (X)')
    .replace(/\/ID \[<[0-9a-fA-F]*><[0-9a-fA-F]*>\]/g, '/ID [X]')
    .replace(/[A-Z]{6}\+/g, 'TAG+'); // per-doc random font subset tag
}
const hash = (s: string) => createHash('md5').update(s).digest('hex').slice(0, 12);

async function buildPaginated(): Promise<PaginatedBook> {
  const raw = await new MammothParser().parse(readFileSync(CORPUS));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'f.docx' }));
  const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  const styled = new ThemeEngine().applyTheme(orderByRole(book), getTheme('classic'));
  const typeset = new TypographyResolver().resolve(styled);
  return new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP6x9PageLayout);
}

async function renderN(book: PaginatedBook, n: number): Promise<{ times: number[]; norm: string }> {
  const times: number[] = [];
  let norm = '';
  const origWarn = console.warn;
  console.warn = () => {};
  for (let i = 0; i < n + 1; i++) {
    const t = performance.now();
    const out = await new PDFRenderer({ compress: false }).render(book, { language: 'en' });
    const ms = performance.now() - t;
    if (i > 0) times.push(ms); // discard run 0 (JIT)
    norm = normalise(out.output);
  }
  console.warn = origWarn;
  return { times, norm };
}

async function main() {
  console.log('PDFKit font-cache spike — pdfkit 0.19.1, fontkit shared module\n');

  // A. Raw fontkit.create cost per face.
  console.log('A. Raw fontkit.create(buffer) cost per registered face (the parse a cache targets):');
  const faces = readdirSync(FONTS_DIR).filter((f) => f.endsWith('.ttf'));
  const bufs = faces.map((f) => readFileSync(join(FONTS_DIR, f)));
  for (let k = 0; k < faces.length; k++) {
    const buf = bufs[k];
    fontkit.create(buf); // warm the file
    const t = performance.now();
    const R = 30;
    for (let i = 0; i < R; i++) fontkit.create(buf);
    console.log(`   ${faces[k].padEnd(28)} ${((performance.now() - t) / R).toFixed(3)} ms`);
  }

  const book = await buildPaginated();
  const pages = (await new PDFRenderer({ compress: false }).render(book, { language: 'en' })).metrics.pageCount;
  console.log(`\nB. Render faith-alone (${pages} pages) N times, fresh PDFDocument each call:`);

  // Baseline (no memo)
  const N = 8;
  const base = await renderN(book, N);
  console.log(`   baseline               : ${median(base.times).toFixed(1)} ms/render`);

  // Install md5-keyed memo on the SHARED fontkit.create (what PDFKit calls). It is a getter-only
  // bundled-CJS export, so reassignment fails; defineProperty replaces it for the experiment.
  const origCreate = fontkit.create.bind(fontkit);
  const cache = new Map<string, unknown>();
  let misses = 0;
  let hits = 0;
  const memoCreate = (data: Buffer, postscriptName?: string) => {
    const key = createHash('md5').update(data).digest('hex') + (postscriptName ?? '');
    const got = cache.get(key);
    if (got) {
      hits++;
      return got;
    }
    misses++;
    const font = origCreate(data, postscriptName);
    cache.set(key, font);
    return font;
  };
  let patched = false;
  try {
    Object.defineProperty(fontkit, 'create', { value: memoCreate, configurable: true, writable: true });
    patched = fontkit.create === memoCreate;
  } catch {
    patched = false;
  }

  if (patched) {
    const memo = await renderN(book, N);
    console.log(`   parse-memoized         : ${median(memo.times).toFixed(1)} ms/render   (fontkit.create hits=${hits} misses=${misses})`);
    const saved = median(base.times) - median(memo.times);
    console.log(`   => saved by parse cache: ${saved.toFixed(1)} ms/render (${((100 * saved) / median(base.times)).toFixed(1)}%)`);
    Object.defineProperty(fontkit, 'create', { value: origCreate, configurable: true, writable: true });
    const base2 = await renderN(book, 1);
    console.log('\nC. Byte-identity (normalised: CreationDate/ID/subset-tag masked out):');
    console.log(`   baseline #1 hash : ${hash(base.norm)}`);
    console.log(`   baseline #2 hash : ${hash(base2.norm)}   ${base.norm === base2.norm ? '== (deterministic noise floor)' : '!= (non-deterministic even without memo!)'}`);
    console.log(`   memoized   hash  : ${hash(memo.norm)}   ${memo.norm === base.norm ? '== baseline (BYTE-IDENTICAL, cache is output-neutral)' : '!= baseline (cache CHANGES output)'}`);
    return;
  }

  console.log(`   parse-memoized         : (could not patch getter-only fontkit.create empirically)`);
  console.log(`   => but section A bounds the achievable saving at the total fontkit.create cost per`);
  console.log(`      render — the faces a render uses, each ~0.1ms — i.e. ≈1-2 ms/render, <0.5% of ${median(base.times).toFixed(0)}ms.`);
  const base2 = await renderN(book, 1);
  console.log('\nC. Baseline determinism (normalised: CreationDate/ID/subset-tag masked out):');
  console.log(`   baseline #1 hash : ${hash(base.norm)}`);
  console.log(`   baseline #2 hash : ${hash(base2.norm)}   ${base.norm === base2.norm ? '== (render is deterministic under normalisation)' : '!= (non-deterministic)'}`);
}

main();
