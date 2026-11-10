import { inflateSync, deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crc32, decodePng, encodePng, PNG_SIGNATURE, pngChunk } from './png.ts';

interface PngParts {
  width: number;
  height: number;
  colorType: number;
  /** Unfiltered scanlines, one per row. */
  rows: Uint8Array[];
  /** The filter type of each row (default 0). */
  filters?: number[];
  bitDepth?: number;
  interlace?: number;
  plte?: Uint8Array;
  trns?: Uint8Array;
  /** Split the image data over this many IDAT chunks. */
  idats?: number;
  /** Chunks added after IHDR, e.g. an ancillary tEXt. */
  extra?: [string, Uint8Array][];
}

/** The Paeth predictor, written out separately from the decoder's. */
function predict(a: number, b: number, c: number): number {
  const p = a + b - c;
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Applies PNG's forward row filters (the encoder's side), so the decoder can undo them. */
function filterRows(rows: Uint8Array[], filters: number[], bpp: number): Buffer {
  const out: number[] = [];
  rows.forEach((row, y) => {
    const filter = filters[y] ?? 0;
    out.push(filter);
    const above = y > 0 ? rows[y - 1]! : new Uint8Array(row.length);
    for (let i = 0; i < row.length; i++) {
      const a = i >= bpp ? row[i - bpp]! : 0;
      const b = above[i]!;
      const c = i >= bpp ? above[i - bpp]! : 0;
      const pred = [0, a, b, (a + b) >> 1, predict(a, b, c)][filter] ?? 0;
      out.push((row[i]! - pred) & 0xff);
    }
  });
  return Buffer.from(out);
}

const BPP: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Builds a PNG by hand, with any color type, filters, and chunks. */
function makePng(p: PngParts): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(p.width, 0);
  ihdr.writeUInt32BE(p.height, 4);
  ihdr[8] = p.bitDepth ?? 8;
  ihdr[9] = p.colorType;
  ihdr[12] = p.interlace ?? 0;
  const data = deflateSync(filterRows(p.rows, p.filters ?? [], BPP[p.colorType] ?? 1));
  const pieces = p.idats ?? 1;
  const step = Math.ceil(data.length / pieces);
  const chunks = [pngChunk('IHDR', ihdr)];
  for (const [type, body] of p.extra ?? []) chunks.push(pngChunk(type, body));
  if (p.plte) chunks.push(pngChunk('PLTE', p.plte));
  if (p.trns) chunks.push(pngChunk('tRNS', p.trns));
  for (let i = 0; i < pieces; i++) {
    chunks.push(pngChunk('IDAT', data.subarray(i * step, (i + 1) * step)));
  }
  chunks.push(pngChunk('IEND', new Uint8Array(0)));
  return Buffer.concat([PNG_SIGNATURE, ...chunks]);
}

/** A width × height image of varied RGBA pixels, with some transparency. */
function sampleRgba(width: number, height: number): Uint8Array {
  return Uint8Array.from({ length: width * height * 4 }, (_, i) =>
    i % 4 === 3 ? [255, 0, 128, 255][(i >> 2) % 4]! : (i * 53 + (i >> 5) * 17) % 256,
  );
}

function rowsOf(bytes: Uint8Array, stride: number): Uint8Array[] {
  return Array.from({ length: bytes.length / stride }, (_, y) =>
    bytes.subarray(y * stride, (y + 1) * stride),
  );
}

describe('crc32 and encodePng', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new TextEncoder().encode('IEND'))).toBe(0xae426082);
  });

  it('writes 8-bit RGBA with filter 0 on every row', () => {
    const rgba = sampleRgba(3, 2);
    const png = encodePng(3, 2, rgba);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.toString('latin1', 12, 16)).toBe('IHDR');
    expect([...png.subarray(24, 29)]).toEqual([8, 6, 0, 0, 0]);
    const idatLength = png.readUInt32BE(33);
    const raw = inflateSync(png.subarray(41, 41 + idatLength));
    expect(raw.length).toBe(2 * (3 * 4 + 1));
    expect([raw[0], raw[13]]).toEqual([0, 0]);
  });

  it('rejects a buffer of the wrong size', () => {
    expect(() => encodePng(2, 2, new Uint8Array(15))).toThrow(/expected 16 bytes/);
    expect(() => encodePng(0, 2, new Uint8Array(0))).toThrow(/bad size/);
  });
});

describe('decodePng', () => {
  it('round-trips what encodePng writes', () => {
    for (const [w, h] of [
      [1, 1],
      [3, 2],
      [17, 9],
    ] as const) {
      const rgba = sampleRgba(w, h);
      const image = decodePng(encodePng(w, h, rgba));
      expect([image.width, image.height]).toEqual([w, h]);
      expect([...image.rgba]).toEqual([...rgba]);
    }
  });

  it('undoes each of the five row filters, in RGBA, RGB, and grayscale', () => {
    const width = 7;
    const height = 5;
    const rgba = sampleRgba(width, height);
    for (const filter of [0, 1, 2, 3, 4]) {
      const filters = Array.from({ length: height }, () => filter);
      const fromRgba = decodePng(
        makePng({ width, height, colorType: 6, rows: rowsOf(rgba, width * 4), filters }),
      );
      expect([...fromRgba.rgba], `RGBA, filter ${filter}`).toEqual([...rgba]);

      const rgbBytes = rgba.filter((_, i) => i % 4 !== 3);
      const fromRgb = decodePng(
        makePng({ width, height, colorType: 2, rows: rowsOf(rgbBytes, width * 3), filters }),
      );
      const opaque = rgba.map((v, i) => (i % 4 === 3 ? 255 : v));
      expect([...fromRgb.rgba], `RGB, filter ${filter}`).toEqual([...opaque]);

      const gray = Uint8Array.from({ length: width * height }, (_, i) => (i * 37) % 256);
      const fromGray = decodePng(
        makePng({ width, height, colorType: 0, rows: rowsOf(gray, width), filters }),
      );
      expect([...fromGray.rgba], `gray, filter ${filter}`).toEqual(
        [...gray].flatMap((v) => [v, v, v, 255]),
      );
    }
    // And all five mixed in one image, each row predicting from the one above.
    const mixed = decodePng(
      makePng({
        width,
        height,
        colorType: 6,
        rows: rowsOf(rgba, width * 4),
        filters: [4, 3, 2, 1, 0],
      }),
    );
    expect([...mixed.rgba]).toEqual([...rgba]);
  });

  it('breaks Paeth ties as the spec does: a, then b, then c', () => {
    // Each case is a 2×2 gray image, [c, b] over [a, x], whose second row uses Paeth, so x is
    // predicted from a (left), b (above), and c (above left).
    const cases: [a: number, b: number, c: number, wants: string][] = [
      [0, 15, 10, 'a'], // pa = pc = 5 < pb
      [15, 0, 10, 'b'], // pb = pc = 5 < pa
      [7, 7, 3, 'a'], // pa = pb
      [20, 0, 10, 'c'], // pc = 0
      [100, 30, 90, 'b'], // no ties
      [200, 30, 100, 'c'], // no ties
    ];
    for (const [a, b, c, wants] of cases) {
      expect(predict(a, b, c), `the test's own predictor, for ${wants}`).toBe(
        { a, b, c }[wants as 'a' | 'b' | 'c'],
      );
      const rows = [Uint8Array.of(c, b), Uint8Array.of(a, 123)];
      const image = decodePng(
        makePng({ width: 2, height: 2, colorType: 0, rows, filters: [0, 4] }),
      );
      expect(image.rgba[3 * 4], `a=${a} b=${b} c=${c}`).toBe(123);
    }
  });

  it('reads a palette PNG, with tRNS alpha for the first entries only', () => {
    const plte = Uint8Array.of(255, 0, 0, 0, 255, 0, 0, 0, 255, 10, 20, 30);
    const trns = Uint8Array.of(0, 128); // index 0 clear, 1 half, 2 and 3 opaque
    const indices = Uint8Array.of(0, 1, 2, 3, 3, 2, 1, 0);
    const image = decodePng(
      makePng({
        width: 4,
        height: 2,
        colorType: 3,
        rows: rowsOf(indices, 4),
        filters: [1, 2],
        plte,
        trns,
      }),
    );
    expect([...image.rgba]).toEqual(
      [
        [255, 0, 0, 0],
        [0, 255, 0, 128],
        [0, 0, 255, 255],
        [10, 20, 30, 255],
        [10, 20, 30, 255],
        [0, 0, 255, 255],
        [0, 255, 0, 128],
        [255, 0, 0, 0],
      ].flat(),
    );
  });

  it('reads gray with alpha, and tRNS color keys in RGB and gray', () => {
    const ga = decodePng(
      makePng({ width: 2, height: 1, colorType: 4, rows: [Uint8Array.of(10, 0, 200, 255)] }),
    );
    expect([...ga.rgba]).toEqual([10, 10, 10, 0, 200, 200, 200, 255]);

    const rgb = decodePng(
      makePng({
        width: 2,
        height: 1,
        colorType: 2,
        rows: [Uint8Array.of(1, 2, 3, 4, 5, 6)],
        trns: Uint8Array.of(0, 4, 0, 5, 0, 6),
      }),
    );
    expect([...rgb.rgba]).toEqual([1, 2, 3, 255, 4, 5, 6, 0]);

    const gray = decodePng(
      makePng({
        width: 2,
        height: 1,
        colorType: 0,
        rows: [Uint8Array.of(7, 8)],
        trns: Uint8Array.of(0, 8),
      }),
    );
    expect([...gray.rgba]).toEqual([7, 7, 7, 255, 8, 8, 8, 0]);
  });

  it('joins split IDAT chunks and skips ancillary chunks', () => {
    const rgba = sampleRgba(5, 4);
    const image = decodePng(
      makePng({
        width: 5,
        height: 4,
        colorType: 6,
        rows: rowsOf(rgba, 20),
        idats: 3,
        extra: [['tEXt', new TextEncoder().encode('Software\0LimeZu')]],
      }),
    );
    expect([...image.rgba]).toEqual([...rgba]);
  });

  it('names the file and the problem', () => {
    const ok = { width: 2, height: 1, colorType: 6, rows: [new Uint8Array(8)] };
    expect(() => decodePng(Buffer.from('GIF89a, not a PNG'), 'x.png')).toThrow(
      'x.png: not a PNG file',
    );
    const corrupt = makePng(ok);
    corrupt[20] = corrupt[20]! ^ 0xff; // inside IHDR's data
    expect(() => decodePng(corrupt, 'x.png')).toThrow('x.png: bad CRC in its IHDR chunk');
    expect(() => decodePng(makePng({ ...ok, bitDepth: 16 }))).toThrow(
      /16-bit RGBA isn't supported/,
    );
    expect(() => decodePng(makePng({ ...ok, interlace: 1 }))).toThrow(/interlaced/);
    expect(() => decodePng(makePng({ ...ok, filters: [5] }))).toThrow(/unknown filter type 5/);
    expect(() => decodePng(makePng({ ...ok, rows: [new Uint8Array(4)] }))).toThrow(
      /image data is 5 bytes; 2×1 needs 9/,
    );
    expect(() =>
      decodePng(
        makePng({
          width: 1,
          height: 1,
          colorType: 3,
          rows: [Uint8Array.of(2)],
          plte: Uint8Array.of(1, 2, 3),
        }),
      ),
    ).toThrow(/palette index 2 is past the palette's 1 entries/);
    expect(() =>
      decodePng(makePng({ width: 1, height: 1, colorType: 3, rows: [Uint8Array.of(0)] })),
    ).toThrow(/without a PLTE chunk/);
    expect(() => decodePng(makePng({ ...ok, extra: [['ZZZZ', new Uint8Array(1)]] }))).toThrow(
      /unknown critical chunk ZZZZ/,
    );
    const truncated = makePng(ok).subarray(0, 40);
    expect(() => decodePng(truncated)).toThrow(/truncated/);
  });
});
