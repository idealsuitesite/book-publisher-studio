/**
 * Extracts rendered text from an uncompressed PDFKit buffer for test assertions.
 *
 * Two generations of PDFRenderer output need two different decodings, and a single PDF
 * routinely mixes both (Sprint 4 commit 6 - embedded fonts for block content, standard-14
 * Helvetica still used for page chrome like the running header/footer and chapter titles):
 *
 * - Standard-14 fonts (Helvetica/Times/Courier) show text as single-byte WinAnsi-ish hex
 *   operands, close enough to ASCII to decode directly as Latin-1 - the original behavior.
 * - Embedded TrueType fonts (registerFont(), Sprint 4 commit 6) are written as Type0/
 *   CIDFontType2 with /Encoding /Identity-H: each character becomes a 2-byte CID that only
 *   maps back to a real character via that specific font object's own /ToUnicode CMap
 *   (a beginbfchar/beginbfrange block). Different embedded font objects assign overlapping
 *   CID numbers to different characters (confirmed against real output - e.g. one font's
 *   CID 0001 was 'B', another's was 'P'), so CMaps from different fonts can never be merged;
 *   decoding must track which font was active for each shown string.
 *
 * This walks each page's content stream in document order, tracking the current font via
 * `/Fn size Tf` operators, resolves `Fn` to a font object through the page's
 * /Resources /Font dictionary, and decodes each Tj/TJ operand with that specific font's
 * ToUnicode CMap when it has one (2-byte CID), or the original single-byte Latin-1 decode
 * when it doesn't (a per-font fallback, not a whole-document one). If no page/font
 * structure is found at all (unexpected PDF shape), falls back to the original
 * whole-buffer token scan so this never regresses on a PDF simpler than what it expects.
 *
 * Requires the PDF to have been rendered with `compress: false` (a compressed content
 * stream can't be scanned this way at all).
 */

interface FontInfo {
  /** CID -> decoded character(s), from this font's own /ToUnicode CMap. null = no CMap (standard-14). */
  cmap: Map<number, string> | null;
  /** The font's own /BaseFont name (may carry a random subset prefix, e.g. "ABCDEF+Gelasio-Bold"). */
  baseFont: string;
}

export interface PdfTextRun {
  text: string;
  /** The /BaseFont name active when this text was shown - see PdfTextRun docs on extractPdfRuns(). */
  baseFont: string;
}

function parseObjects(raw: string): Map<number, string> {
  const objects = new Map<number, string>();
  const re = /(\d+)\s+0\s+obj([\s\S]*?)endobj/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    objects.set(Number(m[1]), m[2]);
  }
  return objects;
}

function hexToUnicodeString(hex: string): string {
  let result = '';
  for (let i = 0; i < hex.length; i += 4) {
    result += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  }
  return result;
}

function parseToUnicodeCMap(streamBody: string): Map<number, string> {
  const map = new Map<number, string>();

  for (const block of streamBody.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) {
    const hexPairs = block.match(/<[0-9a-fA-F]+>/g) ?? [];
    for (let i = 0; i + 1 < hexPairs.length; i += 2) {
      const src = parseInt(hexPairs[i].slice(1, -1), 16);
      map.set(src, hexToUnicodeString(hexPairs[i + 1].slice(1, -1)));
    }
  }

  for (const block of streamBody.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
    const entryRe = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(\[[^\]]*\]|<[0-9a-fA-F]+>)/g;
    let entry: RegExpExecArray | null;
    while ((entry = entryRe.exec(block)) !== null) {
      const lo = parseInt(entry[1], 16);
      const dst = entry[3];
      if (dst.startsWith('[')) {
        const dstHexes = (dst.match(/<[0-9a-fA-F]+>/g) ?? []).map((h) => h.slice(1, -1));
        dstHexes.forEach((h, i) => map.set(lo + i, hexToUnicodeString(h)));
      } else {
        const hi = parseInt(entry[2], 16);
        const dstLo = parseInt(dst.slice(1, -1), 16);
        for (let cid = lo; cid <= hi; cid++) map.set(cid, String.fromCodePoint(dstLo + (cid - lo)));
      }
    }
  }

  return map;
}

function resolveFontInfo(objects: Map<number, string>, fontObjNum: number, cache: Map<number, FontInfo>): FontInfo {
  const cached = cache.get(fontObjNum);
  if (cached) return cached;

  const body = objects.get(fontObjNum) ?? '';
  const toUnicodeRef = body.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
  let cmap: Map<number, string> | null = null;
  if (toUnicodeRef) {
    const cmapBody = objects.get(Number(toUnicodeRef[1])) ?? '';
    const streamMatch = cmapBody.match(/stream\r?\n([\s\S]*?)endstream/);
    if (streamMatch) cmap = parseToUnicodeCMap(streamMatch[1]);
  }
  const baseFontMatch = body.match(/\/BaseFont\s*\/([^\s/>[\]]+)/);

  const info: FontInfo = { cmap, baseFont: baseFontMatch?.[1] ?? '' };
  cache.set(fontObjNum, info);
  return info;
}

function decodeShown(hex: string, fontInfo: FontInfo | undefined): string {
  if (fontInfo?.cmap) {
    let out = '';
    for (let i = 0; i + 4 <= hex.length; i += 4) {
      out += fontInfo.cmap.get(parseInt(hex.slice(i, i + 4), 16)) ?? '';
    }
    return out;
  }
  return Buffer.from(hex, 'hex').toString('latin1');
}

// Resolves either an inline dict ("/Resources << ... >>") or an indirect reference
// ("/Resources 6 0 R") to the dict body text to search for a /Font entry within.
function resolveResourcesBody(objects: Map<number, string>, pageBody: string): string {
  const ref = pageBody.match(/\/Resources\s+(\d+)\s+0\s+R/);
  if (ref) return objects.get(Number(ref[1])) ?? '';
  const inline = pageBody.match(/\/Resources\s*<<([\s\S]*?)>>\s*(?:\/|>>)/);
  return inline ? inline[1] : pageBody;
}

function parseFontResourceMap(resourcesBody: string): Map<string, number> {
  const map = new Map<string, number>();
  const fontDictMatch = resourcesBody.match(/\/Font\s*<<([\s\S]*?)>>/);
  if (!fontDictMatch) return map;
  const entryRe = /\/(F\d+)\s+(\d+)\s+0\s+R/g;
  let entry: RegExpExecArray | null;
  while ((entry = entryRe.exec(fontDictMatch[1])) !== null) {
    map.set(entry[1], Number(entry[2]));
  }
  return map;
}

function resolveContentStreams(objects: Map<number, string>, pageBody: string): string[] {
  const streams: string[] = [];
  const arrayRef = pageBody.match(/\/Contents\s*\[([^\]]*)\]/);
  const objNums: number[] = arrayRef
    ? [...arrayRef[1].matchAll(/(\d+)\s+0\s+R/g)].map((m) => Number(m[1]))
    : (() => {
        const single = pageBody.match(/\/Contents\s+(\d+)\s+0\s+R/);
        return single ? [Number(single[1])] : [];
      })();

  for (const objNum of objNums) {
    const body = objects.get(objNum) ?? '';
    const streamMatch = body.match(/stream\r?\n([\s\S]*?)endstream/);
    if (streamMatch) streams.push(streamMatch[1]);
  }
  return streams;
}

const OPERATOR_RE = /\/(F\d+)\s+[\d.]+\s+Tf|\[((?:<[0-9a-fA-F]*>|[^\]])*)\]\s*TJ|<([0-9a-fA-F]+)>\s*Tj/g;

function extractFromContentStream(
  content: string,
  fontResourceMap: Map<string, number>,
  objects: Map<number, string>,
  fontCache: Map<number, FontInfo>
): PdfTextRun[] {
  const runs: PdfTextRun[] = [];
  let currentFont: FontInfo | undefined;
  let match: RegExpExecArray | null;
  OPERATOR_RE.lastIndex = 0;
  while ((match = OPERATOR_RE.exec(content)) !== null) {
    const [, tfResource, tjArray, tjSingle] = match;
    if (tfResource) {
      const fontObjNum = fontResourceMap.get(tfResource);
      currentFont = fontObjNum !== undefined ? resolveFontInfo(objects, fontObjNum, fontCache) : undefined;
    } else if (tjArray !== undefined) {
      let text = '';
      for (const hexToken of tjArray.match(/<([0-9a-fA-F]*)>/g) ?? []) {
        text += decodeShown(hexToken.slice(1, -1), currentFont);
      }
      if (text) runs.push({ text, baseFont: currentFont?.baseFont ?? '' });
    } else if (tjSingle !== undefined) {
      const text = decodeShown(tjSingle, currentFont);
      if (text) runs.push({ text, baseFont: currentFont?.baseFont ?? '' });
    }
  }
  return runs;
}

/**
 * Extracts each shown text string alongside the /BaseFont name active when it was drawn -
 * for tests that need to confirm *which* embedded font rendered a specific piece of text
 * (e.g. "the word 'bold' was shown with a bold-weight font"), not just that some bold font
 * exists somewhere in the document. `baseFont` may carry a random subset-tag prefix (e.g.
 * "ABCDEF+Gelasio-Bold") - assert with `.includes()` against a name obtained from
 * PdfFontRegistry.resolve(), not a hardcoded literal, so tests stay correct if the actual
 * family/subsetting changes.
 */
export function extractPdfRuns(buffer: Buffer): PdfTextRun[] {
  const raw = buffer.toString('latin1');
  const objects = parseObjects(raw);
  const fontCache = new Map<number, FontInfo>();

  const runs: PdfTextRun[] = [];
  let sawAPage = false;

  for (const [, body] of objects) {
    if (!/\/Type\s*\/Page\b/.test(body)) continue;
    sawAPage = true;

    const fontResourceMap = parseFontResourceMap(resolveResourcesBody(objects, body));
    for (const content of resolveContentStreams(objects, body)) {
      runs.push(...extractFromContentStream(content, fontResourceMap, objects, fontCache));
    }
  }

  if (sawAPage) return runs;

  // No /Page structure found at all - fall back to the original whole-buffer scan
  // (no font attribution possible in this fallback path).
  const hexTokens = raw.match(/<([0-9a-fA-F]+)>/g) ?? [];
  return hexTokens.map((token) => ({ text: Buffer.from(token.slice(1, -1), 'hex').toString('latin1'), baseFont: '' }));
}

export function extractPdfText(buffer: Buffer): string {
  return extractPdfRuns(buffer)
    .map((r) => r.text)
    .join('');
}

/**
 * Runs grouped by VISUAL page order (the `/Pages` `/Kids` array), 0-based — the instrument the
 * INCREMENTAL_RENDER fidelity invariant needs to compare page N of a full export with a region
 * render (`renderPageRange`). Page objects do NOT appear in visual order in the file, so ordering
 * by `/Kids` (not by object-parse order) is what makes "page N" mean page N. Licensed by a positive
 * control before the invariant relies on it (SOLO_RENDER_VERIFICATION in reverse): self-identity on
 * a repeat extract, difference between two pages, and a known page's text matching the model.
 */
export function extractPdfRunsByPage(buffer: Buffer): PdfTextRun[][] {
  const raw = buffer.toString('latin1');
  const objects = parseObjects(raw);
  const fontCache = new Map<number, FontInfo>();

  // The page-tree root: /Type /Pages with an ordered /Kids array of page refs (PDFKit emits a flat
  // tree — every kid is a /Page). Fall back to parse-order page objects only if no /Pages node.
  let orderedBodies: string[] = [];
  for (const [, body] of objects) {
    if (!/\/Type\s*\/Pages\b/.test(body)) continue;
    const kidsMatch = body.match(/\/Kids\s*\[([\s\S]*?)\]/);
    if (!kidsMatch) continue;
    const kidNums = [...kidsMatch[1].matchAll(/(\d+)\s+0\s+R/g)].map((m) => Number(m[1]));
    orderedBodies = kidNums
      .map((n) => objects.get(n))
      .filter((b): b is string => !!b && /\/Type\s*\/Page\b/.test(b));
    break;
  }
  if (orderedBodies.length === 0) {
    orderedBodies = [...objects.values()].filter((b) => /\/Type\s*\/Page\b/.test(b));
  }

  return orderedBodies.map((body) => {
    const fontResourceMap = parseFontResourceMap(resolveResourcesBody(objects, body));
    const runs: PdfTextRun[] = [];
    for (const content of resolveContentStreams(objects, body)) {
      runs.push(...extractFromContentStream(content, fontResourceMap, objects, fontCache));
    }
    return runs;
  });
}

/** The concatenated text of one visual page (0-based) — the per-page analogue of extractPdfText. */
export function extractPdfPageText(buffer: Buffer, pageIndex: number): string {
  const pages = extractPdfRunsByPage(buffer);
  return (pages[pageIndex] ?? []).map((r) => r.text).join('');
}

/** Counts rendered pages by counting distinct page objects (`/MediaBox` appears once each). */
export function countPdfPages(buffer: Buffer): number {
  const raw = buffer.toString('latin1');
  return (raw.match(/\/MediaBox/g) ?? []).length;
}
