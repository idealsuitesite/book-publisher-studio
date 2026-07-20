import { describe, it, expect } from 'vitest';
import { probeImageDimensions } from './imageDimensions';

function pngOf(width: number, height: number): Buffer {
  const b = Buffer.alloc(24);
  b.writeUInt32BE(0x89504e47, 0);
  b.writeUInt32BE(0x0d0a1a0a, 4);
  b.writeUInt32BE(13, 8); // IHDR length
  b.write('IHDR', 12);
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

function gifOf(width: number, height: number): Buffer {
  const b = Buffer.alloc(10);
  b.write('GIF89a', 0);
  b.writeUInt16LE(width, 6);
  b.writeUInt16LE(height, 8);
  return b;
}

function jpegOf(width: number, height: number): Buffer {
  // SOI + APP0 (skipped by the walker) + SOF0 carrying the frame size.
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]);
  const sof0 = Buffer.alloc(11);
  sof0[0] = 0xff;
  sof0[1] = 0xc0;
  sof0.writeUInt16BE(9, 2); // segment length
  sof0[4] = 8; // precision
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof0]);
}

describe('probeImageDimensions', () => {
  it('reads PNG dimensions from the IHDR chunk', () => {
    expect(probeImageDimensions(pngOf(640, 480))).toEqual({ width: 640, height: 480, format: 'png' });
  });

  it('reads GIF dimensions from the logical screen descriptor', () => {
    expect(probeImageDimensions(gifOf(120, 90))).toEqual({ width: 120, height: 90, format: 'gif' });
  });

  it('walks JPEG markers to the SOF0 frame size', () => {
    expect(probeImageDimensions(jpegOf(1024, 768))).toEqual({ width: 1024, height: 768, format: 'jpeg' });
  });

  it('refuses to guess on unrecognized bytes', () => {
    expect(probeImageDimensions(Buffer.from('not an image at all'))).toBeUndefined();
    expect(probeImageDimensions(Buffer.alloc(0))).toBeUndefined();
  });
});
