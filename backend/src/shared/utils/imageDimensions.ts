/**
 * Minimal in-repo image dimension probe — PNG/JPEG/GIF header parsing, no dependency
 * (BOOK_PRESENTATION.md Q4, CTO-locked: a library here would be a full new-dependency
 * decision with its own review line; these three formats are what DOCX manuscripts
 * actually embed). Returns undefined for anything unrecognized — callers keep their
 * existing fallbacks, nothing guesses.
 *
 * Dimensions are intrinsic pixels. PDF consumes them as points (PDFKit's own 72dpi
 * convention); DOCX as pixels; EPUB reflows. The R2 height contract prices from these
 * real numbers instead of DEFAULT_IMAGE_HEIGHT (`renderedImageSize`).
 */
export interface ImageDimensions {
  width: number;
  height: number;
  format: 'png' | 'jpeg' | 'gif';
}

export function probeImageDimensions(data: Buffer): ImageDimensions | undefined {
  if (data.length >= 24 && data.readUInt32BE(0) === 0x89504e47 && data.readUInt32BE(4) === 0x0d0a1a0a) {
    // PNG: 8-byte signature, then the IHDR chunk whose data starts at offset 16.
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), format: 'png' };
  }

  if (data.length >= 10 && data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) {
    // GIF87a/GIF89a: logical screen size, little-endian, right after the 6-byte header.
    return { width: data.readUInt16LE(6), height: data.readUInt16LE(8), format: 'gif' };
  }

  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8) {
    // JPEG: walk the marker segments to the first SOFn frame header (C0-CF, excluding the
    // non-frame markers C4/C8/CC); height then width sit at fixed offsets inside it.
    let offset = 2;
    while (offset + 9 < data.length) {
      if (data[offset] !== 0xff) return undefined; // corrupt stream — refuse to guess
      const marker = data[offset + 1];
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2; // standalone markers carry no length
        continue;
      }
      const length = data.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: data.readUInt16BE(offset + 7), height: data.readUInt16BE(offset + 5), format: 'jpeg' };
      }
      if (length < 2) return undefined;
      offset += 2 + length;
    }
  }

  return undefined;
}
