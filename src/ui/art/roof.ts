// The house's roof (D-097's "a roof computed for any footprint"; D-127), for the roof reveal at
// the Roofing milestone: the board covers the walls-down cutaway with it for a moment. Pure: it
// paints pixels from the house model, by fixed rules, in LimeZu's palette (art/palette.ts).
//
// The roof covers every room's cells, out past the walls by its eaves. It's a terracotta gable
// over each run of the house down a column: the south slope (toward the viewer) lit, the north
// one in shade, a ridge cap where they meet, rows of shingles offset like bricks, and a fascia
// along every south edge, which shows the roof's thickness in the 3/4 view. A chimney stands on
// the north slope of the house's first room. An L or a T gets a ridge per column run, so its
// wings read as wings.

import { CELL } from '../sprites.ts';
import type { HouseModel } from '../board/house-model.ts';
import type { Pixels } from './house-paint.ts';

type Rgb = readonly [number, number, number];
const rgb = (hex: string): Rgb => {
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** The roof's colors, all LimeZu's (palette.ts). */
export const ROOF_COLORS = {
  ink: rgb('3a3a50'),
  south: rgb('b35e3f'),
  southHi: rgb('ca8854'),
  north: rgb('ab4a36'),
  northHi: rgb('b35e3f'),
  seam: rgb('7d3846'),
  ridge: rgb('d9a16a'),
  ridgeLo: rgb('8e595c'),
  fascia: rgb('943c3f'),
  brick: rgb('a7604a'),
  mortar: rgb('d6cab3'),
  cap: rgb('46465e'),
} as const;

/** How far the roof reaches past the walls, in art px. */
const EAVE = 3;
/** The fascia's depth under the south eaves. */
const FASCIA = 3;
/** A shingle row's height and a shingle's width. */
const ROW = 4;
const SHINGLE = 8;

/**
 * The roof over a house model, as pixels on the lot's canvas (null before the first room). The
 * canvas is the lot and its street row, as the house's other canvases are.
 */
export function paintRoof(m: HouseModel): Pixels | null {
  const W = m.width * CELL;
  const H = (m.height + 1) * CELL;
  // The roof's footprint in art px: every room cell, grown by the eaves.
  const inRoom = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < m.width && y < m.height && m.room[y * m.width + x] !== 0;
  if (!m.rooms.size) return null;
  const cover = new Uint8Array(W * H);
  for (let cy = 0; cy < m.height; cy++) {
    for (let cx = 0; cx < m.width; cx++) {
      if (!inRoom(cx, cy)) continue;
      const x0 = Math.max(0, cx * CELL - EAVE);
      const x1 = Math.min(W, (cx + 1) * CELL + EAVE);
      const y0 = Math.max(0, cy * CELL - EAVE);
      const y1 = Math.min(H, (cy + 1) * CELL + EAVE);
      for (let y = y0; y < y1; y++) cover.fill(1, y * W + x0, y * W + x1);
    }
  }
  const data = new Uint8ClampedArray(W * H * 4);
  const put = (x: number, y: number, c: Rgb) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
    data[i + 3] = 255;
  };
  const covered = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < W && y < H && !!cover[y * W + x];

  // Each column's runs: a gable over each, its ridge at the run's middle.
  for (let x = 0; x < W; x++) {
    let y = 0;
    while (y < H) {
      if (!covered(x, y)) {
        y++;
        continue;
      }
      const top = y;
      while (y < H && covered(x, y)) y++;
      const bottom = y; // exclusive
      // The fascia under the south eave, then the slopes over the rest.
      const roofBottom = Math.max(top + 2, bottom - FASCIA);
      const ridge = Math.round((top + roofBottom) / 2);
      for (let py = top; py < bottom; py++) {
        if (py >= roofBottom) {
          put(x, py, ROOF_COLORS.fascia);
          continue;
        }
        const south = py >= ridge;
        // Shingle rows count from the ridge, down each slope, offset like bricks.
        const d = south ? py - ridge : ridge - 1 - py;
        const row = Math.floor(d / ROW);
        const inRow = d % ROW;
        const seamX = (x + (row % 2) * (SHINGLE / 2)) % SHINGLE === 0;
        let c = south ? ROOF_COLORS.south : ROOF_COLORS.north;
        // Each row's lower lip catches the light; the seams between shingles are dark.
        if (inRow === (south ? 0 : ROW - 1)) c = south ? ROOF_COLORS.southHi : ROOF_COLORS.northHi;
        if (inRow === (south ? ROW - 1 : 0) || seamX) c = ROOF_COLORS.seam;
        if (py === ridge || py === ridge - 1) c = ROOF_COLORS.ridge;
        if (py === ridge + 1) c = ROOF_COLORS.ridgeLo;
        put(x, py, c);
      }
    }
  }

  // The outline: ink round the whole roof.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!covered(x, y)) continue;
      if (!covered(x - 1, y) || !covered(x + 1, y) || !covered(x, y - 1) || !covered(x, y + 1))
        put(x, y, ROOF_COLORS.ink);
    }
  }

  // A chimney on the north slope of the first room: bricks with mortar, and a dark cap.
  const first = [...m.rooms.values()][0];
  const cell = first?.cells[0];
  if (cell) {
    const cx = cell.x * CELL + CELL - 12;
    const cy = cell.y * CELL + 2;
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 7; x++) {
        const edge = x === 0 || x === 6 || y === 9;
        const mortar = y % 3 === 2 || (x === (Math.floor(y / 3) % 2 ? 3 : 1) && y % 3 !== 2);
        put(
          cx + x,
          cy + y,
          edge ? ROOF_COLORS.ink : mortar ? ROOF_COLORS.mortar : ROOF_COLORS.brick,
        );
      }
    }
    for (let x = -1; x < 8; x++) {
      put(cx + x, cy - 1, ROOF_COLORS.ink);
      put(cx + x, cy, ROOF_COLORS.cap);
    }
  }
  return { x: 0, y: 0, w: W, h: H, data };
}
