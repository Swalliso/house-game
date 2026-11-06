// PNG encoding and decoding for the art scripts: build-atlas.ts writes the atlas, and cut-art.ts
// reads LimeZu's sheets and writes the cuts (D-066, D-097). No npm dependencies: node:zlib does
// the deflate.
//
// The decoder reads what the packs hold: 8-bit grayscale, RGB, palette, gray with alpha, and
// RGBA, not interlaced, with any of the five row filters, and tRNS transparency. It returns
// 8-bit RGBA. Anything else (16-bit or 1-4-bit samples, interlacing) is an error that says so.

import { deflateSync, inflateSync } from 'node:zlib';

/** An image as 8-bit RGBA, row-major: width × height × 4 bytes. */
export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** The CRC-32 that PNG chunks and zip entries use (ISO 3309, polynomial 0xEDB88320). */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export const PNG_SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

/** One PNG chunk: length, type, data, and the CRC of type and data. */
export function pngChunk(type: string, data: Uint8Array): Buffer {
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const chunk = Buffer.alloc(8 + data.length + 4);
  chunk.writeUInt32BE(data.length, 0);
  typeAndData.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + data.length);
  return chunk;
}

/** Encodes RGBA pixels as a PNG: 8-bit RGBA, no interlace, filter type 0 on every row. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error(`encodePng: bad size ${width}×${height}`);
  }
  if (rgba.length !== width * height * 4) {
    throw new Error(`encodePng: expected ${width * height * 4} bytes of RGBA, got ${rgba.length}`);
  }
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace: none
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', new Uint8Array(0)),
  ]);
}

/** Bytes per pixel of each color type at 8 bits per sample. */
const CHANNELS: Readonly<Record<number, number>> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const COLOR_TYPE_NAMES: Readonly<Record<number, string>> = {
  0: 'grayscale',
  2: 'RGB',
  3: 'palette',
  4: 'gray with alpha',
  6: 'RGBA',
};

/** The Paeth predictor (PNG spec, section 9.4). */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * Decodes a PNG to 8-bit RGBA. `source` names the file in errors. Checks every chunk's CRC and
 * the image data's length, so a damaged file fails here rather than drawing garbage.
 */
export function decodePng(bytes: Uint8Array, source = 'PNG'): RgbaImage {
  const png = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fail = (message: string): never => {
    throw new Error(`${source}: ${message}`);
  };
  if (png.length < 8 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) fail('not a PNG file');

  let width = 0;
  let height = 0;
  let colorType = -1;
  let palette: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  let ended = false;
  for (let off = 8; off < png.length && !ended;) {
    if (off + 12 > png.length) fail('truncated chunk');
    const length = png.readUInt32BE(off);
    const type = png.toString('latin1', off + 4, off + 8);
    if (off + 12 + length > png.length) fail(`truncated ${type} chunk`);
    const data = png.subarray(off + 8, off + 8 + length);
    if (png.readUInt32BE(off + 8 + length) !== crc32(png.subarray(off + 4, off + 8 + length))) {
      fail(`bad CRC in its ${type} chunk`);
    }
    if (off === 8 && type !== 'IHDR') fail('the first chunk is not IHDR');
    switch (type) {
      case 'IHDR': {
        if (length !== 13) fail('IHDR is not 13 bytes');
        width = data.readUInt32BE(0);
        height = data.readUInt32BE(4);
        const bitDepth = data[8]!;
        colorType = data[9]!;
        if (width < 1 || height < 1) fail(`bad size ${width}×${height}`);
        if (CHANNELS[colorType] === undefined) fail(`unknown color type ${colorType}`);
        if (bitDepth !== 8) {
          fail(`${bitDepth}-bit ${COLOR_TYPE_NAMES[colorType]} isn't supported (8-bit only)`);
        }
        if (data[10] !== 0 || data[11] !== 0) fail('unknown compression or filter method');
        if (data[12] !== 0) fail("interlaced PNGs aren't supported");
        break;
      }
      case 'PLTE':
        if (length % 3 !== 0 || length === 0 || length > 256 * 3) fail('bad PLTE chunk');
        palette = data;
        break;
      case 'tRNS':
        trns = data;
        break;
      case 'IDAT':
        idat.push(data);
        break;
      case 'IEND':
        ended = true;
        break;
      default:
        // Ancillary chunks (gAMA, pHYs, tEXt, ...) don't change the pixels we use.
        if ((type.charCodeAt(0) & 0x20) === 0) fail(`unknown critical chunk ${type}`);
    }
    off += 12 + length;
  }
  if (!ended) fail('no IEND chunk');
  if (idat.length === 0) fail('no image data');
  if (colorType === 3 && !palette) fail('a palette PNG without a PLTE chunk');

  const bpp = CHANNELS[colorType]!;
  const stride = width * bpp;
  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch (error) {
    return fail(`bad image data (${error instanceof Error ? error.message : String(error)})`);
  }
  if (raw.length !== (stride + 1) * height) {
    fail(`image data is ${raw.length} bytes; ${width}×${height} needs ${(stride + 1) * height}`);
  }

  // Undo the row filters, in place, into `pixels`.
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = y * stride;
    const prev = row - stride; // the row above, already unfiltered
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? pixels[row + i - bpp]! : 0;
      const b = y > 0 ? pixels[prev + i]! : 0;
      const c = i >= bpp && y > 0 ? pixels[prev + i - bpp]! : 0;
      const v = line[i]!;
      let out: number;
      switch (filter) {
        case 0:
          out = v;
          break;
        case 1:
          out = v + a;
          break;
        case 2:
          out = v + b;
          break;
        case 3:
          out = v + ((a + b) >> 1);
          break;
        case 4:
          out = v + paeth(a, b, c);
          break;
        default:
          return fail(`row ${y} has unknown filter type ${filter}`);
      }
      pixels[row + i] = out & 0xff;
    }
  }

  // Expand to RGBA.
  const rgba = new Uint8Array(width * height * 4);
  const count = width * height;
  if (colorType === 6) {
    rgba.set(pixels);
  } else if (colorType === 2) {
    // tRNS for RGB: one 16-bit sample per channel names the transparent color.
    const key = trns && trns.length >= 6 ? [trns[1]!, trns[3]!, trns[5]!] : null;
    for (let p = 0; p < count; p++) {
      const r = pixels[p * 3]!;
      const g = pixels[p * 3 + 1]!;
      const b = pixels[p * 3 + 2]!;
      const clear = key !== null && r === key[0] && g === key[1] && b === key[2];
      rgba.set([r, g, b, clear ? 0 : 255], p * 4);
    }
  } else if (colorType === 0 || colorType === 4) {
    const key = colorType === 0 && trns && trns.length >= 2 ? trns[1]! : -1;
    for (let p = 0; p < count; p++) {
      const v = pixels[p * bpp]!;
      const alpha = colorType === 4 ? pixels[p * 2 + 1]! : v === key ? 0 : 255;
      rgba.set([v, v, v, alpha], p * 4);
    }
  } else {
    const pal = palette!;
    const entries = pal.length / 3;
    for (let p = 0; p < count; p++) {
      const index = pixels[p]!;
      if (index >= entries) fail(`palette index ${index} is past the palette's ${entries} entries`);
      const alpha = trns && index < trns.length ? trns[index]! : 255;
      rgba.set([pal[index * 3]!, pal[index * 3 + 1]!, pal[index * 3 + 2]!, alpha], p * 4);
    }
  }
  return { width, height, rgba };
}
