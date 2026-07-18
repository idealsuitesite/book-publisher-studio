/**
 * Locates where two PNGs actually differ — pixel count, max channel delta, bounding box.
 *
 * `npm run baseline -- --check` reports *that* a screen changed; this reports *where*, which
 * is what turns "something drifted" into a diagnosis. Written as a throwaway during Commit 1
 * and kept because it immediately earned its place: a 4-byte difference on one screen turned
 * out to be 29 pixels in a 28x28 box at the bottom-left, which was Next's dev-indicator badge
 * rather than any product UI (fixed via devIndicators: false). Guessing would have blamed the
 * font change.
 *
 * Expect to need it again at Commits 7 and 8, where appearance changes intentionally and the
 * question becomes "did it change only where we meant it to?"
 *
 *   node scripts/diff-png.mjs <baseline.png> <candidate.png>
 */
import sharp from 'sharp';

const [a, b] = process.argv.slice(2);

const ia = sharp(a);
const ib = sharp(b);
const [ma, mb] = await Promise.all([ia.metadata(), ib.metadata()]);
console.log(`A: ${ma.width}x${ma.height}   B: ${mb.width}x${mb.height}`);
if (ma.width !== mb.width || ma.height !== mb.height) {
  console.log('DIMENSIONS DIFFER — that alone explains the byte difference.');
  process.exit(0);
}

const [ra, rb] = await Promise.all([
  ia.raw().toBuffer(),
  ib.raw().toBuffer(),
]);

const channels = ma.channels;
let diffPixels = 0;
let maxDelta = 0;
let minY = Infinity;
let maxY = -Infinity;
let minX = Infinity;
let maxX = -Infinity;

for (let i = 0; i < ra.length; i += channels) {
  let d = 0;
  for (let c = 0; c < channels; c++) d = Math.max(d, Math.abs(ra[i + c] - rb[i + c]));
  if (d > 0) {
    diffPixels++;
    maxDelta = Math.max(maxDelta, d);
    const px = (i / channels) | 0;
    const y = (px / ma.width) | 0;
    const x = px % ma.width;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
}

const total = (ra.length / channels) | 0;
console.log(`differing pixels: ${diffPixels} / ${total} (${((diffPixels / total) * 100).toFixed(4)}%)`);
console.log(`max channel delta: ${maxDelta} / 255`);
if (diffPixels > 0) console.log(`bounding box: x ${minX}–${maxX}, y ${minY}–${maxY}`);
