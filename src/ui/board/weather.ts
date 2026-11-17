// Weather for a change order (S06, D-180), the part that decides, kept pure so tests can check
// it: which running order has a look (the table is here, in the UI: looks are never content),
// which pieces it marks with a puddle (the rules' own breakdown says which it zeroed), where on a
// piece a puddle lies, where the rain's streaks stand in their tiles, and the rain's outline over
// the lot. WeatherLayer.tsx draws it. None of it is the rules: it reads them and changes nothing.

import {
  CONTENT,
  sourceName,
  type Cell,
  type ChangeOrderId,
  type PieceScore,
  type RunState,
} from '../../rules/index.ts';
import { drawingPixels, type DrawingId } from '../art/drawings.ts';
import { CELL } from '../sprites.ts';
import { tileHash } from './terrain/hash.ts';

/** The looks the weather has. Rain is the first; Cold snap's frost would be the next. */
export type Weather = 'rain';

/** A change order's look while its phase effect runs, by the order's id. */
export const ORDER_WEATHER: Readonly<Partial<Record<ChangeOrderId, Weather>>> = {
  rainySeason: 'rain',
};

/**
 * The weather on the lot and the change order it comes from: the first running phase effect with
 * a look. Null when none has one, and once the run is over (a lost run keeps its effects).
 */
export function weatherOf(
  state: Pick<RunState, 'screen' | 'timedEffects'>,
): { look: Weather; order: ChangeOrderId } | null {
  if (state.screen === 'won' || state.screen === 'lost') return null;
  for (const e of state.timedEffects) {
    // A tool's effect lasts one week's tally; a change order's runs through its phase.
    if (!('phase' in e.until)) continue;
    const order = e.source as ChangeOrderId;
    const look = Object.hasOwn(ORDER_WEATHER, order) ? ORDER_WEATHER[order] : undefined;
    if (look) return { look, order };
  }
  return null;
}

/**
 * The pieces `order` zeroes in a tally, by their breakdown's own line for it ("Earns nothing
 * (Rainy season)"): the rules say which pieces it touches, never the UI. A piece that earns
 * nothing for another reason (a Patio touching no room) has no such line, so it gets no puddle.
 */
export function zeroedBy(pieces: readonly PieceScore[], order: ChangeOrderId): number[] {
  const label = `Earns nothing (${sourceName(CONTENT, { kind: 'changeOrder', id: order })})`;
  return pieces
    .filter((p) => p.lines.some((l) => l.op === 'none' && l.label === label))
    .map((p) => p.uid);
}

/** The puddle's drawing. */
export const PUDDLE: DrawingId = 'own-puddle';
/** How far a puddle keeps inside its piece's edge, in art px. */
const PUDDLE_INSET = 2;
/** The margin around a puddle that counts as under it, so it doesn't lie flush with a chair. */
const PUDDLE_CLEAR = 1;

/**
 * Where a puddle `size` lies on a piece of `cells` (its top-left, in lot art px): inside the
 * piece by PUDDLE_INSET, over as few of `covered`'s pixels as it can (what stands on the paving:
 * a parasol, the seats, a doormat), then nearest the piece's middle, then the first in reading
 * order. Every 2 art px. Null when it doesn't fit on the piece.
 */
export function puddleSpot(
  cells: readonly Cell[],
  size: { readonly w: number; readonly h: number },
  covered: (x: number, y: number) => boolean,
): { x: number; y: number } | null {
  if (cells.length === 0) return null;
  const own = new Set(cells.map((c) => `${c.x},${c.y}`));
  const on = (x: number, y: number) => own.has(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`);
  const x0 = Math.min(...cells.map((c) => c.x)) * CELL;
  const y0 = Math.min(...cells.map((c) => c.y)) * CELL;
  const x1 = (Math.max(...cells.map((c) => c.x)) + 1) * CELL;
  const y1 = (Math.max(...cells.map((c) => c.y)) + 1) * CELL;
  const mid = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  const d = PUDDLE_INSET;
  const c = PUDDLE_CLEAR;
  let best: { x: number; y: number; hits: number; far: number } | null = null;
  for (let y = y0 + d; y + size.h + d <= y1; y += 2) {
    for (let x = x0 + d; x + size.w + d <= x1; x += 2) {
      // Inside the piece's own cells: a puddle is smaller than a cell, so its corners say.
      const [l, t, r, b] = [x - d, y - d, x + size.w + d - 1, y + size.h + d - 1];
      if (!on(l, t) || !on(r, t) || !on(l, b) || !on(r, b)) continue;
      let hits = 0;
      for (let j = y - c; j < y + size.h + c; j++) {
        for (let i = x - c; i < x + size.w + c; i++) if (covered(i, j)) hits++;
      }
      const far = (x + size.w / 2 - mid.x) ** 2 + (y + size.h / 2 - mid.y) ** 2;
      if (!best || hits < best.hits || (hits === best.hits && far < best.far)) {
        best = { x, y, hits, far };
      }
    }
  }
  return best && { x: best.x, y: best.y };
}

/** The frame a puddle's drops start from, by its piece's uid, so puddles don't ripple as one. */
export function puddleBeat(uid: number, frames: number): number {
  return tileHash(uid, 0, 0x9d1) % frames;
}

/**
 * The rain's two sheets, far and near: a tile of streaks `w` × `h` art px (three times as tall as
 * it's wide, the streaks' slope), repeated over the lot. Each step moves a sheet `step` art px left
 * and three times that down, along its streaks, so as many steps as fit across a tile bring it
 * round to where it began. The near sheet's streaks are longer and step further.
 */
export const SHEETS = {
  far: { sprite: 'own-rain-far', w: 40, h: 120, step: 1, salt: 0x2a1f },
  near: { sprite: 'own-rain-near', w: 64, h: 192, step: 2, salt: 0x7c33 },
} as const satisfies Record<
  string,
  { sprite: DrawingId; w: number; h: number; step: number; salt: number }
>;

export type SheetId = keyof typeof SHEETS;

/**
 * Where a sheet's streaks stand in its tile (each one's top-left, in art px): `across` × `down` of
 * them, one in each part of a grid over the tile, where its hash puts it, never by chance, so the
 * rain is spread evenly and the same every time. Each stays wholly inside the tile.
 */
export function rainStreaks(sheet: SheetId, across: number, down: number): Cell[] {
  const { sprite, w, h, salt } = SHEETS[sheet];
  const streak = drawingPixels(sprite);
  const cw = Math.floor(w / across);
  const ch = Math.floor(h / down);
  const out: Cell[] = [];
  for (let j = 0; j < down; j++) {
    for (let i = 0; i < across; i++) {
      const r = tileHash(i, j, salt);
      out.push({
        x: i * cw + (r % Math.max(1, cw - streak.w + 1)),
        y: j * ch + ((r >>> 12) % Math.max(1, ch - streak.h + 1)),
      });
    }
  }
  return out;
}

/** A sheet's tile as RGBA pixels (not premultiplied), its streaks on clear. */
export function rainTile(
  sheet: SheetId,
  across: number,
  down: number,
): { w: number; h: number; data: Uint8ClampedArray } {
  const { sprite, w, h } = SHEETS[sheet];
  const streak = drawingPixels(sprite);
  const data = new Uint8ClampedArray(w * h * 4);
  for (const at of rainStreaks(sheet, across, down)) {
    for (let y = 0; y < streak.h; y++) {
      for (let x = 0; x < streak.w; x++) {
        const from = (y * streak.w * streak.frames + x) * 4;
        if (streak.data[from + 3] === 0) continue;
        data.set(streak.data.subarray(from, from + 4), ((at.y + y) * w + at.x + x) * 4);
      }
    }
  }
  return { w, h, data };
}

const px2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The rain's outline over a lot `width` × `height` cells, at `px` CSS px a cell, as a CSS
 * clip-path: the lot, less each run of `dry` cells along a row (the house's rooms: it doesn't
 * rain indoors). Even-odd, so each run is a hole and runs that touch leave no seam.
 */
export function rainClip(
  width: number,
  height: number,
  dry: (x: number, y: number) => boolean,
  px: number,
): string {
  let d = `M0 0H${px2(width * px)}V${px2(height * px)}H0Z`;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width;) {
      if (!dry(x, y)) {
        x++;
        continue;
      }
      const from = x;
      while (x < width && dry(x, y)) x++;
      d += `M${px2(from * px)} ${px2(y * px)}H${px2(x * px)}V${px2((y + 1) * px)}H${px2(from * px)}Z`;
    }
  }
  return `path(evenodd, '${d}')`;
}
